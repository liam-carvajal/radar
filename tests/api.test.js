import request from 'supertest';
import { jest } from '@jest/globals';

// Mock OpenAI
const mockOpenAI = {
  responses: {
    create: jest.fn()
  }
};

// Mock the OpenAI module
jest.unstable_mockModule('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAI)
}));

// Mock node-cron
jest.unstable_mockModule('node-cron', () => ({
  schedule: jest.fn()
}));

// Import the app after mocking
let app;

describe('API Endpoints', () => {
  beforeAll(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock successful OpenAI response
    mockOpenAI.responses.create.mockResolvedValue({
      output_text: `Country: US
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
Importance score (10 being very important for the business, 1 being very unimportant for the business): 8`
    });

    // Import the app after mocking
    const { default: server } = await import('../backend/server.js');
    app = server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return server health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Server is running',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /api/regions', () => {
    it('should return available regions', async () => {
      const response = await request(app)
        .get('/api/regions')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: ['US', 'Europe', 'Australia', 'South Korea'],
        message: 'Available regions retrieved successfully'
      });
    });
  });

  describe('GET /api/industries', () => {
    it('should return available industries', async () => {
      const response = await request(app)
        .get('/api/industries')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: ['Beauty/wellness', 'clothing/apparel', 'retail', 'ticketing/events'],
        message: 'Available industries retrieved successfully'
      });
    });
  });

  describe('GET /api/news', () => {
    it('should return news data', async () => {
      const response = await request(app)
        .get('/api/news')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          lastUpdated: expect.any(String),
          regions: expect.any(Object)
        },
        message: 'News data retrieved successfully'
      });
    });
  });

  describe('GET /api/news/:region', () => {
    it('should return news for specific region', async () => {
      const response = await request(app)
        .get('/api/news/US')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          region: 'US',
          news: expect.any(Array),
          lastUpdated: expect.any(String)
        },
        message: 'News data for US retrieved successfully'
      });
    });

    it('should return empty array for non-existent region', async () => {
      const response = await request(app)
        .get('/api/news/NonExistentRegion')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          region: 'NonExistentRegion',
          news: [],
          lastUpdated: expect.any(String)
        },
        message: 'News data for NonExistentRegion retrieved successfully'
      });
    });
  });

  describe('POST /api/news/update', () => {
    it('should trigger news update with default parameters', async () => {
      const response = await request(app)
        .post('/api/news/update')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.any(Object),
        message: 'News data updated successfully'
      });

      expect(mockOpenAI.responses.create).toHaveBeenCalled();
    });

    it('should trigger news update with custom parameters', async () => {
      const customData = {
        regions: ['US', 'Europe'],
        industries: ['retail', 'beauty/wellness']
      };

      const response = await request(app)
        .post('/api/news/update')
        .send(customData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.any(Object),
        message: 'News data updated successfully'
      });

      expect(mockOpenAI.responses.create).toHaveBeenCalled();
    });

    it('should handle OpenAI API errors', async () => {
      // Mock OpenAI error
      mockOpenAI.responses.create.mockRejectedValueOnce(
        new Error('OpenAI API error')
      );

      const response = await request(app)
        .post('/api/news/update')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI API error'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
}); 