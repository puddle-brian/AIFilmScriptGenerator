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
   * @param {Object} templateData - Template data for structure generation
   * @param {string} projectPath - Optional project path for context
   * @returns {Object} Analysis results with scores and suggestions
   */
  async analyzeStoryConcept(storyInput, templateData, projectPath = null) {
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
        templateData: templateData,
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
    
    // Prepare placeholders with ONLY Step 1 data
    const placeholders = {
      PROJECT_TITLE: storyInput.title,
      PROJECT_LOGLINE: storyInput.logline,
      PROJECT_CHARACTERS: storyInput.characters || 'No characters specified',
      INFLUENCE_PROMPT: storyInput.influencePrompt || ''
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
   * Suggest improvements based on analysis
   * @param {Object} analysisResults - Previous analysis results
   */
  async suggestImprovements(analysisResults) {
    // TODO: Implement improvement suggestions
    throw new Error('Improvement suggestions not yet implemented');
  }
}

module.exports = AIFeedbackSystem; 