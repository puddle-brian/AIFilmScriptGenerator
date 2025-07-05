const fs = require('fs').promises;
const path = require('path');

/**
 * HierarchicalContext Class
 * Manages context for hierarchical story generation with 5 levels:
 * 1. Story Foundation (storyInput, influences, characters)
 * 2. Structure (template, acts)
 * 3. Act (current act being worked on)
 * 4. Plot Points (plot points for current act)
 * 5. Scene (individual scene context)
 */
class HierarchicalContext {
  constructor(dependencies = {}) {
    this.contexts = {
      story: null,        // Level 1: Original story concept and influences
      structure: null,    // Level 2: Generated plot structure 
      act: null,          // Level 3: Specific story act
      plotPoints: null,   // Level 4: Plot points for current act
      scene: null         // Level 5: Individual scene context
    };
    
    // Dependency injection for services
    this.db = dependencies.db;
    this.anthropic = dependencies.anthropic;
  }

  // Build Level 1: Story Foundation Context
  buildStoryContext(storyInput, originalPrompt = null, systemMessage = null, projectContext = null) {
    // If we have full project context from database, use that for richer information
    const fullContext = projectContext || {};
    
    // Enhanced character handling - use structured character data if available
    let charactersDisplay = storyInput.characters;
    if (fullContext.projectCharacters && Array.isArray(fullContext.projectCharacters) && fullContext.projectCharacters.length > 0) {
      charactersDisplay = fullContext.projectCharacters.map(char => {
        if (typeof char === 'object' && char.name) {
          // Skip descriptions that are just "Main character: [name]" - show name only
          if (char.description && !char.description.startsWith('Main character:')) {
            return `${char.name} (${char.description})`;
          }
          return char.name;
        }
        return char;
      }).join(', ');
    }
    
    // Enhanced influences - use project-level influences if available
    const influences = fullContext.influences || storyInput.influences || {};
    

    this.contexts.story = {
      level: 1,
      type: 'story',
      data: {
        title: storyInput.title,
        logline: storyInput.logline,
        characters: charactersDisplay,
        tone: storyInput.tone,
        genre: storyInput.genre,
        totalScenes: storyInput.totalScenes || 70,
        influences: influences,
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
    
    // Get acts in correct chronological order based on template
    const actKeys = this.getChronologicalActOrder(templateData, structure);
    
    this.contexts.structure = {
      level: 2,
      type: 'structure',
      parentContext: this.contexts.story,
      data: {
        template: templateData,
        structure: structure,
        actKeys: actKeys,
        totalActs: actKeys.length
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.structure;
  }

  // Get acts in correct chronological order based on template structure
  getChronologicalActOrder(templateData, structure) {
    // Define the correct chronological order for common templates
    const templateOrders = {
      'three-act': ['setup', 'confrontation_first_half', 'midpoint', 'confrontation_second_half', 'crisis', 'climax', 'resolution'],
      'save-the-cat': ['opening_image', 'setup', 'theme_stated', 'catalyst', 'debate', 'break_into_two', 'b_story', 'fun_and_games', 'midpoint', 'bad_guys_close_in', 'all_is_lost', 'dark_night_of_soul', 'break_into_three', 'finale', 'final_image'],
      'hero-journey': ['ordinary_world', 'call_to_adventure', 'refusal_of_call', 'meeting_mentor', 'crossing_threshold', 'tests_allies_enemies', 'approach_inmost_cave', 'ordeal', 'reward', 'road_back', 'resurrection', 'return_with_elixir'],
      'hero-s-journey': ['ordinary_world', 'call_to_adventure', 'refusal_of_call', 'meeting_mentor', 'crossing_threshold', 'tests_allies_enemies', 'approach_inmost_cave', 'ordeal', 'reward', 'road_back', 'resurrection', 'return_with_elixir'],
      'booker-quest': ['call_to_quest', 'preparation', 'journey_begins', 'trials_and_tests', 'approach_goal', 'final_ordeal', 'goal_achieved'],
      'booker-overcoming-monster': ['anticipation_stage', 'dream_stage', 'frustration_stage', 'nightmare_stage', 'final_triumph'],
      'booker-rags-to-riches': ['humble_origins', 'call_to_adventure', 'getting_out', 'initial_success', 'first_crisis', 'final_crisis', 'final_triumph'],
      'booker-voyage-return': ['ordinary_world', 'call_to_adventure', 'strange_world', 'initial_fascination', 'growing_threat', 'escape_and_return'],
      'booker-comedy': ['initial_situation', 'complication', 'development', 'crisis', 'resolution'],
      'booker-tragedy': ['anticipation_stage', 'dream_stage', 'frustration_stage', 'nightmare_stage', 'destruction'],
      'booker-rebirth': ['initial_state', 'call_to_life', 'resistance', 'crisis', 'final_awakening']
    };
    
    // Get template name from templateData
    const templateName = templateData?.name?.toLowerCase().replace(/[^a-z-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown';
    
    // Try to match template name to known orders
    let chronologicalOrder = null;
    for (const [key, order] of Object.entries(templateOrders)) {
      if (templateName.includes(key) || key.includes(templateName)) {
        chronologicalOrder = order;
        break;
      }
    }
    
    // If we have a known order, filter it to only include acts that exist in the structure
    if (chronologicalOrder) {
      const existingActs = chronologicalOrder.filter(actKey => structure[actKey]);
      if (existingActs.length > 0) {
        console.log(`🔧 Using chronological order for template "${templateName}": ${existingActs.join(' → ')}`);
        return existingActs;
      }
    }
    
    // Fallback: use Object.keys but warn about potential ordering issues
    const fallbackOrder = Object.keys(structure);
    console.log(`⚠️  Using fallback Object.keys() order for template "${templateName}": ${fallbackOrder.join(' → ')}`);
    console.log(`⚠️  This may cause incorrect act ordering. Consider adding template to chronological order map.`);
    return fallbackOrder;
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
        name: act?.name || actKey,
        description: act?.description || 'No description available',
        characterDevelopment: act?.character_development || 'No character development available',
        position: actPosition,
        totalActs: this.contexts.structure.data.totalActs
      },
      generatedAt: new Date().toISOString()
    };
    return this.contexts.act;
  }

  // Build Level 4: Plot Points Context (builds on act) - ENHANCED with previous acts' plot points
  async buildPlotPointsContext(plotPoints, totalScenes = null, projectPath = null, username = null) {
    if (!this.contexts.act) {
      throw new Error('Act context must be built before plot points context');
    }

    // Load previous acts' plot points for inter-act causality
    let previousPlotPoints = [];
    if (projectPath) {
      previousPlotPoints = await this.loadPreviousActsPlotPoints(projectPath, username);
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

  // Load plot points from all previous acts for inter-act causality (database version)
  async loadPreviousActsPlotPoints(projectPath, username = null) {
    try {
      if (!this.contexts.structure || !this.contexts.act) {
        return [];
      }

      const currentActKey = this.contexts.act.data.key;
      let structureKeys = this.contexts.structure.data.actKeys;
      
      // CRITICAL FIX: Ensure chronological order even for loaded projects
      // Get the correct chronological order based on template
      const templateData = this.contexts.structure.data.template;
      const structure = this.contexts.structure.data.structure;
      const correctOrder = this.getChronologicalActOrder(templateData, structure);
      
      // Use correct chronological order instead of potentially wrong saved order
      if (correctOrder && correctOrder.length > 0) {
        structureKeys = correctOrder;
        console.log(`🔧 FIXED: Using correct chronological order: ${structureKeys.join(' → ')}`);
      } else {
        console.log(`⚠️  Warning: No correct chronological order found, using saved order: ${structureKeys.join(' → ')}`);
      }
      
      // Get all acts that come before current act in chronological order
      const currentActIndex = structureKeys.indexOf(currentActKey);
      const previousActKeys = structureKeys.slice(0, currentActIndex);
      
      console.log(`📋 Loading plot points for previous acts: ${previousActKeys.join(', ')}`);
      
      if (previousActKeys.length === 0) {
        console.log(`📋 No previous acts found (this is the first act)`);
        return [];
      }
      
      // Load project context from database
      const projectQuery = `
        SELECT project_context 
        FROM user_projects 
        WHERE project_name = $1 
        AND user_id = (SELECT id FROM users WHERE username = $2)
      `;
      
      const projectResult = await this.db.query(projectQuery, [projectPath, username]);
      
      if (projectResult.rows.length === 0) {
        console.log(`⚠️  No project found for path: ${projectPath}`);
        return [];
      }
      
      const projectContext = this.parseProjectContext(projectResult.rows[0].project_context);
      
      console.log(`  🔍 Project context keys: ${Object.keys(projectContext).join(', ')}`);
      if (projectContext.plotPoints) {
        console.log(`  📋 Plot points structure keys: ${Object.keys(projectContext.plotPoints).join(', ')}`);
      } else {
        console.log('  ⚠️  No plotPoints key found in project context');
      }
      
      if (!projectContext.plotPoints) {
        console.log('  ⚠️  No plot points found in project context');
        return [];
      }
      
      let previousPlotPoints = [];
      
      for (const actKey of previousActKeys) {
        try {
          const actPlotPointsData = projectContext.plotPoints[actKey];
          console.log(`  🔍 Checking act "${actKey}": ${actPlotPointsData ? 'EXISTS' : 'NOT FOUND'}`);
          if (actPlotPointsData) {
            console.log(`    📊 Act data keys: ${Object.keys(actPlotPointsData).join(', ')}`);
            if (actPlotPointsData.plotPoints) {
              console.log(`    📝 Plot points type: ${Array.isArray(actPlotPointsData.plotPoints) ? 'Array' : typeof actPlotPointsData.plotPoints}`);
              console.log(`    📝 Plot points length: ${Array.isArray(actPlotPointsData.plotPoints) ? actPlotPointsData.plotPoints.length : 'N/A'}`);
            }
          }
          
          if (actPlotPointsData) {
            // Handle both array format and numeric index format
            let plotPoints = [];
            
            if (actPlotPointsData.plotPoints && Array.isArray(actPlotPointsData.plotPoints)) {
              // New format: plotPoints array
              plotPoints = actPlotPointsData.plotPoints;
              console.log(`    ✅ Found ${plotPoints.length} plot points for ${actKey} (array format)`);
            } else {
              // Legacy format: numeric indices (0, 1, 2, 3...)
              const numericKeys = Object.keys(actPlotPointsData)
                .filter(key => /^\d+$/.test(key))
                .sort((a, b) => parseInt(a) - parseInt(b));
              
              if (numericKeys.length > 0) {
                plotPoints = numericKeys.map(key => actPlotPointsData[key]);
                console.log(`    ✅ Found ${plotPoints.length} plot points for ${actKey} (numeric format)`);
              }
            }
            
            if (plotPoints.length > 0) {
              // Add act context to each plot point for better understanding
              const actPlotPoints = plotPoints.map((plotPoint, index) => ({
                actKey: actKey,
                actName: this.contexts.structure.data.structure[actKey]?.name || actKey,
                plotPoint: typeof plotPoint === 'string' ? plotPoint : (plotPoint.plotPoint || JSON.stringify(plotPoint)),
                plotPointIndex: index,
                isLastInAct: index === plotPoints.length - 1
              }));
              
              previousPlotPoints.push(...actPlotPoints);
              console.log(`  ✅ Loaded ${plotPoints.length} plot points from ${actKey} (database)`);
            } else {
              console.log(`  ⚠️  No plot points found for ${actKey} in database`);
            }
          } else {
            console.log(`  ⚠️  No plot points found for ${actKey} in database`);
          }
        } catch (actError) {
          console.log(`  ⚠️  Error loading plot points for ${actKey}: ${actError.message}`);
          // Continue loading other acts even if one fails
        }
      }
      
      console.log(`  🎯 Total previous plot points loaded: ${previousPlotPoints.length}`);
      return previousPlotPoints;
      
    } catch (error) {
      console.error('Error loading previous acts plot points from database:', error);
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
  async generateHierarchicalPrompt(targetLevel = 5, customInstructions = '') {
    let prompt = '';
    
    // Track if this is plot point generation for later use
    const isPlotPointGeneration = targetLevel === 4;
    
    // Level 1: Story Foundation with Full Creative Context
    // Story context is built properly below - no need to dump raw object
    if (this.contexts.story) {
      const story = this.contexts.story.data;
      
      // Include the full original creative direction if available
      if (story.originalPrompt) {
        prompt += `${story.originalPrompt}Based on the following story concept, generate a detailed plot structure using the selected format that embodies these artistic sensibilities:\n\n`;
      }
      
      prompt += `STORY DETAILS:\n`;
      prompt += `- Title: ${story.title}\n`;
      prompt += `- Logline: ${story.logline}\n`;
      
      // Enhanced character display with descriptions if available
      if (Array.isArray(story.characters)) {
        const characterDetails = story.characters.map(char => {
          if (typeof char === 'object' && char.name) {
            // Skip descriptions that are just "Main character: [name]" - show name only
            if (char.description && !char.description.startsWith('Main character:')) {
              return `${char.name} (${char.description})`;
            }
            return char.name;
          }
          return char;
        }).join(', ');
        prompt += `- Main Characters: ${characterDetails}\n`;

      } else {
        prompt += `- Main Characters: ${story.characters}\n`;

      }
      
      // Tone is now handled via the influence prompt at the top - no structured list needed
      
      prompt += '\n';
    }

    // Level 2: Streamlined Structure Context - Just show template name
    if (this.contexts.structure && targetLevel >= 2) {
      const structure = this.contexts.structure.data;
      prompt += `STRUCTURE: ${structure.template.name}\n\n`;
    }

    // Level 4: Streamlined Plot Points Context
    if (this.contexts.plotPoints && targetLevel >= 4) {
      const plotPoints = this.contexts.plotPoints.data;
      
      // Show ALL previous plot points for story coherence (essential for causality)
      if (plotPoints.hasPreviousPlotPoints && plotPoints.previousPlotPoints.length > 0) {
        prompt += `STORY PROGRESSION (Previous Plot Points):\n`;
        
        let currentActKey = '';
        plotPoints.previousPlotPoints.forEach((prevPlotPoint, index) => {
          // Group by act for better readability
          if (prevPlotPoint.actKey !== currentActKey) {
            currentActKey = prevPlotPoint.actKey;
            prompt += `\n${prevPlotPoint.actName}:\n`;
          }
          
          // 🔗 ONLY appears on the very last plot point in the entire sequence (for causal connection)
          const isVeryLastPlotPoint = index === plotPoints.previousPlotPoints.length - 1;
          const marker = isVeryLastPlotPoint ? ' 🔗' : '';
          prompt += `  ${prevPlotPoint.plotPointIndex + 1}. ${prevPlotPoint.plotPoint}${marker}\n`;
        });
        prompt += '\n';
      }
    }
    
    // CRITICAL: Current act focus - Show AFTER story details for plot point generation (maximum recency & prominence)
    // Show at normal position for non-plot-point generation  
    if (this.contexts.act && targetLevel >= 3) {
      const currentAct = this.contexts.act.data;
      
      if (isPlotPointGeneration) {
        // For plot point generation: Place AFTER story details for maximum AI focus
        prompt += `CURRENT STORY ACT (TAKES PRECEDENCE):\n`;
        prompt += `${currentAct.name}\n`;
        prompt += `Purpose: ${currentAct.description}\n`;
        
        // Include character development if available
        if (currentAct.characterDevelopment) {
          prompt += `Character Development: ${currentAct.characterDevelopment}\n`;
        }
        
        // Include userDirections if available
        if (currentAct.userDirections && currentAct.userDirections.trim()) {
          prompt += `User Creative Direction: ${currentAct.userDirections}\n`;
          prompt += `⚠️  MANDATORY: Incorporate this creative direction into all plot points for this act.\n`;
        }
        
        // Add explicit instruction for plot point generation
        prompt += `\n⚠️  IMPORTANT: Generate plot points that match THIS CURRENT ACT's description above, not the general story details.\n\n`;
      } else {
        // For non-plot-point generation: Normal position
        prompt += `CURRENT STORY ACT:\n`;
        prompt += `${currentAct.name}\n`;
        prompt += `Purpose: ${currentAct.description}\n`;
        
        // Include character development if available
        if (currentAct.characterDevelopment) {
          prompt += `Character Development: ${currentAct.characterDevelopment}\n`;
        }
        
        // Include userDirections if available
        if (currentAct.userDirections && currentAct.userDirections.trim()) {
          prompt += `User Creative Direction: ${currentAct.userDirections}\n`;
        }
        
        prompt += '\n';
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

  // Save context to project file (database-only mode - skip file system)
  async saveToProject(projectPath) {
    // In database-only mode, we don't need to save context files
    // Context is managed in memory during generation and saved to database
    console.log(`Context management: Skipping file system save for ${projectPath} (database-only mode)`);
    return;
  }

  // Load context from project file
  async loadFromProject(projectPath) {
    try {
      // For now, always return null to force context rebuild from database
      // This ensures we get fresh data from the database instead of potentially stale file data
      return null;
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

  // Helper function to generate scenes for a plot point (database version)
  async generateScenesForPlotPoint(projectPath, actKey, plotPointIndex, model = "claude-sonnet-4-20250514", projectContext = null, sceneDistribution = null, username = null, creativeDirections = null) {
    // Use provided project context or load from database as fallback
    if (!projectContext) {
      throw new Error('Project context must be provided to generateScenesForPlotPoint');
    }
    
    if (!projectContext.plotPoints || !projectContext.plotPoints[actKey]) {
      throw new Error('Plot points not found for this act in database');
    }
    
    const plotPointsData = projectContext.plotPoints[actKey];
    const plotPointIndexNum = parseInt(plotPointIndex);
    
    // 🔧 CRITICAL FIX: Always recalculate scene distribution using fixed logic
    // Don't rely on stored scene distribution which may be from old buggy calculation
    console.log(`🔧 [HierarchicalContext] Recalculating scene distribution using fixed logic for plot point ${plotPointIndexNum}`);
    
    // Use same fixed logic as calculateSceneDistribution
    const totalScenes = projectContext?.storyInput?.totalScenes || 70;
    const totalActs = projectContext?.generatedStructure ? Object.keys(projectContext.generatedStructure).length : 15;
    const expectedPlotPoints = totalActs * 3;
    const sceneCount = Math.max(1, Math.min(3, Math.round(totalScenes / expectedPlotPoints)));
    
    console.log(`📊 [HierarchicalContext] Fixed calculation: ${totalScenes} scenes ÷ ${expectedPlotPoints} expected plot points = ${sceneCount} scenes per plot point (capped at 3 max)`);
    
    // Get plot point text from plotPointsData (handle both array and object formats)
    const plotPointsArray = Array.isArray(plotPointsData) ? plotPointsData : (plotPointsData.plotPoints || []);
    const plotPoint = plotPointsArray[plotPointIndexNum];
    
    if (!plotPoint) {
      throw new Error(`Plot point ${plotPointIndexNum} not found in act ${actKey}`);
    }
    
    // Initialize hierarchical context (no file loading needed - use database context)
    const context = new HierarchicalContext({
      db: this.db,
      anthropic: this.anthropic
    });
    
    // Get structure data from database project context
    const structure = projectContext.generatedStructure;
    const storyInput = projectContext.storyInput;
    
    // Build context from database data
    context.buildStoryContext(storyInput, storyInput.influencePrompt, null, projectContext);
    context.buildStructureContext(structure, projectContext.templateData);
    
    // Build act context
    const actPosition = Object.keys(structure).indexOf(actKey) + 1;
    context.buildActContext(actKey, structure[actKey], actPosition);
    
    // Build plot points context (scene generation doesn't need previous plot points)
    // plotPointsData is an array of plot point strings in the working format
    await context.buildPlotPointsContext(plotPointsData, sceneCount, projectPath, username);
    
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

    const completion = await this.anthropic.messages.create({
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

    // Save scenes to database (part of unified format - scenes will be saved by the calling endpoint)
    console.log(`✅ Generated ${scenesData.scenes.length} scenes for plot point ${plotPointIndexNum} (database integration)`);

    return {
      success: true,
      actKey: actKey,
      plotPointIndex: plotPointIndexNum,
      plotPoint: plotPoint,
      scenes: scenesData.scenes,
      sceneCount: scenesData.scenes.length,
      isKeyPlot: false, // 🔧 Fixed: simplified since we don't use complex key plot logic anymore
      generatedAt: new Date().toISOString(),
      message: `Generated ${scenesData.scenes.length} scenes for plot point: "${plotPoint}"`
    };
  }

  // Simple scene distribution: total scenes ÷ total plot points
  calculateSceneDistribution(plotPoints, totalScenesForAct, actKey, totalMovieScenes = null, projectContext = null) {
    // Get total scenes from calculator (user input)
    const totalScenes = totalMovieScenes || (projectContext?.storyInput?.totalScenes) || 70;
    
    // Count EXPECTED plot points across all acts (not just generated ones)
    const totalActs = projectContext?.generatedStructure ? Object.keys(projectContext.generatedStructure).length : 15;
    const avgPlotPointsPerAct = 3; // Reasonable average
    const totalExpectedPlotPoints = totalActs * avgPlotPointsPerAct;
    
    // Simple division: scenes per plot point (capped at 3 max)
    const scenesPerPlotPoint = Math.max(1, Math.min(3, Math.round(totalScenes / totalExpectedPlotPoints)));
    
    console.log(`🎬 Simple scene distribution: ${totalScenes} scenes ÷ ${totalExpectedPlotPoints} expected plot points = ${scenesPerPlotPoint} scenes per plot point (capped at 3 max)`);
    
    const sceneDistribution = plotPoints.map((plotPoint, index) => {
      return {
        plotPoint,
        sceneCount: scenesPerPlotPoint,
        isKeyPlot: false, // Keep it simple
        plotPointIndex: index
      };
    });
    
    return sceneDistribution;
  }

  // Helper function to safely parse project context (handles both JSONB and TEXT storage)
  parseProjectContext(projectContextRaw) {
    return typeof projectContextRaw === 'string' ? JSON.parse(projectContextRaw) : projectContextRaw;
  }
}

module.exports = HierarchicalContext; 