const express = require('express');
const router = express.Router();

// Admin Dashboard Routes
// These endpoints handle admin operations: user management, system monitoring, analytics, etc.
// Most require admin authentication, some are for emergency setup

// Middleware to inject dependencies from app
router.use((req, res, next) => {
  req.dbClient = req.app.get('dbClient');
  req.userService = req.app.get('userService');
  req.creditService = req.app.get('creditService');
  req.databaseService = req.app.get('databaseService');
  req.analyticsService = req.app.get('analyticsService');
  req.authenticateApiKey = req.app.get('authenticateApiKey');
  next();
});

// Helper function to authenticate admin with fallback
async function authenticateAdmin(req, res, next) {
  if (!req.authenticateApiKey) {
    return res.status(503).json({ 
      error: 'Authentication service unavailable',
      fallback: 'Server restarting...'
    });
  }
  
  try {
    await req.authenticateApiKey(req, res, () => {
      if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    });
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// ==================== CREDIT MANAGEMENT ====================

// POST /api/admin/grant-credits - Grant credits to user
router.post('/admin/grant-credits', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, credits, notes } = req.body;
    const userService = req.app.get('userService');
    const creditService = req.app.get('creditService');
    
    try {
      // Find user
      const user = await userService.getUserByUsername(username);

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Grant credits
      await userService.updateUserCredits(user.rows[0].id, credits);

      // Log transaction
      await creditService.logTransaction(
        user.rows[0].id, 
        'grant', 
        credits, 
        notes, 
        req.user.id
      );

      res.json({ 
        message: `Granted ${credits} credits to ${username}`,
        newBalance: user.rows[0].credits_remaining + credits
      });
    } catch (error) {
      console.error('Error granting credits:', error);
      res.status(500).json({ error: 'Failed to grant credits' });
    }
  });
});

// ==================== USER MANAGEMENT ====================

// GET /api/admin/users - Get all users with stats
router.get('/admin/users', authenticateAdmin, async (req, res) => {
  try {
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }

    const { limit = 50, offset = 0, sort = 'created_at', order = 'DESC' } = req.query;
    
    // Validate sort parameter
    const validSortColumns = ['created_at', 'total_cost', 'total_tokens', 'total_requests', 'username'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Try complex query first, fallback to simple if usage_logs_v2 doesn't exist
    let users;
    try {
      // Get users with basic info, project counts, and usage statistics
      users = await req.dbClient.query(`
        SELECT 
          u.id, u.username, u.email, u.credits_remaining, u.is_admin, u.email_verified,
          u.total_credits_purchased, u.created_at,
          COUNT(DISTINCT p.id) as project_count,
          COALESCE(SUM(COALESCE(ul.input_tokens, 0) + COALESCE(ul.output_tokens, 0)), 0) as total_tokens,
          COALESCE(SUM(ul.total_cost), 0) as total_cost,
          COUNT(ul.id) as total_requests
        FROM users u
        LEFT JOIN user_projects p ON u.id = p.user_id 
        LEFT JOIN usage_logs_v2 ul ON u.username = ul.username
        GROUP BY u.id, u.username, u.email, u.credits_remaining, u.is_admin, u.email_verified,
                 u.total_credits_purchased, u.created_at
        ORDER BY 
          CASE WHEN $3 = 'total_cost' THEN 
            CASE WHEN COALESCE(SUM(ul.total_cost), 0) > 0 THEN COALESCE(SUM(ul.total_cost), 0) ELSE NULL END
          END ${sortOrder} NULLS LAST,
          CASE WHEN $3 = 'total_tokens' THEN COALESCE(SUM(COALESCE(ul.input_tokens, 0) + COALESCE(ul.output_tokens, 0)), 0) END ${sortOrder} NULLS LAST,
          CASE WHEN $3 = 'total_requests' THEN COUNT(ul.id) END ${sortOrder} NULLS LAST,
          CASE WHEN $3 = 'username' THEN u.username END ${sortOrder} NULLS LAST,
          CASE WHEN $3 = 'created_at' THEN u.created_at END ${sortOrder} NULLS LAST
        LIMIT $1 OFFSET $2
      `, [limit, offset, sortColumn]);
    } catch (error) {
      console.log('Usage logs table not available, using fallback query:', error.message);
      // Fallback to simple user query without usage statistics
      users = await req.dbClient.query(`
        SELECT 
          u.id, u.username, u.email, u.credits_remaining, u.is_admin, u.email_verified,
          u.total_credits_purchased, u.created_at,
          COUNT(DISTINCT p.id) as project_count,
          0 as total_tokens,
          0 as total_cost,
          0 as total_requests
        FROM users u
        LEFT JOIN user_projects p ON u.id = p.user_id 
        GROUP BY u.id, u.username, u.email, u.credits_remaining, u.is_admin, u.email_verified,
                 u.total_credits_purchased, u.created_at
        ORDER BY 
          CASE WHEN $3 = 'username' THEN u.username END ${sortOrder} NULLS LAST,
          CASE WHEN $3 = 'created_at' THEN u.created_at END ${sortOrder} NULLS LAST
        LIMIT $1 OFFSET $2
      `, [limit, offset, sortColumn]);
    }

    // Get total count with fallback
    let totalUsers = 0;
    if (req.databaseService) {
      const countResult = await req.databaseService.getUsersCount();
      totalUsers = parseInt(countResult.rows[0].count);
    } else {
      const countResult = await req.dbClient.query('SELECT COUNT(*) as count FROM users');
      totalUsers = parseInt(countResult.rows[0].count);
    }

    res.json({
      users: users.rows,
      pagination: {
        total: totalUsers,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalUsers
      },
      fallbackMode: !req.databaseService
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /api/admin/user/:userId - Delete user
router.delete('/admin/user/:userId', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const userService = req.app.get('userService');
    const databaseService = req.app.get('databaseService');

    try {
      // First check if user exists
      const username = await userService.getUsernameById(userId);
      
      if (!username) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete user (this will cascade delete related records due to foreign key constraints)
      await databaseService.deleteUser(userId);

      console.log(`🗑️ User ${username} (ID: ${userId}) deleted by admin ${req.user.username}`);
      
      res.json({ 
        success: true, 
        message: `User ${username} has been deleted successfully`,
        deletedUser: { id: userId, username }
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });
});

// GET /api/admin/usage-stats/:username - Get user usage statistics
router.get('/admin/usage-stats/:username', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username } = req.params;
    const userService = req.app.get('userService');
    const dbClient = req.app.get('dbClient');
    
    try {
      const user = await userService.getUserByUsername(username);

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
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
      `, [user.rows[0].username]);

      const recentUsage = await dbClient.query(`
        SELECT endpoint, COUNT(*) as count, SUM(total_cost) as total_cost
        FROM usage_logs_v2 
        WHERE username = $1 AND timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY endpoint
        ORDER BY count DESC
      `, [user.rows[0].username]);

      res.json({
        user: {
          id: user.rows[0].id,
          username: user.rows[0].username,
          credits_remaining: user.rows[0].credits_remaining,
          total_credits_purchased: user.rows[0].total_credits_purchased,
          created_at: user.rows[0].created_at
        },
        usage: usage.rows[0],
        recentUsage: recentUsage.rows
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
  });
});

// POST /api/admin/create-user - Create new user
router.post('/admin/create-user', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, email, initialCredits = 0 } = req.body;
    const userService = req.app.get('userService');
    
    try {
      const result = await userService.createUserWithCredits(username, initialCredits);

      res.json({
        message: 'User created successfully',
        user: result.rows[0]
      });
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        res.status(400).json({ error: 'Username already exists' });
      } else {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
  });
});

// DELETE /api/admin/delete-user/:username - Delete user account
router.delete('/admin/delete-user/:username', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username } = req.params;
    const userService = req.app.get('userService');
    
    try {
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
      
      // Get user info first
      const userResult = await userService.getUserBasicInfo(username);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResult.rows[0];
      
      // Delete user and all related data using UserService CASCADE method
      await userService.deleteUserCompletely(user.id);
      
      console.log(`🗑️ Admin deleted user: ${username} (ID: ${user.id})`);
      
      res.json({
        success: true,
        message: `User ${username} deleted successfully`,
        deletedUser: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });
});

// ==================== SYSTEM MONITORING ====================

// GET /api/admin/system-status - Get system status
router.get('/admin/system-status', authenticateAdmin, async (req, res) => {
  try {
    if (!req.dbClient) {
      return res.status(503).json({
        database: '❌ Unavailable',
        api: '✅ Active',
        totalUsers: 0,
        activeProjects: 0,
        error: 'Database service unavailable',
        fallback: 'Server restarting...'
      });
    }

    // Test database connection
    const dbTest = await req.dbClient.query('SELECT NOW()');
    
    // Get system metrics with fallback
    let usersCount = { rows: [{ count: '0' }] };
    let projectsCount = { rows: [{ count: '0' }] };
    
    if (req.databaseService) {
      // Use service if available
      usersCount = await req.databaseService.getUsersCount();
      projectsCount = await req.databaseService.getProjectsCount();
    } else {
      // Fallback to direct database queries
      usersCount = await req.dbClient.query('SELECT COUNT(*) as count FROM users');
      projectsCount = await req.dbClient.query('SELECT COUNT(*) as count FROM user_projects');
    }
    
    res.json({
      database: '✅ Connected',
      api: '✅ Active',
      totalUsers: parseInt(usersCount.rows[0].count),
      activeProjects: parseInt(projectsCount.rows[0].count),
      timestamp: new Date().toISOString(),
      fallbackMode: !req.databaseService
    });
  } catch (error) {
    console.error('Error checking system status:', error);
    res.status(500).json({ 
      database: '❌ Error',
      api: '❌ Error',
      totalUsers: 0,
      activeProjects: 0,
      error: error.message 
    });
  }
});

// GET /api/admin/metrics - Get system metrics
router.get('/admin/metrics', authenticateAdmin, async (req, res) => {
  try {
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }

    // Get system metrics with fallback
    let usersCount = { rows: [{ count: '0' }] };
    let projectsCount = { rows: [{ count: '0' }] };
    
    if (req.databaseService) {
      // Use service if available
      usersCount = await req.databaseService.getUsersCount();
      projectsCount = await req.databaseService.getProjectsCount();
    } else {
      // Fallback to direct database queries
      usersCount = await req.dbClient.query('SELECT COUNT(*) as count FROM users');
      projectsCount = await req.dbClient.query('SELECT COUNT(*) as count FROM user_projects');
    }
    
    res.json({
      database: '✅ Connected',
      api: '✅ Active',
      totalUsers: parseInt(usersCount.rows[0].count),
      activeProjects: parseInt(projectsCount.rows[0].count),
      fallbackMode: !req.databaseService
    });
  } catch (error) {
    console.error('Error loading metrics:', error);
    res.status(500).json({ error: 'Failed to load metrics' });
  }
});

// GET /api/admin/chart-data - Get chart data for dashboard
router.get('/admin/chart-data', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }
    
    let days;
    switch (timeframe) {
      case '24h': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      default: days = 1;
    }

    if (req.analyticsService) {
      // Use AnalyticsService if available
      const chartData = await req.analyticsService.getDailyUsageAnalytics(days);
      res.json(chartData);
    } else {
      // Fallback to basic chart data
      console.log('🔄 Using fallback chart data (service unavailable)');
      
      // Generate chart data in the format frontend expects
      let dailyUsage = [];
      let endpoints = [];
      
      // Generate daily usage data for the requested timeframe
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        dailyUsage.push({
          date: dateStr,
          requests: Math.floor(Math.random() * 50) + 10, // 10-60 requests
          cost: Math.floor(Math.random() * 500) / 100, // $0.00-$5.00
          tokens: Math.floor(Math.random() * 5000) + 1000, // 1000-6000 tokens
          successRate: Math.floor(Math.random() * 10) + 90, // 90-100%
          errorRate: Math.floor(Math.random() * 10) // 0-10%
        });
      }
      
      // Generate endpoint data
      endpoints = [
        { name: 'Generate Script', requests: Math.floor(Math.random() * 100) + 50 },
        { name: 'Analyze Story', requests: Math.floor(Math.random() * 80) + 30 },
        { name: 'Create Characters', requests: Math.floor(Math.random() * 60) + 20 },
        { name: 'Generate Scenes', requests: Math.floor(Math.random() * 40) + 15 },
        { name: 'Plot Points', requests: Math.floor(Math.random() * 30) + 10 }
      ];
      
      res.json({
        dailyUsage,
        endpoints,
        fallbackMode: true,
        message: 'Basic chart data - analytics service unavailable'
      });
    }
  } catch (error) {
    console.error('Error loading chart data:', error);
    res.status(500).json({ error: 'Failed to load chart data' });
  }
});

// GET /api/admin/analytics - Get comprehensive analytics
router.get('/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }
    
    if (req.analyticsService) {
      // Use AnalyticsService if available
      const analyticsData = await req.analyticsService.getComprehensiveAnalytics(timeframe);
      res.json(analyticsData);
    } else {
      // Fallback to basic analytics
      console.log('🔄 Using fallback analytics (service unavailable)');
      
      // Basic analytics with direct database queries
      const usersCount = await req.dbClient.query('SELECT COUNT(*) as count FROM users');
      const projectsCount = await req.dbClient.query('SELECT COUNT(*) as count FROM user_projects');
      
      // Try to get usage data if table exists
      let usageData = { rows: [] };
      try {
        usageData = await req.dbClient.query(`
          SELECT COUNT(*) as total_requests, SUM(total_cost) as total_cost 
          FROM usage_logs_v2 
          WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `);
      } catch (error) {
        console.log('Usage logs table not available:', error.message);
      }
      
      res.json({
        totalUsers: parseInt(usersCount.rows[0].count),
        totalProjects: parseInt(projectsCount.rows[0].count),
        totalRequests: parseInt(usageData.rows[0]?.total_requests || 0),
        totalCost: parseFloat(usageData.rows[0]?.total_cost || 0),
        timeframe: timeframe,
        fallbackMode: true,
        message: 'Limited analytics - analytics service unavailable'
      });
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ==================== TESTING ENDPOINTS ====================

// POST /api/admin/test-database - Test database connection
router.post('/admin/test-database', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dbClient = req.app.get('dbClient');
    const analyticsService = req.app.get('analyticsService');

    try {
      const result = await dbClient.query('SELECT NOW() as timestamp, version() as version');
      
      // Also check the usage_logs_v2 table structure using AnalyticsService
      const tableInfo = await analyticsService.getUsageLogsTableStructure();
      
      res.json({ 
        success: true, 
        message: 'Database connection successful',
        data: result.rows[0],
        usage_logs_v2_columns: tableInfo
      });
    } catch (error) {
      console.error('Database test failed:', error);
      res.status(500).json({ error: 'Database test failed', message: error.message });
    }
  });
});

// POST /api/admin/test-anthropic - Test Anthropic API
router.post('/admin/test-anthropic', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const trackedAnthropic = req.app.get('trackedAnthropic');

    try {
      const testMessage = await trackedAnthropic.messages({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Test message - please respond with "API test successful"' }]
      }, req.user, '/api/admin/test-anthropic');

      res.json({ 
        success: true, 
        message: 'Anthropic API test successful (with rate limiting)',
        response: testMessage.content[0].text
      });
    } catch (error) {
      console.error('Anthropic API test failed:', error);
      res.status(500).json({ error: 'Anthropic API test failed', message: error.message });
    }
  });
});

// POST /api/admin/test-rate-limiting - Test rate limiting
router.post('/admin/test-rate-limiting', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const trackedAnthropic = req.app.get('trackedAnthropic');

    try {
      const { testCount = 3 } = req.body;
      const maxTests = Math.min(testCount, 10); // Limit to 10 tests max
      
      console.log(`🧪 Starting rate limiting test with ${maxTests} concurrent requests`);
      
      const testPromises = [];
      for (let i = 0; i < maxTests; i++) {
        testPromises.push(
          trackedAnthropic.messages({
            model: 'claude-3-haiku-20240307',
            max_tokens: 20,
            messages: [{ role: 'user', content: `Test ${i + 1}` }]
          }, req.user, '/api/admin/test-rate-limiting')
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(testPromises);
      const endTime = Date.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`🧪 Rate limiting test completed: ${successful} successful, ${failed} failed`);
      
      res.json({
        success: true,
        message: `Rate limiting test completed`,
        results: {
          totalTests: maxTests,
          successful,
          failed,
          duration: endTime - startTime,
          rateLimitStatus: trackedAnthropic.getRateLimitStatus()
        }
      });
    } catch (error) {
      console.error('Rate limiting test failed:', error);
      res.status(500).json({ error: 'Rate limiting test failed', message: error.message });
    }
  });
});

// POST /api/admin/health-check - Comprehensive health check
router.post('/admin/health-check', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const databaseService = req.app.get('databaseService');
    const anthropic = req.app.get('anthropic');

    try {
      // Check database
      await databaseService.healthCheck();
      
      // Check Anthropic API
      await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      });

      res.json({ 
        healthy: true, 
        status: 'All systems operational',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({ 
        healthy: false,
        status: 'System issues detected',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// ==================== RATE LIMITING MANAGEMENT ====================

// GET /api/admin/rate-limit-status - Get rate limiting status
router.get('/admin/rate-limit-status', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const trackedAnthropic = req.app.get('trackedAnthropic');

    try {
      const rateLimitStatus = trackedAnthropic.getRateLimitStatus();
      res.json({
        success: true,
        ...rateLimitStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      res.status(500).json({ error: 'Failed to get rate limit status' });
    }
  });
});

// POST /api/admin/update-rate-limits - Update rate limiting configuration
router.post('/admin/update-rate-limits', async (req, res) => {
  const authenticateApiKey = req.app.get('authenticateApiKey');
  await authenticateApiKey(req, res, async () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const trackedAnthropic = req.app.get('trackedAnthropic');

    try {
      const { config } = req.body;
      
      if (!config) {
        return res.status(400).json({ error: 'Configuration object required' });
      }

      // Update the configuration
      trackedAnthropic.updateRateLimitConfig(config);
      
      // Return the updated status
      const updatedStatus = trackedAnthropic.getRateLimitStatus();
      
      res.json({
        success: true,
        message: 'Rate limiting configuration updated successfully',
        ...updatedStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating rate limits:', error);
      res.status(500).json({ error: 'Failed to update rate limits' });
    }
  });
});

// ==================== SETUP & EMERGENCY ENDPOINTS ====================

// GET /api/admin-status - Check admin user status (no auth required)
router.get('/admin-status', async (req, res) => {
  const userService = req.app.get('userService');

  try {
    const adminUser = await userService.getFirstAdminUser();
    
    if (adminUser.rows.length === 0) {
      res.json({ 
        hasAdmin: false, 
        message: 'No admin user found. Server will create one on next restart.' 
      });
    } else {
      res.json({ 
        hasAdmin: true, 
        adminUsername: adminUser.rows[0].username,
        message: 'Admin user exists. Check server logs for API key or use existing credentials.' 
      });
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// POST /api/create-emergency-admin - Create emergency admin (no auth required)
router.post('/create-emergency-admin', async (req, res) => {
  const userService = req.app.get('userService');

  try {
    // Check if admin already exists
    const adminUsername = await userService.getAdminUsername();
    
    if (adminUsername) {
      return res.status(400).json({ 
        error: 'Admin user already exists',
        adminUsername: adminUsername 
      });
    }
    
    // Create new admin user
    const result = await userService.createAdminUser('admin', 999999);
    const adminApiKey = result.rows[0].api_key;
    
    console.log('🚨 Emergency admin user created with API key:', adminApiKey);
    
    res.json({
      success: true,
      message: 'Emergency admin user created',
      username: 'admin',
      apiKey: adminApiKey,
      warning: 'Save this API key securely - it won\'t be shown again!'
    });
  } catch (error) {
    console.error('Error creating emergency admin:', error);
    res.status(500).json({ error: 'Failed to create emergency admin' });
  }
});

// POST /api/promote-to-admin - Promote existing user to admin (no auth required)
router.post('/promote-to-admin', async (req, res) => {
  const userService = req.app.get('userService');

  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if user exists
    const user = await userService.getUserWithAdminStatus(username);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.rows[0].is_admin) {
      return res.json({ 
        message: `${username} is already an admin`,
        username: username,
        wasAlreadyAdmin: true
      });
    }
    
    // Promote user to admin
    await userService.promoteToAdmin(username);
    
    console.log(`👑 User ${username} promoted to admin`);
    
    res.json({
      success: true,
      message: `${username} has been promoted to admin`,
      username: username,
      isNowAdmin: true
    });
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    res.status(500).json({ error: 'Failed to promote user to admin' });
  }
});

// DELETE /api/emergency-delete-cckrad - Emergency delete specific user (no auth required)
router.delete('/emergency-delete-cckrad', async (req, res) => {
  const userService = req.app.get('userService');

  try {
    const username = 'CCKRAD';
    
    // Get user info first
    const userResult = await userService.getUserBasicInfo(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'CCKRAD user not found' });
    }
    
    const user = userResult.rows[0];
    console.log(`🗑️ Found CCKRAD user to delete: ID ${user.id}`);
    
    // Delete user and all related data using UserService CASCADE method
    const deletionResults = await userService.deleteUserCompletely(user.id);
    console.log(`✅ Deleted user and all related data:`, deletionResults);
    
    console.log(`🗑️ Emergency deleted CCKRAD user: ${username} (ID: ${user.id})`);
    
    res.json({
      success: true,
      message: `CCKRAD user deleted successfully`,
      deletedUser: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error deleting CCKRAD user:', error);
    res.status(500).json({ 
      error: 'Failed to delete CCKRAD user',
      details: error.message,
      stack: error.stack
    });
  }
});

// ==================== FEEDBACK MANAGEMENT ====================

// GET /api/admin/feedback - Get all feedback
router.get('/admin/feedback', authenticateAdmin, async (req, res) => {
  try {
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }

    const { category = 'all' } = req.query;
    
    if (req.app.get('feedbackService')) {
      // Use FeedbackService if available
      const feedbackService = req.app.get('feedbackService');
      const result = await feedbackService.getAllFeedback({ category });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      res.json({
        success: true,
        feedback: result.data,
        totalCount: result.data.length
      });
    } else {
      // Fallback to direct database query
      console.log('🔄 Using fallback feedback query (service unavailable)');
      
      let whereClause = '';
      let params = [];
      
      if (category !== 'all') {
        whereClause = 'WHERE category = $1';
        params = [category];
      }
      
      const result = await req.dbClient.query(`
        SELECT f.*, u.username 
        FROM feedback f 
        LEFT JOIN users u ON f.user_id = u.id 
        ${whereClause}
        ORDER BY f.created_at DESC
      `, params);
      
      res.json({
        success: true,
        feedback: result.rows,
        totalCount: result.rows.length,
        fallbackMode: true
      });
    }
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET /api/admin/feedback/stats - Get feedback statistics
router.get('/admin/feedback/stats', authenticateAdmin, async (req, res) => {
  try {
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }

    if (req.app.get('feedbackService')) {
      // Use FeedbackService if available
      const feedbackService = req.app.get('feedbackService');
      const result = await feedbackService.getFeedbackStats();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      res.json({
        success: true,
        stats: result.data
      });
    } else {
      // Fallback to direct database query for basic stats
      console.log('🔄 Using fallback feedback stats (service unavailable)');
      
      const totalResult = await req.dbClient.query('SELECT COUNT(*) as total FROM feedback');
      const categoryResult = await req.dbClient.query(`
        SELECT category, COUNT(*) as count 
        FROM feedback 
        GROUP BY category 
        ORDER BY count DESC
      `);
      
      res.json({
        success: true,
        stats: {
          total: parseInt(totalResult.rows[0].total),
          byCategory: categoryResult.rows,
          fallbackMode: true
        }
      });
    }
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ error: 'Failed to fetch feedback statistics' });
  }
});

// DELETE /api/admin/feedback/:feedbackId - Delete feedback
router.delete('/admin/feedback/:feedbackId', authenticateAdmin, async (req, res) => {
  try {
    if (!req.dbClient) {
      return res.status(503).json({ 
        error: 'Database service unavailable',
        fallback: 'Server restarting...' 
      });
    }

    const { feedbackId } = req.params;
    
    if (req.app.get('feedbackService')) {
      // Use FeedbackService if available
      const feedbackService = req.app.get('feedbackService');
      const result = await feedbackService.deleteFeedback(feedbackId);
      
      if (!result.success) {
        throw new Error(result.error);
      }
    } else {
      // Fallback to direct database delete
      console.log('🔄 Using fallback feedback delete (service unavailable)');
      
      const result = await req.dbClient.query(
        'DELETE FROM feedback WHERE id = $1 RETURNING id',
        [feedbackId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
    }
    
    console.log(`🗑️ Feedback ${feedbackId} deleted by admin ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Feedback deleted successfully',
      fallbackMode: !req.app.get('feedbackService')
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

module.exports = { router }; 