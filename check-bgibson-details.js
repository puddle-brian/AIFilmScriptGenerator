const { Pool } = require('pg');

async function checkBGibsonDetails() {
  const DATABASE_URL = 'postgresql://screenplay_db_owner:npg_lj7YbZI9HgXa@ep-twilight-flower-a5mz18ee-pooler.us-east-2.aws.neon.tech/screenplay_db?sslmode=require';
  
  const pool = new Pool({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to database...');
    
    // Check BGibson's complete details
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['BGibson']);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ BGibson user not found');
      return;
    }
    
    const user = userCheck.rows[0];
    console.log('✅ BGibson user details:');
    console.log('ID:', user.id);
    console.log('Username:', user.username);
    console.log('Email:', user.email || '❌ NO EMAIL SET');
    console.log('Has password_hash:', !!user.password_hash);
    console.log('Password hash length:', user.password_hash ? user.password_hash.length : 0);
    console.log('Is admin:', user.is_admin);
    console.log('Credits remaining:', user.credits_remaining);
    console.log('Email verified:', user.email_verified);
    console.log('Created at:', user.created_at);
    
    // If no email, let's set one
    if (!user.email) {
      console.log('\n🔧 Setting email for BGibson...');
      await pool.query('UPDATE users SET email = $1 WHERE username = $2', ['bgibson@example.com', 'BGibson']);
      console.log('✅ Email set to: bgibson@example.com');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBGibsonDetails(); 