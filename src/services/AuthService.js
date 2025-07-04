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

  // Create new user
  async createUser(userData) {
    const { username, email, password } = userData;
    
    // Generate API key
    const apiKey = this.generateApiKey(username);
    
    // Hash password if provided
    const passwordHash = password ? await this.hashPassword(password) : null;
    
    // Create user with initial credits
    const newUser = await this.db.createUser({
      username,
      email,
      apiKey,
      passwordHash,
      credits: 100 // Free starter credits
    });

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

  // Login user with username/password
  async login(username, password) {
    const result = await this.db.getUserByUsername(username);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    
    if (!user.password_hash) {
      throw new Error('Password not set for this user');
    }

    const isValid = await this.verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.db.updateLastLogin(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits: user.credits,
        is_admin: user.is_admin
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