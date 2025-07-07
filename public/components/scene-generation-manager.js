// =====================================================
// Scene Generation Manager Component
// =====================================================
// Manages scene generation, display, editing, and preview functionality

class SceneGenerationManager {
    constructor() {
        console.log('🎬 SceneGenerationManager initialized');
    }

    // Generate scenes for all acts that have plot points
    async generateAllScenes() {
        console.log('generateAllScenes() called!');
        
        if (!appState.generatedStructure || !appState.projectPath) {
            showToast('No structure available to generate scenes for.', 'error');
            return;
        }
        
        if (!appState.plotPoints) {
            showToast('No plot points found. Please generate plot points first in Step 4.', 'error');
            return;
        }
        
        // Check authentication first
        if (!appState.isAuthenticated) {
            authManager.showRegistrationModal();
            return;
        }
        
        // 🔥 Credit check before generation
        if (!await window.creditWidget.canAfford(50)) {
            showToast('Insufficient credits for scene generation (50 credits required)', 'error');
            return;
        }
        
        const structureKeys = Object.keys(appState.generatedStructure);
        
        if (structureKeys.length === 0) {
            showToast('No structural elements found.', 'error');
            return;
        }
        
        // Filter to only acts that have plot points
        const actsWithPlotPoints = structureKeys.filter(key => hasPlotPointsForElement(key));
        
        if (actsWithPlotPoints.length === 0) {
            showToast('No acts have plot points yet. Please generate plot points first in Step 4.', 'error');
            return;
        }
        
        try {
            // Start hierarchical progress tracking
            progressTracker.start(actsWithPlotPoints.length, 'Generating Scenes', 'acts');
            
            // Generate scenes for each act with plot points sequentially
            for (let i = 0; i < actsWithPlotPoints.length; i++) {
                const structureKey = actsWithPlotPoints[i];
                const actNumber = i + 1;
                
                console.log(`Generating scenes for: ${structureKey}`);
                
                // Update hierarchy display - show current act being processed
                progressTracker.updateHierarchy(actNumber, actsWithPlotPoints.length);
                
                // Get current totalScenes value from calculator widget
                const totalScenesInput = document.getElementById('totalScenes');
                const currentTotalScenes = totalScenesInput ? parseInt(totalScenesInput.value) || 70 : 70;
                
                // Use the proper hierarchical scene generation endpoint
                const response = await fetch(`/api/generate-all-scenes-for-act/${appState.projectPath}/${structureKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': appState.apiKey
                    },
                    body: JSON.stringify({
                        model: getSelectedModel(),
                        totalScenes: currentTotalScenes,
                        creativeDirections: getRelevantCreativeDirections('scenes', { structureKey })
                    }),
                    signal: progressTracker.abortController?.signal
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    console.log('Hierarchical scenes generated for act:', data);
                    
                    // Store scenes in app state - need to flatten the plot point structure
                    if (!appState.generatedScenes) {
                        appState.generatedScenes = {};
                    }
                    
                    // Flatten plot point scenes into act-level structure for display
                    const allScenes = [];
                    if (data.plotPointScenes) {
                        data.plotPointScenes.forEach(plotPointData => {
                            plotPointData.scenes.forEach(scene => {
                                // Add metadata about which plot point this scene came from
                                scene.plotPointIndex = plotPointData.plotPointIndex;
                                scene.plotPoint = plotPointData.plotPoint;
                                scene.isKeyPlot = plotPointData.isKeyPlot;
                                allScenes.push(scene);
                            });
                        });
                    }
                    
                    appState.generatedScenes[structureKey] = allScenes;
                    
                    // Update the display in real-time after each act
                    displayScenes(appState.generatedScenes);
                    
                    // Update preview with actual scene content (like dialogue does)
                    const sceneCount = data.totalScenesGenerated || 0;
                    const plotPointCount = data.plotPointScenes?.length || 0;
                    
                    // Show the actual generated scenes in the processing window
                    if (data.plotPointScenes && data.plotPointScenes.length > 0) {
                        const sceneContentPreview = data.plotPointScenes.map(plotPointData => {
                            const scenesList = plotPointData.scenes.map(scene => 
                                `**${scene.title}**\n${scene.description}`
                            ).join('\n\n');
                            return `**Plot Point ${plotPointData.plotPointIndex + 1}:** ${plotPointData.plotPoint}\n\n${scenesList}`;
                        }).join('\n\n---\n\n');
                        
                        progressTracker.updatePreview(sceneContentPreview, `Act ${actNumber}`);
                    } else {
                        progressTracker.updatePreview(
                            `Generated ${sceneCount} scenes across ${plotPointCount} plot points`,
                            `Act ${actNumber}`
                        );
                    }
                    
                    // Increment progress step
                    progressTracker.incrementStep(`Generated ${sceneCount} scenes for ${structureKey}`);
                } else {
                    throw new Error(`Failed to generate scenes for ${structureKey}: ${data.error}`);
                }
            }
            
            // Refresh the scenes display
            displayScenes(appState.generatedScenes);
            
            // Update progress meters after generating scenes
            updateAllProgressMeters();
            
            // Update navigation system
            updateStepIndicators();
            updateUniversalNavigation();
            updateBreadcrumbNavigation();
            
            // Update the "Generate All Scenes" button to show "Regenerate All Scenes"
            updateGenerateAllScenesButton();
            
            progressTracker.finish();
            showToast(`Successfully generated scenes for all ${actsWithPlotPoints.length} acts with plot points!`, 'success');
            saveToLocalStorage();
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Scene generation cancelled by user');
                return; // Don't show error toast for cancellation
            }
            
            console.error('Error generating all scenes:', error);
            showToast(`Error generating scenes: ${error.message}`, 'error');
            progressTracker.finish();
        }
    }

    // Generate scenes for a structural element using proper hierarchical flow
    async generateScenesForElement(structureKey) {
        if (!appState.projectPath) {
            showToast('No project loaded. Please create or load a project first.', 'error');
            return;
        }

        // Check if plot points exist first
        if (!hasPlotPointsForElement(structureKey)) {
            showToast('Please generate plot points for this structural element first in Step 4.', 'error');
            return;
        }

        try {
            showLoading(`Generating scenes for ${structureKey} using hierarchical plot points...`);
            
            // Get current totalScenes value from calculator widget
            const totalScenesInput = document.getElementById('totalScenes');
            const currentTotalScenes = totalScenesInput ? parseInt(totalScenesInput.value) || 70 : 70;
            
            // Use the proper hierarchical scene generation endpoint
            const response = await fetch(`/api/generate-all-scenes-for-act/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    model: getSelectedModel(),
                    totalScenes: currentTotalScenes,
                    creativeDirections: getRelevantCreativeDirections('scenes', { structureKey })
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Hierarchical scenes generated:', data);
                
                // Store scenes in app state - need to flatten the plot point structure
                if (!appState.generatedScenes) {
                    appState.generatedScenes = {};
                }
                
                // Flatten plot point scenes into act-level structure for display
                const allScenes = [];
                if (data.plotPointScenes) {
                    data.plotPointScenes.forEach(plotPointData => {
                        plotPointData.scenes.forEach(scene => {
                            // Add metadata about which plot point this scene came from
                            scene.plotPointIndex = plotPointData.plotPointIndex;
                            scene.plotPoint = plotPointData.plotPoint;
                            scene.isKeyPlot = plotPointData.isKeyPlot;
                            allScenes.push(scene);
                        });
                    });
                }
                
                appState.generatedScenes[structureKey] = allScenes;
                
                // Refresh the scenes display
                displayScenes(appState.generatedScenes);
                
                // Update progress tracker with actual scene content
                if (data.plotPointScenes && data.plotPointScenes.length > 0) {
                    const sceneContentPreview = data.plotPointScenes.map(plotPointData => {
                        const scenesList = plotPointData.scenes.map(scene => 
                            `**${scene.title}**\n${scene.description}`
                        ).join('\n\n');
                        return `**Plot Point ${plotPointData.plotPointIndex + 1}:** ${plotPointData.plotPoint}\n\n${scenesList}`;
                    }).join('\n\n---\n\n');
                    
                    progressTracker.updatePreview(sceneContentPreview, `${structureKey} Scenes`);
                }
                
                // Update progress meters after generating scenes
                console.log('🔍 PROGRESS UPDATE: Updating progress meters after scenes generation');
                updateAllProgressMeters();
                
                // 🔥 FIX: Update navigation system when individual scenes are generated
                updateStepIndicators();
                updateUniversalNavigation();
                updateBreadcrumbNavigation();
                
                // Update the "Generate All Scenes" button in case this was the first/last act to get scenes
                updateGenerateAllScenesButton();
                
                showToast(`Generated ${data.totalScenesGenerated} scenes for ${structureKey} across ${data.plotPointScenes?.length || 0} plot points!`, 'success');
                saveToLocalStorage();
            } else {
                throw new Error(data.error || 'Failed to generate scenes');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error generating scenes:', error);
            showToast('Error generating scenes. Please try again.', 'error');
            hideLoading();
        }
    }

    // Generate scenes for a specific plot point
    async generateScenesForPlotPoint(structureKey, plotPointIndex) {
        if (!appState.projectPath) {
            showToast('No project loaded. Please create or load a project first.', 'error');
            return;
        }

        if (!hasPlotPointsForElement(structureKey)) {
            showToast('No plot points found for this element. Please generate plot points first.', 'error');
            return;
        }

        // Check authentication first
        if (!appState.isAuthenticated) {
            authManager.showRegistrationModal();
            return;
        }

        // Credit check before generation (estimate ~10 credits per plot point)
        if (!await window.creditWidget.canAfford(10)) {
            showToast('Insufficient credits for scene generation (10 credits required)', 'error');
            return;
        }

        try {
            // 🔧 Handle both plot points data formats (direct array or object with plotPoints property)
            let plotPointsArray;
            if (Array.isArray(appState.plotPoints[structureKey])) {
                plotPointsArray = appState.plotPoints[structureKey];
            } else if (appState.plotPoints[structureKey]?.plotPoints) {
                plotPointsArray = appState.plotPoints[structureKey].plotPoints;
            } else {
                throw new Error('Invalid plot points data structure');
            }
            
            const plotPoint = plotPointsArray[plotPointIndex];
            
            // Calculate hierarchical numbering for display using chronological order
            const structureKeys = Object.keys(appState.generatedStructure || {});
            const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
            const actIndex = chronologicalKeys.indexOf(structureKey);
            const hierarchicalNumber = `${actIndex + 1}.${plotPointIndex + 1}`;
            
            showLoading(`Generating scenes for Plot Point ${hierarchicalNumber}: ${plotPoint}...`);
            
            // Send creative directions for scenes
            const response = await fetch(`/api/generate-scenes-for-plot-point/${appState.projectPath}/${structureKey}/${plotPointIndex}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    model: getSelectedModel(),
                    creativeDirections: getRelevantCreativeDirections('scenes', { 
                        structureKey: structureKey, 
                        plotPointIndex: plotPointIndex 
                    }) // 🎯 Only send relevant creative directions
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Plot point scenes generated:', data);
                
                // Store/update scenes in app state
                if (!appState.generatedScenes) {
                    appState.generatedScenes = {};
                }
                if (!appState.generatedScenes[structureKey]) {
                    appState.generatedScenes[structureKey] = [];
                }
                
                // Remove any existing scenes for this specific plot point (for regeneration)
                if (Array.isArray(appState.generatedScenes[structureKey])) {
                    appState.generatedScenes[structureKey] = appState.generatedScenes[structureKey].filter(scene => 
                        scene.plotPointIndex !== plotPointIndex
                    );
                } else {
                    // If not an array, initialize as empty array
                    console.warn('generatedScenes[structureKey] is not an array, initializing as empty array');
                    appState.generatedScenes[structureKey] = [];
                }
                
                // Add the new scenes to the existing act scenes
                data.scenes.forEach(scene => {
                    // Add metadata about which plot point this scene came from
                    scene.plotPointIndex = plotPointIndex;
                    scene.plotPoint = data.plotPoint;
                    scene.isKeyPlot = data.isKeyPlot;
                    appState.generatedScenes[structureKey].push(scene);
                });
                
                // Refresh the scenes display to show the new scenes
                displayScenes(appState.generatedScenes);
                
                // Update progress tracker with actual scene content
                if (data.scenes && data.scenes.length > 0) {
                    const sceneContentPreview = data.scenes.map(scene => 
                        `**${scene.title}**\n${scene.description}`
                    ).join('\n\n');
                    
                    progressTracker.updatePreview(
                        `**Plot Point ${hierarchicalNumber}:** ${plotPoint}\n\n${sceneContentPreview}`,
                        `Plot Point ${hierarchicalNumber}`
                    );
                }
                
                // Refresh credits after successful generation
                window.creditWidget.refreshAfterOperation();
                
                // Update navigation system
                updateStepIndicators();
                updateUniversalNavigation();
                updateBreadcrumbNavigation();
                
                showToast(`Generated ${data.scenes.length} scenes for Plot Point ${hierarchicalNumber}: "${plotPoint}"`, 'success');
                saveToLocalStorage();
            } else {
                throw new Error(data.error || 'Failed to generate scenes for plot point');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error generating scenes for plot point:', error);
            showToast('Error generating scenes for plot point. Please try again.', 'error');
            hideLoading();
        }
    }

    // Display scenes with hierarchical structure
    displayScenes(scenes) {
        const container = document.getElementById('scenesContent');
        
        if (!container) {
            console.error('Scenes container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (appState.generatedStructure) {
            console.log('Displaying scenes with structure:', appState.generatedStructure);
            
            // Display scenes in chronological order
            const structureKeys = Object.keys(appState.generatedStructure);
            const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
            
            chronologicalKeys.forEach((structureKey) => {
                const storyAct = appState.generatedStructure[structureKey];
                const sceneGroup = scenes ? scenes[structureKey] : null;
                const plotPoints = appState.plotPoints ? appState.plotPoints[structureKey] : null;
                const hasScenes = sceneGroup && Array.isArray(sceneGroup) && sceneGroup.length > 0;
                const hasPlotPoints = hasPlotPointsForElement(structureKey);
                const sceneCount = hasScenes ? sceneGroup.length : 0;
                
                console.log(`Processing ${structureKey}: hasScenes=${hasScenes}, sceneCount=${sceneCount}, hasPlotPoints=${hasPlotPoints}`);
                
                const groupElement = document.createElement('div');
                groupElement.className = 'scene-group';
                groupElement.id = `scene-group-${structureKey}`;
                
                // Get act progress notation (X/Y format) - same as plot points and acts
                const totalActs = chronologicalKeys.length;
                const currentActIndex = chronologicalKeys.indexOf(structureKey);
                const actProgress = currentActIndex !== -1 ? `${currentActIndex + 1}/${totalActs}` : '';
                const actName = storyAct.name || structureKey.replace(/_/g, ' ').toUpperCase();
                const titleWithProgress = actProgress ? `${actProgress} ${actName}` : actName;
                
                // Check if this element has plot points for scene generation
                const canGenerateScenes = hasPlotPointsForElement(structureKey);
                
                // Check if scenes already exist for this act
                const hasExistingScenes = hasScenes && sceneGroup && sceneGroup.length > 0;
                const sceneActionText = hasExistingScenes ? 'Regenerate' : 'Generate';
                const sceneActionIcon = hasExistingScenes ? '🔄' : '🎬';
                
                const generateButtonClass = canGenerateScenes ? 'btn btn-primary' : 'btn btn-primary btn-disabled';
                const generateButtonTitle = canGenerateScenes ? 
                    `${sceneActionText} scenes for Act ${actProgress}` : 
                    'Generate plot points first in Step 4 to enable scene generation';
                const generateButtonOnClick = canGenerateScenes ? 
                    `generateScenesForElement('${structureKey}')` : 
                    'showToast("Please generate plot points for this element first in Step 4.", "error")';

                groupElement.innerHTML = `
                    <div class="scene-group-header">
                        <h3>${titleWithProgress}</h3>
                        <div class="scene-group-actions">
                            <button class="${generateButtonClass}" onclick="${generateButtonOnClick}" title="${generateButtonTitle}" ${canGenerateScenes ? '' : 'disabled'}>
                                ${sceneActionIcon} ${sceneActionText} Scenes for Act ${actProgress}
                            </button>
                            <button class="btn btn-outline" onclick="previewElementScenesPrompt('${structureKey}')" title="Preview the prompt for scene generation">
                                🔍 Preview Prompt
                            </button>
                        </div>
                    </div>
                    <div class="structure-description">
                        <p><strong>Description:</strong> ${storyAct.description}</p>
                        ${storyAct.character_development ? `<p><strong>Character Development:</strong> ${storyAct.character_development}</p>` : ''}
                    </div>
                    <div id="hierarchical-content-${structureKey}" class="hierarchical-content">
                        ${hasPlotPoints ? '' : `
                            <div class="plot-points-warning">
                                <p><strong>⚠️ No plot points found.</strong> Please generate plot points first in Step 4 for better scene coherence.</p>
                                <p><em>Scene generation will be disabled until plot points are created.</em></p>
                            </div>
                        `}
                        ${hasScenes ? '' : !hasPlotPoints ? '' : '<p class="no-scenes">No scenes generated yet. Generate scenes to see the hierarchical structure.</p>'}
                    </div>
                `;
                
                console.log(`Appending group element for ${structureKey} to container`);
                container.appendChild(groupElement);
                
                // Display existing content hierarchically if any
                if (hasPlotPoints || hasScenes) {
                    console.log(`Displaying hierarchical content for ${structureKey}: ${plotPoints?.length || 0} plot points, ${sceneCount} scenes`);
                    displayHierarchicalContent(structureKey, plotPoints, sceneGroup, currentActIndex + 1);
                }
            });
            console.log('Finished creating all scene groups');
        } else {
            console.log('No structure available - showing fallback message');
            container.innerHTML = '<p>No structure available. Please generate a structure first.</p>';
        }
    }

    // Save scene content function
    async saveSceneContent(structureKey, sceneIndex, content) {
        if (!appState.projectPath) {
            throw new Error('No project loaded');
        }
        
        const response = await fetch(`/api/edit-content/scenes/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save scene content');
        }
        
        return await response.json();
    }

    // Preview scene generation prompt for an element
    async previewElementScenesPrompt(structureKey) {
        if (!appState.generatedStructure || !appState.storyInput || !appState.projectPath) {
            showToast('No structure, story data, or project available for prompt preview.', 'error');
            return;
        }

        // Check if plot points exist for this element
        if (!hasPlotPointsForElement(structureKey)) {
            showToast('Please generate plot points for this structural element first in Step 4.', 'error');
            return;
        }

        const structureElement = appState.generatedStructure[structureKey];
        
        if (!structureElement) {
            showToast('Structure element not found.', 'error');
            return;
        }

        try {
            showLoading('Generating hierarchical scene generation prompt preview...');
            
            // Get current totalScenes value from calculator widget
            const totalScenesInput = document.getElementById('totalScenes');
            const currentTotalScenes = totalScenesInput ? parseInt(totalScenesInput.value) || 70 : 70;
            
            // Use the new hierarchical plot-point-level preview (show first plot point as example)
            const response = await fetch(`/api/preview-plot-point-scene-prompt/${appState.projectPath}/${structureKey}/0`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    totalScenes: currentTotalScenes,
                    creativeDirections: getRelevantCreativeDirections('scenes', { 
                        structureKey: structureKey, 
                        plotPointIndex: 0 
                    })
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store the prompt data for the modal
                appState.currentScenePrompt = {
                    systemMessage: data.systemMessage,
                    userPrompt: data.prompt,
                    promptType: data.promptType,
                    structureElement: structureElement,
                    structureKey: structureKey,
                    sceneCount: data.sceneCount || 'varies per plot point',
                    hierarchicalPrompt: data.hierarchicalPrompt,
                    previewNote: data.previewNote || `This shows the ACTUAL hierarchical prompts used for scene generation. This example shows Plot Point 1 for "${structureKey}" - similar prompts are used for each plot point in this act. This is the TRUE hierarchical approach where scenes implement specific plot points.`
                };
                
                // Show the scene prompt modal
                showScenePromptModal();
                hideLoading();
            } else {
                throw new Error(data.error || 'Failed to generate scene prompt preview');
            }
        } catch (error) {
            console.error('Error generating scene prompt preview:', error);
            showToast('Error generating hierarchical scene prompt preview. Please try again.', 'error');
            hideLoading();
        }
    }

    // Preview all scenes generation prompts
    async previewAllScenesPrompt() {
        if (!appState.generatedStructure || !appState.storyInput || !appState.projectPath) {
            showToast('No structure, story data, or project available for prompt preview.', 'error');
            return;
        }
        
        if (!appState.plotPoints) {
            showToast('No plot points found. Please generate plot points first in Step 4.', 'error');
            return;
        }
        
        const structureKeys = Object.keys(appState.generatedStructure);
        const actsWithPlotPoints = structureKeys.filter(key => hasPlotPointsForElement(key));
        
        if (actsWithPlotPoints.length === 0) {
            showToast('No acts have plot points yet. Please generate plot points first in Step 4.', 'error');
            return;
        }

        try {
            showLoading('Generating all scenes prompts preview...');
            
            // For simplicity, we'll preview the prompt for the first act with plot points
            // In a more complete implementation, you might show all prompts or let user select
            const firstActKey = actsWithPlotPoints[0];
            const structureElement = appState.generatedStructure[firstActKey];
            
            // Get current totalScenes value from calculator widget
            const totalScenesInput = document.getElementById('totalScenes');
            const currentTotalScenes = totalScenesInput ? parseInt(totalScenesInput.value) || 70 : 70;
            
            // Use the new hierarchical plot-point-level preview
            const response = await fetch(`/api/preview-plot-point-scene-prompt/${appState.projectPath}/${firstActKey}/0`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    totalScenes: currentTotalScenes,
                    creativeDirections: getRelevantCreativeDirections('scenes', { 
                        structureKey: firstActKey, 
                        plotPointIndex: 0 
                    })
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store the prompt data for the modal
                appState.currentScenePrompt = {
                    systemMessage: data.systemMessage,
                    userPrompt: data.prompt,
                    promptType: data.promptType,
                    structureElement: structureElement,
                    sceneCount: data.sceneCount || 'varies per plot point',
                    hierarchicalPrompt: data.hierarchicalPrompt,
                    previewNote: data.previewNote || `This shows the ACTUAL hierarchical prompts used for scene generation. Each plot point generates its allocated scenes (${data.sceneCount} in this example). This is the TRUE hierarchical approach where scenes implement specific plot points.`
                };
                
                // Show the scene prompt modal
                showScenePromptModal();
                hideLoading();
            } else {
                throw new Error(data.error || 'Failed to generate scenes prompt preview');
            }
        } catch (error) {
            console.error('Error generating all scenes prompt preview:', error);
            showToast('Error generating scenes prompt preview. Please try again.', 'error');
            hideLoading();
        }
    }
}

// Initialize the global instance
const sceneGenerationManager = new SceneGenerationManager(); 