/**
 * AI Feedback System - Modular story analysis and feedback
 * 
 * This module provides AI-powered feedback on story concepts, characters,
 * influences, and other creative elements to help optimize prompts for
 * better AI generation results.
 */

const promptBuilders = require('./prompt-builders');

class AIFeedbackSystem {
  constructor(apiKey, hierarchicalContextClass) {
    this.apiKey = apiKey;
    this.HierarchicalContext = hierarchicalContextClass;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20241022';
  }

  /**
   * Analyze a story concept for AI generation readiness
   * @param {Object} storyInput - Story concept data
   * @param {string} projectPath - Optional project path for context
   * @returns {Object} Analysis results with scores and suggestions
   */
  async analyzeStoryConcept(storyInput, projectPath = null) {
    try {
      console.log('🔍 Analyzing story concept:', storyInput.title);
      
      // 🔧 CRITICAL FIX: Use dedicated story analysis prompt (Step 1 only)
      // This should NOT include future step information like template structures
      const storyAnalysisPrompt = this._buildStoryAnalysisPrompt(storyInput);
      
      // Get AI analysis
      const analysis = await this._makeAnalysisRequest(storyAnalysisPrompt);
      
      console.log('✅ Story concept analysis completed');
      
      return {
        success: true,
        analysis: analysis,
        promptAnalyzed: storyAnalysisPrompt,
        metadata: {
          analysisType: 'story_concept',
          timestamp: new Date().toISOString(),
          model: this.model,
          promptSource: 'dedicated-story-analysis-template'
        }
      };

    } catch (error) {
      console.error('Error analyzing story concept:', error);
      throw new Error(`Story analysis failed: ${error.message}`);
    }
  }



  /**
   * Build dedicated story analysis prompt (Step 1 only)
   * @private
   */
  _buildStoryAnalysisPrompt(storyInput) {
    // Load the dedicated story analysis template
    const fs = require('fs');
    const path = require('path');
    
    const templatePath = path.join(__dirname, 'prompts', 'story-analysis.txt');
    const template = fs.readFileSync(templatePath, 'utf8');
    
    // Load available story structure templates for recommendation
    const availableTemplates = this._loadAvailableTemplates();
    
    // Clean the template (remove comments and blank lines)
    const cleanedTemplate = template
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('//') && 
               !trimmed.startsWith('*') &&
               trimmed !== '';
      })
      .join('\n')
      .trim();
    
    // Prepare placeholders with ONLY Step 1 data + available templates
    const placeholders = {
      PROJECT_TITLE: storyInput.title,
      PROJECT_LOGLINE: storyInput.logline,
      PROJECT_CHARACTERS: storyInput.characters || 'No characters specified',
      INFLUENCE_PROMPT: storyInput.influencePrompt || '',
      AVAILABLE_TEMPLATES: this._formatTemplatesForAnalysis(availableTemplates)
    };
    
    // Replace placeholders
    let result = cleanedTemplate;
    for (const [key, value] of Object.entries(placeholders)) {
      const placeholder = `{{${key}}}`;
      const replacementValue = String(value || '');
      result = result.split(placeholder).join(replacementValue);
    }
    
    return result;
  }

  /**
   * Make the API request to get analysis
   * @private
   */
  async _makeAnalysisRequest(analysisPrompt) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.content[0].text;
    
    console.log('📊 Raw analysis response:', analysisText);
    
    return this._parseAnalysisResponse(analysisText);
  }

  /**
   * Parse the AI response into structured data
   * @private
   */
  _parseAnalysisResponse(analysisText) {
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse analysis JSON:', parseError);
      throw new Error('Failed to parse AI analysis response');
    }
  }

  // FUTURE EXPANSION METHODS - Ready to implement

  /**
   * Analyze character development potential
   * @param {Array} characters - Character data
   * @param {Object} storyContext - Story context for character analysis
   */
  async analyzeCharacters(characters, storyContext) {
    // TODO: Implement character-specific analysis
    throw new Error('Character analysis not yet implemented');
  }

  /**
   * Analyze tone consistency across story elements
   * @param {Object} toneData - Tone and mood data
   * @param {Object} storyElements - Story elements to check against
   */
  async analyzeToneConsistency(toneData, storyElements) {
    // TODO: Implement tone analysis
    throw new Error('Tone analysis not yet implemented');
  }

  /**
   * Analyze creative influences for coherence
   * @param {Object} influences - Director, screenwriter, film influences
   */
  async analyzeInfluenceCoherence(influences) {
    // TODO: Implement influence analysis
    throw new Error('Influence analysis not yet implemented');
  }

  /**
   * Apply AI suggestions to improve story concept
   * @param {Object} storyInput - Current story data
   * @param {Object} analysisResult - AI feedback with suggestions
   * @returns {Object} Proposed story improvements
   */
  async applyStorySuggestions(storyInput, analysisResult) {
    try {
      console.log('🔄 Applying AI suggestions to story concept:', storyInput.title);
      
      const improvementPrompt = this._buildImprovementPrompt(storyInput, analysisResult);
      const improvements = await this._makeImprovementRequest(improvementPrompt);
      
      console.log('✅ Story improvements generated');
      
      return {
        success: true,
        improvements: improvements,
        originalStory: storyInput,
        metadata: {
          improvementType: 'story_concept_enhancement',
          timestamp: new Date().toISOString(),
          model: this.model
        }
      };

    } catch (error) {
      console.error('Error applying story suggestions:', error);
      throw new Error(`Story improvement failed: ${error.message}`);
    }
  }

  /**
   * Build improvement prompt for applying suggestions
   * @private
   */
  _buildImprovementPrompt(storyInput, analysisResult) {
    const suggestions = analysisResult.suggestions || [];
    const criticalWeaknesses = analysisResult.criticalWeaknesses || [];
    const characterIssues = analysisResult.characterAnalysis?.feedback || '';
    
    return `You are an expert story development consultant. Your task is to take AI feedback and transform it into specific, actionable improvements to the story concept.

CURRENT STORY:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Characters: ${storyInput.characters || 'No characters specified'}

AI FEEDBACK TO ADDRESS:
Suggestions: ${suggestions.join('; ')}
Critical Weaknesses: ${criticalWeaknesses.join('; ')}
Character Issues: ${characterIssues}

TASK: Provide specific improvements to the story fields. Preserve the user's creative voice while addressing the feedback. Focus on concrete additions and clarifications, not complete rewrites.

Return ONLY valid JSON in this exact format:
{
  "improvedTitle": "enhanced title if needed, or original title",
  "improvedLogline": "enhanced logline with specific improvements",
  "improvedCharacters": "enhanced character descriptions with specific traits and backstories",
  "changesSummary": [
    "Specific change 1 and why it helps AI generation",
    "Specific change 2 and why it helps AI generation"
  ],
  "preservedElements": [
    "Original elements that were kept and why they work"
  ]
}

Guidelines:
- Add specific visual details, character backstories, or world-building elements
- Address vague elements with concrete specifics
- Preserve the original tone and creative vision
- Focus on elements that will help AI generate better content
- Be surgical in changes - improve don't overhaul`;
  }

  /**
   * Make API request for story improvements
   * @private
   */
  async _makeImprovementRequest(improvementPrompt) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2500,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: improvementPrompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Improvement API call failed: ${response.status}`);
    }

    const data = await response.json();
    const improvementText = data.content[0].text;
    
    console.log('📊 Raw improvement response:', improvementText);
    
    return this._parseImprovementResponse(improvementText);
  }

  /**
   * Parse improvement response into structured data
   * @private
   */
  _parseImprovementResponse(improvementText) {
    try {
      const jsonMatch = improvementText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in improvement response');
      }
    } catch (parseError) {
      console.error('Failed to parse improvement JSON:', parseError);
      throw new Error('Failed to parse AI improvement response');
    }
  }

  /**
   * Suggest improvements based on analysis
   * @param {Object} analysisResults - Previous analysis results
   */
  async suggestImprovements(analysisResults) {
    // TODO: Implement improvement suggestions
    throw new Error('Improvement suggestions not yet implemented');
  }

  /**
   * Load available story structure templates
   * @private
   */
  _loadAvailableTemplates() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const templatesDir = path.join(__dirname, 'templates');
      const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));
      
      const templates = [];
      templateFiles.forEach(file => {
        try {
          const templatePath = path.join(templatesDir, file);
          const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
          templates.push({
            id: file.replace('.json', ''),
            name: templateData.name,
            description: templateData.description,
            category: templateData.category || 'other',
            structure: Object.keys(templateData.structure || {}).map(key => ({
              key: key,
              name: templateData.structure[key].name,
              description: templateData.structure[key].description
            }))
          });
        } catch (error) {
          console.warn(`Failed to load template ${file}:`, error);
        }
      });
      
      return templates;
    } catch (error) {
      console.warn('Failed to load templates directory:', error);
      return [];
    }
  }

  /**
   * Format templates for AI analysis
   * @private
   */
  _formatTemplatesForAnalysis(templates) {
    if (!templates || templates.length === 0) {
      return 'No templates available';
    }

    return templates.map(template => {
      const structureSummary = template.structure.map(act => `${act.name}: ${act.description}`).join('; ');
      return `${template.name} (${template.category}) - ${template.description}. Structure: ${structureSummary}`;
    }).join('\n\n');
  }
}

module.exports = AIFeedbackSystem; 