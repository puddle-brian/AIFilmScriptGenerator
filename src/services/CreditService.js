class CreditService {
  constructor(dbClient, logger = console) {
    this.db = dbClient;
    this.logger = logger;
  }

  // Calculate estimated cost for different operations
  estimateCost(operation, inputText = '', modelName = 'claude-3-5-sonnet-20241022') {
    const costs = {
      'generate-structure': 10,
      'generate-plot-points': 5,
      'generate-scenes': 8,
      'generate-dialogue': 3,
      'genie-suggestion': 2
    };

    return costs[operation] || 5; // Default cost
  }

  // Check if user has sufficient credits
  async checkCredits(username, estimatedCost) {
    try {
      const result = await this.db.query(
        'SELECT credits_remaining FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return { hasCredits: false, message: 'User not found' };
      }

      const creditsRemaining = result.rows[0].credits_remaining;
      const hasCredits = creditsRemaining >= estimatedCost;

      return {
        hasCredits,
        creditsRemaining,
        estimatedCost,
        message: hasCredits ? 'Sufficient credits' : 'Insufficient credits'
      };

    } catch (error) {
      this.logger.error('Error checking credits:', error);
      return { hasCredits: false, message: 'Error checking credits' };
    }
  }

  // Deduct credits after successful operation
  async deductCredits(username, actualCost, operation) {
    try {
      const result = await this.db.query(
        'UPDATE users SET credits_remaining = credits_remaining - $1 WHERE username = $2 RETURNING credits_remaining',
        [actualCost, username]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const newBalance = result.rows[0].credits_remaining;
      this.logger.log(`💳 Deducted ${actualCost} credits for ${operation}. New balance: ${newBalance}`);

      return {
        success: true,
        newBalance,
        deductedAmount: actualCost
      };

    } catch (error) {
      this.logger.error('Error deducting credits:', error);
      throw error;
    }
  }

  // Log usage for analytics
  async logUsage(username, operation, cost, success = true, errorMessage = null) {
    try {
      const userResult = await this.db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length === 0) return;

      const userId = userResult.rows[0].id;

      await this.db.query(`
        INSERT INTO usage_logs (user_id, endpoint, method, tokens_used, credits_cost, response_success, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [userId, operation, 'POST', 100, cost, success, errorMessage]);

    } catch (error) {
      this.logger.error('Error logging usage:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Log credit transaction to database
   * @param {number} userId - User ID
   * @param {string} transactionType - Type of transaction (grant, debug_addition, etc.)
   * @param {number} creditsAmount - Amount of credits
   * @param {string} notes - Transaction notes
   * @param {number} createdBy - User ID of who created the transaction (optional)
   * @returns {Promise<Object>} Insert result
   */
  async logTransaction(userId, transactionType, creditsAmount, notes, createdBy = null) {
    try {
      const result = await this.db.query(`
        INSERT INTO credit_transactions (
          user_id, transaction_type, credits_amount, notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [userId, transactionType, creditsAmount, notes, createdBy]);

      this.logger.log(`💳 Logged transaction: ${transactionType} ${creditsAmount} credits for user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error('Error logging credit transaction:', error);
      throw error;
    }
  }
}

module.exports = CreditService; 