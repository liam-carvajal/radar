import request from 'supertest';
import { jest } from '@jest/globals';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

jest.unstable_mockModule('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAI)
}));

// Mock node-cron
jest.unstable_mockModule('node-cron', () => ({
  schedule: jest.fn()
}));

let app;

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Mock successful OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: `Country: US
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
        }
      }]
    });

    // Import the app after mocking
    const { default: server } = await import('../backend/server.js');
    app = server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full News Analysis Flow', () => {
    it('should complete full news analysis workflow', async () => {
      // Step 1: Check server health
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.success).toBe(true);

      // Step 2: Get available regions and industries
      const regionsResponse = await request(app)
        .get('/api/regions')
        .expect(200);

      const industriesResponse = await request(app)
        .get('/api/industries')
        .expect(200);

      expect(regionsResponse.body.data).toContain('US');
      expect(industriesResponse.body.data).toContain('retail');

      // Step 3: Trigger news update
      const updateResponse = await request(app)
        .post('/api/news/update')
        .send({
          regions: ['US', 'Europe'],
          industries: ['retail', 'beauty/wellness']
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data).toHaveProperty('US');
      expect(updateResponse.body.data).toHaveProperty('Europe');

      // Step 4: Verify news data is available
      const newsResponse = await request(app)
        .get('/api/news')
        .expect(200);

      expect(newsResponse.body.data.regions).toHaveProperty('US');
      expect(newsResponse.body.data.regions).toHaveProperty('Europe');

      // Step 5: Get specific region data
      const usNewsResponse = await request(app)
        .get('/api/news/US')
        .expect(200);

      expect(usNewsResponse.body.data.region).toBe('US');
      expect(usNewsResponse.body.data.news).toBeInstanceOf(Array);
      expect(usNewsResponse.body.data.news.length).toBeGreaterThan(0);

      // Verify news item structure
      const newsItem = usNewsResponse.body.data.news[0];
      expect(newsItem).toHaveProperty('market');
      expect(newsItem).toHaveProperty('news');
      expect(newsItem).toHaveProperty('effect');
      expect(newsItem).toHaveProperty('positivityScore');
      expect(newsItem).toHaveProperty('importanceScore');
    });

    it('should handle multiple news updates', async () => {
      // First update
      const firstUpdate = await request(app)
        .post('/api/news/update')
        .send({ regions: ['US'] })
        .expect(200);

      expect(firstUpdate.body.success).toBe(true);

      // Second update with different parameters
      const secondUpdate = await request(app)
        .post('/api/news/update')
        .send({ regions: ['Europe'], industries: ['beauty/wellness'] })
        .expect(200);

      expect(secondUpdate.body.success).toBe(true);

      // Verify both updates affected the data
      const newsData = await request(app)
        .get('/api/news')
        .expect(200);

      expect(newsData.body.data.regions).toHaveProperty('US');
      expect(newsData.body.data.regions).toHaveProperty('Europe');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle OpenAI API failures gracefully', async () => {
      // Mock OpenAI failure
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      );

      const response = await request(app)
        .post('/api/news/update')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API rate limit exceeded');
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/news/update')
        .send({ invalid: 'data' })
        .expect(200); // Should still work with default parameters

      expect(response.body.success).toBe(true);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/news/update')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across endpoints', async () => {
      // Trigger update
      await request(app)
        .post('/api/news/update')
        .send({ regions: ['US', 'Europe'] })
        .expect(200);

      // Get all news
      const allNews = await request(app)
        .get('/api/news')
        .expect(200);

      // Get specific regions
      const usNews = await request(app)
        .get('/api/news/US')
        .expect(200);

      const europeNews = await request(app)
        .get('/api/news/Europe')
        .expect(200);

      // Verify consistency
      expect(allNews.body.data.regions.US).toEqual(usNews.body.data.news);
      expect(allNews.body.data.regions.Europe).toEqual(europeNews.body.data.news);
      expect(allNews.body.data.lastUpdated).toBe(usNews.body.data.lastUpdated);
      expect(allNews.body.data.lastUpdated).toBe(europeNews.body.data.lastUpdated);
    });

    it('should handle concurrent requests', async () => {
      // Make multiple concurrent requests
      const promises = [
        request(app).get('/api/news'),
        request(app).get('/api/regions'),
        request(app).get('/api/industries'),
        request(app).get('/api/health')
      ];

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should respond to health check within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle rapid successive requests', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete all requests within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 10 requests
    });
  });
}); 