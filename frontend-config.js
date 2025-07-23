// Frontend Configuration for Radar Backend
// Copy this configuration to your frontend project

const API_CONFIG = {
  // Backend API base URL
  baseURL: 'http://localhost:3001',
  
  // API endpoints
  endpoints: {
    health: '/api/health',
    news: '/api/news',
    newsByCountry: '/api/news/:country',
    newsHistory: '/api/news/:country/history',
    updateNews: '/api/news/update',
    regions: '/api/regions',
    industries: '/api/industries',
    summary: '/api/summary',
    status: '/api/status',
    docs: '/api/docs'
  },
  
  // Available regions
  regions: ['US', 'Europe', 'Australia', 'South Korea'],
  
  // Available industries
  industries: ['Beauty/wellness', 'clothing/apparel', 'retail', 'ticketing/events'],
  
  // Data structure examples
  dataStructures: {
    newsItem: {
      industry: 'string',
      news: 'string',
      effect: 'string',
      positivityScore: 'number (1-10)',
      importanceScore: 'number (1-10)',
      link: 'string'
    },
    countryData: {
      name: 'string',
      lastUpdated: 'ISO timestamp',
      overallScore: 'number (0-10)',
      industryScores: {
        'industry-name': {
          positivityScore: 'number',
          importanceScore: 'number',
          averageScore: 'number'
        }
      },
      newsTitles: 'array of strings'
    }
  }
};

// Example usage functions
const API_HELPERS = {
  // Get all news data
  async getAllNews() {
    const response = await fetch(`${API_CONFIG.baseURL}/api/news`);
    return response.json();
  },
  
  // Get news for specific country
  async getNewsByCountry(country) {
    const response = await fetch(`${API_CONFIG.baseURL}/api/news/${country}`);
    return response.json();
  },
  
  // Get data summary for dashboard
  async getSummary() {
    const response = await fetch(`${API_CONFIG.baseURL}/api/summary`);
    return response.json();
  },
  
  // Trigger news update
  async updateNews(regions = null, industries = null) {
    const response = await fetch(`${API_CONFIG.baseURL}/api/news/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ regions, industries })
    });
    return response.json();
  },
  
  // Get server status
  async getStatus() {
    const response = await fetch(`${API_CONFIG.baseURL}/api/status`);
    return response.json();
  }
};

// Export for use in frontend
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, API_HELPERS };
} else if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
  window.API_HELPERS = API_HELPERS;
} 