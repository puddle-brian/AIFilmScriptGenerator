const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const ServerlessDB = require('./serverless-db');

const router = express.Router();

// Production-ready migration endpoint
router.post('/api/v2/migrate-database', async (req, res) => {
  const db = new ServerlessDB();
  try {
    const results = await Promise.race([
      db.fastMigration(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Migration timeout')), 25000))
    ]);
    
    res.json({
      success: true,
      message: 'Database migration completed',
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(error.message === 'Migration timeout' ? 408 : 500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await db.close();
  }
});

// Production-ready registration endpoint
router.post('/api/v2/auth/register', async (req, res) => {
  const db = new ServerlessDB();
  try {
    const { username, email, password, emailUpdates = false } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters long' });
    }
    
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscore, and hyphen' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Generate API key
    const apiKey = 'user_' + crypto.randomBytes(32).toString('hex');
    
    // Register user with fallback
    const registrationResult = await db.registerUser({
      username,
      email,
      password_hash: hashedPassword,
      api_key: apiKey,
      credits: 500,
      email_updates: emailUpdates
    });
    
    if (!registrationResult.success) {
      return res.status(500).json({
        error: registrationResult.error,
        details: registrationResult.fullError
      });
    }
    
    const user = registrationResult.user;
    
    // Try to log credit transaction (non-critical)
    await db.logCreditTransaction(user.id, 'grant', 500, 'Welcome bonus - 500 free credits');
    
    console.log(`New user registered: ${username} (${email}) - Method: ${registrationResult.method}`);
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email || null,
        credits_remaining: user.credits_remaining,
        created_at: user.created_at
      },
      registrationMethod: registrationResult.method
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  } finally {
    await db.close();
  }
});

// Production-ready login endpoint
router.post('/api/v2/auth/login', async (req, res) => {
  const db = new ServerlessDB();
  try {
    const { email, password, rememberMe = false } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const result = await db.query(
      'SELECT id, username, email, password_hash, api_key, credits_remaining, is_admin, email_verified FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update last login (non-critical)
    try {
      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    } catch (updateError) {
      console.log('Last login update failed:', updateError.message);
    }
    
    // Return user data and API key
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits_remaining: user.credits_remaining,
        is_admin: user.is_admin,
        email_verified: user.email_verified
      },
      apiKey: user.api_key,
      rememberMe
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  } finally {
    await db.close();
  }
});

// Debug environment endpoint
router.get('/api/v2/debug-env', (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;
  
  // Extract hostname from DATABASE_URL for debugging
  let hostname = 'unknown';
  try {
    if (dbUrl) {
      const url = new URL(dbUrl);
      hostname = url.hostname;
    }
  } catch (e) {
    hostname = 'parse-error';
  }
  
  res.json({
    environment: {
      NODE_ENV: nodeEnv,
      DATABASE_URL_exists: !!dbUrl,
      DATABASE_URL_length: dbUrl ? dbUrl.length : 0,
      DATABASE_URL_hostname: hostname,
      DATABASE_URL_preview: dbUrl ? dbUrl.substring(0, 50) + '...' : 'missing'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
router.get('/api/v2/health', async (req, res) => {
  const db = new ServerlessDB();
  try {
    await db.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await db.close();
  }
});

module.exports = router; 