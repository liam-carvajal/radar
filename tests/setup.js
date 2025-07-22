// Test setup file
import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.PORT = '3001';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}; 