const express = require('express');
const router = express.Router();

// Import authentication middleware
const { authenticateApiKey, rateLimit } = require('../middleware/auth');

// Import FeedbackService
const FeedbackService = require('../src/services/FeedbackService');

// Middleware to inject dependencies from app
router.use((req, res, next) => {
  req.dbClient = req.app.get('dbClient');
  req.feedbackService = req.app.get('feedbackService');
  next();
});

// Fallback feedback submission handler (when FeedbackService is unavailable)
async function handleSubmitFeedbackFallback(req, res, dbClient) {
  const { category, message } = req.body;
  const userId = req.user.id;
  const pageUrl = req.headers.referer || req.body.pageUrl || '';
  
  try {
    console.log(`🔄 Fallback feedback submission for user: ${userId} (${req.user.username})`);
    
    // Direct database insert when service unavailable
    const result = await dbClient.query(
      'INSERT INTO feedback (user_id, category, message, page_url, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, created_at',
      [userId, category, message, pageUrl]
    );
    
    const feedback = result.rows[0];
    
    console.log(`✅ Fallback feedback submitted successfully: ${feedback.id}`);
    
    res.status(201).json({
      message: 'Feedback submitted successfully',
      id: feedback.id,
      success: true,
      fallbackMode: true
    });
    
  } catch (error) {
    console.error('Fallback feedback submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit feedback. Please try again.',
      fallbackMode: true
    });
  }
}

// =====================================
// FEEDBACK ROUTES
// =====================================

// Submit feedback (requires authentication)
router.post('/submit', authenticateApiKey, rateLimit, async (req, res) => {
  try {
    // Get services from app-level dependency injection
    const feedbackService = req.app.get('feedbackService');
    const dbClient = req.app.get('dbClient');
    
    const { category, message } = req.body;
    const userId = req.user.id;
    const pageUrl = req.headers.referer || req.body.pageUrl || '';
    
    // Validate input
    if (!category || !message) {
      return res.status(400).json({ 
        error: 'Category and message are required' 
      });
    }
    
    // Validate category
    const validCategories = ['bug', 'feature', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category. Must be one of: bug, feature, other' 
      });
    }
    
    // Validate message length
    if (message.length > 1000) {
      return res.status(400).json({ 
        error: 'Message must be 1000 characters or less' 
      });
    }
    
    // Fallback to direct database access if FeedbackService unavailable
    if (!feedbackService && dbClient) {
      console.log('🔄 Using fallback feedback submission (direct database access)');
      return await handleSubmitFeedbackFallback(req, res, dbClient);
    }
    
    // If no services available at all
    if (!feedbackService && !dbClient) {
      console.log('⚠️ No feedback services available');
      return res.status(503).json({ 
        error: 'Feedback service temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }
    
    console.log(`📝 New feedback submission from user ${userId} (${req.user.username})`);
    
    // Use FeedbackService (primary path)
    const result = await feedbackService.createFeedback(userId, category, message, pageUrl);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    console.log(`✅ Feedback submitted successfully: ${result.data.id}`);
    
    res.status(201).json({
      message: 'Feedback submitted successfully',
      id: result.data.id,
      success: true
    });
    
  } catch (error) {
    console.error('Feedback submission error:', error);
    
    // Try fallback if primary method failed and database available
    if (req.app.get('dbClient')) {
      console.log('🔄 Primary feedback submission failed, trying fallback...');
      try {
        return await handleSubmitFeedbackFallback(req, res, req.app.get('dbClient'));
      } catch (fallbackError) {
        console.error('Fallback feedback submission also failed:', fallbackError);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to submit feedback. Please try again.' 
    });
  }
});

// Get feedback categories (for frontend dropdown)
router.get('/categories', (req, res) => {
  res.json({
    categories: [
      { value: 'bug', label: 'Bug Report' },
      { value: 'feature', label: 'Feature Request' },
      { value: 'other', label: 'Other' }
    ]
  });
});

module.exports = router; 