// Test setup file
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://localhost/test_db';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.STRIPE_SECRET_KEY = 'test-stripe-key';

// Mock console.log for tests to reduce noise
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.JEST_VERBOSE === 'true') {
    originalConsoleLog(...args);
  }
};

// Mock console.error for tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (process.env.JEST_VERBOSE === 'true') {
    originalConsoleError(...args);
  }
};

// Extend Jest timeout for integration tests
jest.setTimeout(30000); 