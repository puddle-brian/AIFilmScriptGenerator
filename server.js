const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Claude (Anthropic)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

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
          description: template.description
        });
      }
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error loading templates:', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Generate high-level plot structure
app.post('/api/generate-structure', async (req, res) => {
  try {
    console.log('Received structure generation request:', req.body);
    const { storyInput, template } = req.body;
    
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

    const prompt = `${influencePrompt}Based on the following story concept, generate a detailed plot structure using the ${templateData.name} format that embodies these artistic sensibilities:

Story Details:
- Title: ${storyInput.title}
- Logline: ${storyInput.logline}
- Main Characters: ${storyInput.characters}
- Tone: ${storyInput.tone}
- Target Scene Count: ${storyInput.totalScenes || 70} scenes${influencesSection}

Template Structure: ${JSON.stringify(templateData.structure, null, 2)}

Generate a detailed breakdown for each structural element. Each element should have:
- A clear title
- A 2-3 sentence description of what happens
- Key character developments
- Important plot points

Return the response as a valid JSON object with each structural element as a property. 

IMPORTANT: Your response must be ONLY valid JSON, with no additional text, markdown formatting, or explanations. Start with { and end with }.

Example format:
{
  "act1_setup": {
    "name": "Act 1: Setup",
    "description": "Description of what happens"
  },
  "act1_inciting_incident": {
    "name": "Inciting Incident", 
    "description": "Description of the incident"
  }
}`;

    console.log('Sending request to Claude API...');
    const completion = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      system: "You are a professional screenwriter and story structure expert. Generate detailed, engaging plot structures that follow the given template format. Always respond with valid JSON.",
      messages: [
        {
          role: "user",
          content: prompt
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

    res.json({
      structure: structureData,
      template: templateData,
      storyInput,
      projectId,
      projectPath: projectFolderName,
      savedLocally: true
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
      model: "claude-3-5-sonnet-20241022",
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
    const { scene, storyInput, context, projectPath } = req.body;
    
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
      model: "claude-3-5-sonnet-20241022",
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
    
    // Generate a simple scene breakdown with just one scene per structural element
    const scenesData = {};
    
    Object.entries(structure).forEach(([key, element], index) => {
      scenesData[key] = {
        scenes: [
          {
            scene_number: `${index + 1}`,
            title: element.name || key.replace(/_/g, ' '),
            location: "Location TBD",
            description: element.description || "Scene description TBD",
            characters: Array.isArray(storyInput.characters) ? storyInput.characters : [storyInput.characters || "Main Character"],
            emotional_beats: element.character_development ? [element.character_development] : ["TBD"]
          }
        ]
      };
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
    scenesOverview += `**Method:** Simple generation (1 scene per structural element)\n\n`;
    
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
      model: "claude-3-5-sonnet-20241022",
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

// Export final script
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
        } catch (error) {
          console.log('No scenes file found or error reading scenes');
        }
        
        // Load all dialogue files
        const dialogueDir = path.join(projectDir, '03_dialogue');
        let dialogueFiles = [];
        try {
          dialogueFiles = await fs.readdir(dialogueDir);
        } catch (error) {
          console.log('No dialogue directory found');
        }
        
        // Read all dialogue content
        const dialogueContent = [];
        for (const file of dialogueFiles) {
          if (file.endsWith('.txt')) {
            try {
              const content = await fs.readFile(path.join(dialogueDir, file), 'utf8');
              dialogueContent.push(content);
            } catch (error) {
              console.log(`Error reading dialogue file ${file}`);
            }
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
    
    // Assemble the full script
    let script = `${fullProjectData.storyInput.title}\n`;
    script += `Written by: [Author Name]\n\n`;
    script += `LOGLINE: ${fullProjectData.storyInput.logline}\n\n`;
    script += `GENRE: ${fullProjectData.storyInput.genre || fullProjectData.storyInput.tone || 'Drama'}\n\n`;
    script += `CHARACTERS: ${fullProjectData.storyInput.characters}\n\n`;
    script += `FADE IN:\n\n`;
    
    // Add structure overview if available
    if (fullProjectData.structure) {
      script += `=== STORY STRUCTURE ===\n\n`;
      Object.entries(fullProjectData.structure).forEach(([key, element]) => {
        script += `${element.name || key.replace(/_/g, ' ').toUpperCase()}\n`;
        script += `${element.description}\n\n`;
      });
      script += `\n`;
    }
    
    // Add scenes if available
    if (fullProjectData.scenes && fullProjectData.scenes.scenes) {
      script += `=== SCENES BREAKDOWN ===\n\n`;
      Object.entries(fullProjectData.scenes.scenes).forEach(([structureKey, structureScenes]) => {
        script += `${structureKey.replace(/_/g, ' ').toUpperCase()}\n\n`;
        if (structureScenes.scenes) {
          structureScenes.scenes.forEach((scene, index) => {
            script += `Scene ${scene.scene_number || index + 1}: ${scene.title}\n`;
            script += `Location: ${scene.location}\n`;
            script += `Characters: ${Array.isArray(scene.characters) ? scene.characters.join(', ') : scene.characters}\n\n`;
            script += `${scene.description}\n\n`;
            if (scene.emotional_beats) {
              script += `Emotional Beats: ${Array.isArray(scene.emotional_beats) ? scene.emotional_beats.join(', ') : scene.emotional_beats}\n\n`;
            }
            script += `---\n\n`;
          });
        }
      });
    }
    
    // Add all dialogue content
    if (fullProjectData.dialogueContent && fullProjectData.dialogueContent.length > 0) {
      script += `=== DIALOGUE SCENES ===\n\n`;
      fullProjectData.dialogueContent.forEach((dialogue, index) => {
        script += `${dialogue}\n\n`;
        script += `---\n\n`;
      });
    }
    
    script += `FADE OUT.\n\nTHE END`;
    
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
    
    if (format === 'json') {
      res.json({ script, fullProjectData });
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${fullProjectData.storyInput.title || 'script'}.txt"`);
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

// Start server
const startServer = async () => {
  await ensureDirectories();
  app.listen(PORT, () => {
    console.log(`Film Script Generator server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
  });
};

startServer().catch(console.error); 