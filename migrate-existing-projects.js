const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function migrateExistingProjects() {
  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await dbClient.connect();
    console.log('✅ Connected to database');

    const generatedDir = path.join(__dirname, 'generated');
    
    // Get all project directories
    const projectDirs = await fs.readdir(generatedDir);
    console.log(`Found ${projectDirs.length} potential projects to migrate`);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(generatedDir, projectDir);
      const stats = await fs.stat(projectPath);
      
      if (!stats.isDirectory()) continue;

      try {
        // Look for project structure file
        const structureFile = path.join(projectPath, '01_structure', 'plot_structure.json');
        
        try {
          await fs.access(structureFile);
        } catch {
          console.log(`⏭️  Skipping ${projectDir} - no structure file found`);
          continue;
        }

        // Read project data
        const projectData = JSON.parse(await fs.readFile(structureFile, 'utf8'));
        const { structure, template, storyInput, projectId } = projectData;

        if (!storyInput || !storyInput.title) {
          console.log(`⏭️  Skipping ${projectDir} - incomplete project data`);
          continue;
        }

        // Prepare project context
        const projectContext = {
          structure,
          template,
          storyInput,
          projectId: projectId || projectDir,
          projectPath: projectDir,
          generatedAt: projectData.generatedAt || new Date().toISOString(),
          migratedAt: new Date().toISOString()
        };

        // Create thumbnail data
        const thumbnailData = {
          title: storyInput.title,
          genre: storyInput.genre || 'Unknown',
          tone: storyInput.tone,
          structure: template?.name || 'Unknown Structure',
          currentStep: 3, // At least structure was generated
          totalScenes: storyInput.totalScenes || 70
        };

        // Check if scenes exist to update step
        try {
          await fs.access(path.join(projectPath, '02_scenes'));
          thumbnailData.currentStep = 4; // Scenes generated
        } catch {}

        // Check if dialogue exists
        try {
          await fs.access(path.join(projectPath, '03_dialogue'));
          thumbnailData.currentStep = 5; // Dialogue generated
        } catch {}

        // Get guest user ID (default user)
        const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', ['guest']);
        if (userResult.rows.length === 0) {
          console.log('❌ Guest user not found in database');
          continue;
        }

        const userId = userResult.rows[0].id;

        // Check if project already exists in database
        const existingProject = await dbClient.query(
          'SELECT project_name FROM user_projects WHERE user_id = $1 AND project_name = $2',
          [userId, projectDir]
        );

        if (existingProject.rows.length > 0) {
          console.log(`⏭️  Project ${storyInput.title} already exists in database`);
          continue;
        }

        // Save project to database
        await dbClient.query(
          `INSERT INTO user_projects (user_id, project_name, project_context, thumbnail_data) 
           VALUES ($1, $2, $3, $4)`,
          [userId, projectDir, JSON.stringify(projectContext), JSON.stringify(thumbnailData)]
        );

        console.log(`✅ Migrated: ${storyInput.title} (${projectDir})`);
        console.log(`   Structure: ${template?.name || 'Unknown'}`);
        console.log(`   Step: ${thumbnailData.currentStep}/7`);
        console.log(`   Scenes: ${thumbnailData.totalScenes}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Failed to migrate ${projectDir}:`, error.message);
      }
    }

    console.log('🎉 Migration complete!');
    console.log('✅ Your projects should now appear in the profile page');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await dbClient.end();
  }
}

// Run the migration
migrateExistingProjects(); 