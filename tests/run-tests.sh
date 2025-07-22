#!/bin/bash

echo "🧪 Running Radar Backend Tests"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this from the project root."
    exit 1
fi

# Set test environment
export NODE_ENV=test
export OPENAI_API_KEY=test-key

echo "📋 Running test suite..."
echo ""

# Run tests with coverage
npm run test:coverage

echo ""
echo "✅ Tests completed!"
echo ""
echo "📊 Test Commands:"
echo "   npm test           - Run all tests"
echo "   npm run test:watch - Run tests in watch mode"
echo "   npm run test:coverage - Run tests with coverage report" 