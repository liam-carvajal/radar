#!/bin/bash

echo "🚀 Radar Backend Setup"
echo "======================"

# Check if OPENAI_API_KEY is already set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY is not set"
    echo ""
    echo "Please enter your OpenAI API key:"
    read -s OPENAI_API_KEY
    export OPENAI_API_KEY
    echo "✅ API key set successfully"
else
    echo "✅ OPENAI_API_KEY is already set"
fi

echo ""
echo "📋 Available commands:"
echo "   npm run dev:server    - Start the backend server"
echo "   npm run dev           - Start the frontend"
echo "   npm run dev:full      - Start both frontend and backend"
echo ""
echo "🌐 Once running, the API will be available at:"
echo "   http://localhost:3001/api/health"
echo "   http://localhost:3001/api/news"
echo ""
echo "🎯 Starting the server..."
echo ""

# Start the server
npm run dev:server 