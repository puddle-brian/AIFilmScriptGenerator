require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { Client, Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const promptBuilders = require('./prompt-builders');
const PaymentHandler = require('./payment-handlers');
const starterPack = require('./starter-pack-data');
const AIFeedbackSystem = require('./ai-feedback-system');
const BackupSystem = require('./backup-system');

// Import new route modules
const authRoutes = require('./routes/auth');
const generationRoutes = require('./routes/generation');
const projectRoutes = require('./routes/projects');
const paymentsRoutes = require('./routes/payments');
const libraryRoutes = require('./routes/library');
const adminRoutes = require('./routes/admin');
const { authenticateApiKey, checkCredits, requireAdmin, optionalAuth } = require('./middleware/auth');

// Import middleware modules
const { logger, requestLoggingMiddleware, setupGlobalErrorHandlers } = require('./middleware/logging');
const { setupRateLimiting } = require('./middleware/rateLimiting');
const { validateEmail, validateUsername, validatePassword, validateRequest, body } = require('./middleware/validation');
const { sanitizeInput } = require('./middleware/security');
const { setupErrorHandling } = require('./middleware/errorHandling');
const TrackedAnthropicAPI = require('./src/core/TrackedAnthropicAPI');
const HierarchicalContext = require('./src/core/HierarchicalContext');
const {
  ensureDirectories,
  generateStructureDescription,
  parseProjectContext,
  getSuggestionResponseFormat,
  generateVersionedProjectName,
  getModelDescription
} = require('./src/utils/UtilityFunctions');
const {
  generateBasicScript,
  generateProfessionalScreenplay,
  generateContentFromV2Format,
  formatSceneForScreenplay,
  formatPlaceholderScene,
  generateTitlePage,
  formatDialogueForScreenplay,
  generateFountainFormat,
  convertToFountain,
  generateFinalDraftFormat,
  convertToFinalDraft,
  generatePDFReadyFormat,
  generateProductionPackage
} = require('./src/formatters/ScriptFormatters');

// Setup global error handlers
setupGlobalErrorHandlers();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Claude (Anthropic)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize payment handler
let paymentHandler;

// Initialize AI feedback system
let aiFeedbackSystem;

// Initialize backup system
let backupSystem;

// Initialize PostgreSQL client (serverless-optimized with connection pooling)
const dbClient = process.env.VERCEL ? 
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3, // Small pool for serverless
    min: 0, // Allow scaling to zero
    acquire: 15000, // 15 second acquire timeout
    idle: 10000, // Close idle connections after 10 seconds
    evict: 30000, // Remove stale connections
    createTimeoutMillis: 15000,
    acquireTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 2000,
    propagateCreateError: false
  }) :
  new Client({
    connectionString: process.env.DATABASE_URL,
  });

// Database schema for usage tracking
const CREATE_USAGE_TRACKING_TABLES = `
  -- Create users table if not exists
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,
    credits_remaining INTEGER DEFAULT 0,
    total_credits_purchased INTEGER DEFAULT 0,
    email_updates BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
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
    payment_id VARCHAR(255),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
  
  -- Add missing columns to existing users table
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_updates BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
  
  -- Make email unique if not already
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;
`;

// Initialize database tables
async function initializeDatabase() {
  try {
    await dbClient.query(CREATE_USAGE_TRACKING_TABLES);
    console.log('✅ Usage tracking tables initialized');
    
    // Initialize payment handler
    paymentHandler = new PaymentHandler(dbClient);
    console.log('✅ Payment system initialized');
    
    // Initialize AI feedback system
    aiFeedbackSystem = new AIFeedbackSystem(process.env.ANTHROPIC_API_KEY, HierarchicalContext);
    console.log('✅ AI feedback system initialized');
    
    // Initialize backup system
    backupSystem = new BackupSystem(dbClient, __dirname);
    backupSystem.registerRoutes(app, authenticateApiKey);
    console.log('✅ Backup system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  }
}

// Connect to database (optimized for serverless)
async function connectToDatabase() {
  try {
    if (process.env.VERCEL) {
      // In serverless, skip database connection but initialize payment handler
      console.log('🔧 Serverless mode - database connection on-demand');
      
      // Initialize payment handler even in serverless mode
      try {
        console.log('🔧 Attempting to initialize PaymentHandler in serverless mode...');
        paymentHandler = new PaymentHandler(dbClient);
        console.log('✅ Payment system initialized (serverless mode)');
      } catch (error) {
        console.error('❌ Failed to initialize payment system in serverless mode:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Stack trace:', error.stack);
      }
      
      // Initialize AI feedback system in serverless mode
      try {
        aiFeedbackSystem = new AIFeedbackSystem(process.env.ANTHROPIC_API_KEY, HierarchicalContext);
        console.log('✅ AI feedback system initialized (serverless mode)');
      } catch (error) {
        console.error('❌ Failed to initialize AI feedback system in serverless mode:', error);
      }
      
      // Initialize backup system in serverless mode
      try {
        backupSystem = new BackupSystem(dbClient, __dirname);
        backupSystem.registerRoutes(app, authenticateApiKey);
        console.log('✅ Backup system initialized (serverless mode)');
      } catch (error) {
        console.error('❌ Failed to initialize backup system in serverless mode:', error);
      }
    } else {
      // Traditional persistent connection for local development
      await dbClient.connect();
      console.log('✅ Connected to Neon database');
      await initializeDatabase();
    }
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    // Don't throw error in serverless - let individual queries handle it
    if (!process.env.VERCEL) {
      throw error;
    }
  }
}

// Security Middleware Configuration
const isProduction = process.env.NODE_ENV === 'production';

// 1. Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for easier debugging
  crossOriginEmbedderPolicy: false // Needed for some payment widgets
}));

// 2. Compression - Performance
app.use(compression());

// 3. Rate Limiting - DoS Protection
setupRateLimiting(app);

// 4. CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (isProduction) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'https://screenplaygenie.com',
        'https://www.screenplaygenie.com',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000'
      ];
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log blocked requests for debugging
        console.log('🚫 CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'), false);
      }
    } else {
      // Allow all origins in development
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining']
};

app.use(cors(corsOptions));

// 5. Request Logging Middleware
app.use(requestLoggingMiddleware);

// ==================== SECURITY UTILITY FUNCTIONS ====================
// Note: Security and validation functions moved to middleware/security.js and middleware/validation.js

// ==================== HEALTH CHECK ENDPOINT ====================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Detailed health check for monitoring systems
app.get('/api/health', authenticateApiKey, async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {}
  };

  try {
    // Check database
    const dbStart = Date.now();
    await databaseService.healthCheck();
    healthCheck.services.database = {
      status: 'ok',
      responseTime: Date.now() - dbStart
    };
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.services.database = {
      status: 'error',
      error: error.message
    };
  }

  try {
    // Check AI service
    const aiStart = Date.now();
    await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ping' }]
    });
    healthCheck.services.ai = {
      status: 'ok',
      responseTime: Date.now() - aiStart
    };
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.services.ai = {
      status: 'error',
      error: error.message
    };
  }

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// ==================== STRIPE WEBHOOK ENDPOINTS (MUST BE BEFORE JSON MIDDLEWARE) ====================
// ==================== STRIPE WEBHOOK ENDPOINTS MOVED TO routes/payments.js ====================
// All Stripe webhook endpoints have been extracted to routes/payments.js
// This reduces server.js by 150+ lines and improves maintainability

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// =====================================
// DEPENDENCY INJECTION MIDDLEWARE
// =====================================
// Note: Dependency injection now handled through app.set() in startServer() function
// This ensures all services are properly initialized before injection

// =====================================
// MOUNT ROUTE MODULES
// =====================================

// Note: Dependency injection and route mounting moved to startServer() function
// This ensures all services are properly initialized before injection

// Import authentication middleware from routes/auth.js
// (authenticateApiKey and checkCredits are now imported at the top of the file)

// ==================== TRACKED ANTHROPIC API ====================
// TrackedAnthropicAPI class extracted to src/core/TrackedAnthropicAPI.js

// Initialize tracked Anthropic client - will be updated in initializeServices()
let trackedAnthropic;

// Serve data files
app.use('/data', express.static('data'));

// ==================== CREDIT TEST ENDPOINTS MOVED TO routes/payments.js ====================
// Test endpoints for frontend credits have been extracted

// ensureDirectories function extracted to src/utils/UtilityFunctions.js

// generateStructureDescription function extracted to src/utils/UtilityFunctions.js

// Hierarchical Context Management System
// parseProjectContext function extracted to src/utils/UtilityFunctions.js



// API Routes

// Get available plot structure templates
app.get('/api/templates', async (req, res) => {
  try {
    const templateDir = path.join(__dirname, 'templates');
    const files = await fs.readdir(templateDir);
    const templates = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(templateDir, file), 'utf8');
        const template = JSON.parse(content);
        templates.push({
          id: file.replace('.json', ''),
          name: template.name,
          description: template.description,
          category: template.category || 'uncategorized',
          examples: template.examples || ''
        });
      }
    }
    
    // Group templates by category
    const groupedTemplates = {
      essential: {
        title: "Essential Templates",
        description: "Widely-used, accessible story structures perfect for beginners and commercial projects",
        templates: templates.filter(t => t.category === 'essential')
      },
      character_driven: {
        title: "Character-Driven Structures",
        description: "Templates focusing on internal transformation and psychological development",
        templates: templates.filter(t => t.category === 'character-driven')
      },
      plot_driven: {
        title: "Plot-Driven Structures", 
        description: "Templates emphasizing plot progression and structural beats",
        templates: templates.filter(t => t.category === 'plot-driven')
      },
      television: {
        title: "Television Formats",
        description: "Structures designed specifically for TV episodes and series",
        templates: templates.filter(t => t.category === 'television')
      },
      cultural: {
        title: "Cultural & International",
        description: "Story structures from different cultural traditions and storytelling philosophies",
        templates: templates.filter(t => t.category === 'cultural')
      },
      crisis_driven: {
        title: "Crisis & Tension-Driven",
        description: "Templates built around sustained tension and multiple crisis points",
        templates: templates.filter(t => t.category === 'crisis-driven')
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
      criterion_patterns: {
        title: "Criterion Patterns",
        description: "Arthouse and international cinema structures focusing on psychological depth and unconventional narratives",
        templates: templates.filter(t => t.category === 'criterion_patterns')
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

// Get individual template data  
app.get('/api/template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const templatePath = path.join(__dirname, 'templates', `${templateId}.json`);
    
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    res.json(templateData);
  } catch (error) {
    console.error('Error loading template:', error);
    res.status(404).json({ error: 'Template not found' });
  }
});

// AI Feedback System - Clean endpoint using modular system
app.post('/api/analyze-story-concept', authenticateApiKey, async (req, res) => {
  try {
    const { storyInput, projectPath } = req.body;
    
    if (!storyInput || !storyInput.title) {
      return res.status(400).json({ error: 'Story concept with title is required' });
    }

    // AI feedback works independently of templates - it only analyzes story concept
    console.log('🎭 AI feedback analysis - no template data needed');

    // Use the modular AI feedback system (templateData not needed for story concept analysis)
    const result = await aiFeedbackSystem.analyzeStoryConcept(
      storyInput, 
      projectPath
    );
    
    res.json(result);

  } catch (error) {
    console.error('Error analyzing story concept:', error);
    res.status(500).json({ error: 'Failed to analyze story concept: ' + error.message });
  }
});

// Apply AI suggestions to improve story concept
app.post('/api/apply-suggestions', authenticateApiKey, async (req, res) => {
  try {
    const { storyInput, analysisResult } = req.body;

    if (!storyInput || !storyInput.title) {
      return res.status(400).json({ error: 'Story concept with title is required' });
    }

    if (!analysisResult || !analysisResult.suggestions) {
      return res.status(400).json({ error: 'Analysis result with suggestions is required' });
    }

    // Use the AI feedback system to apply suggestions
    const result = await aiFeedbackSystem.applyStorySuggestions(storyInput, analysisResult);
    
    res.json(result);

  } catch (error) {
    console.error('Error applying story suggestions:', error);
    res.status(500).json({ error: 'Failed to apply suggestions: ' + error.message });
  }
});

// Preview the prompt that would be used for structure generation
app.post('/api/preview-prompt', authenticateApiKey, async (req, res) => {
  try {
    const { storyInput, template, customTemplateData } = req.body;
    
    // 🔧 Use customized template data if provided, otherwise load from file
    let templateData;
    let debugInfo = {};
    
    if (customTemplateData && customTemplateData.structure) {
      console.log('🎭 Using customized template data for prompt preview');
      templateData = customTemplateData;
      debugInfo.source = 'customized';
      debugInfo.structureKeys = Object.keys(customTemplateData.structure);
      // Sample a few acts to verify customizations
      const firstActKey = Object.keys(customTemplateData.structure)[0];
      if (firstActKey) {
        debugInfo.sampleAct = {
          key: firstActKey,
          name: customTemplateData.structure[firstActKey].name,
          description: customTemplateData.structure[firstActKey].description
        };
      }
    } else {
      console.log('🎭 Loading original template data from file');
      const templatePath = path.join(__dirname, 'templates', `${template}.json`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      templateData = JSON.parse(templateContent);
      debugInfo.source = 'original_file';
      debugInfo.structureKeys = templateData.structure ? Object.keys(templateData.structure) : [];
    }
    
    const influencePrompt = storyInput.influencePrompt || '';

    // 🔧 Step 3 Fix: Use unified prompt builder that includes userDirections support
    const prompt = promptBuilders.buildStructurePrompt(storyInput, templateData);

    res.json({
      prompt: prompt,
      template: templateData,
      systemMessage: "You are a professional screenwriter and story structure expert. Generate detailed, engaging plot structures that follow the given template format. Always respond with valid JSON.",
      debugInfo: debugInfo // Include debug info in response
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
    const { storyInput, template, customPrompt, model = "claude-sonnet-4-20250514", existingProjectPath } = req.body;
    
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

    // 🔧 Use existing project path if regenerating, otherwise create new one
    let customProjectId, projectFolderName;
    
    if (existingProjectPath) {
      // Regenerating: use existing project path and extract project ID from database
      projectFolderName = existingProjectPath;
      console.log('🔄 Regenerating custom structure for existing project:', projectFolderName);
      
      // Try to get existing project ID from database
      try {
        const username = req.user.username;
        const userResult = await databaseService.getUserByUsername(username);
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          const projectResult = await databaseService.getProject(userId, projectFolderName);
          if (projectResult.rows.length > 0) {
            const existingContext = JSON.parse(projectResult.rows[0].project_context);
            customProjectId = existingContext.projectId;
            console.log('✅ Found existing custom project ID:', customProjectId);
          } else {
            // Fallback: generate new ID if project not found
            customProjectId = uuidv4();
            console.log('⚠️ Custom project not found in database, generating new ID:', customProjectId);
          }
        } else {
          customProjectId = uuidv4();
        }
      } catch (error) {
        console.error('Error retrieving existing custom project ID:', error);
        customProjectId = uuidv4();
      }
    } else {
      // New project: generate new ID and path
      customProjectId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const projectTitle = storyInput.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'untitled_story';
      projectFolderName = `${projectTitle}_${timestamp.substring(0, 19)}`;
      console.log('🆕 Creating new custom project:', projectFolderName);
    }
    
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
      projectId: customProjectId,
      customPrompt,
      generatedAt: new Date().toISOString()
    }, null, 2));
    
    // Create a readable markdown overview
    let overview = `# ${storyInput.title}\n\n`;
    overview += `**Logline:** ${storyInput.logline}\n`;
    overview += `**Characters:** ${storyInput.characters}\n`;
    overview += `**Target Scenes:** ${storyInput.totalScenes || 70}\n\n`;
    
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

Project ID: ${customProjectId}
`;
    
    await fs.writeFile(readmeFile, readme);
    
    console.log(`Project saved to: ${projectDir}`);
    console.log(`Project ID: ${customProjectId}`);

    // Also save to database for profile page (use 'guest' as default user)
    try {
      const username = req.user.username; // Get from authenticated user
      const projectContext = {
        structure: structureData,
        template: templateData,
        storyInput,
        projectId: customProjectId,
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
      const userResult = await databaseService.getUserByUsername(username);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Save project to database
        await databaseService.saveProject(userId, projectFolderName, projectContext, thumbnailData);
        
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
      projectId: customProjectId,
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

// 🆕 MIGRATED: Generate structure using GenerationService (Phase 2A)
app.post('/api/generate-structure', authenticateApiKey, async (req, res) => {
  try {
    // Check if new services are available
    if (!generationService || !creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { storyInput, template, customTemplateData, model = "claude-sonnet-4-20250514", existingProjectPath } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for structure: ${storyInput.title}`);
    
    // Check credits using new CreditService
    const creditCheck = await creditService.checkCredits(username, 10);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Generate structure using new GenerationService
    const result = await generationService.generateStructure(
      storyInput, customTemplateData, existingProjectPath, model, username
    );
    
    // Deduct credits using new CreditService
    await creditService.deductCredits(username, 10, 'generate-structure');
    await creditService.logUsage(username, 'generate-structure', 10, true);
    
    console.log('✅ Structure generation completed using GenerationService');
    
    res.json({
      ...result,
      migratedEndpoint: true,
      generatedBy: 'GenerationService v2.0',
      codeReduction: '200+ lines -> 40 lines'
    });

  } catch (error) {
    console.error('Error in migrated structure generation:', error);
    
    // Log error with CreditService if available
    if (creditService) {
      await creditService.logUsage(req.user.username, 'generate-structure', 10, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate structure',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// 🆕 MIGRATED: Generate scenes using GenerationService (Phase 2A FINAL)
app.post('/api/generate-scenes', authenticateApiKey, async (req, res) => {
  try {
    // Check if new services are available
    if (!generationService || !creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { structure, storyInput, projectId, projectPath, model = "claude-sonnet-4-20250514" } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for scenes: ${storyInput?.title || 'Untitled'}`);
    
    // Check credits using new CreditService
    const creditCheck = await creditService.checkCredits(username, 7);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Generate scenes using new GenerationService
    const result = await generationService.generateScenes(
      structure, storyInput, projectPath, username, model
    );
    
    // Deduct credits using new CreditService
    await creditService.deductCredits(username, 7, 'generate-scenes');
    await creditService.logUsage(username, 'generate-scenes', 7, true);
    
    console.log('✅ Scene generation completed using GenerationService');
    
    res.json({
      ...result,
      migratedEndpoint: true,
      generatedBy: 'GenerationService v2.0',
      codeReduction: '45+ lines -> 35 lines',
      featuresAdded: ['authentication', 'credit_checking', 'error_logging']
    });

  } catch (error) {
    console.error('Error in migrated scene generation:', error);
    
    // Log error with CreditService if available
    if (creditService) {
      await creditService.logUsage(req.user.username, 'generate-scenes', 7, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate scenes',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// 🆕 MIGRATED: Generate dialogue using GenerationService (Phase 2A)
app.post('/api/generate-dialogue', authenticateApiKey, async (req, res) => {
  try {
    // Check if new services are available
    if (!generationService || !creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { scene, storyInput, context, projectPath, model = "claude-sonnet-4-20250514", creativeDirections = null } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for dialogue: ${scene.title || 'Untitled'}`);
    
    // Check credits using new CreditService
    const creditCheck = await creditService.checkCredits(username, 3);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Generate dialogue using new GenerationService
    const result = await generationService.generateDialogue(
      scene, storyInput, context, projectPath, username, model, creativeDirections
    );
    
    // Deduct credits using new CreditService
    await creditService.deductCredits(username, 3, 'generate-dialogue');
    await creditService.logUsage(username, 'generate-dialogue', 3, true);
    
    console.log('✅ Dialogue generation completed using GenerationService');
    
    res.json({
      ...result,
      migratedEndpoint: true,
      generatedBy: 'GenerationService v2.0'
    });

  } catch (error) {
    console.error('Error in migrated dialogue generation:', error);
    
    // Log error with CreditService if available
    if (creditService) {
      await creditService.logUsage(req.user.username, 'generate-dialogue', 3, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate dialogue',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// 🧞‍♂️ Genie Suggestions API Endpoint
app.post('/api/genie-suggestion', authenticateApiKey, checkCredits(2), async (req, res) => {
  try {
    const { suggestionType, prompt, context, temperature = 0.8 } = req.body;
    
    if (!suggestionType || !prompt) {
      return res.status(400).json({ error: 'Missing required fields: suggestionType and prompt' });
    }

    console.log(`🧞‍♂️ Generating Genie suggestion for type: ${suggestionType}`);

    // Build system message based on suggestion type
    const systemMessages = {
      'director': 'You are a film expert with deep knowledge of directors and their distinctive styles. Suggest directors whose approaches would enhance the given story.',
      'screenwriter': 'You are a screenwriting expert with knowledge of different prose styles and approaches. Suggest screenwriters whose styles would enhance the given story.',
      'film': 'You are a cinema expert with knowledge of influential films. Suggest films whose essence and approach would enhance the given story.',
      'tone': 'You are a storytelling expert who understands mood and atmosphere. Suggest tones that would enhance the given story.',
      'character': 'You are a character development expert. Suggest compelling characters that would enhance the given story.',
      'storyconcept': 'You are a story development expert who specializes in creating diverse, original concepts. Avoid overused tropes like memory manipulation, time travel, or dystopian themes. Focus on fresh human stories across different genres and real-world conflicts.'
    };

    const systemMessage = systemMessages[suggestionType] || 'You are a creative writing expert. Provide helpful suggestions to enhance the given story.';

    // Create appropriate response format instructions
    const responseFormat = getSuggestionResponseFormat(suggestionType);
    const fullPrompt = `${prompt}\n\n${responseFormat}`;

    // Use tracked API for credit deduction and logging
    const completion = await trackedAnthropic.messages({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      temperature: temperature, // Use provided temperature for variation
      system: systemMessage,
      messages: [
        {
          role: "user",
          content: fullPrompt
        }
      ]
    }, req.user, `/api/genie-suggestion`, null);

    let suggestion;
    const text = completion.content[0].text.trim();
    
    if (suggestionType === 'storyconcept') {
      // Parse the new Title/Logline format for story concepts
      const titleMatch = text.match(/Title:\s*(.+)/i);
      const loglineMatch = text.match(/Logline:\s*(.+)/i);
      
      suggestion = {
        title: titleMatch ? titleMatch[1].trim() : text.substring(0, 50),
        logline: loglineMatch ? loglineMatch[1].trim() : text
      };
    } else if (suggestionType === 'character') {
      // Try to parse as JSON first for characters
      try {
        suggestion = JSON.parse(text);
      } catch (parseError) {
        // If not JSON, create a simple structure from plain text
        const lines = text.split('\n').filter(line => line.trim());
        suggestion = {
          name: lines[0]?.replace(/^(Name|Character):\s*/, '').trim() || text.substring(0, 50),
          description: lines.slice(1).join('\n').trim() || text
        };
      }
    } else {
      // For simple types, use the entire text as content
      suggestion = {
        content: text
      };
    }

    console.log(`✅ Genie suggestion generated for type: ${suggestionType}`);
    
    res.json({
      suggestion: suggestion,
      suggestionType: suggestionType,
      context: context,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating Genie suggestion:', error);
    res.status(500).json({ 
      error: 'Failed to generate suggestion',
      details: error.message
    });
  }
});

// getSuggestionResponseFormat function extracted to src/utils/UtilityFunctions.js

// Preview dialogue generation prompt
app.post('/api/preview-dialogue-prompt', authenticateApiKey, async (req, res) => {
  console.log('Dialogue prompt preview endpoint called!');
  try {
    const { scene, storyInput, context, projectPath, structureKey, sceneIndex } = req.body;
    console.log('Request body:', { scene: !!scene, storyInput: !!storyInput, context, projectPath, structureKey, sceneIndex });
    
    let prompt, systemMessage, hierarchicalPrompt = null;
    
    // Try to build hierarchical context if we have project information
    if (projectPath && storyInput && structureKey !== undefined && sceneIndex !== undefined) {
      try {
        // Initialize and load hierarchical context
        const hierarchicalContext = new HierarchicalContext({
      db: dbClient,
      anthropic: anthropic
    });
        
        // Build story context
        hierarchicalContext.buildStoryContext(storyInput, storyInput.influencePrompt);
        
        // Try to load project structure and template from database
        try {
          const username = req.user.username; // Get from authenticated user
          const userResult = await databaseService.getUserByUsername(username);
          
          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            
            // Get project context from database
            const projectResult = await databaseService.getProject(userId, projectPath);
            
            if (projectResult.rows.length > 0) {
              const projectContext = parseProjectContext(projectResult.rows[0].project_context);
              
              // Load context if available
              await hierarchicalContext.loadFromProject(projectPath);
              
              // Build structure context from database data
              hierarchicalContext.buildStructureContext(projectContext.generatedStructure, projectContext.templateData);
              
              // Find the current structural element
              const structureElementKey = Object.keys(projectContext.generatedStructure)[structureKey];
              const structureElement = projectContext.generatedStructure[structureElementKey];
              
              if (structureElement) {
                // Build act context
                const actPosition = Object.keys(projectContext.generatedStructure).indexOf(structureElementKey) + 1;
                hierarchicalContext.buildActContext(structureElementKey, structureElement, actPosition);
                
                // Try to load plot points for this act from database
                try {
                  if (projectContext.plotPoints && projectContext.plotPoints[structureElementKey]) {
                    const plotPointsData = projectContext.plotPoints[structureElementKey];
                    await hierarchicalContext.buildPlotPointsContext(plotPointsData.plotPoints || plotPointsData, null, null, username);
                  } else {
                    console.log('No plot points found for this act in database');
                  }
                } catch (error) {
                  console.log('Error loading plot points from database:', error);
                }
                
                // Build scene context
                hierarchicalContext.buildSceneContext(sceneIndex, null, scene, 1);
              }
            } else {
              console.log('Project not found in database');
            }
          } else {
            console.log('User not found in database');
          }
        } catch (error) {
          console.log('Error loading project structure from database:', error);
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
        
        hierarchicalPrompt = await hierarchicalContext.generateHierarchicalPrompt(5, customInstructions);
        
        // Use our template system for hierarchical dialogue generation
        prompt = promptBuilders.buildDialoguePrompt(hierarchicalPrompt, scene, context);
        
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
      
      // Use our template system for simple dialogue fallback
      prompt = promptBuilders.buildSimpleDialoguePrompt(storyInput, scene, context);

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

// 🆕 MIGRATED: Auto-save project using ProjectService (Phase 2C)
app.post('/api/auto-save-project', async (req, res) => {
  try {
    // Check if new services are available
    if (!projectService) {
      return res.status(503).json({ 
        error: 'Project service temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const projectData = req.body;
    const username = projectData.username || 'guest';
    
    console.log(`🆕 Using ProjectService to auto-save project for user: ${username}`);
    
    // Handle bug detection - if no projectPath but has title, let ProjectService handle it
    if (!projectData.projectPath && !projectData.storyInput?.title) {
      console.error('🚨 BUG: Auto-save called without projectPath or title!');
      return res.status(400).json({ 
        error: 'Auto-save failed: No project path or title provided', 
        message: 'This indicates a bug in the frontend state management. Please reload the page and try again.',
        action: 'reload_required',
        debug: {
          hasStoryInput: !!projectData.storyInput,
          currentStep: projectData.currentStep
        }
      });
    }
    
    // Use ProjectService to handle all the complex auto-save logic
    const result = await projectService.autoSaveProject({
      ...projectData,
      username,
      existingProjectPath: projectData.projectPath
    });
    
    console.log(`✅ Auto-save completed using ProjectService: "${result.projectPath}"`);
    
    res.json({
      success: true,
      projectId: result.projectId,
      projectPath: result.projectPath,
      message: result.message,
      format: 'v2.0-unified'
    });
    
  } catch (error) {
    console.error('Error auto-saving project (migrated):', error);
    res.status(500).json({ 
      error: 'Failed to auto-save project',
      details: error.message
    });
  }
});

// Save project (legacy endpoint - redirects to auto-save)
app.post('/api/save-project', async (req, res) => {
  try {
    console.log('⚠️ Legacy /api/save-project called - redirecting to auto-save');
    
    const projectData = req.body;
    const username = projectData.username || 'guest';
    
    // Generate project name from path or title
    const projectPath = projectData.projectPath || 
      (projectData.storyInput?.title ? 
        `${projectData.storyInput.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}` :
        `untitled_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`);
    
    // Create unified project context in v2.0 format
    const projectContext = {
      projectId: projectData.projectId || uuidv4(),
      projectPath: projectPath,
      storyInput: projectData.storyInput || {},
      selectedTemplate: projectData.selectedTemplate,
      templateData: projectData.templateData,
      generatedStructure: projectData.generatedStructure,
      plotPoints: projectData.plotPoints || {},
      generatedScenes: projectData.generatedScenes || {},
      generatedDialogues: projectData.generatedDialogues || {},
      currentStep: projectData.currentStep || 1,
      influences: projectData.influences || {},
      projectCharacters: projectData.projectCharacters || [],
      generatedAt: new Date().toISOString()
    };
    
    // Create thumbnail data for project listing
    const thumbnailData = {
      title: projectData.storyInput?.title || 'Untitled Project',
      genre: projectData.storyInput?.genre || 'Unknown',
      tone: projectData.storyInput?.tone || '',
      structure: projectData.templateData?.name || '',
      currentStep: projectData.currentStep || 1,
      totalScenes: projectData.storyInput?.totalScenes || 70
    };
    
    // Get user ID
    const userResult = await databaseService.getUserByUsername(username);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Save to database using unified format
    const result = await dbClient.query(
      `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, project_name) 
       DO UPDATE SET project_context = $3, thumbnail_data = $4, updated_at = NOW()
       RETURNING *`,
      [userId, projectPath, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
    );
    
    console.log(`✅ Legacy save-project redirected to auto-save: "${thumbnailData.title}"`);
    
    // Return legacy-compatible response
    res.json({ 
      projectId: projectContext.projectId, 
      projectPath: projectPath,
      message: 'Project saved successfully' 
    });
    
  } catch (error) {
    console.error('Error in legacy save-project redirect:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// 🆕 MIGRATED: List projects using ProjectService (Phase 2C)
app.get('/api/list-projects', async (req, res) => {
  try {
    // Check if new services are available
    if (!projectService) {
      return res.status(503).json({ 
        error: 'Project service temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const username = req.query.username || 'guest';
    
    console.log(`🆕 Using ProjectService to list projects for user: ${username}`);
    
    // Get projects using ProjectService - handles all database operations and parsing
    const projects = await projectService.listUserProjects(username);
    
    console.log(`✅ Project listing completed using ProjectService: ${projects.length} projects`);
    
    res.json(projects);
    
  } catch (error) {
    console.error('Error listing projects (migrated):', error);
    res.status(500).json({ 
      error: 'Failed to list projects',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// Load project (legacy endpoint - redirects to database)
app.get('/api/project/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const username = req.user.username; // Get from authenticated user
    
    // Try to load from database first
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Look for project in database by project_name (assuming projectId = project_name)
      const projectResult = await databaseService.getProject(userId, projectId);
      
      if (projectResult.rows.length > 0) {
        const dbProject = projectResult.rows[0];
        const projectContext = parseProjectContext(dbProject.project_context);
        
        console.log(`✅ Loaded legacy project from database: "${projectContext.storyInput?.title || projectId}"`);
        
        // Return in legacy format for compatibility
        return res.json({
          projectId: projectContext.projectId,
          storyInput: projectContext.storyInput,
          selectedTemplate: projectContext.selectedTemplate,
          templateData: projectContext.templateData,
          generatedStructure: projectContext.generatedStructure,
          plotPoints: projectContext.plotPoints,
          generatedScenes: projectContext.generatedScenes,
          generatedDialogues: projectContext.generatedDialogues,
          currentStep: projectContext.currentStep,
          generatedAt: dbProject.created_at,
          updatedAt: dbProject.updated_at
        });
      }
    }
    
    // Fallback to file system for old projects
    try {
      const projectFile = path.join(__dirname, 'generated', projectId, 'project.json');
      const projectData = await fs.readFile(projectFile, 'utf8');
      console.log(`📁 Legacy project loaded from file system: ${projectId}`);
      res.json(JSON.parse(projectData));
    } catch (fsError) {
      console.error('Error loading project from file system:', fsError);
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(404).json({ error: 'Project not found' });
  }
});

// 🆕 MIGRATED: Load project using ProjectService (Phase 2C)
app.get('/api/load-project/:projectPath', async (req, res) => {
  try {
    // Check if new services are available
    if (!projectService) {
      return res.status(503).json({ 
        error: 'Project service temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const projectPath = req.params.projectPath;
    const username = req.query.username || 'guest';
    
    console.log(`🆕 Using ProjectService to load project "${projectPath}" for user "${username}"`);
    
    // Load project using ProjectService - handles all database operations, JSON parsing, and template fixing
    const projectData = await projectService.loadProject(username, projectPath);
    
    console.log(`✅ Project loading completed using ProjectService: "${projectData.storyInput?.title || projectPath}"`);
    
    res.json(projectData);
    
  } catch (error) {
    console.error('Error loading project (migrated):', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (error.message === 'Project not found') {
      return res.status(404).json({ 
        error: 'Project not found',
        message: 'This project may need to be migrated to the new format'
      });
    }
    
    res.status(500).json({ 
      error: 'Project not found or corrupted',
      details: error.message
    });
  }
});

// Load existing plot points for a project (database version)
app.get('/api/load-plot-points/:projectPath', async (req, res) => {
  try {
    const { projectPath } = req.params;
    const username = req.query.username;
    
    console.log(`📋 Loading plot points for project: ${projectPath}`);
    
    if (!projectService) {
      console.warn('ProjectService not available, loading plot points directly from database');
      
      // Direct database query as fallback
      if (!username) {
        return res.status(400).json({ error: 'Username required for plot points loading' });
      }
      
      // First, get user ID
      const userResult = await databaseService.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = userResult.rows[0].id;
      
      // Then get project context
      const result = await databaseService.getProject(userId, projectPath);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const projectContext = parseProjectContext(result.rows[0].project_context);
      const plotPoints = projectContext.plotPoints || {};
      
      console.log(`✅ Loaded plot points for ${Object.keys(plotPoints).length} structure elements (direct DB)`);
      
      return res.json({ 
        plotPoints: plotPoints,
        projectPath: projectPath,
        totalStructures: Object.keys(plotPoints).length
      });
    }
    
    // Use ProjectService to load project data
    try {
      const project = await projectService.loadProject(projectPath, username);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const plotPoints = project.plotPoints || {};
      
      console.log(`✅ Loaded plot points for ${Object.keys(plotPoints).length} structure elements (ProjectService)`);
      
      return res.json({ 
        plotPoints: plotPoints,
        projectPath: projectPath,
        totalStructures: Object.keys(plotPoints).length
      });
    } catch (serviceError) {
      console.warn('ProjectService failed, trying direct database access:', serviceError.message);
      
      // Fallback to direct database access if ProjectService fails
      if (!username) {
        return res.status(400).json({ error: 'Username required for plot points loading' });
      }
      
      const userResult = await databaseService.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = userResult.rows[0].id;
      
      const result = await databaseService.getProject(userId, projectPath);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const projectContext = parseProjectContext(result.rows[0].project_context);
      const plotPoints = projectContext.plotPoints || {};
      
      console.log(`✅ Loaded plot points for ${Object.keys(plotPoints).length} structure elements (fallback DB)`);
      
      return res.json({ 
        plotPoints: plotPoints,
        projectPath: projectPath,
        totalStructures: Object.keys(plotPoints).length
      });
    }
    
  } catch (error) {
    console.error('❌ Error loading plot points:', error);
    res.status(500).json({ error: 'Failed to load plot points', details: error.message });
  }
});

// NOTE: Old file-based delete endpoint removed - system now uses database-only storage
// Projects are deleted via /api/users/:userId/projects endpoint

// Preview scene generation prompt
app.post('/api/preview-scene-prompt', authenticateApiKey, async (req, res) => {
  try {
    const { storyInput, structureElement, sceneCount = 3, existingScene = null, sceneIndex = null, projectPath = null } = req.body;
    
    let prompt, systemMessage, hierarchicalPrompt = null;
    
    // Try to build hierarchical context if we have project information
    if (projectPath && storyInput) {
      try {
        // Initialize and load hierarchical context
        const context = new HierarchicalContext({
          db: dbClient,
          anthropic: anthropic
        });
        
        // Build story context
        context.buildStoryContext(storyInput, storyInput.influencePrompt);
        
        // Try to load project structure and template from database
        try {
          const username = req.user.username; // Get from authenticated user
          const userResult = await databaseService.getUserByUsername(username);
          
          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            
            // Get project context from database
            const projectResult = await databaseService.getProject(userId, projectPath);
            
            if (projectResult.rows.length > 0) {
              const projectContext = parseProjectContext(projectResult.rows[0].project_context);
              
              if (projectContext.generatedStructure && projectContext.templateData) {
                context.buildStructureContext(projectContext.generatedStructure, projectContext.templateData);
                
                // Find the structure key for this element
                const structureKey = Object.keys(projectContext.generatedStructure).find(key => 
                  projectContext.generatedStructure[key].name === structureElement.name ||
                  key === structureElement.key
                );
                
                if (structureKey) {
                  const actPosition = Object.keys(projectContext.generatedStructure).indexOf(structureKey) + 1;
                  context.buildActContext(structureKey, structureElement, actPosition);
                  
                  // Try to load plot points for this act from database
                  try {
                    if (projectContext.plotPoints && projectContext.plotPoints[structureKey]) {
                      const plotPointsData = projectContext.plotPoints[structureKey];
                      if ((plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) || Array.isArray(plotPointsData)) {
                        await context.buildPlotPointsContext(plotPointsData.plotPoints || plotPointsData, sceneCount, projectPath, req.user.username);
                        
                        // If generating an individual scene, build scene context
                        if (existingScene && sceneIndex !== null) {
                          context.buildSceneContext(sceneIndex, sceneIndex, existingScene, sceneCount);
                        }
                      }
                    } else {
                      console.log(`No plot points found for this act (${structureKey}) in database, using basic context`);
                    }
                  } catch (plotError) {
                    console.log(`Error loading plot points from database for ${structureKey}:`, plotError.message);
                  }
                }
              }
            } else {
              console.log('Project not found in database for scene preview');
            }
          } else {
            console.log('User not found in database for scene preview');
          }
        } catch (projectError) {
          console.log('Could not load project context from database, using basic story context:', projectError.message);
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
        
        hierarchicalPrompt = await context.generateHierarchicalPrompt(5, customInstructions);
        
        // Use hierarchical prompt directly instead of template system
        if (existingScene && sceneIndex !== null) {
          // For individual scene regeneration, use hierarchical prompt directly
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
          // For multiple scenes, use hierarchical prompt directly
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
        // Individual scene regeneration prompt - direct approach
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
- Create a single scene that fits this structural element
- Make it cinematic and specific, not just a plot summary
- Scene should advance the plot and character development described above
- Include: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats

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
        // Multiple scenes generation prompt - direct approach
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
6. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward

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
      
      systemMessage = "You are a professional screenwriter generating scenes within a story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.";
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
app.post('/api/preview-plot-point-prompt', authenticateApiKey, async (req, res) => {
  try {
    const { storyInput, structure, templateData, structureElements, targetScene = null, sceneIndex = null, structureElement = null } = req.body;
    
    let prompt, systemMessage;
    
    if (targetScene && sceneIndex !== null && structureElement) {
      // Individual plot point generation prompt - using structure elements instead of scenes
      const structureKeys = Object.keys(structure);
      const currentIndex = structureKeys.indexOf(structureElement.key);
      const previousElement = currentIndex > 0 ? structure[structureKeys[currentIndex - 1]] : null;
      const nextElement = currentIndex < structureKeys.length - 1 ? structure[structureKeys[currentIndex + 1]] : null;
      
      prompt = `You are a master screenwriter creating a plot point that connects structural elements with clear causal relationships.

STORY CONTEXT:
Title: ${storyInput.title}
Logline: ${storyInput.logline}
Characters: ${storyInput.characters}
Genre: ${storyInput.genre || storyInput.tone}

TARGET STRUCTURAL ELEMENT:
Name: ${structureElement.name}
Description: ${structureElement.description}

CONTEXT:
${previousElement ? `Previous Element: ${previousElement.name} - ${previousElement.description}` : 'This is the first structural element'}
${nextElement ? `Next Element: ${nextElement.name} - ${nextElement.description}` : 'This is the final structural element'}

TASK: Generate a single plot point for the target structural element that:

1. Is a clear, concise sentence capturing the element's key story beat
2. ${previousElement ? 'Connects causally to the previous element (using "BUT" for conflict or "THEREFORE" for consequence - avoid "and then")' : 'Establishes the initial situation clearly'}
3. ${nextElement ? 'Sets up the next element logically' : 'Provides satisfying closure'}
4. Maintains narrative momentum and character development
5. Is specific to this element's content and purpose

Return ONLY a JSON object:
{
  "plotPoint": "Your single plot point sentence here"
}`;
      
      systemMessage = "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events - never internal feelings. Focus on visual conflicts, character choices under pressure, and specific dramatic situations with urgency.";
    } else {
      // All plot points generation prompt - using structure instead of scenes
      const structureKeys = Object.keys(structure);
      
      prompt = `You are a master screenwriter creating plot points that connect structural elements with clear causal relationships.

STORY CONTEXT:
Title: ${storyInput.title}
Logline: ${storyInput.logline}
Characters: ${storyInput.characters}
Genre: ${storyInput.genre || storyInput.tone}
Tone: ${storyInput.tone}

STRUCTURAL ELEMENTS TO CONNECT:
${structureKeys.map((key, index) => `
Element ${index + 1} (${key}): ${structure[key].name}
- Description: ${structure[key].description}
- Character Development: ${structure[key].character_developments || structure[key].character_development || 'Not specified'}
`).join('')}

TASK: Generate a plot point for each structural element that creates clear causal connections using "BUT" and "THEREFORE" logic (avoid weak "and then" sequencing). Each plot point should:

1. Be a single, clear sentence that captures the element's key story beat
2. Connect causally to the previous element (using "BUT" for conflict or "THEREFORE" for consequence - avoid "and then")
3. Set up the next element logically
4. Maintain narrative momentum and character development
5. Be specific to the element's content and purpose

Return ONLY a JSON object with this structure:
{
  "plotPoints": [
    "Element 1 plot point that establishes the initial situation",
    "But Element 2 plot point that introduces conflict or complication from Element 1",
    "Therefore Element 3 plot point that shows the consequence or progress from Element 2",
    // ... continue for all ${structureKeys.length} elements
  ]
}

Focus on creating a strong narrative spine where each element leads logically to the next through conflict and consequence.`;
      
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
app.post('/api/preview-act-plot-points-prompt', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, structureKey, desiredSceneCount = 3 } = req.body;
    
    // 🔧 CRITICAL FIX: desiredSceneCount is actually the desired PLOT POINT count from the dropdown
    const desiredPlotPointCount = desiredSceneCount || 4; // User's selected plot point count
    
    // Load project data from database using authenticated user
    const userId = req.user.id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const { generatedStructure: structure, storyInput } = projectContext;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    const storyAct = structure[structureKey];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext({
      db: dbClient,
      anthropic: anthropic
    });
    await context.loadFromProject(projectPath);
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, storyInput.influencePrompt, projectContext.lastUsedSystemMessage, projectContext);
      context.buildStructureContext(structure, projectContext.templateData);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
    context.buildActContext(structureKey, storyAct, actPosition);
    
    // Build plot points context to load previous acts' plot points for preview
    await context.buildPlotPointsContext([], 0, projectPath, req.user.username);
    
    // Generate hierarchical prompt for plot points generation (Level 4) with streamlined instructions
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(4);
    
    // Build the actual final prompt that gets sent to the AI
    const finalPrompt = promptBuilders.buildPlotPointsPrompt(hierarchicalPrompt, desiredPlotPointCount, desiredPlotPointCount);

    const systemMessage = "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events - never internal feelings. Focus on visual conflicts, character choices under pressure, and specific dramatic situations with urgency. Always respond with valid JSON.";

    res.json({
      prompt: finalPrompt,
      systemMessage: systemMessage,  
      promptType: 'act_plot_points',
      storyAct: storyAct,
      structureKey: structureKey,
      desiredSceneCount: desiredPlotPointCount,
      hierarchicalPrompt: hierarchicalPrompt,
      previewNote: "This is the EXACT prompt sent to the AI for plot points generation. The hierarchical context provides story continuity, while the template ensures proper formatting."
    });

  } catch (error) {
    console.error('Error generating act plot points prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate act plot points prompt preview', details: error.message });
  }
});

// Generate multiple scenes for a specific plot point
app.post('/api/generate-scenes-for-plot-point/:projectPath/:actKey/:plotPointIndex', authenticateApiKey, checkCredits(10), async (req, res) => {
  try {
    const { projectPath, actKey, plotPointIndex } = req.params;
    const { model = "claude-sonnet-4-20250514", creativeDirections = null } = req.body;
    
    console.log(`🎬 SCENE GENERATION DEBUG: Starting for ${projectPath}/${actKey}/${plotPointIndex}`);
    
    // Process creative directions if provided
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    console.log(`👤 User: ${username}`);
    
    // Ensure database connection is healthy
    try {
      await databaseService.healthCheck();
    } catch (connectionError) {
      console.error('Database connection error, attempting to reconnect:', connectionError);
      await connectToDatabase();
    }
    
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    console.log(`📊 Project context loaded. Keys: ${Object.keys(projectContext).join(', ')}`);
    console.log(`📋 Available plot point acts: ${projectContext.plotPoints ? Object.keys(projectContext.plotPoints).join(', ') : 'NONE'}`);
    
    // Load plot points data with scene distribution from database
    let plotPointsData;
    let plotPointsArray;
    try {
      if (!projectContext.plotPoints || !projectContext.plotPoints[actKey]) {
        return res.status(400).json({ error: 'Plot points not found. Please generate plot points for this act first.' });
      }
      plotPointsData = projectContext.plotPoints[actKey];
      
      // Handle both data structures: direct array or object with plotPoints property
      if (Array.isArray(plotPointsData)) {
        // Direct array format
        plotPointsArray = plotPointsData;
        console.log(`📋 Using direct array format: ${plotPointsArray.length} plot points`);
      } else if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
        // Object with plotPoints property
        plotPointsArray = plotPointsData.plotPoints;
        console.log(`📋 Using object format: ${plotPointsArray.length} plot points`);
      } else {
        console.log(`❌ Invalid plot points data structure for act ${actKey}:`, JSON.stringify(plotPointsData, null, 2));
        return res.status(400).json({ error: 'Plot points data is corrupted. Please regenerate plot points for this act.' });
      }
      
    } catch (error) {
      return res.status(400).json({ error: 'Plot points data not found. Please generate plot points for this act first.' });
    }
    
    const plotPointIndexNum = parseInt(plotPointIndex);
    
    if (plotPointIndexNum < 0 || plotPointIndexNum >= plotPointsArray.length) {
      return res.status(400).json({ error: 'Invalid plot point index' });
    }
    
    // 🔧 CRITICAL FIX: Always recalculate scene distribution using fixed logic
    // Don't rely on stored scene distribution which may be from old buggy calculation
    console.log(`🔧 Recalculating scene distribution using fixed logic for plot point ${plotPointIndexNum}`);
    
    // Use same logic as calculateSceneDistribution for consistency
    const totalScenes = projectContext?.storyInput?.totalScenes || 70;
    const totalActs = projectContext?.generatedStructure ? Object.keys(projectContext.generatedStructure).length : 15;
    const expectedPlotPoints = totalActs * 3;
    const sceneCount = Math.max(1, Math.min(3, Math.round(totalScenes / expectedPlotPoints)));
    
    console.log(`📊 Fixed calculation: ${totalScenes} scenes ÷ ${expectedPlotPoints} expected plot points = ${sceneCount} scenes per plot point (capped at 3 max)`);
    
    const plotPoint = plotPointsArray[plotPointIndexNum];
    if (!plotPoint) {
      return res.status(400).json({ error: `Plot point ${plotPointIndexNum} not found in act ${actKey}` });
    }
    
    console.log(`Generating ${sceneCount} scenes for plot point ${plotPointIndexNum + 1}: "${plotPoint}"`);
    
    // Initialize hierarchical context (don't load from file system - we have database data)
    const context = new HierarchicalContext({
      db: dbClient,
      anthropic: anthropic
    });
    
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    // Build context from database data
    context.buildStoryContext(storyInput, storyInput.influencePrompt || storyInput.originalPrompt, projectContext.lastUsedSystemMessage, projectContext);
    context.buildStructureContext(structure, projectContext.templateData);
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(actKey) + 1;
    context.buildActContext(actKey, structure[actKey], actPosition);
    
    // Build plot points context
    const totalScenesForAct = plotPointsData.totalScenesForAct || plotPointsArray.length * 2; // Fallback
    await context.buildPlotPointsContext(plotPointsArray, totalScenesForAct, projectPath, req.user.username);
    
    // Build scene context for this specific plot point
    context.buildSceneContext(0, plotPointIndexNum, null, sceneCount);
    
    // Generate hierarchical prompt for multiple scenes from one plot point
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(5, `
MULTIPLE SCENES GENERATION FROM SINGLE PLOT POINT:
1. Create exactly ${sceneCount} scenes that collectively implement this plot point: "${plotPoint}"
2. Break the plot point into a ${sceneCount}-scene sequence that shows progression
3. Each scene should advance this plot point's dramatic purpose step-by-step
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Create a natural flow between scenes in this sequence
6. Each scene needs: title, location, time_of_day, description (3-6 sentences), characters, emotional_beats
7. Scenes should feel like organic parts of a sequence, not isolated fragments
8. Write in CINEMATIC LANGUAGE that translates story beats into visual terms
9. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

CINEMATIC WRITING FOUNDATION:
• Lead with CHARACTER ACTIONS and decisions that drive the story forward
• Show physical behaviors, movements, and reactions in visual detail
• Focus on cause-and-effect storytelling through character choices
• Use concrete, observable details that a camera could capture
• Let the artistic influences naturally flavor this strong foundation

This plot point is ${true ? 'a plot point' : 'a plot point'} in the story structure.`);
    
    let prompt = `${hierarchicalPrompt}

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

    // Add creative directions if provided
    const scenesKey = `${actKey}_${plotPointIndexNum}`;
    if (creativeDirections?.scenes?.[scenesKey]) {
      const direction = creativeDirections.scenes[scenesKey];
      console.log(`✨ Adding creative direction for scenes: "${direction}"`);
      prompt = `${hierarchicalPrompt}

User Creative Direction for Scenes: ${direction}
⚠️ IMPORTANT: Incorporate this creative direction into the scenes for this plot point.

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
    }

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
    const aiResponse = completion.content[0].text;
    
    console.log('🔍 AI Response received, length:', aiResponse.length);
    console.log('🔍 First 200 chars:', aiResponse.substring(0, 200));
    console.log('🔍 Last 200 chars:', aiResponse.substring(-200));
    
    try {
      // Try direct JSON parse first
      scenesData = JSON.parse(aiResponse);
      console.log(`✅ Successfully parsed JSON: Generated ${scenesData.scenes ? scenesData.scenes.length : 'unknown'} scenes for plot point`);
    } catch (directParseError) {
      console.log('❌ Direct JSON parse failed:', directParseError.message);
      
      // Try to extract JSON from markdown code blocks or other wrapping
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        console.log('🔧 Found JSON in markdown code block, attempting to parse...');
        try {
          scenesData = JSON.parse(jsonMatch[1]);
          console.log(`✅ Successfully parsed JSON from markdown: Generated ${scenesData.scenes ? scenesData.scenes.length : 'unknown'} scenes for plot point`);
        } catch (markdownParseError) {
          console.log('❌ Markdown JSON parse failed:', markdownParseError.message);
        }
      }
      
      // If still no success, try to find JSON object in the response
      if (!scenesData) {
        const jsonStart = aiResponse.indexOf('{');
        const jsonEnd = aiResponse.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const extractedJson = aiResponse.substring(jsonStart, jsonEnd + 1);
          console.log('🔧 Attempting to parse extracted JSON section...');
          try {
            scenesData = JSON.parse(extractedJson);
            console.log(`✅ Successfully parsed extracted JSON: Generated ${scenesData.scenes ? scenesData.scenes.length : 'unknown'} scenes for plot point`);
          } catch (extractedParseError) {
            console.log('❌ Extracted JSON parse failed:', extractedParseError.message);
          }
        }
      }
      
      // If all parsing attempts failed, return detailed error
      if (!scenesData) {
        console.log('❌ All JSON parsing attempts failed');
        console.log('🔍 Full AI response:', aiResponse);
        return res.status(500).json({ 
          error: 'Failed to parse AI response', 
          details: directParseError.message,
          rawResponse: aiResponse.substring(0, 1000) + (aiResponse.length > 1000 ? '...' : ''),
          parseAttempts: ['direct', 'markdown', 'extracted'].join(', ')
        });
      }
    }

    // Save scenes to database
    if (!projectContext.generatedScenes) {
      projectContext.generatedScenes = {};
    }
    if (!projectContext.generatedScenes[actKey]) {
      projectContext.generatedScenes[actKey] = {};
    }
    
    projectContext.generatedScenes[actKey][`plot_point_${plotPointIndexNum}`] = {
      actKey: actKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: plotPoint,
      sceneCount: sceneCount,
      scenes: scenesData.scenes,
      isKeyPlot: false, // 🔧 Fixed: simplified since we don't use complex key plot logic anymore
      generatedAt: new Date().toISOString()
    };
    
    // Update database with new scenes
    await databaseService.updateProject(userId, projectPath, projectContext);

    console.log(`Saved ${scenesData.scenes.length} scenes for plot point ${plotPointIndexNum + 1} to database`);

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
    console.error('❌ SCENE GENERATION ERROR:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ error: 'Failed to generate scenes for plot point', details: error.message });
  }
});

// Generate scenes for a specific structural element
app.post('/api/generate-scene/:projectPath/:structureKey', async (req, res) => {
  try {
    const { projectPath, structureKey } = req.params;
    const { sceneCount = null, model = "claude-sonnet-4-20250514" } = req.body;
    
    // Load project data from database instead of file system
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get project context from database
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    if (!structure || !storyInput) {
      return res.status(400).json({ error: 'Project structure or story input not found in database' });
    }
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    const structureElement = structure[structureKey];
    
    // Try to get intelligent scene count from multiple sources
    let finalSceneCount = sceneCount; // Use provided count if given
    
    // 1. Check if we have scene distribution from plot points in database
    try {
      if (projectContext.plotPoints && projectContext.plotPoints[structureKey]) {
        const actPlotPointsData = projectContext.plotPoints[structureKey];
        if (actPlotPointsData.totalScenesForAct) {
          finalSceneCount = actPlotPointsData.totalScenesForAct;
          console.log(`📈 Using scene count from plot points distribution: ${finalSceneCount} scenes`);
        }
      }
    } catch (plotError) {
      console.log('Error checking plot points for scene count:', plotError.message);
    }
    
    // 2. Check if story structure has predefined scene count
    if (!finalSceneCount) {
      const preDefinedSceneCount = structureElement.scene_count || structure[structureKey]?.scene_count;
      if (preDefinedSceneCount) {
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
      const context = new HierarchicalContext({
        db: dbClient,
        anthropic: anthropic
      });
      await context.loadFromProject(projectPath);
      
      // If context doesn't exist, rebuild it from project data
      if (!context.contexts.story) {
        console.log('Rebuilding context from project data...');
        context.buildStoryContext(storyInput, storyInput.influencePrompt, projectContext.lastUsedSystemMessage, projectContext);
        context.buildStructureContext(structure, projectContext.template);
      }
      
      // Build act context for this specific structural element
      const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
      context.buildActContext(structureKey, structureElement, actPosition);
      
      // Try to load plot points from database
      let plotPoints = [];
      try {
        const username = req.user.username; // Get from authenticated user
        const userResult = await databaseService.getUserByUsername(username);
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          // Get project context from database
          const projectResult = await databaseService.getProject(userId, projectPath);
          
          if (projectResult.rows.length > 0) {
            const projectContext = parseProjectContext(projectResult.rows[0].project_context);
            
            if (projectContext.plotPoints && projectContext.plotPoints[structureKey]) {
              const actPlotPointsData = projectContext.plotPoints[structureKey];
              if ((actPlotPointsData.plotPoints && Array.isArray(actPlotPointsData.plotPoints)) || Array.isArray(actPlotPointsData)) {
                plotPoints = actPlotPointsData.plotPoints || actPlotPointsData;
                console.log(`✅ Loaded ${plotPoints.length} plot points for ${structureKey} from database`);
              }
            }
          }
        }
        
        if (plotPoints.length === 0) {
          console.log(`No plot points found for this act (${structureKey}) in database, generating scenes without plot point guidance`);
          // Use placeholder plot points
          plotPoints = Array(finalSceneCount).fill(0).map((_, i) => `Scene ${i + 1} plot point for ${structureElement.name}`);
        }
      } catch (plotError) {
        console.log(`Error loading plot points from database for ${structureKey}: ${plotError.message}`);
        // Use placeholder plot points
        plotPoints = Array(finalSceneCount).fill(0).map((_, i) => `Scene ${i + 1} plot point for ${structureElement.name}`);
      }
      
      // Build plot points context
      await context.buildPlotPointsContext(plotPoints, finalSceneCount, projectPath, req.user.username);
      
      // Generate hierarchical prompt using context system
      console.log('About to generate hierarchical prompt...');
      const hierarchicalPrompt = await context.generateHierarchicalPrompt(5, `
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
      
      // Use hierarchical prompt directly for multiple scenes generation
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
      
      // Fallback to simple prompt - direct approach
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
6. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward

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

    console.log('About to save scenes to database...');
    
    // Update scenes in database
    if (!projectContext.generatedScenes) {
      projectContext.generatedScenes = {};
    }
    
    projectContext.generatedScenes[structureKey] = {
      scenes: scenesData.scenes,
      lastUpdated: new Date().toISOString()
    };
    
    // Save updated project context back to database
    await databaseService.updateProject(userId, projectPath, projectContext);
    
    console.log(`Scenes for ${structureKey} saved to database`);

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
app.post('/api/generate-individual-scene/:projectPath/:structureKey/:sceneIndex', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, structureKey, sceneIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    // Load project data from database instead of file system
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get project context from database
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    if (!structure || !storyInput) {
      return res.status(400).json({ error: 'Project structure or story input not found in database' });
    }
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    // Load existing scenes from database
    const existingScenes = projectContext.generatedScenes || {};
    
    const structureElement = structure[structureKey];
    const elementScenes = existingScenes[structureKey]?.scenes || [];
    const existingScene = elementScenes[sceneIndexNum];
    
    console.log(`Regenerating scene ${sceneIndexNum + 1} for ${structureKey} in project: ${projectPath}`);
    
    // Initialize and load hierarchical context for this project
    const context = new HierarchicalContext({
      db: dbClient,
      anthropic: anthropic
    });
    await context.loadFromProject(projectPath);
    
    // If context doesn't exist, rebuild it from project data
    if (!context.contexts.story) {
      console.log('Rebuilding context from project data...');
      context.buildStoryContext(storyInput, storyInput.influencePrompt, projectContext.lastUsedSystemMessage, projectContext);
      context.buildStructureContext(structure, projectContext.template);
    }
    
    // Build act context for this specific structural element
    const elementPosition = Object.keys(structure).indexOf(structureKey) + 1;
    context.buildActContext(structureKey, structureElement, elementPosition);
    
    // First, we need plot points for this element (if they don't exist, we'll need to generate them)
    // For now, let's create a placeholder plot points context
    const existingPlotPoints = ['Placeholder plot point for this scene']; // This should come from actual plot points generation
    await context.buildPlotPointsContext(existingPlotPoints, elementScenes.length, projectPath, req.user.username);
    
    // Build scene context with assigned plot point
    const plotPointIndex = sceneIndexNum; // Assuming 1:1 mapping for now
    context.buildSceneContext(sceneIndexNum, plotPointIndex, existingScene, elementScenes.length);
    
    // Generate hierarchical prompt using context system
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(5, `
SCENE GENERATION REQUIREMENTS:
1. This scene must serve the OVERALL STORY STRUCTURE and advance the narrative
2. It must fulfill the specific PURPOSE of its structural element
3. It must advance any CHARACTER DEVELOPMENT noted for this element
4. It must deliver the ASSIGNED PLOT POINT specified above
5. Make it cinematic and specific, not just a plot summary
6. Include: title, location, time_of_day, description (2-3 sentences), characters, emotional_beats

The scene you generate should feel like an organic part of the complete story structure, not an isolated fragment.`);
    
    // Use hierarchical prompt directly for individual scene generation
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
      system: "You are a professional screenwriter generating scenes within a hierarchical story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.",
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

    // Update scene in database
    if (!projectContext.generatedScenes) {
      projectContext.generatedScenes = {};
    }
    
    if (!projectContext.generatedScenes[structureKey]) {
      projectContext.generatedScenes[structureKey] = { scenes: [] };
    }

    // Update the specific scene
    projectContext.generatedScenes[structureKey].scenes[sceneIndexNum] = sceneData;
    projectContext.generatedScenes[structureKey].lastUpdated = new Date().toISOString();

    // Save updated project context back to database
    await databaseService.updateProject(userId, projectPath, projectContext);
    
    console.log(`Individual scene ${sceneIndexNum + 1} for ${structureKey} saved to database`);

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

// 🆕 MIGRATED: Generate plot points using GenerationService (Phase 2A)
app.post('/api/generate-plot-points/:projectPath', authenticateApiKey, async (req, res) => {
  try {
    // Check if new services are available
    if (!generationService || !creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { projectPath } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for plot points: ${projectPath}`);
    
    // Check credits using new CreditService
    const creditCheck = await creditService.checkCredits(username, 5);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Load project data from database using DatabaseService
    const projectContext = await databaseService.loadProject(username, projectPath);
    if (!projectContext) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generate plot points using new GenerationService
    const result = await generationService.generatePlotPoints(
      projectContext.generatedScenes, 
      projectContext.storyInput, 
      projectContext.generatedStructure, 
      projectPath, 
      username, 
      model
    );
    
    // Deduct credits using new CreditService
    await creditService.deductCredits(username, 5, 'generate-plot-points');
    await creditService.logUsage(username, 'generate-plot-points', 5, true);
    
    console.log('✅ Plot points generation completed using GenerationService');
    
    res.json({
      ...result,
      migratedEndpoint: true,
      generatedBy: 'GenerationService v2.0',
      codeReduction: '120+ lines -> 35 lines'
    });

  } catch (error) {
    console.error('Error in migrated plot points generation:', error);
    
    // Log error with CreditService if available
    if (creditService) {
      await creditService.logUsage(req.user.username, 'generate-plot-points', 5, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate plot points',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// Generate a single plot point for a specific scene
app.post('/api/generate-plot-point/:projectPath/:structureKey/:sceneIndex', async (req, res) => {
  try {
    const { projectPath, structureKey, sceneIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    // Load existing scenes from database
    const rawScenesData = projectContext.generatedScenes || {};
    
    // Extract the actual scenes data (handle nested structure)
    const scenesData = rawScenesData.scenes || rawScenesData;
    
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
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
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

    // Save scenes to database
    projectContext.generatedScenes = {
      scenes: scenesData,
      storyInput,
      generatedAt: new Date().toISOString(),
      method: 'simple_generation'
    };
    
    // Update database with new scenes
    await databaseService.updateProject(userId, projectPath, projectContext);
    
    console.log(`Simple scenes generated and saved to database for project: ${projectPath}`);
    
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
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
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

    // Save scenes to database
    if (scenesData && !scenesData.error) {
      projectContext.generatedScenes = {
        scenes: scenesData,
        storyInput,
        regeneratedAt: new Date().toISOString()
      };
      
      // Update database with regenerated scenes
      await databaseService.updateProject(userId, projectPath, projectContext);
      
      console.log(`Scenes regenerated and saved to database for project: ${projectPath}`);
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

// Export final script with professional formatting (v2.0 database format)
app.post('/api/export', async (req, res) => {
  try {
    const { projectData, format = 'text', projectPath } = req.body;
    
    console.log('🎬 Export request:', { format, projectPath: projectPath ? 'exists' : 'none' });
    
    // Validate required data for export
    if (!projectData.storyInput) {
      return res.status(400).json({ error: 'No story input data found' });
    }
    
    console.log('📊 Export data check:', {
      hasGeneratedScenes: !!projectData.generatedScenes,
      sceneKeys: Object.keys(projectData.generatedScenes || {}),
      hasGeneratedDialogues: !!projectData.generatedDialogues,
      dialogueKeys: Object.keys(projectData.generatedDialogues || {}),
      hasStoryInput: !!projectData.storyInput,
      title: projectData.storyInput.title
    });
    
    // Use projectData directly since everything is now in database v2.0 format
    // No file system access needed - all data is in the projectData object
    const fullProjectData = projectData;
    
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
    
    // Script formatting functions extracted to src/formatters/ScriptFormatters.js

    
    console.log('✅ Script generated successfully:', { 
      format, 
      title: fullProjectData.storyInput.title,
      scriptLength: script.length 
    });
    
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
setupErrorHandling(app);

// Profile and User Management API Endpoints
// User Management
app.get('/api/users', async (req, res) => {
  try {
    const result = await databaseService.listUsers();
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
    
    const result = await userService.createUser(username);
    
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

// ==========================================
// 📚 LIBRARY ROUTES - MOVED TO routes/library.js
// ==========================================
// The following routes have been extracted to routes/library.js:
// - GET /api/user-libraries/:username/:type (Get user library)
// - POST /api/user-libraries/:username/:type/:key (Create library entry)
// - PUT /api/user-libraries/:username/:type/:key (Update library entry)
// - DELETE /api/user-libraries/:username/:type/:key (Delete library entry)
// - POST /api/user-libraries/:username/populate-starter-pack (Populate starter pack)
// ==========================================

// Helper function to populate starter pack (for use in registration)
async function populateUserStarterPack(userId, username) {
  try {
    console.log(`Auto-populating starter pack for new user: ${username} (ID: ${userId})`);
    
    if (libraryService) {
      // Use LibraryService for starter pack population
      const starterPackData = starterPack.getStarterPackData();
      const result = await libraryService.populateStarterPack(username, starterPackData);
      
      const counts = starterPack.getStarterPackCounts();
      console.log(`✅ Auto-populated starter pack for ${username}:`);
      console.log(`   - Directors: ${counts.directors}`);
      console.log(`   - Screenwriters: ${counts.screenwriters}`);
      console.log(`   - Films: ${counts.films}`);
      console.log(`   - Tones: ${counts.tones}`);
      console.log(`   - Characters: ${counts.characters}`);
      
      return result.success;
    } else {
      throw new Error('LibraryService not available');
    }
  } catch (error) {
    console.error(`Failed to auto-populate starter pack for ${username}:`, error);
    return false;
  }
}

// User Projects Management
app.get('/api/user-projects/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user ID
    const userResult = await databaseService.getUserByUsername(username);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get projects
    const result = await databaseService.getUserProjects(userId);
    
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
    const userResult = await databaseService.getUserByUsername(username);
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

// Duplicate project endpoint
app.post('/api/users/:userId/projects/duplicate', async (req, res) => {
  try {
    const { userId } = req.params;
    const { project_name } = req.body;
    
    if (!project_name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Load original project from database
    const originalResult = await databaseService.getProject(userId, project_name);
    
    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Original project not found' });
    }
    
    const originalProject = originalResult.rows[0];
    
    // Generate new versioned project name
    const newProjectName = await generateVersionedProjectName(userId, project_name);
    
    // Parse and modify project context for the duplicate
    const originalContext = parseProjectContext(originalProject.project_context);
    const newProjectId = require('crypto').randomUUID();
    
    // Extract version number from new project name
    const versionMatch = newProjectName.match(/V(\d+)$/);
    const versionNumber = versionMatch ? versionMatch[1] : '02';
    
    // Create versioned title
    const originalTitle = originalContext.storyInput?.title || 'Untitled Project';
    const versionedTitle = `${originalTitle} V${versionNumber}`;
    
    // Create new project context with updated IDs, name, and versioned title
    const newProjectContext = {
      ...originalContext,
      projectId: newProjectId,
      projectPath: newProjectName,
      generatedAt: new Date().toISOString(),
      // Update the storyInput title to include version
      storyInput: {
        ...originalContext.storyInput,
        title: versionedTitle
      }
    };
    
    // Update thumbnail data for the duplicate with consistent versioned title
    const newThumbnailData = {
      ...originalProject.thumbnail_data,
      title: versionedTitle
    };
    
    // Insert duplicate project into database
    const duplicateResult = await dbClient.query(
      `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, newProjectName, JSON.stringify(newProjectContext), JSON.stringify(newThumbnailData)]
    );
    
    // Optionally duplicate filesystem project directory
    const originalDir = path.join(__dirname, 'generated', project_name);
    const newDir = path.join(__dirname, 'generated', newProjectName);
    
    try {
      await fs.access(originalDir);
      await fs.cp(originalDir, newDir, { recursive: true });
      console.log(`✅ Filesystem project duplicated: ${originalDir} -> ${newDir}`);
    } catch (error) {
      console.log('⚠️ Filesystem project not found or could not be duplicated:', error.message);
      // This is okay - we rely on database storage primarily
    }
    
    console.log(`✅ Project duplicated: "${originalProject.project_name}" -> "${newProjectName}"`);
    
    res.json({ 
      message: 'Project duplicated successfully',
      original_project: originalProject.project_name,
      new_project: newProjectName,
      new_project_title: newThumbnailData.title
    });
    
  } catch (error) {
    console.error('Failed to duplicate project:', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

// generateVersionedProjectName function extracted to src/utils/UtilityFunctions.js

// Server startup moved to bottom of file for proper Vercel export handling

// Generate plot points for a specific story act (Level 4 generation)
app.post('/api/generate-plot-points-for-act/:projectPath/:actKey', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { desiredSceneCount = null, model = "claude-sonnet-4-20250514", customTemplateData = null, creativeDirections = null } = req.body;
    

    
    // 🔧 CRITICAL FIX: desiredSceneCount is actually the desired PLOT POINT count from the dropdown
    const desiredPlotPointCount = desiredSceneCount || 4; // User's selected plot point count
    
    // Debug: Check if req.user exists

    
    // Load existing project data from database (unified v2.0 format)
    const plotUsername = req.user.username; // Get from authenticated user
    
    // Get user and project from database
    const plotUserResult = await databaseService.getUserByUsername(plotUsername);
    if (plotUserResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const plotUserId = plotUserResult.rows[0].id;
    
    // Load project context from database
    const plotProjectResult = await databaseService.getProject(plotUserId, projectPath);
    
    if (plotProjectResult.rows.length === 0) {
      throw new Error('Project not found in database');
    }
    
    const plotProjectContext = parseProjectContext(plotProjectResult.rows[0].project_context);
    const { generatedStructure: structure, storyInput } = plotProjectContext;
    
    // 🔧 Use customized template data if provided, otherwise fall back to database version
    const templateData = customTemplateData || plotProjectContext.templateData;
    
    if (customTemplateData) {
      console.log('🎭 Using customized template data for plot points generation');
    } else {
      console.log('📁 Using database template data for plot points generation');
    }
    

    
    if (!structure[actKey]) {
      return res.status(400).json({ error: 'Invalid act key' });
    }
    
    const storyAct = structure[actKey];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
    await context.loadFromProject(projectPath);
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, plotProjectContext.lastUsedPrompt, plotProjectContext.lastUsedSystemMessage, plotProjectContext);
      context.buildStructureContext(structure, templateData);
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
    await context.buildPlotPointsContext([], 0, projectPath, req.user.username);
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(4);
    
    // Use our new prompt builder system
    let prompt = promptBuilders.buildPlotPointsPrompt(hierarchicalPrompt, desiredPlotPointCount, finalSceneCount);
    
    // Add creative directions if provided
    if (creativeDirections?.plotPoints?.[actKey]) {
      const direction = creativeDirections.plotPoints[actKey];
      prompt += `\n\nUser Creative Direction for Plot Points: ${direction}\n`;
      prompt += `⚠️ IMPORTANT: Incorporate this creative direction into the plot points for this act.\n`;
    }

    console.log(`Generating ${desiredPlotPointCount} plot points for ${actKey} (expanding to ${finalSceneCount} scenes)`);
    
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
    await context.buildPlotPointsContext(plotPointsData.plotPoints, finalSceneCount, projectPath, req.user.username);
    await context.saveToProject(projectPath);

    // Save plot points to database (unified v2.0 format)
    const username = req.user.username; // Get from authenticated user
    
    // Get user and project from database
    const userResult = await databaseService.getUserByUsername(username);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const userId = userResult.rows[0].id;
    
    // Load existing project context
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      throw new Error('Project not found in database');
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Update plot points in unified format
    if (!projectContext.plotPoints) {
      projectContext.plotPoints = {};
    }
    
    projectContext.plotPoints[actKey] = {
      actKey: actKey,
      storyAct: storyAct,
      plotPoints: plotPointsData.plotPoints,
      sceneDistribution: sceneDistribution,
      totalScenesForAct: finalSceneCount,
      totalPlotPoints: plotPointsData.plotPoints.length,
      generatedAt: new Date().toISOString(),
      lastRegenerated: new Date().toISOString()
    };
    
    // Update current step if needed
    if (projectContext.currentStep < 4) {
      projectContext.currentStep = 4;
    }
    
    // Save back to database
    await databaseService.updateProject(userId, projectPath, projectContext);

    console.log(`✅ Plot points saved to database for ${actKey} in unified v2.0 format`);
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
      savedToDatabase: true,
      format: 'v2.0-unified',
      message: `Generated ${plotPointsData.plotPoints.length} plot points for ${storyAct.name} (${finalSceneCount} scenes total)`
    });

  } catch (error) {
    console.error('Error generating plot points for act:', error);
    res.status(500).json({ error: 'Failed to generate plot points for act', details: error.message });
  }
});

// Legacy endpoint removed - plot points now loaded via /api/load-project/:projectPath in unified format

// Regenerate a single plot point within an act
app.post('/api/regenerate-plot-point/:projectPath/:structureKey/:plotPointIndex', async (req, res) => {
  try {
    const { projectPath, structureKey, plotPointIndex } = req.params;
    const { model = "claude-sonnet-4-20250514" } = req.body;
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    if (!structure[structureKey]) {
      return res.status(400).json({ error: 'Invalid structure key' });
    }
    
    // Load existing plot points from database
    let plotPointsData;
    try {
      if (!projectContext.plotPoints || !projectContext.plotPoints[structureKey]) {
        return res.status(400).json({ error: 'Plot points not found. Please generate plot points for this act first.' });
      }
      plotPointsData = projectContext.plotPoints[structureKey];
    } catch (error) {
      return res.status(400).json({ error: 'Plot points data not found. Please generate plot points for this act first.' });
    }
    
    const plotPointIndexNum = parseInt(plotPointIndex);
    if (plotPointIndexNum < 0 || plotPointIndexNum >= plotPointsData.plotPoints.length) {
      return res.status(400).json({ error: 'Invalid plot point index' });
    }
    
    const storyAct = structure[structureKey];
    const existingPlotPoints = plotPointsData.plotPoints;
    const targetPlotPoint = existingPlotPoints[plotPointIndexNum];
    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
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
    await context.buildPlotPointsContext(existingPlotPoints, existingPlotPoints.length, projectPath, req.user.username);
    
    // Generate hierarchical prompt for individual plot point regeneration
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(4, `
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
    
    // Save updated plot points back to database
    projectContext.plotPoints[structureKey] = plotPointsData;
    await databaseService.updateProject(userId, projectPath, projectContext);
    
    // Update hierarchical context with new plot points
    await context.buildPlotPointsContext(plotPointsData.plotPoints, plotPointsData.plotPoints.length, projectPath, req.user.username);
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
app.post('/api/preview-individual-plot-point-prompt', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, structureKey, plotPointIndex, existingPlotPoints } = req.body;
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
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
    const context = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
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
    await context.buildPlotPointsContext(existingPlotPoints, existingPlotPoints.length, projectPath, req.user.username);
    
    // Generate hierarchical prompt for individual plot point regeneration
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(4, `
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
app.post('/api/generate-all-scenes-for-act/:projectPath/:actKey', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { model = "claude-sonnet-4-20250514", totalScenes = null, creativeDirections = null } = req.body;
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Load plot points data with scene distribution from database
    let plotPointsData;
    try {
      if (!projectContext.plotPoints || !projectContext.plotPoints[actKey]) {
        return res.status(400).json({ error: 'Plot points not found. Please generate plot points for this act first.' });
      }
      plotPointsData = projectContext.plotPoints[actKey];
    } catch (error) {
      return res.status(400).json({ error: 'Plot points data not found. Please generate plot points for this act first.' });
    }
    
    // Handle both old format (just array) and new format (object with metadata)
    let plotPoints;
    let totalScenesForAct = 12; // Default fallback
    
    if (Array.isArray(plotPointsData)) {
      // Old format: just array of plot point strings
      plotPoints = plotPointsData;
    } else if (plotPointsData.plotPoints) {
      // New format: object with metadata
      plotPoints = plotPointsData.plotPoints;
      // 🔧 DON'T use stored totalScenesForAct - use calculator widget value instead
      // totalScenesForAct = plotPointsData.totalScenesForAct || 12;
    } else {
      return res.status(400).json({ error: 'Invalid plot points data format.' });
    }

    // 🔧 DYNAMIC SCENE DISTRIBUTION: Use calculateSceneDistribution method with project context and user's totalScenes
    const context = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
    const sceneDistribution = context.calculateSceneDistribution(plotPoints, totalScenesForAct, actKey, totalScenes, projectContext);
    
    // 🔥 FIX: Update project context with the user's current totalScenes input to prevent drift
    if (totalScenes && projectContext.storyInput) {
      projectContext.storyInput.totalScenes = totalScenes;
      console.log(`📝 Updated project context totalScenes from ${projectContext.storyInput.totalScenes} to ${totalScenes}`);
    }
    
    console.log(`Generating all scenes for act: ${actKey}`);
    console.log(`Scene distribution:`, sceneDistribution.map((dist, i) => 
      `Plot Point ${i + 1}: ${dist.sceneCount} scenes ${dist.isKeyPlot ? '(key)' : ''}`
    ));
    
    const allGeneratedScenes = [];
    let totalScenesGenerated = 0;
    
    // Generate scenes for each plot point according to distribution
    for (let plotPointIndex = 0; plotPointIndex < sceneDistribution.length; plotPointIndex++) {
      const plotPointInfo = sceneDistribution[plotPointIndex];
      const sceneCount = plotPointInfo.sceneCount;
      const plotPoint = plotPointInfo.plotPoint;
      
      console.log(`\nGenerating ${sceneCount} scenes for Plot Point ${plotPointIndex + 1}: "${plotPoint}"`);
      
      try {
        // Generate scenes for this plot point directly
        const context = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
        const plotPointResult = await context.generateScenesForPlotPoint(projectPath, actKey, plotPointIndex, model, projectContext, sceneDistribution, req.user.username, creativeDirections);
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
    
    // Save comprehensive act scenes summary to database
    if (!projectContext.generatedScenes) {
      projectContext.generatedScenes = {};
    }
    
    projectContext.generatedScenes[actKey] = {
      actKey: actKey,
      totalScenesGenerated: totalScenesGenerated,
      targetScenes: totalScenesForAct,
      plotPointScenes: allGeneratedScenes,
      generatedAt: new Date().toISOString()
    };
    
    // Update currentStep to 5 when scenes are first generated
    if (projectContext.currentStep < 5) {
      projectContext.currentStep = 5;
      console.log(`📈 Updated currentStep to 5 (scenes generated)`);
    }
    
    // Update database with new scenes
    await databaseService.updateProject(userId, projectPath, projectContext);
    
    // Also update thumbnail_data.currentStep for project card consistency
    try {
      await dbClient.query(
        'UPDATE user_projects SET thumbnail_data = jsonb_set(thumbnail_data, \'{currentStep}\', $1::jsonb) WHERE user_id = $2 AND project_name = $3',
        [projectContext.currentStep, userId, projectPath]
      );
      console.log(`📈 Updated thumbnail_data.currentStep to ${projectContext.currentStep}`);
    } catch (thumbnailError) {
      console.log('Warning: Could not update thumbnail_data.currentStep:', thumbnailError.message);
    }
    
    console.log(`\n✅ Act ${actKey} complete: Generated ${totalScenesGenerated} scenes across ${allGeneratedScenes.length} plot points`);
    
    res.json({
      success: true,
      actKey: actKey,
      totalScenesGenerated: totalScenesGenerated,
      targetScenes: totalScenesForAct,
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
app.put('/api/edit-content/acts/:projectPath/:actKey', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Parse the new content (could be JSON or plain text)
    let updatedAct;
    try {
      updatedAct = JSON.parse(content);
    } catch (e) {
      // If not valid JSON, treat as plain text description
      updatedAct = {
        name: projectContext.generatedStructure[actKey]?.name || actKey,
        description: content
      };
    }
    
    // Update the specific act
    projectContext.generatedStructure[actKey] = {
      ...projectContext.generatedStructure[actKey],
      ...updatedAct,
      lastModified: new Date().toISOString()
    };
    
    // Save back to database
    await databaseService.updateProject(userId, projectPath, projectContext);
    
    console.log(`Act ${actKey} updated successfully`);
    res.json({ 
      success: true, 
      message: 'Act updated successfully',
      updatedAct: projectContext.generatedStructure[actKey]
    });
    
  } catch (error) {
    console.error('Error saving act content:', error);
    res.status(500).json({ error: error.message || 'Failed to save act content' });
  }
});

// Save edited plot points content
app.put('/api/edit-content/plot-points/:projectPath/:actKey', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
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
    
    // Initialize plotPoints structure if it doesn't exist
    if (!projectContext.plotPoints) {
      projectContext.plotPoints = {};
    }
    
    // Update the specific act's plot points
    projectContext.plotPoints[actKey] = {
      plotPoints: updatedPlotPoints,
      actKey: actKey,
      lastModified: new Date().toISOString()
    };
    
    // Save back to database
    await databaseService.updateProject(userId, projectPath, projectContext);
    
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
app.put('/api/edit-content/scenes/:projectPath/:actKey/:sceneIndex', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey, sceneIndex } = req.params;
    const { content } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Initialize scenes structure if it doesn't exist
    if (!projectContext.scenes) {
      projectContext.scenes = {};
    }
    if (!projectContext.scenes[actKey]) {
      projectContext.scenes[actKey] = {};
    }
    
    // Get existing scene data
    const existingScene = projectContext.scenes[actKey][sceneIndexNum] || {};
    
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
    
    // Update the specific scene
    projectContext.scenes[actKey][sceneIndexNum] = sceneData;
    
    // Save back to database
    await databaseService.updateProject(userId, projectPath, projectContext);
    
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
app.put('/api/edit-content/dialogue/:projectPath/:actKey/:sceneIndex', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey, sceneIndex } = req.params;
    const { content } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Initialize dialogue structure if it doesn't exist
    if (!projectContext.dialogue) {
      projectContext.dialogue = {};
    }
    if (!projectContext.dialogue[actKey]) {
      projectContext.dialogue[actKey] = {};
    }
    
    const dialogueData = {
      dialogue: content,
      actKey: actKey,
      sceneIndex: sceneIndexNum,
      lastModified: new Date().toISOString()
    };
    
    // Update the specific dialogue
    projectContext.dialogue[actKey][sceneIndexNum] = dialogueData;
    
    // Save back to database
    await databaseService.updateProject(userId, projectPath, projectContext);
    
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

// ==================== PAYMENT SYSTEM ENDPOINTS ====================

// ==================== PAYMENT ENDPOINTS MOVED TO routes/payments.js ====================
// All payment-related endpoints have been extracted to routes/payments.js
// This includes Stripe config, checkout sessions, webhook tests, payment history, 
// debug credit endpoints, and the buy credits page
// This reduces server.js by 200+ lines and improves maintainability

// ==========================================
// 🔧 ADMIN ROUTES - MOVED TO routes/admin.js
// ==========================================
// The following 20 admin endpoints have been extracted to routes/admin.js:
// - POST /api/admin/grant-credits (Grant credits to user)
// - GET /api/admin/users (Get all users with stats) 
// - DELETE /api/admin/user/:userId (Delete user)
// - GET /api/admin/usage-stats/:username (Get user usage statistics)
// - POST /api/admin/create-user (Create new user)
// - DELETE /api/admin/delete-user/:username (Delete user account)
// - GET /api/admin/system-status (Get system status)
// - GET /api/admin/metrics (Get system metrics)
// - GET /api/admin/chart-data (Get chart data for dashboard)
// - GET /api/admin/analytics (Get comprehensive analytics)
// - POST /api/admin/test-database (Test database connection)
// - POST /api/admin/test-anthropic (Test Anthropic API)
// - POST /api/admin/test-rate-limiting (Test rate limiting)
// - POST /api/admin/health-check (Comprehensive health check)
// - GET /api/admin/rate-limit-status (Get rate limiting status)
// - POST /api/admin/update-rate-limits (Update rate limiting configuration)
// - GET /api/admin-status (Check admin user status - no auth required)
// - POST /api/create-emergency-admin (Create emergency admin - no auth required)
// - POST /api/promote-to-admin (Promote existing user to admin - no auth required)
// - DELETE /api/emergency-delete-cckrad (Emergency delete specific user - no auth required)
// ==========================================

// Get model pricing information (PUBLIC - no auth required)
app.get('/api/model-pricing', async (req, res) => {
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

// getModelDescription function extracted to src/utils/UtilityFunctions.js



// ==================== CREDIT & STATS ENDPOINTS MOVED TO routes/payments.js ====================
// Free credits, cost estimation, and user stats endpoints have been extracted
// This reduces server.js by another 80+ lines

// =====================================
// AUTHENTICATION ENDPOINTS - MIGRATED TO routes/auth.js
// =====================================
// All authentication routes have been extracted to routes/auth.js
// This reduces server.js by 250+ lines and improves maintainability

// Preview hierarchical plot point scene generation prompt
app.post('/api/preview-plot-point-scene-prompt/:projectPath/:actKey/:plotPointIndex', authenticateApiKey, async (req, res) => {
  try {
    const { projectPath, actKey, plotPointIndex } = req.params;
    const { model = "claude-sonnet-4-20250514", totalScenes = null } = req.body;
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await databaseService.getUserByUsername(username);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await databaseService.getProject(userId, projectPath);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Load plot points data with scene distribution from database
    let plotPointsData;
    try {
      if (!projectContext.plotPoints || !projectContext.plotPoints[actKey]) {
        return res.status(400).json({ error: 'Plot points not found. Please generate plot points for this act first.' });
      }
      plotPointsData = projectContext.plotPoints[actKey];
    } catch (error) {
      return res.status(400).json({ error: 'Plot points data not found. Please generate plot points for this act first.' });
    }
    
        const plotPointIndexNum = parseInt(plotPointIndex);
    const plotPointsArray = plotPointsData.plotPoints || plotPointsData;
    if (plotPointIndexNum < 0 || plotPointIndexNum >= plotPointsArray.length) {
      return res.status(400).json({ error: 'Invalid plot point index' });
    }

    const plotPoint = plotPointsArray[plotPointIndexNum];
    
    // 🔧 DYNAMIC SCENE DISTRIBUTION: Use calculateSceneDistribution method with project context and user's totalScenes
    // Fix: Use all plot points in the act, not just the single plot point
    const tempContext = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
    const sceneDistribution = tempContext.calculateSceneDistribution(plotPointsArray, null, actKey, totalScenes, projectContext);
    const sceneCount = sceneDistribution[plotPointIndexNum].sceneCount;
    

    
    // Initialize and load hierarchical context
    const context = new HierarchicalContext({ db: dbClient, anthropic: anthropic });
    await context.loadFromProject(projectPath);
    
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    // Rebuild context if needed
    if (!context.contexts.story) {
      context.buildStoryContext(storyInput, storyInput.influencePrompt, projectContext.lastUsedSystemMessage, projectContext);
      context.buildStructureContext(structure, projectContext.templateData);
    }
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(actKey) + 1;
    context.buildActContext(actKey, structure[actKey], actPosition);
    
    // Build plot points context with dynamic total scenes (use provided totalScenes or fallback)
    const currentTotalScenes = totalScenes || projectContext?.storyInput?.totalScenes || 70;
    await context.buildPlotPointsContext(plotPointsArray, currentTotalScenes, projectPath, req.user.username);
    
    // Build scene context for this specific plot point
    context.buildSceneContext(0, plotPointIndexNum, null, sceneCount);
    
    // Generate hierarchical prompt for multiple scenes from one plot point
    const hierarchicalPrompt = await context.generateHierarchicalPrompt(5, `
MULTIPLE SCENES GENERATION FROM SINGLE PLOT POINT:
1. Create exactly ${sceneCount} scenes that collectively implement this plot point: "${plotPoint}"
2. Break the plot point into a ${sceneCount}-scene sequence that shows progression
3. Each scene should advance this plot point's dramatic purpose step-by-step
4. Vary scene types: some dialogue-heavy, some action, some introspective
5. Create a natural flow between scenes in this sequence
6. Each scene needs: title, location, time_of_day, description (3-6 sentences), characters, emotional_beats
7. Scenes should feel like organic parts of a sequence, not isolated fragments
8. Write in CINEMATIC LANGUAGE that translates story beats into visual terms
9. ALWAYS surprise the audience with unpredictable actions and novel ways of moving scenes forward - avoid static or predictable transitions that feel formulaic

CINEMATIC WRITING FOUNDATION:
• Lead with CHARACTER ACTIONS and decisions that drive the story forward
• Show physical behaviors, movements, and reactions in visual detail
• Focus on cause-and-effect storytelling through character choices
• Use concrete, observable details that a camera could capture
• Let the artistic influences naturally flavor this strong foundation

This plot point is ${true ? 'a plot point' : 'a plot point'} in the story structure.`);
    
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

    const systemMessage = "You are a professional screenwriter generating scene sequences within a hierarchical story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.";

    res.json({
      prompt: prompt,
      systemMessage: systemMessage,
      promptType: 'hierarchical_plot_point_scenes',
      plotPoint: plotPoint,
      sceneCount: sceneCount,
      plotPointIndex: plotPointIndexNum,
      isKeyPlot: false, // Simple distribution - all plot points treated equally
      hierarchicalPrompt: hierarchicalPrompt,
      usedHierarchicalContext: true,
      previewNote: `This shows how ${sceneCount} scenes will be generated to implement Plot Point ${plotPointIndexNum + 1}: "${plotPoint}". Using dynamic calculation: ${sceneCount} scenes per plot point (from ${currentTotalScenes} total scenes).`
    });

  } catch (error) {
    console.error('Error generating hierarchical plot point scene prompt preview:', error);
    res.status(500).json({ error: 'Failed to generate prompt preview', details: error.message });
  }
});

// Diagnostic endpoint for structure generation issues
app.post('/api/debug/structure-generation', authenticateApiKey, async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {}
  };

  try {
    // Check 1: Authentication
    diagnostics.checks.authentication = {
      status: 'ok',
      user: req.user ? req.user.username : 'missing',
      userId: req.user ? req.user.id : null
    };

    // Check 2: Environment Variables
    diagnostics.checks.environment = {
      status: process.env.ANTHROPIC_API_KEY ? 'ok' : 'missing',
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    };

    // Check 3: Database Connection
    try {
      const dbTest = await dbClient.query('SELECT NOW() as current_time');
      diagnostics.checks.database = {
        status: 'ok',
        connected: true,
        currentTime: dbTest.rows[0].current_time
      };
    } catch (dbError) {
      diagnostics.checks.database = {
        status: 'error',
        connected: false,
        error: dbError.message
      };
    }

    // Check 4: User Lookup
    if (req.user) {
      try {
        const userResult = await userService.getUserWithCredits(req.user.username);
        diagnostics.checks.userLookup = {
          status: userResult.rows.length > 0 ? 'ok' : 'user_not_found',
          found: userResult.rows.length > 0,
          userData: userResult.rows[0] || null
        };
      } catch (userError) {
        diagnostics.checks.userLookup = {
          status: 'error',
          error: userError.message
        };
      }
    }

    // Check 5: User Projects Table
    try {
      const tableCheck = await dbClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_projects'
        ORDER BY ordinal_position
      `);
      diagnostics.checks.userProjectsTable = {
        status: tableCheck.rows.length > 0 ? 'ok' : 'table_missing',
        exists: tableCheck.rows.length > 0,
        columns: tableCheck.rows.map(row => `${row.column_name} (${row.data_type})`)
      };
    } catch (tableError) {
      diagnostics.checks.userProjectsTable = {
        status: 'error',
        error: tableError.message
      };
    }

    // Check 6: Prompt Builders
    try {
      const testStoryInput = { title: 'Test', characters: [] };
      const testTemplateData = { name: 'Test Template', structure: {} };
      const testPrompt = promptBuilders.buildStructurePrompt(testStoryInput, testTemplateData);
      diagnostics.checks.promptBuilders = {
        status: 'ok',
        working: true,
        promptLength: testPrompt.length
      };
    } catch (promptError) {
      diagnostics.checks.promptBuilders = {
        status: 'error',
        working: false,
        error: promptError.message
      };
    }

    // Check 7: TrackedAnthropic API
    try {
      const trackedApiTest = trackedAnthropic.getAllModelPricing();
      diagnostics.checks.anthropicApi = {
        status: 'ok',
        initialized: true,
        modelsAvailable: Object.keys(trackedApiTest).length
      };
    } catch (apiError) {
      diagnostics.checks.anthropicApi = {
        status: 'error',
        initialized: false,
        error: apiError.message
      };
    }

    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: 'Diagnostic failed',
      details: error.message,
      partialDiagnostics: diagnostics
    });
  }
});

// v2 endpoints have been migrated to routes/auth.js

// Debug endpoint to test database connection
app.get('/api/debug/db-test', async (req, res) => {
  try {
    const result = await dbClient.query('SELECT NOW() as current_time, version() as postgres_version');
    res.json({
      success: true,
      message: 'Database connection successful',
      data: {
        current_time: result.rows[0].current_time,
        postgres_version: result.rows[0].postgres_version.substring(0, 50) + '...',
        env_check: {
          has_database_url: !!process.env.DATABASE_URL,
          database_url_starts_with: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'MISSING',
          is_vercel: !!process.env.VERCEL
        }
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: {
        message: error.message,
        code: error.code,
        detail: error.detail
      }
    });
  }
});

// v2 registration endpoint migrated to routes/auth.js

// Progress tracking repair endpoint
app.post('/api/repair-progress-tracking', async (req, res) => {
  try {
    const { action, username, projectName, correctStep } = req.body;
    
    if (action === 'analyze') {
      // Analyze all projects for progress inconsistencies
      const projectsResult = await dbClient.query(`
        SELECT u.username, p.project_name, p.thumbnail_data, p.project_context
        FROM users u 
        JOIN user_projects p ON u.id = p.user_id 
        ORDER BY u.username, p.project_name
      `);
      
      const issues = [];
      
      for (const project of projectsResult.rows) {
        try {
          const currentStep = project.thumbnail_data?.currentStep || 1;
          const projectContext = parseProjectContext(project.project_context);
          
          // Calculate what the step should be based on actual content
          let actualStep = 1;
          
          if (projectContext.storyInput?.title && projectContext.storyInput?.logline) {
            actualStep = Math.max(actualStep, 1);
          }
          
          if (projectContext.selectedTemplate && projectContext.templateData) {
            actualStep = Math.max(actualStep, 2);
          }
          
          if (projectContext.generatedStructure && Object.keys(projectContext.generatedStructure).length > 0) {
            actualStep = Math.max(actualStep, 3);
          }
          
          if (projectContext.plotPoints && Object.keys(projectContext.plotPoints).length > 0) {
            actualStep = Math.max(actualStep, 4);
          }
          
          if (projectContext.generatedScenes && Object.keys(projectContext.generatedScenes).length > 0) {
            actualStep = Math.max(actualStep, 5);
          }
          
          if (projectContext.generatedDialogues && Object.keys(projectContext.generatedDialogues).length > 0) {
            actualStep = Math.max(actualStep, 6);
          }
          
          // Check for inconsistencies
          if (currentStep !== actualStep) {
            issues.push({
              username: project.username,
              projectName: project.project_name,
              currentStep,
              actualStep,
              status: 'inconsistent'
            });
          }
        } catch (error) {
          console.error(`Error analyzing project ${project.project_name}:`, error);
        }
      }
      
      res.json({
        status: 'analysis_complete',
        totalProjects: projectsResult.rows.length,
        issuesFound: issues.length,
        issues
      });
      
    } else if (action === 'fix') {
      // Fix a specific project
      if (!username || !projectName || !correctStep) {
        return res.status(400).json({ error: 'username, projectName, and correctStep are required' });
      }
      
      const userResult = await databaseService.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userId = userResult.rows[0].id;
      
      // Update the project's currentStep
      const updateResult = await dbClient.query(`
        UPDATE user_projects 
        SET thumbnail_data = jsonb_set(
          COALESCE(thumbnail_data, '{}'), 
          '{currentStep}', 
          $1::jsonb
        ),
        project_context = jsonb_set(
          COALESCE(project_context, '{}'),
          '{currentStep}',
          $1::jsonb
        )
        WHERE user_id = $2 AND project_name = $3
        RETURNING project_name, thumbnail_data
      `, [correctStep, userId, projectName]);
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log(`✅ Fixed progress tracking for ${username}/${projectName}: Step ${correctStep}`);
      
      res.json({
        status: 'fixed',
        username,
        projectName,
        updatedStep: correctStep,
        result: updateResult.rows[0]
      });
      
    } else {
      res.status(400).json({ error: 'Invalid action. Use "analyze" or "fix"' });
    }
    
  } catch (error) {
    console.error('Progress tracking repair error:', error);
    res.status(500).json({
      error: 'Repair failed',
      details: error.message
    });
  }
});

// Debug endpoint to test database connection
app.get('/api/debug/db-test', async (req, res) => {
  try {
    // Test basic connection
    const testQuery = await dbClient.query('SELECT NOW() as current_time');
    
    // Test users table structure
    const tableInfo = await dbClient.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    res.json({
      status: 'ok',
      database_time: testQuery.rows[0].current_time,
      users_table_columns: tableInfo.rows,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
});

// ========================================================
// 🧪 NEW SERVICE INTEGRATION - PROOF OF CONCEPT
// ========================================================

// Initialize new services (proof of concept)
let generationService = null;
let creditService = null;
let databaseService = null;
let authService = null;
let projectService = null;
let libraryService = null;
let analyticsService = null;
let userService = null;

async function initializeServices() {
  try {
    const GenerationService = require('./src/services/GenerationService');
    const CreditService = require('./src/services/CreditService');
    const DatabaseService = require('./src/services/DatabaseService');
    const AuthService = require('./src/services/AuthService');
    const ProjectService = require('./src/services/ProjectService');
    const LibraryService = require('./src/services/LibraryService');
    const AnalyticsService = require('./src/services/AnalyticsService');
    const UserService = require('./src/services/UserService');
    
    // Load prompt builders from existing system
    const promptBuilders = require('./prompt-builders');
    
    // Initialize services
    databaseService = new DatabaseService();
    await databaseService.connect();
    
    // Initialize TrackedAnthropicAPI with UserService dependency injection
    userService = new UserService(dbClient);
    trackedAnthropic = new TrackedAnthropicAPI(anthropic, dbClient, userService);
    
    generationService = new GenerationService(trackedAnthropic, dbClient, promptBuilders);
    creditService = new CreditService(dbClient);
    authService = new AuthService(databaseService);
    projectService = new ProjectService(databaseService);
    libraryService = new LibraryService(databaseService);
    analyticsService = new AnalyticsService(dbClient);
    
    // Create admin user if it doesn't exist (after UserService is initialized)
    const adminUser = await userService.getUserByUsername('admin');
    
    if (adminUser.rows.length === 0) {
      const result = await userService.createAdminUser('admin', 999999);
      const adminApiKey = result.rows[0].api_key;
      
      console.log('✅ Admin user created with API key:', adminApiKey);
      console.log('   Save this API key securely - it won\'t be shown again!');
    }
    
    console.log('✅ New services initialized successfully');
  } catch (error) {
    console.error('⚠️  Failed to initialize new services:', error.message);
    console.log('📝 Fallback: Using existing endpoints');
  }
}

// 🧪 NEW DIALOGUE GENERATION ENDPOINT (Using GenerationService)
app.post('/api/v2/generate-dialogue', authenticateApiKey, async (req, res) => {
  try {
    if (!generationService) {
      return res.status(503).json({ error: 'New services not available. Use /api/generate-dialogue instead.' });
    }

    const { scene, storyInput, context, projectPath, model = "claude-sonnet-4-20250514", creativeDirections = null } = req.body;
    const username = req.user.username;
    
    // Check credits using new service
    const creditCheck = await creditService.checkCredits(username, 3);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    console.log('🧪 Using NEW GenerationService for dialogue generation');
    
    // Generate dialogue using new service
    const result = await generationService.generateDialogue(
      scene, storyInput, context, projectPath, username, model, creativeDirections
    );
    
    // Deduct credits using new service
    await creditService.deductCredits(username, 3, 'generate-dialogue');
    await creditService.logUsage(username, 'generate-dialogue', 3, true);
    
    res.json({
      ...result,
      generatedBy: 'GenerationService v2.0',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in v2 dialogue generation:', error);
    
    if (creditService) {
      await creditService.logUsage(req.user.username, 'generate-dialogue', 3, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate dialogue',
      details: error.message,
      fallback: 'Try /api/generate-dialogue for the original endpoint'
    });
  }
});

// 🧪 SERVICE STATUS ENDPOINT
app.get('/api/v2/service-status', (req, res) => {
  res.json({
    generationService: generationService ? 'available' : 'not available',
    creditService: creditService ? 'available' : 'not available',
    databaseService: databaseService ? 'available' : 'not available',
    authService: authService ? 'available' : 'not available',
    projectService: projectService ? 'available' : 'not available',
    libraryService: libraryService ? 'available' : 'not available',
    timestamp: new Date().toISOString(),
    refactoringPhase: 'Phase 3A - Library Management Migration'
  });
});

// Start server for local development
const startServer = async () => {
  await ensureDirectories();
  await connectToDatabase();
  await initializeServices(); // Initialize new services
  
  // Set up dependency injection for route modules (after services are initialized)
  app.set('dbClient', dbClient);
  app.set('authService', authService);
  app.set('populateUserStarterPack', populateUserStarterPack);
  app.set('generationService', generationService);
  app.set('creditService', creditService);
  app.set('aiFeedbackSystem', aiFeedbackSystem);
  app.set('trackedAnthropic', trackedAnthropic);
  app.set('promptBuilders', promptBuilders);
  app.set('HierarchicalContext', HierarchicalContext);
  app.set('anthropic', anthropic);
  app.set('parseProjectContext', parseProjectContext);
  app.set('projectService', projectService);
  app.set('libraryService', libraryService);
  app.set('analyticsService', analyticsService);
  app.set('userService', userService);
  app.set('starterPack', starterPack);
  app.set('authenticateApiKey', authenticateApiKey);

  // Mount route modules (after dependency injection is set up)
  app.use('/api/auth', authRoutes.router);
  app.use('/api/v2/auth', authRoutes.router); // V2 auth endpoints
  app.use('/api', generationRoutes.router);
  app.use('/api', projectRoutes.router);
  app.use('/api', paymentsRoutes.router);
  app.use('/api', libraryRoutes.router);
  app.use('/api', adminRoutes.router);
  
  app.listen(PORT, () => {
    console.log(`🚀 Film Script Generator server running on port ${PORT}`);
    console.log(`🌐 Access: http://localhost:${PORT}`);
    console.log('📊 Usage tracking and credit system enabled');
    console.log('🔐 API key authentication required for all generation endpoints');
    console.log('🧪 New services available at /api/v2/* endpoints');
  });
};

// For Vercel serverless deployment
if (process.env.VERCEL) {
  // Initialize database for serverless with timeout protection
  console.log('🔧 Serverless mode - initializing database with pooling');
  
  initializeDatabase().then(async () => {
    console.log('✅ Serverless database initialized successfully');
    
    // Initialize services for serverless
    await initializeServices();
    
    // Set up dependency injection for route modules (serverless)
    app.set('dbClient', dbClient);
    app.set('authService', authService);
    app.set('populateUserStarterPack', populateUserStarterPack);
    app.set('generationService', generationService);
    app.set('creditService', creditService);
    app.set('aiFeedbackSystem', aiFeedbackSystem);
    app.set('trackedAnthropic', trackedAnthropic);
    app.set('promptBuilders', promptBuilders);
    app.set('HierarchicalContext', HierarchicalContext);
    app.set('anthropic', anthropic);
    app.set('parseProjectContext', parseProjectContext);
    app.set('projectService', projectService);
    app.set('libraryService', libraryService);
    app.set('analyticsService', analyticsService);
    app.set('userService', userService);
    app.set('starterPack', starterPack);
    app.set('authenticateApiKey', authenticateApiKey);

    // Mount route modules (serverless)
    app.use('/api/auth', authRoutes.router);
    app.use('/api/v2/auth', authRoutes.router); // V2 auth endpoints
    app.use('/api', generationRoutes.router);
    app.use('/api', projectRoutes.router);
    app.use('/api', paymentsRoutes.router);
    app.use('/api', libraryRoutes.router);
    app.use('/api', adminRoutes.router);
    
    console.log('✅ Serverless route modules mounted successfully');
  }).catch((error) => {
    console.error('⚠️  Serverless database initialization failed:', error.message);
  });
  
  // Export the Express app for Vercel
  module.exports = app;
} else {
  // Start traditional server for local development
  startServer().catch(console.error);
}


