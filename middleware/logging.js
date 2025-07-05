const winston = require('winston');

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request Logging Middleware
const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: clientIp,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, 'Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: clientIp,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
};

// Setup global error handlers
const setupGlobalErrorHandlers = () => {
  // Add comprehensive error handling to prevent server crashes
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    console.error('Stack:', error.stack);
    // Don't exit - keep server running
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logger.error('Unhandled Rejection:', { reason, promise, stack: reason?.stack });
    console.error('Stack:', reason?.stack);
    // Don't exit - keep server running
  });
};

module.exports = {
  logger,
  requestLoggingMiddleware,
  setupGlobalErrorHandlers
}; 