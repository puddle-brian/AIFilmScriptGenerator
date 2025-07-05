/**
 * Authentication Middleware
 * Centralized authentication and authorization middleware for the Film Script Generator
 * 
 * Extracted from routes/auth.js as part of Phase 2A refactoring
 * This provides clean separation of concerns between middleware and route handlers
 */

/**
 * API Key Authentication Middleware
 * Validates API keys and attaches user information to the request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required', 
      message: 'Please provide an API key in the X-API-Key header or api_key query parameter' 
    });
  }

  try {
    console.log('🔐 Authenticating API key:', apiKey.substring(0, 10) + '...');
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Simple query with built-in timeout handling
    const user = await dbClient.query(
      'SELECT * FROM users WHERE api_key = $1',
      [apiKey]
    );

    console.log('✅ Authentication query successful, found', user.rows.length, 'users');

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.user = user.rows[0];
    console.log('✅ User authenticated:', user.rows[0].username);
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    console.error('❌ Error details:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
}

/**
 * Credit Checking Middleware
 * Validates that the authenticated user has sufficient credits for the operation
 * 
 * @param {number} estimatedCost - The estimated cost of the operation in credits
 * @returns {Function} Express middleware function
 */
function checkCredits(estimatedCost = 1) {
  return async (req, res, next) => {
    if (req.user.credits_remaining < estimatedCost) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        remaining: req.user.credits_remaining,
        required: estimatedCost,
        message: 'Please purchase more credits to continue using the service'
      });
    }
    next();
  };
}

/**
 * Admin Authentication Middleware
 * Validates that the authenticated user has admin privileges
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user.is_admin) {
    return res.status(403).json({ 
      error: 'Admin privileges required',
      message: 'This operation requires administrator access'
    });
  }
  
  next();
}

/**
 * Rate Limiting Middleware
 * Basic rate limiting based on user API key
 * 
 * @param {number} maxRequests - Maximum requests per time window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware function
 */
function rateLimit(maxRequests = 100, windowMs = 60000) {
  const requests = new Map();
  
  return (req, res, next) => {
    const userId = req.user ? req.user.id : req.ip;
    const now = Date.now();
    const userRequests = requests.get(userId) || [];
    
    // Filter out old requests
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    recentRequests.push(now);
    requests.set(userId, recentRequests);
    
    next();
  };
}

/**
 * Optional Authentication Middleware
 * Attempts to authenticate but doesn't fail if no credentials provided
 * Used for endpoints that work with or without authentication
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function optionalAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    // No API key provided, continue without authentication
    return next();
  }

  try {
    console.log('🔐 Optional authentication for API key:', apiKey.substring(0, 10) + '...');
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      // Database unavailable, continue without authentication
      return next();
    }
    
    // Simple query with built-in timeout handling
    const user = await dbClient.query(
      'SELECT * FROM users WHERE api_key = $1',
      [apiKey]
    );

    if (user.rows.length > 0) {
      req.user = user.rows[0];
      console.log('✅ User optionally authenticated:', user.rows[0].username);
    }
    
    next();
  } catch (error) {
    console.error('❌ Optional authentication error:', error.message);
    // Don't fail on optional authentication errors
    next();
  }
}

module.exports = {
  authenticateApiKey,
  checkCredits,
  requireAdmin,
  rateLimit,
  optionalAuth
}; 