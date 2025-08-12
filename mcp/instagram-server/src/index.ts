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

const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

if (!INSTAGRAM_ACCESS_TOKEN) {
  throw new Error('INSTAGRAM_ACCESS_TOKEN environment variable is required');
}

if (!INSTAGRAM_USER_ID) {
  throw new Error('INSTAGRAM_USER_ID environment variable is required');
}

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  permalink?: string;
  timestamp: string;
  username?: string;
  like_count?: number;
  comments_count?: number;
}

interface InstagramResponse {
  data: InstagramMedia[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

const isValidGetMediaArgs = (
  args: any
): args is { limit?: number; after?: string; before?: string } =>
  typeof args === 'object' &&
  args !== null &&
  (args.limit === undefined || typeof args.limit === 'number') &&
  (args.after === undefined || typeof args.after === 'string') &&
  (args.before === undefined || typeof args.before === 'string');

class InstagramServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'instagram-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://graph.instagram.com',
      params: {
        access_token: INSTAGRAM_ACCESS_TOKEN,
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
          name: 'get_instagram_media',
          description: 'Retrieve media posts from Instagram Business account',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of media items to retrieve (default: 10, max: 100)',
                minimum: 1,
                maximum: 100,
              },
              after: {
                type: 'string',
                description: 'Cursor for pagination to get next page of results',
              },
              before: {
                type: 'string',
                description: 'Cursor for pagination to get previous page of results',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_user_info',
          description: 'Get basic information about the Instagram user',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'search_media',
          description: 'Search for media posts containing specific text in captions',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query text',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of media items to retrieve (default: 10)',
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
        case 'get_instagram_media':
          return await this.getInstagramMedia(request.params.arguments);
        case 'get_user_info':
          return await this.getUserInfo();
        case 'search_media':
          return await this.searchMedia(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async getInstagramMedia(args: any) {
    if (!isValidGetMediaArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid arguments for get_instagram_media'
      );
    }

    try {
      const params: any = {
        fields: 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count',
        limit: args.limit || 10,
      };

      if (args.after) {
        params.after = args.after;
      }

      if (args.before) {
        params.before = args.before;
      }

      const response = await this.axiosInstance.get<InstagramResponse>(
        `/${INSTAGRAM_USER_ID}/media`,
        { params }
      );

      const media = response.data.data || [];
      const processedMedia = media.map((item: InstagramMedia) => ({
        id: item.id,
        caption: item.caption || '',
        media_type: item.media_type,
        media_url: item.media_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
        username: item.username,
        like_count: item.like_count || 0,
        comments_count: item.comments_count || 0,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              media: processedMedia,
              paging: response.data.paging,
              totalMedia: processedMedia.length,
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
              text: `Instagram API error: ${
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

  private async getUserInfo() {
    try {
      const response = await this.axiosInstance.get(
        `/${INSTAGRAM_USER_ID}`,
        {
          params: {
            fields: 'id,username,account_type,media_count,followers_count,follows_count,name,biography,website',
          },
        }
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: response.data.id,
              username: response.data.username,
              account_type: response.data.account_type,
              media_count: response.data.media_count,
              followers_count: response.data.followers_count,
              follows_count: response.data.follows_count,
              name: response.data.name,
              biography: response.data.biography,
              website: response.data.website,
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
              text: `Instagram API error: ${
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

  private async searchMedia(args: any) {
    if (!args || typeof args.query !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Search query is required'
      );
    }

    try {
      // First get all media, then filter locally since Instagram Basic Display API doesn't support text search
      const params = {
        fields: 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count',
        limit: args.limit || 10,
      };

      const response = await this.axiosInstance.get<InstagramResponse>(
        `/${INSTAGRAM_USER_ID}/media`,
        { params }
      );

      const media = response.data.data || [];
      const query = args.query.toLowerCase();
      
      // Filter media that contain the search query in caption
      const filteredMedia = media.filter((item: InstagramMedia) => {
        const caption = (item.caption || '').toLowerCase();
        return caption.includes(query);
      });

      const processedMedia = filteredMedia.map((item: InstagramMedia) => ({
        id: item.id,
        caption: item.caption || '',
        media_type: item.media_type,
        media_url: item.media_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
        username: item.username,
        like_count: item.like_count || 0,
        comments_count: item.comments_count || 0,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: args.query,
              media: processedMedia,
              totalResults: processedMedia.length,
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
              text: `Instagram API error: ${
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
    console.error('Instagram MCP server running on stdio');
  }
}

const server = new InstagramServer();
server.run().catch(console.error);
