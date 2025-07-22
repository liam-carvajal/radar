import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import cron from 'node-cron';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Check if OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is not set!');
  console.error('Please run: export OPENAI_API_KEY=your_api_key_here');
  process.exit(1);
}

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 3600000 // 1 hour timeout
});

// In-memory storage for news data (in production, use a database)
let newsData = {
  lastUpdated: null,
  regions: {}
};

// News sources configuration
const NEWS_SOURCES = {
  bloomberg: 'https://www.bloomberg.com',
  reuters: 'https://www.reuters.com',
  cnbc: 'https://www.cnbc.com',
  ft: 'https://www.ft.com'
};

// Regions and industries configuration
const REGIONS = ['US', 'Europe', 'Australia', 'South Korea'];
const INDUSTRIES = ['Beauty/wellness', 'clothing/apparel', 'retail', 'ticketing/events'];

// Function to generate the analysis prompt
function generateAnalysisPrompt(regions = REGIONS, industries = INDUSTRIES) {
  return `You are an expert at understanding macro and micro economic trends (with an emphasis on macroeconomic) in the past 24 hours across the world in the direct context of advertising industry. You will be given a set of countries to target, possible industries to focus on and how certain news headline can affect ads performance (either in a negative or positive way).

This will be outputted for a downstream front-end where a map will be shown where the user will click on that country to see the latest news regarding certain markets in order of importance.

Please output as this format:

Country: 
Market:
News headline (with links and date):
How does it affect the advertising business:
Positivity score (10 being very positive for the business, 1 being very negative for the business):
Importance score (10 being very important for the business, 1 being very unimportant for the business):

Here are the variables
{Regions}: ${regions.join(', ')}
{Possible industries}: ${industries.join(', ')}

Guidelines:
- Include 2-5 news items per country in order of importance
- Only get news from official and credible economic or financial sources
- try to get information from multiple sources (bloomberg, reuters, google trends)
- include region sentiment analysis regarding the certain industry
- When possible add official government sources, for example; "federal reserve announces..." or "Bank of Japan announces...."
- Also include information possible regarding competitors and data privacy laws regarding advertising.`;
}

// Function to fetch news data using OpenAI
async function fetchNewsAnalysis() {
  try {
    console.log('Fetching news analysis...');
    
    const prompt = generateAnalysisPrompt();
    
    const response = await client.responses.create({
      model: "o3-deep-research",
      input: prompt,
      tools: [
        {"type": "web_search_preview"},
        {"type": "code_interpreter", "container": {"type": "auto"}},
      ],
    });

    const analysis = response.output_text;
    
    // Parse the analysis and structure it
    const parsedData = parseAnalysisResponse(analysis);
    
    // Update the news data
    newsData = {
      lastUpdated: new Date().toISOString(),
      regions: parsedData
    };

    console.log('News analysis updated successfully');
    return parsedData;
  } catch (error) {
    console.error('Error fetching news analysis:', error);
    throw error;
  }
}

// Function to parse the OpenAI response
function parseAnalysisResponse(response) {
  const regions = {};
  const lines = response.split('\n');
  let currentCountry = null;
  let currentMarket = null;
  let currentNews = null;
  let currentEffect = null;
  let currentPositivity = null;
  let currentImportance = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('Country:')) {
      // Save previous entry if exists
      if (currentCountry && currentNews) {
        if (!regions[currentCountry]) {
          regions[currentCountry] = [];
        }
        regions[currentCountry].push({
          market: currentMarket,
          news: currentNews,
          effect: currentEffect,
          positivityScore: currentPositivity,
          importanceScore: currentImportance
        });
      }
      
      currentCountry = trimmedLine.replace('Country:', '').trim();
      currentMarket = null;
      currentNews = null;
      currentEffect = null;
      currentPositivity = null;
      currentImportance = null;
    } else if (trimmedLine.startsWith('Market:')) {
      currentMarket = trimmedLine.replace('Market:', '').trim();
    } else if (trimmedLine.startsWith('News headline')) {
      currentNews = trimmedLine.replace('News headline (with links and date):', '').trim();
    } else if (trimmedLine.startsWith('How does it affect')) {
      currentEffect = trimmedLine.replace('How does it affect the advertising business:', '').trim();
    } else if (trimmedLine.startsWith('Positivity score')) {
      const scoreMatch = trimmedLine.match(/(\d+)/);
      currentPositivity = scoreMatch ? parseInt(scoreMatch[1]) : null;
    } else if (trimmedLine.startsWith('Importance score')) {
      const scoreMatch = trimmedLine.match(/(\d+)/);
      currentImportance = scoreMatch ? parseInt(scoreMatch[1]) : null;
    }
  }

  // Save the last entry
  if (currentCountry && currentNews) {
    if (!regions[currentCountry]) {
      regions[currentCountry] = [];
    }
    regions[currentCountry].push({
      market: currentMarket,
      news: currentNews,
      effect: currentEffect,
      positivityScore: currentPositivity,
      importanceScore: currentImportance
    });
  }

  return regions;
}

// API Routes

// Get all news data
app.get('/api/news', async (req, res) => {
  try {
    res.json({
      success: true,
      data: newsData,
      message: 'News data retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get news for specific region
app.get('/api/news/:region', async (req, res) => {
  try {
    const { region } = req.params;
    const regionData = newsData.regions[region] || [];
    
    res.json({
      success: true,
      data: {
        region,
        news: regionData,
        lastUpdated: newsData.lastUpdated
      },
      message: `News data for ${region} retrieved successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger manual news update
app.post('/api/news/update', async (req, res) => {
  try {
    const { regions, industries } = req.body;
    const customRegions = regions || REGIONS;
    const customIndustries = industries || INDUSTRIES;
    
    const updatedData = await fetchNewsAnalysis(customRegions, customIndustries);
    
    res.json({
      success: true,
      data: updatedData,
      message: 'News data updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available regions
app.get('/api/regions', (req, res) => {
  res.json({
    success: true,
    data: REGIONS,
    message: 'Available regions retrieved successfully'
  });
});

// Get available industries
app.get('/api/industries', (req, res) => {
  res.json({
    success: true,
    data: INDUSTRIES,
    message: 'Available industries retrieved successfully'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Schedule automatic news updates (every 6 hours)
cron.schedule('0 */6 * * *', async () => {
  try {
    await fetchNewsAnalysis();
    console.log('Scheduled news update completed');
  } catch (error) {
    console.error('Scheduled news update failed:', error);
  }
});

// Initial data fetch on server start
fetchNewsAnalysis().catch(console.error);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`News API: http://localhost:${PORT}/api/news`);
}); 