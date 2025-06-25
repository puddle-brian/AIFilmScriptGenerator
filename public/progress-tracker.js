/**
 * Progress Tracker - Core Progress Calculation Module
 * Self-contained system for calculating step completion percentages
 */
class ProgressTracker {
  /**
   * Calculate progress percentage for a specific step
   * @param {number} stepNumber - Step number (1-7)
   * @param {Object} appState - Current application state
   * @returns {number} Progress percentage (0-100)
   */
  static calculateStepProgress(stepNumber, appState) {
    try {
      switch(stepNumber) {
        case 1: return this.calculateStoryProgress(appState);
        case 2: return this.calculateTemplateProgress(appState);
        case 3: return this.calculateStructureProgress(appState);
        case 4: return this.calculatePlotPointsProgress(appState);
        case 5: return this.calculateScenesProgress(appState);
        case 6: return this.calculateDialogueProgress(appState);
        case 7: return this.calculateExportProgress(appState);
        default: return 0;
      }
    } catch (error) {
      console.warn(`Progress calculation error for step ${stepNumber}:`, error);
      return 0; // Fallback to 0% on error
    }
  }
  
  /**
   * Step 1: Story Input Progress
   * Binary: 0% or 100% based on title + logline completion
   */
  static calculateStoryProgress(appState) {
    return (appState.currentStoryConcept && 
            appState.currentStoryConcept.title && 
            appState.currentStoryConcept.logline) ? 100 : 0;
  }
  
  /**
   * Step 2: Template Selection Progress  
   * Binary: 0% or 100% based on template selection
   */
  static calculateTemplateProgress(appState) {
    return appState.selectedTemplate ? 100 : 0;
  }
  
  /**
   * Step 3: Structure Generation Progress
   * Proportional based on completed structure elements
   */
  static calculateStructureProgress(appState) {
    if (!appState.generatedStructure) return 0;
    const keys = Object.keys(appState.generatedStructure);
    if (keys.length === 0) return 0;
    
    const completedKeys = keys.filter(key => 
      appState.generatedStructure[key] && 
      typeof appState.generatedStructure[key] === 'object' &&
      Object.keys(appState.generatedStructure[key]).length > 0
    );
    
    return Math.round((completedKeys.length / keys.length) * 100);
  }
  
  /**
   * Step 4: Plot Points Progress
   * Proportional based on completed plot points
   */
  static calculatePlotPointsProgress(appState) {
    console.log('🔍 PROGRESS DEBUG: calculatePlotPointsProgress called');
    console.log('🔍 PROGRESS DEBUG: appState.generatedStructure exists:', !!appState.generatedStructure);
    console.log('🔍 PROGRESS DEBUG: appState.plotPoints exists:', !!appState.plotPoints);
    
    if (!appState.generatedStructure) {
      console.log('🔍 PROGRESS DEBUG: No generatedStructure, returning 0%');
      return 0;
    }
    
    const structureKeys = Object.keys(appState.generatedStructure);
    console.log('🔍 PROGRESS DEBUG: structureKeys:', structureKeys);
    
    if (structureKeys.length === 0) {
      console.log('🔍 PROGRESS DEBUG: No structure keys, returning 0%');
      return 0;
    }
    
    if (!appState.plotPoints) {
      console.log('🔍 PROGRESS DEBUG: No plotPoints object, returning 0%');
      return 0;
    }
    
    console.log('🔍 PROGRESS DEBUG: plotPoints keys:', Object.keys(appState.plotPoints));
    console.log('🔍 PROGRESS DEBUG: plotPoints data:', appState.plotPoints);
    
    const completedKeys = structureKeys.filter(key => {
      const plotPoints = appState.plotPoints[key];
      console.log(`🔍 PROGRESS DEBUG: Checking ${key}, plotPoints:`, plotPoints);
      
      if (!plotPoints) return false;
      
      // Handle both array and string formats
      if (Array.isArray(plotPoints)) {
        const hasContent = plotPoints.length > 0 && plotPoints.some(point => 
          point && typeof point === 'string' && point.trim().length > 0
        );
        console.log(`🔍 PROGRESS DEBUG: ${key} array has content:`, hasContent);
        return hasContent;
      } else if (typeof plotPoints === 'string') {
        const hasContent = plotPoints.trim().length > 0;
        console.log(`🔍 PROGRESS DEBUG: ${key} string has content:`, hasContent);
        return hasContent;
      } else if (typeof plotPoints === 'object') {
        // Handle object format (might be new structure)
        const hasContent = Object.keys(plotPoints).length > 0;
        console.log(`🔍 PROGRESS DEBUG: ${key} object has content:`, hasContent);
        return hasContent;
      }
      
      console.log(`🔍 PROGRESS DEBUG: ${key} unknown format, returning false`);
      return false;
    });
    
    console.log('🔍 PROGRESS DEBUG: completedKeys:', completedKeys);
    const progress = Math.round((completedKeys.length / structureKeys.length) * 100);
    console.log('🔍 PROGRESS DEBUG: calculated progress:', progress);
    
    return progress;
  }
  
  /**
   * Step 5: Scenes Progress
   * Proportional based on completed scenes
   */
  static calculateScenesProgress(appState) {
    console.log('🔍 SCENES PROGRESS DEBUG: calculateScenesProgress called');
    console.log('🔍 SCENES PROGRESS DEBUG: appState.generatedStructure exists:', !!appState.generatedStructure);
    console.log('🔍 SCENES PROGRESS DEBUG: appState.generatedScenes exists:', !!appState.generatedScenes);
    
    if (!appState.generatedStructure) {
      console.log('🔍 SCENES PROGRESS DEBUG: No generatedStructure, returning 0%');
      return 0;
    }
    
    const structureKeys = Object.keys(appState.generatedStructure);
    console.log('🔍 SCENES PROGRESS DEBUG: structureKeys:', structureKeys);
    
    if (structureKeys.length === 0) {
      console.log('🔍 SCENES PROGRESS DEBUG: No structure keys, returning 0%');
      return 0;
    }
    
    if (!appState.generatedScenes) {
      console.log('🔍 SCENES PROGRESS DEBUG: No generatedScenes object, returning 0%');
      return 0;
    }
    
    console.log('🔍 SCENES PROGRESS DEBUG: generatedScenes keys:', Object.keys(appState.generatedScenes));
    console.log('🔍 SCENES PROGRESS DEBUG: generatedScenes data:', appState.generatedScenes);
    
    const completedKeys = structureKeys.filter(key => {
      const scenes = appState.generatedScenes[key];
      console.log(`🔍 SCENES PROGRESS DEBUG: Checking ${key}, scenes:`, scenes);
      
      if (!scenes) return false;
      
      // Handle both array and object formats
      if (Array.isArray(scenes)) {
        const hasContent = scenes.length > 0 && scenes.some(scene => 
          scene && (typeof scene === 'string' ? scene.trim().length > 0 : true)
        );
        console.log(`🔍 SCENES PROGRESS DEBUG: ${key} array has content:`, hasContent);
        return hasContent;
      } else if (typeof scenes === 'object') {
        const hasContent = Object.keys(scenes).length > 0;
        console.log(`🔍 SCENES PROGRESS DEBUG: ${key} object has content:`, hasContent);
        return hasContent;
      } else if (typeof scenes === 'string') {
        const hasContent = scenes.trim().length > 0;
        console.log(`🔍 SCENES PROGRESS DEBUG: ${key} string has content:`, hasContent);
        return hasContent;
      }
      
      console.log(`🔍 SCENES PROGRESS DEBUG: ${key} unknown format, returning false`);
      return false;
    });
    
    console.log('🔍 SCENES PROGRESS DEBUG: completedKeys:', completedKeys);
    const progress = Math.round((completedKeys.length / structureKeys.length) * 100);
    console.log('🔍 SCENES PROGRESS DEBUG: calculated progress:', progress);
    
    return progress;
  }
  
  /**
   * Step 6: Dialogue Progress
   * Proportional based on dialogue completion for total expected scenes
   */
  static calculateDialogueProgress(appState) {
    if (!appState.generatedDialogues) return 0;
    
    // Get the expected total scene count from story input
    const expectedTotalScenes = appState.storyInput?.totalScenes || 70; // Default to 70 if not specified
    
    // Count how many dialogues have been generated
    const dialogueKeys = Object.keys(appState.generatedDialogues);
    const completedDialogues = dialogueKeys.filter(key => 
      appState.generatedDialogues[key] && 
      appState.generatedDialogues[key].trim().length > 0
    ).length;
    
    return Math.round((completedDialogues / expectedTotalScenes) * 100);
  }
  
  /**
   * Step 7: Script Completion Progress
   * Shows overall script completion based on dialogue progress (same as Step 6)
   */
  static calculateExportProgress(appState) {
    // Use the same logic as dialogue progress since that represents actual script completion
    return this.calculateDialogueProgress(appState);
  }
  
  /**
   * Get progress for all steps at once
   * @param {Object} appState - Current application state
   * @returns {Array} Array of progress percentages [step1%, step2%, ...]
   */
  static getAllStepProgress(appState) {
    return [1, 2, 3, 4, 5, 6, 7].map(step => 
      this.calculateStepProgress(step, appState)
    );
  }
  
  /**
   * Debug helper - log current progress for all steps
   */
  static debugProgress(appState) {
    console.group('Progress Tracker Debug');
    for (let i = 1; i <= 7; i++) {
      const progress = this.calculateStepProgress(i, appState);
      console.log(`Step ${i}: ${progress}%`);
    }
    console.groupEnd();
  }
}

// Make available globally
window.ProgressTracker = ProgressTracker; 