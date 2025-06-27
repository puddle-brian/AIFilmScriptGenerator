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
    // TEMPORARY: Always reload templates to avoid caching issues during development
    // TODO: Re-enable caching in production
    // if (templateCache[templateName]) {
    //     return templateCache[templateName];
    // }
    
    try {
        // Build the path to the template file
        const templatePath = path.join(__dirname, 'prompts', `${templateName}.txt`);
        
        // Read the template file fresh every time (for now)
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        
        // Cache it for next time (disabled for now)
        templateCache[templateName] = templateContent;
        
        console.log(`🔄 Loaded template: ${templateName}.txt (${templateContent.length} chars)`);
        
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
 * GENERATE STRUCTURE DESCRIPTION
 * Creates a detailed description of the template structure for AI generation
 */
function generateStructureDescription(templateData) {
    if (!templateData || !templateData.structure) {
        return "Standard narrative structure with clear beginning, middle, and end.";
    }
    
    let description = `${templateData.name} Structure:\n`;
    
    // Build description based on template structure
    const structureKeys = Object.keys(templateData.structure);
    description += `This template consists of ${structureKeys.length} major structural elements:\n`;
    
    structureKeys.forEach((key, index) => {
        const element = templateData.structure[key];
        description += `${index + 1}. ${element.name || key}: ${element.description || 'A key structural element'}\n`;
    });
    
    return description;
}

/**
 * STRUCTURE GENERATION PROMPT BUILDER
 * Builds prompts for generating story structure (acts, themes, progression)
 */
function buildStructurePrompt(storyInput, templateData) {
    // Load the structure generation template
    const template = loadTemplate('structure-generation');
    
    // Generate detailed description of the template structure
    const structureDescription = generateStructureDescription(templateData);
    
    // Prepare placeholders with actual project data
    const placeholders = {
        PROJECT_TITLE: storyInput.title,
        PROJECT_LOGLINE: storyInput.logline,
        PROJECT_CHARACTERS: storyInput.characters,
        TEMPLATE_NAME: templateData.name,
        INFLUENCE_PROMPT: storyInput.influencePrompt || '',
        STRUCTURE_DESCRIPTION: structureDescription,
        TEMPLATE_STRUCTURE: JSON.stringify(templateData.structure, null, 2)
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * PLOT POINTS GENERATION PROMPT BUILDER
 * Builds prompts for generating plot points that break down story acts
 */
function buildPlotPointsPrompt(hierarchicalContext, plotPointCount = 4, finalSceneCount = 14, options = {}) {
    // Load the plot points generation template  
    const template = loadTemplate('plot-points-generation');
    
    // Generate dynamic JSON examples based on plot point count with BUT/THEREFORE logic
    const dynamicExamples = [];
    for (let i = 1; i <= plotPointCount; i++) {
        if (i === 1) {
            dynamicExamples.push(`    "Plot point ${i} that establishes the situation for this act"`);
        } else if (i % 2 === 0) {
            // Even numbers use "But" for conflict/complications
            dynamicExamples.push(`    "But plot point ${i} that introduces conflict or complication"`);
        } else {
            // Odd numbers (except 1) use "Therefore" for consequences/progress
            dynamicExamples.push(`    "Therefore plot point ${i} that shows consequence or progress"`);
        }
    }
    const exampleArray = dynamicExamples.join(',\n');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        HIERARCHICAL_CONTEXT: hierarchicalContext || '',
        PLOT_POINT_COUNT: plotPointCount,
        FINAL_SCENE_COUNT: finalSceneCount,
        CUSTOM_INSTRUCTIONS: options.customInstructions || '',
        DYNAMIC_EXAMPLES: exampleArray
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * SCENE GENERATION PROMPT BUILDER  
 * Builds prompts for generating multiple scenes based on hierarchical context
 */
function buildScenePrompt(hierarchicalContext, sceneCount = 3, options = {}) {
    // Load the scene generation template
    const template = loadTemplate('scene-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        HIERARCHICAL_CONTEXT: hierarchicalContext || '',
        SCENE_COUNT: sceneCount,
        CUSTOM_INSTRUCTIONS: options.customInstructions || ''
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * INDIVIDUAL SCENE GENERATION PROMPT BUILDER  
 * Builds prompts for generating a single scene (regeneration)
 */
function buildIndividualScenePrompt(hierarchicalContext, options = {}) {
    // Load the individual scene generation template
    const template = loadTemplate('individual-scene-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        HIERARCHICAL_CONTEXT: hierarchicalContext || '',
        CUSTOM_INSTRUCTIONS: options.customInstructions || ''
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * DIALOGUE GENERATION PROMPT BUILDER
 * Builds prompts for writing screenplay dialogue for scenes
 * Can handle both hierarchical context and simple fallback approaches
 */
function buildDialoguePrompt(hierarchicalContext, sceneContent, additionalContext = '', options = {}) {
    // Load the dialogue generation template
    const template = loadTemplate('dialogue-generation');
    
    // Prepare placeholders with actual project data
    const placeholders = {
        HIERARCHICAL_CONTEXT: hierarchicalContext || '',
        SCENE_CONTENT: typeof sceneContent === 'object' ? JSON.stringify(sceneContent, null, 2) : sceneContent,
        ADDITIONAL_CONTEXT: additionalContext || 'None provided'
    };
    
    // Replace placeholders and return the complete prompt
    return replacePlaceholders(template, placeholders);
}

/**
 * DIALOGUE GENERATION PROMPT BUILDER (SIMPLE VERSION)
 * Builds basic dialogue prompts when hierarchical context is not available
 */
function buildSimpleDialoguePrompt(storyInput, sceneContent, additionalContext = '') {
    // Create a simple story context when hierarchical context isn't available
    const simpleContext = `Write full screenplay dialogue for this scene:

Story Context:
- Title: ${storyInput?.title || 'Untitled'}
- Characters: ${storyInput?.characters || 'Not specified'}`;
    
    return buildDialoguePrompt(simpleContext, sceneContent, additionalContext);
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
    buildIndividualScenePrompt,
    buildDialoguePrompt,
    buildSimpleDialoguePrompt,
    validateTemplates,
    clearTemplateCache
}; 