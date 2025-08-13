# PadalayAI Monorepo

This is a monorepo containing the PadalayAI platform with multiple services and MCP servers.

## Project Structure

```
├── backend/                 # Node.js backend API
├── frontend/               # React frontend application
├── mcp/                    # MCP (Model Context Protocol) servers
│   ├── blogger-server/     # Blogger service MCP server
│   ├── facebook-server/    # Facebook service MCP server
│   └── instagram-server/   # Instagram service MCP server
└── package.json           # Root monorepo configuration
```

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0

## Installation

Install all dependencies for all workspaces:

```bash
npm install
```

This will automatically install dependencies for all sub-projects and build the MCP servers.

## Available Scripts

### ChromaDB Commands

Setup and manage ChromaDB:
```bash
npm run setup:chromadb   # Install and setup ChromaDB
npm run start:chromadb   # Start ChromaDB server on port 8001
npm run reset:chromadb   # Reset ChromaDB data
```

### Development Commands

Start all services including ChromaDB:
```bash
npm run dev:all          # Start ChromaDB + all services in development mode
npm run dev:full         # Same as dev:all (alias)
npm run dev:core         # Start ChromaDB + backend + frontend only
```

Start individual services:
```bash
npm run dev:backend      # Start backend in development mode
npm run dev:frontend     # Start frontend in development mode
npm run dev:blogger      # Start blogger MCP server in watch mode
npm run dev:facebook     # Start facebook MCP server in watch mode
npm run dev:instagram    # Start instagram MCP server in watch mode
npm run start:chromadb   # Start ChromaDB server only
```

### Production Commands

Start all services in production mode:
```bash
npm run start:all        # Start ChromaDB + backend + frontend
```

Start individual services:
```bash
npm run start:backend    # Start backend server
npm run start:frontend   # Start frontend (same as dev mode for Vite)
npm run start:chromadb   # Start ChromaDB server
```

### Build Commands

Build all projects:
```bash
npm run build:all
```

Build individual components:
```bash
npm run build:backend    # Build backend (if build script exists)
npm run build:frontend   # Build frontend for production
npm run build:mcp        # Build all MCP servers
```

### Utility Commands

```bash
npm run test            # Run tests in all workspaces
npm run lint            # Run linting in all workspaces
npm run clean           # Clean all node_modules and build artifacts
```

## Service Details

### Backend
- **Port**: Configured in backend/.env
- **Technology**: Node.js with Express
- **Features**: Document processing, RAG service, Digital Persona API

### Frontend
- **Port**: 5173 (default Vite dev server)
- **Technology**: React with Vite
- **Features**: Document upload, query interface, digital persona management

### MCP Servers
- **Blogger Server**: Provides blogging platform integration
- **Facebook Server**: Provides Facebook API integration
- **Instagram Server**: Provides Instagram API integration

All MCP servers are built with TypeScript and use the Model Context Protocol SDK.

## Development Workflow

1. **Initial Setup**:
   ```bash
   npm install
   ```

2. **Start Development**:
   ```bash
   npm run dev:all
   ```
   This starts all services concurrently with hot reloading.

3. **Individual Development**:
   If you only need to work on specific services, use the individual commands:
   ```bash
   npm run dev:backend    # Only backend
   npm run dev:frontend   # Only frontend
   ```

4. **Building for Production**:
   ```bash
   npm run build:all
   npm run start:all
   ```

## Environment Configuration

Each service has its own environment configuration:

- **Backend**: `backend/.env`
- **Frontend**: Environment variables in `frontend/`
- **MCP Servers**: Configuration as needed per server

## Workspace Management

This monorepo uses npm workspaces. You can run commands in specific workspaces:

```bash
# Install a package in a specific workspace
npm install <package> --workspace=backend
npm install <package> --workspace=frontend
npm install <package> --workspace=mcp/blogger-server

# Run scripts in specific workspaces
npm run <script> --workspace=<workspace-name>
```

## Troubleshooting

1. **Dependencies Issues**: Run `npm run clean` followed by `npm install`
2. **Build Issues**: Ensure all MCP servers are built with `npm run build:mcp`
3. **Port Conflicts**: Check that no other services are running on the same ports

## Contributing

When adding new services or making changes:

1. Update the `workspaces` array in the root `package.json` if adding new packages
2. Add appropriate scripts to the root `package.json` for new services
3. Update this README with any new commands or services
