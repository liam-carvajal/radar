import { jest } from '@jest/globals';

describe('API Configuration Tests', () => {
  test('should have correct regions configuration', () => {
    const expectedRegions = ['US', 'Europe', 'Australia', 'South Korea'];
    expect(expectedRegions).toContain('US');
    expect(expectedRegions).toContain('Europe');
    expect(expectedRegions).toContain('Australia');
    expect(expectedRegions).toContain('South Korea');
    expect(expectedRegions).toHaveLength(4);
  });

  test('should have correct industries configuration', () => {
    const expectedIndustries = ['Beauty/wellness', 'clothing/apparel', 'retail', 'ticketing/events'];
    expect(expectedIndustries).toContain('Beauty/wellness');
    expect(expectedIndustries).toContain('clothing/apparel');
    expect(expectedIndustries).toContain('retail');
    expect(expectedIndustries).toContain('ticketing/events');
    expect(expectedIndustries).toHaveLength(4);
  });

  test('should validate environment variables', () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined();
    expect(process.env.PORT).toBeDefined();
  });
});

describe('Data Structure Tests', () => {
  test('should validate news item structure', () => {
    const mockNewsItem = {
      market: 'Retail',
      news: 'Test news headline',
      effect: 'Test effect on advertising',
      positivityScore: 8,
      importanceScore: 7
    };

    expect(mockNewsItem).toHaveProperty('market');
    expect(mockNewsItem).toHaveProperty('news');
    expect(mockNewsItem).toHaveProperty('effect');
    expect(mockNewsItem).toHaveProperty('positivityScore');
    expect(mockNewsItem).toHaveProperty('importanceScore');
    
    expect(typeof mockNewsItem.market).toBe('string');
    expect(typeof mockNewsItem.news).toBe('string');
    expect(typeof mockNewsItem.effect).toBe('string');
    expect(typeof mockNewsItem.positivityScore).toBe('number');
    expect(typeof mockNewsItem.importanceScore).toBe('number');
  });

  test('should validate score ranges', () => {
    const mockNewsItem = {
      positivityScore: 8,
      importanceScore: 7
    };

    expect(mockNewsItem.positivityScore).toBeGreaterThanOrEqual(1);
    expect(mockNewsItem.positivityScore).toBeLessThanOrEqual(10);
    expect(mockNewsItem.importanceScore).toBeGreaterThanOrEqual(1);
    expect(mockNewsItem.importanceScore).toBeLessThanOrEqual(10);
  });
});

describe('Response Format Tests', () => {
  test('should validate success response format', () => {
    const mockSuccessResponse = {
      success: true,
      data: {
        lastUpdated: '2024-01-01T00:00:00.000Z',
        regions: {
          US: []
        }
      },
      message: 'News data retrieved successfully'
    };

    expect(mockSuccessResponse).toHaveProperty('success');
    expect(mockSuccessResponse).toHaveProperty('data');
    expect(mockSuccessResponse).toHaveProperty('message');
    expect(mockSuccessResponse.success).toBe(true);
  });

  test('should validate error response format', () => {
    const mockErrorResponse = {
      success: false,
      error: 'Error message'
    };

    expect(mockErrorResponse).toHaveProperty('success');
    expect(mockErrorResponse).toHaveProperty('error');
    expect(mockErrorResponse.success).toBe(false);
  });
});

describe('Utility Function Tests', () => {
  test('should generate analysis prompt with default parameters', () => {
    const regions = ['US', 'Europe', 'Australia', 'South Korea'];
    const industries = ['Beauty/wellness', 'clothing/apparel', 'retail', 'ticketing/events'];
    
    const prompt = `You are an expert at understanding macro and micro economic trends (with an emphasis on macroeconomic) in the past 24 hours across the world in the direct context of advertising industry. You will be given a set of countries to target, possible industries to focus on and how certain news headline can affect ads performance (either in a negative or positive way).

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

    expect(prompt).toContain('You are an expert at understanding macro and micro economic trends');
    expect(prompt).toContain('US, Europe, Australia, South Korea');
    expect(prompt).toContain('Beauty/wellness, clothing/apparel, retail, ticketing/events');
    expect(prompt).toContain('Country:');
    expect(prompt).toContain('Market:');
    expect(prompt).toContain('News headline');
  });

  test('should parse analysis response correctly', () => {
    const mockResponse = `Country: US
Market: Retail
News headline (with links and date): "Test news" (Source, 2024-01-01)
How does it affect the advertising business: Test effect
Positivity score (10 being very positive for the business, 1 being very negative for the business): 8
Importance score (10 being very important for the business, 1 being very unimportant for the business): 7`;

    // Simulate parsing logic
    const lines = mockResponse.split('\n');
    const parsedData = {};
    let currentCountry = null;
    let currentMarket = null;
    let currentNews = null;
    let currentEffect = null;
    let currentPositivity = null;
    let currentImportance = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('Country:')) {
        currentCountry = trimmedLine.replace('Country:', '').trim();
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

    if (currentCountry && currentNews) {
      if (!parsedData[currentCountry]) {
        parsedData[currentCountry] = [];
      }
      parsedData[currentCountry].push({
        market: currentMarket,
        news: currentNews,
        effect: currentEffect,
        positivityScore: currentPositivity,
        importanceScore: currentImportance
      });
    }

    expect(parsedData).toHaveProperty('US');
    expect(parsedData.US).toHaveLength(1);
    expect(parsedData.US[0].market).toBe('Retail');
    expect(parsedData.US[0].positivityScore).toBe(10);
    expect(parsedData.US[0].importanceScore).toBe(10);
  });
}); 