const { body, validationResult } = require('express-validator');
const { logger } = require('./logging');

// Input validation helpers
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  
  // Check for at least one number, one lowercase, one uppercase letter
  const hasNumber = /\d/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  
  return hasNumber && hasLower && hasUpper;
}

// Validation middleware factory
function validateRequest(validations) {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation error:', { errors: errors.array(), ip: req.ip, url: req.url });
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      next();
    }
  ];
}

module.exports = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateRequest,
  body // Re-export for convenience
}; 