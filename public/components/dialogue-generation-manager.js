/**
 * Dialogue Generation Manager
 * Handles all dialogue generation functionality
 * Part of Micro-Step 7: Frontend Refactoring
 */

// Logging configuration - set to false to disable verbose logging
// To enable debugging, set enabled: true and the specific categories you want to see
const DIALOGUE_DEBUG = {
    enabled: false,           // Master switch for all dialogue logging
    sceneLoading: false,      // Scene loading/lookup logs (most verbose - causes performance issues)
    generation: false,        // Generation process logs
    storage: false,          // Storage operation logs
    essential: true          // Keep essential logs for production (errors, completion)
};

// HOW TO USE:
// For production: Keep enabled: false, essential: true (minimal essential logs only)
// For debugging scene issues: enabled: true, sceneLoading: true
// For debugging generation: enabled: true, generation: true
// For debugging storage: enabled: true, storage: true
// For completely silent: enabled: false, essential: false

// Debug logging helper
function debugLog(category, ...args) {
    if (DIALOGUE_DEBUG.enabled && DIALOGUE_DEBUG[category]) {
        console.log(...args);
    } else if (category === 'essential' && DIALOGUE_DEBUG.essential) {
        console.log(...args);
    }
}

class DialogueGenerationManager {
    constructor() {
        console.log('🎬 DialogueGenerationManager initialized');
    }

    // Navigate to dialogue generation (removed approval concept)
    goToDialogue() {
        if (!appState.generatedScenes || Object.keys(appState.generatedScenes).length === 0) {
            showToast('No scenes available for dialogue generation.', 'error');
            return;
        }
        
        displayDialogueGeneration();
        goToStep(6); // Go to dialogue step (now step 6)
        showToast('Ready to generate dialogue!', 'success');
    }

    // Save dialogue content function
    async saveDialogueContent(structureKey, sceneIndex, content) {
        if (!appState.projectPath) {
            throw new Error('No project loaded');
        }
        
        const response = await fetch(`/api/edit-content/dialogue/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save dialogue content');
        }
        
        return await response.json();
    }

    // Helper function to preview dialogue prompts for all scenes in a specific act
    async previewAllDialoguePromptsForAct(structureKey) {
        const sceneGroup = appState.generatedScenes[structureKey];
        if (!sceneGroup || !Array.isArray(sceneGroup) || sceneGroup.length === 0) {
            showToast(`No scenes available in ${structureKey} for dialogue preview.`, 'error');
            return;
        }
        
        // For now, just preview the first scene's prompt with a note about the act
        showToast(`Dialogue prompt preview for individual scenes coming soon! Use the scene-level preview buttons for now.`, 'info');
    }

    // Generate dialogue for a specific scene
    async generateDialogue(structureKey, sceneIndex) {
        const scene = appState.generatedScenes[structureKey][sceneIndex];
        const sceneId = `${structureKey}-${sceneIndex}`;
        
        try {
            showLoading('Generating dialogue...');
            
            // Send creative directions for dialogue
            
            const response = await fetch('/api/generate-dialogue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    scene: {
                        ...scene,
                        id: sceneId,  // 🔥 FIX: Pass the sceneId that frontend expects
                        sceneIndex: sceneIndex,
                        structureKey: structureKey
                    },
                    storyInput: appState.storyInput,
                    context: `This scene is part of the ${structureKey.replace(/_/g, ' ')} section of the story.`,
                    projectPath: appState.projectPath,
                    model: getSelectedModel(),
                    creativeDirections: getComposedCreativeDirections() // 🆕 Send composed creative directions (global + individual)
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                appState.generatedDialogues[sceneId] = data.dialogue;
                
                // Update the editable block if it exists - search for the correct block using metadata
                if (window.editableBlocks) {
                    // Find the editable block that matches this scene
                    Object.values(window.editableBlocks).forEach(block => {
                        if (block.metadata && 
                            block.metadata.structureKey === structureKey && 
                            block.metadata.sceneIndex === sceneIndex &&
                            block.type === 'dialogue') {
                            block.updateContent(data.dialogue);
                        }
                    });
                }
                
                // 🔥 FIX: Update navigation system when individual dialogue is generated
                updateStepIndicators();
                updateUniversalNavigation();
                updateBreadcrumbNavigation();
                
                // Update the "Generate All Dialogue" button in case this was the first/last scene to get dialogue
                updateGenerateAllDialogueButton();
                
                showToast('Dialogue generated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate dialogue');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error generating dialogue:', error);
            showToast('Error generating dialogue. Please try again.', 'error');
            hideLoading();
        }
    }

    // Helper function to generate dialogue for all scenes in a specific act
    async generateDialogueForPlotPoint(structureKey, plotPointIndex) {
        try {
            const sceneGroup = appState.generatedScenes[structureKey];
            if (!sceneGroup || !Array.isArray(sceneGroup)) {
                showToast('No scenes found for dialogue generation', 'error');
                return;
            }

            // Find scenes that belong to this plot point
            const plotPointScenes = sceneGroup.filter(scene => 
                scene.plotPointIndex === plotPointIndex
            );

            if (plotPointScenes.length === 0) {
                showToast('No scenes found for this plot point', 'error');
                return;
            }

            // Get plot point info for display
            const plotPoints = appState.plotPoints ? appState.plotPoints[structureKey] : null;
            const plotPoint = plotPoints && plotPoints[plotPointIndex] ? plotPoints[plotPointIndex] : `Plot Point ${plotPointIndex + 1}`;
            
            // Calculate act number for display
            const structureKeys = Object.keys(appState.generatedStructure);
            const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
            const actNumber = chronologicalKeys.indexOf(structureKey) + 1;
            const plotPointNumber = `${actNumber}.${plotPointIndex + 1}`;

            showToast(`Generating dialogue for ${plotPointScenes.length} scenes in Plot Point ${plotPointNumber}...`, 'info');

            // Generate dialogue for each scene in the plot point
            let successCount = 0;
            const errors = [];

            for (const scene of plotPointScenes) {
                try {
                    const globalSceneIndex = sceneGroup.indexOf(scene);
                    await this.generateDialogue(structureKey, globalSceneIndex);
                    successCount++;
                } catch (error) {
                    console.error(`Error generating dialogue for scene ${scene.title || 'Untitled'}:`, error);
                    errors.push(`Scene "${scene.title || 'Untitled'}": ${error.message}`);
                }
            }

            // Show completion message
            if (successCount === plotPointScenes.length) {
                showToast(`✅ Generated dialogue for all ${successCount} scenes in Plot Point ${plotPointNumber}`, 'success');
            } else if (successCount > 0) {
                showToast(`⚠️ Generated dialogue for ${successCount}/${plotPointScenes.length} scenes in Plot Point ${plotPointNumber}`, 'warning');
            } else {
                showToast(`❌ Failed to generate dialogue for Plot Point ${plotPointNumber}`, 'error');
            }

            if (errors.length > 0) {
                console.error('Dialogue generation errors:', errors);
            }

        } catch (error) {
            console.error('Error in generateDialogueForPlotPoint:', error);
            showToast('Error generating dialogue for plot point', 'error');
        }
    }

    async generateAllDialogueForAct(structureKey) {
        const sceneGroup = appState.generatedScenes[structureKey];
        if (!sceneGroup || !Array.isArray(sceneGroup) || sceneGroup.length === 0) {
            showToast(`No scenes available in ${structureKey} for dialogue generation.`, 'error');
            return;
        }
        
        try {
            showLoading(`Generating dialogue for all ${sceneGroup.length} scenes in ${structureKey}...`);
            
            // Calculate global scene indices for this act
            let globalSceneIndex = 0;
            const structureKeys = Object.keys(appState.generatedScenes);
            const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
            
            // Count scenes in acts that come before this one
            for (const key of chronologicalKeys) {
                if (key === structureKey) break;
                const scenes = appState.generatedScenes[key];
                if (scenes && Array.isArray(scenes)) {
                    globalSceneIndex += scenes.length;
                }
            }
            
            // Generate dialogue for each scene using the correct global index
            for (let i = 0; i < sceneGroup.length; i++) {
                await this.generateDialogue(structureKey, globalSceneIndex + i);
            }
            
            hideLoading();
            showToast(`Successfully generated dialogue for all scenes in ${structureKey}!`, 'success');
        } catch (error) {
            console.error(`Error generating dialogue for ${structureKey}:`, error);
            showToast(`Error generating dialogue for ${structureKey}. Please try again.`, 'error');
            hideLoading();
        }
    }

    // Generate dialogue for all scenes that exist
    async generateAllDialogue() {
        console.log('generateAllDialogue() called!');
        
        if (!appState.generatedScenes || !appState.projectPath) {
            showToast('No scenes available to generate dialogue for.', 'error');
            return;
        }
        
        // Collect all scenes that exist
        const allScenes = [];
        Object.entries(appState.generatedScenes).forEach(([structureKey, sceneGroup]) => {
            if (Array.isArray(sceneGroup)) {
                sceneGroup.forEach((scene, index) => {
                    const sceneId = `${structureKey}-${index}`;
                    allScenes.push({
                        structureKey: structureKey,
                        sceneIndex: index,
                        scene: scene,
                        sceneId: sceneId
                    });
                    console.log(`📋 Collected scene: ${sceneId} (${scene.title || 'Untitled'})`);
                });
            }
        });
        
        if (allScenes.length === 0) {
            showToast('No scenes found. Please generate scenes first in Step 5.', 'error');
            return;
        }
        
        // Check authentication first
        if (!appState.isAuthenticated) {
            authManager.showRegistrationModal();
            return;
        }
        
        // 🔥 Credit check before generation
        if (!await window.creditWidget.canAfford(30)) {
            showToast('Insufficient credits for dialogue generation (30 credits required)', 'error');
            return;
        }
        
        // Initialize generatedDialogues if it doesn't exist
        if (!appState.generatedDialogues) {
            appState.generatedDialogues = {};
        }
        
        try {
            // Start hierarchical progress tracking
            progressTracker.start(allScenes.length, 'Generating Dialogue', 'scenes');
            
            // Create scene numbering map to track hierarchical position
            const sceneNumberingMap = {};
            Object.entries(appState.generatedScenes).forEach(([structureKey, sceneGroup]) => {
                if (Array.isArray(sceneGroup)) {
                    // Get act number
                    const actKeys = Object.keys(appState.generatedStructure);
                    const actNumber = actKeys.indexOf(structureKey) + 1;
                    
                    // Group scenes by plot point to get proper numbering
                    const scenesByPlotPoint = {};
                    sceneGroup.forEach((scene, index) => {
                        const plotPointIndex = scene.plotPointIndex || 0;
                        if (!scenesByPlotPoint[plotPointIndex]) {
                            scenesByPlotPoint[plotPointIndex] = [];
                        }
                        scenesByPlotPoint[plotPointIndex].push({ scene, originalIndex: index });
                    });
                    
                    // Create hierarchical numbering for each scene
                    Object.keys(scenesByPlotPoint).forEach(plotPointIndex => {
                        const plotPointScenes = scenesByPlotPoint[plotPointIndex];
                        plotPointScenes.forEach(({ originalIndex }, sceneIndex) => {
                            const sceneId = `${structureKey}-${originalIndex}`;
                            const hierarchicalNumber = `${actNumber}.${parseInt(plotPointIndex) + 1}.${sceneIndex + 1}`;
                            sceneNumberingMap[sceneId] = hierarchicalNumber;
                        });
                    });
                }
            });
            
            // Generate dialogue for each scene sequentially
            for (let i = 0; i < allScenes.length; i++) {
                const sceneData = allScenes[i];
                const { structureKey, sceneIndex, scene, sceneId } = sceneData;
                const sceneNumber = i + 1;
                
                // Get hierarchical number for this scene
                const hierarchicalNumber = sceneNumberingMap[sceneId] || sceneNumber.toString();
                
                debugLog('generation', `Generating dialogue for scene: ${scene.title || 'Untitled'} (${sceneId})`);
                
                // Update hierarchy display
                progressTracker.updateHierarchy(sceneNumber, allScenes.length);
                
                const response = await fetch('/api/generate-dialogue', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': appState.apiKey
                    },
                    body: JSON.stringify({
                        scene: {
                            ...scene,
                            id: sceneId,  // 🔥 FIX: Pass the sceneId that frontend expects
                            sceneIndex: sceneIndex,
                            structureKey: structureKey
                        },
                        storyInput: appState.storyInput,
                        context: `This scene is part of the ${structureKey.replace(/_/g, ' ')} section of the story.`,
                        projectPath: appState.projectPath,
                        model: getSelectedModel(),
                        creativeDirections: getRelevantCreativeDirections('dialogue', { structureKey, sceneIndex }) // 🚀 OPTIMIZED: Send only relevant creative directions
                    }),
                    signal: progressTracker.abortController?.signal
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    debugLog('generation', `🎬 Dialogue generated for ${sceneId}:`, data.dialogue?.substring(0, 100) + '...');
                    
                    // Store dialogue in app state
                    appState.generatedDialogues[sceneId] = data.dialogue;
                    debugLog('storage', `💾 Stored dialogue with key: ${sceneId}`);
                    
                    // 🔥 REAL-TIME UPDATE: Update existing editable blocks immediately
                    if (window.editableBlocks && data.dialogue) {
                        Object.values(window.editableBlocks).forEach(block => {
                            if (block.metadata && 
                                block.metadata.structureKey === structureKey && 
                                block.metadata.sceneIndex === sceneIndex &&
                                block.type === 'dialogue' &&
                                block.metadata.sceneId === sceneId) {
                                console.log(`🔄 Real-time update: updating block for ${sceneId}`);
                                block.updateContent(data.dialogue);
                            }
                        });
                    }
                    
                    // Save to database
                    await this.saveDialogueContent(structureKey, sceneIndex, data.dialogue);
                    
                    // Update preview with the dialogue for this scene using hierarchical numbering
                    if (data.dialogue) {
                        progressTracker.updatePreview(data.dialogue, hierarchicalNumber);
                    }
                    
                    // Increment progress step
                    progressTracker.incrementStep(`Generated dialogue for "${scene.title || 'Untitled'}"`);
                } else {
                    throw new Error(`Failed to generate dialogue for scene "${scene.title || 'Untitled'}": ${data.error}`);
                }
            }
            
            // Refresh the dialogue display after all dialogues are generated
            // This will recreate all dialogue blocks with the updated content from appState.generatedDialogues
            debugLog('generation', `🔄 Refreshing dialogue display with ${Object.keys(appState.generatedDialogues).length} dialogue entries`);
            this.displayDialogueGeneration();
            
            // 🔥 Refresh credits after successful generation
            window.creditWidget.refreshAfterOperation();
            
            // 🔥 FIX: Update navigation system when dialogue is generated
            updateStepIndicators();
            updateUniversalNavigation();
            updateBreadcrumbNavigation();
            
            progressTracker.finish();
            showToast(`Successfully generated dialogue for ${allScenes.length} scenes!`, 'success');
            
            updateGenerateAllDialogueButton(); // Update button to show "Regenerate All Dialogue"
            saveToLocalStorage();
            
        } catch (error) {
            if (error.name === 'AbortError') {
                debugLog('essential', 'Dialogue generation cancelled by user');
                return; // Don't show error toast for cancellation
            }
            
            console.error('Error generating all dialogue:', error);
            showToast(`Error generating dialogue: ${error.message}`, 'error');
            progressTracker.finish();
        }
    }

    // Preview all dialogue generation prompts
    async previewAllDialoguePrompts() {
        if (!appState.generatedScenes || !appState.storyInput || !appState.projectPath) {
            showToast('No scenes, story data, or project available for prompt preview.', 'error');
            return;
        }
        
        // Collect all scenes that exist
        const allScenes = [];
        Object.entries(appState.generatedScenes).forEach(([structureKey, sceneGroup]) => {
            if (Array.isArray(sceneGroup)) {
                sceneGroup.forEach((scene, index) => {
                    allScenes.push({
                        structureKey: structureKey,
                        sceneIndex: index,
                        scene: scene,
                        sceneId: `${structureKey}-${index}`
                    });
                });
            }
        });
        
        if (allScenes.length === 0) {
            showToast('No scenes found. Please generate scenes first in Step 5.', 'error');
            return;
        }
        
        // For now, show a summary of how many prompts would be generated
        showToast(`Dialogue generation would create ${allScenes.length} individual prompts across ${Object.keys(appState.generatedScenes).length} acts. Use scene-level preview buttons for detailed prompts.`, 'info');
    }

    // Display dialogue generation interface
    displayDialogueGeneration() {
        const container = document.getElementById('dialogueContent');
        container.innerHTML = '';
        
        debugLog('sceneLoading', `🎬 displayDialogueGeneration() called - clearing container and rebuilding`);

        if (appState.generatedStructure && appState.generatedScenes) {
            debugLog('sceneLoading', 'Displaying dialogue with hierarchical structure:', appState.generatedStructure);
            
            // Display dialogue in chronological order with hierarchical structure
            const structureKeys = Object.keys(appState.generatedStructure);
            const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
            
            chronologicalKeys.forEach((structureKey) => {
                const storyAct = appState.generatedStructure[structureKey];
                const sceneGroup = appState.generatedScenes[structureKey];
                const plotPoints = appState.plotPoints ? appState.plotPoints[structureKey] : null;
                const hasScenes = sceneGroup && Array.isArray(sceneGroup) && sceneGroup.length > 0;
                const hasPlotPoints = hasPlotPointsForElement(structureKey);
                const sceneCount = hasScenes ? sceneGroup.length : 0;
                
                debugLog('sceneLoading', `Processing dialogue for ${structureKey}: hasScenes=${hasScenes}, sceneCount=${sceneCount}, hasPlotPoints=${hasPlotPoints}`);
                
                // Show all acts in hierarchy - even those without scenes/plot points
                
                const groupElement = document.createElement('div');
                groupElement.className = 'dialogue-group';
                groupElement.id = `dialogue-group-${structureKey}`;
                
                // Get act progress notation (X/Y format) - show all acts now, not just those with scenes
                const totalActs = chronologicalKeys.length;
                const currentActIndex = chronologicalKeys.indexOf(structureKey);
                const actProgress = currentActIndex !== -1 ? `${currentActIndex + 1}/${totalActs}` : '';
                const actName = storyAct.name || structureKey.replace(/_/g, ' ').toUpperCase();
                const titleWithProgress = actProgress ? `${actProgress} ${actName}` : actName;
                
                // Generate appropriate buttons and warnings based on what's available
                const canGenerateDialogue = hasScenes;
                
                // Check if dialogue already exists for any scenes in this act
                const hasExistingDialogue = hasScenes && sceneGroup.some(scene => {
                    const sceneId = `${structureKey}-${sceneGroup.indexOf(scene)}`;
                    return appState.generatedDialogues && appState.generatedDialogues[sceneId];
                });
                const dialogueActionText = hasExistingDialogue ? 'Regenerate' : 'Generate';
                const dialogueActionIcon = hasExistingDialogue ? '🔄' : '💬';
                
                const generateButtonClass = canGenerateDialogue ? 'btn btn-primary btn-sm' : 'btn btn-primary btn-sm btn-disabled';
                const generateButtonTitle = canGenerateDialogue ? 
                    `${dialogueActionText} dialogue for all scenes in Act ${actProgress}` : 
                    'No scenes available for dialogue generation';
                const generateButtonOnClick = canGenerateDialogue ? 
                    `generateAllDialogueForAct('${structureKey}')` : 
                    'showToast("Generate scenes first in Step 5", "error")';
                
                groupElement.innerHTML = `
                    <div class="dialogue-group-header compact">
                        <h4 class="dialogue-act-title">${titleWithProgress}</h4>
                        <div class="dialogue-group-actions">
                            <button class="${generateButtonClass}" onclick="${generateButtonOnClick}" title="${generateButtonTitle}" ${canGenerateDialogue ? '' : 'disabled'}>
                                ${dialogueActionIcon} ${dialogueActionText} Dialogue for Act ${actProgress}
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="previewAllDialoguePromptsForAct('${structureKey}')" title="Preview dialogue prompts for this act" ${canGenerateDialogue ? '' : 'disabled'}>
                                🔍 Preview All
                            </button>
                        </div>
                    </div>
                    <div class="dialogue-act-description compact">
                        <p class="act-description-text">${storyAct.description}</p>
                    </div>
                    <div id="hierarchical-dialogue-content-${structureKey}" class="hierarchical-dialogue-content">
                        ${!hasPlotPoints && !hasScenes ? `
                            <div class="dialogue-prerequisites-warning">
                                <p><strong>⚠️ No plot points or scenes found.</strong> Please generate plot points in Step 4 and scenes in Step 5 first.</p>
                                <p><em>Dialogue generation will be disabled until scenes are created.</em></p>
                            </div>
                        ` : !hasPlotPoints && hasScenes ? `
                            <div class="dialogue-plot-points-warning">
                                <p><strong>⚠️ Limited structure:</strong> These scenes were generated without plot points.</p>
                            </div>
                        ` : !hasScenes ? `
                            <div class="dialogue-scenes-warning">
                                <p><strong>⚠️ No scenes found.</strong> Please generate scenes in Step 5 first.</p>
                                <p><em>Dialogue generation will be disabled until scenes are created.</em></p>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                debugLog('sceneLoading', `Appending dialogue group element for ${structureKey} to container`);
                container.appendChild(groupElement);
                
                // Always display hierarchical dialogue content (even if empty)
                debugLog('sceneLoading', `Displaying hierarchical dialogue content for ${structureKey}: ${plotPoints?.length || 0} plot points, ${sceneCount} scenes`);
                this.displayHierarchicalDialogueContent(structureKey, plotPoints, sceneGroup, currentActIndex + 1);
            });
            
            debugLog('sceneLoading', 'Finished creating all dialogue groups');
        } else {
            debugLog('sceneLoading', 'No structure/scenes available - showing fallback message');
            container.innerHTML = '<p>No scenes available for dialogue generation. Please complete Steps 1-5 first.</p>';
        }

        // Handle any pending dialogue restoration from page reload
        if (appState.pendingDialogueRestore) {
            debugLog('storage', 'Processing pending dialogue restoration:', appState.pendingDialogueRestore);
            
            // Merge pending dialogue into current state if not already present
            Object.entries(appState.pendingDialogueRestore).forEach(([dialogueKey, dialogue]) => {
                if (!appState.generatedDialogues[dialogueKey]) {
                    appState.generatedDialogues[dialogueKey] = dialogue;
                    debugLog('storage', `Restored dialogue for: ${dialogueKey}`);
                }
            });
            
            // Clear the pending restoration
            delete appState.pendingDialogueRestore;
            
            // Refresh the dialogue display to show restored content
            setTimeout(() => {
                this.displayDialogueGeneration();
            }, 100);
        }
        
        debugLog('sceneLoading', 'Hierarchical dialogue interface displayed with existing content restored');
    }

    // Display hierarchical dialogue content: Act -> Plot Points -> Scenes (with dialogue)
    // This mirrors the scenes hierarchy but with compact act/plot point levels to focus on dialogue
    displayHierarchicalDialogueContent(structureKey, plotPoints, sceneGroup, actNumber) {
        const container = document.getElementById(`hierarchical-dialogue-content-${structureKey}`);
        if (!container) return;
        
        // Clear any existing content
        container.innerHTML = '';
        
        const hasPlotPoints = hasPlotPointsForElement(structureKey);
        const hasScenes = sceneGroup && Array.isArray(sceneGroup) && sceneGroup.length > 0;
        
        if (!hasPlotPoints && !hasScenes) {
            container.innerHTML = '<p class="no-content">No plot points or scenes available for dialogue generation.</p>';
            return;
        }
        
        if (!hasPlotPoints && hasScenes) {
            // Fallback: show scenes without plot point structure
            container.innerHTML = `
                <div class="dialogue-scenes-fallback">
                    <h4>⚠️ Scene Dialogues (Generated without plot points)</h4>
                    <p class="warning-text">These scenes were generated without the hierarchical plot point structure.</p>
                    <div class="flat-dialogue-scenes-container"></div>
                </div>
            `;
            const flatContainer = container.querySelector('.flat-dialogue-scenes-container');
            this.displayDialogueScenesFlat(structureKey, sceneGroup, flatContainer);
            return;
        }
        
        // Create compact hierarchical structure: Plot Points -> Dialogue Scenes
        // Handle both direct array and database object formats
        let plotPointsArray = plotPoints;
        if (plotPoints && typeof plotPoints === 'object' && !Array.isArray(plotPoints)) {
            plotPointsArray = plotPoints.plotPoints || [];
        }
        
        plotPointsArray.forEach((plotPoint, plotPointIndex) => {
            const plotPointNumber = `${actNumber}.${plotPointIndex + 1}`;
            
            // Find scenes that belong to this plot point
            const plotPointScenes = hasScenes ? sceneGroup.filter(scene => 
                scene.plotPointIndex === plotPointIndex
            ) : [];
            
            const plotPointElement = document.createElement('div');
            plotPointElement.className = 'hierarchical-dialogue-plot-point';
            plotPointElement.id = `dialogue-plot-point-${structureKey}-${plotPointIndex}`;
            
            // Create the plot point header and scenes content
            this.createDialoguePlotPointElement(plotPointElement, plotPoint, plotPointIndex, plotPointNumber, plotPointScenes, structureKey, hasScenes, sceneGroup, actNumber);
            
            container.appendChild(plotPointElement);
        });
    }

    // Helper method to create dialogue plot point element with scenes
    createDialoguePlotPointElement(plotPointElement, plotPoint, plotPointIndex, plotPointNumber, plotPointScenes, structureKey, hasScenes, sceneGroup, actNumber) {
        // Compact plot point header
        const plotPointHeader = document.createElement('div');
        plotPointHeader.className = 'dialogue-plot-point-header compact';
        
        // Determine if we should show the generate button
        const hasScenesForButton = plotPointScenes.length > 0;
        
        // Check if dialogue already exists for any scenes in this plot point
        const hasExistingDialogueForPlotPoint = hasScenesForButton && sceneGroup.some((scene, originalIndex) => {
            if (scene.plotPointIndex === plotPointIndex) {
                const sceneId = `${structureKey}-${originalIndex}`;
                return appState.generatedDialogues && appState.generatedDialogues[sceneId];
            }
            return false;
        });
        const plotPointDialogueActionText = hasExistingDialogueForPlotPoint ? 'Regenerate' : 'Generate';
        const plotPointDialogueActionIcon = hasExistingDialogueForPlotPoint ? '🔄' : '💬';
        
        const generateButtonClass = hasScenesForButton ? 'btn btn-primary btn-sm' : 'btn btn-primary btn-sm btn-disabled';
        const generateButtonTitle = hasScenesForButton ? 
            `${plotPointDialogueActionText} dialogue for all ${plotPointScenes.length} scene${plotPointScenes.length !== 1 ? 's' : ''} in this plot point` : 
            'No scenes available for dialogue generation';
        const generateButtonOnClick = hasScenesForButton ? 
            `generateDialogueForPlotPoint('${structureKey}', ${plotPointIndex})` : 
            'showToast("Generate scenes first in Step 5", "error")';
        
        plotPointHeader.innerHTML = `
            <h5 class="dialogue-plot-point-title">
                <span class="plot-point-number">${plotPointNumber}</span>
                <span class="plot-point-text">${plotPoint}</span>
            </h5>
            <div class="dialogue-plot-point-meta">
                <span class="scene-count">${plotPointScenes.length} scene${plotPointScenes.length !== 1 ? 's' : ''}</span>
                <button class="${generateButtonClass}" onclick="${generateButtonOnClick}" title="${generateButtonTitle}" ${hasScenesForButton ? '' : 'disabled'}>
                    ${plotPointDialogueActionIcon} ${plotPointDialogueActionText} Dialogue for Plot Point ${plotPointNumber}
                </button>
            </div>
        `;
        
        plotPointElement.appendChild(plotPointHeader);
        
        // Dialogue scenes container for this plot point
        const scenesContainer = document.createElement('div');
        scenesContainer.className = 'dialogue-plot-point-scenes';
        scenesContainer.id = `dialogue-scenes-${structureKey}-${plotPointIndex}`;
        
        if (plotPointScenes.length > 0) {
            // Display dialogue scenes for this plot point
            // Use the original sceneGroup indexing to ensure scene IDs match generation
            let plotPointSceneCounter = 0;
            sceneGroup.forEach((scene, originalIndex) => {
                // Only process scenes that belong to this plot point
                if (scene.plotPointIndex === plotPointIndex) {
                    plotPointSceneCounter++;
                    const sceneNumber = `${plotPointNumber}.${plotPointSceneCounter}`;
                    const sceneId = `${structureKey}-${originalIndex}`;  // Use original index for consistent scene ID
                    
                    const sceneElement = document.createElement('div');
                    sceneElement.className = 'hierarchical-dialogue-scene';
                    sceneElement.id = `dialogue-scene-${structureKey}-${plotPointIndex}-${plotPointSceneCounter-1}`;
                    
                    this.createDialogueSceneElement(sceneElement, scene, plotPointSceneCounter-1, sceneNumber, originalIndex, sceneId, structureKey, plotPointIndex);
                    
                    scenesContainer.appendChild(sceneElement);
                }
            });
        } else {
            // No scenes for this plot point yet
            scenesContainer.innerHTML = `
                <div class="no-dialogue-scenes-for-plot-point">
                    <p class="placeholder-text">No scenes available for dialogue generation in this plot point.</p>
                    <p class="info-text">Generate scenes in Step 5 first to enable dialogue generation.</p>
                </div>
            `;
        }
        
        plotPointElement.appendChild(scenesContainer);
    }

    // Helper method to create individual dialogue scene elements
    createDialogueSceneElement(sceneElement, scene, sceneIndex, sceneNumber, globalSceneIndex, sceneId, structureKey, plotPointIndex) {
        // Check if dialogue already exists for this scene
        let dialogueContent = '';
        let hasExistingDialogue = false;
        
        // Format scene description for display
        let sceneDescription = '';
        if (scene.location && scene.time_of_day) {
            sceneDescription = `${scene.location} • ${scene.time_of_day}\n\n`;
        } else if (scene.location) {
            sceneDescription = `${scene.location}\n\n`;
        }
        
        if (scene.description) {
            sceneDescription += `${scene.description}\n\n`;
        }
        
        // Set default content with scene description
        dialogueContent = sceneDescription + 'Click "Generate Dialogue" to create the screenplay for this scene.';
        
        // Check for existing dialogue
        debugLog('sceneLoading', `🔍 Looking for dialogue with sceneId: ${sceneId}`);
        debugLog('sceneLoading', `🔍 Available dialogue keys:`, Object.keys(appState.generatedDialogues || {}));
        
        if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
            dialogueContent = appState.generatedDialogues[sceneId];
            hasExistingDialogue = true;
            debugLog('sceneLoading', `✅ Found existing dialogue for ${sceneId}`);
        } else if (appState.generatedDialogues) {
            // Also check for dialogue matching by scene title (for loaded projects)
            const sceneTitle = scene.title || scene.name || '';
            const normalizedSceneTitle = sceneTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            
            Object.entries(appState.generatedDialogues).forEach(([dialogueKey, dialogue]) => {
                const normalizedDialogueKey = dialogueKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (normalizedSceneTitle === normalizedDialogueKey) {
                    dialogueContent = dialogue;
                    hasExistingDialogue = true;
                }
            });
        }
        
        // Get dialogue creative direction for this scene
        const dialogueKey = `${structureKey}_${globalSceneIndex}`;
        const dialogueDirection = getEffectiveCreativeDirection('dialogue', dialogueKey);
        
        // Format scene description for display
        let displayDescription = '';
        if (scene.location && scene.time_of_day) {
            displayDescription = `${scene.location} • ${scene.time_of_day}`;
        } else if (scene.location) {
            displayDescription = scene.location;
        }
        if (scene.description) {
            const fullDescription = displayDescription ? `${displayDescription} - ${scene.description}` : scene.description;
            displayDescription = fullDescription.length > 120 ? fullDescription.substring(0, 120) + '...' : fullDescription;
        } else if (displayDescription) {
            displayDescription = displayDescription.length > 120 ? displayDescription.substring(0, 120) + '...' : displayDescription;
        }
        
        // Scene header with inline controls (matching scenes step exactly)
        const sceneHeader = document.createElement('div');
        sceneHeader.className = 'scene-header-row';
        sceneHeader.innerHTML = `
            <div class="scene-title-section">
                <h5 class="scene-title">
                    <span class="scene-number">${sceneNumber}</span>
                    <span class="scene-name">${scene.title || scene.name || 'Untitled Scene'}</span>
                </h5>
            </div>
            <div class="scene-controls">
                <button class="btn btn-dialogue btn-sm" onclick="generateDialogue('${structureKey}', ${globalSceneIndex})" title="${hasExistingDialogue ? 'Regenerate dialogue for this scene' : 'Generate dialogue for this scene'}">
                    ${hasExistingDialogue ? `🔄 Regenerate` : `💬 Generate`}
                </button>
                <button class="btn btn-outline btn-sm" onclick="previewDialoguePrompt('${structureKey}', ${globalSceneIndex})" title="Preview dialogue prompt">
                    🔍 Preview
                </button>
            </div>
        `;
        
        sceneElement.appendChild(sceneHeader);
        
        // Scene description (if available)
        if (displayDescription) {
            const sceneDescriptionDiv = document.createElement('div');
            sceneDescriptionDiv.className = 'scene-description-row';
            sceneDescriptionDiv.innerHTML = `<div class="scene-description">${displayDescription}</div>`;
            sceneElement.appendChild(sceneDescriptionDiv);
        }
        
        // Creative direction section (now separate from generation buttons)
        const creativeDirectionDiv = document.createElement('div');
        creativeDirectionDiv.className = 'creative-direction-section';
        creativeDirectionDiv.innerHTML = `
            <div class="creative-direction-controls">
                <button class="btn btn-outline btn-sm" 
                        onclick="showDialogueCreativeDirectionModal('${structureKey}', ${globalSceneIndex})"
                        title="Set creative direction for dialogue in this scene"
                        style="font-size: 0.8rem;">
                    Add creative direction for dialogue on scene ${sceneNumber}
                </button>
                ${dialogueDirection ? `
                    <div class="creative-directions-preview">
                        <strong>✨ Your Dialogue Direction:</strong> ${dialogueDirection}
                    </div>
                ` : `
                    <span class="creative-direction-placeholder">Add creative direction to guide dialogue generation for this scene</span>
                `}
            </div>
        `;
        sceneElement.appendChild(creativeDirectionDiv);
        
        // Dialogue content (editable)
        const dialogueContentContainer = document.createElement('div');
        dialogueContentContainer.className = 'dialogue-content-container';
        sceneElement.appendChild(dialogueContentContainer);
        
        // Create editable content block for the dialogue
        createEditableContentBlock({
            id: `hierarchical-dialogue-${structureKey}-${plotPointIndex}-${sceneIndex}`,
            type: 'dialogue',
            title: '', // Title already shown in header
            content: dialogueContent,
            container: dialogueContentContainer,
            hideTitle: true, // Don't show duplicate title
            metadata: { structureKey: structureKey, sceneIndex: globalSceneIndex, plotPointIndex: plotPointIndex, sceneId: sceneId },
            onSave: async (newContent, block) => {
                // Save the edited dialogue content
                await this.saveDialogueContent(structureKey, globalSceneIndex, newContent);
                
                // Update the app state
                if (!appState.generatedDialogues) {
                    appState.generatedDialogues = {};
                }
                appState.generatedDialogues[sceneId] = newContent;
                
                // Save to local storage
                saveToLocalStorage();
            }
        });
    }

    // Fallback function for displaying dialogue scenes without hierarchical structure
    displayDialogueScenesFlat(structureKey, sceneGroup, container) {
        if (!container || !sceneGroup || !Array.isArray(sceneGroup)) return;
        
        sceneGroup.forEach((scene, index) => {
            const sceneId = `${structureKey}-${index}`;
            const sceneNumber = calculateHierarchicalSceneNumber(structureKey, index, scene);
            
            // Check if dialogue already exists for this scene
            let dialogueContent = '';
            let hasExistingDialogue = false;
            
            // Format scene description for display
            let sceneDescription = '';
            if (scene.location && scene.time_of_day) {
                sceneDescription = `${scene.location} • ${scene.time_of_day}\n\n`;
            } else if (scene.location) {
                sceneDescription = `${scene.location}\n\n`;
            }
            
            if (scene.description) {
                sceneDescription += `${scene.description}\n\n`;
            }
            
            // Set default content with scene description
            dialogueContent = sceneDescription + 'Click "Generate Dialogue" to create the screenplay for this scene.';
            
            // Check for existing dialogue
            if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                dialogueContent = appState.generatedDialogues[sceneId];
                hasExistingDialogue = true;
            }
            
            const sceneTitle = `<span class="scene-number">${sceneNumber}</span> <span class="scene-name">${scene.title || scene.name || 'Untitled Scene'} - Dialogue</span>`;
            
            createEditableContentBlock({
                id: `flat-dialogue-${structureKey}-${index}`,
                type: 'dialogue',
                title: sceneTitle,
                content: dialogueContent,
                container: container,
                metadata: { structureKey: structureKey, sceneIndex: index, sceneId: sceneId },
                onSave: async (newContent, block) => {
                    await this.saveDialogueContent(structureKey, index, newContent);
                    if (!appState.generatedDialogues) {
                        appState.generatedDialogues = {};
                    }
                    appState.generatedDialogues[sceneId] = newContent;
                    saveToLocalStorage();
                }
            });
            
            // Add generation actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'dialogue-actions';
            actionsDiv.style.marginTop = '10px';
            actionsDiv.style.marginBottom = '20px';
            actionsDiv.innerHTML = `
                <button class="btn btn-primary btn-sm" onclick="generateDialogue('${structureKey}', ${index})">
                    ${hasExistingDialogue ? 'Regenerate Dialogue' : 'Generate Dialogue'}
                </button>
                <button class="btn btn-outline btn-sm" onclick="previewDialoguePrompt('${structureKey}', ${index})" title="Preview the prompt used to generate dialogue for this scene">
                    🔍 Dialogue Prompt
                </button>
            `;
            container.appendChild(actionsDiv);
        });
    }
}

// Initialize the global instance
const dialogueGenerationManager = new DialogueGenerationManager();

// Legacy compatibility wrappers for existing function calls
function goToDialogue() {
    return dialogueGenerationManager.goToDialogue();
}

async function saveDialogueContent(structureKey, sceneIndex, content) {
    return await dialogueGenerationManager.saveDialogueContent(structureKey, sceneIndex, content);
}

async function previewAllDialoguePromptsForAct(structureKey) {
    return await dialogueGenerationManager.previewAllDialoguePromptsForAct(structureKey);
}

async function generateDialogue(structureKey, sceneIndex) {
    return await dialogueGenerationManager.generateDialogue(structureKey, sceneIndex);
}

async function generateDialogueForPlotPoint(structureKey, plotPointIndex) {
    return await dialogueGenerationManager.generateDialogueForPlotPoint(structureKey, plotPointIndex);
}

async function generateAllDialogueForAct(structureKey) {
    return await dialogueGenerationManager.generateAllDialogueForAct(structureKey);
}

async function generateAllDialogue() {
    return await dialogueGenerationManager.generateAllDialogue();
}

async function previewAllDialoguePrompts() {
    return await dialogueGenerationManager.previewAllDialoguePrompts();
}

function displayDialogueGeneration() {
    return dialogueGenerationManager.displayDialogueGeneration();
}

function displayHierarchicalDialogueContent(structureKey, plotPoints, sceneGroup, actNumber) {
    return dialogueGenerationManager.displayHierarchicalDialogueContent(structureKey, plotPoints, sceneGroup, actNumber);
}

function displayDialogueScenesFlat(structureKey, sceneGroup, container) {
    return dialogueGenerationManager.displayDialogueScenesFlat(structureKey, sceneGroup, container);
} 