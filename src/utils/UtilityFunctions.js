const fs = require('fs').promises;
const path = require('path');
const { DatabaseService } = require('../services/DatabaseService');

// Initialize database service for utility functions that need database access
const databaseService = new DatabaseService();

// Ensure directories exist (skip on Vercel serverless)
const ensureDirectories = async () => {
  // Skip directory creation on Vercel serverless environment
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.log('🔧 Skipping directory creation on serverless environment');
    return;
  }
  
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
async function generateStructureDescription(templateData) {
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
    
    // 🔧 FIX: Preserve original template order by loading the original template file
    let originalOrder = [];
    try {
      if (templateData.id) {
        const originalTemplatePath = path.join(__dirname, '../../templates', `${templateData.id}.json`);
        const originalTemplateContent = await fs.readFile(originalTemplatePath, 'utf8');
        const originalTemplate = JSON.parse(originalTemplateContent);
        if (originalTemplate.structure) {
          originalOrder = Object.keys(originalTemplate.structure);
        }
      }
    } catch (error) {
      console.log('Could not load original template for ordering, using current order');
      originalOrder = Object.keys(templateData.structure);
    }
    
    // Use original order if available, otherwise fall back to current order
    const keysToUse = originalOrder.length > 0 ? originalOrder : Object.keys(templateData.structure);
    
    keysToUse.forEach(key => {
      const act = templateData.structure[key];
      if (!act) return; // Skip if act doesn't exist in current structure
      
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

// Helper function to safely parse project context (handles both JSONB and TEXT storage)
function parseProjectContext(projectContextRaw) {
  return typeof projectContextRaw === 'string' ? JSON.parse(projectContextRaw) : projectContextRaw;
}

// Helper function to get response format instructions for each suggestion type
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

Respond with just the tone phrase, no quotes, no extra text.`;
    
    case 'character':
      return 'Respond with JSON in this exact format: {"name": "Character Name", "description": "Brief but compelling character description"}. The character should add depth, conflict, or enhancement to the existing story elements.';
    
    case 'storyconcept':
      return 'You must respond in this EXACT format:\n\nTitle: [Your Story Title]\nLogline: [One sentence premise describing the story]\n\nCreate something completely different from your previous suggestions. Avoid memory, time, dystopian, or supernatural themes. Focus on realistic human conflicts and relationships. Be creative and unexpected.\n\nDo not include any other text, explanations, or commentary. Just the title and logline as specified.';
    
    default:
      return 'Provide a helpful suggestion to enhance the story. Be specific and creative.';
  }
}

// Helper function to generate versioned project names
async function generateVersionedProjectName(userId, originalProjectName) {
  // Check if project name already has version suffix
  const versionMatch = originalProjectName.match(/^(.+?)_V(\d+)$/);
  const baseProjectName = versionMatch ? versionMatch[1] : originalProjectName;
  
  let versionNumber = 2; // Start with V02
  
  // If it already has a version, increment it
  if (versionMatch) {
    versionNumber = parseInt(versionMatch[2]) + 1;
  }
  
  // Find the next available version number
  while (true) {
    const versionString = versionNumber.toString().padStart(2, '0');
    const candidateName = `${baseProjectName}_V${versionString}`;
    
    // Check if this version already exists
    const existingResult = await databaseService.getProject(userId, candidateName);
    
    if (existingResult.rows.length === 0) {
      return candidateName;
    }
    
    versionNumber++;
    
    // Safety check to prevent infinite loop
    if (versionNumber > 99) {
      return `${baseProjectName}_V${Date.now()}`;
    }
  }
}

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

module.exports = {
  ensureDirectories,
  generateStructureDescription,
  parseProjectContext,
  getSuggestionResponseFormat,
  generateVersionedProjectName,
  getModelDescription
}; 