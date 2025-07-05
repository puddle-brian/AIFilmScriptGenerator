const rateLimit = require('express-rate-limit');

// General Rate Limiting - DoS Protection
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs - reasonable for normal usage
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks, webhooks, and static files
    return req.path === '/health' || 
           req.path.startsWith('/api/stripe-webhook') ||
           req.path.startsWith('/public/') ||
           req.path === '/' ||  // Skip root index page
           req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|html)$/);  // Added html extension
  }
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting middleware to app
const setupRateLimiting = (app) => {
  // Apply general rate limiting
  app.use(generalLimiter);

  // Apply auth rate limiting to specific routes
  app.use('/api/auth/', authLimiter);
  app.use('/api/v2/auth/', authLimiter);
};

module.exports = {
  generalLimiter,
  authLimiter,
  setupRateLimiting
}; 