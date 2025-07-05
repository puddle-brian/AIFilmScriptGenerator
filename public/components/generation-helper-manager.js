// =====================================================
// Generation Helper Manager Component
// =====================================================
// Helper and utility functions that support generation processes
// (completion checking, data normalization, numbering, etc.)

class GenerationHelperManager {
    constructor() {
        console.log('🔧 GenerationHelperManager initialized');
    }

    // Check if all plot points are generated and enable continue button
    checkPlotPointsCompletion() {
        if (!appState.generatedStructure || !appState.plotPoints) return false;
        
        const structureKeys = Object.keys(appState.generatedStructure);
        const plotPointsKeys = Object.keys(appState.plotPoints || {});
        
        const allGenerated = structureKeys.every(key => plotPointsKeys.includes(key));
        
        // Update continue button state
        const continueBtn = document.querySelector('#step4 .step-actions .btn-primary');
        if (continueBtn) {
            if (allGenerated) {
                continueBtn.disabled = false;
                continueBtn.textContent = 'Continue to Scenes';
            } else {
                continueBtn.disabled = true;
                continueBtn.textContent = `Generate Plot Points (${plotPointsKeys.length}/${structureKeys.length})`;
            }
        }
        
        // 🔥 FIX: Update navigation system when plot points completion changes
        updateStepIndicators();
        updateUniversalNavigation();
        updateBreadcrumbNavigation();
        
        return allGenerated;
    }

    // Check if plot points exist for a structural element
    hasPlotPointsForElement(structureKey) {
        if (!appState.plotPoints || !appState.plotPoints[structureKey]) {
            return false;
        }
        
        const plotPointsData = appState.plotPoints[structureKey];
        
        // Handle direct array format
        if (Array.isArray(plotPointsData)) {
            return plotPointsData.length > 0;
        }
        
        // Handle database object format with plotPoints array inside
        if (typeof plotPointsData === 'object' && plotPointsData !== null) {
            const plotPointsArray = plotPointsData.plotPoints;
            return Array.isArray(plotPointsArray) && plotPointsArray.length > 0;
        }
        
        return false;
    }

    // Check if all previous acts have plot points generated (prerequisite for current act)
    canGeneratePlotPointsForElement(structureKey) {
        if (!appState.generatedStructure) return false;
        
        const structureKeys = Object.keys(appState.generatedStructure);
        const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
        const currentActIndex = chronologicalKeys.indexOf(structureKey);
        
        // First act can always generate plot points
        if (currentActIndex === 0) return true;
        
        // Check if all previous acts have plot points
        for (let i = 0; i < currentActIndex; i++) {
            const previousActKey = chronologicalKeys[i];
            if (!this.hasPlotPointsForElement(previousActKey)) {
                return false;
            }
        }
        
        return true;
    }

    // Normalize generated scenes data structure
    normalizeGeneratedScenes(scenesData) {
        if (!scenesData || typeof scenesData !== 'object') {
            return {};
        }
        
        const normalizedScenes = {};
        
        Object.entries(scenesData).forEach(([structureKey, sceneData]) => {
            if (Array.isArray(sceneData)) {
                // Already in the correct format
                normalizedScenes[structureKey] = sceneData;
            } else if (sceneData && typeof sceneData === 'object') {
                // Convert nested object structure to flat array
                const scenesArray = [];
                
                // Check if it's a nested structure with plot points
                if (sceneData.scenes && Array.isArray(sceneData.scenes)) {
                    // Server format: { scenes: [...] }
                    scenesArray.push(...sceneData.scenes);
                } else {
                    // Check for plot point structure: { plot_point_0: {...}, plot_point_1: {...} }
                    Object.entries(sceneData).forEach(([plotPointKey, plotPointData]) => {
                        if (plotPointKey.startsWith('plot_point_') && plotPointData && plotPointData.scenes) {
                            const plotPointIndex = parseInt(plotPointKey.replace('plot_point_', ''));
                            plotPointData.scenes.forEach(scene => {
                                // Add metadata about which plot point this scene came from
                                scenesArray.push({
                                    ...scene,
                                    plotPointIndex: plotPointIndex,
                                    plotPoint: plotPointData.plotPoint || '',
                                    isKeyPlot: plotPointData.isKeyPlot || false
                                });
                            });
                        }
                    });
                }
                
                normalizedScenes[structureKey] = scenesArray;
            } else {
                // Fallback: initialize as empty array
                normalizedScenes[structureKey] = [];
            }
        });
        
        return normalizedScenes;
    }

    // Normalize generated dialogues data structure
    normalizeGeneratedDialogues(dialoguesData) {
        if (!dialoguesData || typeof dialoguesData !== 'object') {
            return {};
        }
        
        const normalizedDialogues = {};
        
        Object.entries(dialoguesData).forEach(([sceneId, dialogueData]) => {
            if (typeof dialogueData === 'string') {
                // Already in the correct format (flat string)
                normalizedDialogues[sceneId] = dialogueData;
            } else if (dialogueData && typeof dialogueData === 'object') {
                // Convert nested object structure to flat string
                if (dialogueData.dialogue) {
                    // Server format: { dialogue: "text", sceneId: "...", scene: {...}, generatedAt: "..." }
                    normalizedDialogues[sceneId] = dialogueData.dialogue;
                } else {
                    // Fallback: use the whole object as JSON (shouldn't happen, but just in case)
                    normalizedDialogues[sceneId] = JSON.stringify(dialogueData);
                }
            } else {
                // Fallback: initialize as empty string
                normalizedDialogues[sceneId] = '';
            }
        });
        
        return normalizedDialogues;
    }

    // Helper function to calculate hierarchical scene number
    calculateHierarchicalSceneNumber(structureKey, sceneIndex, scene) {
        // Get the act number from the structure keys
        const structureKeys = appState.generatedStructure ? Object.keys(appState.generatedStructure) : [];
        const actNumber = structureKeys.indexOf(structureKey) + 1;
        
        // Get plot points for this structure
        const plotPoints = appState.plotPoints && appState.plotPoints[structureKey] 
            ? appState.plotPoints[structureKey].plotPoints || []
            : [];
        
        // If scene has plotPointIndex, use it
        if (scene.plotPointIndex !== undefined && scene.plotPointIndex !== null) {
            const plotPointNumber = scene.plotPointIndex + 1;
            
            // Count scenes in the same plot point that come before this one
            const allScenes = appState.generatedScenes[structureKey] || [];
            const scenesInSamePlotPoint = allScenes.filter(s => s.plotPointIndex === scene.plotPointIndex);
            const positionInPlotPoint = scenesInSamePlotPoint.findIndex(s => s === scene) + 1;
            
            return `${actNumber}.${plotPointNumber}.${positionInPlotPoint}`;
        }
        
        // Fallback: if no plotPointIndex, try to estimate based on position
        if (plotPoints.length > 0) {
            const plotPointNumber = Math.floor(sceneIndex / Math.ceil(appState.generatedScenes[structureKey].length / plotPoints.length)) + 1;
            const positionInPlotPoint = (sceneIndex % Math.ceil(appState.generatedScenes[structureKey].length / plotPoints.length)) + 1;
            return `${actNumber}.${plotPointNumber}.${positionInPlotPoint}`;
        }
        
        // Final fallback: just use scene index with act number
        return `${actNumber}.1.${sceneIndex + 1}`;
    }
}

// Create global instance
const generationHelperManager = new GenerationHelperManager();

console.log('🔧 GenerationHelperManager component loaded successfully'); 