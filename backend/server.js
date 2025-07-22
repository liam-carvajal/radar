import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import * as cron from 'node-cron';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'], // Common frontend ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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

// Updated data structure for country-level information
let newsData = {
  lastUpdated: null,
  countries: {},
  newsHistory: [] // Store all news items with timestamps
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
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return `You are an expert at understanding macro and micro economic trends (with an emphasis on macroeconomic) in the past 7 days across the world in the direct context of advertising industry.

CRITICAL: Today's date is ${currentDate}. You must ONLY include news articles that were published between ${sevenDaysAgo} and ${currentDate} (within the last 7 days). Any article older than 7 days is completely unacceptable.

This will be outputted for a downstream front-end where a map will be shown where the user will click on that country to see the latest news regarding certain markets in order of importance.

Please output as this format:

Country: 
Industry:
News headline (with links and date): "Headline text" (Source, Date) [Link text](FULL_ARTICLE_URL)
How does it affect the advertising business:
Positivity score (10 being very positive for the business, 1 being very negative for the business):
Importance score (10 being very important for the business, 1 being very unimportant for the business):

Here are the variables
{Regions}: ${regions.join(', ')}
{Possible industries}: ${industries.join(', ')}

MANDATORY REQUIREMENTS:
- ONLY include news from the last 7 days (${sevenDaysAgo} to ${currentDate})
- Verify the publication date of every article before including it
- Look for recent news in these sources: Bloomberg, Reuters, CNBC, Financial Times, Wall Street Journal, local news sources
- Focus on recent economic developments, policy changes, market trends, and industry news
- If you cannot find recent news for a country, skip that country entirely
- All links must be to articles published in the last 7 days
- CRITICAL: Provide FULL article URLs, not just domain names (e.g., "https://www.bloomberg.com/news/articles/2024-01-15/specific-article-title" not just "https://www.bloomberg.com")
- Include 2-5 news items per country in order of importance
- Only get news from official and credible economic or financial sources
- try to get information from multiple sources (bloomberg, reuters, google trends)
- include region sentiment analysis regarding the certain industry
- When possible add official government sources, for example; "federal reserve announces..." or "Bank of Japan announces...."
- Also include information possible regarding competitors and data privacy laws regarding advertising.
- Make sure to specify the industry for each news item from the provided list: ${industries.join(', ')}
- Include actual working URLs to the news articles
- Format links as: [Article Title](https://actual-url.com)
- Ensure all links are functional and accessible
- Focus on recent economic news that impacts advertising industry
- Include real, verifiable news sources with working links
- If you cannot find recent news (within 7 days) for a country, skip that country rather than using old news`;
}

// Function to calculate industry scores
function calculateIndustryScores(countryNews) {
  const industryScores = {};
  
  // Initialize industry scores
  INDUSTRIES.forEach(industry => {
    industryScores[industry] = {
      positivityScore: 0,
      importanceScore: 0,
      count: 0
    };
  });
  
  // Calculate scores for each industry
  countryNews.forEach(news => {
    if (news.industry) {
      // Normalize industry name to lowercase for comparison
      const normalizedIndustry = news.industry.toLowerCase();
      const matchingIndustry = INDUSTRIES.find(industry => industry.toLowerCase() === normalizedIndustry);
      
      if (matchingIndustry && industryScores[matchingIndustry]) {
        industryScores[matchingIndustry].positivityScore += news.positivityScore || 0;
        industryScores[matchingIndustry].importanceScore += news.importanceScore || 0;
        industryScores[matchingIndustry].count += 1;
      }
    }
  });
  
  // Calculate averages
  const finalScores = {};
  INDUSTRIES.forEach(industry => {
    const scores = industryScores[industry];
    if (scores.count > 0) {
      finalScores[industry] = {
        positivityScore: Math.round((scores.positivityScore / scores.count) * 10) / 10,
        importanceScore: Math.round((scores.importanceScore / scores.count) * 10) / 10,
        averageScore: Math.round(((scores.positivityScore + scores.importanceScore) / (scores.count * 2)) * 10) / 10
      };
    } else {
      finalScores[industry] = {
        positivityScore: 0,
        importanceScore: 0,
        averageScore: 0
      };
    }
  });
  
  return finalScores;
}

// Function to calculate overall score
function calculateOverallScore(industryScores) {
  const validScores = Object.values(industryScores).filter(score => score.averageScore > 0);
  
  if (validScores.length === 0) return 0;
  
  const totalScore = validScores.reduce((sum, score) => sum + score.averageScore, 0);
  return Math.round((totalScore / validScores.length) * 10) / 10;
}

// Function to update country data
function updateCountryData(country, newNews) {
  const timeGenerated = new Date().toISOString();
  
  // Add new news to history
  newNews.forEach(news => {
    newsData.newsHistory.push({
      timeGenerated,
      country,
      newsTitle: news.news,
      industry: news.industry,
      link: news.link || '',
      effect: news.effect,
      positivityScore: news.positivityScore,
      importanceScore: news.importanceScore
    });
  });
  
  // Get all news for this country (no repeats)
  const countryNews = newsData.newsHistory.filter(item => item.country === country);
  
  // Calculate scores
  const industryScores = calculateIndustryScores(countryNews);
  const overallScore = calculateOverallScore(industryScores);
  
  // Get unique news titles for this country
  const uniqueNewsTitles = [...new Set(countryNews.map(item => item.newsTitle))];
  
  // Update country data
  newsData.countries[country] = {
    name: country,
    lastUpdated: timeGenerated,
    overallScore,
    industryScores,
    newsTitles: uniqueNewsTitles
  };
}

// Function to fetch news data using OpenAI
async function fetchNewsAnalysis() {
  try {
    console.log('Fetching news analysis...');
    
    const prompt = generateAnalysisPrompt();
    console.log('Generated prompt:', prompt.substring(0, 200) + '...');

    const response = await client.responses.create({
      model: "o4-mini-deep-research",
      input: prompt,
      tools: [
        {"type": "web_search_preview"}
      ]
    });

    console.log('Model response:', response);
    const analysis = response.output_text;
    console.log('Response output:', analysis ? analysis.substring(0, 500) + '...' : 'No output text');
    
    if (!analysis) {
      console.error('No analysis text received from OpenAI');
      return {};
    }
    
    // Parse the analysis and structure it
    const parsedData = parseAnalysisResponse(analysis);
    console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
    
    // Update country data for each country
    Object.keys(parsedData).forEach(country => {
      updateCountryData(country, parsedData[country]);
    });
    
    // Update the last updated timestamp
    newsData.lastUpdated = new Date().toISOString();

    console.log('News analysis updated successfully');
    return parsedData;
  } catch (error) {
    console.error('Error fetching news analysis:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    });
    throw error;
  }
}

// Function to parse the OpenAI response
function parseAnalysisResponse(response) {
  const countries = {};
  const lines = response.split('\n');
  let currentCountry = null;
  let currentIndustry = null;
  let currentNews = null;
  let currentEffect = null;
  let currentPositivity = null;
  let currentImportance = null;
  let currentLink = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Handle markdown formatting with asterisks
    if (trimmedLine.startsWith('**Country:') || trimmedLine.startsWith('Country:')) {
      // Save previous entry if exists
      if (currentCountry && currentNews) {
        if (!countries[currentCountry]) {
          countries[currentCountry] = [];
        }
        countries[currentCountry].push({
          industry: currentIndustry,
          news: currentNews,
          effect: currentEffect,
          positivityScore: currentPositivity,
          importanceScore: currentImportance,
          link: currentLink
        });
      }
      
      // Extract country name, handling both markdown and plain text
      let countryName = trimmedLine;
      if (trimmedLine.startsWith('**Country:')) {
        countryName = trimmedLine.replace('**Country:', '').replace('**', '').trim();
      } else {
        countryName = trimmedLine.replace('Country:', '').trim();
      }
      currentCountry = countryName;
      currentIndustry = null;
      currentNews = null;
      currentEffect = null;
      currentPositivity = null;
      currentImportance = null;
      currentLink = null;
    } else if (trimmedLine.startsWith('**Industry:') || trimmedLine.startsWith('Industry:')) {
      let industryName = trimmedLine;
      if (trimmedLine.startsWith('**Industry:')) {
        industryName = trimmedLine.replace('**Industry:', '').replace('**', '').trim();
      } else {
        industryName = trimmedLine.replace('Industry:', '').trim();
      }
      currentIndustry = industryName;
    } else if (trimmedLine.startsWith('**News headline') || trimmedLine.startsWith('News headline')) {
      let newsText = trimmedLine;
      if (trimmedLine.startsWith('**News headline')) {
        newsText = trimmedLine.replace('**News headline (with links and date):**', '').replace('**News headline:**', '').trim();
      } else {
        newsText = trimmedLine.replace('News headline (with links and date):', '').trim();
      }
      
      // Extract link if present in markdown format [text](url)
      const linkMatch = newsText.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        // Extract the actual headline from quotes first
        const headlineMatch = newsText.match(/"([^"]+)"/);
        if (headlineMatch) {
          currentNews = headlineMatch[1];
        } else {
          // If no quotes, use the link text as the headline
          currentNews = linkMatch[1];
        }
        currentLink = linkMatch[2];
      } else {
        // Handle case where news is wrapped in quotes but no markdown link
        const headlineMatch = newsText.match(/"([^"]+)"/);
        if (headlineMatch) {
          currentNews = headlineMatch[1];
        } else {
          // Remove markdown formatting but preserve the text
          currentNews = newsText.replace(/\*\*/g, '').replace(/\*/g, '').trim();
        }
        currentLink = '';
      }
    } else if (trimmedLine.startsWith('**How does it affect') || trimmedLine.startsWith('How does it affect')) {
      let effectText = trimmedLine;
      if (trimmedLine.startsWith('**How does it affect')) {
        effectText = trimmedLine.replace('**How does it affect the advertising business:**', '').trim();
      } else {
        effectText = trimmedLine.replace('How does it affect the advertising business:', '').trim();
      }
      currentEffect = effectText;
    } else if (trimmedLine.startsWith('**Positivity score') || trimmedLine.startsWith('Positivity score')) {
      const scoreMatch = trimmedLine.match(/(\d+)/);
      currentPositivity = scoreMatch ? parseInt(scoreMatch[1]) : null;
    } else if (trimmedLine.startsWith('**Importance score') || trimmedLine.startsWith('Importance score')) {
      const scoreMatch = trimmedLine.match(/(\d+)/);
      currentImportance = scoreMatch ? parseInt(scoreMatch[1]) : null;
    }
  }

  // Save the last entry
  if (currentCountry && currentNews) {
    if (!countries[currentCountry]) {
      countries[currentCountry] = [];
    }
    countries[currentCountry].push({
      industry: currentIndustry,
      news: currentNews,
      effect: currentEffect,
      positivityScore: currentPositivity,
      importanceScore: currentImportance,
      link: currentLink
    });
  }

  return countries;
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

// Get news for specific country
app.get('/api/news/:country', async (req, res) => {
  try {
    const { country } = req.params;
    const countryData = newsData.countries[country];
    
    if (!countryData) {
      return res.status(404).json({
        success: false,
        error: `No data found for country: ${country}`
      });
    }
    
    res.json({
      success: true,
      data: countryData,
      message: `News data for ${country} retrieved successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get news history for specific country
app.get('/api/news/:country/history', async (req, res) => {
  try {
    const { country } = req.params;
    const countryHistory = newsData.newsHistory.filter(item => item.country === country);
    
    res.json({
      success: true,
      data: {
        country,
        history: countryHistory
      },
      message: `News history for ${country} retrieved successfully`
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

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      baseUrl: `http://localhost:${PORT}`,
      endpoints: {
        'GET /api/health': 'Server health check',
        'GET /api/news': 'Get all news data',
        'GET /api/news/:country': 'Get news for specific country',
        'GET /api/news/:country/history': 'Get news history for specific country',
        'POST /api/news/update': 'Trigger manual news update',
        'GET /api/regions': 'Get available regions',
        'GET /api/industries': 'Get available industries',
        'GET /api/summary': 'Get data summary',
        'GET /api/status': 'Get server status with data info'
      },
      dataStructure: {
        newsData: {
          lastUpdated: 'ISO timestamp',
          countries: 'Object with country data',
          newsHistory: 'Array of all news items'
        },
        countryData: {
          name: 'Country name',
          lastUpdated: 'ISO timestamp',
          overallScore: 'Number (0-10)',
          industryScores: 'Object with industry scores',
          newsTitles: 'Array of news headlines'
        }
      }
    },
    message: 'API documentation retrieved successfully'
  });
});

// Data summary endpoint for dashboard
app.get('/api/summary', (req, res) => {
  try {
    const countries = Object.keys(newsData.countries);
    const totalNewsItems = newsData.newsHistory.length;
    const lastUpdate = newsData.lastUpdated;
    
    // Calculate summary statistics
    const summary = {
      totalCountries: countries.length,
      totalNewsItems,
      lastUpdate,
      countries: countries.map(country => {
        const countryData = newsData.countries[country];
        return {
          name: country,
          overallScore: countryData?.overallScore || 0,
          newsCount: countryData?.newsTitles?.length || 0,
          lastUpdated: countryData?.lastUpdated
        };
      }),
      topCountries: countries
        .map(country => ({
          name: country,
          score: newsData.countries[country]?.overallScore || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    };
    
    res.json({
      success: true,
      data: summary,
      message: 'Data summary retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Server status endpoint with detailed info
app.get('/api/status', (req, res) => {
  try {
    const status = {
      server: {
        status: 'running',
        port: PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      },
      data: {
        hasData: newsData.lastUpdated !== null,
        lastUpdated: newsData.lastUpdated,
        countriesCount: Object.keys(newsData.countries).length,
        totalNewsItems: newsData.newsHistory.length
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
      }
    };
    
    res.json({
      success: true,
      data: status,
      message: 'Server status retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`
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
fetchNewsAnalysis()
  .then(() => {
    console.log('Initial news data fetch completed successfully');
  })
  .catch((error) => {
    console.error('Initial news data fetch failed:', error);
    console.log('Server will continue running with empty news data');
  });

// Start server only if this is the main module (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`News API: http://localhost:${PORT}/api/news`);
  });
}

// Export for testing
export default app;
export { generateAnalysisPrompt, parseAnalysisResponse }; 