/**
 * User Service
 * Centralized user management operations
 */

class UserService {
  constructor(dbClient) {
    this.dbClient = dbClient;
  }

  /**
   * Get user by username (most common pattern)
   * @param {string} username - Username to lookup
   * @returns {Promise<Object>} User data
   */
  async getUserByUsername(username) {
    try {
      const result = await this.dbClient.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      return result;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID to lookup
   * @returns {Promise<Object>} User data
   */
  async getUserById(userId) {
    try {
      const result = await this.dbClient.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      return result;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user with basic info only (id, username, email)
   * @param {string} username - Username to lookup
   * @returns {Promise<Object>} Basic user data
   */
  async getUserBasicInfo(username) {
    try {
      const result = await this.dbClient.query(
        'SELECT id, username, email FROM users WHERE username = $1',
        [username]
      );
      return result;
    } catch (error) {
      console.error('Error getting user basic info:', error);
      throw error;
    }
  }

  /**
   * Get user with credits information
   * @param {string} username - Username to lookup
   * @returns {Promise<Object>} User data with credits
   */
  async getUserWithCredits(username) {
    try {
      const result = await this.dbClient.query(
        'SELECT id, username, credits_remaining FROM users WHERE username = $1',
        [username]
      );
      return result;
    } catch (error) {
      console.error('Error getting user with credits:', error);
      throw error;
    }
  }

  /**
   * Get user credits balance by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Credits balance data
   */
  async getUserCreditsBalance(userId) {
    try {
      const result = await this.dbClient.query(
        'SELECT credits_remaining FROM users WHERE id = $1',
        [userId]
      );
      return result;
    } catch (error) {
      console.error('Error getting user credits balance:', error);
      throw error;
    }
  }

  /**
   * Get user credits balance and total purchased
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Credits data with totals
   */
  async getUserCreditsStats(userId) {
    try {
      const result = await this.dbClient.query(
        'SELECT credits_remaining, total_credits_purchased FROM users WHERE id = $1',
        [userId]
      );
      return result;
    } catch (error) {
      console.error('Error getting user credits stats:', error);
      throw error;
    }
  }

  /**
   * Check if user exists by ID (lightweight check)
   * @param {number} userId - User ID to check
   * @returns {Promise<Object>} Username if exists
   */
  async checkUserExists(userId) {
    try {
      const result = await this.dbClient.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      return result;
    } catch (error) {
      console.error('Error checking user exists:', error);
      throw error;
    }
  }

  /**
   * Get user with admin privileges check
   * @param {string} username - Username to lookup
   * @returns {Promise<Object>} User data with admin status
   */
  async getUserWithAdminStatus(username) {
    try {
      const result = await this.dbClient.query(
        'SELECT id, username, is_admin FROM users WHERE username = $1',
        [username]
      );
      return result;
    } catch (error) {
      console.error('Error getting user with admin status:', error);
      throw error;
    }
  }

  /**
   * Get first admin user (for system operations)
   * @returns {Promise<Object>} Admin user data
   */
  async getFirstAdminUser() {
    try {
      const result = await this.dbClient.query(
        'SELECT username, api_key, is_admin FROM users WHERE is_admin = TRUE LIMIT 1'
      );
      return result;
    } catch (error) {
      console.error('Error getting first admin user:', error);
      throw error;
    }
  }

  /**
   * Get admin username (lightweight check)
   * @returns {Promise<Object>} Admin username
   */
  async getAdminUsername() {
    try {
      const result = await this.dbClient.query(
        'SELECT username FROM users WHERE is_admin = TRUE LIMIT 1'
      );
      return result;
    } catch (error) {
      console.error('Error getting admin username:', error);
      throw error;
    }
  }

  /**
   * List all users (for admin management)
   * @returns {Promise<Object>} All users data
   */
  async listAllUsers() {
    try {
      const result = await this.dbClient.query(`
        SELECT id, username, email, credits_remaining, is_admin, created_at
        FROM users 
        ORDER BY created_at DESC
      `);
      return result;
    } catch (error) {
      console.error('Error listing all users:', error);
      throw error;
    }
  }

  /**
   * Update user credits
   * @param {number} userId - User ID
   * @param {number} creditsToAdd - Credits to add (can be negative)
   * @returns {Promise<Object>} Update result
   */
  async updateUserCredits(userId, creditsToAdd) {
    try {
      const result = await this.dbClient.query(
        'UPDATE users SET credits_remaining = credits_remaining + $1 WHERE id = $2',
        [creditsToAdd, userId]
      );
      return result;
    } catch (error) {
      console.error('Error updating user credits:', error);
      throw error;
    }
  }

  /**
   * Delete user and all related data (CASCADE operation)
   * @param {number} userId - User ID to delete
   * @returns {Promise<Object>} Deletion results
   */
  async deleteUserCompletely(userId) {
    try {
      // Delete in order to respect foreign key constraints
      const results = {};
      
      // Delete credit transactions
      results.creditTransactions = await this.dbClient.query(
        'DELETE FROM credit_transactions WHERE user_id = $1', 
        [userId]
      );
      
      // Delete user projects
      results.userProjects = await this.dbClient.query(
        'DELETE FROM user_projects WHERE user_id = $1', 
        [userId]
      );
      
      // Delete usage logs
      results.usageLogs = await this.dbClient.query(
        'DELETE FROM usage_logs_v2 WHERE user_id = $1', 
        [userId]
      );
      
      // Finally delete user
      results.user = await this.dbClient.query(
        'DELETE FROM users WHERE id = $1', 
        [userId]
      );
      
      return results;
    } catch (error) {
      console.error('Error deleting user completely:', error);
      throw error;
    }
  }

  /**
   * Get user usage statistics
   * @param {number} userId - User ID
   * @param {number} days - Number of days to analyze (default 7)
   * @returns {Promise<Object>} Usage statistics
   */
  async getUserUsageStats(userId, days = 7) {
    try {
      const result = await this.dbClient.query(`
        SELECT 
          COUNT(*) as total_requests,
          COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) as total_tokens,
          COALESCE(SUM(total_cost), 0) as total_cost,
          ROUND(AVG(CASE WHEN success = true THEN 1 ELSE 0 END) * 100, 1) as success_rate
        FROM usage_logs_v2 
        WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
      `, [userId]);
      return result;
    } catch (error) {
      console.error('Error getting user usage stats:', error);
      throw error;
    }
  }

  /**
   * Get recent user activity
   * @param {number} userId - User ID
   * @param {number} limit - Number of recent activities (default 10)
   * @returns {Promise<Object>} Recent activity data
   */
  async getUserRecentActivity(userId, limit = 10) {
    try {
      const result = await this.dbClient.query(`
        SELECT endpoint, timestamp, success, total_cost, project_path
        FROM usage_logs_v2 
        WHERE user_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [userId, limit]);
      return result;
    } catch (error) {
      console.error('Error getting user recent activity:', error);
      throw error;
    }
  }
}

module.exports = UserService; 