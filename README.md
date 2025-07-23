# Radar 📡

Radar is an advanced advertising investment analysis platform that provides real-time market intelligence across global markets. It uses AI-powered news analysis to score investment opportunities across different countries and industries.

## 🚀 Features

- **Global Market Coverage**: Analysis across 16 countries including US, Canada, Mexico, Japan, South Korea, China, Singapore, Australia, France, Spain, Germany, Italy, Portugal, India, Netherlands, and Brazil
- **Industry Focus**: Beauty/wellness, clothing/apparel, retail, and ticketing/events sectors
- **AI-Powered Analysis**: Uses OpenAI's o4-mini-deep-research model for intelligent news analysis
- **Investment Scoring**: Advanced scoring algorithm (1-10 scale) based on market importance and positivity
- **Interactive Map**: OpenLayers-based world map with country-specific data visualization
- **Real-time Updates**: Automatic data refresh every 12 hours with 14-day rolling analysis
- **Responsive UI**: Modern, mobile-friendly interface with expandable industry panels

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, OpenAI API
- **Frontend**: TypeScript, Vite, OpenLayers
- **Data**: JSON-based persistence with automated refresh
- **Testing**: Jest with comprehensive test coverage
- **Deployment**: Local development with production-ready build system

## 📋 Prerequisites

Before setting up Radar locally, ensure you have:

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **OpenAI API Key** with access to o4-mini-deep-research model
- **Terminal/Command Line** access

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd radar
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- Express server with CORS support
- OpenAI client library
- OpenLayers for mapping
- TypeScript build tools
- Jest for testing
- Development tools (nodemon, concurrently)

### 3. Set Up OpenAI API Key

You have several options to set your OpenAI API key:

#### Option A: Using the Setup Script (Recommended)
```bash
./set-env.sh
```
This will prompt you to enter your API key securely.

#### Option B: Manual Export
```bash
export OPENAI_API_KEY=your_api_key_here
```

#### Option C: Using .env File
Create a `.env` file in the root directory:
```
OPENAI_API_KEY=your_api_key_here
```

**⚠️ Important**: Your API key must have access to the `o4-mini-deep-research` model for the application to function properly.

## 🚀 Running the Application

### Quick Start (All Services)
```bash
npm run dev:full
```
This starts both frontend and backend simultaneously.

### Individual Services

#### Backend Only
```bash
npm run dev:server
# or
npm run server
# or 
./start.sh
```

#### Frontend Only
```bash
npm run dev
```

## 🌐 Access URLs

Once running, access the application at:

- **Frontend**: http://localhost:5176 (note: port 5176 due to common conflicts)
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health
- **News Data**: http://localhost:3001/api/news
- **Available Countries**: http://localhost:3001/api/countries-with-data

## 📁 Project Structure

```
radar/
├── backend/
│   └── server.js              # Express server with OpenAI integration
├── src/
│   ├── main.ts               # Frontend entry point
│   ├── homescreen.ts         # Main application logic
│   ├── homescreen.css        # Application styling
│   ├── api.ts               # API communication layer
│   └── regions-config.ts     # Country/region configuration
├── tests/
│   ├── simple.test.js        # Basic functionality tests
│   ├── test_backend.js       # Backend API tests
│   └── test_o4_model.js      # OpenAI model tests
├── public/                   # Static assets
├── package.json             # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── set-env.sh             # Environment setup script
└── start.sh              # Quick start script
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Test coverage includes:
- API endpoint functionality
- OpenAI model integration
- Data processing and scoring
- Frontend-backend communication

## 🔄 Data Flow

1. **Data Collection**: Every 12 hours, the system automatically fetches news from OpenAI's o4-mini-deep-research model
2. **Analysis**: News articles are analyzed for investment relevance across different industries
3. **Scoring**: Advanced algorithm calculates investment scores (1-10) based on importance and positivity
4. **Storage**: Data is persisted in JSON format with automatic cleanup of duplicates
5. **Visualization**: Frontend displays data on interactive world map with country-specific details

## 📊 Scoring Algorithm

The investment scoring system uses:
- **Exponential scaling** for dramatic differentiation
- **Weighted importance** (70%) and positivity (30%)
- **Industry-specific analysis** across beauty, retail, apparel, and events
- **14-day rolling analysis** for trend identification

## 🌍 Supported Countries

The platform analyzes investment opportunities in:
- **North America**: United States, Canada, Mexico
- **Asia-Pacific**: Japan, South Korea, China, Singapore, Australia, India
- **Europe**: France, Spain, Germany, Italy, Portugal, Netherlands
- **South America**: Brazil

*Note: Only countries with available data will be clickable (colored) on the map.*

## ⚙️ Configuration

### Frontend Configuration
- Port: 5176 (configured to avoid common conflicts)
- Build: TypeScript with Vite bundler
- Maps: OpenLayers with custom country styling

### Backend Configuration
- Port: 3001
- CORS: Enabled for localhost origins
- Timeout: 1 hour for OpenAI requests
- Refresh: Every 12 hours via cron job

## 🐛 Troubleshooting

### Common Issues

#### "OPENAI_API_KEY is not set" Error
- Ensure your API key is properly exported: `echo $OPENAI_API_KEY`
- Try using the setup script: `./set-env.sh`
- Verify the key has access to o4-mini-deep-research model

#### Port Already in Use
- Frontend automatically tries port 5176 if 5173 is busy
- Backend uses port 3001 (configurable via PORT env var)
- Kill any existing processes: `lsof -ti:3001 | xargs kill -9`

#### No Data Available for Countries
- Check backend logs for OpenAI API errors
- Verify your API key has sufficient credits
- Some countries may not have current data - this is normal

#### Frontend Not Loading
- Ensure both frontend and backend are running
- Check browser console for CORS errors
- Verify API endpoints are accessible: `curl http://localhost:3001/api/health`

### Performance Optimization

- The application caches data to minimize API calls
- News refresh happens automatically every 12 hours
- Manual refresh available via backend restart

## 📈 Development

### Building for Production
```bash
npm run build
```

### Development Mode Features
- Hot reload for frontend changes
- Automatic server restart with nodemon
- Comprehensive error logging
- Development-friendly CORS configuration

## 🤝 Contributing

1. Follow the existing TypeScript and Node.js patterns
2. Add tests for new features
3. Update this README for configuration changes
4. Ensure all tests pass before submitting changes

## 📄 License

This project is proprietary software for advertising investment analysis.

---

**Need Help?** Check the troubleshooting section above or review the test files for usage examples.
