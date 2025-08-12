#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const BLOGGER_API_KEY = process.env.BLOGGER_API_KEY;
const BLOG_ID = process.env.BLOG_ID;

if (!BLOGGER_API_KEY) {
  throw new Error('BLOGGER_API_KEY environment variable is required');
}

if (!BLOG_ID) {
  throw new Error('BLOG_ID environment variable is required');
}

interface BloggerPost {
  id: string;
  title: string;
  content: string;
  published: string;
  updated: string;
  url: string;
  labels?: string[];
}

interface BloggerResponse {
  items: BloggerPost[];
  nextPageToken?: string;
}

const isValidGetPostsArgs = (
  args: any
): args is { maxResults?: number; pageToken?: string; labels?: string } =>
  typeof args === 'object' &&
  args !== null &&
  (args.maxResults === undefined || typeof args.maxResults === 'number') &&
  (args.pageToken === undefined || typeof args.pageToken === 'string') &&
  (args.labels === undefined || typeof args.labels === 'string');

class BloggerServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'blogger-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://www.googleapis.com/blogger/v3',
      params: {
        key: BLOGGER_API_KEY,
      },
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_blog_posts',
          description: 'Retrieve blog posts from Blogger',
          inputSchema: {
            type: 'object',
            properties: {
              maxResults: {
                type: 'number',
                description: 'Maximum number of posts to retrieve (default: 10, max: 500)',
                minimum: 1,
                maximum: 500,
              },
              pageToken: {
                type: 'string',
                description: 'Token for pagination to get next page of results',
              },
              labels: {
                type: 'string',
                description: 'Comma-separated list of labels to filter posts',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_blog_info',
          description: 'Get basic information about the blog',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'search_posts',
          description: 'Search for posts containing specific text',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query text',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of posts to retrieve (default: 10)',
                minimum: 1,
                maximum: 100,
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_blog_posts':
          return await this.getBlogPosts(request.params.arguments);
        case 'get_blog_info':
          return await this.getBlogInfo();
        case 'search_posts':
          return await this.searchPosts(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async getBlogPosts(args: any) {
    if (!isValidGetPostsArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments for get_blog_posts'
      );
    }

    try {
      const params: any = {
        maxResults: args.maxResults || 10,
      };

      if (args.pageToken) {
        params.pageToken = args.pageToken;
      }

      if (args.labels) {
        params.labels = args.labels;
      }

      const response = await this.axiosInstance.get<BloggerResponse>(
        `/blogs/${BLOG_ID}/posts`,
        { params }
      );

      const posts = response.data.items || [];
      const processedPosts = posts.map((post: BloggerPost) => ({
        id: post.id,
        title: post.title,
        content: this.stripHtml(post.content),
        published: post.published,
        updated: post.updated,
        url: post.url,
        labels: post.labels || [],
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              posts: processedPosts,
              nextPageToken: response.data.nextPageToken,
              totalPosts: processedPosts.length,
            }, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Blogger API error: ${
                error.response?.data?.error?.message ?? error.message
              }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async getBlogInfo() {
    try {
      const response = await this.axiosInstance.get(`/blogs/${BLOG_ID}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: response.data.id,
              name: response.data.name,
              description: response.data.description,
              url: response.data.url,
              published: response.data.published,
              updated: response.data.updated,
              posts: response.data.posts,
              pages: response.data.pages,
            }, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Blogger API error: ${
                error.response?.data?.error?.message ?? error.message
              }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async searchPosts(args: any) {
    if (!args || typeof args.query !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Search query is required'
      );
    }

    try {
      const params = {
        q: args.query,
        maxResults: args.maxResults || 10,
      };

      const response = await this.axiosInstance.get<BloggerResponse>(
        `/blogs/${BLOG_ID}/posts/search`,
        { params }
      );

      const posts = response.data.items || [];
      const processedPosts = posts.map((post: BloggerPost) => ({
        id: post.id,
        title: post.title,
        content: this.stripHtml(post.content),
        published: post.published,
        updated: post.updated,
        url: post.url,
        labels: post.labels || [],
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: args.query,
              posts: processedPosts,
              totalResults: processedPosts.length,
            }, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return {
          content: [
            {
              type: 'text',
              text: `Blogger API error: ${
                error.response?.data?.error?.message ?? error.message
              }`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  }

  private stripHtml(html: string): string {
    // Simple HTML stripping - in production, you might want to use a proper HTML parser
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Blogger MCP server running on stdio');
  }
}

const server = new BloggerServer();
server.run().catch(console.error);
