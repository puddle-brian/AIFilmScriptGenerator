// =====================================================
// Generation Button Manager Component
// =====================================================
// Manages generation button states, text, and UI updates
// (button visibility, regenerate vs generate text, etc.)

class GenerationButtonManager {
    constructor() {
        console.log('🔧 GenerationButtonManager initialized');
    }

    // Update the acts generation button text based on whether acts exist
    updateActsGenerationButton() {
        const button = document.getElementById('generateActsBtn');
        if (!button) return;
        
        const hasExistingActs = appState.generatedStructure && 
                               Object.keys(appState.generatedStructure).length > 0 &&
                               Object.keys(appState.generatedStructure).some(key =>
                                   appState.generatedStructure[key] &&
                                   appState.generatedStructure[key].description
                               );
        
        if (hasExistingActs) {
            button.innerHTML = '🔄 Regenerate Acts';
            button.title = 'Regenerate story acts using the selected template';
        } else {
            button.innerHTML = '📋 Generate Acts';
            button.title = 'Generate story acts using the selected template';
        }
    }

    // Update the "Generate All Plot Points" button text based on whether ALL acts have plot points
    updateGenerateAllPlotPointsButton() {
        const button = document.getElementById('generateAllPlotPointsBtn');
        if (!button) return;
        
        // Check if ALL acts have plot points (not just any acts)
        const structureKeys = appState.generatedStructure ? Object.keys(appState.generatedStructure) : [];
        const allActsHavePlotPoints = structureKeys.length > 0 && structureKeys.every(key =>
            hasPlotPointsForElement(key) // Use existing helper function for consistency
        );
        
        if (allActsHavePlotPoints) {
            button.innerHTML = '🔄 Regenerate All Plot Points';
            button.title = 'Regenerate connected plot points for all acts';
        } else {
            button.innerHTML = '📋 Generate All Plot Points';
            button.title = 'Generate connected plot points for all acts';
        }
    }

    // Update the "Generate All Scenes" button text based on whether ALL acts with plot points have scenes
    updateGenerateAllScenesButton() {
        const button = document.getElementById('generateAllScenesBtn');
        if (!button) return;
        
        // Get acts that have plot points using the correct helper function
        const actsWithPlotPoints = [];
        if (appState.generatedStructure) {
            Object.keys(appState.generatedStructure).forEach(key => {
                if (hasPlotPointsForElement(key)) {
                    actsWithPlotPoints.push(key);
                }
            });
        }
        
        // Check if ALL acts with plot points also have scenes
        const allActsWithPlotPointsHaveScenes = actsWithPlotPoints.length > 0 && actsWithPlotPoints.every(key => {
            return appState.generatedScenes &&
                   appState.generatedScenes[key] && 
                   Array.isArray(appState.generatedScenes[key]) &&
                   appState.generatedScenes[key].length > 0;
        });
        
        if (allActsWithPlotPointsHaveScenes) {
            button.innerHTML = '🔄 Regenerate All Scenes';
            button.title = 'Regenerate scenes for all acts that have plot points';
        } else {
            button.innerHTML = '🎬 Generate All Scenes';
            button.title = 'Generate scenes for all acts that have plot points';
        }
    }

    // Update the "Generate All Dialogue" button text based on whether ALL scenes have dialogue
    updateGenerateAllDialogueButton() {
        const button = document.getElementById('generateAllDialogueBtn');
        if (!button) return;
        
        // Get all scenes that exist
        const allScenes = [];
        if (appState.generatedScenes) {
            Object.values(appState.generatedScenes).forEach(actScenes => {
                if (Array.isArray(actScenes)) {
                    allScenes.push(...actScenes);
                }
            });
        }
        
        // Check if ALL scenes have dialogue
        const allScenesHaveDialogue = allScenes.length > 0 && allScenes.every(scene =>
            appState.generatedDialogues &&
            appState.generatedDialogues[scene.id] &&
            appState.generatedDialogues[scene.id].length > 0
        );
        
        if (allScenesHaveDialogue) {
            button.innerHTML = '🔄 Regenerate All Dialogue';
            button.title = 'Regenerate dialogue for all scenes that exist';
        } else {
            button.innerHTML = '💬 Generate All Dialogue';
            button.title = 'Generate dialogue for all scenes that exist';
        }
    }

    // Update all generation buttons
    updateAllGenerationButtons() {
        this.updateActsGenerationButton();
        this.updateGenerateAllPlotPointsButton();
        this.updateGenerateAllScenesButton();
        this.updateGenerateAllDialogueButton();
    }
}

// Create global instance
const generationButtonManager = new GenerationButtonManager();

console.log('🔧 GenerationButtonManager component loaded successfully'); 