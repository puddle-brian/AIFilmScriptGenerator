const { Pool } = require('pg');

// Database connection
const dbClient = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Project Progress Diagnostic Tool
 * 
 * This script analyzes projects for currentStep inconsistencies and provides fixes.
 * It checks if thumbnail_data.currentStep matches the actual project content.
 */

function parseProjectContext(projectContextRaw) {
  if (typeof projectContextRaw === 'string') {
    try {
      return JSON.parse(projectContextRaw);
    } catch (error) {
      console.error('Error parsing project context JSON:', error);
      return {};
    }
  } else if (typeof projectContextRaw === 'object' && projectContextRaw !== null) {
    return projectContextRaw;
  } else {
    return {};
  }
}

function analyzeActualProgress(projectContext) {
  const progress = {
    step1: false, // Story Input
    step2: false, // Template Selection
    step3: false, // Structure Generation
    step4: false, // Plot Points
    step5: false, // Scene Generation
    step6: false, // Dialogue Generation
    step7: false  // Export Complete
  };

  // Step 1: Story Input
  progress.step1 = !!(projectContext.storyInput?.title && projectContext.storyInput?.logline);

  // Step 2: Template Selection
  progress.step2 = !!(projectContext.selectedTemplate && projectContext.templateData);

  // Step 3: Structure Generation
  if (projectContext.generatedStructure) {
    const structureKeys = Object.keys(projectContext.generatedStructure);
    progress.step3 = structureKeys.length > 0 && structureKeys.every(key => 
      projectContext.generatedStructure[key]?.description
    );
  }

  // Step 4: Plot Points
  if (projectContext.plotPoints && projectContext.generatedStructure) {
    const structureKeys = Object.keys(projectContext.generatedStructure);
    progress.step4 = structureKeys.length > 0 && structureKeys.every(key => {
      const plotPointsData = projectContext.plotPoints[key];
      if (Array.isArray(plotPointsData)) {
        return plotPointsData.length > 0;
      } else if (plotPointsData?.plotPoints) {
        return plotPointsData.plotPoints.length > 0;
      }
      return false;
    });
  }

  // Step 5: Scene Generation
  if (projectContext.generatedScenes && projectContext.generatedStructure) {
    const structureKeys = Object.keys(projectContext.generatedStructure);
    progress.step5 = structureKeys.length > 0 && structureKeys.some(key => {
      const scenes = projectContext.generatedScenes[key];
      if (Array.isArray(scenes)) {
        return scenes.length > 0;
      } else if (scenes?.plotPointScenes) {
        return scenes.plotPointScenes.some(pp => pp.scenes?.length > 0);
      }
      return false;
    });
  }

  // Step 6: Dialogue Generation
  if (projectContext.generatedDialogues) {
    const dialogueKeys = Object.keys(projectContext.generatedDialogues);
    progress.step6 = dialogueKeys.some(key => {
      const dialogue = projectContext.generatedDialogues[key];
      if (typeof dialogue === 'string') {
        return dialogue.trim().length > 0;
      } else if (dialogue?.dialogue) {
        return dialogue.dialogue.trim().length > 0;
      }
      return false;
    });
  }

  // Step 7: Export Complete
  progress.step7 = !!(projectContext.hasExported);

  return progress;
}

function getRecommendedCurrentStep(progress) {
  // Find the highest completed step
  if (progress.step7) return 7;
  if (progress.step6) return 6;
  if (progress.step5) return 5;
  if (progress.step4) return 4;
  if (progress.step3) return 3;
  if (progress.step2) return 2;
  if (progress.step1) return 1;
  return 1;
}

async function diagnoseProject(username, projectName) {
  try {
    console.log(`\n🔍 Diagnosing project: "${projectName}" for user: ${username}`);
    console.log('='.repeat(60));

    // Get user ID
    const userResult = await dbClient.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      throw new Error(`User "${username}" not found`);
    }
    const userId = userResult.rows[0].id;

    // Get project
    const projectResult = await dbClient.query(
      'SELECT project_context, thumbnail_data FROM user_projects WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project "${projectName}" not found for user "${username}"`);
    }

    const { project_context, thumbnail_data } = projectResult.rows[0];
    const projectContext = parseProjectContext(project_context);
    const actualProgress = analyzeActualProgress(projectContext);
    const recommendedStep = getRecommendedCurrentStep(actualProgress);

    console.log('📊 CURRENT STATE:');
    console.log(`   thumbnail_data.currentStep: ${thumbnail_data?.currentStep || 'unknown'}`);
    console.log(`   projectContext.currentStep: ${projectContext.currentStep || 'unknown'}`);

    console.log('\n✅ ACTUAL CONTENT ANALYSIS:');
    Object.entries(actualProgress).forEach(([step, completed]) => {
      const stepNum = step.replace('step', '');
      const stepNames = {
        '1': 'Story Input',
        '2': 'Template Selection', 
        '3': 'Structure Generation',
        '4': 'Plot Points',
        '5': 'Scene Generation',
        '6': 'Dialogue Generation',
        '7': 'Export Complete'
      };
      console.log(`   Step ${stepNum} (${stepNames[stepNum]}): ${completed ? '✅ Complete' : '❌ Incomplete'}`);
    });

    console.log(`\n🎯 RECOMMENDED currentStep: ${recommendedStep}`);

    // Check for inconsistencies
    const thumbnailStep = thumbnail_data?.currentStep || 0;
    const contextStep = projectContext.currentStep || 0;
    
    const hasInconsistency = thumbnailStep !== recommendedStep || contextStep !== recommendedStep;
    
    if (hasInconsistency) {
      console.log('\n⚠️  INCONSISTENCY DETECTED:');
      if (thumbnailStep !== recommendedStep) {
        console.log(`   thumbnail_data.currentStep (${thumbnailStep}) should be ${recommendedStep}`);
      }
      if (contextStep !== recommendedStep) {
        console.log(`   projectContext.currentStep (${contextStep}) should be ${recommendedStep}`);
      }

      console.log('\n🛠️  CONTENT DETAILS:');
      
      // Show structure details
      if (projectContext.generatedStructure) {
        const structureKeys = Object.keys(projectContext.generatedStructure);
        console.log(`   Structure: ${structureKeys.length} acts (${structureKeys.join(', ')})`);
      } else {
        console.log('   Structure: None');
      }

      // Show plot points details
      if (projectContext.plotPoints) {
        const plotPointsKeys = Object.keys(projectContext.plotPoints);
        console.log(`   Plot Points: ${plotPointsKeys.length} acts with plot points`);
        plotPointsKeys.forEach(key => {
          const plotPointsData = projectContext.plotPoints[key];
          let count = 0;
          if (Array.isArray(plotPointsData)) {
            count = plotPointsData.length;
          } else if (plotPointsData?.plotPoints) {
            count = plotPointsData.plotPoints.length;
          }
          console.log(`     ${key}: ${count} plot points`);
        });
      } else {
        console.log('   Plot Points: None');
      }

      // Show scenes details
      if (projectContext.generatedScenes) {
        const sceneKeys = Object.keys(projectContext.generatedScenes);
        console.log(`   Scenes: ${sceneKeys.length} acts with scenes`);
        sceneKeys.forEach(key => {
          const scenes = projectContext.generatedScenes[key];
          let count = 0;
          if (Array.isArray(scenes)) {
            count = scenes.length;
          } else if (scenes?.plotPointScenes) {
            count = scenes.plotPointScenes.reduce((total, pp) => total + (pp.scenes?.length || 0), 0);
          }
          console.log(`     ${key}: ${count} scenes`);
        });
      } else {
        console.log('   Scenes: None');
      }

      // Show dialogue details
      if (projectContext.generatedDialogues) {
        const dialogueKeys = Object.keys(projectContext.generatedDialogues);
        const dialogueCount = dialogueKeys.filter(key => {
          const dialogue = projectContext.generatedDialogues[key];
          if (typeof dialogue === 'string') {
            return dialogue.trim().length > 0;
          } else if (dialogue?.dialogue) {
            return dialogue.dialogue.trim().length > 0;
          }
          return false;
        }).length;
        console.log(`   Dialogue: ${dialogueCount} scenes with dialogue (keys: ${dialogueKeys.slice(0, 3).join(', ')}${dialogueKeys.length > 3 ? '...' : ''})`);
      } else {
        console.log('   Dialogue: None');
      }

      return {
        hasInconsistency: true,
        currentThumbnailStep: thumbnailStep,
        currentContextStep: contextStep,
        recommendedStep: recommendedStep,
        actualProgress: actualProgress,
        userId: userId,
        projectName: projectName
      };
    } else {
      console.log('\n✅ PROJECT IS CONSISTENT');
      console.log('   No currentStep inconsistencies detected.');
      return {
        hasInconsistency: false,
        currentThumbnailStep: thumbnailStep,
        currentContextStep: contextStep,
        recommendedStep: recommendedStep,
        actualProgress: actualProgress
      };
    }

  } catch (error) {
    console.error('\n❌ Error diagnosing project:', error);
    throw error;
  }
}

async function fixProjectProgress(userId, projectName, newCurrentStep) {
  try {
    console.log(`\n🔧 Fixing project progress...`);
    
    // Update project context currentStep
    const updateContextResult = await dbClient.query(
      `UPDATE user_projects 
       SET project_context = jsonb_set(project_context, '{currentStep}', $1::jsonb),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND project_name = $3
       RETURNING project_name`,
      [newCurrentStep, userId, projectName]
    );

    if (updateContextResult.rows.length === 0) {
      throw new Error('Project not found for context update');
    }

    // Update thumbnail_data currentStep
    const updateThumbnailResult = await dbClient.query(
      `UPDATE user_projects 
       SET thumbnail_data = jsonb_set(thumbnail_data, '{currentStep}', $1::jsonb),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND project_name = $3
       RETURNING project_name`,
      [newCurrentStep, userId, projectName]
    );

    if (updateThumbnailResult.rows.length === 0) {
      throw new Error('Project not found for thumbnail update');
    }

    console.log(`✅ Fixed project progress:`);
    console.log(`   Updated projectContext.currentStep to: ${newCurrentStep}`);
    console.log(`   Updated thumbnail_data.currentStep to: ${newCurrentStep}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing project progress:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command) {
      console.log('🔍 Project Progress Diagnostic Tool');
      console.log('');
      console.log('Usage:');
      console.log('  node diagnose-project-progress.js diagnose <username> <project-name>');
      console.log('  node diagnose-project-progress.js fix <username> <project-name> <new-step>');
      console.log('');
      console.log('Examples:');
      console.log('  node diagnose-project-progress.js diagnose BGibson pigman_v2_2025-06-29T13-49-05');
      console.log('  node diagnose-project-progress.js fix BGibson pigman_v2_2025-06-29T13-49-05 6');
      process.exit(0);
    }

    if (command === 'diagnose') {
      const username = args[1];
      const projectName = args[2];
      if (!username || !projectName) {
        console.error('❌ Please provide username and project name');
        process.exit(1);
      }
      await diagnoseProject(username, projectName);
    } 
    else if (command === 'fix') {
      const username = args[1];
      const projectName = args[2];
      const newStep = parseInt(args[3]);
      if (!username || !projectName || !newStep) {
        console.error('❌ Please provide username, project name, and new step number');
        process.exit(1);
      }
      
      // First diagnose to get userId
      const diagnosis = await diagnoseProject(username, projectName);
      if (diagnosis.hasInconsistency) {
        await fixProjectProgress(diagnosis.userId, projectName, newStep);
        console.log('\n🎉 Project fixed! Run diagnose again to verify.');
      } else {
        console.log('\n✅ Project is already consistent, no fix needed.');
      }
    }
    else {
      console.error('❌ Unknown command. Use: diagnose or fix');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  diagnoseProject,
  fixProjectProgress,
  analyzeActualProgress,
  getRecommendedCurrentStep
}; 