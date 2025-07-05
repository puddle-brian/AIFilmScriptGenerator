const { Client } = require('pg');

class DatabaseService {
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
      console.log('✅ Database connected');
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }

  // User operations
  async createUser(userData) {
    const { username, email, apiKey, passwordHash, credits = 0, emailUpdates = false } = userData;
    return await this.client.query(
      `INSERT INTO users (
        username, email, api_key, password_hash, credits_remaining, 
        total_credits_purchased, email_updates, email_verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [username, email, apiKey, passwordHash, credits, credits, emailUpdates, false]
    );
  }

  async getUserByApiKey(apiKey) {
    return await this.client.query(
      'SELECT * FROM users WHERE api_key = $1',
      [apiKey]
    );
  }

  async getUserById(id) {
    return await this.client.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
  }

  async getUserByUsername(username) {
    return await this.client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
  }

  async getUserByEmail(email) {
    return await this.client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
  }

  async checkUserExists(username, email) {
    return await this.client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
  }

  async updateUserCredits(userId, newCredits) {
    return await this.client.query(
      'UPDATE users SET credits_remaining = $1 WHERE id = $2 RETURNING *',
      [newCredits, userId]
    );
  }

  async updateLastLogin(userId) {
    return await this.client.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [userId]
    );
  }

  async logCreditTransaction(userId, transactionType, amount, notes) {
    return await this.client.query(
      `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, notes, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [userId, transactionType, amount, notes]
    );
  }

  // Project operations
  async saveProject(userId, projectName, projectContext, thumbnailData) {
    return await this.client.query(
      `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, project_name) 
       DO UPDATE SET project_context = $3, thumbnail_data = $4, updated_at = NOW()
       RETURNING *`,
      [userId, projectName, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
    );
  }

  async getProject(userId, projectName) {
    return await this.client.query(
      'SELECT * FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );
  }

  async getUserProjects(userId) {
    return await this.client.query(
      'SELECT project_name, project_context, thumbnail_data, created_at, updated_at FROM user_projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
  }

  async deleteProject(userId, projectName) {
    return await this.client.query(
      'DELETE FROM user_projects WHERE user_id = $1 AND project_name = $2 RETURNING *',
      [userId, projectName]
    );
  }

  // ==================================================
  // LIBRARY OPERATIONS
  // ==================================================

  async getUserLibraryEntries(userId, type) {
    return await this.client.query(
      'SELECT entry_key, entry_data, created_at FROM user_libraries WHERE user_id = $1 AND library_type = $2 ORDER BY created_at DESC',
      [userId, type]
    );
  }

  async createLibraryEntry(userId, type, key, entryData, allowConflicts = false) {
    if (allowConflicts) {
      // For starter pack population - handle conflicts gracefully
      return await this.client.query(
        `INSERT INTO user_libraries (user_id, library_type, entry_key, entry_data) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (user_id, library_type, entry_key) 
         DO UPDATE SET entry_data = $4, created_at = NOW()
         RETURNING *`,
        [userId, type, key, JSON.stringify(entryData)]
      );
    } else {
      // Normal creation - fail on conflicts
      return await this.client.query(
        'INSERT INTO user_libraries (user_id, library_type, entry_key, entry_data) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, type, key, JSON.stringify(entryData)]
      );
    }
  }

  async updateLibraryEntry(userId, type, key, entryData) {
    return await this.client.query(
      'UPDATE user_libraries SET entry_data = $1, created_at = NOW() WHERE user_id = $2 AND library_type = $3 AND entry_key = $4 RETURNING *',
      [JSON.stringify(entryData), userId, type, key]
    );
  }

  async deleteLibraryEntry(userId, type, key) {
    return await this.client.query(
      'DELETE FROM user_libraries WHERE user_id = $1 AND library_type = $2 AND entry_key = $3 RETURNING *',
      [userId, type, key]
    );
  }

  // Usage logging
  async logUsage(logData) {
    const { 
      userId, endpoint, method, tokensUsed, creditsCost, 
      modelUsed, projectPath, success, errorMessage 
    } = logData;
    
    return await this.client.query(
      `INSERT INTO usage_logs_v2 (user_id, endpoint, method, tokens_used, credits_cost, 
       model_used, project_path, response_success, error_message) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, endpoint, method, tokensUsed, creditsCost, modelUsed, projectPath, success, errorMessage]
    );
  }

  // Library operations
  async getUserLibraries(userId, libraryType) {
    return await this.client.query(
      'SELECT * FROM user_libraries WHERE user_id = $1 AND library_type = $2',
      [userId, libraryType]
    );
  }

  async addToUserLibrary(userId, libraryType, entryKey, entryData) {
    return await this.client.query(
      `INSERT INTO user_libraries (user_id, library_type, entry_key, entry_data) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, library_type, entry_key) DO NOTHING
       RETURNING *`,
      [userId, libraryType, entryKey, JSON.stringify(entryData)]
    );
  }

  // Health check
  async healthCheck() {
    return await this.client.query('SELECT NOW() as timestamp');
  }

  // ==================================================
  // USER MANAGEMENT OPERATIONS
  // ==================================================

  async deleteUser(userId) {
    return await this.client.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [userId]
    );
  }

  async deleteUserLibraries(userId) {
    return await this.client.query(
      'DELETE FROM user_libraries WHERE user_id = $1 RETURNING *',
      [userId]
    );
  }

  async listUsers() {
    return await this.client.query(
      'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
    );
  }

  // ==================================================
  // COUNT OPERATIONS
  // ==================================================

  async getUsersCount() {
    return await this.client.query('SELECT COUNT(*) FROM users');
  }

  async getProjectsCount() {
    return await this.client.query('SELECT COUNT(*) FROM user_projects');
  }

  // ==================================================
  // PROJECT UPDATE OPERATIONS
  // ==================================================

  async updateProject(userId, projectName, projectContext) {
    return await this.client.query(
      'UPDATE user_projects SET project_context = $1, updated_at = NOW() WHERE user_id = $2 AND project_name = $3 RETURNING *',
      [JSON.stringify(projectContext), userId, projectName]
    );
  }
}

module.exports = DatabaseService; 