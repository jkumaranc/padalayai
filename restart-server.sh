#!/bin/bash

echo "🔄 Restarting PadalayAI Backend Server..."

# Kill any existing node processes for this project
echo "Stopping existing servers..."
pkill -f "node.*server.js" || true
pkill -f "nodemon.*server.js" || true

# Wait a moment for processes to stop
sleep 2

# Start the server with nodemon configuration that ignores uploads
echo "Starting server with upload-safe configuration..."
cd backend

# Use the dev script with proper nodemon config
npm run dev:watch

echo "✅ Server should now be running without restarting on file uploads!"
echo "📁 Upload directory is ignored by nodemon"
echo "🌐 Server: http://localhost:8000"
echo "❤️  Health: http://localhost:8000/health"
