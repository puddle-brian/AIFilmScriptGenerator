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
    if (!appState.generatedStructure) return 0;
    const structureKeys = Object.keys(appState.generatedStructure);
    if (structureKeys.length === 0) return 0;
    
    if (!appState.plotPoints) return 0;
    
    const completedKeys = structureKeys.filter(key => {
      const plotPoints = appState.plotPoints[key];
      if (!plotPoints) return false;
      
      // Handle both array and string formats
      if (Array.isArray(plotPoints)) {
        return plotPoints.length > 0 && plotPoints.some(point => 
          point && typeof point === 'string' && point.trim().length > 0
        );
      } else if (typeof plotPoints === 'string') {
        return plotPoints.trim().length > 0;
      }
      
      return false;
    });
    
    return Math.round((completedKeys.length / structureKeys.length) * 100);
  }
  
  /**
   * Step 5: Scenes Progress
   * Proportional based on completed scenes
   */
  static calculateScenesProgress(appState) {
    if (!appState.generatedStructure) return 0;
    const structureKeys = Object.keys(appState.generatedStructure);
    if (structureKeys.length === 0) return 0;
    
    if (!appState.generatedScenes) return 0;
    
    const completedKeys = structureKeys.filter(key => {
      const scenes = appState.generatedScenes[key];
      if (!scenes) return false;
      
      // Handle both array and object formats
      if (Array.isArray(scenes)) {
        return scenes.length > 0 && scenes.some(scene => 
          scene && (typeof scene === 'string' ? scene.trim().length > 0 : true)
        );
      } else if (typeof scenes === 'object') {
        return Object.keys(scenes).length > 0;
      } else if (typeof scenes === 'string') {
        return scenes.trim().length > 0;
      }
      
      return false;
    });
    
    return Math.round((completedKeys.length / structureKeys.length) * 100);
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