#!/bin/bash

echo "🔄 Resetting ChromaDB database..."

# Stop any running ChromaDB processes
echo "Stopping ChromaDB processes..."
pkill -f "chroma run" || true

# Wait for processes to stop
sleep 2

# Remove the corrupted ChromaDB database
echo "Removing corrupted ChromaDB database..."
cd backend
rm -rf chroma/
rm -rf .chroma/

# Create fresh data directory
mkdir -p data

echo "✅ ChromaDB database reset complete!"
echo ""
echo "Now restart your server with:"
echo "  ./restart-server.sh"
echo ""
echo "Or if you want to use ChromaDB, start it first:"
echo "  ./setup-chromadb.sh"
echo ""
echo "The server will now fall back to in-memory storage if ChromaDB is not available."
