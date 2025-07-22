#!/bin/bash

echo "🔑 Setting up OpenAI API Key"
echo "============================"

if [ -z "$OPENAI_API_KEY" ]; then
    echo "Please enter your OpenAI API key:"
    read -s OPENAI_API_KEY
    export OPENAI_API_KEY
    echo "✅ API key exported successfully"
    echo ""
    echo "You can now run: npm run dev:server"
else
    echo "✅ OPENAI_API_KEY is already set"
    echo ""
    echo "You can now run: npm run dev:server"
fi 