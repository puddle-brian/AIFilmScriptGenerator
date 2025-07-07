const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const router = express.Router();

// Import authentication middleware from dedicated middleware file
const { authenticateApiKey, checkCredits, requireAdmin, rateLimit, optionalAuth } = require('../middleware/auth');

// Fallback login handler (when AuthService is unavailable)
async function handleLoginFallback(req, res, dbClient) {
  const { email, password, rememberMe = false } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    // Get user by email
    const result = await dbClient.query(
      'SELECT id, username, email, password_hash, credits_remaining, is_admin, email_verified, api_key FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Password not set for this user' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update last login
    await dbClient.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    console.log(`✅ Fallback login successful for user: ${user.username}`);
    
    // Return user data and API key
    res.json({
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
      rememberMe,
      fallbackMode: true,
      generatedBy: 'Fallback authentication v1.0'
    });
    
  } catch (error) {
    console.error('Fallback login error:', error);
    res.status(500).json({ 
      error: 'Login failed. Please try again.',
      fallbackMode: true
    });
  }
}

// =====================================
// AUTHENTICATION ROUTES
// =====================================

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    message: 'Auth routes are working',
    timestamp: new Date().toISOString(),
    availableServices: {
      authService: !!req.app.get('authService'),
      dbClient: !!req.app.get('dbClient'),
      userService: !!req.app.get('userService')
    }
  });
});

// 🆕 MIGRATED: User Registration using AuthService (Phase 2B)
router.post('/register', async (req, res) => {
  try {
    // Get services from app-level dependency injection
    const authService = req.app.get('authService');
    const populateUserStarterPack = req.app.get('populateUserStarterPack');
    
    if (!authService) {
      console.error('🚨 AuthService not available for registration - checking dependency injection');
      const services = {
        authService: !!req.app.get('authService'),
        dbClient: !!req.app.get('dbClient'),
        userService: !!req.app.get('userService')
      };
      console.error('🔍 Available services:', services);
      
      return res.status(503).json({ 
        error: 'Authentication service temporarily unavailable. Please try again later.',
        debug: 'AuthService not initialized - check server logs',
        fallback: 'Server restarting...',
        availableServices: services,
        troubleshooting: 'Try /api/debug/services for more details'
      });
    }

    const { username, email, password, emailUpdates = false } = req.body;
    
    console.log(`🆕 Using AuthService for user registration: ${username} (${email})`);
    
    // Create user using AuthService - handles all validation, hashing, and database operations
    const result = await authService.createUser({ username, email, password, emailUpdates });
    
    // Populate starter pack with default libraries
    try {
      const starterPackSuccess = await populateUserStarterPack(result.user.id, username);
      if (starterPackSuccess) {
        console.log(`✅ Starter pack successfully populated for ${username}`);
      } else {
        console.log(`⚠️ Failed to populate starter pack for ${username}, but user account created successfully`);
      }
    } catch (starterPackError) {
      console.error(`Error populating starter pack for ${username}:`, starterPackError);
      // Don't fail registration if starter pack fails
    }
    
    console.log(`✅ User registration completed using AuthService: ${username}`);
    
    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        credits_remaining: result.user.credits_remaining,
        created_at: result.user.created_at
      },
      migratedEndpoint: true,
      generatedBy: 'AuthService v2.0',
      codeReduction: '125+ lines -> 35 lines'
    });
    
  } catch (error) {
    console.error('Registration error (migrated):', error);
    res.status(400).json({ 
      error: error.message || 'Registration failed. Please try again.',
      migratedEndpoint: true
    });
  }
});

// 🆕 MIGRATED: User Login using AuthService (Phase 2B)
router.post('/login', async (req, res) => {
  try {
    // Get services from app-level dependency injection
    const authService = req.app.get('authService');
    const dbClient = req.app.get('dbClient');
    
    if (!authService && !dbClient) {
      console.error('🚨 No services available for login - using fallback');
      return res.status(503).json({ 
        error: 'Authentication service temporarily unavailable. Please try again later.',
        debug: 'All services unavailable - check server logs',
        fallback: 'Server restarting...',
        troubleshooting: 'Try /api/debug/services for more details'
      });
    }
    
    // Fallback to direct database access if AuthService unavailable
    if (!authService && dbClient) {
      console.log('🔄 Using fallback authentication (direct database access)');
      return await handleLoginFallback(req, res, dbClient);
    }

    const { email, password, rememberMe = false } = req.body;
    
    console.log(`🆕 Using AuthService for user login: ${email}`);
    
    // Login user using AuthService - handles all validation and authentication
    const result = await authService.login(email, password);
    
    console.log(`✅ User login completed using AuthService: ${result.user.username}`);
    
    // Return user data and API key
    res.json({
      message: 'Login successful',
      user: result.user,
      apiKey: result.apiKey,
      rememberMe,
      migratedEndpoint: true,
      generatedBy: 'AuthService v2.0',
      codeReduction: '55+ lines -> 25 lines'
    });
    
  } catch (error) {
    console.error('Login error (migrated):', error);
    res.status(401).json({ 
      error: error.message || 'Login failed. Please try again.',
      migratedEndpoint: true
    });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Check if user exists
    const result = await dbClient.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email]
    );
    
    // Always return success for security (don't reveal if email exists)
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account with that email exists, password reset instructions have been sent.' });
    }
    
    const user = result.rows[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Store reset token
    await dbClient.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );
    
    // TODO: Send password reset email
    console.log(`Password reset requested for ${user.email} - Token: ${resetToken}`);
    console.log(`Reset URL: http://localhost:3000/reset-password.html?token=${resetToken}`);
    
    res.json({ message: 'If an account with that email exists, password reset instructions have been sent.' });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Find user with valid reset token
    const result = await dbClient.query(
      'SELECT id, username, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const user = result.rows[0];
    
    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password and clear reset token
    await dbClient.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    console.log(`Password reset successful for ${user.email}`);
    
    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Email Verification
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Find user with verification token
    const result = await dbClient.query(
      'SELECT id, username, email FROM users WHERE email_verification_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }
    
    const user = result.rows[0];
    
    // Mark email as verified
    await dbClient.query(
      'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = $1',
      [user.id]
    );
    
    console.log(`Email verified for ${user.email}`);
    
    res.json({ message: 'Email verified successfully!' });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// =====================================
// V2 AUTHENTICATION ROUTES
// =====================================

// V2 Login endpoint
router.post('/v2/login', async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Find user by email
    const result = await dbClient.query(
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
      await dbClient.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
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
    console.error('Login error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// V2 Registration endpoint
router.post('/v2/register', async (req, res) => {
  try {
    const { username, email, password, emailUpdates = false } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters long' });
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscore, and hyphen' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Get database client and services from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const populateUserStarterPack = req.app.get('populateUserStarterPack');
    
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Check if user already exists
    const existingUser = await dbClient.query(
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
    
    // Create user with initial credits (100 free credits = $1.00)
    const result = await dbClient.query(`
      INSERT INTO users (
        username, email, password_hash, api_key, 
        credits_remaining, total_credits_purchased, 
        email_updates, email_verified, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, username, email, api_key, credits_remaining, created_at
          `, [username, email, hashedPassword, apiKey, 100, 100, emailUpdates, false]);
    
    const user = result.rows[0];
    
    console.log(`New user registered via v2: ${username} (${email})`);
    console.log(`Populating starter pack for new v2 user: ${username}`);
    
    // Populate starter pack with default libraries (non-blocking)
    try {
      const starterPackSuccess = await populateUserStarterPack(user.id, username);
      if (starterPackSuccess) {
        console.log(`✅ Starter pack successfully populated for ${username} (v2)`);
      } else {
        console.log(`⚠️ Failed to populate starter pack for ${username} (v2), but user account created successfully`);
      }
    } catch (starterPackError) {
      console.error(`Error populating starter pack for ${username} (v2):`, starterPackError);
      // Don't fail registration if starter pack fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits_remaining: user.credits_remaining,
        created_at: user.created_at
      },
      apiKey: user.api_key  // Return API key so user can be automatically logged in
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ 
        error: 'Registration failed. Please try again.',
        debug: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code
        } : undefined
      });
    }
  }
});

// =====================================
// V2 AUTHENTICATION ROUTES (FOR /api/v2/auth mount)
// These provide the same functionality as above but without /v2 prefix
// =====================================

// V2 Login endpoint - accessible at /api/v2/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Find user by email
    const result = await dbClient.query(
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
      await dbClient.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    } catch (updateError) {
      console.log('Last login update failed:', updateError.message);
    }
    
    console.log(`✅ V2 Login successful for user: ${user.username} (${email})`);
    
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
      rememberMe,
      version: 'v2.0'
    });
    
  } catch (error) {
    console.error('V2 Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// V2 Registration endpoint - accessible at /api/v2/auth/register  
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, emailUpdates = false } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters long' });
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscore, and hyphen' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Get database client and services from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const populateUserStarterPack = req.app.get('populateUserStarterPack');
    
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    // Check if user already exists
    const existingUser = await dbClient.query(
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
    
    // Create user with initial credits (100 free credits = $1.00)
    const result = await dbClient.query(`
      INSERT INTO users (
        username, email, password_hash, api_key, 
        credits_remaining, total_credits_purchased, 
        email_updates, email_verified, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, username, email, api_key, credits_remaining, created_at
          `, [username, email, hashedPassword, apiKey, 100, 100, emailUpdates, false]);
    
    const user = result.rows[0];
    
    console.log(`✅ V2 Registration successful for user: ${username} (${email})`);
    
    // Populate starter pack with default libraries (non-blocking)
    try {
      const starterPackSuccess = await populateUserStarterPack(user.id, username);
      if (starterPackSuccess) {
        console.log(`✅ Starter pack populated for ${username} (v2)`);
      }
    } catch (starterPackError) {
      console.error(`Error populating starter pack for ${username} (v2):`, starterPackError);
      // Don't fail registration if starter pack fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits_remaining: user.credits_remaining,
        created_at: user.created_at
      },
      apiKey: user.api_key,  // Return API key so user can be automatically logged in
      version: 'v2.0'
    });
    
  } catch (error) {
    console.error('V2 Registration error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ 
        error: 'Registration failed. Please try again.'
      });
    }
  }
});

// =====================================
// UTILITY EXPORTS
// =====================================

module.exports = {
  router,
  authenticateApiKey,
  checkCredits
}; 