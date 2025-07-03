# Anthropic API Rate Limiting & Retry System

## Overview

This system implements comprehensive rate limiting and retry logic for Anthropic API calls to prevent "too many requests" errors. It includes:

- **Rate Limiting**: Prevents exceeding API quotas
- **Exponential Backoff**: Intelligent retry logic with progressive delays
- **Concurrent Request Control**: Limits simultaneous API calls
- **Admin Configuration**: Runtime configuration via API endpoints
- **Environment Variables**: Configurable limits via environment settings

## Features

### 🚦 Rate Limiting
- **Per-minute limits**: Default 50 requests per minute
- **Concurrent limits**: Default 5 simultaneous requests
- **Automatic throttling**: Waits when limits are reached
- **Request tracking**: Maintains sliding window of recent requests

### 🔄 Retry Logic
- **Exponential backoff**: Progressive delays between retries
- **Jitter**: Random delay variation to prevent thundering herd
- **Smart detection**: Distinguishes rate limit errors from other failures
- **Configurable attempts**: Default 3 retries before failing

### 📊 Monitoring
- **Real-time status**: View current rate limit usage
- **Request tracking**: Monitor concurrent and recent requests
- **Admin endpoints**: Check and configure limits via API

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Rate limiting configuration
ANTHROPIC_RATE_LIMIT_PER_MINUTE=50      # Max requests per minute
ANTHROPIC_CONCURRENT_REQUESTS=5         # Max concurrent requests
ANTHROPIC_MAX_RETRIES=3                 # Max retry attempts
ANTHROPIC_BASE_DELAY=1000               # Base delay in milliseconds
ANTHROPIC_MAX_DELAY=30000               # Maximum delay in milliseconds
ANTHROPIC_BACKOFF_FACTOR=2              # Exponential backoff multiplier
```

### Default Values

If environment variables are not set, the system uses these defaults:

```javascript
{
  maxRequestsPerMinute: 50,
  maxConcurrentRequests: 5,
  maxRetries: 3,
  baseDelay: 1000,        // 1 second
  maxDelay: 30000,        // 30 seconds
  backoffFactor: 2
}
```

## Usage Examples

### Basic Usage

The rate limiting is automatically applied to all Anthropic API calls. No code changes needed:

```javascript
// This automatically gets rate limited and retried
const response = await trackedAnthropic.messages({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'Hello' }]
}, user, '/api/generate-scene');
```

### Admin API Usage

#### Check Current Status

```bash
curl -X GET "https://your-domain.com/api/admin/rate-limit-status" \
  -H "X-API-Key: your-admin-api-key"
```

Response:
```json
{
  "success": true,
  "configuration": {
    "maxRequestsPerMinute": 50,
    "maxConcurrentRequests": 5,
    "maxRetries": 3,
    "baseDelay": 1000,
    "maxDelay": 30000,
    "backoffFactor": 2
  },
  "currentStatus": {
    "recentRequests": 12,
    "currentRequests": 2,
    "requestsInLastMinute": 12,
    "timeUntilReset": 45000
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Update Configuration

```bash
curl -X POST "https://your-domain.com/api/admin/update-rate-limits" \
  -H "X-API-Key: your-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "maxRequestsPerMinute": 100,
      "maxConcurrentRequests": 10,
      "maxRetries": 5
    }
  }'
```

## Rate Limiting Strategies

### Conservative (Default)
```env
ANTHROPIC_RATE_LIMIT_PER_MINUTE=50
ANTHROPIC_CONCURRENT_REQUESTS=5
```
- **Best for**: New applications, testing
- **Pros**: Very safe, minimal chance of hitting limits
- **Cons**: May be slower for high-traffic applications

### Balanced
```env
ANTHROPIC_RATE_LIMIT_PER_MINUTE=100
ANTHROPIC_CONCURRENT_REQUESTS=10
```
- **Best for**: Production applications with moderate traffic
- **Pros**: Good balance of speed and safety
- **Cons**: Requires monitoring

### Aggressive
```env
ANTHROPIC_RATE_LIMIT_PER_MINUTE=200
ANTHROPIC_CONCURRENT_REQUESTS=20
```
- **Best for**: High-traffic applications with premium Anthropic plan
- **Pros**: Maximum throughput
- **Cons**: Higher chance of hitting API limits, requires careful monitoring

## Troubleshooting

### Common Issues

#### Still Getting Rate Limit Errors
1. **Check your Anthropic plan limits**
2. **Lower the rate limit configuration**
3. **Increase retry delays**
4. **Monitor concurrent requests**

#### Requests Taking Too Long
1. **Increase concurrent request limit**
2. **Decrease base delay**
3. **Check if rate limiting is being triggered**

#### Memory Issues
1. **Rate limit tracking uses minimal memory**
2. **Request history is cleaned automatically**
3. **No persistent storage of rate limit data**

### Monitoring Commands

```bash
# Check current status
curl -X GET "https://your-domain.com/api/admin/rate-limit-status" \
  -H "X-API-Key: your-admin-api-key"

# Reset to conservative settings
curl -X POST "https://your-domain.com/api/admin/update-rate-limits" \
  -H "X-API-Key: your-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "maxRequestsPerMinute": 30,
      "maxConcurrentRequests": 3,
      "maxRetries": 5
    }
  }'
```

## Console Logging

The system provides detailed console logging:

```
🔄 Attempt 1/4 for /api/generate-scene
📊 Current requests: 3/5
📈 Recent requests: 25/50
🚦 Rate limit detected on attempt 1
⏳ Retrying in 1247ms...
🔄 Attempt 2/4 for /api/generate-scene
💰 Cost calculated for claude-3-5-sonnet-20241022:
   Input tokens: 1500 @ $3.00/1M = $0.0045
   Output tokens: 800 @ $15.00/1M = $0.0120
   Total cost: $0.0165 (2 credits)
```

## Best Practices

1. **Start Conservative**: Begin with default settings and adjust based on usage
2. **Monitor Regularly**: Check rate limit status during peak usage
3. **Set Alerts**: Monitor for repeated rate limit errors
4. **Plan Scaling**: Consider upgrading Anthropic plan for higher limits
5. **Test Configuration**: Test changes in staging before production

## API Reference

### Admin Endpoints

#### GET /api/admin/rate-limit-status
- **Auth**: Admin API key required
- **Response**: Current rate limiting configuration and status

#### POST /api/admin/update-rate-limits
- **Auth**: Admin API key required
- **Body**: `{ "config": { ... } }`
- **Response**: Updated configuration and status

### Configuration Limits

- `maxRequestsPerMinute`: 1-1000
- `maxConcurrentRequests`: 1-50
- `maxRetries`: 0-10
- `baseDelay`: 100-10000ms
- `maxDelay`: 1000-120000ms
- `backoffFactor`: 1-5

---

This rate limiting system should resolve "too many requests" errors while maintaining optimal performance for your Anthropic API usage. 