# Film Script Generator - Credit System Setup Guide

## Overview

Your Film Script Generator now includes a comprehensive **credit system** with **usage tracking** and **API key authentication**. This ensures that only authorized users can access the AI generation features, and all usage is tracked and billed appropriately.

## Key Features Implemented

✅ **PostgreSQL Database Integration** - User management, credit tracking, usage logging  
✅ **API Key Authentication** - All generation endpoints require valid API keys  
✅ **Automatic Usage Tracking** - Every Anthropic API call is logged with token counts and costs  
✅ **Credit System** - Users purchase credits, system deducts costs automatically  
✅ **Admin Dashboard** - Create users, grant credits, view usage statistics  
✅ **Self-Service Stats** - Users can view their own usage and remaining credits  

## Database Schema

The system automatically creates these tables:

- **`users`** - User accounts with API keys and credit balances
- **`usage_logs`** - Every API call logged with tokens, costs, success/failure
- **`credit_transactions`** - All credit purchases, grants, and refunds

## Initial Setup

### 1. Start the Server

```bash
npm start
```

When you start the server, it will:
- Create the database tables automatically
- Create an admin user with unlimited credits
- Display your admin API key (save this securely!)

### 2. Save Your Admin API Key

The server will display something like:
```
✅ Admin user created with API key: admin_a1b2c3d4e5f6...
   Save this API key securely - it won't be shown again!
```

**IMPORTANT**: Save this API key immediately - it's your master key for managing the system.

## Managing Users & Credits

### Create New Users

```bash
curl -X POST http://localhost:3000/api/admin/create-user \
  -H "X-API-Key: your_admin_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "initialCredits": 100
  }'
```

Response includes the user's API key:
```json
{
  "message": "User created successfully",
  "user": {
    "id": 2,
    "username": "johndoe",
    "email": "john@example.com",
    "api_key": "user_x7y8z9...",
    "credits_remaining": 100
  }
}
```

### Grant Credits to Users

```bash
curl -X POST http://localhost:3000/api/admin/grant-credits \
  -H "X-API-Key: your_admin_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "credits": 50,
    "notes": "Bonus credits for beta testing"
  }'
```

### View User Usage Statistics

```bash
curl -H "X-API-Key: your_admin_api_key_here" \
  http://localhost:3000/api/admin/usage-stats/johndoe
```

Returns detailed usage stats:
```json
{
  "user": {
    "username": "johndoe",
    "credits_remaining": 75,
    "total_credits_purchased": 150
  },
  "usage": {
    "total_requests": 23,
    "total_tokens": 45231,
    "total_cost": 2.43,
    "successful_requests": 22,
    "avg_tokens_per_request": 1966
  },
  "recentUsage": [
    {
      "endpoint": "/api/generate-structure",
      "count": 8,
      "total_cost": 1.20
    }
  ]
}
```

## Credit Pricing System

The system uses **credits** as the billing unit where **1 credit = 1 cent**.

### Anthropic Claude 3.5 Sonnet Pricing

- **Input tokens**: ~$3 per 1M tokens  
- **Output tokens**: ~$15 per 1M tokens  

### Estimated Costs Per Operation

- **Story Structure Generation**: ~10-50 credits ($0.10-$0.50)
- **Scene Generation**: ~5-25 credits per scene
- **Plot Point Generation**: ~3-15 credits per act
- **Dialogue Generation**: ~8-40 credits per scene

## User Authentication

### For Users Making API Calls

Users must include their API key in requests:

**Header Method** (Recommended):
```bash
curl -X POST http://localhost:3000/api/generate-structure \
  -H "X-API-Key: user_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"storyInput": {...}, "template": "hero-journey"}'
```

**Query Parameter Method**:
```bash
curl -X POST "http://localhost:3000/api/generate-structure?api_key=user_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"storyInput": {...}, "template": "hero-journey"}'
```

### Error Responses

**No API Key**:
```json
{
  "error": "API key required",
  "message": "Please provide an API key in the X-API-Key header"
}
```

**Invalid API Key**:
```json
{
  "error": "Invalid API key"
}
```

**Insufficient Credits**:
```json
{
  "error": "Insufficient credits",
  "remaining": 5,
  "required": 10,
  "message": "Please purchase more credits to continue"
}
```

## Self-Service User Stats

Users can check their own usage:

```bash
curl -H "X-API-Key: user_api_key_here" \
  http://localhost:3000/api/my-stats
```

## Protected Endpoints

All these endpoints now require authentication:

- `POST /api/generate-structure` (10 credit minimum)
- `POST /api/generate-structure-custom` (10 credit minimum)  
- `POST /api/generate-scenes` (5 credit minimum)
- `POST /api/generate-dialogue` (5 credit minimum)
- `POST /api/generate-plot-points-for-act/:projectPath/:actKey` (5 credit minimum)
- `POST /api/generate-scene/:projectPath/:structureKey` (3 credit minimum)
- All other generation endpoints...

## Usage Tracking Details

Every API call logs:
- User ID and endpoint called
- Tokens used (input + output)
- Credits cost calculated  
- Model used (Claude 3.5 Sonnet)
- Project path (if applicable)
- Success/failure status
- Error messages (if failed)
- Timestamp

## Advanced Administration

### Database Queries

View all users:
```sql
SELECT username, credits_remaining, created_at FROM users;
```

View recent usage:
```sql
SELECT u.username, ul.endpoint, ul.credits_cost, ul.created_at 
FROM usage_logs ul 
JOIN users u ON ul.user_id = u.id 
ORDER BY ul.created_at DESC 
LIMIT 50;
```

Top users by usage:
```sql
SELECT u.username, SUM(ul.credits_cost) as total_spent
FROM usage_logs ul 
JOIN users u ON ul.user_id = u.id 
GROUP BY u.username 
ORDER BY total_spent DESC;
```

### Backup Important Data

Regularly backup your user and usage data:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Security Considerations

1. **API Keys**: Treat API keys like passwords - never expose in logs
2. **Database**: Ensure your PostgreSQL connection uses SSL in production
3. **Environment Variables**: Keep `ANTHROPIC_API_KEY` and `DATABASE_URL` secure
4. **Rate Limiting**: Consider adding rate limiting for additional protection

## Deployment Considerations

### Environment Variables Required

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
DATABASE_URL=postgresql://user:pass@host:port/dbname
PORT=3000
NODE_ENV=production
```

### Production Recommendations

1. **Use HTTPS** - Always use SSL certificates in production
2. **Database SSL** - Enable SSL for database connections
3. **Monitoring** - Set up monitoring for failed API calls
4. **Backup Strategy** - Automate database backups
5. **Log Management** - Use structured logging for production

## Troubleshooting

### Common Issues

**"Authentication failed"**
- Check database connection
- Verify user exists in database

**"Failed to call Anthropic API"**  
- Verify `ANTHROPIC_API_KEY` is set
- Check Anthropic API status
- Review error logs for details

**"Insufficient credits"**
- Grant more credits to user
- Check credit calculation logic

### Logs to Monitor

- Failed authentication attempts
- API calls with high token usage
- Users hitting credit limits
- Database connection issues

## Future Enhancements

Consider implementing:
- **Payment Integration** (Stripe, PayPal) for automatic credit purchases
- **Usage Alerts** - Email users when credits run low
- **Bulk Operations** - Import/export users and credits
- **API Rate Limiting** - Prevent abuse
- **Usage Analytics Dashboard** - Web interface for usage stats

---

## Quick Start Checklist

- [ ] Server started and admin API key saved
- [ ] Created first test user
- [ ] Granted credits to test user  
- [ ] Tested API call with user's API key
- [ ] Verified usage logging in database
- [ ] Set up monitoring for production

Your Film Script Generator is now ready for controlled public deployment with comprehensive usage tracking and credit management! 