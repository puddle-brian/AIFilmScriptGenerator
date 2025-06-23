const { Client } = require('pg');
require('dotenv').config();

async function migrateAuthSystem() {
    console.log('🔐 Migrating Authentication System...\n');

    const dbClient = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await dbClient.connect();
        console.log('✅ Connected to Neon database');

        // 1. Add authentication fields to users table
        console.log('1. Adding authentication fields to users table...');
        await dbClient.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS email_updates BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP,
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
        `);
        console.log('  ✅ Authentication fields added');

        // 2. Create indexes for performance
        console.log('2. Creating authentication indexes...');
        await dbClient.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
            CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
        `);
        console.log('  ✅ Authentication indexes created');

        // 3. Verify the migration
        console.log('3. Verifying migration...');
        const tableInfo = await dbClient.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position;
        `);
        
        console.log('  ✅ Users table columns:');
        tableInfo.rows.forEach(col => {
            console.log(`    - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });

        console.log('\n🎉 Authentication system migration successful!');
        console.log('\n📋 Next steps:');
        console.log('1. Install bcrypt for password hashing: npm install bcrypt');
        console.log('2. Restart your server: npm start');
        console.log('3. Test registration at: http://localhost:3000/register.html');
        console.log('4. Test login at: http://localhost:3000/login.html');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('\nTroubleshooting:');
        console.error('1. Check your DATABASE_URL in .env file');
        console.error('2. Ensure your database is accessible');
        console.error('3. Verify you have the necessary permissions');
    } finally {
        await dbClient.end();
    }
}

// Run the migration if this file is executed directly
if (require.main === module) {
    migrateAuthSystem();
}

module.exports = migrateAuthSystem; 