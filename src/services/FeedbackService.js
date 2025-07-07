const { Client } = require('pg');

class FeedbackService {
  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    this.connected = false;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
      console.log('✅ FeedbackService connected to database');
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }

  // Create new feedback
  async createFeedback(userId, category, message, pageUrl) {
    try {
      await this.connect();
      
      const result = await this.client.query(
        `INSERT INTO feedback (user_id, category, message, page_url, created_at) 
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [userId, category, message, pageUrl]
      );
      
      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error) {
      console.error('Error creating feedback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get all feedback for admin dashboard
  async getAllFeedback(filters = {}) {
    try {
      await this.connect();
      
      let query = `
        SELECT 
          f.id,
          f.category,
          f.message,
          f.page_url,
          f.created_at,
          u.username
        FROM feedback f
        LEFT JOIN users u ON f.user_id = u.id
      `;
      
      const params = [];
      const conditions = [];
      
      // Add category filter if provided
      if (filters.category && filters.category !== 'all') {
        conditions.push(`f.category = $${params.length + 1}`);
        params.push(filters.category);
      }
      
      // Add WHERE clause if we have conditions
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY f.created_at DESC';
      
      const result = await this.client.query(query, params);
      
      return {
        success: true,
        data: result.rows
      };
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get feedback stats for admin dashboard
  async getFeedbackStats() {
    try {
      await this.connect();
      
      const result = await this.client.query(`
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(*) FILTER (WHERE category = 'general') as general_feedback,
          COUNT(*) FILTER (WHERE category = 'bug') as bug_reports,
          COUNT(*) FILTER (WHERE category = 'feature') as feature_requests,
          COUNT(*) FILTER (WHERE category = 'other') as other_feedback,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_feedback
        FROM feedback
      `);
      
      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error) {
      console.error('Error fetching feedback stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete feedback (admin only)
  async deleteFeedback(feedbackId) {
    try {
      await this.connect();
      
      const result = await this.client.query(
        'DELETE FROM feedback WHERE id = $1 RETURNING *',
        [feedbackId]
      );
      
      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error) {
      console.error('Error deleting feedback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = FeedbackService; 