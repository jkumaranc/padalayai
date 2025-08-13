#!/bin/bash

echo "Setting up PadalayAI Monorepo..."

# Install root dependencies and all workspace dependencies
echo "Installing dependencies for all workspaces..."
npm install

echo "Building MCP servers..."
npm run build:mcp

echo "Monorepo setup complete!"
echo ""
echo "Next steps:"
echo "1. Setup ChromaDB (if not already done):"
echo "   npm run setup:chromadb"
echo ""
echo "2. Start development:"
echo "   npm run dev:all      - Start ChromaDB + all services in development mode"
echo "   npm run dev:core     - Start ChromaDB + backend + frontend only"
echo "   npm run start:all    - Start all services in production mode"
echo ""
echo "Individual service commands:"
echo "   npm run dev:backend  - Start only backend in development mode"
echo "   npm run dev:frontend - Start only frontend in development mode"
echo "   npm run start:chromadb - Start only ChromaDB server"
echo ""
echo "See MONOREPO_README.md for full documentation."
