// =====================================================
// Creative Direction Manager Component
// =====================================================
// Handles composition and management of creative directions
// for generation processes (plot points, scenes, dialogue)

class CreativeDirectionManager {
    constructor() {
        console.log('🎨 CreativeDirectionManager initialized');
    }

    // Get effective creative direction by combining global and specific directions
    getEffectiveCreativeDirection(stepType, elementKey) {
        const globalDirection = appState.globalCreativeDirections?.[stepType] || '';
        const specificDirection = appState.creativeDirections?.[stepType]?.[elementKey] || '';
        
        if (globalDirection && specificDirection) {
            return `${globalDirection}\n\nAdditional specific guidance: ${specificDirection}`;
        }
        
        return globalDirection || specificDirection || '';
    }

    // Compose all creative directions (global + individual) for sending to backend
    getComposedCreativeDirections() {
        console.log('🎨 Building composed creative directions...');
        const startTime = Date.now();
        
        const composed = {
            plotPoints: {},
            scenes: {},
            dialogue: {}
        };
        
        // Compose plot points directions
        if (appState.creativeDirections?.plotPoints) {
            Object.keys(appState.creativeDirections.plotPoints).forEach(actKey => {
                composed.plotPoints[actKey] = this.getEffectiveCreativeDirection('plotPoints', actKey);
            });
        }
        
        // Also add global direction for any acts that don't have individual directions
        const globalPlotPointsDirection = appState.globalCreativeDirections?.plotPoints || '';
        if (globalPlotPointsDirection && appState.generatedStructure) {
            Object.keys(appState.generatedStructure).forEach(actKey => {
                if (!composed.plotPoints[actKey]) {
                    composed.plotPoints[actKey] = globalPlotPointsDirection;
                }
            });
        }
        
        // Compose scenes directions
        if (appState.creativeDirections?.scenes) {
            Object.keys(appState.creativeDirections.scenes).forEach(sceneKey => {
                composed.scenes[sceneKey] = this.getEffectiveCreativeDirection('scenes', sceneKey);
            });
        }
        
        // Also add global direction for any scenes that don't have individual directions
        const globalScenesDirection = appState.globalCreativeDirections?.scenes || '';
        if (globalScenesDirection && appState.plotPoints) {
            Object.keys(appState.plotPoints).forEach(actKey => {
                const plotPoints = appState.plotPoints[actKey];
                if (plotPoints && Array.isArray(plotPoints.plotPoints ? plotPoints.plotPoints : plotPoints)) {
                    const plotPointsArray = plotPoints.plotPoints || plotPoints;
                    plotPointsArray.forEach((_, plotPointIndex) => {
                        const sceneKey = `${actKey}_${plotPointIndex}`;
                        if (!composed.scenes[sceneKey]) {
                            composed.scenes[sceneKey] = globalScenesDirection;
                        }
                    });
                }
            });
        }
        
        // Compose dialogue directions
        if (appState.creativeDirections?.dialogue) {
            Object.keys(appState.creativeDirections.dialogue).forEach(dialogueKey => {
                composed.dialogue[dialogueKey] = this.getEffectiveCreativeDirection('dialogue', dialogueKey);
            });
        }
        
        // Also add global direction for any scenes that don't have individual directions
        const globalDialogueDirection = appState.globalCreativeDirections?.dialogue || '';
        if (globalDialogueDirection && appState.generatedScenes) {
            Object.keys(appState.generatedScenes).forEach(actKey => {
                const scenes = appState.generatedScenes[actKey];
                if (scenes && Array.isArray(scenes)) {
                    scenes.forEach((_, sceneIndex) => {
                        const dialogueKey = `${actKey}_${sceneIndex}`;
                        if (!composed.dialogue[dialogueKey]) {
                            composed.dialogue[dialogueKey] = globalDialogueDirection;
                        }
                    });
                }
            });
        }
        
        const endTime = Date.now();
        const totalDirections = Object.keys(composed.plotPoints).length + 
                               Object.keys(composed.scenes).length + 
                               Object.keys(composed.dialogue).length;
        
        console.log(`🎨 Composed ${totalDirections} creative directions in ${endTime - startTime}ms`);
        console.log('🎨 Creative directions breakdown:', {
            plotPoints: Object.keys(composed.plotPoints).length,
            scenes: Object.keys(composed.scenes).length,
            dialogue: Object.keys(composed.dialogue).length
        });
        
        return composed;
    }

    // Optimized version that only gets relevant creative directions for a specific context
    getRelevantCreativeDirections(context = {}) {
        const { type, actKey, plotPointIndex, sceneIndex } = context;
        
        const relevant = {
            plotPoints: {},
            scenes: {},
            dialogue: {}
        };
        
        switch (type) {
            case 'plotPoints':
                if (actKey) {
                    // Only include directions for this specific act
                    const direction = this.getEffectiveCreativeDirection('plotPoints', actKey);
                    if (direction) relevant.plotPoints[actKey] = direction;
                }
                break;
                
            case 'scenes':
                if (actKey && plotPointIndex !== undefined) {
                    // Only include directions for this specific plot point
                    const sceneKey = `${actKey}_${plotPointIndex}`;
                    const direction = this.getEffectiveCreativeDirection('scenes', sceneKey);
                    if (direction) relevant.scenes[sceneKey] = direction;
                }
                break;
                
            case 'dialogue':
                if (actKey && sceneIndex !== undefined) {
                    // Only include directions for this specific scene
                    const dialogueKey = `${actKey}_${sceneIndex}`;
                    const direction = this.getEffectiveCreativeDirection('dialogue', dialogueKey);
                    if (direction) relevant.dialogue[dialogueKey] = direction;
                }
                break;
                
            default:
                // Fallback to full composition for backwards compatibility
                return this.getComposedCreativeDirections();
        }
        
        console.log(`🎯 Relevant creative directions for ${type}:`, relevant);
        return relevant;
    }
}

// =====================================================
// Global Instance and Legacy Compatibility
// =====================================================

// Create global instance
window.creativeDirectionManager = new CreativeDirectionManager();

// Legacy compatibility functions for backward compatibility
function getEffectiveCreativeDirection(stepType, elementKey) {
    return window.creativeDirectionManager.getEffectiveCreativeDirection(stepType, elementKey);
}

function getComposedCreativeDirections() {
    return window.creativeDirectionManager.getComposedCreativeDirections();
}

function getRelevantCreativeDirections(context = {}) {
    return window.creativeDirectionManager.getRelevantCreativeDirections(context);
}

console.log('🔧 CreativeDirectionManager component loaded'); 