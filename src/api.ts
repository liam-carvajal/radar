// API service for backend communication
const BASE_URL = 'http://localhost:3001';

export interface NewsItem {
  headline: string;
  source: string;
  date: string;
  url: string;
  industry: string;
  advertisingImpact: string;
  positivityScore: number;
  importanceScore: number;
}

export interface CountryNewsData {
  country?: string;
  name?: string;
  industries?: {
    [industry: string]: {
      news: NewsItem[];
      averagePositivity: number;
      averageImportance: number;
    } | Array<{
      title: string;
      link: string;
      positivityScore: number;
      importanceScore: number;
      effect: string;
    }>;
  };
  industryScores?: {
    [industry: string]: {
      positivityScore: number;
      importanceScore: number;
      averageScore: number;
    };
  };
  newsTitles?: string[];
  newsLinks?: string[];
  overallScore: number;
  lastUpdated: string;
}

export interface NewsResponse {
  success: boolean;
  data: {
    lastUpdated: string;
    countries: {
      [country: string]: CountryNewsData;
    };
    newsHistory: any[];
  };
  message?: string;
}

export interface CountrySpecificResponse {
  success: boolean;
  data: CountryNewsData;
  message?: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Get all news data
  async getAllNews(): Promise<NewsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/news`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch all news:', error);
      throw error;
    }
  }

  // Get news for specific country
  async getCountryNews(country: string): Promise<CountrySpecificResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/news/${encodeURIComponent(country)}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Failed to fetch news for ${country}:`, error);
      throw error;
    }
  }

  // Get available regions
  async getRegions(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/regions`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to fetch regions:', error);
      throw error;
    }
  }

  // Get available industries
  async getIndustries(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/industries`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to fetch industries:', error);
      throw error;
    }
  }

  // Trigger manual news update
  async updateNews(regions?: string[], industries?: string[]): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/news/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ regions, industries }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to update news:', error);
      throw error;
    }
  }

  // Get news history for specific country
  async getCountryHistory(country: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/news/${encodeURIComponent(country)}/history`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Failed to fetch history for ${country}:`, error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService; 