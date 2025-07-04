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
    const { username, email, apiKey, credits = 0 } = userData;
    return await this.client.query(
      'INSERT INTO users (username, email, api_key, credits) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, email, apiKey, credits]
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

  async updateUserCredits(userId, newCredits) {
    return await this.client.query(
      'UPDATE users SET credits = $1 WHERE id = $2 RETURNING *',
      [newCredits, userId]
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
      'SELECT * FROM user_projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
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
}

module.exports = DatabaseService; 