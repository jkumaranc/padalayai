# blogger-server MCP Server

A MCP server for Google Blogger service integration

This is a TypeScript-based MCP server that provides access to Google Blogger API functionality. It allows you to retrieve blog posts, search content, and get blog information through MCP tools.

## Features

### Tools
- `get_blog_posts` - Retrieve blog posts from Blogger
  - Optional parameters: maxResults (1-500), pageToken for pagination, labels for filtering
  - Returns processed posts with stripped HTML content

- `get_blog_info` - Get basic information about the blog
  - Returns blog metadata including name, description, URL, and post counts

- `search_posts` - Search for posts containing specific text
  - Required parameter: query (search text)
  - Optional parameter: maxResults (1-100)
  - Returns matching posts with relevance ranking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```
Then edit `.env` and add your Blogger API credentials:
- `BLOGGER_API_KEY`: Your Google Blogger API key
- `BLOG_ID`: Your Blogger blog ID

To get these credentials:
- Get a Blogger API key from [Google Cloud Console](https://console.cloud.google.com/)
- Find your blog ID in your Blogger dashboard URL or via the Blogger API

3. Build the server:
```bash
npm run build
```

## Development

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "blogger-server": {
      "command": "/path/to/blogger-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
