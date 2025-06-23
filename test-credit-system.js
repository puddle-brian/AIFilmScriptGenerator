const { Client } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

// Test the credit system
async function testCreditSystem() {
  console.log('🧪 Testing Credit System...\n');
  
  // Test database connection
  console.log('1. Testing database connection...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  // Check if admin user exists
  console.log('\n2. Checking admin user...');
  try {
    const adminResult = await client.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminResult.rows.length > 0) {
      console.log('✅ Admin user exists');
      console.log(`   API Key: ${adminResult.rows[0].api_key}`);
      console.log(`   Credits: ${adminResult.rows[0].credits_remaining}`);
    } else {
      console.log('❌ Admin user not found');
    }
  } catch (error) {
    console.error('❌ Error checking admin user:', error.message);
  }
  
  // Test creating a user (if admin exists)
  console.log('\n3. Testing user creation...');
  try {
    const adminResult = await client.query("SELECT api_key FROM users WHERE username = 'admin'");
    if (adminResult.rows.length > 0) {
      const adminApiKey = adminResult.rows[0].api_key;
      
      const response = await fetch('http://localhost:3000/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': adminApiKey
        },
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          initialCredits: 50
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Test user created successfully');
        console.log(`   Username: ${result.user.username}`);
        console.log(`   API Key: ${result.user.api_key}`);
        console.log(`   Credits: ${result.user.credits_remaining}`);
        
        // Test getting user stats
        console.log('\n4. Testing user stats...');
        const statsResponse = await fetch(`http://localhost:3000/api/my-stats`, {
          headers: {
            'X-API-Key': result.user.api_key
          }
        });
        
        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          console.log('✅ User stats retrieved successfully');
          console.log(`   Credits remaining: ${stats.user.credits_remaining}`);
          console.log(`   Total requests: ${stats.usage.total_requests || 0}`);
        } else {
          console.log('❌ Failed to get user stats');
        }
        
      } else {
        const error = await response.json();
        console.log('❌ Failed to create test user:', error.error);
      }
    } else {
      console.log('❌ Admin user not found, skipping user creation test');
    }
  } catch (error) {
    console.error('❌ Error testing user creation:', error.message);
  }
  
  // Test authentication on protected endpoint
  console.log('\n5. Testing authentication...');
  try {
    // Test without API key
    const noKeyResponse = await fetch('http://localhost:3000/api/generate-structure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        storyInput: { title: 'Test Story' },
        template: 'hero-journey'
      })
    });
    
    if (noKeyResponse.status === 401) {
      console.log('✅ Authentication correctly blocks requests without API key');
    } else {
      console.log('❌ Authentication failed to block requests without API key');
    }
    
    // Test with invalid API key
    const invalidKeyResponse = await fetch('http://localhost:3000/api/generate-structure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'invalid_key'
      },
      body: JSON.stringify({
        storyInput: { title: 'Test Story' },
        template: 'hero-journey'
      })
    });
    
    if (invalidKeyResponse.status === 401) {
      console.log('✅ Authentication correctly blocks requests with invalid API key');
    } else {
      console.log('❌ Authentication failed to block requests with invalid API key');
    }
    
  } catch (error) {
    console.error('❌ Error testing authentication:', error.message);
  }
  
  // Check database tables
  console.log('\n6. Checking database tables...');
  try {
    const tables = ['users', 'usage_logs_v2', 'credit_transactions_v2'];
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✅ Table ${table}: ${result.rows[0].count} records`);
      } catch (tableError) {
        console.log(`❌ Error checking table ${table}: ${tableError.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error checking database tables:', error.message);
  }
  
  await client.end();
  console.log('\n🎉 Credit system test complete!');
}

// Run the test
testCreditSystem().catch(console.error); 