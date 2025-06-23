const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Database connection using Neon
const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://screenplay_db_owner:npg_lj7YbZI9HgXa@ep-twilight-flower-a5mz18ee-pooler.us-east-2.aws.neon.tech/screenplay_db?sslmode=require',
});

async function migrateCreditSystem() {
    console.log('🔄 Migrating Neon database for credit system...');
    
    try {
        // Connect to database
        await dbClient.connect();
        console.log('✅ Connected to Neon database');

        // 1. Check current users table structure
        console.log('1. Checking current users table structure...');
        const tableInfo = await dbClient.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        console.log('Current users table columns:', tableInfo.rows.map(r => r.column_name));

        // 2. Add missing columns to users table if needed
        console.log('2. Updating users table structure...');
        
        // Check if api_key column exists
        const hasApiKey = tableInfo.rows.some(r => r.column_name === 'api_key');
        if (!hasApiKey) {
            await dbClient.query('ALTER TABLE users ADD COLUMN api_key VARCHAR(255) UNIQUE');
            console.log('  ✅ Added api_key column');
        }

        // Check if credits column exists (your current schema uses credits_remaining)
        const hasCredits = tableInfo.rows.some(r => r.column_name === 'credits');
        if (!hasCredits) {
            await dbClient.query('ALTER TABLE users ADD COLUMN credits DECIMAL(10,2) DEFAULT 0.00');
            console.log('  ✅ Added credits column');
        }

        // Check if is_admin column exists
        const hasIsAdmin = tableInfo.rows.some(r => r.column_name === 'is_admin');
        if (!hasIsAdmin) {
            await dbClient.query('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
            console.log('  ✅ Added is_admin column');
        }

        // 3. Add credits_remaining column if it doesn't exist (for server.js compatibility)
        console.log('3. Adding credits_remaining column for compatibility...');
        const hasCreditsRemaining = tableInfo.rows.some(r => r.column_name === 'credits_remaining');
        if (!hasCreditsRemaining) {
            await dbClient.query('ALTER TABLE users ADD COLUMN credits_remaining INTEGER DEFAULT 0');
            console.log('  ✅ Added credits_remaining column');
        }

        // Sync credits columns
        await dbClient.query(`
            UPDATE users 
            SET credits_remaining = COALESCE(credits, 0)::INTEGER,
                credits = COALESCE(credits, 0)
            WHERE credits IS NULL OR credits = 0 OR credits_remaining IS NULL OR credits_remaining = 0
        `);
        console.log('  ✅ Synced credit columns');

        // 4. Create usage_logs table (compatible with existing structure)
        console.log('4. Creating/updating usage_logs table...');
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS usage_logs_v2 (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                model VARCHAR(255),
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_cost DECIMAL(10,4) DEFAULT 0.0000,
                success BOOLEAN DEFAULT TRUE,
                error_message TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                project_path VARCHAR(255),
                request_data JSONB
            )
        `);
        console.log('  ✅ Usage logs table created');

        // 5. Create credit_transactions table
        console.log('5. Creating credit_transactions table...');
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS credit_transactions_v2 (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                description TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ Credit transactions table created');

        // 6. Create or update admin user
        console.log('6. Setting up admin user...');
        const adminApiKey = 'admin_' + crypto.randomBytes(32).toString('hex');
        
        // Check if admin user exists
        const existingAdmin = await dbClient.query('SELECT * FROM users WHERE username = $1', ['admin']);
        
        if (existingAdmin.rows.length === 0) {
            // Create new admin user (without email since it doesn't exist in current schema)
            await dbClient.query(`
                INSERT INTO users (username, api_key, credits, credits_remaining, is_admin) 
                VALUES ($1, $2, $3, $4, $5)
            `, ['admin', adminApiKey, 10000.00, 10000, true]);
            console.log('  ✅ New admin user created');
        } else {
            // Update existing admin user
            await dbClient.query(`
                UPDATE users 
                SET api_key = $1, 
                    credits = GREATEST(COALESCE(credits, 0), 10000.00), 
                    credits_remaining = GREATEST(COALESCE(credits_remaining, 0), 10000),
                    is_admin = TRUE
                WHERE username = 'admin'
            `, [adminApiKey]);
            console.log('  ✅ Existing admin user updated');
        }
        
        console.log(`🔑 Admin API Key: ${adminApiKey}`);
        console.log('📝 Save this API key - you\'ll need it to manage the system!');

        // 7. Update existing users with default credits
        console.log('7. Updating existing users with default credits...');
        await dbClient.query(`
            UPDATE users 
            SET credits = 1000.00, credits_remaining = 1000
            WHERE (credits IS NULL OR credits = 0) AND username != 'admin'
        `);
        console.log('  ✅ Existing users updated with default credits');

        // 8. Create indexes for performance
        console.log('8. Creating database indexes...');
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_usage_logs_v2_username ON usage_logs_v2(username);
            CREATE INDEX IF NOT EXISTS idx_usage_logs_v2_timestamp ON usage_logs_v2(timestamp);
            CREATE INDEX IF NOT EXISTS idx_credit_transactions_v2_username ON credit_transactions_v2(username);
            CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
        `);
        console.log('  ✅ Database indexes created');

        // 9. Verify the migration
        console.log('9. Verifying migration...');
        const userCount = await dbClient.query('SELECT COUNT(*) FROM users');
        const adminUser = await dbClient.query('SELECT username, credits, is_admin FROM users WHERE username = \'admin\'');
        
        console.log(`  ✅ Migration complete! Found ${userCount.rows[0].count} users`);
        console.log(`  ✅ Admin user: ${adminUser.rows[0]?.credits || 'Not found'} credits`);

        console.log('\n🎉 Credit system migration successful!');
        console.log('\n📋 Next steps:');
        console.log('1. Create a .env file with your DATABASE_URL');
        console.log('2. Update server.js to use the new credit system endpoints');
        console.log('3. Restart your server: npm start');
        console.log('4. Test the system with the admin API key above');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        throw error;
    } finally {
        await dbClient.end();
    }
}

// Run migration
if (require.main === module) {
    migrateCreditSystem()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err.message);
            process.exit(1);
        });
}

module.exports = { migrateCreditSystem }; 