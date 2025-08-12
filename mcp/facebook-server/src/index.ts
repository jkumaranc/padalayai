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

const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;

if (!FACEBOOK_ACCESS_TOKEN) {
  throw new Error('FACEBOOK_ACCESS_TOKEN environment variable is required');
}

if (!FACEBOOK_PAGE_ID) {
  throw new Error('FACEBOOK_PAGE_ID environment variable is required');
}

interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  updated_time: string;
  permalink_url?: string;
  attachments?: {
    data: Array<{
      type: string;
      title?: string;
      description?: string;
      url?: string;
    }>;
  };
}

interface FacebookResponse {
  data: FacebookPost[];
  paging?: {
    next?: string;
    previous?: string;
    cursors?: {
      before: string;
      after: string;
    };
  };
}

const isValidGetPostsArgs = (
  args: any
): args is { limit?: number; since?: string; until?: string; after?: string } =>
  typeof args === 'object' &&
  args !== null &&
  (args.limit === undefined || typeof args.limit === 'number') &&
  (args.since === undefined || typeof args.since === 'string') &&
  (args.until === undefined || typeof args.until === 'string') &&
  (args.after === undefined || typeof args.after === 'string');

class FacebookServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'facebook-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      params: {
        access_token: FACEBOOK_ACCESS_TOKEN,
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
          name: 'get_facebook_posts',
          description: 'Retrieve posts from Facebook page',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of posts to retrieve (default: 10, max: 100)',
                minimum: 1,
                maximum: 100,
              },
              since: {
                type: 'string',
                description: 'Unix timestamp or strtotime data value that points to the start of the range of time-based data',
              },
              until: {
                type: 'string',
                description: 'Unix timestamp or strtotime data value that points to the end of the range of time-based data',
              },
              after: {
                type: 'string',
                description: 'Cursor for pagination to get next page of results',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_page_info',
          description: 'Get basic information about the Facebook page',
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
              limit: {
                type: 'number',
                description: 'Maximum number of posts to retrieve (default: 10)',
                minimum: 1,
                maximum: 50,
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_facebook_posts':
          return await this.getFacebookPosts(request.params.arguments);
        case 'get_page_info':
          return await this.getPageInfo();
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

  private async getFacebookPosts(args: any) {
    if (!isValidGetPostsArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments for get_facebook_posts'
      );
    }

    try {
      const params: any = {
        fields: 'id,message,story,created_time,updated_time,permalink_url,attachments{type,title,description,url}',
        limit: args.limit || 10,
      };

      if (args.since) {
        params.since = args.since;
      }

      if (args.until) {
        params.until = args.until;
      }

      if (args.after) {
        params.after = args.after;
      }

      const response = await this.axiosInstance.get<FacebookResponse>(
        `/${FACEBOOK_PAGE_ID}/posts`,
        { params }
      );

      const posts = response.data.data || [];
      const processedPosts = posts.map((post: FacebookPost) => ({
        id: post.id,
        message: post.message || post.story || '',
        created_time: post.created_time,
        updated_time: post.updated_time,
        permalink_url: post.permalink_url,
        attachments: post.attachments?.data || [],
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              posts: processedPosts,
              paging: response.data.paging,
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
              text: `Facebook API error: ${
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

  private async getPageInfo() {
    try {
      const response = await this.axiosInstance.get(
        `/${FACEBOOK_PAGE_ID}`,
        {
          params: {
            fields: 'id,name,about,description,website,fan_count,followers_count,category,created_time',
          },
        }
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: response.data.id,
              name: response.data.name,
              about: response.data.about,
              description: response.data.description,
              website: response.data.website,
              fan_count: response.data.fan_count,
              followers_count: response.data.followers_count,
              category: response.data.category,
              created_time: response.data.created_time,
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
              text: `Facebook API error: ${
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
      // First get all posts, then filter locally since Facebook Graph API doesn't support text search on posts
      const params = {
        fields: 'id,message,story,created_time,updated_time,permalink_url,attachments{type,title,description,url}',
        limit: args.limit || 10,
      };

      const response = await this.axiosInstance.get<FacebookResponse>(
        `/${FACEBOOK_PAGE_ID}/posts`,
        { params }
      );

      const posts = response.data.data || [];
      const query = args.query.toLowerCase();
      
      // Filter posts that contain the search query
      const filteredPosts = posts.filter((post: FacebookPost) => {
        const content = (post.message || post.story || '').toLowerCase();
        return content.includes(query);
      });

      const processedPosts = filteredPosts.map((post: FacebookPost) => ({
        id: post.id,
        message: post.message || post.story || '',
        created_time: post.created_time,
        updated_time: post.updated_time,
        permalink_url: post.permalink_url,
        attachments: post.attachments?.data || [],
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
              text: `Facebook API error: ${
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Facebook MCP server running on stdio');
  }
}

const server = new FacebookServer();
server.run().catch(console.error);
