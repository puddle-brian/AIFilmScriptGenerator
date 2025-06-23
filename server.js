const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('pg');
require('dotenv').config();

// Production security imports
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const winston = require('winston');
const NodeCache = require('node-cache');

// Add comprehensive error handling to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Stack:', reason?.stack);
  // Don't exit - keep server running
});

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize cache
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

// Initialize Claude (Anthropic)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize PostgreSQL client
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Database schema for usage tracking
const CREATE_USAGE_TRACKING_TABLES = `
  -- Create users table if not exists
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,
    credits_remaining INTEGER DEFAULT 0,
    total_credits_purchased INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create usage_logs table for tracking API calls
  CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    tokens_used INTEGER NOT NULL,
    credits_cost DECIMAL(10,4) NOT NULL,
    model_used VARCHAR(100),
    project_path VARCHAR(255),
    request_data JSONB,
    response_success BOOLEAN,
    error_message TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create credits_transactions table for credit purchases/grants
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'grant', 'refund'
    credits_amount INTEGER NOT NULL,
    amount_paid DECIMAL(10,2),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
`;

// Initialize database tables
async function initializeDatabase() {
  try {
    await dbClient.query(CREATE_USAGE_TRACKING_TABLES);
    console.log('✅ Usage tracking tables initialized');
    
    // Add missing columns if they don't exist (for existing databases)
    try {
      await dbClient.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS total_credits_purchased INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS email_updates BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
        ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP,
        ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)
      `);
      console.log('✅ Database schema updated with missing columns');
    } catch (error) {
      console.log('ℹ️ Database schema already up to date');
    }
    
    // Create admin user if it doesn't exist
    const adminUser = await dbClient.query(
      'SELECT * FROM users WHERE username = $1',
      ['admin']
    );
    
    if (adminUser.rows.length === 0) {
      const adminApiKey = 'admin_' + require('crypto').randomBytes(32).toString('hex');
      await dbClient.query(`
        INSERT INTO users (username, api_key, credits_remaining, is_admin)
        VALUES ($1, $2, $3, $4)
      `, ['admin', adminApiKey, 999999, true]);
      
      console.log('✅ Admin user created with API key:', adminApiKey);
      console.log('   Save this API key securely - it won\'t be shown again!');
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  }
}

// Connect to database
async function connectToDatabase() {
  try {
    await dbClient.connect();
    console.log('✅ Connected to Neon database');
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
  }
}

// Production security middleware
if (process.env.NODE_ENV === 'production') {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);
  
  // Compression
  app.use(compression());
  
  // CORS for production
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
    credentials: true
  }));
} else {
  // Development CORS
  app.use(cors());
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Explicit root route for Vercel serverless
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication middleware
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required', 
      message: 'Please provide an API key in the X-API-Key header or api_key query parameter' 
    });
  }

  try {
    const user = await dbClient.query(
      'SELECT * FROM users WHERE api_key = $1',
      [apiKey]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Credit checking middleware
function checkCredits(estimatedCost = 1) {
  return async (req, res, next) => {
    if (req.user.credits_remaining < estimatedCost) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        remaining: req.user.credits_remaining,
        required: estimatedCost,
        message: 'Please purchase more credits to continue using the service'
      });
    }
    next();
  };
}

// Enhanced Anthropic API wrapper with usage tracking
class TrackedAnthropicAPI {
  constructor(originalClient, dbClient) {
    this.client = originalClient;
    this.db = dbClient;
    
    // Model pricing in dollars per 1M tokens (input, output)
    this.modelPricing = {
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 }, // Legacy name
      'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
      'claude-3-5-haiku-20241022': { input: 1.00, output: 5.00 }
    };
  }

  async messages(requestData, user, endpoint, projectPath = null) {
    const startTime = Date.now();
    let tokensUsed = 0;
    let creditsCost = 0;
    let success = false;
    let errorMessage = null;

    try {
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

      // Deduct credits from user
      await this.db.query(
        'UPDATE users SET credits = credits - $1, credits_remaining = credits_remaining - $2 WHERE username = $3',
        [creditsCost, Math.ceil(creditsCost * 100), user.username] // Convert to credit units (1 credit = 1 cent)
      );

      // Log the usage with detailed pricing breakdown
      await this.logUsage(user, endpoint, tokensUsed, creditsCost, requestData, true, null, projectPath);
      
      // Console log for monitoring
      console.log(`💰 Cost calculated for ${modelUsed}:`);
      console.log(`   Input tokens: ${inputTokens} @ $${pricing.input}/1M = $${inputCost.toFixed(4)}`);
      console.log(`   Output tokens: ${outputTokens} @ $${pricing.output}/1M = $${outputCost.toFixed(4)}`);
      console.log(`   Total cost: $${creditsCost.toFixed(4)} (${Math.ceil(creditsCost * 100)} credits)`);
      console.log(`   User balance after: ${user.credits_remaining - Math.ceil(creditsCost * 100)} credits`);

      return response;

    } catch (error) {
      errorMessage = error.message;
      await this.logUsage(user, endpoint, tokensUsed, creditsCost, requestData, false, errorMessage, projectPath);
      throw error;
    }
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
}

// Initialize tracked Anthropic client
const trackedAnthropic = new TrackedAnthropicAPI(anthropic, dbClient);

// Serve data files
app.use('/data', express.static('data'));

// Serve test frontend credits file
app.get('/test/frontend-credits', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-frontend-credits.html'));
});

// Serve credit integration demo
app.get('/credit-integration-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'credit-integration-demo.html'));
});

// Ensure directories exist
const ensureDirectories = async () => {
  const dirs = ['generated', 'templates'];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
};

// Generate detailed description of a story structure template
function generateStructureDescription(templateData) {
  const name = templateData.name;
  const description = templateData.description || '';
  const category = templateData.category || '';
  const examples = templateData.examples || '';
  
  let structureDesc = `${name}`;
  
  if (category) {
    structureDesc += ` (${category})`;
  }
  
  if (description) {
    structureDesc += `\n${description}`;
  }
  
  if (examples) {
    structureDesc += `\n\nExamples: ${examples}`;
  }
  
  // Add detailed breakdown of the story acts
  if (templateData.structure) {
    structureDesc += `\n\nStory Acts:`;
    Object.entries(templateData.structure).forEach(([key, act]) => {
      if (typeof act === 'string') {
        structureDesc += `\n- ${key}: ${act}`;
      } else if (act && typeof act === 'object') {
        const actName = act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const actDesc = act.description || act;
        structureDesc += `\n- ${actName}: ${actDesc}`;
      }
    });
  }
  
  // Add philosophical/theoretical context based on category
  if (category === 'booker_7_plots') {
    structureDesc += `\n\nThis follows Christopher Booker's archetypal story patterns that he argues underlie all narratives. Each pattern represents a fundamental human psychological journey that resonates across cultures and time periods.`;
  } else if (category === 'tobias_20_plots') {
    structureDesc += `\n\nThis structure is from Ronald Tobias's analysis of the core dramatic situations that drive compelling narratives. These plots focus on the fundamental conflicts and motivations that create engaging stories.`;
  } else if (category === 'polti_36_situations') {
    structureDesc += `\n\nBased on Georges Polti's exhaustive catalog of dramatic situations, derived from analyzing thousands of works. These represent the fundamental emotional and ethical conflicts that drive human drama.`;
  } else if (category === 'criterion_patterns') {
    structureDesc += `\n\nThis structure is inspired by arthouse and auteur cinema, focusing on psychological depth, visual storytelling, and unconventional narrative approaches that prioritize character interiority and thematic resonance over traditional plot mechanics.`;
  }
  
  return structureDesc;
}

// Hierarchical Context Management System
class HierarchicalContext {
  constructor() {
    this.contexts = {
      story: null,        // Level 1: Original story concept and influences
      structure: null,    // Level 2: Generated plot structure 
      act: null,          // Level 3: Specific story act
      plotPoints: null,   // Level 4: Plot points for current act
      scene: null         // Level 5: Individual scene context
    };
  }

  // Build Level 1: Story Foundation Context
  buildStoryContext(storyInput, originalPrompt = null, systemMessage = null) {
    this.contexts.story = {
      level: 1,
      type: 'story',
      data: {
        title: storyInput.title,
        logline: storyInput.logline,
        characters: storyInput.characters,
        tone: storyInput.tone,
        genre: storyInput.genre,
        totalScenes: storyInput.totalScenes || 70,
        influences: storyInput.influences || {},
        originalPrompt: originalPrompt,
        systemMessage: systemMessage
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.story;
  }

  // Build Level 2: Structure Context (builds on story)
  buildStructureContext(structure, templateData) {
    if (!this.contexts.story) {
      throw new Error('Story context must be built before structure context');
    }
    
    this.contexts.structure = {
      level: 2,
      type: 'structure',
      parentContext: this.contexts.story,
      data: {
        template: templateData,
        structure: structure,
        actKeys: Object.keys(structure),
        totalActs: Object.keys(structure).length
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.structure;
  }

  // Build Level 3: Act Context (builds on structure)
  buildActContext(actKey, act, actPosition) {
    if (!this.contexts.structure) {
      throw new Error('Structure context must be built before act context');
    }

    this.contexts.act = {
      level: 3,
      type: 'act',
      parentContext: this.contexts.structure,
      data: {
        key: actKey,
        name: act.name,
        description: act.description,
        characterDevelopment: act.character_development,
        position: actPosition,
        totalActs: this.contexts.structure.data.totalActs
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.act;
  }

  // Build Level 4: Plot Points Context (builds on act) - ENHANCED with previous acts' plot points
  async buildPlotPointsContext(plotPoints, totalScenes = null, projectPath = null) {
    if (!this.contexts.act) {
      throw new Error('Act context must be built before plot points context');
    }

    // Load previous acts' plot points for inter-act causality
    let previousPlotPoints = [];
    if (projectPath) {
      previousPlotPoints = await this.loadPreviousActsPlotPoints(projectPath);
    } else {
      console.log(`🔍 No projectPath provided, skipping previous acts loading`);
    }

    this.contexts.plotPoints = {
      level: 4,
      type: 'plotPoints',
      parentContext: this.contexts.act,
      data: {
        plotPoints: plotPoints, // Array of plot point strings for current act
        totalPlotPoints: plotPoints.length,
        totalScenes: totalScenes || plotPoints.length,
        sceneDistribution: totalScenes ? `${plotPoints.length} plot points for ${totalScenes} scenes` : '1:1 plot point to scene ratio',
        previousPlotPoints: previousPlotPoints, // Plot points from all previous acts for causality
        hasPreviousPlotPoints: previousPlotPoints.length > 0
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.plotPoints;
  }

  // NEW METHOD: Load plot points from all previous acts for inter-act causality
  async loadPreviousActsPlotPoints(projectPath) {
    try {
      if (!this.contexts.structure || !this.contexts.act) {
        return [];
      }

      const projectDir = path.join(__dirname, 'generated', projectPath);
      const plotPointsDir = path.join(projectDir, '02_plot_points');
      const currentActKey = this.contexts.act.data.key;
      const structureKeys = this.contexts.structure.data.actKeys;
      
      // Find the current act's position in the structure
      const currentActIndex = structureKeys.indexOf(currentActKey);
      if (currentActIndex <= 0) {
        return []; // No previous acts or act not found
      }
      
      // Get all previous acts in chronological order
      const previousActKeys = structureKeys.slice(0, currentActIndex);
      const previousPlotPoints = [];
      
      console.log(`🔗 Loading previous plot points for ${currentActKey}:`);
      console.log(`  📝 Previous acts: ${previousActKeys.join(', ')}`);
      
      for (const actKey of previousActKeys) {
        try {
          const plotPointsFile = path.join(plotPointsDir, `${actKey}_plot_points.json`);
          const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
          
          if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
            // Add act context to each plot point for better understanding
            const actPlotPoints = plotPointsData.plotPoints.map((plotPoint, index) => ({
              actKey: actKey,
              actName: this.contexts.structure.data.structure[actKey]?.name || actKey,
              plotPoint: plotPoint,
              plotPointIndex: index,
              isLastInAct: index === plotPointsData.plotPoints.length - 1
            }));
            
            previousPlotPoints.push(...actPlotPoints);
            console.log(`  ✅ Loaded ${plotPointsData.plotPoints.length} plot points from ${actKey}`);
          }
        } catch (fileError) {
          console.log(`  ⚠️  No plot points found for ${actKey} (${fileError.message})`);
          // Continue loading other acts even if one fails
        }
      }
      
      console.log(`  🎯 Total previous plot points loaded: ${previousPlotPoints.length}`);
      return previousPlotPoints;
      
    } catch (error) {
      console.error('Error loading previous acts plot points:', error);
      return [];
    }
  }

  // Build Level 5: Scene Context (builds on plot points)
  buildSceneContext(sceneIndex, plotPointIndex = null, existingScene = null, totalScenesInAct = 1) {
    if (!this.contexts.plotPoints) {
      throw new Error('Plot points context must be built before scene context');
    }

    const assignedPlotPoint = plotPointIndex !== null ? this.contexts.plotPoints.data.plotPoints[plotPointIndex] : null;

    this.contexts.scene = {
      level: 5,
      type: 'scene',
      parentContext: this.contexts.plotPoints,
      data: {
        sceneIndex: sceneIndex,
        position: sceneIndex + 1,
        totalInAct: totalScenesInAct,
        plotPointIndex: plotPointIndex,
        assignedPlotPoint: assignedPlotPoint,
        existingScene: existingScene,
        title: existingScene?.title || 'New Scene'
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.scene;
  }

  // Generate a hierarchical prompt from the context chain
  generateHierarchicalPrompt(targetLevel = 5, customInstructions = '') {
    let prompt = '';
    
    // Level 1: Story Foundation with Full Creative Context
    if (this.contexts.story) {
      const story = this.contexts.story.data;
      
      // Include the full original creative direction if available
      if (story.originalPrompt) {
        prompt += `${story.originalPrompt}Based on the following story concept, generate a detailed plot structure using the selected format that embodies these artistic sensibilities:\n\n`;
      }
      
      prompt += `STORY DETAILS:\n`;
      prompt += `- Title: ${story.title}\n`;
      prompt += `- Logline: ${story.logline}\n`;
      prompt += `- Main Characters: ${story.characters}\n`;
      prompt += `- Tone: ${story.tone || story.genre}\n`;
      prompt += `- Target Scene Count: ${story.totalScenes} scenes\n`;
      
      // Add detailed influences section if available
      if (story.influences && Object.keys(story.influences).length > 0) {
        if (story.influences.directors && story.influences.directors.length > 0) {
          prompt += `- Directorial Influences: ${story.influences.directors.join(', ')}\n`;
        }
        if (story.influences.screenwriters && story.influences.screenwriters.length > 0) {
          prompt += `- Screenwriting Influences: ${story.influences.screenwriters.join(', ')}\n`;
        }
        if (story.influences.films && story.influences.films.length > 0) {
          prompt += `- Film Influences: ${story.influences.films.join(', ')}\n`;
        }
      }
      prompt += '\n';
    }

    // Level 2: Structure Template Overview with Description
    if (this.contexts.structure && targetLevel >= 2) {
      const structure = this.contexts.structure.data;
      prompt += `STRUCTURE OVERVIEW:\n`;
      prompt += `${structure.template.name}\n`;
      
      // Generate template description
      const templateDescription = generateStructureDescription(structure.template);
      prompt += `${templateDescription}\n\n`;
      
      // If we have a current act context, show only that act
      if (this.contexts.act) {
        const currentAct = this.contexts.act.data;
        prompt += `CURRENT STORY ACT:\n`;
        prompt += `${currentAct.name}\n`;
        prompt += `Purpose: ${currentAct.description}\n`;
        if (currentAct.character_developments || currentAct.character_development) {
          prompt += `Character Development: ${currentAct.character_developments || currentAct.character_development}\n`;
        }
        prompt += '\n';
      } else {
        // Show all acts only when not generating for a specific act
        prompt += `GENERATED STORY ACTS:\n`;
        Object.entries(structure.structure).forEach(([key, act]) => {
          prompt += `${key}: ${act.name}\n`;
          prompt += `  Purpose: ${act.description}\n`;
          if (act.character_developments || act.character_development) {
            prompt += `  Character Development: ${act.character_developments || act.character_development}\n`;
          }
          // Note: Excluding existing plot_points to avoid confusion when generating new ones
          prompt += '\n';
        });
      }
    }

    // Level 3: Current Act Context (only show if not already shown in Level 2)
    if (this.contexts.act && targetLevel >= 3 && !this.contexts.structure) {
      const act = this.contexts.act.data;
      prompt += `CURRENT STORY ACT:\n`;
      prompt += `- Act: ${act.name} (${act.position}/${act.totalActs})\n`;
      prompt += `- Purpose: ${act.description}\n`;
      prompt += `- Character Development: ${act.characterDevelopment || 'Not specified'}\n\n`;
    }

    // Level 4: Plot Points Context - ENHANCED with previous acts' plot points
    if (this.contexts.plotPoints && targetLevel >= 4) {
      const plotPoints = this.contexts.plotPoints.data;
      
      // Include previous acts' plot points for inter-act causality
      if (plotPoints.hasPreviousPlotPoints && plotPoints.previousPlotPoints.length > 0) {
        prompt += `PREVIOUS ACTS' PLOT POINTS (for causal continuity):\n`;
        
        let currentActKey = '';
        plotPoints.previousPlotPoints.forEach((prevPlotPoint, index) => {
          // Group by act for better readability
          if (prevPlotPoint.actKey !== currentActKey) {
            currentActKey = prevPlotPoint.actKey;
            prompt += `\n${prevPlotPoint.actName} (${prevPlotPoint.actKey}):\n`;
          }
          
          const marker = prevPlotPoint.isLastInAct ? ' ← LAST IN ACT' : '';
          prompt += `  ${prevPlotPoint.plotPointIndex + 1}. ${prevPlotPoint.plotPoint}${marker}\n`;
        });
        
        // Highlight the last plot point from the previous act for direct causal connection
        const lastPreviousPlotPoint = plotPoints.previousPlotPoints[plotPoints.previousPlotPoints.length - 1];
        if (lastPreviousPlotPoint) {
          prompt += `\n🔗 CONNECT FROM: "${lastPreviousPlotPoint.plotPoint}"\n`;
          prompt += `The first plot point of this act should logically follow from this final plot point of the previous act.\n\n`;
        }
      }
      
      // Current act's plot points (if they exist)
      if (plotPoints.plotPoints && plotPoints.plotPoints.length > 0) {
        prompt += `PLOT POINTS FOR THIS ACT:\n`;
        plotPoints.plotPoints.forEach((point, index) => {
          prompt += `${index + 1}. ${point}\n`;
        });
        prompt += `\nDistribution: ${plotPoints.sceneDistribution}\n\n`;
      }
    }

    // Level 5: Scene Context
    if (this.contexts.scene && targetLevel >= 5) {
      const scene = this.contexts.scene.data;
      prompt += `SCENE CONTEXT:\n`;
      prompt += `- Position: Scene ${scene.position}/${scene.totalInAct} in this act\n`;
      prompt += `- Current Title: ${scene.title}\n`;
      if (scene.assignedPlotPoint) {
        prompt += `- ASSIGNED Plot Point: ${scene.assignedPlotPoint}\n`;
        prompt += `- Plot Point Index: ${scene.plotPointIndex + 1}\n`;
      }
      prompt += '\n';
    }

    // Add custom instructions
    if (customInstructions) {
      prompt += `SPECIFIC INSTRUCTIONS:\n${customInstructions}\n\n`;
    }

    return prompt;
  }

  // Save context to project file
  async saveToProject(projectPath) {
    const contextFile = path.join(__dirname, 'generated', projectPath, 'context.json');
    await fs.writeFile(contextFile, JSON.stringify(this.contexts, null, 2));
  }

  // Load context from project file
  async loadFromProject(projectPath) {
    try {
      const contextFile = path.join(__dirname, 'generated', projectPath, 'context.json');
      const contextData = await fs.readFile(contextFile, 'utf8');
      this.contexts = JSON.parse(contextData);
      return this.contexts;
    } catch (error) {
      // Context file doesn't exist, that's okay
      return null;
    }
  }

  // Get context summary for a specific level
  getContextSummary(level) {
    const levelNames = ['', 'story', 'structure', 'act', 'plotPoints', 'scene'];
    const contextName = levelNames[level];
    return this.contexts[contextName];
  }

  // Helper function to generate scenes for a plot point (extracted from the endpoint)
  async generateScenesForPlotPoint(projectPath, actKey, plotPointIndex, model = "claude-sonnet-4-20250514") {
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const plotPointsFile = path.join(projectDir, '02_plot_points', `${actKey}_plot_points.json`);
    
    // Load plot points data with scene distribution
    const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
    const plotPointIndexNum = parseInt(plotPointIndex);
    const sceneDistribution = plotPointsData.sceneDistribution || [];
    const plotPointInfo = sceneDistribution[plotPointIndexNum];
    
    if (!plotPointInfo) {
      throw new Error('Scene distribution not found. Please regenerate plot points.');
    }
    
    const sceneCount = plotPointInfo.sceneCount;
    const plotPoint = plotPointInfo.plotPoint;
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(actKey) + 1;
    context.buildActContext(actKey, structure[actKey], actPosition);
    
    // Build plot points context (scene generation doesn't need previous plot points)
    await context.buildPlotPointsContext(plotPointsData.plotPoints, plotPointsData.totalScenesForAct);
    
    // Build scene context for this specific plot point
    context.buildSceneContext(0, plotPointIndexNum, null, sceneCount);
    
    // Generate hierarchical prompt for multiple scenes from one plot point
    const hierarchicalPrompt = context.generateHierarchicalPrompt(5, `
MULTIPLE SCENES GENERATION FROM SINGLE PLOT POINT:
1. Create exactly ${sceneCount} scenes that collectively implement this plot point: "${plotPoint}"
2. Break the plot point into a ${sceneCount}-scene sequence that shows progression
3. Each scene should advance this plot point's dramatic purpose step-by-step
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Create a natural flow between scenes in this sequence
6. Each scene needs: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats
7. Scenes should feel like organic parts of a sequence, not isolated fragments
8. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

This plot point is ${plotPointInfo.isKeyPlot ? 'a KEY plot point' : 'a regular plot point'} in the story structure.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "title": "Scene Title",
      "location": "Specific location",
      "time_of_day": "Morning/Afternoon/Evening/Night",
      "description": "What happens in this scene - be specific and visual",
      "characters": ["Character1", "Character2"],
      "emotional_beats": ["primary emotion", "secondary emotion"],
      "plotPointIndex": ${plotPointIndexNum},
      "sequencePosition": 1
    }
  ]
}`;

    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 3000,
      temperature: 0.7,
      system: "You are a professional screenwriter generating scene sequences within a hierarchical story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    const scenesData = JSON.parse(completion.content[0].text);

    // Save scenes to a dedicated file
    const scenesDir = path.join(projectDir, '03_scenes', actKey);
    await fs.mkdir(scenesDir, { recursive: true });
    
    const scenesFile = path.join(scenesDir, `plot_point_${plotPointIndexNum}_scenes.json`);
    await fs.writeFile(scenesFile, JSON.stringify({
      actKey: actKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: plotPoint,
      sceneCount: sceneCount,
      scenes: scenesData.scenes,
      isKeyPlot: plotPointInfo.isKeyPlot,
      generatedAt: new Date().toISOString()
    }, null, 2));

    return {
      success: true,
      actKey: actKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: plotPoint,
      scenes: scenesData.scenes,
      sceneCount: scenesData.scenes.length,
      message: `Generated ${scenesData.scenes.length} scenes for plot point: "${plotPoint}"`
    };
  }

  // Calculate intelligent scene distribution across plot points
  calculateSceneDistribution(plotPoints, totalScenesForAct, actKey) {
    const totalPlotPoints = plotPoints.length;
    const baseScenesPerPlot = Math.floor(totalScenesForAct / totalPlotPoints);
    const extraScenes = totalScenesForAct % totalPlotPoints;
    
    // Define key plot point patterns that deserve more scenes
    const keyPlotPatterns = [
      'catalyst', 'crisis', 'climax', 'transformation', 'confrontation', 
      'revelation', 'inciting', 'turning point', 'moment of truth'
    ];
    
    const sceneDistribution = plotPoints.map((plotPoint, index) => {
      const plotText = plotPoint.toLowerCase();
      const actName = actKey.toLowerCase();
      
      // Determine if this is a key plot point deserving extra scenes
      const isKeyPlot = keyPlotPatterns.some(pattern => 
        plotText.includes(pattern) || actName.includes(pattern)
      ) || index === 0 || index === plotPoints.length - 1; // First and last are usually key
      
      // Distribute extra scenes to key plot points first
      const extraSceneBonus = isKeyPlot && index < extraScenes ? 1 : 
                             !isKeyPlot && (index >= totalPlotPoints - extraScenes) ? 1 : 0;
      
      const sceneCount = Math.max(1, baseScenesPerPlot + extraSceneBonus); // Minimum 1 scene per plot point
      
      return {
        plotPoint,
        sceneCount,
        isKeyPlot,
        plotPointIndex: index
      };
    });
    
    // Verify total scenes match target
    const totalDistributed = sceneDistribution.reduce((sum, dist) => sum + dist.sceneCount, 0);
    
    // Adjust if there's a mismatch (shouldn't happen, but safety check)
    if (totalDistributed !== totalScenesForAct) {
      console.log(`Scene distribution mismatch: ${totalDistributed} distributed vs ${totalScenesForAct} target`);
      // Add remaining scenes to the last plot point
      const difference = totalScenesForAct - totalDistributed;
      sceneDistribution[sceneDistribution.length - 1].sceneCount += difference;
    }
    
    return sceneDistribution;
  }
}

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    api: 'Film Script Generator',
    status: 'operational',
    version: require('./package.json').version,
    features: {
      authentication: true,
      creditSystem: true,
      userRegistration: true,
      scriptGeneration: true
    }
  });
});

// Fallback template data for serverless environments
const FALLBACK_TEMPLATES = {
  'hero-journey': {
    name: "Hero's Journey",
    description: "Joseph Campbell's monomyth structure following the archetypal hero's adventure",
    category: 'uncategorized',
    examples: 'Star Wars, The Matrix, Lord of the Rings'
  },
  'three-act': {
    name: "Three-Act Structure",
    description: "Classic Hollywood structure with setup, confrontation, and resolution",
    category: 'uncategorized', 
    examples: 'Most Hollywood films'
  },
  'save-the-cat': {
    name: "Save the Cat",
    description: "Blake Snyder's beat sheet structure for commercial screenwriting",
    category: 'uncategorized',
    examples: 'Commercial Hollywood films'
  },
  'booker-overcoming-monster': {
    name: "Overcoming the Monster",
    description: "Hero confronts and defeats a threatening force",
    category: 'booker_7_plots',
    examples: 'Jaws, Alien, Beowulf'
  },
  'booker-rags-to-riches': {
    name: "Rags to Riches", 
    description: "Humble protagonist achieves wealth, power, or success",
    category: 'booker_7_plots',
    examples: 'Cinderella, Pretty Woman, The Pursuit of Happyness'
  },
  'booker-quest': {
    name: "The Quest",
    description: "Hero journeys to obtain something important",
    category: 'booker_7_plots', 
    examples: 'Lord of the Rings, Finding Nemo, Raiders of the Lost Ark'
  },
  'booker-voyage-return': {
    name: "Voyage and Return",
    description: "Hero travels to strange world and returns transformed",
    category: 'booker_7_plots',
    examples: 'Alice in Wonderland, The Wizard of Oz, Spirited Away'
  },
  'booker-comedy': {
    name: "Comedy",
    description: "Light-hearted story with happy ending and character growth",
    category: 'booker_7_plots',
    examples: 'Pride and Prejudice, Some Like It Hot, The Grand Budapest Hotel'
  },
  'booker-tragedy': {
    name: "Tragedy", 
    description: "Protagonist's fatal flaw leads to downfall",
    category: 'booker_7_plots',
    examples: 'Macbeth, Scarface, There Will Be Blood'
  },
  'booker-rebirth': {
    name: "Rebirth",
    description: "Character transforms from negative to positive state",
    category: 'booker_7_plots',
    examples: 'A Christmas Carol, Beauty and the Beast, Groundhog Day'
  }
};

// Get available plot structure templates
app.get('/api/templates', async (req, res) => {
  try {
    const templateDir = path.join(__dirname, 'templates');
    let files;
    
    try {
      files = await fs.readdir(templateDir);
    } catch (readDirError) {
      console.error('Error reading template directory:', readDirError);
      console.log('Using fallback template data for serverless environment');
      
      // Use fallback template data directly
      const templates = Object.entries(FALLBACK_TEMPLATES).map(([id, template]) => ({
        id,
        name: template.name,
        description: template.description,
        category: template.category,
        examples: template.examples
      }));
      
      // Group templates by category and return immediately
      const groupedTemplates = {
        booker_7_plots: {
          title: "Booker's 7 Basic Plots",
          description: "Christopher Booker's archetypal story patterns found throughout literature and film",
          templates: templates.filter(t => t.category === 'booker_7_plots')
        },
        uncategorized: {
          title: "Classic Structures",
          description: "Essential narrative patterns and structures",
          templates: templates.filter(t => t.category === 'uncategorized')
        }
      };
      
      // Remove empty categories
      Object.keys(groupedTemplates).forEach(key => {
        if (groupedTemplates[key].templates.length === 0) {
          delete groupedTemplates[key];
        }
      });
      
      return res.json(groupedTemplates);
    }
    
    const templates = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(templateDir, file), 'utf8');
          const template = JSON.parse(content);
          templates.push({
            id: file.replace('.json', ''),
            name: template.name,
            description: template.description,
            category: template.category || 'uncategorized',
            examples: template.examples || ''
          });
        } catch (fileError) {
          console.error(`Error reading template file ${file}:`, fileError);
          // Skip this file and continue
        }
      }
    }
    
    // Group templates by category
    const groupedTemplates = {
      criterion_patterns: {
        title: "Criterion Patterns",
        description: "Cinematic narrative structures inspired by art house and international cinema",
        templates: templates.filter(t => t.category === 'criterion_patterns')
      },
      booker_7_plots: {
        title: "Booker's 7 Basic Plots",
        description: "Christopher Booker's archetypal story patterns found throughout literature and film",
        templates: templates.filter(t => t.category === 'booker_7_plots')
      },
      tobias_20_plots: {
        title: "Ronald Tobias's 20 Master Plots",
        description: "Comprehensive collection of dramatic situations and character-driven narratives",
        templates: templates.filter(t => t.category === 'tobias_20_plots')
      },
      polti_36_situations: {
        title: "The 36 Dramatic Situations (Georges Polti)",
        description: "Classical dramatic situations that form the foundation of all storytelling",
        templates: templates.filter(t => t.category === 'polti_36_situations')
      },
      uncategorized: {
        title: "Other Structures",
        description: "Additional narrative patterns and structures",
        templates: templates.filter(t => t.category === 'uncategorized')
      }
    };
    
    // Remove empty categories
    Object.keys(groupedTemplates).forEach(key => {
      if (groupedTemplates[key].templates.length === 0) {
        delete groupedTemplates[key];
      }
    });
    
    res.json(groupedTemplates);
  } catch (error) {
    console.error('Error loading templates:', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Preview the prompt that would be used for structure generation
app.post('/api/preview-prompt', async (req, res) => {
  try {
    const { storyInput, template } = req.body;
    
    // Load the selected template
    const templatePath = path.join(__dirname, 'templates', `${template}.json`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    const influencePrompt = storyInput.influencePrompt || '';
    const influencesSection = storyInput.influences ? `
${storyInput.influences.directors && storyInput.influences.directors.length > 0 ? 
  `- Directorial Influences: ${storyInput.influences.directors.join(', ')}` : ''}
${storyInput.influences.screenwriters && storyInput.influences.screenwriters.length > 0 ? 
  `- Screenwriting Influences: ${storyInput.influences.screenwriters.join(', ')}` : ''}
${storyInput.influences.films && storyInput.influences.films.length > 0 ? 
  `- Film Influences: ${storyInput.influences.films.join(', ')}` : ''}` : '';

    // Generate a detailed description of the template structure
    const structureDescription = generateStructureDescription(templateData);
    
    const prompt = `${influencePrompt}Based on the following story concept, generate a detailed plot structure using the ${templateData.name} format that embodies these artistic sensibilities:

Story Details:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Main Characters: ${storyInput.characters}
- Tone: ${storyInput.tone}
- Target Scene Count: ${storyInput.totalScenes || 70} scenes${influencesSection}

STRUCTURE OVERVIEW:
${structureDescription}

Template Structure Elements: ${JSON.stringify(templateData.structure, null, 2)}

CRITICAL GUIDELINES FOR EVENT-DRIVEN STORYTELLING:
1. Each act description must focus on CONCRETE ACTIONS and EVENTS that happen - not internal feelings or character psychology
2. Describe what the audience will SEE happening on screen - external, visual story beats
3. Show character development through ACTIONS and CHOICES, not internal monologue or emotional states
4. Focus on plot events that connect causally - what happens BECAUSE of previous events
5. Each act should describe key incidents, confrontations, discoveries, or turning points
6. Avoid describing what characters "feel," "realize," or "understand" - instead describe what they DO
7. Character development should be evident through their changing behavior and choices across acts

Generate a detailed breakdown for each structural element. Each element should have:
- A clear title
- A 2-3 sentence description of the KEY EVENTS and ACTIONS that occur in this act
- Key character developments (shown through actions, not feelings)
- Important plot points (concrete incidents that advance the story)

Return the response as a valid JSON object with each structural element as a property. 

IMPORTANT: Your response must be ONLY valid JSON, with no additional text, markdown formatting, or explanations. Start with { and end with }.

Example format:
{
  "act1_setup": {
    "name": "Act 1: Setup",
    "description": "Character performs specific actions that establish their world and routine. Key events occur that set up the story's central conflict."
  },
  "act1_inciting_incident": {
    "name": "Inciting Incident", 
    "description": "A specific event disrupts the character's normal world and forces them into the main story conflict."
  }
}`;

    res.json({
      prompt: prompt,
      template: templateData,
      systemMessage: "You are a professional screenwriter and story structure expert. Generate detailed, engaging plot structures that follow the given template format. Always respond with valid JSON."
    });
  } catch (error) {
    console.error('Error generating prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate prompt preview' });
  }
});

// Generate high-level plot structure with custom prompt
app.post('/api/generate-structure-custom', async (req, res) => {
  try {
    console.log('Received custom structure generation request:', req.body);
    const { storyInput, template, customPrompt, model = "claude-sonnet-4-20250514" } = req.body;
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Load the selected template for reference
    const templatePath = path.join(__dirname, 'templates', `${template}.json`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    console.log('Sending custom request to Claude API...');
    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 2000,
      temperature: 0.7,
      system: customPrompt.systemMessage,
      messages: [
        {
          role: "user",
          content: customPrompt.userPrompt
        }
      ],
    });
    console.log('Received response from Claude API');
    console.log('Raw Claude response:', completion.content[0].text);

    let structureData;
    try {
      structureData = JSON.parse(completion.content[0].text);
      console.log('Parsed structure data:', structureData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw response that failed to parse:', completion.content[0].text);
      // Fallback if AI doesn't return valid JSON
      structureData = {
        error: "Failed to parse AI response",
        rawResponse: completion.content[0].text
      };
    }

    // Auto-save the generated structure locally
    const projectId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const projectTitle = storyInput.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'untitled_story';
    const projectFolderName = `${projectTitle}_${timestamp.substring(0, 19)}`;
    
    const projectDir = path.join(__dirname, 'generated', projectFolderName);
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create folder structure for different story elements
    const structureDir = path.join(projectDir, '01_structure');
    const scenesDir = path.join(projectDir, '02_scenes');
    const dialogueDir = path.join(projectDir, '03_dialogue');
    const finalScriptDir = path.join(projectDir, '04_final_script');
    
    await Promise.all([
      fs.mkdir(structureDir, { recursive: true }),
      fs.mkdir(scenesDir, { recursive: true }),
      fs.mkdir(dialogueDir, { recursive: true }),
      fs.mkdir(finalScriptDir, { recursive: true })
    ]);
    
    // Save the story structure
    const structureFile = path.join(structureDir, 'plot_structure.json');
    const storyOverviewFile = path.join(structureDir, 'story_overview.md');
    
    await fs.writeFile(structureFile, JSON.stringify({
      structure: structureData,
      template: templateData,
      storyInput,
      projectId,
      customPrompt,
      generatedAt: new Date().toISOString()
    }, null, 2));
    
    // Create a readable markdown overview
    let overview = `# ${storyInput.title}\n\n`;
    overview += `**Tone:** ${storyInput.tone}\n`;
    overview += `**Logline:** ${storyInput.logline}\n`;
    overview += `**Characters:** ${storyInput.characters}\n`;
    overview += `**Target Scenes:** ${storyInput.totalScenes || 70}\n\n`;
    
    if (storyInput.influences) {
      if (storyInput.influences.directors && storyInput.influences.directors.length > 0) {
        overview += `**Directorial Influences:** ${storyInput.influences.directors.join(', ')}\n`;
      }
      if (storyInput.influences.screenwriters && storyInput.influences.screenwriters.length > 0) {
        overview += `**Screenwriting Influences:** ${storyInput.influences.screenwriters.join(', ')}\n`;
      }
      if (storyInput.influences.films && storyInput.influences.films.length > 0) {
        overview += `**Film Influences:** ${storyInput.influences.films.join(', ')}\n`;
      }
      overview += `\n`;
    }
    
    overview += `**Template Used:** ${templateData.name} (Custom Prompt)\n\n`;
    overview += `---\n\n## Custom Prompt Used\n\n`;
    overview += `**System Message:**\n\`\`\`\n${customPrompt.systemMessage}\n\`\`\`\n\n`;
    overview += `**User Prompt:**\n\`\`\`\n${customPrompt.userPrompt}\n\`\`\`\n\n`;
    overview += `---\n\n## Plot Structure\n\n`;
    
    // Add each structural element to the overview
    Object.entries(structureData).forEach(([key, element]) => {
      if (element.name && element.description) {
        overview += `### ${element.name}\n\n`;
        overview += `${element.description}\n\n`;
        if (element.character_development) {
          overview += `**Character Development:** ${element.character_development}\n\n`;
        }
        if (element.plot_points && Array.isArray(element.plot_points)) {
          overview += `**Key Plot Points:**\n`;
          element.plot_points.forEach(point => {
            overview += `- ${point}\n`;
          });
          overview += `\n`;
        }
        overview += `---\n\n`;
      }
    });
    
    await fs.writeFile(storyOverviewFile, overview);
    
    // Create a README for the project
    const readmeFile = path.join(projectDir, 'README.md');
    const readme = `# ${storyInput.title} - Film Script Project

**Generated using Custom Prompt**

## Project Structure
- **01_structure/** - Plot structure and story overview
- **02_scenes/** - Individual scene breakdowns
- **03_dialogue/** - Generated dialogue for each scene
- **04_final_script/** - Final assembled screenplay

## Usage
1. Review the plot structure in \`01_structure/story_overview.md\`
2. Generate scenes for each structural element
3. Generate dialogue for individual scenes
4. Assemble the final script

Project ID: ${projectId}
`;
    
    await fs.writeFile(readmeFile, readme);
    
    console.log(`Project saved to: ${projectDir}`);
    console.log(`Project ID: ${projectId}`);

    // Also save to database for profile page (use 'guest' as default user)
    try {
      const username = 'guest'; // TODO: Get from user session/auth
      const projectContext = {
        structure: structureData,
        template: templateData,
        storyInput,
        projectId,
        projectPath: projectFolderName,
        customPromptUsed: true,
        generatedAt: new Date().toISOString()
      };
      
      const thumbnailData = {
        title: storyInput.title,
        genre: storyInput.genre || 'Unknown',
        tone: storyInput.tone,
        structure: templateData.name,
        currentStep: 3, // Just completed structure generation
        totalScenes: storyInput.totalScenes || 70
      };

      // Get user ID
      const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Save project to database
        await dbClient.query(
          `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (user_id, project_name) 
           DO UPDATE SET project_context = $3, thumbnail_data = $4, updated_at = NOW()`,
          [userId, projectFolderName, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
        );
        
        console.log(`✅ Custom prompt project also saved to database for user: ${username}`);
      }
    } catch (dbError) {
      console.error('❌ Failed to save custom prompt project to database:', dbError);
      // Don't fail the entire request if database save fails
    }

    res.json({
      structure: structureData,
      template: templateData,
      storyInput,
      projectId,
      projectPath: projectFolderName,
      savedLocally: true,
      customPromptUsed: true
    });
  } catch (error) {
    console.error('Error generating structure with custom prompt:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate structure with custom prompt',
      details: error.message
    });
  }
});

// Generate high-level plot structure
app.post('/api/generate-structure', authenticateApiKey, checkCredits(10), async (req, res) => {
  try {
    console.log('Received structure generation request:', req.body);
    const { storyInput, template, model = "claude-sonnet-4-20250514" } = req.body;
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Load the selected template
    const templatePath = path.join(__dirname, 'templates', `${template}.json`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    const influencePrompt = storyInput.influencePrompt || '';
    const influencesSection = storyInput.influences ? `
${storyInput.influences.directors && storyInput.influences.directors.length > 0 ? 
  `- Directorial Influences: ${storyInput.influences.directors.join(', ')}` : ''}
${storyInput.influences.screenwriters && storyInput.influences.screenwriters.length > 0 ? 
  `- Screenwriting Influences: ${storyInput.influences.screenwriters.join(', ')}` : ''}
${storyInput.influences.films && storyInput.influences.films.length > 0 ? 
  `- Film Influences: ${storyInput.influences.films.join(', ')}` : ''}` : '';

    // Generate a detailed description of the template structure
    const structureDescription = generateStructureDescription(templateData);
    
    const prompt = `${influencePrompt}Based on the following story concept, generate a detailed plot structure using the ${templateData.name} format that embodies these artistic sensibilities:

Story Details:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Main Characters: ${storyInput.characters}
- Tone: ${storyInput.tone}
- Target Scene Count: ${storyInput.totalScenes || 70} scenes${influencesSection}

STRUCTURE OVERVIEW:
${structureDescription}

Template Structure Elements: ${JSON.stringify(templateData.structure, null, 2)}

CRITICAL GUIDELINES FOR EVENT-DRIVEN STORYTELLING:
1. Each act description must focus on CONCRETE ACTIONS and EVENTS that happen - not internal feelings or character psychology
2. Describe what the audience will SEE happening on screen - external, visual story beats
3. Show character development through ACTIONS and CHOICES, not internal monologue or emotional states
4. Focus on plot events that connect causally - what happens BECAUSE of previous events
5. Each act should describe key incidents, confrontations, discoveries, or turning points
6. Avoid describing what characters "feel," "realize," or "understand" - instead describe what they DO
7. Character development should be evident through their changing behavior and choices across acts

Generate a detailed breakdown for each structural element. Each element should have:
- A clear title
- A 2-3 sentence description of the KEY EVENTS and ACTIONS that occur in this act
- Key character developments (shown through actions, not feelings)
- Important plot points (concrete incidents that advance the story)

Return the response as a valid JSON object with each structural element as a property. 

IMPORTANT: Your response must be ONLY valid JSON, with no additional text, markdown formatting, or explanations. Start with { and end with }.

Example format:
{
  "act1_setup": {
    "name": "Act 1: Setup",
    "description": "Character performs specific actions that establish their world and routine. Key events occur that set up the story's central conflict."
  },
  "act1_inciting_incident": {
    "name": "Inciting Incident", 
    "description": "A specific event disrupts the character's normal world and forces them into the main story conflict."
  }
}`;

    // Auto-save the generated structure locally

    console.log('Sending request to Claude API...');
    const completion = await trackedAnthropic.messages({
      model: model,
      max_tokens: 12000,
      temperature: 0.7,
      system: "You are a professional screenwriter and story structure expert. Generate detailed, engaging plot structures that follow the given template format. Always respond with valid JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    }, req.user, '/api/generate-structure', projectFolderName);
    console.log('Received response from Claude API');
    console.log('Raw Claude response:', completion.content[0].text);

    let structureData;
    try {
      structureData = JSON.parse(completion.content[0].text);
      console.log('Parsed structure data:', structureData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw response that failed to parse:', completion.content[0].text);
      // Fallback if AI doesn't return valid JSON
      structureData = {
        error: "Failed to parse AI response",
        rawResponse: completion.content[0].text
      };
    }

    // Auto-save the generated structure locally
    
    const projectDir = path.join(__dirname, 'generated', projectFolderName);
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create folder structure for different story elements
    const structureDir = path.join(projectDir, '01_structure');
    const scenesDir = path.join(projectDir, '02_scenes');
    const dialogueDir = path.join(projectDir, '03_dialogue');
    const finalScriptDir = path.join(projectDir, '04_final_script');
    
    await Promise.all([
      fs.mkdir(structureDir, { recursive: true }),
      fs.mkdir(scenesDir, { recursive: true }),
      fs.mkdir(dialogueDir, { recursive: true }),
      fs.mkdir(finalScriptDir, { recursive: true })
    ]);
    
    // Save the story structure
    const structureFile = path.join(structureDir, 'plot_structure.json');
    const storyOverviewFile = path.join(structureDir, 'story_overview.md');
    
    await fs.writeFile(structureFile, JSON.stringify({
      structure: structureData,
      template: templateData,
      storyInput,
      projectId,
      generatedAt: new Date().toISOString()
    }, null, 2));
    
    // Create a readable markdown overview
    let overview = `# ${storyInput.title}\n\n`;
    overview += `**Tone:** ${storyInput.tone}\n`;
    overview += `**Logline:** ${storyInput.logline}\n`;
    overview += `**Characters:** ${storyInput.characters}\n`;
    overview += `**Target Scenes:** ${storyInput.totalScenes || 70}\n\n`;
    
    if (storyInput.influences) {
      if (storyInput.influences.directors && storyInput.influences.directors.length > 0) {
        overview += `**Directorial Influences:** ${storyInput.influences.directors.join(', ')}\n`;
      }
      if (storyInput.influences.screenwriters && storyInput.influences.screenwriters.length > 0) {
        overview += `**Screenwriting Influences:** ${storyInput.influences.screenwriters.join(', ')}\n`;
      }
      if (storyInput.influences.films && storyInput.influences.films.length > 0) {
        overview += `**Film Influences:** ${storyInput.influences.films.join(', ')}\n`;
      }
      overview += `\n`;
    }
    
    overview += `**Template Used:** ${templateData.name}\n\n`;
    overview += `---\n\n## Plot Structure\n\n`;
    
    // Add each structural element to the overview
    Object.entries(structureData).forEach(([key, element]) => {
      if (element.name && element.description) {
        overview += `### ${element.name}\n\n`;
        overview += `${element.description}\n\n`;
        if (element.character_development) {
          overview += `**Character Development:** ${element.character_development}\n\n`;
        }
        if (element.plot_points && Array.isArray(element.plot_points)) {
          overview += `**Key Plot Points:**\n`;
          element.plot_points.forEach(point => {
            overview += `- ${point}\n`;
          });
          overview += `\n`;
        }
        overview += `---\n\n`;
      }
    });
    
    await fs.writeFile(storyOverviewFile, overview);
    
    // Create a README for the project
    const readmeFile = path.join(projectDir, 'README.md');
    const readme = `# ${storyInput.title} - Film Script Project

Generated on: ${new Date().toLocaleString()}

## Project Structure

This folder contains your generated film script in a hierarchical structure:

- **01_structure/** - Plot structure and story overview
- **02_scenes/** - Individual scenes (generated in step 4)
- **03_dialogue/** - Full dialogue for each scene (generated in step 5)
- **04_final_script/** - Complete screenplay format (generated in step 6)

## Story Details

- **Title:** ${storyInput.title}
- **Tone:** ${storyInput.tone}
- **Logline:** ${storyInput.logline}
- **Main Characters:** ${storyInput.characters}

## Template Used

${templateData.name}: ${templateData.description}

## Next Steps

1. Review the plot structure in \`01_structure/story_overview.md\`
2. Generate scenes using the web interface (Step 4)
3. Generate dialogue for each scene (Step 5)
4. Export the final screenplay (Step 6)

Project ID: ${projectId}
`;
    
    await fs.writeFile(readmeFile, readme);
    
    console.log(`Project saved to: ${projectDir}`);
    console.log(`Project ID: ${projectId}`);

    // Also save to database for profile page (use 'guest' as default user)
    try {
      const username = 'guest'; // TODO: Get from user session/auth
      const projectContext = {
        structure: structureData,
        template: templateData,
        storyInput,
        projectId,
        projectPath: projectFolderName,
        generatedAt: new Date().toISOString()
      };
      
      const thumbnailData = {
        title: storyInput.title,
        genre: storyInput.genre || 'Unknown',
        tone: storyInput.tone,
        structure: templateData.name,
        currentStep: 3, // Just completed structure generation
        totalScenes: storyInput.totalScenes || 70
      };

      // Get user ID
      const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Save project to database
        await dbClient.query(
          `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (user_id, project_name) 
           DO UPDATE SET project_context = $3, thumbnail_data = $4, updated_at = NOW()`,
          [userId, projectFolderName, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
        );
        
        console.log(`✅ Project also saved to database for user: ${username}`);
      }
    } catch (dbError) {
      console.error('❌ Failed to save project to database:', dbError);
      // Don't fail the entire request if database save fails
    }

    res.json({
      structure: structureData,
      template: templateData,
      storyInput,
      projectId,
      projectPath: projectFolderName,
      savedLocally: true,
      prompt: prompt,
      systemMessage: "You are a professional screenwriter and story structure expert. Generate detailed, engaging plot structures that follow the given template format. Always respond with valid JSON."
    });
  } catch (error) {
    console.error('Error generating structure:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate structure',
      details: error.message
    });
  }
});

// Generate scenes for approved structure
app.post('/api/generate-scenes', async (req, res) => {
  try {
    const { structure, storyInput, projectId, projectPath } = req.body;
    
    const prompt = `Based on the approved plot structure, break down each structural element into individual scenes. 

Story Context:
- Title: ${storyInput.title}
- Characters: ${storyInput.characters}

Approved Structure:
${JSON.stringify(structure, null, 2)}

For each structural element, create 2-3 scenes that show the progression. Each scene should have:
- Scene number and title
- Location and time of day
- 2-3 sentence description of the action
- Characters present
- Key dialogue moments (brief description, not full dialogue)
- Emotional beats

Return as JSON with each structural element containing an array of scenes. IMPORTANT: Complete the entire JSON for ALL structural elements.`;

    const completion = await anthropic.messages.create({
      model: req.body.model || "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.7,
      system: "You are a professional screenwriter. Break down plot structures into detailed, filmable scenes. Always respond with valid JSON. Complete the entire JSON structure for all elements.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    let scenesData;
    try {
      scenesData = JSON.parse(completion.content[0].text);
    } catch {
      scenesData = {
        error: "Failed to parse AI response",
        rawResponse: completion.content[0].text
      };
    }

    // Save scenes to local folder if projectPath is provided
    if (projectPath && scenesData && !scenesData.error) {
      const projectDir = path.join(__dirname, 'generated', projectPath);
      const scenesDir = path.join(projectDir, '02_scenes');
      
      // Save scenes as JSON
      const scenesFile = path.join(scenesDir, 'scenes.json');
      await fs.writeFile(scenesFile, JSON.stringify({
        scenes: scenesData,
        storyInput,
        generatedAt: new Date().toISOString()
      }, null, 2));
      
      // Create readable markdown breakdown
      let scenesOverview = `# Scenes Breakdown - ${storyInput.title}\n\n`;
      
      Object.entries(scenesData).forEach(([structureKey, structureScenes]) => {
        if (Array.isArray(structureScenes)) {
          scenesOverview += `## ${structureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
          structureScenes.forEach((scene, index) => {
            scenesOverview += `### Scene ${index + 1}: ${scene.title || scene.name || 'Untitled Scene'}\n\n`;
            if (scene.location) scenesOverview += `**Location:** ${scene.location}\n`;
            if (scene.timeOfDay) scenesOverview += `**Time:** ${scene.timeOfDay}\n`;
            if (scene.characters) scenesOverview += `**Characters:** ${Array.isArray(scene.characters) ? scene.characters.join(', ') : scene.characters}\n\n`;
            if (scene.description) scenesOverview += `${scene.description}\n\n`;
            if (scene.keyDialogue) scenesOverview += `**Key Dialogue Moments:** ${scene.keyDialogue}\n\n`;
            if (scene.emotionalBeats) scenesOverview += `**Emotional Beats:** ${scene.emotionalBeats}\n\n`;
            scenesOverview += `---\n\n`;
          });
        }
      });
      
      const scenesOverviewFile = path.join(scenesDir, 'scenes_overview.md');
      await fs.writeFile(scenesOverviewFile, scenesOverview);
      
      console.log(`Scenes saved to: ${scenesDir}`);
    }

    res.json({ scenes: scenesData });
  } catch (error) {
    console.error('Error generating scenes:', error);
    res.status(500).json({ error: 'Failed to generate scenes' });
  }
});

// Generate dialogue for approved scenes
app.post('/api/generate-dialogue', async (req, res) => {
  try {
    const { scene, storyInput, context, projectPath, model = "claude-sonnet-4-20250514" } = req.body;
    
    const prompt = `Write full screenplay dialogue for this scene:

Story Context:
- Title: ${storyInput.title}
- Tone: ${storyInput.tone}
- Characters: ${storyInput.characters}

Scene Details:
${JSON.stringify(scene, null, 2)}

Additional Context:
${context || 'None provided'}

Write the scene in proper screenplay format with:
- Scene heading (INT./EXT. LOCATION - TIME)
- Action lines
- Character names (in CAPS)
- Dialogue
- Parentheticals when necessary

Make the dialogue authentic, character-specific, and genre-appropriate. Include necessary action lines between dialogue.`;

    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 2000,
      temperature: 0.8,
      system: "You are a professional screenwriter. Write engaging, properly formatted screenplay dialogue and action. Follow standard screenplay format conventions.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    const sceneId = scene.id || uuidv4();
    const dialogueText = completion.content[0].text;

    // Save dialogue to local folder if projectPath is provided
    if (projectPath) {
      const projectDir = path.join(__dirname, 'generated', projectPath);
      const dialogueDir = path.join(projectDir, '03_dialogue');
      
      const sceneTitle = (scene.title || scene.name || 'scene').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const dialogueFile = path.join(dialogueDir, `${sceneTitle}_${sceneId.substring(0, 8)}.txt`);
      
      let dialogueContent = `Scene: ${scene.title || scene.name || 'Untitled Scene'}\n`;
      if (scene.location) dialogueContent += `Location: ${scene.location}\n`;
      if (scene.timeOfDay) dialogueContent += `Time: ${scene.timeOfDay}\n`;
      dialogueContent += `Generated: ${new Date().toLocaleString()}\n`;
      dialogueContent += `\n${'='.repeat(50)}\n\n`;
      dialogueContent += dialogueText;
      
      await fs.writeFile(dialogueFile, dialogueContent);
      console.log(`Dialogue saved to: ${dialogueFile}`);
    }

    res.json({ 
      dialogue: dialogueText,
      sceneId
    });
  } catch (error) {
    console.error('Error generating dialogue:', error);
    res.status(500).json({ error: 'Failed to generate dialogue' });
  }
});

// Preview dialogue generation prompt
app.post('/api/preview-dialogue-prompt', async (req, res) => {
  console.log('Dialogue prompt preview endpoint called!');
  try {
    const { scene, storyInput, context, projectPath, structureKey, sceneIndex } = req.body;
    console.log('Request body:', { scene: !!scene, storyInput: !!storyInput, context, projectPath, structureKey, sceneIndex });
    
    let prompt, systemMessage, hierarchicalPrompt = null;
    
    // Try to build hierarchical context if we have project information
    if (projectPath && storyInput && structureKey !== undefined && sceneIndex !== undefined) {
      try {
        // Initialize and load hierarchical context
        const hierarchicalContext = new HierarchicalContext();
        
        // Build story context
        hierarchicalContext.buildStoryContext(storyInput);
        
        // Try to load project structure and template
        try {
          const projectDir = path.join(__dirname, 'generated', projectPath);
          const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
          const contextFile = path.join(projectDir, '01_context', 'context.json');
          
          const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
          
          // Load context if available
          if (await fs.access(contextFile).then(() => true).catch(() => false)) {
            await hierarchicalContext.loadFromProject(projectPath);
          }
          
          // Build structure context
          hierarchicalContext.buildStructureContext(projectData.structure, projectData.template);
          
          // Find the current structural element
          const structureElementKey = Object.keys(projectData.structure)[structureKey];
          const structureElement = projectData.structure[structureElementKey];
          
          if (structureElement) {
            // Build act context
            const actPosition = Object.keys(projectData.structure).indexOf(structureElementKey) + 1;
            hierarchicalContext.buildActContext(structureElementKey, structureElement, actPosition);
            
            // Try to load plot points for this act
            try {
              const plotPointsFile = path.join(projectDir, '02_plot-points', `${structureElementKey}.json`);
              const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
              await hierarchicalContext.buildPlotPointsContext(plotPointsData);
            } catch (error) {
              console.log('No plot points found for this act');
            }
            
            // Build scene context
            hierarchicalContext.buildSceneContext(sceneIndex, null, scene, 1);
          }
        } catch (error) {
          console.log('Error loading project structure:', error);
        }
        
        // Generate hierarchical prompt for dialogue generation
        const customInstructions = `DIALOGUE GENERATION REQUIREMENTS:
1. Write the scene in proper screenplay format with:
   - Scene heading (INT./EXT. LOCATION - TIME)
   - Character names (in CAPS) 
   - Dialogue
   - Action lines
   - Parentheticals when necessary

2. Make the dialogue authentic, character-specific, and genre-appropriate
3. Include necessary action lines between dialogue
4. Follow standard screenplay format conventions
5. Ensure dialogue serves the story's hierarchical structure and character development
6. The dialogue should feel organic to the established tone and influences
7. Write dialogue where characters never say what they're really thinking.
8. Each line should have two layers: what they literally say and what they're actually trying to communicate underneath.
9. Characters speak around their true feelings using deflection, subtext, and emotional armor.
10. Always surprise the audience with unpredictable lines and novel ways of moving scenes forward - avoid static or predictable language that feel formulaic

Scene to write dialogue for:
${JSON.stringify(scene, null, 2)}`;
        
        hierarchicalPrompt = hierarchicalContext.generateHierarchicalPrompt(5, customInstructions);
        
        prompt = `${hierarchicalPrompt}

Additional Context: ${context || 'None provided'}

Write full screenplay dialogue for this scene following all the requirements above.`;
        
        systemMessage = "You are a professional screenwriter generating dialogue within a hierarchical story structure. Write engaging, properly formatted screenplay dialogue and action that serves the overall narrative architecture.";
        
      } catch (contextError) {
        console.log('Failed to build hierarchical context, falling back to simple prompt:', contextError);
        hierarchicalPrompt = null;
      }
    }
    
    // Fallback to simple prompt if hierarchical context failed
    if (!hierarchicalPrompt) {
      // Validate storyInput exists before using it
      if (!storyInput) {
        return res.status(400).json({ 
          error: 'Missing required data: storyInput is required for dialogue prompt preview' 
        });
      }
      
      prompt = `Write full screenplay dialogue for this scene:

Story Context:
- Title: ${storyInput.title || 'Untitled'}
- Tone: ${storyInput.tone || 'Not specified'}
- Characters: ${storyInput.characters || 'Not specified'}

Scene Details:
${JSON.stringify(scene, null, 2)}

Additional Context:
${context || 'None provided'}

Write the scene in proper screenplay format with:
- Scene heading (INT./EXT. LOCATION - TIME)
- Action lines
- Character names (in CAPS)
- Dialogue
- Parentheticals when necessary

Make the dialogue authentic, character-specific, and genre-appropriate. Include necessary action lines between dialogue.`;

      systemMessage = "You are a professional screenwriter. Write engaging, properly formatted screenplay dialogue and action. Follow standard screenplay format conventions.";
    }

    res.json({
      prompt: prompt,
      systemMessage: systemMessage,
      promptType: 'dialogue',
      scene: scene,
      structureKey: structureKey,
      sceneIndex: sceneIndex,
      hierarchicalPrompt: hierarchicalPrompt
    });

  } catch (error) {
    console.error('Error generating dialogue prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate dialogue prompt preview', details: error.message });
  }
});

// Save project
app.post('/api/save-project', async (req, res) => {
  try {
    const projectId = req.body.projectId || uuidv4();
    const projectData = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectId);
    await fs.mkdir(projectDir, { recursive: true });
    
    const projectFile = path.join(projectDir, 'project.json');
    await fs.writeFile(projectFile, JSON.stringify(projectData, null, 2));
    
    res.json({ projectId, message: 'Project saved successfully' });
  } catch (error) {
    console.error('Error saving project:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// List existing projects
app.get('/api/list-projects', async (req, res) => {
  try {
    const generatedDir = path.join(__dirname, 'generated');
    const projectFolders = await fs.readdir(generatedDir);
    
    const projects = [];
    
    for (const folder of projectFolders) {
      try {
        const structureFile = path.join(generatedDir, folder, '01_structure', 'plot_structure.json');
        const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
        
        projects.push({
          path: folder,
          title: projectData.storyInput.title,
          tone: projectData.storyInput.tone,
          totalScenes: projectData.storyInput.totalScenes,
          createdAt: projectData.generatedAt,
          logline: projectData.storyInput.logline
        });
      } catch (error) {
        console.log(`Skipping invalid project folder: ${folder}`);
      }
    }
    
    // Sort by creation date, newest first
    projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(projects);
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Load project
app.get('/api/project/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const projectFile = path.join(__dirname, 'generated', projectId, 'project.json');
    
    const projectData = await fs.readFile(projectFile, 'utf8');
    res.json(JSON.parse(projectData));
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(404).json({ error: 'Project not found' });
  }
});

// Load project by path for the new interface
app.get('/api/load-project/:projectPath', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const scenesFile = path.join(projectDir, '02_scenes', 'scenes.json');
    const dialogueDir = path.join(projectDir, '03_dialogue');
    
    // Load the main project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    
    // Try to load scenes if they exist
    let scenesData = null;
    try {
      const scenesContent = await fs.readFile(scenesFile, 'utf8');
      const scenesJson = JSON.parse(scenesContent);
      // Handle both old and new scene formats
      if (scenesJson.scenes) {
        scenesData = scenesJson.scenes;
      } else {
        scenesData = scenesJson;
      }
      console.log(`Scenes loaded for project ${projectPath}:`, Object.keys(scenesData));
    } catch (error) {
      console.log(`No scenes found for project ${projectPath}`);
    }
    
    // Try to load dialogue files if they exist
    let dialogueData = {};
    try {
      const dialogueFiles = await fs.readdir(dialogueDir);
      console.log(`Found dialogue files for project ${projectPath}:`, dialogueFiles);
      
      for (const file of dialogueFiles) {
        if (file.endsWith('.txt')) {
          try {
            const content = await fs.readFile(path.join(dialogueDir, file), 'utf8');
            // Extract scene identifier from filename (remove extension and hash)
            const sceneId = file.replace('.txt', '').replace(/_[a-f0-9]{8}$/, '');
            dialogueData[sceneId] = content;
            console.log(`Loaded dialogue for scene: ${sceneId}`);
          } catch (error) {
            console.log(`Error reading dialogue file ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.log(`No dialogue directory found for project ${projectPath}`);
    }
    
    // Return comprehensive project data
    const fullProjectData = {
      projectPath: projectPath,
      projectId: projectData.projectId,
      storyInput: projectData.storyInput,
      template: projectData.template,
      structure: projectData.structure,
      scenes: scenesData,
      dialogue: dialogueData,
      generatedAt: projectData.generatedAt
    };
    
    res.json(fullProjectData);
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(404).json({ error: 'Project not found or corrupted' });
  }
});

// Delete project endpoint
app.delete('/api/project/:projectPath', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const projectDir = path.join(__dirname, 'generated', projectPath);
    
    // Check if project directory exists
    try {
      await fs.access(projectDir);
    } catch (error) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Recursively delete the project directory
    await fs.rm(projectDir, { recursive: true, force: true });
    
    console.log(`Project deleted: ${projectPath}`);
    res.json({ message: 'Project deleted successfully', projectPath });
    
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project', details: error.message });
  }
});

// Preview scene generation prompt
app.post('/api/preview-scene-prompt', async (req, res) => {
  try {
    const { storyInput, structureElement, sceneCount = 3, existingScene = null, sceneIndex = null, projectPath = null } = req.body;
    
    let prompt, systemMessage, hierarchicalPrompt = null;
    
    // Try to build hierarchical context if we have project information
    if (projectPath && storyInput) {
      try {
        // Initialize and load hierarchical context
        const context = new HierarchicalContext();
        
        // Build story context
        context.buildStoryContext(storyInput);
        
        // Try to load project structure and template
        try {
          const projectDir = path.join(__dirname, 'generated', projectPath);
          const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
          const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
          
          if (projectData.structure && projectData.template) {
            context.buildStructureContext(projectData.structure, projectData.template);
            
            // Find the structure key for this element
            const structureKey = Object.keys(projectData.structure).find(key => 
              projectData.structure[key].name === structureElement.name ||
              key === structureElement.key
            );
            
            if (structureKey) {
              const actPosition = Object.keys(projectData.structure).indexOf(structureKey) + 1;
              context.buildActContext(structureKey, structureElement, actPosition);
              
              // Try to load plot points for this act
              try {
                const plotPointsFile = path.join(projectDir, '02_plot_points', `${structureKey}_plot_points.json`);
                const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
                if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
                  await context.buildPlotPointsContext(plotPointsData.plotPoints, sceneCount);
                  
                  // If generating an individual scene, build scene context
                  if (existingScene && sceneIndex !== null) {
                    context.buildSceneContext(sceneIndex, sceneIndex, existingScene, sceneCount);
                  }
                }
              } catch (plotError) {
                console.log(`No plot points found for this act (${structureKey}), using basic context`);
              }
            }
          }
        } catch (projectError) {
          console.log('Could not load full project context, using basic story context');
        }
        
        // Generate hierarchical prompt
        const customInstructions = existingScene && sceneIndex !== null ? 
          `SCENE REGENERATION REQUIREMENTS:
- Position: Scene ${sceneIndex + 1} in this structural element
- Current title: ${existingScene.title || 'New Scene'}
- Create a single scene that fits this structural element
- Make it cinematic and specific, not just a plot summary
- Scene should advance the plot and character development described above
- Include: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats` :
          `SCENE GENERATION REQUIREMENTS:
1. Create exactly ${sceneCount} scenes that develop this structural element
2. Each scene should advance the plot and character development described above
3. Make scenes cinematic and specific, not just plot summaries
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Each scene needs: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats
6. Use any available plot points as guidance for narrative flow
7. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic`;
        
        hierarchicalPrompt = context.generateHierarchicalPrompt(5, customInstructions);
        
        if (existingScene && sceneIndex !== null) {
          prompt = `${hierarchicalPrompt}

Return ONLY valid JSON in this exact format:
{
  "title": "Scene Title",
  "location": "Specific location", 
  "time_of_day": "Morning/Afternoon/Evening/Night",
  "description": "What happens in this scene - be specific and visual",
  "characters": ["Character1", "Character2"],
  "emotional_beats": ["primary emotion", "secondary emotion"]
}`;
        } else {
          prompt = `${hierarchicalPrompt}

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "title": "Scene Title",
      "location": "Specific location",
      "time_of_day": "Morning/Afternoon/Evening/Night", 
      "description": "What happens in this scene - be specific and visual",
      "characters": ["Character1", "Character2"],
      "emotional_beats": ["primary emotion", "secondary emotion"]
    }
  ]
}`;
        }
        
        systemMessage = "You are a professional screenwriter generating scenes within a hierarchical story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.";
        
      } catch (contextError) {
        console.log('Failed to build hierarchical context, falling back to simple prompt:', contextError);
        hierarchicalPrompt = null;
      }
    }
    
    // Fallback to simple prompt if hierarchical context failed
    if (!hierarchicalPrompt) {
      if (existingScene && sceneIndex !== null) {
        // Individual scene regeneration prompt
        prompt = `Regenerate a single scene for "${storyInput.title}".

STORY CONTEXT:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Characters: ${storyInput.characters}
- Genre/Tone: ${storyInput.genre || storyInput.tone}

STRUCTURAL ELEMENT:
- Name: ${structureElement.name}
- Description: ${structureElement.description}
- Character Development: ${structureElement.character_development || 'Not specified'}

SCENE TO REGENERATE:
- Position: Scene ${sceneIndex + 1} in this structural element
- Current title: ${existingScene.title || 'New Scene'}

REQUIREMENTS:
1. Create a single scene that fits this structural element
2. Make it cinematic and specific, not just a plot summary
3. Scene should advance the plot and character development described above
4. Include: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats

Return ONLY valid JSON in this exact format:
{
  "title": "Scene Title",
  "location": "Specific location",
  "time_of_day": "Morning/Afternoon/Evening/Night",
  "description": "What happens in this scene - be specific and visual",
  "characters": ["Character1", "Character2"],
  "emotional_beats": ["primary emotion", "secondary emotion"]
}`;
      } else {
        // Multiple scenes generation prompt
        prompt = `Create ${sceneCount} detailed scenes for this specific structural element of "${storyInput.title}".

STORY CONTEXT:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Characters: ${storyInput.characters}
- Genre/Tone: ${storyInput.genre || storyInput.tone}

STRUCTURAL ELEMENT TO DEVELOP:
- Name: ${structureElement.name}
- Description: ${structureElement.description}
- Character Development: ${structureElement.character_development || 'Not specified'}

REQUIREMENTS:
1. Create exactly ${sceneCount} scenes that develop this structural element
2. Each scene should advance the plot and character development described above
3. Make scenes cinematic and specific, not just plot summaries
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Each scene needs: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats
6. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "title": "Scene Title",
      "location": "Specific location",
      "time_of_day": "Morning/Afternoon/Evening/Night",
      "description": "What happens in this scene - be specific and visual",
      "characters": ["Character1", "Character2"],
      "emotional_beats": ["primary emotion", "secondary emotion"]
    }
  ]
}`;
      }
      
      systemMessage = "Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.";
    }

    res.json({
      prompt: prompt,
      systemMessage: systemMessage,
      promptType: existingScene ? 'individual_scene' : 'multiple_scenes',
      structureElement: structureElement,
      hierarchicalPrompt: hierarchicalPrompt,
      usedHierarchicalContext: !!hierarchicalPrompt
    });
  } catch (error) {
    console.error('Error generating scene prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate scene prompt preview' });
  }
});

// Preview plot point generation prompt
app.post('/api/preview-plot-point-prompt', async (req, res) => {
  try {
    const { storyInput, allScenes, targetScene = null, sceneIndex = null, structureElement = null } = req.body;
    
    let prompt, systemMessage;
    
    if (targetScene && sceneIndex !== null && structureElement) {
      // Individual plot point generation prompt
      const previousScene = sceneIndex > 0 ? allScenes[sceneIndex - 1] : null;
      const nextScene = sceneIndex < allScenes.length - 1 ? allScenes[sceneIndex + 1] : null;
      
      prompt = `You are a master screenwriter creating a plot point that connects scenes with clear causal relationships.

STORY CONTEXT:
Title: ${storyInput.title}
Logline: ${storyInput.logline}
Characters: ${storyInput.characters}
Genre: ${storyInput.genre || storyInput.tone}

STRUCTURAL CONTEXT:
This scene belongs to: ${structureElement.name}
Purpose: ${structureElement.description}

TARGET SCENE:
Title: ${targetScene.title || targetScene.name}
Description: ${targetScene.description}
Location: ${targetScene.location || 'Not specified'}

CONTEXT:
${previousScene ? `Previous Scene: ${previousScene.title} - ${previousScene.description}` : 'This is the first scene'}
${nextScene ? `Next Scene: ${nextScene.title} - ${nextScene.description}` : 'This is the final scene'}

TASK: Generate a single plot point for the target scene that:

1. Is a clear, concise sentence capturing the scene's key story beat
2. ${previousScene ? 'Connects causally to the previous scene (using "BUT" for conflict or "THEREFORE" for consequence - avoid "and then")' : 'Establishes the initial situation clearly'}
3. ${nextScene ? 'Sets up the next scene logically' : 'Provides satisfying closure'}
4. Maintains narrative momentum and character development
5. Is specific to this scene's content and purpose

Return ONLY a JSON object:
{
  "plotPoint": "Your single plot point sentence here"
}`;
      
      systemMessage = "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events - never internal feelings. Focus on visual conflicts, character choices under pressure, and specific dramatic situations with urgency.";
    } else {
      // All plot points generation prompt
      prompt = `You are a master screenwriter creating plot points that connect scenes with clear causal relationships.

STORY CONTEXT:
Title: ${storyInput.title}
Logline: ${storyInput.logline}
Characters: ${storyInput.characters}
Genre: ${storyInput.genre || storyInput.tone}
Tone: ${storyInput.tone}

SCENES TO CONNECT:
${allScenes.map((scene, index) => `
Scene ${index + 1} (${scene.structureElement}): ${scene.title}
- Description: ${scene.description}
- Location: ${scene.location}
`).join('')}

TASK: Generate a plot point for each scene that creates clear causal connections between scenes using "BUT" and "THEREFORE" logic (avoid weak "and then" sequencing). Each plot point should:

1. Be a single, clear sentence that captures the scene's key story beat
2. Connect causally to the previous scene (using "BUT" for conflict or "THEREFORE" for consequence - avoid "and then")
3. Set up the next scene logically
4. Maintain narrative momentum and character development
5. Be specific to the scene's content and purpose

Return ONLY a JSON object with this structure:
{
  "plotPoints": [
    "Scene 1 plot point that establishes the initial situation",
    "But Scene 2 plot point that introduces conflict or complication from Scene 1",
    "Therefore Scene 3 plot point that shows the consequence or progress from Scene 2",
    // ... continue for all ${allScenes.length} scenes
  ]
}

Focus on creating a strong narrative spine where each scene leads logically to the next through conflict and consequence.`;
      
      systemMessage = "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events - never internal feelings. Focus on visual conflicts, character choices under pressure, and specific dramatic situations with urgency.";
    }

    res.json({
      prompt: prompt,
      systemMessage: systemMessage,
      promptType: targetScene ? 'individual_plot_point' : 'all_plot_points',
      targetScene: targetScene,
      sceneIndex: sceneIndex
    });
  } catch (error) {
    console.error('Error generating plot point prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate plot point prompt preview' });
  }
});

// Preview plot point generation prompt for specific act (new endpoint)
app.post('/api/preview-act-plot-points-prompt', async (req, res) => {
  try {
    const { projectPath, structureKey, desiredSceneCount = 3 } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    const storyAct = structure[structureKey];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
    context.buildActContext(structureKey, storyAct, actPosition);
    
    // Build plot points context to load previous acts' plot points for preview
    await context.buildPlotPointsContext([], 0, projectPath);
    
    // Generate hierarchical prompt for plot points generation (Level 4) with inter-act causality
    const hierarchicalPrompt = context.generateHierarchicalPrompt(4, `
PLOT POINTS GENERATION WITH INTER-ACT CAUSALITY:
1. Break down this story act into ${desiredSceneCount} causally connected plot points
2. CRITICAL: If previous acts' plot points are shown above, your FIRST plot point must logically continue from the last plot point of the previous act
3. Each plot point must describe a CONCRETE ACTION or EVENT that happens - not internal feelings
4. Focus on external, visual story beats that could be filmed - what does the audience SEE happening?
5. Plot points should connect causally using "BUT" (conflict) and "THEREFORE" (consequence)
6. Show character development through ACTIONS and CHOICES, not internal monologue
7. Each plot point should create a specific dramatic situation or encounter
8. Make events unpredictable and cinematic while serving the character arc
9. Do NOT reference specific scene content - these plot points will guide scene creation

INTER-ACT CAUSAL CONNECTION:
- If there's a "CONNECT FROM" instruction above, begin this act as a direct consequence of that previous plot point
- Use "THEREFORE" to show how this act follows logically from the previous act's conclusion
- Don't repeat previous events, but build upon their consequences
- Maintain character momentum and story energy across act boundaries

CHARACTER ARC THROUGH ACTION:
- Show character growth through CHOICES under pressure
- Reveal personality through HOW characters act, not what they think
- Use physical behavior to show emotional states
- Force characters to make decisions that reveal their true nature

CINEMATIC SPECIFICITY:
- Include specific locations that serve the story (not just "a room")
- Add time pressure or urgency to create tension
- Introduce physical obstacles or concrete goals
- Create visual conflicts that can be filmed dramatically

EXAMPLES OF GOOD PLOT POINTS:
- "She saves a child from a burning building"
- "Police surround him with weapons drawn"  
- "He breaks into an abandoned school to sleep"
- "He must choose between saving his friend or escaping before the building collapses"
- "She discovers the hidden evidence just as her phone battery dies"

AVOID internal states like "feels lonely" or "contemplates" - show these through what the character DOES.

Create ${desiredSceneCount} plot points using "But and Therefore" logic to create dramatic tension and causal flow.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY a JSON object with this exact structure:
{
  "plotPoints": [
    "Plot point 1 that establishes the situation for this act",
    "But plot point 2 that introduces conflict or complication", 
    "Therefore plot point 3 that shows the consequence or progress"
  ]
}`;

    const systemMessage = "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events - never internal feelings. Focus on visual conflicts, character choices under pressure, and specific dramatic situations with urgency. Always respond with valid JSON.";

    res.json({
      prompt: prompt,
      systemMessage: systemMessage,  
      promptType: 'act_plot_points',
      storyAct: storyAct,
      structureKey: structureKey,
      desiredSceneCount: desiredSceneCount,
      hierarchicalPrompt: hierarchicalPrompt
    });

  } catch (error) {
    console.error('Error generating act plot points prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate act plot points prompt preview', details: error.message });
  }
});

// Generate multiple scenes for a specific plot point
app.post('/api/generate-scenes-for-plot-point/:projectPath/:actKey/:plotPointIndex', async (req, res) => {
  try {
    const { projectPath, actKey, plotPointIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const plotPointsFile = path.join(projectDir, '02_plot_points', `${actKey}_plot_points.json`);
    
    // Load plot points data with scene distribution
    let plotPointsData;
    try {
      plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
    } catch (error) {
      return res.status(400).json({ error: 'Plot points file not found. Please generate plot points for this act first.' });
    }
    
    const plotPointIndexNum = parseInt(plotPointIndex);
    if (plotPointIndexNum < 0 || plotPointIndexNum >= plotPointsData.plotPoints.length) {
      return res.status(400).json({ error: 'Invalid plot point index' });
    }
    
    const sceneDistribution = plotPointsData.sceneDistribution || [];
    const plotPointInfo = sceneDistribution[plotPointIndexNum];
    
    if (!plotPointInfo) {
      return res.status(400).json({ error: 'Scene distribution not found. Please regenerate plot points.' });
    }
    
    const sceneCount = plotPointInfo.sceneCount;
    const plotPoint = plotPointInfo.plotPoint;
    
    console.log(`Generating ${sceneCount} scenes for plot point ${plotPointIndexNum + 1}: "${plotPoint}"`);
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(actKey) + 1;
    context.buildActContext(actKey, structure[actKey], actPosition);
    
    // Build plot points context
    await context.buildPlotPointsContext(plotPointsData.plotPoints, plotPointsData.totalScenesForAct);
    
    // Build scene context for this specific plot point
    context.buildSceneContext(0, plotPointIndexNum, null, sceneCount);
    
    // Generate hierarchical prompt for multiple scenes from one plot point
    const hierarchicalPrompt = context.generateHierarchicalPrompt(5, `
MULTIPLE SCENES GENERATION FROM SINGLE PLOT POINT:
1. Create exactly ${sceneCount} scenes that collectively implement this plot point: "${plotPoint}"
2. Break the plot point into a ${sceneCount}-scene sequence that shows progression
3. Each scene should advance this plot point's dramatic purpose step-by-step
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Create a natural flow between scenes in this sequence
6. Each scene needs: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats
7. Scenes should feel like organic parts of a sequence, not isolated fragments
8. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

This plot point is ${plotPointInfo.isKeyPlot ? 'a KEY plot point' : 'a regular plot point'} in the story structure.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "title": "Scene Title",
      "location": "Specific location",
      "time_of_day": "Morning/Afternoon/Evening/Night",
      "description": "What happens in this scene - be specific and visual",
      "characters": ["Character1", "Character2"],
      "emotional_beats": ["primary emotion", "secondary emotion"],
      "plotPointIndex": ${plotPointIndexNum},
      "sequencePosition": 1
    }
  ]
}`;

    console.log(`Calling Anthropic API for ${sceneCount} scenes from plot point...`);
    
    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 3000,
      temperature: 0.7,
      system: "You are a professional screenwriter generating scene sequences within a hierarchical story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    let scenesData;
    try {
      scenesData = JSON.parse(completion.content[0].text);
      console.log(`Generated ${scenesData.scenes.length} scenes for plot point`);
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to parse AI response', 
        rawResponse: completion.content[0].text.substring(0, 500) + "..."
      });
    }

    // Save scenes to a dedicated file
    const scenesDir = path.join(projectDir, '03_scenes', actKey);
    await fs.mkdir(scenesDir, { recursive: true });
    
    const scenesFile = path.join(scenesDir, `plot_point_${plotPointIndexNum}_scenes.json`);
    await fs.writeFile(scenesFile, JSON.stringify({
      actKey: actKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: plotPoint,
      sceneCount: sceneCount,
      scenes: scenesData.scenes,
      isKeyPlot: plotPointInfo.isKeyPlot,
      generatedAt: new Date().toISOString()
    }, null, 2));

    console.log(`Saved ${scenesData.scenes.length} scenes for plot point ${plotPointIndexNum + 1} to: ${scenesFile}`);

    res.json({
      success: true,
      actKey: actKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: plotPoint,
      scenes: scenesData.scenes,
      sceneCount: scenesData.scenes.length,
      message: `Generated ${scenesData.scenes.length} scenes for plot point: "${plotPoint}"`
    });

  } catch (error) {
    console.error('Error generating scenes for plot point:', error);
    res.status(500).json({ error: 'Failed to generate scenes for plot point', details: error.message });
  }
});

// Generate scenes for a specific structural element
app.post('/api/generate-scene/:projectPath/:structureKey', async (req, res) => {
  try {
    const { projectPath, structureKey } = req.params;
    const { sceneCount = null, model = "claude-sonnet-4-20250514" } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    const structureElement = structure[structureKey];
    
    // Try to get intelligent scene count from multiple sources
    let finalSceneCount = sceneCount; // Use provided count if given
    
    // 1. Check if we have scene distribution from plot points
    try {
      const plotPointsFile = path.join(projectDir, '02_plot_points', `${structureKey}_plot_points.json`);
      const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
      if (plotPointsData.totalScenesForAct) {
        finalSceneCount = plotPointsData.totalScenesForAct;
        console.log(`📈 Using scene count from plot points distribution: ${finalSceneCount} scenes`);
      }
    } catch (plotError) {
      // 2. Check if story structure has predefined scene count
      const preDefinedSceneCount = structureElement.scene_count || structure[structureKey]?.scene_count;
      if (preDefinedSceneCount && !finalSceneCount) {
        finalSceneCount = preDefinedSceneCount;
        console.log(`🎭 Using predefined scene count from story structure: ${finalSceneCount} scenes`);
      }
    }
    
    // 3. Fallback to default
    if (!finalSceneCount) {
      finalSceneCount = 3;
      console.log(`⚠️  No scene distribution found, using default: ${finalSceneCount} scenes`);
    }
    
    console.log(`🎬 Generating ${finalSceneCount} scenes for ${structureKey} in project: ${projectPath}`);
    
    let prompt;
    let useHierarchicalContext = false;
    
    // Try to use hierarchical context, but fall back to simple prompt if it fails
    try {
      // Initialize and load hierarchical context for this project
      const context = new HierarchicalContext();
      await context.loadFromProject(projectPath);
      
      // If context doesn't exist, rebuild it from project data
      if (!context.contexts.story) {
        console.log('Rebuilding context from project data...');
        context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
        context.buildStructureContext(structure, projectData.template);
      }
      
      // Build act context for this specific structural element
      const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
      context.buildActContext(structureKey, structureElement, actPosition);
      
      // Try to load plot points for this act
      let plotPoints = [];
      try {
        const plotPointsFile = path.join(projectDir, '02_plot_points', `${structureKey}_plot_points.json`);
        const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
        if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
          plotPoints = plotPointsData.plotPoints;
          console.log(`Loaded ${plotPoints.length} plot points for ${structureKey}`);
        }
      } catch (plotError) {
        console.log(`No plot points found for this act (${structureKey}), generating scenes without plot point guidance`);
        console.log(`Looked for file: ${path.join(projectDir, '02_plot_points', `${structureKey}_plot_points.json`)}`);
        // Use placeholder plot points
        plotPoints = Array(finalSceneCount).fill(0).map((_, i) => `Scene ${i + 1} plot point for ${structureElement.name}`);
      }
      
      // Build plot points context
      await context.buildPlotPointsContext(plotPoints, finalSceneCount);
      
      // Generate hierarchical prompt using context system
      console.log('About to generate hierarchical prompt...');
      const hierarchicalPrompt = context.generateHierarchicalPrompt(5, `
SCENE GENERATION REQUIREMENTS:
1. Create exactly ${finalSceneCount} scenes that develop this structural element
2. Each scene should advance the plot and character development described above
3. Make scenes cinematic and specific, not just plot summaries
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Each scene needs: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats
6. Use the available plot points as guidance for narrative flow and causal connections
7. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

The scenes you generate should feel like organic parts of the complete story structure, not isolated fragments.`);
      
      console.log('Hierarchical prompt generated successfully');
      
      prompt = `${hierarchicalPrompt}

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "title": "Scene Title",
      "location": "Specific location",
      "time_of_day": "Morning/Afternoon/Evening/Night",
      "description": "What happens in this scene - be specific and visual",
      "characters": ["Character1", "Character2"],
      "emotional_beats": ["primary emotion", "secondary emotion"]
    }
  ]
}`;
      
      console.log('About to save context to project...');
      
      // Save updated context to project
      await context.saveToProject(projectPath);
      
      console.log('Context saved successfully');
      
      useHierarchicalContext = true;
      console.log('Using hierarchical context for scene generation');
      
    } catch (contextError) {
      console.error('Failed to build hierarchical context, falling back to simple prompt:', contextError);
      
      // Fallback to simple prompt
      prompt = `Create ${finalSceneCount} detailed scenes for this specific structural element of "${storyInput.title}".

STORY CONTEXT:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Characters: ${storyInput.characters}
- Genre/Tone: ${storyInput.genre || storyInput.tone}

STRUCTURAL ELEMENT TO DEVELOP:
- Name: ${structureElement.name}
- Description: ${structureElement.description}
- Character Development: ${structureElement.character_development || 'Not specified'}

REQUIREMENTS:
1. Create exactly ${finalSceneCount} scenes that develop this structural element
2. Each scene should advance the plot and character development described above
3. Make scenes cinematic and specific, not just plot summaries
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Each scene needs: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats
6. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "title": "Scene Title",
      "location": "Specific location",
      "time_of_day": "Morning/Afternoon/Evening/Night",
      "description": "What happens in this scene - be specific and visual",
      "characters": ["Character1", "Character2"],
      "emotional_beats": ["primary emotion", "secondary emotion"]
    }
  ]
}`;
    }

    console.log('About to call Anthropic API for scene generation...');
    console.log('Prompt length:', prompt.length);
    console.log('Model:', model);
    console.log('Anthropic client configured:', !!anthropic);
    console.log('API key available:', !!process.env.ANTHROPIC_API_KEY);
    
    // Add timeout and better error handling
    let completion;
    try {
      console.log('Creating Anthropic API request...');
      
      const apiRequest = {
        model: model,
        max_tokens: 2000,
        temperature: 0.7,
        system: useHierarchicalContext ? 
          "You are a professional screenwriter generating scenes within a hierarchical story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON." :
          "Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
      };
      
      console.log('API request configured, making call...');
      
      // Add a timeout wrapper
      completion = await Promise.race([
        anthropic.messages.create(apiRequest),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API call timed out after 30 seconds')), 30000)
        )
      ]);
      
      console.log('Anthropic API call completed successfully');
      console.log('Response received, content length:', completion.content?.[0]?.text?.length || 0);
      
    } catch (apiError) {
      console.error('Anthropic API call failed:', apiError);
      console.error('Error name:', apiError.name);
      console.error('Error message:', apiError.message);
      console.error('Error stack:', apiError.stack);
      
      return res.status(500).json({ 
        error: 'Failed to call Anthropic API', 
        details: apiError.message,
        errorName: apiError.name,
        promptLength: prompt.length,
        hasApiKey: !!process.env.ANTHROPIC_API_KEY
      });
    }

    let scenesData;
    try {
      console.log('About to parse AI response...');
      console.log('Response length:', completion.content[0].text.length);
      
      scenesData = JSON.parse(completion.content[0].text);
      console.log(`Generated ${scenesData.scenes.length} scenes for ${structureKey}`);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response:', completion.content[0].text.substring(0, 1000));
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: error.message,
        rawResponse: completion.content[0].text.substring(0, 500) + "..."
      });
    }

    console.log('About to save scenes to file...');
    
    // Load existing scenes file or create new one
    const scenesDir = path.join(projectDir, '02_scenes');
    const scenesFile = path.join(scenesDir, 'scenes.json');
    
    console.log('Scenes directory:', scenesDir);
    console.log('Scenes file:', scenesFile);
    
    let allScenes = { scenes: {}, storyInput };
    try {
      const existingContent = await fs.readFile(scenesFile, 'utf8');
      allScenes = JSON.parse(existingContent);
      console.log('Loaded existing scenes file');
    } catch (error) {
      console.log('No existing scenes file, creating new one');
    }

    // Update the specific structural element
    allScenes.scenes[structureKey] = {
      scenes: scenesData.scenes
    };
    allScenes.lastUpdated = new Date().toISOString();

    console.log('About to write scenes file...');
    
    // Save updated scenes
    await fs.writeFile(scenesFile, JSON.stringify(allScenes, null, 2));
    
    console.log(`Scenes for ${structureKey} saved to: ${scenesDir}`);

    res.json({ 
      scenes: scenesData.scenes,
      structureKey,
      projectPath,
      message: `Scenes generated successfully for ${structureElement.name}`
    });
  } catch (error) {
    console.error('Error generating scene:', error);
    res.status(500).json({ error: 'Failed to generate scene', details: error.message });
  }
});

// Generate a single scene for a specific structural element and scene index
app.post('/api/generate-individual-scene/:projectPath/:structureKey/:sceneIndex', async (req, res) => {
  try {
    const { projectPath, structureKey, sceneIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const scenesFile = path.join(projectDir, '02_scenes', 'scenes.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    // Load existing scenes to get context
    let existingScenes = {};
    try {
      const scenesData = JSON.parse(await fs.readFile(scenesFile, 'utf8'));
      existingScenes = scenesData.scenes || {};
    } catch (error) {
      console.log('No existing scenes found, generating fresh scene');
    }
    
    const structureElement = structure[structureKey];
    const elementScenes = existingScenes[structureKey]?.scenes || [];
    const existingScene = elementScenes[sceneIndexNum];
    
    console.log(`Regenerating scene ${sceneIndexNum + 1} for ${structureKey} in project: ${projectPath}`);
    
    // Initialize and load hierarchical context for this project
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    // If context doesn't exist, rebuild it from project data
    if (!context.contexts.story) {
      console.log('Rebuilding context from project data...');
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context for this specific structural element
    const elementPosition = Object.keys(structure).indexOf(structureKey) + 1;
    context.buildActContext(structureKey, structureElement, elementPosition);
    
    // First, we need plot points for this element (if they don't exist, we'll need to generate them)
    // For now, let's create a placeholder plot points context
    const existingPlotPoints = ['Placeholder plot point for this scene']; // This should come from actual plot points generation
    await context.buildPlotPointsContext(existingPlotPoints, elementScenes.length);
    
    // Build scene context with assigned plot point
    const plotPointIndex = sceneIndexNum; // Assuming 1:1 mapping for now
    context.buildSceneContext(sceneIndexNum, plotPointIndex, existingScene, elementScenes.length);
    
    // Generate hierarchical prompt using context system
    const hierarchicalPrompt = context.generateHierarchicalPrompt(5, `
SCENE GENERATION REQUIREMENTS:
1. This scene must serve the OVERALL STORY STRUCTURE and advance the narrative
2. It must fulfill the specific PURPOSE of its structural element
3. It must advance any CHARACTER DEVELOPMENT noted for this element
4. It must deliver the ASSIGNED PLOT POINT specified above
5. Make it cinematic and specific, not just a plot summary
6. Include: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats

The scene you generate should feel like an organic part of the complete story structure, not an isolated fragment.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY valid JSON in this exact format:
{
  "title": "Scene Title",
  "location": "Specific location", 
  "time_of_day": "Morning/Afternoon/Evening/Night",
  "description": "What happens in this scene - be specific and visual",
  "characters": ["Character1", "Character2"],
  "emotional_beats": ["primary emotion", "secondary emotion"]
}`;

    // Save updated context to project
    await context.saveToProject(projectPath);

    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 1000,
      temperature: 0.7,
      system: "Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    let sceneData;
    try {
      sceneData = JSON.parse(completion.content[0].text);
      console.log(`Generated individual scene: ${sceneData.title}`);
    } catch (error) {
      console.log('Failed to parse AI response:', error);
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: error.message,
        rawResponse: completion.content[0].text.substring(0, 500) + "..."
      });
    }

    // Load existing scenes file or create new structure
    let allScenes = { scenes: {}, storyInput };
    try {
      const existingContent = await fs.readFile(scenesFile, 'utf8');
      allScenes = JSON.parse(existingContent);
    } catch (error) {
      // File doesn't exist yet, use default structure
    }

    // Ensure the structure exists
    if (!allScenes.scenes[structureKey]) {
      allScenes.scenes[structureKey] = { scenes: [] };
    }

    // Update the specific scene
    allScenes.scenes[structureKey].scenes[sceneIndexNum] = sceneData;
    allScenes.lastUpdated = new Date().toISOString();

    // Save updated scenes
    await fs.writeFile(scenesFile, JSON.stringify(allScenes, null, 2));
    
    console.log(`Individual scene ${sceneIndexNum + 1} for ${structureKey} saved`);

    res.json({ 
      scene: sceneData,
      structureKey,
      sceneIndex: sceneIndexNum,
      projectPath,
      message: `Scene ${sceneIndexNum + 1} regenerated successfully`
    });
  } catch (error) {
    console.error('Error generating individual scene:', error);
    res.status(500).json({ error: 'Failed to generate individual scene', details: error.message });
  }
});

// Generate plot points for all scenes with causal connections
app.post('/api/generate-plot-points/:projectPath', async (req, res) => {
  try {
    const { projectPath } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const scenesFile = path.join(projectDir, '02_scenes', 'scenes.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    // Load existing scenes
    const scenesFileData = JSON.parse(await fs.readFile(scenesFile, 'utf8'));
    console.log('Loaded scenes data structure:', Object.keys(scenesFileData));
    console.log('Sample scenes data:', JSON.stringify(scenesFileData, null, 2).substring(0, 500));
    
    // Extract the actual scenes data (handle nested structure)
    const scenesData = scenesFileData.scenes || scenesFileData;
    
    // Create a comprehensive context for plot point generation
    const allScenes = [];
    const sceneStructureMap = [];
    
    Object.entries(scenesData).forEach(([structureKey, sceneGroup]) => {
      // Handle both formats: direct array or nested object with scenes property
      let scenes = Array.isArray(sceneGroup) ? sceneGroup : sceneGroup.scenes;
      
      if (scenes && Array.isArray(scenes)) {
        scenes.forEach((scene, index) => {
          allScenes.push({
            title: scene.title || scene.name || 'Untitled Scene',
            description: scene.description || '',
            location: scene.location || '',
            structureElement: structure[structureKey]?.name || structureKey
          });
          sceneStructureMap.push({ structureKey, sceneIndex: index });
        });
      }
    });
    
    const prompt = `You are a master screenwriter creating plot points that connect scenes with clear causal relationships.

STORY CONTEXT:
Title: ${storyInput.title}
Logline: ${storyInput.logline}
Characters: ${storyInput.characters}
Genre: ${storyInput.genre || storyInput.tone}
Tone: ${storyInput.tone}

SCENES TO CONNECT:
${allScenes.map((scene, index) => `
Scene ${index + 1} (${scene.structureElement}): ${scene.title}
- Description: ${scene.description}
- Location: ${scene.location}
`).join('')}

TASK: Generate a plot point for each scene that creates clear causal connections between scenes using "BUT" and "THEREFORE" logic (avoid weak "and then" sequencing). Each plot point should:

1. Be a single, clear sentence that captures the scene's key story beat
2. Connect causally to the previous scene (using "BUT" for conflict or "THEREFORE" for consequence - avoid "and then")
3. Set up the next scene logically
4. Maintain narrative momentum and character development
5. Be specific to the scene's content and purpose

Return ONLY a JSON object with this structure:
{
  "plotPoints": [
    "Scene 1 plot point that establishes the initial situation",
    "But Scene 2 plot point that introduces conflict or complication from Scene 1",
    "Therefore Scene 3 plot point that shows the consequence or progress from Scene 2",
    // ... continue for all ${allScenes.length} scenes
  ]
}

Focus on creating a strong narrative spine where each scene leads logically to the next through conflict and consequence.`;

    console.log('Sending plot points request to Claude API...');
    console.log('Number of scenes found:', allScenes.length);
    console.log('First few scenes:', allScenes.slice(0, 3));
    console.log('Prompt being sent (first 1000 chars):', prompt.substring(0, 1000));
    
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    console.log('Received plot points response from Claude API');
    const rawResponse = response.content[0].text;
    console.log('Raw AI response:', rawResponse.substring(0, 500) + '...');
    
    let plotPointsData;
    try {
      // Try to extract JSON from the response
      let jsonString = rawResponse;
      
      // Look for JSON object in the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      plotPointsData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse plot points response:', parseError);
      console.error('Raw response was:', rawResponse);
      throw new Error('Invalid response format from AI');
    }
    
    if (!plotPointsData.plotPoints || !Array.isArray(plotPointsData.plotPoints)) {
      throw new Error('Invalid plot points structure received');
    }
    
    // Map plot points back to their structural elements
    const plotPointsByStructure = {};
    plotPointsData.plotPoints.forEach((plotPoint, index) => {
      const mapping = sceneStructureMap[index];
      if (mapping) {
        if (!plotPointsByStructure[mapping.structureKey]) {
          plotPointsByStructure[mapping.structureKey] = [];
        }
        plotPointsByStructure[mapping.structureKey][mapping.sceneIndex] = plotPoint;
      }
    });
    
    console.log('Plot points generated successfully');
    res.json({
      success: true,
      message: `Generated ${plotPointsData.plotPoints.length} connected plot points`,
      plotPoints: plotPointsByStructure
    });
    
  } catch (error) {
    console.error('Error generating plot points:', error);
    res.status(500).json({ error: error.message || 'Failed to generate plot points' });
  }
});

// Generate a single plot point for a specific scene
app.post('/api/generate-plot-point/:projectPath/:structureKey/:sceneIndex', async (req, res) => {
  try {
    const { projectPath, structureKey, sceneIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const scenesFile = path.join(projectDir, '02_scenes', 'scenes.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    // Load existing scenes
    const scenesFileData = JSON.parse(await fs.readFile(scenesFile, 'utf8'));
    
    // Extract the actual scenes data (handle nested structure)
    const scenesData = scenesFileData.scenes || scenesFileData;
    
    // Handle both formats: direct array or nested object with scenes property
    let scenes = Array.isArray(scenesData[structureKey]) ? scenesData[structureKey] : scenesData[structureKey]?.scenes;
    
    if (!scenes || !Array.isArray(scenes) || !scenes[sceneIndexNum]) {
      return res.status(400).json({ error: 'Scene not found' });
    }
    
    const targetScene = scenes[sceneIndexNum];
    const structureElement = structure[structureKey];
    
    // Get context from surrounding scenes
    const allScenes = [];
    Object.entries(scenesData).forEach(([key, sceneGroup]) => {
      // Handle both formats: direct array or nested object with scenes property
      let scenes = Array.isArray(sceneGroup) ? sceneGroup : sceneGroup.scenes;
      
      if (scenes && Array.isArray(scenes)) {
        scenes.forEach((scene, index) => {
          allScenes.push({
            title: scene.title || scene.name || 'Untitled Scene',
            description: scene.description || '',
            isTarget: key === structureKey && index === sceneIndexNum,
            structureElement: structure[key]?.name || key
          });
        });
      }
    });
    
    const targetSceneIndex = allScenes.findIndex(scene => scene.isTarget);
    const previousScene = targetSceneIndex > 0 ? allScenes[targetSceneIndex - 1] : null;
    const nextScene = targetSceneIndex < allScenes.length - 1 ? allScenes[targetSceneIndex + 1] : null;
    
    const prompt = `You are a master screenwriter creating a plot point that connects scenes with clear causal relationships.

STORY CONTEXT:
Title: ${storyInput.title}
Logline: ${storyInput.logline}
Characters: ${storyInput.characters}
Genre: ${storyInput.genre || storyInput.tone}

STRUCTURAL CONTEXT:
This scene belongs to: ${structureElement.name}
Purpose: ${structureElement.description}

TARGET SCENE:
Title: ${targetScene.title || targetScene.name}
Description: ${targetScene.description}
Location: ${targetScene.location || 'Not specified'}

CONTEXT:
${previousScene ? `Previous Scene: ${previousScene.title} - ${previousScene.description}` : 'This is the first scene'}
${nextScene ? `Next Scene: ${nextScene.title} - ${nextScene.description}` : 'This is the final scene'}

TASK: Generate a single plot point for the target scene that:

1. Is a clear, concise sentence capturing the scene's key story beat
2. ${previousScene ? 'Connects causally to the previous scene (using "BUT" for conflict or "THEREFORE" for consequence - avoid "and then")' : 'Establishes the initial situation clearly'}
3. ${nextScene ? 'Sets up the next scene logically' : 'Provides satisfying closure'}
4. Maintains narrative momentum and character development
5. Is specific to this scene's content and purpose

Return ONLY a JSON object:
{
  "plotPoint": "Your single plot point sentence here"
}`;

    console.log(`Generating individual plot point for ${structureKey} scene ${sceneIndexNum}`);
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const rawResponse = response.content[0].text;
    console.log('Raw plot point response:', rawResponse.substring(0, 200) + '...');
    
    let plotPointData;
    try {
      // Try to extract JSON from the response
      let jsonString = rawResponse;
      
      // Look for JSON object in the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      plotPointData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse plot point response:', parseError);
      console.error('Raw response was:', rawResponse);
      throw new Error('Invalid response format from AI');
    }
    
    if (!plotPointData.plotPoint) {
      throw new Error('No plot point received from AI');
    }
    
    console.log(`Generated plot point: ${plotPointData.plotPoint}`);
    res.json({
      success: true,
      message: `Plot point generated for scene`,
      plotPoint: plotPointData.plotPoint
    });
    
  } catch (error) {
    console.error('Error generating individual plot point:', error);
    res.status(500).json({ error: error.message || 'Failed to generate plot point' });
  }
});

// Regenerate scenes from existing project (simple approach - generate fewer scenes)
app.post('/api/regenerate-scenes-simple/:projectPath', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    console.log(`Regenerating scenes (simple) for project: ${projectPath}`);
    
    // Generate scenes distributed across structural elements based on totalScenes
    const totalScenes = storyInput.totalScenes || 70;
    const structureKeys = Object.keys(structure);
    const scenesPerElement = Math.floor(totalScenes / structureKeys.length);
    const extraScenes = totalScenes % structureKeys.length;
    
    console.log(`Distributing ${totalScenes} scenes across ${structureKeys.length} structural elements`);
    console.log(`Base scenes per element: ${scenesPerElement}, Extra scenes: ${extraScenes}`);
    
    const scenesData = {};
    let globalSceneNumber = 1;
    
    Object.entries(structure).forEach(([key, element], index) => {
      // Calculate scenes for this element (some elements get +1 extra scene)
      const scenesForThisElement = scenesPerElement + (index < extraScenes ? 1 : 0);
      
      console.log(`${key}: ${scenesForThisElement} scenes`);
      
      const scenes = [];
      for (let i = 0; i < scenesForThisElement; i++) {
        scenes.push({
          scene_number: globalSceneNumber,
          title: `${element.name || key.replace(/_/g, ' ')} - Part ${i + 1}`,
          location: "Location TBD",
          description: `${element.description || "Scene description TBD"} (Part ${i + 1} of ${scenesForThisElement})`,
          characters: Array.isArray(storyInput.characters) ? storyInput.characters : [storyInput.characters || "Main Character"],
          emotional_beats: element.character_development ? [element.character_development] : ["TBD"],
          structural_element: key,
          part_of_element: `${i + 1}/${scenesForThisElement}`
        });
        globalSceneNumber++;
      }
      
      scenesData[key] = { scenes };
    });

    // Save scenes to local folder
    const scenesDir = path.join(projectDir, '02_scenes');
    
    // Save scenes as JSON
    const scenesFile = path.join(scenesDir, 'scenes.json');
    await fs.writeFile(scenesFile, JSON.stringify({
      scenes: scenesData,
      storyInput,
      generatedAt: new Date().toISOString(),
      method: 'simple_generation'
    }, null, 2));
    
    // Create readable markdown breakdown
    let scenesOverview = `# Scenes Breakdown - ${storyInput.title}\n\n`;
    scenesOverview += `**Generated:** ${new Date().toLocaleString()}\n`;
    scenesOverview += `**Method:** Simple generation (${totalScenes} scenes distributed across ${structureKeys.length} structural elements)\n`;
    scenesOverview += `**Distribution:** ${scenesPerElement} base scenes per element, ${extraScenes} elements get +1 extra scene\n\n`;
    
    Object.entries(scenesData).forEach(([structureKey, structureScenes]) => {
      scenesOverview += `## ${structureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
      structureScenes.scenes.forEach((scene, index) => {
        scenesOverview += `### Scene ${scene.scene_number}: ${scene.title}\n\n`;
        scenesOverview += `**Location:** ${scene.location}\n`;
        scenesOverview += `**Characters:** ${scene.characters.join(', ')}\n\n`;
        scenesOverview += `${scene.description}\n\n`;
        scenesOverview += `**Emotional Beats:** ${scene.emotional_beats.join(', ')}\n\n`;
        scenesOverview += `---\n\n`;
      });
    });
    
    const scenesOverviewFile = path.join(scenesDir, 'scenes_overview.md');
    await fs.writeFile(scenesOverviewFile, scenesOverview);
    
    console.log(`Simple scenes generated and saved to: ${scenesDir}`);
    
    // Count total scenes for debugging
    const totalGeneratedScenes = Object.values(scenesData).reduce((total, element) => {
      return total + (element.scenes ? element.scenes.length : 0);
    }, 0);
    console.log(`Total scenes in response: ${totalGeneratedScenes}`);
    console.log('Scene structure keys:', Object.keys(scenesData));

    res.json({ 
      scenes: scenesData,
      projectPath,
      message: 'Simple scenes generated successfully'
    });
  } catch (error) {
    console.error('Error generating simple scenes:', error);
    res.status(500).json({ error: 'Failed to generate simple scenes', details: error.message });
  }
});

// Regenerate scenes from existing project
app.post('/api/regenerate-scenes/:projectPath', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    console.log(`Regenerating scenes for project: ${projectPath}`);
    
    const prompt = `Create scenes for this story structure. Return ONLY valid JSON.

Title: ${storyInput.title}
Characters: ${storyInput.characters}

Structure: ${JSON.stringify(structure, null, 2)}

For each structural element, create 1-2 scenes with:
- title: scene title
- location: where it happens
- description: 1 sentence what happens
- characters: who is present
- emotional_beats: 1-2 emotions

Format: {"element_name": {"scenes": [{"title": "...", "location": "...", "description": "...", "characters": [...], "emotional_beats": [...]}]}}`;

    const completion = await anthropic.messages.create({
      model: req.body.model || "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.7,
      system: "Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON. Do not truncate the JSON. Complete all structural elements.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    let scenesData;
    try {
      scenesData = JSON.parse(completion.content[0].text);
    } catch {
      scenesData = {
        error: "Failed to parse AI response",
        rawResponse: completion.content[0].text
      };
    }

    // Save scenes to local folder
    if (scenesData && !scenesData.error) {
      const scenesDir = path.join(projectDir, '02_scenes');
      
      // Save scenes as JSON
      const scenesFile = path.join(scenesDir, 'scenes.json');
      await fs.writeFile(scenesFile, JSON.stringify({
        scenes: scenesData,
        storyInput,
        regeneratedAt: new Date().toISOString()
      }, null, 2));
      
      // Create readable markdown breakdown
      let scenesOverview = `# Scenes Breakdown - ${storyInput.title}\n\n`;
      scenesOverview += `**Regenerated:** ${new Date().toLocaleString()}\n\n`;
      
      Object.entries(scenesData).forEach(([structureKey, structureScenes]) => {
        if (Array.isArray(structureScenes)) {
          scenesOverview += `## ${structureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
          structureScenes.forEach((scene, index) => {
            scenesOverview += `### Scene ${index + 1}: ${scene.title || scene.name || 'Untitled Scene'}\n\n`;
            if (scene.location) scenesOverview += `**Location:** ${scene.location}\n`;
            if (scene.timeOfDay) scenesOverview += `**Time:** ${scene.timeOfDay}\n`;
            if (scene.characters) scenesOverview += `**Characters:** ${Array.isArray(scene.characters) ? scene.characters.join(', ') : scene.characters}\n\n`;
            if (scene.description) scenesOverview += `${scene.description}\n\n`;
            if (scene.keyDialogue) scenesOverview += `**Key Dialogue Moments:** ${scene.keyDialogue}\n\n`;
            if (scene.emotionalBeats) scenesOverview += `**Emotional Beats:** ${scene.emotionalBeats}\n\n`;
            scenesOverview += `---\n\n`;
          });
        }
      });
      
      const scenesOverviewFile = path.join(scenesDir, 'scenes_overview.md');
      await fs.writeFile(scenesOverviewFile, scenesOverview);
      
      console.log(`Scenes regenerated and saved to: ${scenesDir}`);
    }

    res.json({ 
      scenes: scenesData,
      projectPath,
      message: 'Scenes regenerated successfully'
    });
  } catch (error) {
    console.error('Error regenerating scenes:', error);
    res.status(500).json({ error: 'Failed to regenerate scenes', details: error.message });
  }
});

// Export final script with professional formatting
app.post('/api/export', async (req, res) => {
  try {
    const { projectData, format = 'text', projectPath } = req.body;
    
    // If we have a projectPath, load all the actual content from the project directory
    let fullProjectData = projectData;
    if (projectPath) {
      try {
        const projectDir = path.join(__dirname, 'generated', projectPath);
        
        // Load scenes if they exist
        const scenesFile = path.join(projectDir, '02_scenes', 'scenes.json');
        let scenesData = null;
        try {
          const scenesContent = await fs.readFile(scenesFile, 'utf8');
          scenesData = JSON.parse(scenesContent);
          console.log('Scenes data loaded successfully. Keys:', Object.keys(scenesData));
        } catch (error) {
          console.log('No scenes file found or error reading scenes:', error.message);
        }
        
        // Load dialogues in proper story order using scenes structure
        const dialogueDir = path.join(projectDir, '03_dialogue');
        const dialogueContent = [];
        
        // If we have scenes data, use it to order dialogues properly
        if (scenesData && scenesData.scenes) {
          console.log('Using scenes structure for ordering. Available acts:', Object.keys(scenesData.scenes));
          
          // Load the original structure to get the correct act ordering
          let structureKeys = Object.keys(scenesData.scenes);
          try {
            const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
            const structureContent = await fs.readFile(structureFile, 'utf8');
            const structureData = JSON.parse(structureContent);
            if (structureData.structure) {
              structureKeys = Object.keys(structureData.structure);
              console.log('Using template structure order:', structureKeys);
            }
          } catch (error) {
            console.log('Could not load structure file, using scenes order');
          }
          
          // Get scene titles in story order
          const orderedSceneTitles = [];
          
          for (const structureKey of structureKeys) {
            const sceneGroup = scenesData.scenes[structureKey];
            if (sceneGroup && sceneGroup.scenes) {
              console.log(`Processing act ${structureKey} with ${sceneGroup.scenes.length} scenes`);
              for (const scene of sceneGroup.scenes) {
                orderedSceneTitles.push(scene.title);
                console.log(`Added scene to order: ${scene.title}`);
              }
            }
          }
          
          console.log('Final scene order:', orderedSceneTitles.slice(0, 5), '... (first 5 scenes)');
          
          // Load dialogues in story order
          for (const sceneTitle of orderedSceneTitles) {
            try {
              const dialogueFiles = await fs.readdir(dialogueDir);
              // Find the dialogue file for this scene (matches scene title)
              const matchingFile = dialogueFiles.find(file => 
                file.startsWith(sceneTitle.replace(/\s+/g, '_'))
              );
              
              if (matchingFile) {
                const content = await fs.readFile(path.join(dialogueDir, matchingFile), 'utf8');
                dialogueContent.push({ filename: matchingFile, content: content, sceneTitle: sceneTitle });
              }
            } catch (error) {
              console.log(`Error loading dialogue for scene: ${sceneTitle}`);
            }
          }
        } else {
          // Fallback: load all dialogue files alphabetically
          try {
            const dialogueFiles = await fs.readdir(dialogueDir);
            dialogueFiles.sort();
            
            for (const file of dialogueFiles) {
              if (file.endsWith('.txt')) {
                try {
                  const content = await fs.readFile(path.join(dialogueDir, file), 'utf8');
                  dialogueContent.push({ filename: file, content: content });
                } catch (error) {
                  console.log(`Error reading dialogue file ${file}`);
                }
              }
            }
          } catch (error) {
            console.log('No dialogue directory found');
          }
        }
        
        fullProjectData = {
          ...projectData,
          scenes: scenesData,
          dialogueContent: dialogueContent
        };
      } catch (error) {
        console.log('Error loading project content, using basic data');
      }
    }
    
    // Generate script based on format
    let script;
    switch (format) {
      case 'screenplay':
        script = generateProfessionalScreenplay(fullProjectData);
        break;
      case 'fountain':
        script = generateFountainFormat(fullProjectData);
        break;
      case 'fdx':
        script = generateFinalDraftFormat(fullProjectData);
        break;
      case 'pdf-ready':
        script = generatePDFReadyFormat(fullProjectData);
        break;
      case 'production':
        script = generateProductionPackage(fullProjectData);
        break;
      default:
        script = generateBasicScript(fullProjectData);
    }
    
    function generateBasicScript(data) {
      let script = `${data.storyInput.title}\n`;
      script += `Written by: [Author Name]\n\n`;
      script += `LOGLINE: ${data.storyInput.logline}\n\n`;
      script += `GENRE: ${data.storyInput.genre || data.storyInput.tone || 'Drama'}\n\n`;
      script += `CHARACTERS: ${data.storyInput.characters}\n\n`;
      script += `FADE IN:\n\n`;
      return script;
    }
    
    function generateProfessionalScreenplay(data) {
      let script = generateTitlePage(data);
      script += '\n\n\nFADE IN:\n\n';
      
      // Add dialogue content in professional format
      if (data.dialogueContent && data.dialogueContent.length > 0) {
        data.dialogueContent.forEach((dialogueData, index) => {
          const dialogueText = typeof dialogueData === 'string' ? dialogueData : dialogueData.content;
          script += formatDialogueForScreenplay(dialogueText);
          if (index > 0 && (index + 1) % 3 === 0) {
            script += '\n\n                         [PAGE BREAK]\n\n';
          }
        });
      }
      
      script += '\n\nFADE OUT.\n\nTHE END';
      return script;
    }
    
    function generateTitlePage(data) {
      const title = data.storyInput?.title || 'UNTITLED';
      const author = '[Author Name]';
      const date = new Date().toLocaleDateString();
      
      return `




                                    ${title.toUpperCase()}


                                      by

                                   ${author}




                                Based on a true story
                                    (if applicable)




                                     ${date}




                              Contact Information:
                              [Your Name]
                              [Your Address]
                              [Your Phone]
                              [Your Email]




                                   FIRST DRAFT`;
    }
    
    function formatDialogueForScreenplay(dialogue) {
      const lines = dialogue.split('\n');
      let formatted = '';
      let inDialogue = false;
      
      for (let line of lines) {
        line = line.trim();
        if (!line) {
          formatted += '\n';
          continue;
        }
        
        // Scene headings (INT./EXT.)
        if (line.match(/^(INT\.|EXT\.)/i)) {
          formatted += `\n${line.toUpperCase()}\n\n`;
        }
        // Character names (all caps, no colon)
        else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
          const character = line.replace(':', '').trim();
          formatted += `                    ${character}\n`;
          inDialogue = true;
        }
        // Parentheticals
        else if (line.match(/^\(.+\)$/)) {
          formatted += `                  ${line}\n`;
        }
        // Dialogue lines
        else if (inDialogue && !line.match(/^(INT\.|EXT\.)/i)) {
          formatted += `          ${line}\n`;
        }
        // Action lines
        else {
          formatted += `${line}\n`;
          inDialogue = false;
        }
      }
      
      return formatted + '\n\n';
    }
    
    function generateFountainFormat(data) {
      let fountain = `Title: ${data.storyInput?.title || 'UNTITLED'}\n`;
      fountain += `Author: [Author Name]\n`;
      fountain += `Draft date: ${new Date().toLocaleDateString()}\n\n`;
      fountain += 'FADE IN:\n\n';
      
      if (data.dialogueContent && data.dialogueContent.length > 0) {
        data.dialogueContent.forEach(dialogueData => {
          const dialogueText = typeof dialogueData === 'string' ? dialogueData : dialogueData.content;
          fountain += convertToFountain(dialogueText) + '\n\n';
        });
      }
      
      fountain += 'FADE OUT.\n\nTHE END';
      return fountain;
    }
    
    function convertToFountain(dialogue) {
      const lines = dialogue.split('\n');
      let fountain = '';
      
      for (let line of lines) {
        line = line.trim();
        if (!line) {
          fountain += '\n';
          continue;
        }
        
        // Scene headings - Fountain auto-detects INT./EXT.
        if (line.match(/^(INT\.|EXT\.)/)) {
          fountain += line + '\n\n';
        }
        // Character names - no special formatting needed
        else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
          fountain += line.replace(':', '') + '\n';
        }
        // Everything else
        else {
          fountain += line + '\n';
        }
      }
      
      return fountain;
    }
    
    function generateFinalDraftFormat(data) {
      const title = data.storyInput?.title || 'UNTITLED';
      
      let fdx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
    <Content>
        <Paragraph Type="Scene Heading">
            <Text>${title}</Text>
        </Paragraph>
`;
      
      if (data.dialogueContent && data.dialogueContent.length > 0) {
        data.dialogueContent.forEach(dialogueData => {
          const dialogueText = typeof dialogueData === 'string' ? dialogueData : dialogueData.content;
          fdx += convertToFinalDraft(dialogueText);
        });
      }
      
      fdx += `    </Content>
</FinalDraft>`;
      
      return fdx;
    }
    
    function convertToFinalDraft(dialogue) {
      const lines = dialogue.split('\n');
      let fdx = '';
      
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.match(/^(INT\.|EXT\.)/)) {
          fdx += `        <Paragraph Type="Scene Heading">
            <Text>${line}</Text>
        </Paragraph>\n`;
        } else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
          fdx += `        <Paragraph Type="Character">
            <Text>${line.replace(':', '')}</Text>
        </Paragraph>\n`;
        } else if (line.match(/^\(.+\)$/)) {
          fdx += `        <Paragraph Type="Parenthetical">
            <Text>${line}</Text>
        </Paragraph>\n`;
        } else if (line.length > 0) {
          const type = line.match(/^[A-Z]/) ? 'Action' : 'Dialogue';
          fdx += `        <Paragraph Type="${type}">
            <Text>${line}</Text>
        </Paragraph>\n`;
        }
      }
      
      return fdx;
    }
    
    function generatePDFReadyFormat(data) {
      let pdfScript = `PDF CONVERSION INSTRUCTIONS:
============================
1. Use Courier 12pt font
2. Set margins: Left 1.5", Right 1", Top/Bottom 1"
3. Page numbers top-right
4. Page breaks at [PAGE BREAK] markers

============================

${generateProfessionalScreenplay(data)}

============================
END OF SCREENPLAY
============================`;
      
      return pdfScript;
    }
    
    function generateProductionPackage(data) {
      const title = data.storyInput?.title || 'UNTITLED';
      
      let productionScript = `PRODUCTION PACKAGE: ${title.toUpperCase()}
${'='.repeat(50)}

SCRIPT STATISTICS:
• Genre: ${data.storyInput?.genre || data.storyInput?.tone || 'Not specified'}
• Estimated Pages: ${Math.ceil((data.dialogueContent?.length || 0) * 3)}
• Total Scenes: ${data.dialogueContent?.length || 0}

CHARACTER BREAKDOWN:
${data.storyInput?.characters || 'Characters not specified'}

LOGLINE:
${data.storyInput?.logline || 'Logline not provided'}

PRODUCTION NOTES:
• This script was generated using AI assistance
• Review all dialogue for consistency and character voice
• Consider script coverage and professional review
• Verify all scene locations and time requirements
• Check for continuity and pacing issues

${'='.repeat(50)}
SCREENPLAY BEGINS BELOW
${'='.repeat(50)}

${generateProfessionalScreenplay(data)}

${'='.repeat(50)}
END OF PRODUCTION PACKAGE
${'='.repeat(50)}`;

      return productionScript;
    }

    
    // Save final script to local folder if projectPath is provided
    if (projectPath) {
      const projectDir = path.join(__dirname, 'generated', projectPath);
      const finalScriptDir = path.join(projectDir, '04_final_script');
      
      const scriptTitle = (fullProjectData.storyInput.title || 'script').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const scriptFile = path.join(finalScriptDir, `${scriptTitle}_final.txt`);
      const scriptJsonFile = path.join(finalScriptDir, `${scriptTitle}_complete_project.json`);
      
      await fs.writeFile(scriptFile, script);
      await fs.writeFile(scriptJsonFile, JSON.stringify(fullProjectData, null, 2));
      
      console.log(`Final script saved to: ${scriptFile}`);
    }
    
    // Set appropriate content type and filename based on format
    const title = fullProjectData.storyInput.title || 'script';
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    
    if (format === 'json') {
      res.json({ script, fullProjectData });
    } else {
      let contentType = 'text/plain';
      let fileExtension = '.txt';
      let filename = `${cleanTitle}`;
      
      switch (format) {
        case 'screenplay':
          filename += '_SCREENPLAY';
          break;
        case 'fountain':
          fileExtension = '.fountain';
          filename += '_FOUNTAIN';
          break;
        case 'fdx':
          contentType = 'application/xml';
          fileExtension = '.fdx';
          filename += '_FINAL_DRAFT';
          break;
        case 'pdf-ready':
          filename += '_PDF_READY';
          break;
        case 'production':
          filename += '_PRODUCTION_PACKAGE';
          break;
        default:
          filename += '_SCRIPT';
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}${fileExtension}"`);
      res.send(script);
    }
  } catch (error) {
    console.error('Error exporting script:', error);
    res.status(500).json({ error: 'Failed to export script' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Profile and User Management API Endpoints
// User Management
app.get('/api/users', async (req, res) => {
  try {
    const result = await dbClient.query('SELECT id, username, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = await dbClient.query(
      'INSERT INTO users (username) VALUES ($1) RETURNING id, username, created_at',
      [username.trim()]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error('Failed to create user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// User Libraries Management
app.get('/api/user-libraries/:username/:type', async (req, res) => {
  try {
    const { username, type } = req.params;
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get libraries
    const result = await dbClient.query(
      'SELECT entry_key, entry_data, created_at FROM user_libraries WHERE user_id = $1 AND library_type = $2 ORDER BY created_at DESC',
      [userId, type]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch user libraries:', error);
    res.status(500).json({ error: 'Failed to fetch user libraries' });
  }
});

app.post('/api/user-libraries/:username/:type/:key', async (req, res) => {
  try {
    const { username, type, key } = req.params;
    const entryData = req.body;
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Insert or update library entry
    const result = await dbClient.query(
      `INSERT INTO user_libraries (user_id, library_type, entry_key, entry_data) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, library_type, entry_key) 
       DO UPDATE SET entry_data = $4, created_at = NOW()
       RETURNING *`,
      [userId, type, key, JSON.stringify(entryData)]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to save library entry:', error);
    res.status(500).json({ error: 'Failed to save library entry' });
  }
});

app.put('/api/user-libraries/:username/:type/:key', async (req, res) => {
  try {
    const { username, type, key } = req.params;
    const entryData = req.body;
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Update library entry
    const result = await dbClient.query(
      'UPDATE user_libraries SET entry_data = $1, created_at = NOW() WHERE user_id = $2 AND library_type = $3 AND entry_key = $4 RETURNING *',
      [JSON.stringify(entryData), userId, type, key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library entry not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update library entry:', error);
    res.status(500).json({ error: 'Failed to update library entry' });
  }
});

app.delete('/api/user-libraries/:username/:type/:key', async (req, res) => {
  try {
    const { username, type, key } = req.params;
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Delete library entry
    const result = await dbClient.query(
      'DELETE FROM user_libraries WHERE user_id = $1 AND library_type = $2 AND entry_key = $3 RETURNING *',
      [userId, type, key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library entry not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete library entry:', error);
    res.status(500).json({ error: 'Failed to delete library entry' });
  }
});

// User Projects Management
app.get('/api/user-projects/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get projects
    const result = await dbClient.query(
      'SELECT project_name, project_context, thumbnail_data, created_at, updated_at FROM user_projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch user projects:', error);
    res.status(500).json({ error: 'Failed to fetch user projects' });
  }
});

app.post('/api/user-projects/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { projectName, projectContext, thumbnailData } = req.body;
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Save project
    const result = await dbClient.query(
      `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, project_name) 
       DO UPDATE SET project_context = $3, thumbnail_data = $4, updated_at = NOW()
       RETURNING *`,
      [userId, projectName, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to save project:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// Delete project endpoint
app.delete('/api/users/:userId/projects', async (req, res) => {
  try {
    const { userId } = req.params;
    const { project_name } = req.body;
    
    if (!project_name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Delete from database
    const result = await dbClient.query(
      'DELETE FROM user_projects WHERE user_id = $1 AND project_name = $2 RETURNING *',
      [userId, project_name]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Also delete from filesystem
    const projectDir = path.join(__dirname, 'generated', project_name);
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      console.log('Project directory not found or already deleted:', error.message);
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Start server
const startServer = async () => {
  await ensureDirectories();
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Film Script Generator server running on port ${PORT}`);
    console.log(`🌐 Access: http://localhost:${PORT}`);
    console.log('📊 Usage tracking and credit system enabled');
    console.log('🔐 API key authentication required for all generation endpoints');
  });
};

// Generate plot points for a specific story act (Level 4 generation)
app.post('/api/generate-plot-points-for-act/:projectPath/:actKey', async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { desiredSceneCount = null, model = "claude-sonnet-4-20250514" } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    if (!structure[actKey]) {
      return res.status(400).json({ error: 'Invalid act key' });
    }
    
    const storyAct = structure[actKey];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(actKey) + 1;
    context.buildActContext(actKey, storyAct, actPosition);
    
    // Calculate intelligent scene distribution based on story structure
    const totalScenes = context.contexts.story.data.totalScenes || 70;
    
    // First, check if the story structure already has scene_count specified for this act
    const preDefinedSceneCount = storyAct.scene_count || structure[actKey]?.scene_count;
    
    // If no predefined count, calculate based on total scenes and act importance
    let calculatedSceneCount = null;
    if (!preDefinedSceneCount) {
      const totalActs = Object.keys(structure).length;
      const baseScenesPerAct = Math.floor(totalScenes / totalActs);
      const extraScenes = totalScenes % totalActs;
      
      // Give certain acts more scenes based on their narrative importance
      const keyActPatterns = ['catalyst', 'crisis', 'climax', 'transformation', 'confrontation'];
      const isKeyAct = keyActPatterns.some(pattern => actKey.toLowerCase().includes(pattern));
      const actSceneBonus = isKeyAct && actPosition <= extraScenes ? 1 : 0;
      calculatedSceneCount = Math.max(3, baseScenesPerAct + actSceneBonus); // Minimum 3 scenes per act
    }
    
    const scenesForThisAct = preDefinedSceneCount || calculatedSceneCount;
    
    // Use intelligent scene distribution instead of user input when available
    // Priority: 1) Intelligent calculation, 2) User input, 3) Default minimum
    const finalSceneCount = scenesForThisAct || desiredSceneCount || 4;
    
    console.log(`🎬 Scene Distribution for ${actKey}:`);
    console.log(`  📊 Total story scenes: ${totalScenes}`);
    console.log(`  🎭 Predefined scene count: ${preDefinedSceneCount || 'none'}`);
    console.log(`  🧮 Calculated scene count: ${calculatedSceneCount || 'none'}`);
    console.log(`  👤 User requested: ${desiredSceneCount || 'none'}`);
    console.log(`  ✅ Final scene count: ${finalSceneCount} scenes`);
    console.log(`  📈 Will expand 4 plot points into ${finalSceneCount} scenes`);
    
    
    // Generate hierarchical prompt for plot points generation (Level 4) with enhanced inter-act causality
    // First, temporarily build plot points context to load previous acts' plot points
    await context.buildPlotPointsContext([], 0, projectPath);
    const hierarchicalPrompt = context.generateHierarchicalPrompt(4, `
PLOT POINTS GENERATION WITH INTER-ACT CAUSALITY:
1. Break down this story act into 4 causally connected plot points (these will be expanded into ${finalSceneCount} total scenes)
2. CRITICAL: If previous acts' plot points are shown above, your FIRST plot point must logically continue from the last plot point of the previous act
3. Each plot point must describe a CONCRETE ACTION or EVENT that happens - not internal feelings
4. Focus on external, visual story beats that could be filmed - what does the audience SEE happening?
5. Plot points should connect causally using "BUT" (conflict) and "THEREFORE" (consequence)
6. Show character development through ACTIONS and CHOICES, not internal monologue
7. Each plot point should create a specific dramatic situation or encounter
8. Make events unpredictable and cinematic while serving the character arc
9. Some plot points will be expanded into multiple scenes (sequences) to reach the target of ${finalSceneCount} scenes for this act

INTER-ACT CAUSAL CONNECTION:
- If there's a "CONNECT FROM" instruction above, begin this act as a direct consequence of that previous plot point
- Use "THEREFORE" to show how this act follows logically from the previous act's conclusion
- Don't repeat previous events, but build upon their consequences
- Maintain character momentum and story energy across act boundaries

CHARACTER ARC THROUGH ACTION:
- Show character growth through CHOICES under pressure
- Reveal personality through HOW characters act, not what they think
- Use physical behavior to show emotional states
- Force characters to make decisions that reveal their true nature

CINEMATIC SPECIFICITY:
- Include specific locations that serve the story (not just "a room")
- Add time pressure or urgency to create tension
- Introduce physical obstacles or concrete goals
- Create visual conflicts that can be filmed dramatically

EXAMPLES OF GOOD PLOT POINTS:
- "She saves a child from a burning building"
- "Police surround him with weapons drawn"  
- "He breaks into an abandoned school to sleep"
- "He must choose between saving his friend or escaping before the building collapses"
- "She discovers the hidden evidence just as her phone battery dies"

AVOID internal states like "feels lonely" or "contemplates" - show these through what the character DOES.

Create 4 plot points using "But and Therefore" logic to create dramatic tension and causal flow.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY a JSON object with this exact structure:
{
  "plotPoints": [
    "Plot point 1 that establishes the situation for this act",
    "But plot point 2 that introduces conflict or complication", 
    "Therefore plot point 3 that shows the consequence or progress",
    "Therefore plot point 4 that concludes this act's progression"
  ]
}`;

    console.log(`Generating 4 plot points for ${actKey} (expanding to ${finalSceneCount} scenes)`);
    
    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 1500,
      temperature: 0.7,
      system: "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events - never internal feelings. Focus on visual conflicts, character choices under pressure, and specific dramatic situations with urgency. Always respond with valid JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    let plotPointsData;
    try {
      plotPointsData = JSON.parse(completion.content[0].text);
    } catch (error) {
      console.log('Failed to parse plot points response:', error);
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: error.message,
        rawResponse: completion.content[0].text.substring(0, 500) + "..."
      });
    }

    if (!plotPointsData.plotPoints || !Array.isArray(plotPointsData.plotPoints)) {
      return res.status(500).json({ error: 'Invalid plot points structure received' });
    }

    // Calculate scene distribution across plot points
    const sceneDistribution = context.calculateSceneDistribution(plotPointsData.plotPoints, finalSceneCount, actKey);
    
    // Update plot points context with the generated plot points
    await context.buildPlotPointsContext(plotPointsData.plotPoints, finalSceneCount, projectPath);
    await context.saveToProject(projectPath);

    // Save plot points to a dedicated file with scene distribution
    const plotPointsDir = path.join(projectDir, '02_plot_points');
    await fs.mkdir(plotPointsDir, { recursive: true });
    
    const plotPointsFile = path.join(plotPointsDir, `${actKey}_plot_points.json`);
    await fs.writeFile(plotPointsFile, JSON.stringify({
      actKey: actKey,
      storyAct: storyAct,
      plotPoints: plotPointsData.plotPoints,
      sceneDistribution: sceneDistribution,
      totalScenesForAct: finalSceneCount,
      totalPlotPoints: plotPointsData.plotPoints.length,
      generatedAt: new Date().toISOString(),
      lastRegenerated: new Date().toISOString()
    }, null, 2));

    console.log(`Generated ${plotPointsData.plotPoints.length} plot points for ${actKey} with scene distribution:`);
    sceneDistribution.forEach((dist, index) => {
      console.log(`  Plot Point ${index + 1}: ${dist.sceneCount} scenes ${dist.isKeyPlot ? '(key plot)' : ''}`);
    });

    res.json({
      success: true,
      actKey: actKey,
      plotPoints: plotPointsData.plotPoints,
      sceneDistribution: sceneDistribution,
      totalPlotPoints: plotPointsData.plotPoints.length,
      totalScenesForAct: finalSceneCount,
      message: `Generated ${plotPointsData.plotPoints.length} plot points for ${storyAct.name} (${finalSceneCount} scenes total)`
    });

  } catch (error) {
    console.error('Error generating plot points for act:', error);
    res.status(500).json({ error: 'Failed to generate plot points for act', details: error.message });
  }
});

// Load existing plot points for a project
app.get('/api/load-plot-points/:projectPath', async (req, res) => {
  try {
    const { projectPath } = req.params;
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const plotPointsDir = path.join(projectDir, '02_plot_points');
    
    console.log(`Loading plot points for project: ${projectPath}`);
    console.log(`Looking in directory: ${plotPointsDir}`);
    
    let plotPoints = {};
    
    try {
      // Check if plot points directory exists
      await fs.access(plotPointsDir);
      
      // Read all plot point files
      const files = await fs.readdir(plotPointsDir);
      console.log(`Found plot point files:`, files);
      
      for (const file of files) {
        if (file.endsWith('_plot_points.json')) {
          const structureKey = file.replace('_plot_points.json', '');
          const plotPointsFile = path.join(plotPointsDir, file);
          
          try {
            const plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
            if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
              plotPoints[structureKey] = plotPointsData.plotPoints;
              console.log(`Loaded ${plotPointsData.plotPoints.length} plot points for ${structureKey}`);
            }
          } catch (fileError) {
            console.error(`Error reading plot points file ${file}:`, fileError);
          }
        }
      }
    } catch (dirError) {
      console.log(`Plot points directory doesn't exist: ${plotPointsDir}`);
    }
    
    res.json({ 
      plotPoints: plotPoints,
      projectPath: projectPath,
      totalStructures: Object.keys(plotPoints).length
    });
    
  } catch (error) {
    console.error('Error loading plot points:', error);
    res.status(500).json({ error: 'Failed to load plot points', details: error.message });
  }
});

// Regenerate a single plot point within an act
app.post('/api/regenerate-plot-point/:projectPath/:structureKey/:plotPointIndex', async (req, res) => {
  try {
    const { projectPath, structureKey, plotPointIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    const plotPointsFile = path.join(projectDir, '02_plot_points', `${structureKey}_plot_points.json`);
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    // Load existing plot points
    let plotPointsData;
    try {
      plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
    } catch (error) {
      return res.status(400).json({ error: 'Plot points file not found. Please generate plot points for this act first.' });
    }
    
    const plotPointIndexNum = parseInt(plotPointIndex);
    if (plotPointIndexNum < 0 || plotPointIndexNum >= plotPointsData.plotPoints.length) {
      return res.status(400).json({ error: 'Invalid plot point index' });
    }
    
    const storyAct = structure[structureKey];
    const existingPlotPoints = plotPointsData.plotPoints;
    const targetPlotPoint = existingPlotPoints[plotPointIndexNum];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
    context.buildActContext(structureKey, storyAct, actPosition);
    
    // Build context with existing plot points
    context.buildPlotPointsContext(existingPlotPoints, existingPlotPoints.length);
    
    // Generate hierarchical prompt for individual plot point regeneration
    const hierarchicalPrompt = context.generateHierarchicalPrompt(4, `
INDIVIDUAL PLOT POINT REGENERATION:
1. You are regenerating plot point #${plotPointIndexNum + 1} of ${existingPlotPoints.length} in this story act
2. The current plot point is: "${targetPlotPoint}"
3. This plot point must maintain causal connections with the surrounding plot points
4. Use "BUT" and "THEREFORE" logic to ensure dramatic flow
5. Consider the plot points that come before and after this one
6. The new plot point should serve the same structural purpose but with fresh execution

Existing plot points context:
${existingPlotPoints.map((pp, idx) => `${idx + 1}. ${pp}${idx === plotPointIndexNum ? ' ← REGENERATING THIS ONE' : ''}`).join('\n')}

Generate a single replacement plot point that maintains narrative causality and dramatic tension.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY a JSON object with this exact structure:
{
  "plotPoint": "The new plot point that replaces the existing one while maintaining causal flow"
}`;

    console.log(`Regenerating plot point ${plotPointIndexNum + 1} for ${structureKey}`);
    
    const completion = await anthropic.messages.create({
      model: model,
      max_tokens: 800,
      temperature: 0.7,
      system: "You are a professional screenwriter. Generate a single causally-connected plot point that maintains narrative flow. Always respond with valid JSON.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    let responseData;
    try {
      responseData = JSON.parse(completion.content[0].text);
    } catch (error) {
      console.log('Failed to parse plot point response:', error);
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: error.message,
        rawResponse: completion.content[0].text.substring(0, 500) + "..."
      });
    }

    if (!responseData.plotPoint || typeof responseData.plotPoint !== 'string') {
      return res.status(500).json({ error: 'Invalid plot point structure received' });
    }

    // Update the plot points array (OVERWRITES the specific plot point)
    plotPointsData.plotPoints[plotPointIndexNum] = responseData.plotPoint;
    plotPointsData.lastRegenerated = new Date().toISOString();
    
    // Save updated plot points back to file
    await fs.writeFile(plotPointsFile, JSON.stringify(plotPointsData, null, 2));
    
    // Update hierarchical context with new plot points
    await context.buildPlotPointsContext(plotPointsData.plotPoints, plotPointsData.plotPoints.length);
    await context.saveToProject(projectPath);

    console.log(`Regenerated plot point ${plotPointIndexNum + 1} for ${structureKey}: "${responseData.plotPoint}"`);

    res.json({
      success: true,
      structureKey: structureKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: responseData.plotPoint,
      message: `Regenerated plot point ${plotPointIndexNum + 1} for ${storyAct.name}`
    });

  } catch (error) {
    console.error('Error regenerating individual plot point:', error);
    res.status(500).json({ error: 'Failed to regenerate plot point', details: error.message });
  }
});

// Preview individual plot point regeneration prompt
app.post('/api/preview-individual-plot-point-prompt', async (req, res) => {
  try {
    const { projectPath, structureKey, plotPointIndex, existingPlotPoints } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    const { structure, storyInput } = projectData;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    const plotPointIndexNum = parseInt(plotPointIndex);
    if (plotPointIndexNum < 0 || plotPointIndexNum >= existingPlotPoints.length) {
      return res.status(400).json({ error: 'Invalid plot point index' });
    }
    
    const storyAct = structure[structureKey];
    const targetPlotPoint = existingPlotPoints[plotPointIndexNum];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext();
    await context.loadFromProject(projectPath);
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, projectData.lastUsedPrompt, projectData.lastUsedSystemMessage);
      context.buildStructureContext(structure, projectData.template);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
    context.buildActContext(structureKey, storyAct, actPosition);
    
    // Build context with existing plot points (individual regeneration doesn't need previous acts)
    await context.buildPlotPointsContext(existingPlotPoints, existingPlotPoints.length);
    
    // Generate hierarchical prompt for individual plot point regeneration
    const hierarchicalPrompt = context.generateHierarchicalPrompt(4, `
INDIVIDUAL PLOT POINT REGENERATION:
1. You are regenerating plot point #${plotPointIndexNum + 1} of ${existingPlotPoints.length} in this story act
2. The current plot point is: "${targetPlotPoint}"
3. This plot point must maintain causal connections with the surrounding plot points
4. Use "BUT" and "THEREFORE" logic to ensure dramatic flow
5. Consider the plot points that come before and after this one
6. The new plot point should serve the same structural purpose but with fresh execution

Existing plot points context:
${existingPlotPoints.map((pp, idx) => `${idx + 1}. ${pp}${idx === plotPointIndexNum ? ' ← REGENERATING THIS ONE' : ''}`).join('\n')}

Generate a single replacement plot point that maintains narrative causality and dramatic tension.`);
    
    const prompt = `${hierarchicalPrompt}

Return ONLY a JSON object with this exact structure:
{
  "plotPoint": "The new plot point that replaces the existing one while maintaining causal flow"
}`;

    const systemMessage = "You are a professional screenwriter. Generate a single causally-connected plot point that maintains narrative flow. Always respond with valid JSON.";

    res.json({
      systemMessage: systemMessage,
      prompt: prompt,
      promptType: 'individual-plot-point-regeneration',
      storyAct: storyAct,
      structureKey: structureKey,
      plotPointIndex: plotPointIndexNum,
      targetPlotPoint: targetPlotPoint,
      hierarchicalPrompt: hierarchicalPrompt
    });

  } catch (error) {
    console.error('Error generating individual plot point prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate prompt preview', details: error.message });
  }
});

// Generate all scenes for an entire act using scene distribution
app.post('/api/generate-all-scenes-for-act/:projectPath/:actKey', async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const plotPointsFile = path.join(projectDir, '02_plot_points', `${actKey}_plot_points.json`);
    
    // Load plot points data with scene distribution
    let plotPointsData;
    try {
      plotPointsData = JSON.parse(await fs.readFile(plotPointsFile, 'utf8'));
    } catch (error) {
      return res.status(400).json({ error: 'Plot points file not found. Please generate plot points for this act first.' });
    }
    
    if (!plotPointsData.sceneDistribution) {
      return res.status(400).json({ error: 'Scene distribution not found. Please regenerate plot points with the new system.' });
    }
    
    console.log(`Generating all scenes for act: ${actKey}`);
    console.log(`Scene distribution:`, plotPointsData.sceneDistribution.map((dist, i) => 
      `Plot Point ${i + 1}: ${dist.sceneCount} scenes ${dist.isKeyPlot ? '(key)' : ''}`
    ));
    
    const allGeneratedScenes = [];
    let totalScenesGenerated = 0;
    
    // Generate scenes for each plot point according to distribution
    for (let plotPointIndex = 0; plotPointIndex < plotPointsData.sceneDistribution.length; plotPointIndex++) {
      const plotPointInfo = plotPointsData.sceneDistribution[plotPointIndex];
      const sceneCount = plotPointInfo.sceneCount;
      const plotPoint = plotPointInfo.plotPoint;
      
      console.log(`\nGenerating ${sceneCount} scenes for Plot Point ${plotPointIndex + 1}: "${plotPoint}"`);
      
      try {
        // Generate scenes for this plot point directly
        const context = new HierarchicalContext();
        const plotPointResult = await context.generateScenesForPlotPoint(projectPath, actKey, plotPointIndex, model);
        allGeneratedScenes.push({
          plotPointIndex: plotPointIndex,
          plotPoint: plotPoint,
          sceneCount: plotPointResult.sceneCount,
          scenes: plotPointResult.scenes,
          isKeyPlot: plotPointInfo.isKeyPlot
        });
        
        totalScenesGenerated += plotPointResult.sceneCount;
        console.log(`✓ Generated ${plotPointResult.sceneCount} scenes for plot point ${plotPointIndex + 1}`);
        
      } catch (error) {
        console.error(`Error generating scenes for plot point ${plotPointIndex}:`, error);
        // Continue with other plot points even if one fails
      }
    }
    
    // Save comprehensive act scenes summary
    const actScenesDir = path.join(projectDir, '03_scenes', actKey);
    await fs.mkdir(actScenesDir, { recursive: true });
    
    const actSummaryFile = path.join(actScenesDir, `${actKey}_act_scenes_summary.json`);
    await fs.writeFile(actSummaryFile, JSON.stringify({
      actKey: actKey,
      totalScenesGenerated: totalScenesGenerated,
      targetScenes: plotPointsData.totalScenesForAct,
      plotPointScenes: allGeneratedScenes,
      generatedAt: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n✅ Act ${actKey} complete: Generated ${totalScenesGenerated} scenes across ${allGeneratedScenes.length} plot points`);
    
    res.json({
      success: true,
      actKey: actKey,
      totalScenesGenerated: totalScenesGenerated,
      targetScenes: plotPointsData.totalScenesForAct,
      plotPointScenes: allGeneratedScenes,
      message: `Generated ${totalScenesGenerated} scenes for act: ${actKey}`
    });

  } catch (error) {
    console.error('Error generating all scenes for act:', error);
    res.status(500).json({ error: 'Failed to generate all scenes for act', details: error.message });
  }
});

// API Endpoints for Editable Content System

// Save edited act content
app.put('/api/edit-content/acts/:projectPath/:actKey', async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const structureFile = path.join(projectDir, '01_structure', 'plot_structure.json');
    
    // Load existing project data
    const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
    
    // Parse the new content (could be JSON or plain text)
    let updatedAct;
    try {
      updatedAct = JSON.parse(content);
    } catch (e) {
      // If not valid JSON, treat as plain text description
      updatedAct = {
        name: projectData.structure[actKey]?.name || actKey,
        description: content
      };
    }
    
    // Update the specific act
    projectData.structure[actKey] = {
      ...projectData.structure[actKey],
      ...updatedAct,
      lastModified: new Date().toISOString()
    };
    
    // Save back to file
    await fs.writeFile(structureFile, JSON.stringify(projectData, null, 2));
    
    console.log(`Act ${actKey} updated successfully`);
    res.json({ 
      success: true, 
      message: 'Act updated successfully',
      updatedAct: projectData.structure[actKey]
    });
    
  } catch (error) {
    console.error('Error saving act content:', error);
    res.status(500).json({ error: error.message || 'Failed to save act content' });
  }
});

// Save edited plot points content
app.put('/api/edit-content/plot-points/:projectPath/:actKey', async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const plotPointsDir = path.join(projectDir, '02_plot-points');
    const plotPointsFile = path.join(plotPointsDir, `${actKey}.json`);
    
    // Ensure directory exists
    await fs.mkdir(plotPointsDir, { recursive: true });
    
    // Parse the new content
    let updatedPlotPoints;
    try {
      updatedPlotPoints = JSON.parse(content);
      if (!Array.isArray(updatedPlotPoints)) {
        // If it's not an array, split by lines and clean up
        updatedPlotPoints = content.split('\n').filter(line => line.trim());
      }
    } catch (e) {
      // Split by lines if not valid JSON
      updatedPlotPoints = content.split('\n').filter(line => line.trim());
    }
    
    const plotPointsData = {
      plotPoints: updatedPlotPoints,
      actKey: actKey,
      lastModified: new Date().toISOString()
    };
    
    // Save to file
    await fs.writeFile(plotPointsFile, JSON.stringify(plotPointsData, null, 2));
    
    console.log(`Plot points for ${actKey} updated successfully`);
    res.json({ 
      success: true, 
      message: 'Plot points updated successfully',
      plotPoints: updatedPlotPoints
    });
    
  } catch (error) {
    console.error('Error saving plot points content:', error);
    res.status(500).json({ error: error.message || 'Failed to save plot points content' });
  }
});

// Save edited scene content
app.put('/api/edit-content/scenes/:projectPath/:actKey/:sceneIndex', async (req, res) => {
  try {
    const { projectPath, actKey, sceneIndex } = req.params;
    const { content } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const scenesDir = path.join(projectDir, '03_scenes', actKey);
    const sceneFile = path.join(scenesDir, `scene-${sceneIndexNum}.json`);
    
    // Load existing scene if it exists
    let existingScene = {};
    try {
      const existingData = await fs.readFile(sceneFile, 'utf8');
      existingScene = JSON.parse(existingData);
    } catch (e) {
      // File doesn't exist, start with empty object
    }
    
    // Parse the new content
    let updatedScene;
    try {
      updatedScene = JSON.parse(content);
    } catch (e) {
      // If not valid JSON, treat as scene description
      updatedScene = {
        ...existingScene,
        description: content
      };
    }
    
    const sceneData = {
      ...existingScene,
      ...updatedScene,
      lastModified: new Date().toISOString()
    };
    
    // Ensure directory exists
    await fs.mkdir(scenesDir, { recursive: true });
    
    // Save to file
    await fs.writeFile(sceneFile, JSON.stringify(sceneData, null, 2));
    
    console.log(`Scene ${actKey}[${sceneIndex}] updated successfully`);
    res.json({ 
      success: true, 
      message: 'Scene updated successfully',
      updatedScene: sceneData
    });
    
  } catch (error) {
    console.error('Error saving scene content:', error);
    res.status(500).json({ error: error.message || 'Failed to save scene content' });
  }
});

// Save edited dialogue content
app.put('/api/edit-content/dialogue/:projectPath/:actKey/:sceneIndex', async (req, res) => {
  try {
    const { projectPath, actKey, sceneIndex } = req.params;
    const { content } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const projectDir = path.join(__dirname, 'generated', projectPath);
    const dialogueDir = path.join(projectDir, '04_dialogue', actKey);
    const dialogueFile = path.join(dialogueDir, `scene-${sceneIndexNum}.json`);
    
    const dialogueData = {
      dialogue: content,
      actKey: actKey,
      sceneIndex: sceneIndexNum,
      lastModified: new Date().toISOString()
    };
    
    // Ensure directory exists
    await fs.mkdir(dialogueDir, { recursive: true });
    
    // Save to file
    await fs.writeFile(dialogueFile, JSON.stringify(dialogueData, null, 2));
    
    console.log(`Dialogue for ${actKey}[${sceneIndex}] updated successfully`);
    res.json({ 
      success: true, 
      message: 'Dialogue updated successfully',
      dialogue: content
    });
    
  } catch (error) {
    console.error('Error saving dialogue content:', error);
    res.status(500).json({ error: error.message || 'Failed to save dialogue content' });
  }
});

// Admin endpoints for credit management
app.post('/api/admin/grant-credits', authenticateApiKey, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, credits, notes } = req.body;
  
  try {
    // Find user
    const user = await dbClient.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Grant credits
    await dbClient.query(
      'UPDATE users SET credits_remaining = credits_remaining + $1 WHERE id = $2',
      [credits, user.rows[0].id]
    );

    // Log transaction
    await dbClient.query(`
      INSERT INTO credit_transactions (
        user_id, transaction_type, credits_amount, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5)
    `, [user.rows[0].id, 'grant', credits, notes, req.user.id]);

    res.json({ 
      message: `Granted ${credits} credits to ${username}`,
      newBalance: user.rows[0].credits_remaining + credits
    });
  } catch (error) {
    console.error('Error granting credits:', error);
    res.status(500).json({ error: 'Failed to grant credits' });
  }
});

// Get user usage statistics
app.get('/api/admin/usage-stats/:username', authenticateApiKey, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username } = req.params;
  
  try {
    const user = await dbClient.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const usage = await dbClient.query(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
        AVG(input_tokens + output_tokens) as avg_tokens_per_request,
        MAX(timestamp) as last_request
      FROM usage_logs_v2 
      WHERE username = $1
    `, [user.rows[0].username]);

    const recentUsage = await dbClient.query(`
      SELECT endpoint, COUNT(*) as count, SUM(total_cost) as total_cost
      FROM usage_logs_v2 
      WHERE username = $1 AND timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY endpoint
      ORDER BY count DESC
    `, [user.rows[0].username]);

    res.json({
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        credits_remaining: user.rows[0].credits_remaining,
        total_credits_purchased: user.rows[0].total_credits_purchased,
        created_at: user.rows[0].created_at
      },
      usage: usage.rows[0],
      recentUsage: recentUsage.rows
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Create new user
app.post('/api/admin/create-user', authenticateApiKey, async (req, res) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, email, initialCredits = 0 } = req.body;
  
  try {
    const apiKey = 'user_' + require('crypto').randomBytes(32).toString('hex');
    
    const result = await dbClient.query(`
      INSERT INTO users (username, api_key, credits_remaining)
      VALUES ($1, $2, $3)
      RETURNING id, username, api_key, credits_remaining
    `, [username, apiKey, initialCredits]);

    res.json({
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// Get model pricing information
app.get('/api/model-pricing', authenticateApiKey, async (req, res) => {
  try {
    const pricing = trackedAnthropic.getAllModelPricing();
    
    // Format pricing with additional info
    const formattedPricing = Object.entries(pricing).map(([model, costs]) => ({
      model,
      inputCostPer1M: costs.input,
      outputCostPer1M: costs.output,
      inputCostPer1K: (costs.input / 1000).toFixed(4),
      outputCostPer1K: (costs.output / 1000).toFixed(4),
      description: getModelDescription(model)
    }));

    res.json({
      pricing: formattedPricing,
      note: "Costs are in USD. Credits are calculated as cost * 100 (1 credit = 1 cent)"
    });
  } catch (error) {
    console.error('Error fetching model pricing:', error);
    res.status(500).json({ error: 'Failed to fetch model pricing' });
  }
});

// Helper function to describe models
function getModelDescription(model) {
  const descriptions = {
    'claude-3-5-sonnet-20241022': 'Latest Claude 3.5 Sonnet - Best balance of performance and cost',
    'claude-sonnet-4-20250514': 'Legacy name for Claude 3.5 Sonnet',
    'claude-3-sonnet-20240229': 'Original Claude 3 Sonnet',
    'claude-3-opus-20240229': 'Most capable Claude model - Highest cost, best quality',
    'claude-3-haiku-20240307': 'Fastest and most cost-effective Claude model',
    'claude-3-5-haiku-20241022': 'Latest Claude 3.5 Haiku - Good balance of speed and capability'
  };
  return descriptions[model] || 'Claude model';
}

// Estimate cost for a request without making it
app.post('/api/estimate-cost', authenticateApiKey, async (req, res) => {
  try {
    const { prompt, model = 'claude-3-5-sonnet-20241022', estimatedOutputTokens } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const estimate = trackedAnthropic.estimateCost(prompt, estimatedOutputTokens, model);
    
    res.json({
      ...estimate,
      creditsRequired: Math.ceil(estimate.totalCost * 100),
      userCreditsRemaining: req.user.credits_remaining,
      sufficient: req.user.credits_remaining >= Math.ceil(estimate.totalCost * 100)
    });
  } catch (error) {
    console.error('Error estimating cost:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// Get user's own stats
app.get('/api/my-stats', authenticateApiKey, async (req, res) => {
  try {
    const usage = await dbClient.query(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
        AVG(input_tokens + output_tokens) as avg_tokens_per_request,
        MAX(timestamp) as last_request
      FROM usage_logs_v2 
      WHERE username = $1
    `, [req.user.username]);

    const recentUsage = await dbClient.query(`
      SELECT endpoint, COUNT(*) as count, SUM(total_cost) as total_cost
      FROM usage_logs_v2 
      WHERE username = $1 AND timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY endpoint
      ORDER BY count DESC
    `, [req.user.username]);

    res.json({
      user: {
        username: req.user.username,
        credits_remaining: req.user.credits_remaining,
        total_credits_purchased: req.user.total_credits_purchased
      },
      usage: usage.rows[0],
      recentUsage: recentUsage.rows
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// =====================================
// AUTHENTICATION ENDPOINTS
// =====================================

const bcrypt = require('bcrypt');
const crypto = require('crypto');

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, emailUpdates = false } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters long' });
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscore, and hyphen' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check if user already exists
    const existingUser = await dbClient.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Generate API key
    const apiKey = 'user_' + crypto.randomBytes(32).toString('hex');
    
    // Create user with initial credits (100 free credits = $1.00)
    const result = await dbClient.query(`
      INSERT INTO users (
        username, email, password_hash, api_key, 
        credits_remaining, email_updates, email_verified, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, username, email, api_key, credits_remaining, created_at
    `, [username, email, hashedPassword, apiKey, 100, emailUpdates, false]);
    
    // Log the credit grant
    await dbClient.query(`
      INSERT INTO credit_transactions_v2 (
        username, transaction_type, credits_amount, notes, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [username, 'grant', 100, 'Welcome bonus - 100 free credits']);
    
    const user = result.rows[0];
    
    // TODO: Send welcome email with email verification link
    console.log(`New user registered: ${username} (${email}) - API Key: ${apiKey}`);
    
    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits_remaining: user.credits_remaining,
        created_at: user.created_at
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const result = await dbClient.query(
      'SELECT id, username, email, password_hash, api_key, credits_remaining, is_admin, email_verified FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Update last login
    await dbClient.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Return user data and API key
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        credits_remaining: user.credits_remaining,
        is_admin: user.is_admin,
        email_verified: user.email_verified
      },
      apiKey: user.api_key,
      rememberMe
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const result = await dbClient.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email]
    );
    
    // Always return success for security (don't reveal if email exists)
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account with that email exists, password reset instructions have been sent.' });
    }
    
    const user = result.rows[0];
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Store reset token
    await dbClient.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );
    
    // TODO: Send password reset email
    console.log(`Password reset requested for ${user.email} - Token: ${resetToken}`);
    console.log(`Reset URL: http://localhost:3000/reset-password.html?token=${resetToken}`);
    
    res.json({ message: 'If an account with that email exists, password reset instructions have been sent.' });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Find user with valid reset token
    const result = await dbClient.query(
      'SELECT id, username, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const user = result.rows[0];
    
    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password and clear reset token
    await dbClient.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    console.log(`Password reset successful for ${user.email}`);
    
    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Email Verification
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }
    
    // Find user with verification token
    const result = await dbClient.query(
      'SELECT id, username, email FROM users WHERE email_verification_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }
    
    const user = result.rows[0];
    
    // Mark email as verified
    await dbClient.query(
      'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = $1',
      [user.id]
    );
    
    console.log(`Email verified for ${user.email}`);
    
    res.json({ message: 'Email verified successfully!' });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

// Route for authentication pages
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Export for Vercel serverless deployment
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // Initialize database connection for serverless
  initializeDatabase().then(() => {
    console.log('✅ Serverless function initialized');
  }).catch(console.error);
  
  module.exports = app;
} else {
  // Local development
  startServer().catch(console.error);
}