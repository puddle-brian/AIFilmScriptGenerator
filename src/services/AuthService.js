const crypto = require('crypto');
const bcrypt = require('bcrypt');

class AuthService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  // Generate secure API key
  generateApiKey(username) {
    const prefix = username.toLowerCase().substring(0, 4);
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}_${randomBytes}`;
  }

  // Hash password securely
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Validate user input
  validateUserInput(userData) {
    const { username, email, password, emailUpdates = false } = userData;
    const errors = [];

    // Required fields
    if (!username || !email || !password) {
      errors.push('Username, email, and password are required');
    }

    // Username validation
    if (username && (username.length < 3 || username.length > 30)) {
      errors.push('Username must be 3-30 characters long');
    }

    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscore, and hyphen');
    }

    // Password validation
    if (password && password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Email basic validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Please provide a valid email address');
    }

    return errors;
  }

  // Create new user
  async createUser(userData) {
    const { username, email, password, emailUpdates = false } = userData;
    
    // Validate input
    const validationErrors = this.validateUserInput(userData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }
    
    // Check if user already exists
    const existingUser = await this.db.checkUserExists(username, email);
    if (existingUser.rows.length > 0) {
      throw new Error('Username or email already exists');
    }
    
    // Generate API key
    const apiKey = this.generateApiKey(username);
    
    // Hash password
    const passwordHash = await this.hashPassword(password);
    
    // Create user with initial credits
    const newUser = await this.db.createUser({
      username,
      email,
      apiKey,
      passwordHash,
      credits: 100, // Free starter credits
      emailUpdates
    });

    // Log credit grant
    await this.db.logCreditTransaction(
      newUser.rows[0].id, 
      'grant', 
      100, 
      'Welcome bonus - 100 free credits'
    );

    return {
      user: newUser.rows[0],
      apiKey
    };
  }

  // Authenticate user by API key
  async authenticateByApiKey(apiKey) {
    if (!apiKey) {
      throw new Error('API key required');
    }

    const result = await this.db.getUserByApiKey(apiKey);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid API key');
    }

    return result.rows[0];
  }

  // Login user with email/password
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const result = await this.db.getUserByEmail(email);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];
    
    if (!user.password_hash) {
      throw new Error('Password not set for this user');
    }

    const isValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await this.db.updateLastLogin(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits_remaining: user.credits_remaining,
        is_admin: user.is_admin,
        email_verified: user.email_verified
      },
      apiKey: user.api_key
    };
  }

  // Middleware factory
  createAuthMiddleware() {
    return async (req, res, next) => {
      try {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;
        
        if (!apiKey) {
          return res.status(401).json({ 
            error: 'API key required',
            message: 'Please provide an API key in the X-API-Key header or api_key query parameter'
          });
        }

        const user = await this.authenticateByApiKey(apiKey);
        req.user = user;
        next();
      } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ 
          error: 'Authentication failed',
          message: error.message
        });
      }
    };
  }

  // Admin middleware
  requireAdmin() {
    return (req, res, next) => {
      if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ 
          error: 'Admin access required' 
        });
      }
      next();
    };
  }
}

module.exports = AuthService; 