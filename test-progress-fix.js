const { Pool } = require('pg');

// Database connection
const dbClient = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Quick Test Script for Progress Fix
 * 
 * This script tests that the currentStep updates are working correctly
 * by checking a project's state before and after operations.
 */

async function testProjectProgress(username, projectName) {
  try {
    console.log(`🧪 Testing progress tracking for: ${projectName}`);
    console.log('='.repeat(50));

    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      throw new Error(`User "${username}" not found`);
    }
    const userId = userResult.rows[0].id;

    // Get project current state
    const projectResult = await dbClient.query(
      'SELECT project_context, thumbnail_data FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project "${projectName}" not found`);
    }

    const { project_context, thumbnail_data } = projectResult.rows[0];
    const projectContext = typeof project_context === 'string' ? JSON.parse(project_context) : project_context;

    console.log('📊 CURRENT STATE:');
    console.log(`   thumbnail_data.currentStep: ${thumbnail_data?.currentStep || 'unknown'}`);
    console.log(`   projectContext.currentStep: ${projectContext.currentStep || 'unknown'}`);

    // Analyze what content exists
    console.log('\n📁 CONTENT ANALYSIS:');
    
    const hasStoryInput = !!(projectContext.storyInput?.title);
    const hasTemplate = !!(projectContext.selectedTemplate);
    const hasStructure = !!(projectContext.generatedStructure && Object.keys(projectContext.generatedStructure).length > 0);
    const hasPlotPoints = !!(projectContext.plotPoints && Object.keys(projectContext.plotPoints).length > 0);
    const hasScenes = !!(projectContext.generatedScenes && Object.keys(projectContext.generatedScenes).length > 0);
    const hasDialogues = !!(projectContext.generatedDialogues && Object.keys(projectContext.generatedDialogues).length > 0);

    console.log(`   Story Input: ${hasStoryInput ? '✅' : '❌'}`);
    console.log(`   Template: ${hasTemplate ? '✅' : '❌'}`);
    console.log(`   Structure: ${hasStructure ? '✅' : '❌'}`);
    console.log(`   Plot Points: ${hasPlotPoints ? '✅' : '❌'}`);
    console.log(`   Scenes: ${hasScenes ? '✅' : '❌'}`);
    console.log(`   Dialogues: ${hasDialogues ? '✅' : '❌'}`);

    // Determine expected step
    let expectedStep = 1;
    if (hasDialogues) expectedStep = 6;
    else if (hasScenes) expectedStep = 5;
    else if (hasPlotPoints) expectedStep = 4;
    else if (hasStructure) expectedStep = 3;
    else if (hasTemplate) expectedStep = 2;
    else if (hasStoryInput) expectedStep = 1;

    console.log(`\n🎯 EXPECTED currentStep: ${expectedStep}`);

    // Check if fix is working
    const thumbnailStep = thumbnail_data?.currentStep || 0;
    const contextStep = projectContext.currentStep || 0;

    if (thumbnailStep === expectedStep && contextStep === expectedStep) {
      console.log('\n✅ PROGRESS TRACKING IS CORRECT!');
      console.log('   Both currentStep values match expected step.');
    } else {
      console.log('\n⚠️  PROGRESS TRACKING NEEDS FIXING:');
      if (thumbnailStep !== expectedStep) {
        console.log(`   thumbnail_data.currentStep: ${thumbnailStep} should be ${expectedStep}`);
      }
      if (contextStep !== expectedStep) {
        console.log(`   projectContext.currentStep: ${contextStep} should be ${expectedStep}`);
      }
      console.log('\n💡 To fix this, run:');
      console.log(`   node diagnose-project-progress.js fix ${username} ${projectName} ${expectedStep}`);
    }

    return {
      projectName,
      thumbnailStep,
      contextStep,
      expectedStep,
      isCorrect: thumbnailStep === expectedStep && contextStep === expectedStep,
      contentAnalysis: {
        hasStoryInput,
        hasTemplate,
        hasStructure,
        hasPlotPoints,
        hasScenes,
        hasDialogues
      }
    };

  } catch (error) {
    console.error('❌ Error testing project progress:', error);
    throw error;
  }
}

async function testAllUserProjects(username) {
  try {
    console.log(`🧪 Testing ALL projects for user: ${username}`);
    console.log('='.repeat(60));

    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      throw new Error(`User "${username}" not found`);
    }
    const userId = userResult.rows[0].id;

    // Get all projects
    const projectsResult = await dbClient.query(
      'SELECT project_name FROM user_projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    console.log(`📊 Found ${projectsResult.rows.length} projects\n`);

    const results = [];
    for (const project of projectsResult.rows) {
      try {
        const result = await testProjectProgress(username, project.project_name);
        results.push(result);
        console.log('\n' + '-'.repeat(50) + '\n');
      } catch (error) {
        console.log(`❌ Error testing ${project.project_name}: ${error.message}\n`);
      }
    }

    // Summary
    const correctProjects = results.filter(r => r.isCorrect);
    const incorrectProjects = results.filter(r => !r.isCorrect);

    console.log('📈 SUMMARY:');
    console.log(`   ✅ Correct: ${correctProjects.length} projects`);
    console.log(`   ⚠️  Need fixing: ${incorrectProjects.length} projects`);

    if (incorrectProjects.length > 0) {
      console.log('\n🛠️  Projects needing fixes:');
      incorrectProjects.forEach(project => {
        console.log(`   - ${project.projectName}: step ${project.thumbnailStep || project.contextStep} → ${project.expectedStep}`);
      });
    }

    return results;

  } catch (error) {
    console.error('❌ Error testing all projects:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command) {
      console.log('🧪 Progress Fix Test Tool');
      console.log('');
      console.log('Usage:');
      console.log('  node test-progress-fix.js test <username> <project-name>');
      console.log('  node test-progress-fix.js test-all <username>');
      console.log('');
      console.log('Examples:');
      console.log('  node test-progress-fix.js test BGibson pigman_v2_2025-06-29T13-49-05');
      console.log('  node test-progress-fix.js test-all BGibson');
      process.exit(0);
    }

    if (command === 'test') {
      const username = args[1];
      const projectName = args[2];
      if (!username || !projectName) {
        console.error('❌ Please provide username and project name');
        process.exit(1);
      }
      await testProjectProgress(username, projectName);
    } 
    else if (command === 'test-all') {
      const username = args[1];
      if (!username) {
        console.error('❌ Please provide username');
        process.exit(1);
      }
      await testAllUserProjects(username);
    }
    else {
      console.error('❌ Unknown command. Use: test or test-all');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testProjectProgress,
  testAllUserProjects
}; 