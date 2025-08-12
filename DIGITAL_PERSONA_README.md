# Digital Persona Feature

The Digital Persona feature aggregates your public-facing content from multiple social media platforms (Blogger, Facebook, Instagram) and makes it available within the PadalayAI RAG service for querying. This creates a unified digital representation of your online presence that can be queried using natural language.

## Architecture

The feature uses a Model Context Protocol (MCP) server architecture:

- **Main Backend**: PadalayAI backend communicates with MCP servers
- **MCP Servers**: Small, dedicated servers for each social media platform
- **RAG Integration**: Social media content is processed and indexed alongside documents

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   MCP Servers   │
│                 │    │                 │    │                 │
│ Digital Persona │◄──►│ Digital Persona │◄──►│ Blogger Server  │
│ Interface       │    │ Service         │    │ Facebook Server │
│                 │    │                 │    │ Instagram Server│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   RAG Service   │
                       │                 │
                       │ ChromaDB Vector │
                       │ Store           │
                       └─────────────────┘
```

## MCP Servers

### 1. Blogger Server (`mcp/blogger-server/`)

Fetches blog posts from Blogger API.

**Tools:**
- `get_blog_posts`: Retrieve blog posts with pagination
- `get_blog_info`: Get blog information
- `search_posts`: Search posts by content

**Environment Variables:**
- `BLOGGER_API_KEY`: Google API key with Blogger API access
- `BLOGGER_BLOG_ID`: Your blog ID

### 2. Facebook Server (`mcp/facebook-server/`)

Fetches posts from Facebook Page using Graph API.

**Tools:**
- `get_facebook_posts`: Retrieve page posts with pagination
- `get_page_info`: Get page information
- `search_posts`: Search posts by content (local filtering)

**Environment Variables:**
- `FACEBOOK_ACCESS_TOKEN`: Facebook Page access token
- `FACEBOOK_PAGE_ID`: Your Facebook page ID

### 3. Instagram Server (`mcp/instagram-server/`)

Fetches media from Instagram Business account using Instagram Basic Display API.

**Tools:**
- `get_instagram_media`: Retrieve media posts with pagination
- `get_user_info`: Get user account information
- `search_media`: Search media by caption content

**Environment Variables:**
- `INSTAGRAM_ACCESS_TOKEN`: Instagram access token
- `INSTAGRAM_USER_ID`: Your Instagram user ID

## Setup Instructions

### 1. Build MCP Servers

```bash
# Build all MCP servers
cd mcp/blogger-server && npm install && npm run build
cd ../facebook-server && npm install && npm run build
cd ../instagram-server && npm install && npm run build
```

### 2. Configure Environment Variables

Create environment files for each MCP server or add to your main `.env`:

```bash
# Blogger API
BLOGGER_API_KEY=your_google_api_key
BLOGGER_BLOG_ID=your_blog_id

# Facebook API
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token
FACEBOOK_PAGE_ID=your_page_id

# Instagram API
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_USER_ID=your_user_id
```

### 3. API Setup

#### Blogger API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Blogger API v3
4. Create credentials (API Key)
5. Find your Blog ID from your Blogger dashboard URL

#### Facebook API Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a Facebook App
3. Add Facebook Login and Pages API products
4. Generate a Page Access Token
5. Get your Page ID from your Facebook page

#### Instagram API Setup
1. Convert your Instagram account to Business account
2. Connect it to a Facebook Page
3. Use Facebook Graph API to get Instagram Business Account ID
4. Generate access token with Instagram permissions

### 4. Start the Application

```bash
# Start backend (includes Digital Persona service)
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev
```

## Usage

### 1. Access Digital Persona

Navigate to `/digital-persona` in the frontend application.

### 2. Sync Social Media Content

1. Click "Sync All Platforms" to fetch content from all platforms
2. Or sync individual platforms using the "Sync" button on each platform card
3. Monitor sync status and content counts

### 3. Query Your Digital Persona

1. Use the query interface to ask questions about your content
2. Examples:
   - "What topics do I write about most?"
   - "Show me posts about technology"
   - "What did I post about last month?"
   - "Find content related to AI and machine learning"

### 4. Manage Content

- View statistics for each platform
- Remove content from specific platforms
- Monitor sync status and last update times

## API Endpoints

### Digital Persona API (`/api/digital-persona`)

- `POST /sync` - Sync social media content
- `POST /query` - Query digital persona
- `GET /stats` - Get statistics
- `GET /sync-status` - Get sync status
- `DELETE /platform/:platform` - Remove platform content
- `GET /health` - Health check

## Features

### Content Aggregation
- Unified content structure across platforms
- Automatic content processing and chunking
- Metadata preservation (URLs, dates, platform info)

### RAG Integration
- Social media content indexed alongside documents
- Vector similarity search across all content
- Context-aware responses with source attribution

### Platform Management
- Individual platform sync control
- Content removal by platform
- Sync status monitoring

### Query Interface
- Natural language queries across all content
- Source attribution with platform information
- Confidence scoring and similarity matching

## Data Structure

### Unified Document Format
```javascript
{
  id: "platform-originalId",
  filename: "platform-originalId.txt",
  content: "Title: ...\n\nContent: ...\n\nURL: ...\n\nPublished: ...",
  platform: "blogger|facebook|instagram",
  originalId: "original_post_id",
  title: "Post title",
  url: "original_url",
  publishedAt: "2023-01-01T00:00:00Z",
  metadata: {
    platform: "blogger",
    originalId: "123",
    title: "Post Title",
    url: "https://...",
    publishedAt: "2023-01-01T00:00:00Z"
  }
}
```

## Troubleshooting

### Common Issues

1. **API Rate Limits**: Each platform has rate limits. The system handles this gracefully.
2. **Access Token Expiry**: Tokens may expire and need renewal.
3. **Permission Issues**: Ensure proper API permissions are granted.

### Debugging

1. Check MCP server logs for API errors
2. Verify environment variables are set correctly
3. Test API credentials independently
4. Monitor backend logs for processing errors

## Security Considerations

1. **API Keys**: Store securely, never commit to version control
2. **Access Tokens**: Use least privilege principle
3. **Rate Limiting**: Respect platform rate limits
4. **Data Privacy**: Only public content is accessed

## Future Enhancements

1. **Real-time Sync**: Webhook-based real-time updates
2. **More Platforms**: Twitter, LinkedIn, YouTube, etc.
3. **Content Filtering**: Advanced filtering and categorization
4. **Analytics**: Content performance and engagement metrics
5. **Scheduling**: Automated sync scheduling
6. **Export**: Content export and backup features

## Contributing

When adding new social media platforms:

1. Create a new MCP server in `mcp/platform-server/`
2. Implement the standard tools (get_content, get_info, search)
3. Add platform support to `DigitalPersonaService`
4. Update frontend UI for the new platform
5. Document API setup and configuration

## License

This feature is part of the PadalayAI project and follows the same license terms.
