import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import * as cron from 'node-cron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Function to clean up duplicate country entries
function cleanupDuplicateCountries() {
  console.log('Cleaning up duplicate country entries...');
  
  const duplicateMapping = {
    'United States': 'US',
    'United States of America': 'US',
    'USA': 'US',
    'UK': 'United Kingdom',
    'Great Britain': 'United Kingdom'
  };
  
  Object.keys(duplicateMapping).forEach(duplicateName => {
    const targetName = duplicateMapping[duplicateName];
    
    if (newsData.countries[duplicateName] && newsData.countries[targetName]) {
      console.log(`Merging ${duplicateName} into ${targetName}`);
      
      // Merge the news history
      const duplicateHistory = newsData.newsHistory.filter(item => item.country === duplicateName);
      duplicateHistory.forEach(item => {
        item.country = targetName; // Update country reference
      });
      
      // Remove the duplicate country entry  
      delete newsData.countries[duplicateName];
      
      // Recalculate scores for the target country with merged data
      const mergedHistory = newsData.newsHistory.filter(item => item.country === targetName);
      const industryScores = calculateIndustryScores(mergedHistory);
      const overallScore = calculateOverallScore(industryScores);
      
      // Update the target country with merged data
      if (newsData.countries[targetName]) {
        newsData.countries[targetName].overallScore = overallScore;
        newsData.countries[targetName].industryScores = industryScores;
        newsData.countries[targetName].lastUpdated = new Date().toISOString();
      }
    }
  });
  
  console.log('Duplicate cleanup completed');
}

// Load initial news data from JSON file
function loadInitialNewsData() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const initialDataPath = path.join(__dirname, 'initial-news-data.json');
    
    if (fs.existsSync(initialDataPath)) {
      const initialData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));
      newsData = { ...newsData, ...initialData };
      console.log('✅ Initial news data loaded successfully');
      console.log(`📊 Loaded data for ${Object.keys(newsData.countries).length} countries`);
    } else {
      console.log('⚠️  Initial news data file not found, starting with empty data');
    }
  } catch (error) {
    console.error('❌ Error loading initial news data:', error.message);
    console.log('Starting with empty news data');
  }
}

// Load initial data on startup
loadInitialNewsData();

// News sources configuration
const NEWS_SOURCES = {
  bloomberg: 'https://www.bloomberg.com',
  reuters: 'https://www.reuters.com',
  cnbc: 'https://www.cnbc.com',
  ft: 'https://www.ft.com'
};

// Regions and industries configuration
const REGIONS = ['United States', 'Mexico', 'Canada', 'Japan', 'South Korea', 'China', 'Singapore', 'Australia', 'France', 'Spain', 'Germany', 'Italy', 'Portugal', 'India', 'Netherlands', 'Brazil'];
const INDUSTRIES = ['Beauty/wellness', 'clothing/apparel', 'retail', 'ticketing/events'];

// Function to generate the analysis prompt
function generateAnalysisPrompt(regions = REGIONS, industries = INDUSTRIES) {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return `You are an expert investment analyst specializing in advertising and marketing opportunities across global markets. Your job is to identify specific, actionable industry trends that will help advertising professionals decide WHERE and HOW to invest their marketing budgets.

CRITICAL: Today's date is ${currentDate}. You must ONLY include news articles that were published between ${twoWeeksAgo} and ${currentDate} (within the last 14 days). Any article older than 14 days is completely unacceptable.

This will be outputted for advertising professionals and marketing strategists who need to make data-driven investment decisions about regional markets and industry verticals.

Please output as this format:

Country: 
Industry:
News headline (with links and date): "Headline text" (Source, Date) [Link text](FULL_ARTICLE_URL)
How does it affect the advertising business:
Positivity score (10 being very positive for the business, 1 being very negative for the business):
Importance score (10 being very important for the business, 1 being very unimportant for the business):

Here are the variables
{Countries}: ${regions.join(', ')}
{Possible industries}: ${industries.join(', ')}

FOCUS ON INVESTMENT-RELEVANT NEWS TYPES:
- GROWTH METRICS: "Beauty product sales surge 25% in Germany", "E-commerce transactions up 40% in Australia"
- MARKET EXPANSION: "New retail chains opening 50 stores across Italy", "Fashion brands expanding into South Korean market"
- CONSUMER BEHAVIOR SHIFTS: "Millennials driving 60% increase in wellness spending in France", "Digital payment adoption rises 35% in UK retail"
- REGULATORY OPPORTUNITIES: "New advertising regulations create opportunities in Spanish digital marketing", "Data privacy changes benefit local UK advertisers"
- INFRASTRUCTURE DEVELOPMENTS: "New airport terminals boost tourism advertising opportunities", "5G rollout increases mobile commerce in Germany"
- COMPETITIVE LANDSCAPE CHANGES: "Major retailer exits German market, creating advertising opportunities", "Local beauty brands gain 30% market share from international competitors"
- SEASONAL/EVENT-DRIVEN OPPORTUNITIES: "Olympics preparation creates €2B advertising opportunity in France", "Festival season drives 40% increase in event marketing spend"

MANDATORY REQUIREMENTS:
- ONLY include news from the last 14 days (${twoWeeksAgo} to ${currentDate})
- Focus on NEWS WITH SPECIFIC METRICS, PERCENTAGES, AND GROWTH NUMBERS
- Look for market expansion, consumer behavior changes, regulatory shifts, and competitive opportunities
- Each article should answer: "Should I invest more advertising budget in this region/industry?"
- Include concrete data points: growth percentages, market size, consumer spending increases, etc.
- CRITICAL: Provide FULL article URLs, not just domain names
- Include 3-5 high-impact news items per country in order of investment opportunity
- INDUSTRY-SPECIFIC INVESTMENT OPPORTUNITIES:
  * Beauty/wellness: New product launches, market expansions, consumer trend shifts, brand partnerships, retail channel growth
  * Clothing/apparel: Fashion week impacts, seasonal trends, sustainable fashion growth, brand expansions, demographic shifts
  * Retail: E-commerce growth, new store openings, consumer spending patterns, payment method adoption, logistics improvements
  * Ticketing/events: New venues, festival announcements, tourism growth, cultural events, sports expansions
- EXAMPLES OF IDEAL HEADLINES:
  * "Italian beauty market grows 18% as organic cosmetics surge"
  * "German retail sector sees 25% increase in contactless payments"
  * "UK music festival bookings up 45% following venue expansion"
  * "French luxury fashion exports rise 30% to Asian markets"
  * "Australian wellness spending hits record high with 22% growth"
  * "Spanish tourism board launches €50M advertising campaign"
- SCORING CRITERIA:
  * Positivity Score: How beneficial is this trend for advertising investment? (10 = massive opportunity, 1 = major threat)
  * Importance Score: How critical is this information for investment decisions? (10 = must-know for budget allocation, 1 = minor consideration)
- Each country should represent a clear INVESTMENT THESIS with supporting data points
- Focus on trends that create NEW ADVERTISING OPPORTUNITIES or THREATEN EXISTING INVESTMENTS`;
}

// Function to calculate industry scores
function calculateIndustryScores(countryNews) {
  const industryScores = {};
  
  // Initialize industry scores for all industries
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
      // Find matching industry (flexible matching)
      let matchingIndustry = null;
      
      // First try exact match
      if (INDUSTRIES.includes(news.industry)) {
        matchingIndustry = news.industry;
      } else {
        // Try case-insensitive match
        matchingIndustry = INDUSTRIES.find(industry => 
          industry.toLowerCase() === news.industry.toLowerCase()
        );
      }
      
      // Try partial matching for industries with variations
      if (!matchingIndustry) {
        const industryLower = news.industry.toLowerCase();
        matchingIndustry = INDUSTRIES.find(industry => {
          const industryKeywords = industry.toLowerCase().split(/[\/\s-]+/);
          return industryKeywords.some(keyword => 
            industryLower.includes(keyword) || keyword.includes(industryLower)
          );
        });
      }
      
      if (matchingIndustry && industryScores[matchingIndustry]) {
        // Ensure scores are valid numbers between 1-10
        const positivityScore = Math.max(1, Math.min(10, parseFloat(news.positivityScore) || 5));
        const importanceScore = Math.max(1, Math.min(10, parseFloat(news.importanceScore) || 5));
        
        industryScores[matchingIndustry].positivityScore += positivityScore;
        industryScores[matchingIndustry].importanceScore += importanceScore;
        industryScores[matchingIndustry].count += 1;
      }
    }
  });
  
  // Calculate averages with enhanced scaling
  const finalScores = {};
  INDUSTRIES.forEach(industry => {
    const scores = industryScores[industry];
    if (scores.count > 0) {
      const avgPositivity = scores.positivityScore / scores.count;
      const avgImportance = scores.importanceScore / scores.count;
      const baseAverage = (avgPositivity + avgImportance) / 2;
      
      // Enhanced scaling for industry scores to spread them across full range
      let enhancedAverage;
      if (baseAverage >= 8.0) {
        enhancedAverage = 8.5 + (baseAverage - 8.0) * 0.75; // Maps 8-10 to 8.5-10
      } else if (baseAverage >= 6.0) {
        enhancedAverage = 6.0 + (baseAverage - 6.0) * 1.25; // Maps 6-8 to 6-8.5
      } else if (baseAverage >= 4.0) {   
        enhancedAverage = 3.0 + (baseAverage - 4.0) * 1.5; // Maps 4-6 to 3-6
      } else if (baseAverage >= 2.0) {
        enhancedAverage = 1.5 + (baseAverage - 2.0) * 0.75; // Maps 2-4 to 1.5-3
      } else {
        enhancedAverage = 1.0 + (baseAverage - 1.0) * 0.5; // Maps 1-2 to 1-1.5
      }
      
      // Apply investment opportunity weighting (importance matters more)
      const weightedScore = (avgPositivity * 0.4) + (avgImportance * 0.6);
      enhancedAverage = (enhancedAverage * 0.7) + (weightedScore * 0.3);
      
      finalScores[industry] = {
        positivityScore: Math.round(avgPositivity * 10) / 10,
        importanceScore: Math.round(avgImportance * 10) / 10,
        averageScore: Math.max(1.0, Math.min(10.0, Math.round(enhancedAverage * 10) / 10))
      };
    } else {
      // No data for this industry - set neutral scores
      finalScores[industry] = {
        positivityScore: 0,
        importanceScore: 0,
        averageScore: 0
      };
    }
  });
  
  return finalScores;
}

// Function to calculate overall score with enhanced scaling
function calculateOverallScore(industryScores) {
  const validScores = Object.values(industryScores).filter(score => score.averageScore > 0);
  
  if (validScores.length === 0) return 5.0; // Default neutral score if no data
  
  // Calculate base score (simple average)
  const totalScore = validScores.reduce((sum, score) => sum + score.averageScore, 0);
  const baseScore = totalScore / validScores.length;
  
  // Enhanced scoring algorithm to spread values across 1-10 range
  let enhancedScore;
  
  if (baseScore >= 7.0) {
    // High scores: amplify to 8-10 range
    enhancedScore = 8.0 + (baseScore - 7.0) * 2.0; // Maps 7-10 to 8-10
  } else if (baseScore >= 5.0) {
    // Medium scores: map to 4-8 range  
    enhancedScore = 4.0 + (baseScore - 5.0) * 2.0; // Maps 5-7 to 4-8
  } else if (baseScore >= 3.0) {
    // Low scores: map to 2-4 range
    enhancedScore = 2.0 + (baseScore - 3.0) * 1.0; // Maps 3-5 to 2-4
  } else {
    // Very low scores: map to 1-2 range
    enhancedScore = 1.0 + (baseScore - 1.0) * 0.5; // Maps 1-3 to 1-2
  }
  
  // Apply exponential scaling for more dramatic differentiation
  const exponentialFactor = 1.2;
  if (enhancedScore > 5.5) {
    // Amplify good investment opportunities
    enhancedScore = 5.5 + Math.pow(enhancedScore - 5.5, exponentialFactor);
  } else if (enhancedScore < 4.5) {
    // Amplify poor investment opportunities (make them lower)
    enhancedScore = 4.5 - Math.pow(4.5 - enhancedScore, exponentialFactor);
  }
  
  // Ensure final score is between 1 and 10
  enhancedScore = Math.max(1.0, Math.min(10.0, enhancedScore));
  
  return Math.round(enhancedScore * 10) / 10;
}

// Function to update country data
function updateCountryData(country, newNews) {
  const timeGenerated = new Date().toISOString();
  
  console.log(`Updating data for ${country} with ${newNews.length} news items`);
  
  // Add new news to history
  newNews.forEach(news => {
    console.log(`Processing news: ${news.news} - Industry: ${news.industry} - Scores: ${news.positivityScore}/${news.importanceScore}`);
    newsData.newsHistory.push({
      timeGenerated,
      country,
      newsTitle: news.news,
      industry: news.industry,
      link: news.link || '',
      effect: news.effect,
      positivityScore: parseFloat(news.positivityScore) || 5,
      importanceScore: parseFloat(news.importanceScore) || 5,
      date: news.date || null
    });
  });
  
  // Get all news for this country from the past two weeks (no repeats)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const countryNews = newsData.newsHistory
    .filter(item => item.country === country && item.timeGenerated >= twoWeeksAgo)
    .filter((item, index, self) => 
      index === self.findIndex(t => t.newsTitle === item.newsTitle)
    ); // Remove duplicates based on title
  
  console.log(`Found ${countryNews.length} news items for scoring calculation`);
  
  // Calculate scores
  const industryScores = calculateIndustryScores(countryNews);
  const overallScore = calculateOverallScore(industryScores);
  
  console.log(`Calculated scores for ${country}:`, industryScores);
  console.log(`Overall score: ${overallScore}`);
  
  // Group news by industry
  const newsByIndustry = {};
  INDUSTRIES.forEach(industry => {
    newsByIndustry[industry] = [];
  });
  
  // Categorize news by industry using the same matching logic as calculateIndustryScores
  countryNews.forEach(news => {
    if (news.industry) {
      // Find matching industry (flexible matching)
      let matchingIndustry = null;
      
      // First try exact match
      if (INDUSTRIES.includes(news.industry)) {
        matchingIndustry = news.industry;
      } else {
        // Try case-insensitive match
        matchingIndustry = INDUSTRIES.find(industry => 
          industry.toLowerCase() === news.industry.toLowerCase()
        );
      }
      
      // Try partial matching for industries with variations
      if (!matchingIndustry) {
        const industryLower = news.industry.toLowerCase();
        matchingIndustry = INDUSTRIES.find(industry => {
          const industryKeywords = industry.toLowerCase().split(/[\/\s-]+/);
          return industryKeywords.some(keyword => 
            industryLower.includes(keyword) || keyword.includes(industryLower)
          );
        });
      }
      
      if (matchingIndustry) {
        newsByIndustry[matchingIndustry].push({
          title: news.newsTitle,
          link: news.link,
          positivityScore: news.positivityScore,
          importanceScore: news.importanceScore,
          effect: news.effect,
          date: news.date || null
        });
      }
    }
  });
  
  // Update country data with industry-specific news
  newsData.countries[country] = {
    name: country,
    lastUpdated: timeGenerated,
    overallScore,
    industryScores,
    industries: newsByIndustry // Add industry-specific news
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
  let currentDate = null;

  console.log('Parsing OpenAI response...');
  console.log('Response preview:', response.substring(0, 500));

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Handle markdown formatting with asterisks
    if (trimmedLine.startsWith('**Country:') || trimmedLine.startsWith('Country:')) {
      // Save previous entry if exists
      if (currentCountry && currentNews && currentIndustry) {
        if (!countries[currentCountry]) {
          countries[currentCountry] = [];
        }
        console.log(`Adding news for ${currentCountry}: ${currentNews} (Industry: ${currentIndustry})`);
        countries[currentCountry].push({
          industry: currentIndustry,
          news: currentNews,
          effect: currentEffect,
          positivityScore: currentPositivity,
          importanceScore: currentImportance,
          link: currentLink
        });
      }
      
      // Reset for new country
      currentIndustry = null;
      currentNews = null;
      currentEffect = null;
      currentPositivity = null;
      currentImportance = null;
      currentLink = null;
      
      // Extract country name, handling both markdown and plain text
      let countryName = trimmedLine;
      if (trimmedLine.startsWith('**Country:')) {
        countryName = trimmedLine.replace('**Country:', '').replace('**', '').trim();
      } else {
        countryName = trimmedLine.replace('Country:', '').trim();
      }
      
      // Normalize country names to avoid duplicates
      const countryMapping = {
        'United States': 'US',
        'United States of America': 'US',
        'USA': 'US',
        'People\'s Republic of China': 'China',
        'South Korea': 'South Korea',
        'Republic of Korea': 'South Korea',
        'United Kingdom': 'United Kingdom',
        'UK': 'United Kingdom',
        'Great Britain': 'United Kingdom'
      };
      
      currentCountry = countryMapping[countryName] || countryName;
      console.log(`Found country: ${countryName} -> normalized to: ${currentCountry}`);
      
    } else if (trimmedLine.startsWith('**Industry:') || trimmedLine.startsWith('Industry:')) {
      // Save previous news item if we have one
      if (currentNews && currentIndustry && currentCountry) {
        if (!countries[currentCountry]) {
          countries[currentCountry] = [];
        }
        console.log(`Adding news for ${currentCountry}: ${currentNews} (Industry: ${currentIndustry})`);
        countries[currentCountry].push({
          industry: currentIndustry,
          news: currentNews,
          effect: currentEffect,
          positivityScore: currentPositivity,
          importanceScore: currentImportance,
          link: currentLink,
          date: currentDate || null
        });
        
        // Reset news fields but keep country
      currentNews = null;
      currentEffect = null;
      currentPositivity = null;
      currentImportance = null;
      currentLink = null;
      currentDate = null;
      }
      
      let industryName = trimmedLine;
      if (trimmedLine.startsWith('**Industry:')) {
        industryName = trimmedLine.replace('**Industry:', '').replace('**', '').trim();
      } else {
        industryName = trimmedLine.replace('Industry:', '').trim();
      }
      currentIndustry = industryName;
      console.log(`Found industry: ${currentIndustry}`);
      
    } else if (trimmedLine.startsWith('**News headline') || trimmedLine.startsWith('News headline')) {
      let newsText = trimmedLine;
      if (trimmedLine.startsWith('**News headline')) {
        newsText = trimmedLine.replace('**News headline (with links and date):**', '').replace('**News headline:**', '').trim();
      } else {
        newsText = trimmedLine.replace('News headline (with links and date):', '').trim();
      }
      
      // Extract date from (Source, Date) format
      const sourceMatch = newsText.match(/\(([^,)]+),\s*([^)]+)\)/);
      if (sourceMatch) {
        currentDate = sourceMatch[2].trim(); // Extract the date part
        console.log(`Found date: ${currentDate}`);
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
      console.log(`Found news: ${currentNews}`);
      
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
      console.log(`Found positivity score: ${currentPositivity}`);
      
    } else if (trimmedLine.startsWith('**Importance score') || trimmedLine.startsWith('Importance score')) {
      const scoreMatch = trimmedLine.match(/(\d+)/);
      currentImportance = scoreMatch ? parseInt(scoreMatch[1]) : null;
      console.log(`Found importance score: ${currentImportance}`);
    }
  }

  // Save the last entry
  if (currentCountry && currentNews && currentIndustry) {
    if (!countries[currentCountry]) {
      countries[currentCountry] = [];
    }
    console.log(`Adding final news for ${currentCountry}: ${currentNews} (Industry: ${currentIndustry})`);
    countries[currentCountry].push({
      industry: currentIndustry,
      news: currentNews,
      effect: currentEffect,
      positivityScore: currentPositivity,
      importanceScore: currentImportance,
      link: currentLink,
      date: currentDate || null
    });
  }

  console.log('Parsed countries:', Object.keys(countries));
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
    
    // Clean up duplicates before updating
    cleanupDuplicateCountries();
    
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

// Clean up duplicate countries endpoint
app.post('/api/news/cleanup', (req, res) => {
  try {
    cleanupDuplicateCountries();
    res.json({
      success: true,
      message: 'Duplicate countries cleaned up successfully'
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

// Get countries with actual data
app.get('/api/countries-with-data', (req, res) => {
  const countriesWithData = Object.keys(newsData.countries || {});
  res.json({
    success: true,
    data: countriesWithData,
    message: 'Countries with data retrieved successfully'
  });
});

// Generate AI-powered Daily Memo
app.get('/api/daily-memo', async (req, res) => {
  try {
    console.log('Generating Daily Memo with GPT-4...');
    
    // Collect all current news articles
    const allArticles = [];
    Object.entries(newsData.countries).forEach(([country, data]) => {
      if (data.industries) {
        Object.entries(data.industries).forEach(([industry, newsItems]) => {
          if (Array.isArray(newsItems)) {
            newsItems.forEach(news => {
              allArticles.push({
                country,
                industry,
                title: news.title,
                effect: news.effect,
                positivityScore: news.positivityScore,
                importanceScore: news.importanceScore,
                date: news.date,
                link: news.link
              });
            });
          }
        });
      }
    });
    
    if (allArticles.length === 0) {
      return res.json({
        success: true,
        memo: {
          keyUpdates: ['No recent news data available'],
          todaysFocus: 'Monitor news sources for updates',
          forecasts: ['Check back later for analysis'],
          metrics: {
            totalArticles: 0,
            positiveNews: 0,
            negativeNews: 0,
            averageImportance: 0
          }
        }
      });
    }
    
    // Create concise summary of articles for GPT-4 (limit to most important articles to stay within token limit)
    const sortedArticles = allArticles
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, 15); // Limit to top 15 most important articles
    
    const articlesSummary = sortedArticles.map(article => 
      `${article.country}-${article.industry}: "${article.title}" (${article.positivityScore}/${article.importanceScore}) - ${article.effect.substring(0, 100)}...`
    ).join('\n');
    
    const prompt = `Analyze these news articles and create a concise investment memo in JSON format:

${articlesSummary}

Return JSON with:
{
  "keyUpdates": ["3 bullet points (max 50 chars each)"],
  "todaysFocus": "Single focus area for today (max 80 chars)",
  "forecasts": ["3 predictions for next 30 days (max 50 chars each)"],
  "metrics": {
    "totalArticles": ${allArticles.length},
    "positiveNews": ${allArticles.filter(a => a.positivityScore >= 6).length},
    "negativeNews": ${allArticles.filter(a => a.positivityScore <= 4).length}, 
    "averageImportance": ${Math.round(allArticles.reduce((sum, a) => sum + a.importanceScore, 0) / allArticles.length * 10) / 10}
  }
}

Focus on investment/advertising opportunities, market trends, growth regions.`;

    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.3,
      max_tokens: 800
    });

    const memoText = response.choices[0].message.content;
    console.log('GPT-4 Daily Memo response:', memoText);

    // Parse the JSON response
    let memo;
    try {
      memo = JSON.parse(memoText);
    } catch (parseError) {
      console.error('Failed to parse GPT-4 response:', parseError);
      // Fallback memo if parsing fails
      memo = {
        keyUpdates: [
          `Analyzed ${allArticles.length} articles across ${Object.keys(newsData.countries).length} countries`,
          'Investment sentiment varies by region',
          'Multiple industries showing activity'
        ],
        todaysFocus: 'Review top-performing markets for expansion opportunities',
        forecasts: [
          'Continued regional market volatility expected',
          'Digital advertising channels remain strong',
          'Consumer behavior shifts influencing retail'
        ],
        metrics: {
          totalArticles: allArticles.length,
          positiveNews: allArticles.filter(a => a.positivityScore >= 6).length,
          negativeNews: allArticles.filter(a => a.positivityScore <= 4).length,
          averageImportance: Math.round(allArticles.reduce((sum, a) => sum + a.importanceScore, 0) / allArticles.length * 10) / 10
        }
      };
    }

    res.json({
      success: true,
      memo,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating daily memo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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

// Schedule automatic news updates (every 12 hours)
cron.schedule('0 */12 * * *', async () => {
  try {
    await fetchNewsAnalysis();
    console.log('Scheduled news update completed');
  } catch (error) {
    console.error('Scheduled news update failed:', error);
  }
});

// Initial data fetch on server start (now optional since we have pre-loaded data)
if (Object.keys(newsData.countries).length === 0) {
  console.log('📡 No initial data found, fetching from OpenAI...');
fetchNewsAnalysis()
  .then(() => {
    console.log('Initial news data fetch completed successfully');
  })
  .catch((error) => {
    console.error('Initial news data fetch failed:', error);
      console.log('Server will continue running with pre-loaded initial data');
  });
} else {
  console.log('📋 Using pre-loaded initial news data');
  console.log('🔄 OpenAI updates will still run on schedule every 12 hours');
}

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