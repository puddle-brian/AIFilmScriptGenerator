const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize router with dependency injection middleware
router.use((req, res, next) => {
  // These will be injected by the main server
  req.dbClient = req.app.get('dbClient');
  req.generationService = req.app.get('generationService');
  req.creditService = req.app.get('creditService');
  req.authService = req.app.get('authService');
  req.aiFeedbackSystem = req.app.get('aiFeedbackSystem');
  req.trackedAnthropic = req.app.get('trackedAnthropic');
  req.promptBuilders = req.app.get('promptBuilders');
  req.HierarchicalContext = req.app.get('HierarchicalContext');
  req.populateUserStarterPack = req.app.get('populateUserStarterPack');
  req.anthropic = req.app.get('anthropic');
  req.parseProjectContext = req.app.get('parseProjectContext');
  next();
});

// Helper function for response formats
function getSuggestionResponseFormat(suggestionType) {
  switch (suggestionType) {
    case 'director':
      return `This suggestion will be inserted into prompts as: "With direction reminiscent of [YOUR SUGGESTION], "

Provide ONLY a concise directorial influence phrase that fits this format. 

Examples of good responses:
- "Christopher Nolan's layered storytelling and practical effects"
- "Denis Villeneuve's atmospheric visual poetry"
- "The Wachowskis' kinetic action choreography"

Respond with just the influence phrase, no quotes, no extra text.`;
    
    case 'screenwriter':
      return `This suggestion will be inserted into prompts as: "with prose style that invokes [YOUR SUGGESTION], "

Provide ONLY a concise prose style influence phrase that fits this format.

Examples of good responses:  
- "Tony Gilroy's procedural descriptions"
- "Aaron Sorkin's rapid-fire dialogue"
- "Charlie Kaufman's surreal introspection"

Respond with just the influence phrase, no quotes, no extra text.`;
    
    case 'film':
      return `This suggestion will be inserted into prompts as: "channeling the essence of [YOUR SUGGESTION], "

Provide ONLY a concise film essence phrase that fits this format.

Examples of good responses:
- "Blade Runner's neo-noir atmosphere"  
- "The Godfather's family dynamics"
- "Heat's procedural tension"

Respond with just the influence phrase, no quotes, no extra text.`;
    
    case 'tone':
      return `This suggestion will be inserted into prompts as: "with tone and atmosphere inspired by [YOUR SUGGESTION], "

Provide ONLY a concise tone description that fits this format.

Examples of good responses:
- "dark comedy with underlying melancholy"
- "tense psychological thriller atmosphere"
- "elegant period drama sophistication"

Respond with just the influence phrase, no quotes, no extra text.`;
    
    case 'character':
      return `Provide a compelling character suggestion in this exact JSON format:
{
  "name": "Character Name",
  "description": "Brief, evocative description of the character and their role in the story"
}

Make the character distinctive and relevant to the story context.`;
    
    case 'storyconcept':
      return `Provide a fresh, original story concept in this exact format:

Title: [Compelling Title]
Logline: [One-sentence story summary]

Avoid overused tropes like memory manipulation, time travel, or dystopian themes. Focus on fresh human stories across different genres and real-world conflicts.`;
    
    default:
      return 'Provide a helpful, creative suggestion to enhance the given story.';
  }
}

// ==================== TEMPLATE ROUTES ====================

// Get available plot structure templates
router.get('/templates', async (req, res) => {
  try {
    const templateDir = path.join(__dirname, '..', 'templates');
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
router.get('/template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.json`);
    
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    res.json(templateData);
  } catch (error) {
    console.error('Error loading template:', error);
    res.status(404).json({ error: 'Template not found' });
  }
});

// ==================== ANALYSIS ROUTES ====================

// AI Feedback System - Clean endpoint using modular system
router.post('/analyze-story-concept', async (req, res) => {
  try {
    const { storyInput, projectPath } = req.body;
    
    if (!storyInput || !storyInput.title) {
      return res.status(400).json({ error: 'Story concept with title is required' });
    }

    // AI feedback works independently of templates - it only analyzes story concept
    console.log('🎭 AI feedback analysis - no template data needed');

    // Use the modular AI feedback system (templateData not needed for story concept analysis)
    const result = await req.aiFeedbackSystem.analyzeStoryConcept(
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
router.post('/apply-suggestions', async (req, res) => {
  try {
    const { storyInput, analysisResult } = req.body;

    if (!storyInput || !storyInput.title) {
      return res.status(400).json({ error: 'Story concept with title is required' });
    }

    if (!analysisResult || !analysisResult.suggestions) {
      return res.status(400).json({ error: 'Analysis result with suggestions is required' });
    }

    // Use the AI feedback system to apply suggestions
    const result = await req.aiFeedbackSystem.applyStorySuggestions(storyInput, analysisResult);
    
    res.json(result);

  } catch (error) {
    console.error('Error applying story suggestions:', error);
    res.status(500).json({ error: 'Failed to apply suggestions: ' + error.message });
  }
});

// Preview the prompt that would be used for structure generation
router.post('/preview-prompt', async (req, res) => {
  try {
    const { storyInput, template, customTemplateData } = req.body;
    
    // Use customized template data if provided, otherwise load from file
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
      const templatePath = path.join(__dirname, '..', 'templates', `${template}.json`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      templateData = JSON.parse(templateContent);
      debugInfo.source = 'original_file';
      debugInfo.structureKeys = templateData.structure ? Object.keys(templateData.structure) : [];
    }
    
    // Use unified prompt builder that includes userDirections support
    const prompt = req.promptBuilders.buildStructurePrompt(storyInput, templateData);
    
    res.json({
      prompt: prompt,
      templateData: templateData,
      storyInput: storyInput,
      debugInfo: debugInfo
    });

  } catch (error) {
    console.error('Error previewing prompt:', error);
    res.status(500).json({ error: 'Failed to preview prompt: ' + error.message });
  }
});

// 🧞‍♂️ Genie Suggestions API Endpoint
router.post('/genie-suggestion', async (req, res) => {
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
    const completion = await req.trackedAnthropic.messages({
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

// ==================== BASIC GENERATION ROUTES ====================

// 🆕 MIGRATED: Generate structure using GenerationService
router.post('/generate-structure', async (req, res) => {
  try {
    // Check if new services are available
    if (!req.generationService || !req.creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { storyInput, template, customTemplateData, model = "claude-sonnet-4-20250514", existingProjectPath } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for structure: ${storyInput.title}`);
    
    // Check credits using new CreditService
    const creditCheck = await req.creditService.checkCredits(username, 10);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Generate structure using new GenerationService
    const result = await req.generationService.generateStructure(
      storyInput, customTemplateData, existingProjectPath, model, username
    );
    
    // Deduct credits using new CreditService
    await req.creditService.deductCredits(username, 10, 'generate-structure');
    await req.creditService.logUsage(username, 'generate-structure', 10, true);
    
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
    if (req.creditService) {
      await req.creditService.logUsage(req.user.username, 'generate-structure', 10, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate structure',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// Generate high-level plot structure with custom prompt
router.post('/generate-structure-custom', async (req, res) => {
  try {
    console.log('Received custom structure generation request:', req.body);
    const { storyInput, template, customPrompt, model = "claude-sonnet-4-20250514", existingProjectPath } = req.body;
    
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Load the selected template for reference
    const templatePath = path.join(__dirname, '..', 'templates', `${template}.json`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    console.log('Sending custom request to Claude API...');
    const completion = await req.anthropic.messages.create({
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

    // Use existing project path if regenerating, otherwise create new one
    let customProjectId, projectFolderName;
    
    if (existingProjectPath) {
      // Regenerating: use existing project path and extract project ID from database
      projectFolderName = existingProjectPath;
      console.log('🔄 Regenerating custom structure for existing project:', projectFolderName);
      
      // Try to get existing project ID from database
      try {
        const username = req.user.username;
        const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          const projectResult = await req.dbClient.query(
            'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
            [userId, projectFolderName]
          );
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
    
    const projectDir = path.join(__dirname, '..', 'generated', projectFolderName);
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

    // Also save to database for profile page
    try {
      const username = req.user.username;
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
      
      // Ensure user exists and get user ID
      await req.populateUserStarterPack(null, username);
      const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
      const userId = userResult.rows[0].id;
      
      // Save project to database (update if exists)
      await req.dbClient.query(`
        INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data, last_step, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, project_name)
        DO UPDATE SET 
          project_context = EXCLUDED.project_context,
          thumbnail_data = EXCLUDED.thumbnail_data,
          last_step = EXCLUDED.last_step,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, projectFolderName, JSON.stringify(projectContext), JSON.stringify(thumbnailData), 3]);
      
      console.log('✅ Custom project saved to database');
    } catch (dbError) {
      console.error('Error saving custom project to database:', dbError);
      // Continue with response even if database save fails
    }

    res.json({
      success: true,
      customProjectId,
      projectPath: projectFolderName,
      structure: structureData,
      template: templateData,
      customPromptUsed: true,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating custom structure:', error);
    res.status(500).json({ 
      error: 'Failed to generate custom structure',
      details: error.message
    });
  }
});

// 🆕 MIGRATED: Generate scenes using GenerationService
router.post('/generate-scenes', async (req, res) => {
  try {
    // Check if new services are available
    if (!req.generationService || !req.creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { structure, storyInput, projectId, projectPath, model = "claude-sonnet-4-20250514" } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for scenes: ${storyInput?.title || 'Untitled'}`);
    
    // Check credits using new CreditService
    const creditCheck = await req.creditService.checkCredits(username, 7);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Generate scenes using new GenerationService
    const result = await req.generationService.generateScenes(
      structure, storyInput, projectPath, username, model
    );
    
    // Deduct credits using new CreditService
    await req.creditService.deductCredits(username, 7, 'generate-scenes');
    await req.creditService.logUsage(username, 'generate-scenes', 7, true);
    
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
    if (req.creditService) {
      await req.creditService.logUsage(req.user.username, 'generate-scenes', 7, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate scenes',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// 🆕 MIGRATED: Generate dialogue using GenerationService
router.post('/generate-dialogue', async (req, res) => {
  try {
    // Check if new services are available
    if (!req.generationService || !req.creditService) {
      return res.status(503).json({ 
        error: 'Services temporarily unavailable. Please try again later.',
        fallback: 'Server restarting...'
      });
    }

    const { scene, storyInput, context, projectPath, model = "claude-sonnet-4-20250514", creativeDirections = null } = req.body;
    const username = req.user.username;
    
    console.log(`🆕 Using GenerationService for dialogue: ${scene.title || 'Untitled'}`);
    
    // Check credits using new CreditService
    const creditCheck = await req.creditService.checkCredits(username, 3);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    // Generate dialogue using new GenerationService
    const result = await req.generationService.generateDialogue(
      scene, storyInput, context, projectPath, username, model, creativeDirections
    );
    
    // Deduct credits using new CreditService
    await req.creditService.deductCredits(username, 3, 'generate-dialogue');
    await req.creditService.logUsage(username, 'generate-dialogue', 3, true);
    
    console.log('✅ Dialogue generation completed using GenerationService');
    
    res.json({
      ...result,
      migratedEndpoint: true,
      generatedBy: 'GenerationService v2.0'
    });

  } catch (error) {
    console.error('Error in migrated dialogue generation:', error);
    
    // Log error with CreditService if available
    if (req.creditService) {
      await req.creditService.logUsage(req.user.username, 'generate-dialogue', 3, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate dialogue',
      details: error.message,
      migratedEndpoint: true
    });
  }
});

// 🧪 NEW DIALOGUE GENERATION ENDPOINT (Using GenerationService v2)
router.post('/v2/generate-dialogue', async (req, res) => {
  try {
    if (!req.generationService) {
      return res.status(503).json({ error: 'New services not available. Use /api/generate-dialogue instead.' });
    }

    const { scene, storyInput, context, projectPath, model = "claude-sonnet-4-20250514", creativeDirections = null } = req.body;
    const username = req.user.username;
    
    // Check credits using new service
    const creditCheck = await req.creditService.checkCredits(username, 3);
    if (!creditCheck.hasCredits) {
      return res.status(402).json({ error: creditCheck.message });
    }

    console.log('🧪 Using NEW GenerationService for dialogue generation');
    
    // Generate dialogue using new service
    const result = await req.generationService.generateDialogue(
      scene, storyInput, context, projectPath, username, model, creativeDirections
    );
    
    // Deduct credits using new service
    await req.creditService.deductCredits(username, 3, 'generate-dialogue');
    await req.creditService.logUsage(username, 'generate-dialogue', 3, true);
    
    res.json({
      ...result,
      generatedBy: 'GenerationService v2.0',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in v2 dialogue generation:', error);
    
    if (req.creditService) {
      await req.creditService.logUsage(req.user.username, 'generate-dialogue', 3, false, error.message);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate dialogue',
      details: error.message,
      fallback: 'Try /api/generate-dialogue for the original endpoint'
    });
  }
});

// ==================== COMPLEX PROJECT-SPECIFIC GENERATION ROUTES ====================

// Generate multiple scenes for a specific plot point
router.post('/generate-scenes-for-plot-point/:projectPath/:actKey/:plotPointIndex', async (req, res) => {
  try {
    const { projectPath, actKey, plotPointIndex } = req.params;
    const { model = "claude-sonnet-4-20250514", creativeDirections = null } = req.body;
    
    console.log(`🎬 SCENE GENERATION DEBUG: Starting for ${projectPath}/${actKey}/${plotPointIndex}`);
    
    // Load project data from database
    const username = req.user.username;
    console.log(`👤 User: ${username}`);
    
    // Ensure database connection is healthy
    try {
      await req.dbClient.query('SELECT 1');
    } catch (connectionError) {
      console.error('Database connection error, attempting to reconnect:', connectionError);
      await req.dbClient.connect();
    }
    
    const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await req.dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = req.parseProjectContext(projectResult.rows[0].project_context);
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
    
    // Always recalculate scene distribution using fixed logic
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
    const context = new req.HierarchicalContext();
    
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
    
    const completion = await req.anthropic.messages.create({
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
      isKeyPlot: false, // Simplified since we don't use complex key plot logic anymore
      generatedAt: new Date().toISOString()
    };
    
    // Update database with new scenes
    await req.dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );

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
router.post('/generate-scene/:projectPath/:structureKey', async (req, res) => {
  try {
    const { projectPath, structureKey } = req.params;
    const { sceneCount = null, model = "claude-sonnet-4-20250514" } = req.body;
    
    // Load project data from database instead of file system
    const username = req.user.username;
    const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get project context from database
    const projectResult = await req.dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = req.parseProjectContext(projectResult.rows[0].project_context);
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
    
    // Check if we have scene distribution from plot points in database
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
    
    // Check if story structure has predefined scene count
    if (!finalSceneCount) {
      const preDefinedSceneCount = structureElement.scene_count || structure[structureKey]?.scene_count;
      if (preDefinedSceneCount) {
        finalSceneCount = preDefinedSceneCount;
        console.log(`🎭 Using predefined scene count from story structure: ${finalSceneCount} scenes`);
      }
    }
    
    // Fallback to default
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
      const context = new req.HierarchicalContext();
      await context.loadFromProject(projectPath);
      
      // If context doesn't exist, rebuild it from project data
      if (!context.contexts.story) {
        console.log('Rebuilding context from project data...');
        context.buildStoryContext(storyInput, storyInput.influencePrompt, projectContext.lastUsedSystemMessage, projectContext);
        context.buildStructureContext(structure, projectContext.templateData);
      }
      
      // Build act context for this specific structural element
      const actPosition = Object.keys(structure).indexOf(structureKey) + 1;
      context.buildActContext(structureKey, structureElement, actPosition);
      
      // Try to load plot points from database
      let plotPoints = [];
      try {
        const username = req.user.username;
        const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          // Get project context from database
          const projectResult = await req.dbClient.query(
            'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
            [userId, projectPath]
          );
          
          if (projectResult.rows.length > 0) {
            const projectContext = req.parseProjectContext(projectResult.rows[0].project_context);
            
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
- Character Development: ${structureElement.character_development || "N/A"}

Generate exactly ${finalSceneCount} scenes that advance this structural element. Each scene should be distinct and cinematic.

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

    console.log(`Generating ${finalSceneCount} scenes using ${useHierarchicalContext ? 'hierarchical' : 'simple'} context...`);

    const completion = await req.anthropic.messages.create({
      model: model,
      max_tokens: 4000,
      temperature: 0.7,
      system: "You are a professional screenwriter. Generate scenes that advance the story structure. Return ONLY valid JSON. Do not add any explanatory text, notes, or comments before or after the JSON.",
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
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to parse AI response', 
        rawResponse: completion.content[0].text.substring(0, 500) + "..."
      });
    }

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      return res.status(500).json({ error: 'Invalid scenes structure received' });
    }

    // Save scenes to database in unified v2.0 format
    if (!projectContext.generatedScenes) {
      projectContext.generatedScenes = {};
    }
    
    projectContext.generatedScenes[structureKey] = {
      scenes: scenesData.scenes,
      structureElement: structureElement,
      generatedAt: new Date().toISOString(),
      contextUsed: useHierarchicalContext ? 'hierarchical' : 'simple'
    };
    
    // Update database
    await req.dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );

    console.log(`Generated and saved ${scenesData.scenes.length} scenes for ${structureKey}`);

    res.json({
      success: true,
      structureKey,
      scenes: scenesData.scenes,
      sceneCount: scenesData.scenes.length,
      contextUsed: useHierarchicalContext ? 'hierarchical' : 'simple',
      message: `Generated ${scenesData.scenes.length} scenes for ${structureElement.name}`
    });

  } catch (error) {
    console.error('Error generating scenes for structural element:', error);
    res.status(500).json({ error: 'Failed to generate scenes', details: error.message });
  }
});

// Regenerate scenes from existing project (simple approach - generate fewer scenes)
router.post('/regenerate-scenes-simple/:projectPath', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await req.dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = req.parseProjectContext(projectResult.rows[0].project_context);
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
    await req.dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );
    
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
router.post('/regenerate-scenes/:projectPath', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await req.dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = req.parseProjectContext(projectResult.rows[0].project_context);
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

    const completion = await req.anthropic.messages.create({
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
      await req.dbClient.query(
        'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
        [JSON.stringify(projectContext), userId, projectPath]
      );
      
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

// Generate plot points for a specific story act (Level 4 generation)
router.post('/generate-plot-points-for-act/:projectPath/:actKey', async (req, res) => {
  try {
    const { projectPath, actKey } = req.params;
    const { desiredSceneCount = null, model = "claude-sonnet-4-20250514", customTemplateData = null, creativeDirections = null } = req.body;
    
    // desiredSceneCount is actually the desired PLOT POINT count from the dropdown
    const desiredPlotPointCount = desiredSceneCount || 4; // User's selected plot point count
    
    // Load existing project data from database (unified v2.0 format)
    const plotUsername = req.user.username;
    
    // Get user and project from database
    const plotUserResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [plotUsername]);
    if (plotUserResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const plotUserId = plotUserResult.rows[0].id;
    
    // Load project context from database
    const plotProjectResult = await req.dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [plotUserId, projectPath]
    );
    
    if (plotProjectResult.rows.length === 0) {
      throw new Error('Project not found in database');
    }
    
    const plotProjectContext = req.parseProjectContext(plotProjectResult.rows[0].project_context);
    const { generatedStructure: structure, storyInput } = plotProjectContext;
    
    // Use customized template data if provided, otherwise fall back to database version
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
    const context = new req.HierarchicalContext();
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
    let prompt = req.promptBuilders.buildPlotPointsPrompt(hierarchicalPrompt, desiredPlotPointCount, finalSceneCount);
    
    // Add creative directions if provided
    if (creativeDirections?.plotPoints?.[actKey]) {
      const direction = creativeDirections.plotPoints[actKey];
      prompt += `\n\nUser Creative Direction for Plot Points: ${direction}\n`;
      prompt += `⚠️ IMPORTANT: Incorporate this creative direction into the plot points for this act.\n`;
    }

    console.log(`Generating ${desiredPlotPointCount} plot points for ${actKey} (expanding to ${finalSceneCount} scenes)`);
    
    const completion = await req.anthropic.messages.create({
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
    const username = req.user.username;
    
    // Get user and project from database
    const userResult = await req.dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const userId = userResult.rows[0].id;
    
    // Load existing project context
    const projectResult = await req.dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      throw new Error('Project not found in database');
    }
    
    const projectContext = req.parseProjectContext(projectResult.rows[0].project_context);
    
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
    
    // Update database
    await req.dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );

    console.log(`Plot points generated and saved for ${actKey}: ${plotPointsData.plotPoints.length} plot points → ${finalSceneCount} scenes`);

    res.json({
      success: true,
      actKey: actKey,
      plotPoints: plotPointsData.plotPoints,
      sceneDistribution: sceneDistribution,
      totalScenesForAct: finalSceneCount,
      totalPlotPoints: plotPointsData.plotPoints.length,
      message: `Generated ${plotPointsData.plotPoints.length} plot points for ${storyAct.name}`
    });

  } catch (error) {
    console.error('Error generating plot points for act:', error);
    res.status(500).json({ error: 'Failed to generate plot points for act', details: error.message });
  }
});

module.exports = {
  router,
  getSuggestionResponseFormat
}; 