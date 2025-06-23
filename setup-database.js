const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Users table created');

    // Create user_libraries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_libraries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        library_type VARCHAR(20) NOT NULL,
        entry_key VARCHAR(50) NOT NULL,
        entry_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, library_type, entry_key)
      );
    `);
    console.log('✅ User libraries table created');

    // Create user_projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        project_name VARCHAR(100) NOT NULL,
        project_context JSONB NOT NULL,
        thumbnail_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, project_name)
      );
    `);
    console.log('✅ User projects table created');

    // Create a default "guest" user for testing
    await client.query(`
      INSERT INTO users (username) VALUES ('guest')
      ON CONFLICT (username) DO NOTHING;
    `);
    console.log('✅ Default guest user created');

    console.log('🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    await client.end();
  }
}

// Run the setup
setupDatabase(); 