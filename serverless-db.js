const { Client, Pool } = require('pg');

class ServerlessDB {
  constructor() {
    this.pool = null;
    this.client = null;
  }

  // Create connection pool for serverless environment
  getPool() {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1, // Single connection for serverless
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    }
    return this.pool;
  }

  // Get a single client for operations
  async getClient() {
    if (!this.client) {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      await this.client.connect();
    }
    return this.client;
  }

  // Execute query with timeout protection
  async query(text, params = []) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 8000);
    });

    const queryPromise = (async () => {
      const pool = this.getPool();
      const client = await pool.connect();
      try {
        const result = await client.query(text, params);
        return result;
      } finally {
        client.release();
      }
    })();

    return Promise.race([queryPromise, timeoutPromise]);
  }

  // Fast migration for serverless
  async fastMigration() {
    const migrations = [
      {
        name: 'Add email column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)'
      },
      {
        name: 'Add password_hash column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)'
      },
      {
        name: 'Add total_credits_purchased column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS total_credits_purchased INTEGER DEFAULT 0'
      },
      {
        name: 'Add email_updates column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_updates BOOLEAN DEFAULT FALSE'
      },
      {
        name: 'Add email_verified column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE'
      },
      {
        name: 'Add last_login column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP'
      },
      {
        name: 'Add reset_token column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)'
      },
      {
        name: 'Add reset_token_expires column',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP'
      }
    ];

    const results = [];
    
    for (const migration of migrations) {
      try {
        await this.query(migration.sql);
        results.push(`✅ ${migration.name}`);
      } catch (error) {
        results.push(`⚠️ ${migration.name}: ${error.message.substring(0, 50)}...`);
      }
    }
    
    return results;
  }

  // Robust user registration with fallback
  async registerUser(userData) {
    const { username, email, password_hash, api_key, credits = 100, email_updates = false } = userData;
    
    // Try full registration first
    try {
      const result = await this.query(`
        INSERT INTO users (
          username, email, password_hash, api_key, 
          credits_remaining, email_updates, email_verified, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, username, email, api_key, credits_remaining, created_at
      `, [username, email, password_hash, api_key, credits, email_updates, false]);
      
      return { success: true, user: result.rows[0], method: 'full' };
    } catch (fullError) {
      console.log('Full registration failed, trying minimal:', fullError.message);
      
      // Try minimal registration
      try {
        const result = await this.query(`
          INSERT INTO users (
            username, api_key, credits_remaining, created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING id, username, api_key, credits_remaining, created_at
        `, [username, api_key, credits]);
        
        return { success: true, user: result.rows[0], method: 'minimal' };
      } catch (minimalError) {
        return { 
          success: false, 
          error: 'Registration failed', 
          fullError: fullError.message,
          minimalError: minimalError.message 
        };
      }
    }
  }

  // Log credit transaction with fallback
  async logCreditTransaction(userId, type, amount, notes) {
    try {
      await this.query(`
        INSERT INTO credit_transactions (
          user_id, transaction_type, credits_amount, notes, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [userId, type, amount, notes]);
      return true;
    } catch (error) {
      console.log('Credit transaction logging failed:', error.message);
      return false;
    }
  }

  // Close connections for serverless cleanup
  async close() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = ServerlessDB; 