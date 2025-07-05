/**
 * Analytics Service
 * Centralized analytics operations for admin dashboard
 */

class AnalyticsService {
  constructor(dbClient) {
    this.dbClient = dbClient;
  }

  /**
   * Get daily usage analytics for dashboard charts
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} Daily usage data and endpoint breakdown
   */
  async getDailyUsageAnalytics(days = 1) {
    try {
      // Get daily usage data
      const dailyUsageResult = await this.dbClient.query(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as requests,
          COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) as tokens,
          COALESCE(SUM(total_cost), 0) as cost,
          ROUND(AVG(CASE WHEN success = true THEN 1 ELSE 0 END) * 100, 1) as success_rate
        FROM usage_logs_v2 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `);

      // Get endpoint data
      const endpointResult = await this.dbClient.query(`
        SELECT 
          endpoint,
          COUNT(*) as requests
        FROM usage_logs_v2 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY endpoint 
        ORDER BY requests DESC 
        LIMIT 6
      `);

      // Format daily usage data
      const dailyUsage = dailyUsageResult.rows.map(row => ({
        date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        requests: parseInt(row.requests) || 0,
        tokens: parseInt(row.tokens) || 0,
        cost: parseFloat(row.cost) || 0,
        successRate: parseFloat(row.success_rate) || 0,
        errorRate: 100 - (parseFloat(row.success_rate) || 0)
      }));

      // Format endpoint data
      const endpoints = endpointResult.rows.map(row => ({
        name: row.endpoint.replace('/api/', '').replace('generate-', ''),
        requests: parseInt(row.requests) || 0
      }));

      return {
        dailyUsage,
        endpoints
      };
    } catch (error) {
      console.error('Error getting daily usage analytics:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics for admin dashboard
   * @param {string} timeframe - Time period ('24h', '7d', '30d')
   * @returns {Promise<Object>} Complete analytics data
   */
  async getComprehensiveAnalytics(timeframe = '24h') {
    try {
      let interval;
      switch (timeframe) {
        case '24h': interval = '1 day'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '1 day';
      }

      const timeFilter = `WHERE timestamp >= NOW() - INTERVAL '${interval}'`;
      
      // Get all analytics in parallel for better performance
      const [requestsResult, tokensResult, errorResult, endpointsResult] = await Promise.all([
        this.getTotalRequests(timeFilter),
        this.getTokensAndCost(timeFilter),
        this.getErrorRate(timeFilter),
        this.getTopEndpoints(timeFilter)
      ]);

      const totalCalls = parseInt(errorResult.totalCalls) || 0;
      const errorCalls = parseInt(errorResult.errorCalls) || 0;
      const errorRate = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 100 * 10) / 10 : 0;

      return {
        totalRequests: parseInt(requestsResult.totalRequests) || 0,
        totalTokens: parseInt(tokensResult.totalTokens) || 0,
        totalCost: parseFloat(tokensResult.totalCost) || 0,
        errorRate: errorRate,
        topEndpoints: endpointsResult.map(row => ({
          endpoint: row.endpoint,
          requests: parseInt(row.request_count),
          tokens: parseInt(row.total_tokens),
          cost: parseFloat(row.total_cost),
          successRate: parseFloat(row.success_rate)
        }))
      };
    } catch (error) {
      console.error('Error getting comprehensive analytics:', error);
      throw error;
    }
  }

  /**
   * Get total requests for a time period
   * @param {string} timeFilter - SQL WHERE clause for time filtering
   * @returns {Promise<Object>} Total requests data
   */
  async getTotalRequests(timeFilter) {
    const result = await this.dbClient.query(`
      SELECT COUNT(*) as total_requests 
      FROM usage_logs_v2 
      ${timeFilter}
    `);
    return { totalRequests: result.rows[0].total_requests };
  }

  /**
   * Get tokens and cost analytics for a time period
   * @param {string} timeFilter - SQL WHERE clause for time filtering
   * @returns {Promise<Object>} Tokens and cost data
   */
  async getTokensAndCost(timeFilter) {
    const result = await this.dbClient.query(`
      SELECT 
        COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM usage_logs_v2 
      ${timeFilter}
    `);
    return {
      totalTokens: result.rows[0].total_tokens,
      totalCost: result.rows[0].total_cost
    };
  }

  /**
   * Get error rate analytics for a time period
   * @param {string} timeFilter - SQL WHERE clause for time filtering
   * @returns {Promise<Object>} Error rate data
   */
  async getErrorRate(timeFilter) {
    const result = await this.dbClient.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN success = false THEN 1 END) as error_calls
      FROM usage_logs_v2 
      ${timeFilter}
    `);
    return {
      totalCalls: result.rows[0].total_calls,
      errorCalls: result.rows[0].error_calls
    };
  }

  /**
   * Get top endpoints analytics for a time period
   * @param {string} timeFilter - SQL WHERE clause for time filtering
   * @returns {Promise<Array>} Top endpoints data
   */
  async getTopEndpoints(timeFilter) {
    const result = await this.dbClient.query(`
      SELECT 
        endpoint,
        COUNT(*) as request_count,
        COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        ROUND(AVG(CASE WHEN success = true THEN 1 ELSE 0 END) * 100, 1) as success_rate
      FROM usage_logs_v2 
      ${timeFilter}
      GROUP BY endpoint 
      ORDER BY request_count DESC 
      LIMIT 10
    `);
    return result.rows;
  }

  /**
   * Get database table structure for debugging
   * @returns {Promise<Array>} Table structure information
   */
  async getUsageLogsTableStructure() {
    const result = await this.dbClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'usage_logs_v2'
      ORDER BY ordinal_position
    `);
    return result.rows;
  }
}

module.exports = AnalyticsService; 