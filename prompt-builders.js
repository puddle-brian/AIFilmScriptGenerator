/**
 * PROMPT BUILDERS MODULE
 * 
 * This module provides shared prompt building functions that both generation 
 * and preview endpoints use. This ensures that previews show exactly what 
 * gets sent to the AI - no more "prompt drift" issues!
 * 
 * HOW IT WORKS:
 * 1. Loads prompt templates from the prompts/ directory
 * 2. Replaces {{PLACEHOLDERS}} with actual project data
 * 3. Returns the complete prompt ready for AI or preview
 * 
 * FOR NON-PROGRAMMERS:
 * - Edit the .txt files in the prompts/ directory to change prompts
 * - Keep the {{PLACEHOLDER}} format intact 
 * - This code handles the technical stuff automatically
 */

const fs = require('fs');
const path = require('path');

/**
 * TEMPLATE LOADER
 * Loads a prompt template file and caches it for performance
 */
const templateCache = {};

function loadTemplate(templateName) {
    // If we've already loaded this template, use the cached version
    if (templateCache[templateName]) {
        return templateCache[templateName];
    }
    
    try {
        // Build the path to the template file
        const templatePath = path.join(__dirname, 'prompts', `${templateName}.txt`);
        
        // Read the template file
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        
        // Cache it for next time (improves performance)
        templateCache[templateName] = templateContent;
        
        return templateContent;
    } catch (error) {
        console.error(`❌ Failed to load template: ${templateName}.txt`);
        console.error('Error:', error.message);
        throw new Error(`Template not found: ${templateName}.txt`);
    }
}

/**
 * PLACEHOLDER REPLACER
 * Takes a template and replaces {{PLACEHOLDERS}} with actual values
 */
function replacePlaceholders(template, placeholders) {
    let result = template;
    
    // Go through each placeholder and replace it
    for (const [key, value] of Object.entries(placeholders)) {
        // Create the placeholder pattern: {{KEY}}
        const placeholder = `{{${key}}}`;
        
        // Replace all instances of this placeholder with the actual value
        // Handle both strings and objects (JSON.stringify for objects)
        const replacementValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '');
        result = result.split(placeholder).join(replacementValue);
    }
    
    return result;
}

/**
 * STRUCTURE GENERATION PROMPT BUILDER
 * Builds prompts for generating story structure (acts, themes, progression)
 */
function buildStructurePrompt(storyInput, templateData) {
    // Load the structure generation template
    const template = loadTemplate('structure-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        PROJECT_TITLE: storyInput.title,
        PROJECT_LOGLINE: storyInput.logline,
        PROJECT_CHARACTERS: storyInput.characters,
        PROJECT_TONE: storyInput.tone,
        TOTAL_SCENES: storyInput.totalScenes,
        TEMPLATE_NAME: templateData.name,
        TEMPLATE_DESCRIPTION: templateData.description,
        INFLUENCE_PROMPT: storyInput.influencePrompt || '',
        DIRECTORIAL_INFLUENCES: storyInput.influences?.directors?.join(', ') || '',
        SCREENWRITING_INFLUENCES: storyInput.influences?.screenwriters?.join(', ') || '',
        FILM_INFLUENCES: storyInput.influences?.films?.join(', ') || ''
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * PLOT POINTS GENERATION PROMPT BUILDER
 * Builds prompts for generating plot points that break down story acts
 */
function buildPlotPointsPrompt(projectContext, actKey, actData, options = {}) {
    // Load the plot points generation template  
    const template = loadTemplate('plot-points-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        PROJECT_TITLE: projectContext.title,
        PROJECT_LOGLINE: projectContext.logline,
        PROJECT_CHARACTERS: projectContext.characters,
        PROJECT_TONE: projectContext.tone,
        TOTAL_SCENES: projectContext.totalScenes,
        TEMPLATE_NAME: projectContext.templateData?.name || 'Unknown Template',
        ACT_KEY: actKey,
        ACT_NAME: actData.name,
        ACT_DESCRIPTION: actData.description,
        ACT_KEY_EVENTS: Array.isArray(actData.key_events) ? actData.key_events.join('\n- ') : actData.key_events,
        ACT_CHARACTER_DEVELOPMENT: actData.character_development || actData.character_developments || '',
        SCENES_PER_ACT: options.scenesPerAct || Math.ceil(projectContext.totalScenes / Object.keys(projectContext.generatedStructure || {}).length),
        PREVIOUS_ACTS_CONTEXT: options.previousActsContext || '',
        HIERARCHICAL_CONTEXT: options.hierarchicalContext || ''
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * SCENE GENERATION PROMPT BUILDER  
 * Builds prompts for generating individual scenes based on plot points
 */
function buildScenePrompt(projectContext, sceneData, options = {}) {
    // Load the scene generation template
    const template = loadTemplate('scene-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        PROJECT_TITLE: projectContext.title,
        PROJECT_LOGLINE: projectContext.logline,
        PROJECT_CHARACTERS: projectContext.characters,
        PROJECT_TONE: projectContext.tone,
        SCENE_ACT: sceneData.actName || options.actName,
        SCENE_DESCRIPTION: sceneData.description || sceneData.assignedPlotPoint,
        SCENE_CHARACTER_DEVELOPMENT: sceneData.character_development || sceneData.characterDevelopment || '',
        SCENE_POSITION: sceneData.position || options.sceneIndex + 1,
        TOTAL_SCENES_IN_ACT: sceneData.totalInAct || options.totalScenesInAct,
        PREVIOUS_SCENES_SUMMARY: options.previousScenesContext || '',
        PLOT_POINT_INDEX: sceneData.plotPointIndex || options.plotPointIndex,
        ASSIGNED_PLOT_POINT: sceneData.assignedPlotPoint || '',
        HIERARCHICAL_CONTEXT: options.hierarchicalContext || '',
        CUSTOM_INSTRUCTIONS: options.customInstructions || ''
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * DIALOGUE GENERATION PROMPT BUILDER
 * Builds prompts for writing screenplay dialogue for scenes
 */
function buildDialoguePrompt(projectContext, sceneContent, options = {}) {
    // Load the dialogue generation template
    const template = loadTemplate('dialogue-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        PROJECT_TITLE: projectContext.title,
        PROJECT_LOGLINE: projectContext.logline,
        PROJECT_CHARACTERS: projectContext.characters,
        PROJECT_TONE: projectContext.tone,
        SCENE_CONTENT: sceneContent,
        CHARACTER_PROFILES: options.characterProfiles || projectContext.characters,
        DIALOGUE_STYLE: options.dialogueStyle || 'natural and character-specific',
        SCENE_CONTEXT: options.sceneContext || '',
        PREVIOUS_DIALOGUE_CONTEXT: options.previousDialogueContext || '',
        HIERARCHICAL_CONTEXT: options.hierarchicalContext || '',
        CUSTOM_INSTRUCTIONS: options.customInstructions || ''
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * TEMPLATE VALIDATION
 * Checks if all required template files exist
 */
function validateTemplates() {
    const requiredTemplates = [
        'structure-generation',
        'plot-points-generation', 
        'scene-generation',
        'dialogue-generation'
    ];
    
    const missingTemplates = [];
    
    for (const templateName of requiredTemplates) {
        try {
            loadTemplate(templateName);
        } catch (error) {
            missingTemplates.push(`${templateName}.txt`);
        }
    }
    
    if (missingTemplates.length > 0) {
        console.error('❌ Missing template files:', missingTemplates);
        return false;
    }
    
    console.log('✅ All prompt templates loaded successfully');
    return true;
}

/**
 * CLEAR TEMPLATE CACHE
 * Clears the template cache (useful for development/testing)
 */
function clearTemplateCache() {
    Object.keys(templateCache).forEach(key => delete templateCache[key]);
    console.log('🧹 Template cache cleared');
}

// Export all the functions for use in server.js
module.exports = {
    buildStructurePrompt,
    buildPlotPointsPrompt,
    buildScenePrompt,
    buildDialoguePrompt,
    validateTemplates,
    clearTemplateCache
}; 