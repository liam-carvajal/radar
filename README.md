# Radar - Economic News Analysis Backend

A Node.js/Express backend that analyzes economic news and provides insights for the advertising industry using OpenAI's API.

## Features

- 🌍 **Multi-region Analysis**: Analyzes news from US, Europe, Australia, and South Korea
- 🏭 **Industry Focus**: Specializes in Beauty/wellness, Clothing/apparel, Retail, and Ticketing/events
- 🤖 **AI-Powered**: Uses OpenAI o3-deep-research for intelligent news analysis
- ⏰ **Automated Updates**: Scheduled news updates every 6 hours
- 📊 **Scoring System**: Positivity and importance scores for each news item
- 🔄 **Real-time API**: RESTful endpoints for frontend integration
- 🧪 **Comprehensive Testing**: Full test suite with unit, integration, and performance tests

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   # Option 1: Use the interactive script
   npm start
   
   # Option 2: Set manually
   export OPENAI_API_KEY=your_openai_api_key_here
   npm run dev:server
   
   # Option 3: Set for current session
   ./set-env.sh
   npm run dev:server
   ```

3. **Get OpenAI API Key**
   - Visit: https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key and use it in step 2

4. **Test the API**
   - Health check: http://localhost:3001/api/health
   - News data: http://localhost:3001/api/news

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with custom script
./tests/run-tests.sh
```

### Test Coverage

The test suite includes:

- **Unit Tests** (`tests/api.test.js`): Test individual API endpoints
- **Integration Tests** (`tests/integration.test.js`): Test complete workflows
- **Utility Tests** (`tests/utils.test.js`): Test helper functions
- **Performance Tests**: Response time and concurrent request handling

### Test Categories

#### API Endpoints
- ✅ Health check endpoint
- ✅ News data retrieval
- ✅ Region-specific news
- ✅ Manual news updates
- ✅ Error handling
- ✅ Data validation

#### Integration Workflows
- ✅ Full news analysis flow
- ✅ Multiple concurrent updates
- ✅ Data consistency across endpoints
- ✅ Error scenario handling
- ✅ Performance benchmarks

#### Utility Functions
- ✅ Prompt generation
- ✅ Response parsing
- ✅ Data validation
- ✅ Edge case handling

## API Endpoints

### GET `/api/health`
Health check endpoint
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/news`
Get all news data
```json
{
  "success": true,
  "data": {
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "regions": {
      "US": [
        {
          "market": "Retail",
          "news": "Federal Reserve announces interest rate decision...",
          "effect": "Positive impact on consumer spending...",
          "positivityScore": 8,
          "importanceScore": 9
        }
      ]
    }
  }
}
```

### GET `/api/news/:region`
Get news for specific region (e.g., `/api/news/US`)

### POST `/api/news/update`
Trigger manual news update
```json
{
  "regions": ["US", "Europe"],
  "industries": ["retail", "beauty/wellness"]
}
```

### GET `/api/regions`
Get available regions
```json
{
  "success": true,
  "data": ["US", "Europe", "Australia", "South Korea"]
}
```

### GET `/api/industries`
Get available industries
```json
{
  "success": true,
  "data": ["Beauty/wellness", "clothing/apparel", "retail", "ticketing/events"]
}
```

## Development Commands

- `npm start` - Interactive setup and start server
- `npm run dev:server` - Start backend server with nodemon
- `npm run dev` - Start frontend (Vite)
- `npm run dev:full` - Start both frontend and backend
- `npm run server` - Start backend server without nodemon
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3001)

## News Sources

The system is configured to analyze news from:
- Bloomberg
- Reuters
- CNBC
- Financial Times

## Data Structure

Each news item contains:
- **Market**: The specific industry/market segment
- **News**: Headline with links and date
- **Effect**: Impact on advertising business
- **Positivity Score**: 1-10 scale (1=very negative, 10=very positive)
- **Importance Score**: 1-10 scale (1=very unimportant, 10=very important)

## Scheduled Updates

The system automatically updates news data every 6 hours using cron jobs.

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Next Steps

- [ ] Add database integration (PostgreSQL/MongoDB)
- [ ] Implement user authentication
- [ ] Add more news sources
- [ ] Create frontend dashboard
- [ ] Add caching layer
- [ ] Implement rate limiting
