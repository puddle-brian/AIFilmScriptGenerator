const Anthropic = require('@anthropic-ai/sdk');

class GenerationService {
  constructor(anthropicClient, dbClient, promptBuilders, logger = console) {
    this.ai = anthropicClient;
    this.db = dbClient;
    this.prompts = promptBuilders;
    this.logger = logger;
  }

  // ==================================================
  // STRUCTURE GENERATION
  // ==================================================
  
  async generateStructure(storyInput, templateData, projectPath = null, model = "claude-sonnet-4-20250514", username = null) {
    try {
      this.logger.log(`🏗️ Generating structure for: ${storyInput.title}`);
      
      // Use prompt builder for structure generation
      const prompt = this.prompts.buildStructurePrompt(storyInput, templateData);
      
      const completion = await this.ai.messages.create({
        model: model,
        max_tokens: 3000,
        temperature: 0.7,
        system: "You are a professional screenwriter and story structure expert. Create detailed plot structures that serve the story's themes and character development. Always respond with valid JSON.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
      });

      let structureData;
      try {
        structureData = JSON.parse(completion.content[0].text);
      } catch (parseError) {
        this.logger.error('Failed to parse structure response:', parseError);
        throw new Error('Invalid response format from AI');
      }

      // Save to database if project path provided
      if (projectPath && username) {
        await this.saveStructureToDatabase(structureData, storyInput, templateData, projectPath, username);
      }

      this.logger.log('✅ Structure generation completed');
      return {
        success: true,
        structure: structureData,
        template: templateData,
        storyInput: storyInput
      };

    } catch (error) {
      this.logger.error('Error generating structure:', error);
      throw error;
    }
  }

  // ==================================================
  // PLOT POINTS GENERATION
  // ==================================================
  
  async generatePlotPoints(scenesData, storyInput, structure, projectPath = null, username = null, model = "claude-sonnet-4-20250514") {
    try {
      this.logger.log('🎯 Generating plot points for connected scenes');
      
      // Process scenes data to extract scene information
      const allScenes = [];
      const sceneStructureMap = [];
      
      Object.entries(scenesData).forEach(([structureKey, sceneGroup]) => {
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

      const prompt = this.buildPlotPointsPrompt(storyInput, allScenes);

      const response = await this.ai.messages.create({
        model: model,
        max_tokens: 2000,
        temperature: 0.7,
        system: "You are a professional screenwriter. Generate clear, causal plot points that describe concrete actions and events. Focus on visual conflicts, character choices under pressure, and specific dramatic situations. Always respond with valid JSON.",
        messages: [{ role: 'user', content: prompt }]
      });

      let plotPointsData;
      try {
        const rawResponse = response.content[0].text;
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : rawResponse;
        plotPointsData = JSON.parse(jsonString);
      } catch (parseError) {
        this.logger.error('Failed to parse plot points response:', parseError);
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

      // Save to database if project path provided
      if (projectPath && username) {
        await this.savePlotPointsToDatabase(plotPointsByStructure, projectPath, username);
      }

      this.logger.log(`✅ Generated ${plotPointsData.plotPoints.length} connected plot points`);
      return {
        success: true,
        message: `Generated ${plotPointsData.plotPoints.length} connected plot points`,
        plotPoints: plotPointsByStructure
      };

    } catch (error) {
      this.logger.error('Error generating plot points:', error);
      throw error;
    }
  }

  // ==================================================
  // SCENE GENERATION
  // ==================================================
  
  async generateScenes(structure, storyInput, projectPath = null, username = null, model = "claude-sonnet-4-20250514") {
    try {
      this.logger.log('🎬 Generating scenes for approved structure');
      
      const prompt = this.buildScenesPrompt(storyInput, structure);

      const completion = await this.ai.messages.create({
        model: model,
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
      } catch (parseError) {
        this.logger.error('Failed to parse scenes response:', parseError);
        scenesData = {
          error: "Failed to parse AI response",
          rawResponse: completion.content[0].text
        };
      }

      // Save to database if project path provided
      if (projectPath && username && !scenesData.error) {
        await this.saveScenesToDatabase(scenesData, projectPath, username);
      }

      this.logger.log('✅ Scene generation completed');
      return { scenes: scenesData };

    } catch (error) {
      this.logger.error('Error generating scenes:', error);
      throw error;
    }
  }

  // ==================================================
  // DIALOGUE GENERATION
  // ==================================================
  
  async generateDialogue(scene, storyInput, context, projectPath = null, username = null, model = "claude-sonnet-4-20250514", creativeDirections = null) {
    try {
      this.logger.log(`🎬 Generating dialogue for scene: ${scene.title || 'Untitled'}`);
      
      // Process creative directions if provided
      const sceneIndex = scene.sceneIndex || 0;
      const actKey = scene.structureKey || 'unknown';
      const dialogueKey = `${actKey}_${sceneIndex}`;
      
      // Use prompt builder for dialogue generation
      let prompt = this.prompts.buildSimpleDialoguePrompt(storyInput, scene, context);
      
      // Add creative directions if provided
      if (creativeDirections?.dialogue?.[dialogueKey]) {
        const direction = creativeDirections.dialogue[dialogueKey];
        this.logger.log(`✨ Adding creative direction for dialogue: "${direction}"`);
        prompt = `${prompt}\n\nUser Creative Direction for Dialogue: ${direction}\n⚠️ IMPORTANT: Incorporate this creative direction into the dialogue for this scene.\n\nGenerate the screenplay formatted dialogue and action for this scene:`;
      }

      const completion = await this.ai.messages.create({
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

      const dialogueText = completion.content[0].text;
      const sceneId = scene.id || this.generateId();

      // Save to database if project path provided
      if (projectPath && username) {
        await this.saveDialogueToDatabase(dialogueText, sceneId, scene, projectPath, username);
      }

      this.logger.log('✅ Dialogue generation completed');
      return { 
        dialogue: dialogueText,
        sceneId: sceneId
      };

    } catch (error) {
      this.logger.error('Error generating dialogue:', error);
      throw error;
    }
  }

  // ==================================================
  // GENIE SUGGESTIONS
  // ==================================================
  
  async generateGenieSuggestion(suggestionType, prompt, context, temperature = 0.8) {
    try {
      this.logger.log(`🧞‍♂️ Generating Genie suggestion for type: ${suggestionType}`);

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
      const responseFormat = this.getSuggestionResponseFormat(suggestionType);
      const fullPrompt = `${prompt}\n\n${responseFormat}`;

      const completion = await this.ai.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 300,
        temperature: temperature,
        system: systemMessage,
        messages: [
          {
            role: "user",
            content: fullPrompt
          }
        ],
      });

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

      this.logger.log(`✅ Genie suggestion generated for type: ${suggestionType}`);
      
      return {
        suggestion: suggestion,
        suggestionType: suggestionType,
        context: context,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error generating genie suggestion:', error);
      throw error;
    }
  }

  // ==================================================
  // HELPER METHODS
  // ==================================================

  buildPlotPointsPrompt(storyInput, allScenes) {
    return `You are a master screenwriter creating plot points that connect scenes with clear causal relationships.

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
    "Plot point 1",
    "Plot point 2",
    // ... for all ${allScenes.length} scenes
  ]
}`;
  }

  buildScenesPrompt(storyInput, structure) {
    return `Based on the approved plot structure, break down each structural element into individual scenes. 

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
  }

  getSuggestionResponseFormat(suggestionType) {
    const formats = {
      'director': 'Respond with just the director name and a brief note about their style (e.g., "Christopher Nolan - Complex narratives with time manipulation").',
      'screenwriter': 'Respond with just the screenwriter name and a brief note about their style.',
      'film': 'Respond with just the film title and a brief note about why it\'s relevant.',
      'tone': 'Respond with just the tone/mood and a brief explanation.',
      'character': 'Respond with either JSON format: {"name": "Character Name", "description": "Brief description"} OR plain text with Name: and description.',
      'storyconcept': 'Respond in this format:\nTitle: [Story Title]\nLogline: [One sentence story summary]'
    };
    
    return formats[suggestionType] || 'Provide a helpful suggestion with brief explanation.';
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // ==================================================
  // DATABASE OPERATIONS
  // ==================================================

  async saveStructureToDatabase(structureData, storyInput, templateData, projectPath, username) {
    try {
      const userResult = await this.db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length === 0) return;
      
      const userId = userResult.rows[0].id;
      
      // Load existing project context
      const projectResult = await this.db.query(
        'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
        [userId, projectPath]
      );
      
      if (projectResult.rows.length > 0) {
        const projectContext = JSON.parse(projectResult.rows[0].project_context || '{}');
        
        // Update with structure data
        projectContext.generatedStructure = structureData;
        projectContext.template = templateData;
        projectContext.storyInput = storyInput;
        projectContext.currentStep = Math.max(projectContext.currentStep || 1, 3);
        
        // Save back to database
        await this.db.query(
          'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
          [JSON.stringify(projectContext), userId, projectPath]
        );
        
        this.logger.log(`✅ Structure saved to database for project: ${projectPath}`);
      }
    } catch (error) {
      this.logger.error('Error saving structure to database:', error);
      // Don't fail the request if database save fails
    }
  }

  async savePlotPointsToDatabase(plotPointsData, projectPath, username) {
    // Implementation for saving plot points to database
    // Similar pattern to saveStructureToDatabase
  }

  async saveScenesToDatabase(scenesData, projectPath, username) {
    // Implementation for saving scenes to database
    // Similar pattern to saveStructureToDatabase
  }

  async saveDialogueToDatabase(dialogueText, sceneId, scene, projectPath, username) {
    try {
      const userResult = await this.db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userResult.rows.length === 0) return;
      
      const userId = userResult.rows[0].id;
      
      // Load existing project context
      const projectResult = await this.db.query(
        'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
        [userId, projectPath]
      );
      
      if (projectResult.rows.length > 0) {
        const projectContext = JSON.parse(projectResult.rows[0].project_context || '{}');
        
        // Initialize generatedDialogues if it doesn't exist
        if (!projectContext.generatedDialogues) {
          projectContext.generatedDialogues = {};
        }
        
        // Save dialogue with scene ID
        projectContext.generatedDialogues[sceneId] = {
          dialogue: dialogueText,
          sceneId: sceneId,
          scene: scene,
          generatedAt: new Date().toISOString()
        };
        
        // Update currentStep to 6 when dialogue is first generated
        if (projectContext.currentStep < 6) {
          projectContext.currentStep = 6;
          this.logger.log(`📈 Updated currentStep to 6 (dialogue generated)`);
        }
        
        // Save back to database
        await this.db.query(
          'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
          [JSON.stringify(projectContext), userId, projectPath]
        );
        
        this.logger.log(`✅ Dialogue saved to database for scene: ${sceneId}`);
      }
    } catch (error) {
      this.logger.error('Error saving dialogue to database:', error);
      // Don't fail the request if database save fails
    }
  }
}

module.exports = GenerationService; 