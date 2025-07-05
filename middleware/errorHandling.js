// JSON parsing error middleware
const jsonParsingErrorHandler = (error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('JSON parsing error:', error.message);
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(error);
};

// General error handling middleware
const generalErrorHandler = (error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
};

// Setup error handling middleware
const setupErrorHandling = (app) => {
  // JSON parsing error middleware
  app.use(jsonParsingErrorHandler);
  
  // General error handling middleware
  app.use(generalErrorHandler);
};

module.exports = {
  jsonParsingErrorHandler,
  generalErrorHandler,
  setupErrorHandling
}; 