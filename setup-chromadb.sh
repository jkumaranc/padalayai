#!/bin/bash

echo "Setting up ChromaDB for PadalayAI..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Python3 is required but not installed. Please install Python3 first."
    exit 1
fi

# Check if pip is available
if ! command -v pip3 &> /dev/null; then
    echo "pip3 is required but not installed. Please install pip3 first."
    exit 1
fi

# Install ChromaDB
echo "Installing ChromaDB..."
pip3 install chromadb

if [ $? -eq 0 ]; then
    echo "ChromaDB installed successfully!"
    
    # Start ChromaDB server
    echo "Starting ChromaDB server on port 8001..."
    echo "You can stop it anytime with Ctrl+C"
    echo "In a new terminal, you can now start your backend server with: cd backend && npm start"
    
    chroma run --host localhost --port 8001
else
    echo "Failed to install ChromaDB. The application will fall back to in-memory storage."
    echo "You can still run the backend server with: cd backend && npm start"
fi
