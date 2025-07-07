const express = require('express');
const router = express.Router();

// Import authentication middleware
const { authenticateApiKey, rateLimit } = require('../middleware/auth');

// Import FeedbackService
const FeedbackService = require('../src/services/FeedbackService');

// =====================================
// FEEDBACK ROUTES
// =====================================

// Submit feedback (requires authentication)
router.post('/submit', authenticateApiKey, rateLimit, async (req, res) => {
  try {
    const feedbackService = new FeedbackService();
    
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
    
    console.log(`📝 New feedback submission from user ${userId} (${req.user.username})`);
    
    // Create feedback
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