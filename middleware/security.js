// Security utility functions
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Remove potential XSS patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
}

module.exports = {
  sanitizeInput
}; 