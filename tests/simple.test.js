import { jest } from '@jest/globals';

describe('Simple Tests', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  test('should work with environment variables', () => {
    expect(process.env.OPENAI_API_KEY).toBe('test-api-key');
  });
});

describe('Math Operations', () => {
  test('addition', () => {
    expect(2 + 3).toBe(5);
  });

  test('multiplication', () => {
    expect(4 * 5).toBe(20);
  });

  test('division', () => {
    expect(10 / 2).toBe(5);
  });
}); 