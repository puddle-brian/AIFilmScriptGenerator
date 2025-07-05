const express = require('express');
const path = require('path');
const router = express.Router();

// Import authentication middleware
const { authenticateApiKey, checkCredits } = require('../middleware/auth');

// Import payment handler
const PaymentHandler = require('../payment-handlers');

// =====================================
// STRIPE WEBHOOK ENDPOINTS
// =====================================
// These endpoints need raw body access, so they use express.raw middleware

// Enhanced debug webhook endpoint to diagnose signature issues
router.post('/stripe-webhook-debug', express.raw({type: '*/*'}), (req, res) => {
  console.log('🐛 DEBUG WEBHOOK RECEIVED:');
  console.log('   - Timestamp:', new Date().toISOString());
  console.log('   - Headers:', JSON.stringify(req.headers, null, 2));
  console.log('   - Body length:', req.body ? req.body.length : 'no body');
  console.log('   - Body type:', typeof req.body);
  console.log('   - Raw body preview:', req.body ? req.body.toString().substring(0, 200) + '...' : 'no body');
  
  const sig = req.headers['stripe-signature'];
  if (sig) {
    console.log('   - Signature header:', sig);
    
    // Try to parse the signature header
    const sigElements = sig.split(',');
    console.log('   - Signature elements:', sigElements);
    
    // Try manual verification with detailed logging
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      console.log('   - Webhook secret preview:', process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.substring(0, 15) + '...' : 'none');
      
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      console.log('✅ DEBUG: Manual signature verification succeeded!');
      console.log('   - Event type:', event.type);
      console.log('   - Event ID:', event.id);
      
      res.json({ 
        success: true, 
        message: 'Debug webhook processed successfully',
        eventType: event.type,
        eventId: event.id
      });
    } catch (error) {
      console.error('❌ DEBUG: Manual signature verification failed:');
      console.error('   - Error:', error.message);
      console.error('   - Error type:', error.constructor.name);
      
      res.status(400).json({ 
        success: false, 
        error: error.message,
        errorType: error.constructor.name
      });
    }
  } else {
    console.error('❌ DEBUG: No signature header found');
    res.status(400).json({ 
      success: false, 
      error: 'No stripe-signature header' 
    });
  }
});

// Stripe webhook handler for payment completion
router.post('/stripe-webhook', express.raw({type: '*/*'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  console.log('🎯 Webhook received!');
  console.log('   - Signature header present:', !!sig);
  console.log('   - Signature preview:', sig ? sig.substring(0, 50) + '...' : 'none');
  console.log('   - Body exists:', !!req.body);
  console.log('   - Body length:', req.body ? req.body.length : 'no body');
  console.log('   - Body type:', typeof req.body);
  console.log('   - Body is Buffer:', Buffer.isBuffer(req.body));
  console.log('   - Content-Type:', req.headers['content-type']);
  console.log('   - User-Agent:', req.headers['user-agent']);
  console.log('   - Webhook secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('   - Webhook secret preview:', process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.substring(0, 15) + '...' : 'none');
  
  try {
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    let paymentHandler = req.app.get('paymentHandler');
    
    if (!paymentHandler) {
      try {
        // Lazy initialization fallback for serverless
        paymentHandler = new PaymentHandler(dbClient);
        req.app.set('paymentHandler', paymentHandler);
        console.log('✅ Payment system lazy-initialized for webhook');
      } catch (error) {
        console.error('❌ Failed to initialize payment system for webhook:', error);
        return res.status(500).send('Payment system error');
      }
    }

    if (!sig) {
      console.error('❌ No stripe-signature header found');
      return res.status(400).send('Missing stripe-signature header');
    }

    if (!req.body) {
      console.error('❌ No body received');
      return res.status(400).send('Missing request body');
    }

    // Enhanced signature verification with better error handling
    let event;
    try {
      console.log('🔐 Attempting webhook signature verification...');
      console.log('   - Payload type before verification:', typeof req.body);
      console.log('   - Payload is Buffer before verification:', Buffer.isBuffer(req.body));
      
      // Ensure we have the right format for Stripe verification
      const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body, 'utf8');
      console.log('   - Using payload type:', typeof payload);
      console.log('   - Using payload is Buffer:', Buffer.isBuffer(payload));
      
      event = paymentHandler.verifyWebhookSignature(payload, sig);
      console.log('✅ Webhook signature verified successfully');
    } catch (sigError) {
      console.error('❌ Webhook signature verification failed:');
      console.error('   - Error type:', sigError.constructor.name);
      console.error('   - Error message:', sigError.message);
      console.error('   - Signature header:', sig);
      console.error('   - Body length:', req.body ? req.body.length : 'no body');
      console.error('   - Body preview:', req.body ? req.body.toString().substring(0, 100) + '...' : 'no body');
      
      // Try manual verification for debugging
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        console.log('🔍 Attempting manual verification...');
        
        // Ensure we have the right format for manual verification too
        const manualPayload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body, 'utf8');
        console.log('   - Manual payload type:', typeof manualPayload);
        console.log('   - Manual payload is Buffer:', Buffer.isBuffer(manualPayload));
        
        const manualEvent = stripe.webhooks.constructEvent(manualPayload, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log('✅ Manual verification succeeded - there might be an issue with paymentHandler');
        event = manualEvent;
      } catch (manualError) {
        console.error('❌ Manual verification also failed:', manualError.message);
        return res.status(400).send(`Webhook signature verification failed: ${sigError.message}`);
      }
    }
    
    console.log('🎉 Received Stripe webhook event:', event.type);
    console.log('   - Event ID:', event.id);
    console.log('   - Created:', new Date(event.created * 1000).toISOString());

    if (event.type === 'checkout.session.completed') {
      console.log('💳 Processing checkout.session.completed...');
      const session = event.data.object;
      console.log('   - Session ID:', session.id);
      console.log('   - Payment status:', session.payment_status);
      console.log('   - Metadata:', session.metadata);
      
      if (session.payment_status === 'paid') {
        await paymentHandler.handlePaymentSuccess(event);
        console.log('✅ Payment processed successfully');
      } else {
        console.log('⚠️ Payment not completed, status:', session.payment_status);
      }
    } else {
      console.log('ℹ️ Ignoring webhook event type:', event.type);
    }

    res.json({received: true});
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    console.error('   - Error type:', error.constructor.name);
    console.error('   - Error message:', error.message);
    console.error('   - Stack trace:', error.stack);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// =====================================
// STRIPE CONFIGURATION ENDPOINTS
// =====================================

// Serve Stripe configuration (publishable key)
router.get('/stripe-config', (req, res) => {
  console.log('🔧 Stripe config requested');
  console.log('🔧 STRIPE_PUBLISHABLE_KEY exists:', !!process.env.STRIPE_PUBLISHABLE_KEY);
  console.log('🔧 STRIPE_PUBLISHABLE_KEY length:', process.env.STRIPE_PUBLISHABLE_KEY ? process.env.STRIPE_PUBLISHABLE_KEY.length : 'undefined');
  
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_51RebwVCcC1QzMUzPGXPHYhVUH9rFLGzB8rNQkn9Lj4IVnuHB1Xz7uBZNWJkOdRl7xJnYqGfRXsKy8yQ9QZwMRKlx00yFpQZoJG';
  
  res.json({
    publishableKey: publishableKey
  });
});

// Create Stripe checkout session for credit purchase
router.post('/create-checkout-session', authenticateApiKey, async (req, res) => {
  try {
    const { credits, priceInCents, packageName } = req.body;
    
    if (!credits || !priceInCents || !packageName) {
      return res.status(400).json({ error: 'Missing required fields: credits, priceInCents, packageName' });
    }

    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    let paymentHandler = req.app.get('paymentHandler');
    
    if (!paymentHandler) {
      try {
        // Lazy initialization fallback for serverless
        paymentHandler = new PaymentHandler(dbClient);
        req.app.set('paymentHandler', paymentHandler);
        console.log('✅ Payment system lazy-initialized');
      } catch (error) {
        console.error('❌ Failed to initialize payment system:', error);
        return res.status(500).json({ error: 'Payment system not initialized', details: error.message });
      }
    }

    const session = await paymentHandler.createCheckoutSession(
      req.user, 
      credits, 
      priceInCents, 
      packageName
    );

    res.json(session);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

// =====================================
// WEBHOOK TEST ENDPOINTS
// =====================================

// Test endpoint to check if webhooks are reachable
router.post('/webhook-test', express.json(), (req, res) => {
  console.log('🧪 Webhook test endpoint hit!');
  console.log('   - Headers:', req.headers);
  console.log('   - Body:', req.body);
  res.json({ success: true, message: 'Webhook endpoint is reachable' });
});

// Simple webhook connectivity test
router.post('/webhook-ping', express.json(), (req, res) => {
  console.log('🏓 WEBHOOK PING received!');
  console.log('   - Timestamp:', new Date().toISOString());
  console.log('   - Headers:', req.headers);
  console.log('   - Body:', req.body);
  res.json({ 
    success: true, 
    message: 'Webhook endpoint is reachable',
    timestamp: new Date().toISOString()
  });
});

// Test any webhook endpoint
router.all('/webhook-test-all', (req, res) => {
  console.log('🧪 WEBHOOK TEST (ALL METHODS) received!');
  console.log('   - Method:', req.method);
  console.log('   - Headers:', req.headers);
  console.log('   - Body:', req.body);
  res.json({ 
    success: true, 
    method: req.method,
    message: 'Webhook endpoint is reachable via any method'
  });
});

// =====================================
// PAYMENT HISTORY ENDPOINTS
// =====================================

// Get payment history for current user
router.get('/my-payment-history', authenticateApiKey, async (req, res) => {
  try {
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    let paymentHandler = req.app.get('paymentHandler');
    
    if (!paymentHandler) {
      try {
        // Lazy initialization fallback for serverless
        paymentHandler = new PaymentHandler(dbClient);
        req.app.set('paymentHandler', paymentHandler);
        console.log('✅ Payment system lazy-initialized for history');
      } catch (error) {
        console.error('❌ Failed to initialize payment system for history:', error);
        return res.status(500).json({ error: 'Payment system not initialized', details: error.message });
      }
    }

    const { limit = 10 } = req.query;
    const history = await paymentHandler.getPaymentHistory(req.user.id, parseInt(limit));
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// =====================================
// CREDIT MANAGEMENT ENDPOINTS
// =====================================

// Manual credit addition endpoint (temporary for debugging webhook issues)
router.post('/debug/add-credits', authenticateApiKey, async (req, res) => {
  try {
    // Only allow admin users for safety
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { credits = 100, reason = 'Manual debug addition' } = req.body;
    
    console.log(`🔧 DEBUG: Manual credit addition - ${credits} credits for user ${req.user.username}`);
    
    // Get services from app-level dependency injection
    const userService = req.app.get('userService');
    const creditService = req.app.get('creditService');
    
    if (!userService || !creditService) {
      throw new Error('Services not available');
    }
    
    // Add credits to user account
    await userService.updateUserCredits(req.user.id, parseInt(credits));

    // Log the transaction
    await creditService.logTransaction(
      req.user.id,
      'debug_addition',
      parseInt(credits),
      reason
    );

    // Get updated balance
    const result = await userService.getUserCreditsBalance(req.user.id);
    
    const newBalance = result.rows[0].credits_remaining;
    console.log(`✅ DEBUG: Credits added successfully. New balance: ${newBalance}`);
    
    res.json({ 
      success: true, 
      creditsAdded: credits,
      newBalance: newBalance,
      message: `${credits} credits added successfully`
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits', details: error.message });
  }
});

// Manual credit refresh endpoint (temporary for debugging)
router.post('/debug/refresh-credits', authenticateApiKey, async (req, res) => {
  try {
    console.log('🔄 Manual credit refresh requested by:', req.user.username);
    
    // Get services from app-level dependency injection
    const userService = req.app.get('userService');
    
    if (!userService) {
      throw new Error('UserService not available');
    }
    
    // Get current user credits
    const result = await userService.getUserCreditsStats(req.user.id);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    console.log('💰 Current credits for', req.user.username + ':', user.credits_remaining);
    
    res.json({ 
      success: true,
      credits_remaining: user.credits_remaining,
      total_credits_purchased: user.total_credits_purchased,
      message: 'Credits refreshed successfully'
    });
    
  } catch (error) {
    console.error('Error refreshing credits:', error);
    res.status(500).json({ error: 'Failed to refresh credits' });
  }
});

// Free credits endpoint with simple code (no admin auth required)
router.post('/free-credits', async (req, res) => {
  try {
    const { username, code } = req.body;
    
    // Simple code check (you can change this code)
    if (code !== 'FREECREDITS2024') {
      return res.status(400).json({ error: 'Invalid code' });
    }
    
    // Get services from app-level dependency injection
    const userService = req.app.get('userService');
    const creditService = req.app.get('creditService');
    const dbClient = req.app.get('dbClient');
    
    if (!userService || !creditService || !dbClient) {
      throw new Error('Services not available');
    }
    
    // Find user
    const userResult = await userService.getUserWithCredits(username);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const creditsToGrant = 100; // Grant 100 credits

    // Check if user already used this code
    const existingGrant = await dbClient.query(
      'SELECT id FROM credit_transactions WHERE user_id = $1 AND notes = $2',
      [user.id, 'Free credits code: FREECREDITS2024']
    );

    if (existingGrant.rows.length > 0) {
      return res.status(400).json({ error: 'Code already used by this user' });
    }

    // Grant credits
    await userService.updateUserCredits(user.id, creditsToGrant);

    // Log transaction
    await creditService.logTransaction(
      user.id, 
      'grant', 
      creditsToGrant, 
      'Free credits code: FREECREDITS2024'
    );

    const newBalance = user.credits_remaining + creditsToGrant;

    console.log(`✅ Granted ${creditsToGrant} free credits to ${username} (new balance: ${newBalance})`);

    res.json({ 
      success: true,
      message: `🎉 Success! Granted ${creditsToGrant} free credits to ${username}`,
      newBalance: newBalance,
      creditsGranted: creditsToGrant
    });

  } catch (error) {
    console.error('Error granting free credits:', error);
    res.status(500).json({ error: 'Failed to grant free credits' });
  }
});

// Estimate cost for a request without making it
router.post('/estimate-cost', authenticateApiKey, async (req, res) => {
  try {
    const { prompt, model = 'claude-3-5-sonnet-20241022', estimatedOutputTokens } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get trackedAnthropic from app-level dependency injection
    const trackedAnthropic = req.app.get('trackedAnthropic');
    
    if (!trackedAnthropic) {
      throw new Error('TrackedAnthropic not available');
    }

    const estimate = trackedAnthropic.estimateCost(prompt, estimatedOutputTokens, model);
    
    res.json({
      ...estimate,
      creditsRequired: Math.ceil(estimate.totalCost * 100),
      userCreditsRemaining: req.user.credits_remaining,
      sufficient: req.user.credits_remaining >= Math.ceil(estimate.totalCost * 100)
    });
  } catch (error) {
    console.error('Error estimating cost:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// Get user's own stats
router.get('/my-stats', authenticateApiKey, async (req, res) => {
  try {
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    const usage = await dbClient.query(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
        AVG(input_tokens + output_tokens) as avg_tokens_per_request,
        MAX(timestamp) as last_request
      FROM usage_logs_v2 
      WHERE username = $1
    `, [req.user.username]);

    const recentUsage = await dbClient.query(`
      SELECT endpoint, COUNT(*) as count, SUM(total_cost) as total_cost
      FROM usage_logs_v2 
      WHERE username = $1 AND timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY endpoint
      ORDER BY count DESC
    `, [req.user.username]);

    res.json({
      user: {
        username: req.user.username,
        credits_remaining: req.user.credits_remaining,
        total_credits_purchased: req.user.total_credits_purchased
      },
      usage: usage.rows[0],
      recentUsage: recentUsage.rows
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// =====================================
// STATIC ROUTES
// =====================================

// Serve the buy credits page
router.get('/buy-credits', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'buy-credits.html'));
});

// Debug endpoint to check environment variables
router.get('/debug-env', authenticateApiKey, (req, res) => {
  // Only allow admin users
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  console.log('🔍 ENVIRONMENT DEBUG REQUEST');
  
  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: !!process.env.VERCEL,
    STRIPE_SECRET_KEY_EXISTS: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_SECRET_KEY_LENGTH: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.length : 0,
    STRIPE_SECRET_KEY_PREFIX: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 8) + '...' : 'none',
    STRIPE_PUBLISHABLE_KEY_EXISTS: !!process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_PUBLISHABLE_KEY_LENGTH: process.env.STRIPE_PUBLISHABLE_KEY ? process.env.STRIPE_PUBLISHABLE_KEY.length : 0,
    STRIPE_PUBLISHABLE_KEY_PREFIX: process.env.STRIPE_PUBLISHABLE_KEY ? process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 8) + '...' : 'none',
    STRIPE_WEBHOOK_SECRET_EXISTS: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_WEBHOOK_SECRET_LENGTH: process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.length : 0,
    STRIPE_WEBHOOK_SECRET_PREFIX: process.env.STRIPE_WEBHOOK_SECRET ? process.env.STRIPE_WEBHOOK_SECRET.substring(0, 8) + '...' : 'none',
    ALL_STRIPE_ENV_VARS: Object.keys(process.env).filter(key => key.startsWith('STRIPE_'))
  };
  
  console.log('Environment Debug Info:', envDebug);
  
  res.json(envDebug);
});

module.exports = router; 