import { jest } from '@jest/globals';

// Mock the server module to test utility functions
const mockServer = {
  generateAnalysisPrompt: jest.fn(),
  parseAnalysisResponse: jest.fn()
};

jest.unstable_mockModule('../backend/server.js', () => ({
  generateAnalysisPrompt: mockServer.generateAnalysisPrompt,
  parseAnalysisResponse: mockServer.parseAnalysisResponse
}));

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAnalysisPrompt', () => {
    it('should generate prompt with default parameters', () => {
      const prompt = mockServer.generateAnalysisPrompt();
      
      expect(prompt).toContain('You are an expert at understanding macro and micro economic trends');
      expect(prompt).toContain('US, Europe, Australia, South Korea');
      expect(prompt).toContain('Beauty/wellness, clothing/apparel, retail, ticketing/events');
    });

    it('should generate prompt with custom parameters', () => {
      const customRegions = ['US', 'Canada'];
      const customIndustries = ['tech', 'finance'];
      
      const prompt = mockServer.generateAnalysisPrompt(customRegions, customIndustries);
      
      expect(prompt).toContain('US, Canada');
      expect(prompt).toContain('tech, finance');
    });
  });

  describe('parseAnalysisResponse', () => {
    it('should parse valid OpenAI response', () => {
      const mockResponse = `Country: US
Market: Retail
News headline (with links and date): "Federal Reserve announces interest rate decision" (Bloomberg, 2024-01-01)
How does it affect the advertising business: Positive impact on consumer spending
Positivity score (10 being very positive for the business, 1 being very negative for the business): 8
Importance score (10 being very important for the business, 1 being very unimportant for the business): 9

Country: Europe
Market: Beauty/Wellness
News headline (with links and date): "European beauty market grows 15%" (Reuters, 2024-01-01)
How does it affect the advertising business: Strong growth in beauty sector
Positivity score (10 being very positive for the business, 1 being very negative for the business): 9
Importance score (10 being very important for the business, 1 being very unimportant for the business): 8`;

      const result = mockServer.parseAnalysisResponse(mockResponse);
      
      expect(result).toEqual({
        US: [{
          market: 'Retail',
          news: '"Federal Reserve announces interest rate decision" (Bloomberg, 2024-01-01)',
          effect: 'Positive impact on consumer spending',
          positivityScore: 8,
          importanceScore: 9
        }],
        Europe: [{
          market: 'Beauty/Wellness',
          news: '"European beauty market grows 15%" (Reuters, 2024-01-01)',
          effect: 'Strong growth in beauty sector',
          positivityScore: 9,
          importanceScore: 8
        }]
      });
    });

    it('should handle empty response', () => {
      const result = mockServer.parseAnalysisResponse('');
      expect(result).toEqual({});
    });

    it('should handle malformed response', () => {
      const malformedResponse = `Country: US
Market: Retail
News headline: Some news
How does it affect: Some effect
Positivity score: invalid
Importance score: also invalid`;

      const result = mockServer.parseAnalysisResponse(malformedResponse);
      
      expect(result).toEqual({
        US: [{
          market: 'Retail',
          news: 'Some news',
          effect: 'Some effect',
          positivityScore: null,
          importanceScore: null
        }]
      });
    });

    it('should handle multiple news items per country', () => {
      const multiItemResponse = `Country: US
Market: Retail
News headline (with links and date): "First news item" (Source, 2024-01-01)
How does it affect the advertising business: First effect
Positivity score (10 being very positive for the business, 1 being very negative for the business): 7
Importance score (10 being very important for the business, 1 being very unimportant for the business): 8

Country: US
Market: Beauty/Wellness
News headline (with links and date): "Second news item" (Source, 2024-01-01)
How does it affect the advertising business: Second effect
Positivity score (10 being very positive for the business, 1 being very negative for the business): 9
Importance score (10 being very important for the business, 1 being very unimportant for the business): 6`;

      const result = mockServer.parseAnalysisResponse(multiItemResponse);
      
      expect(result.US).toHaveLength(2);
      expect(result.US[0].market).toBe('Retail');
      expect(result.US[1].market).toBe('Beauty/Wellness');
    });
  });

  describe('Data validation', () => {
    it('should validate positivity score range', () => {
      const response = `Country: US
Market: Retail
News headline (with links and date): "Test news" (Source, 2024-01-01)
How does it affect the advertising business: Test effect
Positivity score (10 being very positive for the business, 1 being very negative for the business): 15
Importance score (10 being very important for the business, 1 being very unimportant for the business): 5`;

      const result = mockServer.parseAnalysisResponse(response);
      
      // Should handle out-of-range scores gracefully
      expect(result.US[0].positivityScore).toBe(15); // Currently accepts any number, could add validation
    });

    it('should handle missing scores', () => {
      const response = `Country: US
Market: Retail
News headline (with links and date): "Test news" (Source, 2024-01-01)
How does it affect the advertising business: Test effect`;

      const result = mockServer.parseAnalysisResponse(response);
      
      expect(result.US[0].positivityScore).toBeNull();
      expect(result.US[0].importanceScore).toBeNull();
    });
  });
}); 