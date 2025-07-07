const express = require('express');
const router = express.Router();

// Import authentication middleware
const { authenticateApiKey, checkCredits } = require('../middleware/auth');

// Middleware to inject dependencies from app
router.use((req, res, next) => {
  req.dbClient = req.app.get('dbClient');
  req.projectService = req.app.get('projectService');
  req.parseProjectContext = req.app.get('parseProjectContext');
  req.authenticateApiKey = authenticateApiKey;
  req.checkCredits = checkCredits;
  
  next();
});

// Fallback project listing handler (when ProjectService is unavailable)
async function handleListProjectsFallback(req, res, dbClient, parseProjectContext) {
  const username = req.query.username || 'guest';
  
  try {
    console.log(`🔄 Fallback project listing for user: ${username}`);
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.json([]); // Return empty array if user not found
    }
    
    const userId = userResult.rows[0].id;
    
    // Get projects from database
    const projectResult = await dbClient.query(
      'SELECT project_name, project_context, created_at, updated_at FROM user_projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    
    // Parse and format projects
    const projects = projectResult.rows.map(dbProject => {
      try {
        const projectContext = parseProjectContext(dbProject.project_context);
        return {
          projectId: projectContext.projectId || dbProject.project_name,
          projectName: dbProject.project_name,
          title: projectContext.storyInput?.title || dbProject.project_name,
          genre: projectContext.storyInput?.genre || 'Unknown',
          template: projectContext.selectedTemplate?.name || 'Unknown',
          createdAt: dbProject.created_at,
          updatedAt: dbProject.updated_at,
          currentStep: projectContext.currentStep || 1,
          progress: calculateProjectProgress(projectContext)
        };
      } catch (parseError) {
        console.error(`Error parsing project ${dbProject.project_name}:`, parseError);
        return {
          projectId: dbProject.project_name,
          projectName: dbProject.project_name,
          title: dbProject.project_name,
          genre: 'Unknown',
          template: 'Unknown',
          createdAt: dbProject.created_at,
          updatedAt: dbProject.updated_at,
          currentStep: 1,
          progress: 0
        };
      }
    });
    
    console.log(`✅ Fallback project listing completed: ${projects.length} projects`);
    
    res.json(projects);
    
  } catch (error) {
    console.error('Fallback project listing error:', error);
    // Return empty array instead of error to prevent frontend issues
    res.json([]);
  }
}

// Helper function to calculate project progress
function calculateProjectProgress(projectContext) {
  let progress = 0;
  if (projectContext.storyInput) progress += 20;
  if (projectContext.selectedTemplate) progress += 20;
  if (projectContext.generatedStructure) progress += 20;
  if (projectContext.plotPoints && projectContext.plotPoints.length > 0) progress += 20;
  if (projectContext.generatedScenes && projectContext.generatedScenes.length > 0) progress += 20;
  return progress;
}

// =====================================
// PROJECT MANAGEMENT ROUTES
// =====================================

// 🆕 MIGRATED: Auto-save project using ProjectService (Phase 2C)
router.post('/auto-save-project', async (req, res) => {
  try {
    // Get services from app-level dependency injection
    const projectService = req.app.get('projectService');
    
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
router.post('/save-project', async (req, res) => {
  try {
    console.log('⚠️ Legacy /api/save-project called - redirecting to auto-save');
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    const projectData = req.body;
    const username = projectData.username || 'guest';
    
    // Generate project name from path or title
    const projectPath = projectData.projectPath || 
      (projectData.storyInput?.title ? 
        `${projectData.storyInput.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}` :
        `untitled_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`);
    
    // Create unified project context in v2.0 format
    const { v4: uuidv4 } = require('uuid');
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
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
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
router.get('/list-projects', async (req, res) => {
  try {
    // Get services from app-level dependency injection
    const projectService = req.app.get('projectService');
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    // Fallback to direct database access if ProjectService unavailable
    if (!projectService && dbClient && parseProjectContext) {
      console.log('🔄 Using fallback project listing (direct database access)');
      return await handleListProjectsFallback(req, res, dbClient, parseProjectContext);
    }
    
    // Ultimate fallback: return empty array if no services available
    if (!projectService && !dbClient) {
      console.log('⚠️ No services available - returning empty project list');
      return res.json([]);  // Return empty array instead of 503
    }

    const username = req.query.username || 'guest';
    
    console.log(`🆕 Using ProjectService to list projects for user: ${username}`);
    
    // Get projects using ProjectService - handles all database operations and parsing
    const projects = await projectService.listUserProjects(username);
    
    console.log(`✅ Project listing completed using ProjectService: ${projects.length} projects`);
    
    res.json(projects);
    
  } catch (error) {
    console.error('Error listing projects (migrated):', error);
    // Return empty array to prevent frontend issues
    res.json([]);
  }
});

// Load project (legacy endpoint - redirects to database)
router.get('/project/:id', async (req, res) => {
  try {
    // Authenticate user using imported middleware
    await authenticateApiKey(req, res, () => {});
    
    const projectId = req.params.id;
    const username = req.user.username; // Get from authenticated user
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    // Try to load from database first
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Look for project in database by project_name (assuming projectId = project_name)
      const projectResult = await dbClient.query(
        'SELECT project_name, project_context, created_at, updated_at FROM user_projects WHERE user_id = $1 AND project_name = $2',
        [userId, projectId]
      );
      
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
    
    res.status(404).json({ error: 'Project not found' });
    
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

// Load project by path
router.get('/load-project/:projectPath', async (req, res) => {
  try {
    const { projectPath } = req.params;
    const username = req.query.username || 'guest';
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    console.log(`Loading project from database: ${projectPath} for user: ${username}`);
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Load project from database
    const projectResult = await dbClient.query(
      'SELECT project_context, created_at, updated_at FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const dbProject = projectResult.rows[0];
    const projectContext = parseProjectContext(dbProject.project_context);
    
    console.log(`✅ Project loaded from database: "${projectContext.storyInput?.title || projectPath}"`);
    
    res.json({
      success: true,
      project: projectContext,
      message: 'Project loaded successfully from database',
      source: 'database',
      loadedAt: new Date().toISOString(),
      projectMetadata: {
        createdAt: dbProject.created_at,
        updatedAt: dbProject.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(500).json({ 
      error: 'Failed to load project', 
      details: error.message,
      projectPath: req.params.projectPath
    });
  }
});

// Load plot points for project
router.get('/load-plot-points/:projectPath', async (req, res) => {
  try {
    const { projectPath } = req.params;
    const username = req.query.username || 'guest';
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    console.log(`Loading plot points for project: ${projectPath}`);
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Load project from database
    const projectResult = await dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    const plotPoints = projectContext.plotPoints || {};
    
    console.log(`✅ Plot points loaded for project: ${projectPath} (${Object.keys(plotPoints).length} acts)`);
    
    res.json({
      success: true,
      plotPoints: plotPoints,
      projectPath: projectPath,
      loadedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error loading plot points:', error);
    res.status(500).json({ 
      error: 'Failed to load plot points', 
      details: error.message 
    });
  }
});

// =====================================
// USER PROJECT MANAGEMENT
// =====================================

// Get user projects
router.get('/user-projects/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    console.log(`📂 Loading projects for user: ${username}`);
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Get all projects for user
    const projectsResult = await dbClient.query(
      `SELECT project_name, thumbnail_data, created_at, updated_at 
       FROM user_projects 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [userId]
    );
    
    const projects = projectsResult.rows.map(row => ({
      projectName: row.project_name,
      thumbnail: JSON.parse(row.thumbnail_data || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    console.log(`✅ Found ${projects.length} projects for user: ${username}`);
    
    res.json({
      success: true,
      projects: projects,
      totalCount: projects.length,
      user: username
    });
    
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user projects',
      details: error.message 
    });
  }
});

// Create new project for user
router.post('/user-projects/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { projectName, initialData = {} } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    console.log(`📝 Creating new project for user: ${username}, project: ${projectName}`);
    
    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Create initial project context
    const { v4: uuidv4 } = require('uuid');
    const projectContext = {
      projectId: uuidv4(),
      projectPath: projectName,
      storyInput: initialData.storyInput || {},
      selectedTemplate: initialData.selectedTemplate,
      templateData: initialData.templateData,
      generatedStructure: {},
      plotPoints: {},
      generatedScenes: {},
      generatedDialogues: {},
      currentStep: 1,
      influences: {},
      projectCharacters: [],
      generatedAt: new Date().toISOString()
    };
    
    // Create thumbnail data
    const thumbnailData = {
      title: initialData.title || projectName,
      genre: initialData.genre || 'Unknown',
      tone: initialData.tone || '',
      structure: '',
      currentStep: 1,
      totalScenes: initialData.totalScenes || 70
    };
    
    // Save to database
    const result = await dbClient.query(
      `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
       VALUES ($1, $2, $3, $4) 
       RETURNING project_name, created_at`,
      [userId, projectName, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
    );
    
    console.log(`✅ Project created successfully: ${projectName} for user: ${username}`);
    
    res.json({
      success: true,
      projectName: result.rows[0].project_name,
      projectId: projectContext.projectId,
      createdAt: result.rows[0].created_at,
      message: 'Project created successfully'
    });
    
  } catch (error) {
    console.error('Error creating project:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ 
        error: 'Project with this name already exists',
        details: 'Please choose a different project name'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create project',
      details: error.message 
    });
  }
});

// Delete all projects for a user
router.delete('/users/:userId/projects', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    
    if (!dbClient) {
      throw new Error('Database client not available');
    }
    
    console.log(`🗑️ Deleting all projects for user ID: ${userId}`);
    
    // Delete all projects for the user
    const result = await dbClient.query(
      'DELETE FROM user_projects WHERE user_id = $1',
      [userId]
    );
    
    console.log(`✅ Deleted ${result.rowCount} projects for user ID: ${userId}`);
    
    res.json({
      success: true,
      deletedCount: result.rowCount,
      message: `Deleted ${result.rowCount} projects`
    });
    
  } catch (error) {
    console.error('Error deleting user projects:', error);
    res.status(500).json({ 
      error: 'Failed to delete projects',
      details: error.message 
    });
  }
});

// 🆕 MIGRATED: Duplicate project using ProjectService (Phase 2C)
router.post('/users/:userId/projects/duplicate', async (req, res) => {
  console.log('🔍 DUPLICATE ENDPOINT: Request received');
  console.log('🔍 DUPLICATE ENDPOINT: UserId:', req.params.userId);
  console.log('🔍 DUPLICATE ENDPOINT: Request body:', req.body);
  
  try {
    const { userId } = req.params;
    const { project_name } = req.body;
    
    console.log('🔍 DUPLICATE ENDPOINT: Extracted params:', { userId, project_name });
    
    if (!project_name) {
      console.log('🚨 DUPLICATE ENDPOINT: Missing project_name');
      return res.status(400).json({ 
        error: 'Original project name is required' 
      });
    }
    
    // Get ProjectService from app-level dependency injection
    const projectService = req.app.get('projectService');
    
    if (!projectService) {
      throw new Error('ProjectService not available');
    }
    
    // Get username from user ID
    const dbClient = req.app.get('dbClient');
    const userResult = await dbClient.query('SELECT username FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const username = userResult.rows[0].username;
    
    console.log(`🆕 Using ProjectService to duplicate project for user: ${username}, project: ${project_name}`);
    
    // Use ProjectService to handle all the complex duplication logic
    const result = await projectService.duplicateProject(username, project_name);
    
    console.log(`✅ Project duplication completed using ProjectService: "${result.new_project_title}"`);
    
    res.json({
      success: true,
      new_project_title: result.new_project_title,
      new_project_name: result.new_project_name,
      message: result.message
    });
    
  } catch (error) {
    console.error('Error duplicating project:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ 
        error: 'Project with this name already exists',
        details: 'Please choose a different project name'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to duplicate project',
      details: error.message 
    });
  }
});

// =====================================
// CONTENT EDITING ROUTES
// =====================================

// Save edited act content
router.put('/edit-content/acts/:projectPath/:actKey', async (req, res) => {
  try {
    // Authenticate user using imported middleware
    await authenticateApiKey(req, res, () => {});
    
    const { projectPath, actKey } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    // Load project data from database
    const username = req.user.username; // Get from authenticated user
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
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
    await dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );
    
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
router.put('/edit-content/plot-points/:projectPath/:actKey', async (req, res) => {
  try {
    // Authenticate user using imported middleware
    await authenticateApiKey(req, res, () => {});
    
    const { projectPath, actKey } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
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
    await dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );
    
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
router.put('/edit-content/scenes/:projectPath/:actKey/:sceneIndex', async (req, res) => {
  try {
    // Authenticate user using imported middleware
    await authenticateApiKey(req, res, () => {});
    
    const { projectPath, actKey, sceneIndex } = req.params;
    const { content } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
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
    await dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );
    
    console.log(`Scene ${sceneIndex} in ${actKey} updated successfully`);
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
router.put('/edit-content/dialogue/:projectPath/:actKey/:sceneIndex', async (req, res) => {
  try {
    // Authenticate user using imported middleware
    await authenticateApiKey(req, res, () => {});
    
    const { projectPath, actKey, sceneIndex } = req.params;
    const { content } = req.body;
    const sceneIndexNum = parseInt(sceneIndex);
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Get database client from app-level dependency injection
    const dbClient = req.app.get('dbClient');
    const parseProjectContext = req.app.get('parseProjectContext');
    
    if (!dbClient || !parseProjectContext) {
      throw new Error('Required services not available');
    }
    
    // Load project data from database
    const username = req.user.username;
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    const projectResult = await dbClient.query(
      'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectPath]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found in database' });
    }
    
    const projectContext = parseProjectContext(projectResult.rows[0].project_context);
    
    // Initialize dialogues structure if it doesn't exist
    if (!projectContext.generatedDialogues) {
      projectContext.generatedDialogues = {};
    }
    if (!projectContext.generatedDialogues[actKey]) {
      projectContext.generatedDialogues[actKey] = {};
    }
    
    // Get existing dialogue data
    const existingDialogue = projectContext.generatedDialogues[actKey][sceneIndexNum] || {};
    
    // Parse the new content
    let updatedDialogue;
    try {
      updatedDialogue = JSON.parse(content);
    } catch (e) {
      // If not valid JSON, treat as dialogue content
      updatedDialogue = {
        ...existingDialogue,
        dialogue: content
      };
    }
    
    const dialogueData = {
      ...existingDialogue,
      ...updatedDialogue,
      lastModified: new Date().toISOString()
    };
    
    // Update the specific dialogue
    projectContext.generatedDialogues[actKey][sceneIndexNum] = dialogueData;
    
    // Save back to database
    await dbClient.query(
      'UPDATE user_projects SET project_context = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND project_name = $3',
      [JSON.stringify(projectContext), userId, projectPath]
    );
    
    console.log(`Dialogue for scene ${sceneIndex} in ${actKey} updated successfully`);
    res.json({
      success: true,
      message: 'Dialogue updated successfully',
      updatedDialogue: dialogueData
    });
    
  } catch (error) {
    console.error('Error saving dialogue content:', error);
    res.status(500).json({ error: error.message || 'Failed to save dialogue content' });
  }
});

module.exports = {
  router
}; 