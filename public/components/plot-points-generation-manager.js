// =====================================================
// Plot Points Generation Manager Component
// =====================================================
// Manages plot points generation, display, editing, and regeneration functionality

class PlotPointsGenerationManager {
    constructor() {
        console.log('🔧 PlotPointsGenerationManager initialized');
    }

    // Generate plot points for a specific act/element
    async generateElementPlotPoints(structureKey) {
        if (!appState.projectPath) {
            showToast('No project loaded. Please create or load a project first.', 'error');
            return;
        }

        // Get the desired plot point count from the dropdown
        const plotPointsCountSelect = document.getElementById(`plotPointsCount-${structureKey}`);
        const desiredSceneCount = plotPointsCountSelect ? parseInt(plotPointsCountSelect.value) : 4; // Default to 4 plot points per act
        
        try {
            showLoading(`Generating plot points for ${structureKey}...`);
            
            // 🔧 Fix template key order before sending to server (same as generateStructure)
            let customTemplateData = appState.templateData;
            if (customTemplateData && customTemplateData.structure) {
                try {
                    // Load original template to get correct key order
                    const originalTemplateResponse = await fetch(`/api/template/${appState.selectedTemplate}`);
                    if (originalTemplateResponse.ok) {
                        const originalTemplate = await originalTemplateResponse.json();
                        if (originalTemplate.structure) {
                            // Create ordered structure using original template keys
                            const orderedStructure = {};
                            Object.keys(originalTemplate.structure).forEach(key => {
                                if (customTemplateData.structure[key]) {
                                    orderedStructure[key] = customTemplateData.structure[key];
                                }
                            });
                            customTemplateData = {
                                ...customTemplateData,
                                structure: orderedStructure
                            };
                        }
                    }
                } catch (error) {
                    console.warn('🔧 Could not fix template order:', error);
                }
            }

            const response = await fetch(`/api/generate-plot-points-for-act/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    desiredSceneCount: desiredSceneCount,
                    model: getSelectedModel(),
                    customTemplateData: customTemplateData, // 🔧 Send customized template data
                    creativeDirections: getRelevantCreativeDirections('plot-points', { structureKey }) // 🚀 OPTIMIZED: Send only relevant creative directions
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Plot points generated:', data);
                
                // Store plot points in app state
                if (!appState.plotPoints) {
                    appState.plotPoints = {};
                }
                appState.plotPoints[structureKey] = data.plotPoints;
                
                // 🔧 DEBUG: Log plot points format for button state debugging
                console.log(`🔍 BUTTON DEBUG: Plot points stored for ${structureKey}:`, data.plotPoints);
                console.log(`🔍 BUTTON DEBUG: hasPlotPointsForElement check:`, generationHelperManager.hasPlotPointsForElement(structureKey));
                
                // Display the generated plot points
                this.displayElementPlotPoints(structureKey, data.plotPoints);
                
                // Update progress meters after generating plot points
                console.log('🔍 PROGRESS UPDATE: Updating progress meters after plot points generation');
                updateAllProgressMeters();
                
                // 🔥 FIX: Update navigation system when individual plot points are generated
                updateStepIndicators();
                updateUniversalNavigation();
                updateBreadcrumbNavigation();
                
                // Refresh the plot points display to update button states for subsequent acts
                // Add small delay to ensure state is propagated
                setTimeout(async () => {
                    console.log(`🔍 BUTTON DEBUG: About to refresh plot points display for button updates`);
                    await displayPlotPointsGeneration();
                }, 100);
                
                // Update the "Generate All Plot Points" button in case this was the first/last act to get plot points
                updateGenerateAllPlotPointsButton();
                
                showToast(`Generated ${data.totalPlotPoints} plot points for ${structureKey}!`, 'success');
                saveToLocalStorage();
            } else {
                throw new Error(data.error || 'Failed to generate plot points');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error generating plot points:', error);
            showToast('Error generating plot points. Please try again.', 'error');
            hideLoading();
        }
    }

    // Display plot points for a specific act
    displayElementPlotPoints(structureKey, plotPoints) {
        const container = document.getElementById(`plotPoints-container-${structureKey}`);
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Debug: Log the incoming plot points format
        console.log(`🔍 DEBUG: Displaying plot points for ${structureKey}:`, plotPoints);
        console.log(`🔍 DEBUG: Plot points type:`, typeof plotPoints, `isArray:`, Array.isArray(plotPoints));
        if (Array.isArray(plotPoints) && plotPoints.length > 0) {
            console.log(`🔍 DEBUG: First plot point type:`, typeof plotPoints[0], plotPoints[0]);
        }
        
        // Extract plot point text from the database structure
        let normalizedPlotPoints = [];
        
        // Handle database format: object with plotPoints array inside
        if (typeof plotPoints === 'object' && plotPoints !== null && !Array.isArray(plotPoints)) {
            // This is the database object format with metadata
            if (plotPoints.plotPoints && Array.isArray(plotPoints.plotPoints)) {
                console.log(`🔧 DEBUG: Extracting plotPoints array from database object`);
                normalizedPlotPoints = plotPoints.plotPoints.map(point => typeof point === 'string' ? point : String(point));
            } else {
                console.warn('Database object does not contain plotPoints array:', plotPoints);
                normalizedPlotPoints = [JSON.stringify(plotPoints)];
            }
        }
        // Handle direct array format
        else if (Array.isArray(plotPoints)) {
            normalizedPlotPoints = plotPoints.map(point => {
                if (typeof point === 'string') {
                    return point;
                } else if (typeof point === 'object' && point !== null) {
                    // Extract the plotPoint text from the object - handle multiple possible formats
                    const plotText = point.plotPoint || point.description || point.text || point.content;
                    if (plotText && typeof plotText === 'string') {
                        return plotText;
                    }
                    // If none of the standard properties exist, try to find the actual text content
                    const keys = Object.keys(point);
                    for (const key of keys) {
                        if (typeof point[key] === 'string' && point[key].length > 10) {
                            return point[key];
                        }
                    }
                    // Last resort: stringify but clean it up
                    console.warn('Plot point object format not recognized:', point);
                    return JSON.stringify(point);
                }
                return String(point);
            });
        }
        // Handle single string
        else if (typeof plotPoints === 'string') {
            normalizedPlotPoints = [plotPoints];
        }
        // Handle other formats
        else {
            normalizedPlotPoints = [String(plotPoints)];
        }
        
        // Create editable content block for plot points  
        const plotPointsContent = normalizedPlotPoints;
        
        // Calculate act index for metadata (needed for act numbering)
        const structureKeys = Object.keys(appState.generatedStructure || {});
        const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
        const currentActIndex = chronologicalKeys.indexOf(structureKey);
        
        // Removed redundant title - main act header already shows the act name
        createEditableContentBlock({
            id: `plot-points-${structureKey}`,
            type: 'plot-points',
            title: '', // No title needed - already shown in main act header
            content: plotPointsContent,
            container: container,
            metadata: { 
                structureKey: structureKey,
                actNumber: currentActIndex + 1 // Pass the act number (1, 2, 3, etc.)
            },
            onSave: async (newContent, block) => {
                // Save the edited plot points content
                await this.savePlotPointsContent(structureKey, newContent);
                
                // Update the app state
                let updatedPlotPoints;
                try {
                    updatedPlotPoints = JSON.parse(newContent);
                } catch (e) {
                    // Split by lines if not valid JSON
                    updatedPlotPoints = newContent.split('\n').filter(line => line.trim());
                }
                
                if (!appState.plotPoints) {
                    appState.plotPoints = {};
                }
                appState.plotPoints[structureKey] = updatedPlotPoints;
                
                // Save to local storage
                saveToLocalStorage();
                
                // Refresh the plot points display to update button states for subsequent acts
                await displayPlotPointsGeneration();
            }
        });
        
        // Redundant plot point actions removed - use main "Generate Plot Points" and "Preview Prompt" buttons instead
    }

    // Save plot points content function
    async savePlotPointsContent(structureKey, content) {
        if (!appState.projectPath) {
            throw new Error('No project loaded');
        }
        
        const response = await fetch(`/api/edit-content/plot-points/${appState.projectPath}/${structureKey}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save plot points content');
        }
        
        return await response.json();
    }

    // Regenerate all plot points for a specific element
    async regenerateAllPlotPointsForElement(structureKey) {
        try {
            showLoading(`Regenerating plot points for ${structureKey}...`);
            
            // 🔧 Fix template key order before sending to server (same as generateElementPlotPoints)
            let customTemplateData = appState.templateData;
            if (customTemplateData && customTemplateData.structure) {
                try {
                    // Load original template to get correct key order
                    const originalTemplateResponse = await fetch(`/api/template/${appState.selectedTemplate}`);
                    if (originalTemplateResponse.ok) {
                        const originalTemplate = await originalTemplateResponse.json();
                        if (originalTemplate.structure) {
                            // Create ordered structure using original template keys
                            const orderedStructure = {};
                            Object.keys(originalTemplate.structure).forEach(key => {
                                if (customTemplateData.structure[key]) {
                                    orderedStructure[key] = customTemplateData.structure[key];
                                }
                            });
                            customTemplateData = {
                                ...customTemplateData,
                                structure: orderedStructure
                            };
                        }
                    }
                } catch (error) {
                    console.warn('🔧 Could not fix template order:', error);
                }
            }

            const response = await fetch(`/api/generate-plot-points-for-act/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    desiredSceneCount: 4, // Default value
                    model: getSelectedModel(),
                    customTemplateData: customTemplateData, // 🔧 Send customized template data
                    creativeDirections: getRelevantCreativeDirections('plot-points', { structureKey }) // 🚀 OPTIMIZED: Send only relevant creative directions
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Update app state
                if (!appState.plotPoints) {
                    appState.plotPoints = {};
                }
                appState.plotPoints[structureKey] = data.plotPoints;
                
                // Update the editable block
                const blockId = `plot-points-${structureKey}`;
                if (window.editableBlocks && window.editableBlocks[blockId]) {
                    window.editableBlocks[blockId].updateContent(JSON.stringify(data.plotPoints));
                }
                
                showToast('Plot points regenerated successfully!', 'success');
                saveToLocalStorage();
            } else {
                throw new Error(data.error || 'Failed to regenerate plot points');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error regenerating plot points:', error);
            showToast('Error regenerating plot points. Please try again.', 'error');
            hideLoading();
        }
    }

    // Regenerate a single plot point within an act
    async regenerateElementPlotPoint(structureKey, plotPointIndex) {
        if (!appState.projectPath) {
            showToast('No project loaded. Please create or load a project first.', 'error');
            return;
        }

        if (!appState.plotPoints || !appState.plotPoints[structureKey]) {
            showToast('No plot points found for this act. Please generate plot points first.', 'error');
            return;
        }

        try {
            showLoading(`Regenerating plot point ${plotPointIndex + 1}...`);
            
            const response = await fetch(`/api/regenerate-plot-point/${appState.projectPath}/${structureKey}/${plotPointIndex}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    model: getSelectedModel()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Plot point regenerated:', data);
                
                // Update the specific plot point in app state (OVERWRITES the single plot point)
                appState.plotPoints[structureKey][plotPointIndex] = data.plotPoint;
                
                // Refresh the display to show the updated plot point
                this.displayElementPlotPoints(structureKey, appState.plotPoints[structureKey]);
                
                showToast(`Plot point ${plotPointIndex + 1} regenerated successfully!`, 'success');
                saveToLocalStorage();
            } else {
                throw new Error(data.error || 'Failed to regenerate plot point');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error regenerating plot point:', error);
            showToast('Error regenerating plot point. Please try again.', 'error');
            hideLoading();
        }
    }
}

// Create global instance
const plotPointsGenerationManager = new PlotPointsGenerationManager();

console.log('🔧 PlotPointsGenerationManager component loaded successfully'); 