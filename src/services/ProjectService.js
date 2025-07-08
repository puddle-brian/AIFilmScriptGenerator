class ProjectService {
  constructor(databaseService, logger = console) {
    this.db = databaseService;
    this.logger = logger;
  }

  // ==================================================
  // PROJECT LISTING & LOADING
  // ==================================================

  async listUserProjects(username) {
    try {
      this.logger.log(`📊 Loading projects for user: ${username}`);
      
      // Get user ID first
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        this.logger.log(`⚠️ User "${username}" not found in database`);
        return [];
      }
      
      const userId = userResult.rows[0].id;
      
      // Get all projects for this user
      const projects = await this.db.getUserProjects(userId);
      const projectList = [];
      
      for (const row of projects.rows) {
        try {
          const projectContext = this.parseProjectContext(row.project_context);
          
          if (projectContext.storyInput) {
            projectList.push({
              path: row.project_name,
              title: projectContext.storyInput.title,
              tone: projectContext.storyInput.tone,
              totalScenes: projectContext.storyInput.totalScenes,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              logline: projectContext.storyInput.logline,
              source: 'database',
              thumbnail_data: row.thumbnail_data
            });
          }
        } catch (error) {
          this.logger.log(`Skipping invalid project: ${row.project_name}`, error.message);
        }
      }
      
      // Sort by last updated date, newest first
      projectList.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      
      this.logger.log(`✅ Loaded ${projectList.length} projects from database for user: ${username}`);
      return projectList;
      
    } catch (error) {
      this.logger.error('Error listing user projects:', error);
      throw error;
    }
  }

  async loadProject(username, projectPath) {
    try {
      this.logger.log(`🔍 Loading project "${projectPath}" for user "${username}"`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Load project from database
      const projectResult = await this.db.getProject(userId, projectPath);
      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      const dbProject = projectResult.rows[0];
      const projectContext = this.parseProjectContext(dbProject.project_context);
      
      // Fix template and structure key order if needed
      if (projectContext.templateData && projectContext.generatedStructure) {
        const templateId = projectContext.selectedTemplate || projectContext.templateData.id;
        if (templateId) {
          this.logger.log(`🔧 Fixed template and structure key order for project: ${templateId}`);
        }
      }
      
      this.logger.log(`✅ Loaded unified project from database: "${projectContext.storyInput?.title || projectPath}"`);
      
      // Return in the expected format
      return {
        projectPath: projectPath,
        projectId: projectContext.projectId,
        storyInput: projectContext.storyInput,
        selectedTemplate: projectContext.selectedTemplate,
        templateData: projectContext.templateData,
        generatedStructure: projectContext.generatedStructure,
        plotPoints: projectContext.plotPoints,
        generatedScenes: projectContext.generatedScenes,
        generatedDialogues: projectContext.generatedDialogues,
        influences: projectContext.influences,
        projectCharacters: projectContext.projectCharacters,
        creativeDirections: projectContext.creativeDirections || {},
        globalCreativeDirections: projectContext.globalCreativeDirections || {
          plotPoints: "",
          scenes: "",
          dialogue: ""
        },
        currentStep: projectContext.currentStep,
        generatedAt: dbProject.created_at,
        updatedAt: dbProject.updated_at
      };
      
    } catch (error) {
      this.logger.error(`Error loading project ${projectPath}:`, error);
      throw error;
    }
  }

  // ==================================================
  // PROJECT SAVING & AUTO-SAVE
  // ==================================================

  async saveProject(username, projectName, projectContext, thumbnailData = null) {
    try {
      this.logger.log(`💾 Saving project "${projectName}" for user "${username}"`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Save project using DatabaseService
      const result = await this.db.saveProject(userId, projectName, projectContext, thumbnailData);
      
      this.logger.log(`✅ Project saved successfully: "${projectName}"`);
      return result;
      
    } catch (error) {
      this.logger.error(`Error saving project ${projectName}:`, error);
      throw error;
    }
  }

  async autoSaveProject(requestBody) {
    try {
      const { 
        storyInput, 
        selectedTemplate, 
        templateData, 
        generatedStructure, 
        plotPoints, 
        generatedScenes, 
        generatedDialogues, 
        influences, 
        projectCharacters, 
        currentStep,
        username,
        existingProjectPath,
        creativeDirections,
        globalCreativeDirections
      } = requestBody;
      
      let projectPath = existingProjectPath;
      let isNewProject = false;
      
      // Generate project path if this is a new project
      if (!projectPath && storyInput?.title) {
        projectPath = await this.generateProjectPath(storyInput.title);
        isNewProject = true;
        this.logger.log(`🆕 Creating new project: ${projectPath}`);
      } else if (projectPath) {
        this.logger.log(`♻️ Auto-saving existing project: ${projectPath}`);
      } else {
        throw new Error('Cannot determine project path - missing title or existing path');
      }
      
      // Build unified project context
      const projectContext = {
        projectId: projectPath,
        storyInput,
        selectedTemplate,
        templateData,
        generatedStructure,
        plotPoints,
        generatedScenes,
        generatedDialogues,
        influences,
        projectCharacters,
        creativeDirections: creativeDirections || {},
        globalCreativeDirections: globalCreativeDirections || {
          plotPoints: "",
          scenes: "",
          dialogue: ""
        },
        currentStep: currentStep || 1,
        generatedAt: new Date().toISOString(),
        projectPath
      };
      
      // Generate thumbnail data for progress tracking
      const thumbnailData = this.generateThumbnailData(projectContext);
      
      // Save the project
      await this.saveProject(username, projectPath, projectContext, thumbnailData);
      
      const message = isNewProject 
        ? `✅ New project created in unified v2.0 format: "${storyInput.title}"`
        : `✅ Auto-saved project in unified v2.0 format: "${storyInput.title}"`;
      
      this.logger.log(message);
      
      return {
        projectPath,
        projectId: projectPath,
        message: isNewProject ? 'Project created successfully' : 'Project auto-saved successfully',
        isNewProject
      };
      
    } catch (error) {
      this.logger.error('Error in auto-save:', error);
      throw error;
    }
  }

  // ==================================================
  // PROJECT UTILITIES
  // ==================================================

  async generateProjectPath(title) {
    // Create URL-friendly project name
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    // Add timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `${cleanTitle}_${timestamp}`;
  }

  generateThumbnailData(projectContext) {
    return {
      title: projectContext.storyInput?.title || 'Untitled',
      tone: projectContext.storyInput?.tone || '',
      currentStep: projectContext.currentStep || 1,
      hasStructure: !!projectContext.generatedStructure,
      hasScenes: !!projectContext.generatedScenes,
      hasDialogue: !!projectContext.generatedDialogues,
      sceneCount: projectContext.storyInput?.totalScenes || 0,
      updatedAt: new Date().toISOString()
    };
  }

  parseProjectContext(projectContextRaw) {
    if (!projectContextRaw) return {};
    
    // Handle both string and object formats
    if (typeof projectContextRaw === 'string') {
      try {
        return JSON.parse(projectContextRaw);
      } catch (error) {
        this.logger.error('Error parsing project context JSON:', error);
        return {};
      }
    }
    
    return projectContextRaw;
  }

  // ==================================================
  // PROJECT MANAGEMENT OPERATIONS
  // ==================================================

  async deleteProject(username, projectName) {
    try {
      this.logger.log(`🗑️ Deleting project "${projectName}" for user "${username}"`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Delete project from database
      const result = await this.db.deleteProject(userId, projectName);
      
      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      this.logger.log(`✅ Project deleted successfully: "${projectName}"`);
      return { success: true, message: 'Project deleted successfully' };
      
    } catch (error) {
      this.logger.error(`Error deleting project ${projectName}:`, error);
      throw error;
    }
  }

  async duplicateProject(username, projectName) {
    try {
      this.logger.log(`📋 Duplicating project "${projectName}" for user "${username}"`);
      
      // Get user ID for versioning function
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      const userId = userResult.rows[0].id;
      
      // Load the original project
      const originalProject = await this.loadProject(username, projectName);
      
      // Generate versioned project name (e.g., original_project_V02)
      const { generateVersionedProjectName } = require('../utils/UtilityFunctions');
      const newProjectName = await generateVersionedProjectName(userId, projectName, this.db);
      
      // Extract version number from new project name for title
      const versionMatch = newProjectName.match(/V(\d+)$/);
      const versionNumber = versionMatch ? versionMatch[1] : '02';
      
      // Create versioned title - STRIP existing version number first
      const originalTitle = originalProject.storyInput?.title || 'Untitled Project';
      
      // 🔧 FIX: Remove existing version number from title before adding new one
      // This prevents "Title V02 V03" and ensures clean "Title V03"
      const baseTitleMatch = originalTitle.match(/^(.+?)\s+V\d+$/);
      const baseTitle = baseTitleMatch ? baseTitleMatch[1] : originalTitle;
      
      const versionedTitle = `${baseTitle} V${versionNumber}`;
      
      // Create new project context with updated IDs, name, and versioned title
      const duplicateContext = {
        ...originalProject,
        projectId: newProjectName,
        projectPath: newProjectName,
        storyInput: {
          ...originalProject.storyInput,
          title: versionedTitle
        },
        generatedAt: new Date().toISOString()
      };
      
      // Generate thumbnail data with versioned title
      const thumbnailData = this.generateThumbnailData(duplicateContext);
      
      // Save the duplicate with proper thumbnail data
      await this.saveProject(username, newProjectName, duplicateContext, thumbnailData);
      
      this.logger.log(`✅ Project duplicated successfully: "${versionedTitle}"`);
      
      return {
        success: true,
        new_project_name: newProjectName,
        new_project_title: versionedTitle,
        message: 'Project duplicated successfully'
      };
      
    } catch (error) {
      this.logger.error(`Error duplicating project ${projectName}:`, error);
      throw error;
    }
  }
}

module.exports = ProjectService; 