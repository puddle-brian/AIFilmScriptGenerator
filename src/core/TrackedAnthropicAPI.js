// Enhanced Anthropic API wrapper with usage tracking
class TrackedAnthropicAPI {
  constructor(originalClient, dbClient, userService = null) {
    this.client = originalClient;
    this.db = dbClient;
    this.userService = userService; // Dependency injection for UserService
    
    // Model pricing in dollars per 1M tokens (input, output)
    this.modelPricing = {
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 }, // Legacy name
      'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
      'claude-3-5-haiku-20241022': { input: 1.00, output: 5.00 }
    };
    
    // Rate limiting configuration (configurable via environment variables)
    this.rateLimiter = {
      requests: [],
      maxRequestsPerMinute: parseInt(process.env.ANTHROPIC_RATE_LIMIT_PER_MINUTE) || 50, // Conservative limit
      maxConcurrentRequests: parseInt(process.env.ANTHROPIC_CONCURRENT_REQUESTS) || 5,
      currentRequests: 0,
      requestQueue: []
    };
    
    // Retry configuration (configurable via environment variables)
    this.retryConfig = {
      maxRetries: parseInt(process.env.ANTHROPIC_MAX_RETRIES) || 3,
      baseDelay: parseInt(process.env.ANTHROPIC_BASE_DELAY) || 1000, // 1 second base delay
      maxDelay: parseInt(process.env.ANTHROPIC_MAX_DELAY) || 30000, // 30 second max delay
      backoffFactor: parseFloat(process.env.ANTHROPIC_BACKOFF_FACTOR) || 2
    };
  }

  // Rate limiting helper methods
  cleanOldRequests() {
    const oneMinuteAgo = Date.now() - 60000;
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      timestamp => timestamp > oneMinuteAgo
    );
  }

  canMakeRequest() {
    this.cleanOldRequests();
    return this.rateLimiter.requests.length < this.rateLimiter.maxRequestsPerMinute &&
           this.rateLimiter.currentRequests < this.rateLimiter.maxConcurrentRequests;
  }

  async waitForRateLimit() {
    if (this.canMakeRequest()) {
      return;
    }

    // If we're at the concurrent limit, wait for a slot
    if (this.rateLimiter.currentRequests >= this.rateLimiter.maxConcurrentRequests) {
      console.log('🚦 Waiting for concurrent request slot...');
      await this.waitForConcurrentSlot();
    }

    // If we're at the rate limit, wait for the window to refresh
    if (this.rateLimiter.requests.length >= this.rateLimiter.maxRequestsPerMinute) {
      this.cleanOldRequests();
      if (this.rateLimiter.requests.length >= this.rateLimiter.maxRequestsPerMinute) {
        const oldestRequest = Math.min(...this.rateLimiter.requests);
        const waitTime = (oldestRequest + 60000) - Date.now();
        console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  async waitForConcurrentSlot() {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.rateLimiter.currentRequests < this.rateLimiter.maxConcurrentRequests) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateRetryDelay(attempt) {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt),
      this.retryConfig.maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  isRateLimitError(error) {
    return (
      error.status === 429 ||
      error.message?.toLowerCase().includes('rate limit') ||
      error.message?.toLowerCase().includes('too many requests')
    );
  }

  async messages(requestData, user, endpoint, projectPath = null) {
    const startTime = Date.now();
    let tokensUsed = 0;
    let creditsCost = 0;
    let success = false;
    let errorMessage = null;
    let lastError = null;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Wait for rate limit before making request
        await this.waitForRateLimit();
        
        // Track request timing
        this.rateLimiter.requests.push(Date.now());
        this.rateLimiter.currentRequests++;
        
        console.log(`🔄 Attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1} for ${endpoint}`);
        console.log(`📊 Current requests: ${this.rateLimiter.currentRequests}/${this.rateLimiter.maxConcurrentRequests}`);
        console.log(`📈 Recent requests: ${this.rateLimiter.requests.length}/${this.rateLimiter.maxRequestsPerMinute}`);

        // Make the API call
        const response = await this.client.messages.create(requestData);
        
        // Calculate usage (rough estimation based on token counts)
        const inputTokens = this.estimateTokens(requestData.messages[0].content);
        const outputTokens = this.estimateTokens(response.content[0].text);
        tokensUsed = inputTokens + outputTokens;
        
        // Calculate cost based on the specific model used
        const modelUsed = requestData.model || 'claude-3-5-sonnet-20241022';
        const pricing = this.modelPricing[modelUsed] || this.modelPricing['claude-3-5-sonnet-20241022'];
        
        const inputCost = (inputTokens / 1000000) * pricing.input;
        const outputCost = (outputTokens / 1000000) * pricing.output;
        creditsCost = inputCost + outputCost;
        
        success = true;

        // Deduct credits from user using UserService (if available)
        if (this.userService) {
          await this.userService.deductUserCredits(
            user.username,
            creditsCost,
            Math.ceil(creditsCost * 100) // Convert to credit units (1 credit = 1 cent)
          );
        }

        // Log the usage with detailed pricing breakdown
        await this.logUsage(user, endpoint, tokensUsed, creditsCost, requestData, true, null, projectPath);
        
        // Console log for monitoring
        console.log(`💰 Cost calculated for ${modelUsed}:`);
        console.log(`   Input tokens: ${inputTokens} @ $${pricing.input}/1M = $${inputCost.toFixed(4)}`);
        console.log(`   Output tokens: ${outputTokens} @ $${pricing.output}/1M = $${outputCost.toFixed(4)}`);
        console.log(`   Total cost: $${creditsCost.toFixed(4)} (${Math.ceil(creditsCost * 100)} credits)`);
        console.log(`   User balance after: ${user.credits_remaining - Math.ceil(creditsCost * 100)} credits`);

        // Success! Return the response
        return response;

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
        
        // Check if this is a rate limit error
        if (this.isRateLimitError(error)) {
          console.log(`🚦 Rate limit detected on attempt ${attempt + 1}`);
          
          if (attempt < this.retryConfig.maxRetries) {
            const retryDelay = this.calculateRetryDelay(attempt);
            console.log(`⏳ Retrying in ${retryDelay}ms...`);
            await this.sleep(retryDelay);
            continue; // Try again
          }
        } else {
          // Non-rate-limit error, don't retry
          console.error(`💥 Non-rate-limit error, not retrying:`, error.message);
          break;
        }
      } finally {
        // Always decrement concurrent request counter
        this.rateLimiter.currentRequests--;
      }
    }

    // All attempts failed
    errorMessage = lastError?.message || 'Unknown error';
    console.error(`💥 All retry attempts failed for ${endpoint}:`, errorMessage);
    
    // Log the failed usage
    await this.logUsage(user, endpoint, tokensUsed, creditsCost, requestData, false, errorMessage, projectPath);
    
    // Throw the last error
    throw lastError;
  }

  // Create wrapper method for backward compatibility
  async create(requestData) {
    // This will be replaced by the tracked version in API endpoints
    return await this.client.messages.create(requestData);
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  // Get pricing for a specific model
  getModelPricing(modelName) {
    return this.modelPricing[modelName] || this.modelPricing['claude-3-5-sonnet-20241022'];
  }

  // Get all available models and their pricing
  getAllModelPricing() {
    return this.modelPricing;
  }

  // Calculate estimated cost without making API call
  estimateCost(inputText, outputEstimate, modelName = 'claude-3-5-sonnet-20241022') {
    const pricing = this.getModelPricing(modelName);
    const inputTokens = this.estimateTokens(inputText);
    const outputTokens = outputEstimate || Math.ceil(inputTokens * 0.5); // Default: 50% of input
    
    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      model: modelName,
      pricing
    };
  }

  async logUsage(user, endpoint, tokensUsed, creditsCost, requestData, success, errorMessage, projectPath) {
    try {
      await this.db.query(`
        INSERT INTO usage_logs_v2 (
          username, endpoint, model, input_tokens, output_tokens, 
          total_cost, success, error_message, project_path, request_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        user.username,
        endpoint,
        requestData.model || 'claude-3-5-sonnet-20241022',
        this.estimateTokens(requestData.messages[0].content),
        this.estimateTokens(success ? 'response_text' : ''),
        creditsCost,
        success,
        errorMessage,
        projectPath,
        JSON.stringify({ 
          max_tokens: requestData.max_tokens, 
          temperature: requestData.temperature,
          prompt_length: requestData.messages[0].content.length 
        })
      ]);
    } catch (logError) {
      console.error('Failed to log usage:', logError);
    }
  }

  // Get current rate limiting status
  getRateLimitStatus() {
    this.cleanOldRequests();
    return {
      configuration: {
        maxRequestsPerMinute: this.rateLimiter.maxRequestsPerMinute,
        maxConcurrentRequests: this.rateLimiter.maxConcurrentRequests,
        maxRetries: this.retryConfig.maxRetries,
        baseDelay: this.retryConfig.baseDelay,
        maxDelay: this.retryConfig.maxDelay,
        backoffFactor: this.retryConfig.backoffFactor
      },
      currentStatus: {
        recentRequests: this.rateLimiter.requests.length,
        currentRequests: this.rateLimiter.currentRequests,
        requestsInLastMinute: this.rateLimiter.requests.length,
        timeUntilReset: this.rateLimiter.requests.length > 0 ? 
          Math.max(0, (Math.min(...this.rateLimiter.requests) + 60000) - Date.now()) : 0
      }
    };
  }

  // Update rate limiting configuration (admin only)
  updateRateLimitConfig(newConfig) {
    if (newConfig.maxRequestsPerMinute !== undefined) {
      this.rateLimiter.maxRequestsPerMinute = Math.max(1, Math.min(1000, newConfig.maxRequestsPerMinute));
    }
    if (newConfig.maxConcurrentRequests !== undefined) {
      this.rateLimiter.maxConcurrentRequests = Math.max(1, Math.min(50, newConfig.maxConcurrentRequests));
    }
    if (newConfig.maxRetries !== undefined) {
      this.retryConfig.maxRetries = Math.max(0, Math.min(10, newConfig.maxRetries));
    }
    if (newConfig.baseDelay !== undefined) {
      this.retryConfig.baseDelay = Math.max(100, Math.min(10000, newConfig.baseDelay));
    }
    if (newConfig.maxDelay !== undefined) {
      this.retryConfig.maxDelay = Math.max(1000, Math.min(120000, newConfig.maxDelay));
    }
    if (newConfig.backoffFactor !== undefined) {
      this.retryConfig.backoffFactor = Math.max(1, Math.min(5, newConfig.backoffFactor));
    }
    
    console.log('🔧 Rate limiting configuration updated:', this.getRateLimitStatus().configuration);
  }
}

module.exports = TrackedAnthropicAPI; 