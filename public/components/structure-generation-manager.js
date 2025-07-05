// =====================================================
// Structure Generation Manager Component
// =====================================================
// Manages structure generation, display, and editing functionality

class StructureGenerationManager {
    constructor() {
        console.log('🔧 StructureGenerationManager initialized');
    }

    // Generate structure with custom prompt
    async generateStructureWithCustomPrompt() {
        if (!appState.customPrompt) {
            showToast('No custom prompt available.', 'error');
            return;
        }
        
        try {
            showLoading('Generating plot structure with custom prompt...');
            
            // 🔧 CRITICAL FIX: Ensure formatted character strings before sending to server
            const storyInputForServer = {
                ...appState.storyInput,
                characters: getCharactersForPrompt() || appState.storyInput.characters || 'Main Characters'
            };
            console.log('🔧 Fixed character format for custom prompt generation:', storyInputForServer.characters);
            
            const response = await fetch('/api/generate-structure-custom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    storyInput: storyInputForServer,
                    template: appState.selectedTemplate,
                    customPrompt: appState.customPrompt,
                    model: getSelectedModel(),
                    existingProjectPath: appState.projectPath || null // 🔧 Send existing project path if regenerating
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                appState.generatedStructure = data.structure;
                appState.templateData = data.template;
                appState.projectId = data.projectId;
                appState.projectPath = data.projectPath;
                appState.lastUsedPrompt = appState.customPrompt.userPrompt;
                appState.lastUsedSystemMessage = appState.customPrompt.systemMessage;
                
                // Show project header now that we have a project
                showProjectHeader({
                    title: appState.storyInput.title,
                    templateName: appState.templateData ? appState.templateData.name : 'Unknown',
                    totalScenes: appState.storyInput.totalScenes,
                    projectId: appState.projectId
                });
                
                this.displayStructure(data.structure, appState.customPrompt.userPrompt, appState.customPrompt.systemMessage);
                updateUniversalNavigation(); // Update navigation after structure generation
                goToStep(3);
                showToast('Plot structure generated with custom prompt!', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate structure');
            }
            
            hideLoading();
            saveToLocalStorage();
        } catch (error) {
            console.error('Error generating structure with custom prompt:', error);
            showToast('Error generating structure. Please try again.', 'error');
            hideLoading();
        }
    }

    // Generate structure
    async generateStructure() {
        if (!appState.selectedTemplate || !appState.storyInput) {
            showToast('Please complete the previous steps first.', 'error');
            return;
        }
        
        // Check authentication first
        if (!appState.isAuthenticated) {
            authManager.showRegistrationModal();
            return;
        }
        
        // 🔥 Credit check before generation
        if (!await window.creditWidget.canAfford(25)) {
            showToast('Insufficient credits for structure generation (25 credits required)', 'error');
            return;
        }
        
        try {
            showLoading('Generating plot structure...');
            
            // 🔧 Fix template key order before sending to server
            let customTemplateData = appState.templateData;
            if (customTemplateData && customTemplateData.structure) {
                try {
                    // Load original template to get correct key order
                    const originalTemplateResponse = await fetch(`/api/template/${appState.selectedTemplate}`);
                    if (originalTemplateResponse.ok) {
                        const originalTemplate = await originalTemplateResponse.json();
                        if (originalTemplate.structure) {
                            // Create new structure with correct order
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
                            console.log('🔧 Fixed template key order for generation:', Object.keys(orderedStructure));
                        }
                    }
                } catch (error) {
                    console.warn('Could not fix template order, using current order:', error);
                }
            }

            // 🔧 CRITICAL FIX: Ensure formatted character strings before sending to server
            const storyInputForServer = {
                ...appState.storyInput,
                characters: getCharactersForPrompt() || appState.storyInput.characters || 'Main Characters'
            };
            console.log('🔧 Fixed character format for structure generation:', storyInputForServer.characters);
            
            const response = await fetch('/api/generate-structure', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    storyInput: storyInputForServer,
                    template: appState.selectedTemplate,
                    customTemplateData: customTemplateData, // 🔧 Send order-corrected template data
                    model: getSelectedModel(),
                    existingProjectPath: appState.projectPath || null // 🔧 Send existing project path if regenerating
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 🔥 Refresh credits after successful generation
                window.creditWidget.refreshAfterOperation();
                
                appState.generatedStructure = data.structure;
                appState.projectId = data.projectId || appState.projectId;
                appState.projectPath = data.projectPath || appState.projectPath;
                appState.lastUsedPrompt = data.prompt || null;
                appState.lastUsedSystemMessage = data.systemMessage || null;
                
                // Show project header now that we have a project
                showProjectHeader({
                    title: appState.storyInput.title,
                    templateName: appState.templateData ? appState.templateData.name : 'Unknown',
                    totalScenes: appState.storyInput.totalScenes,
                    projectId: appState.projectId
                });
                
                this.displayStructure(data.structure, data.prompt, data.systemMessage);
                updateActsGenerationButton(); // Update button to show "Regenerate Acts"
                updateUniversalNavigation(); // Update navigation after structure generation
                updateGlobalDirectionIndicators(); // Update global direction UI indicators
                goToStep(3);
                showToast('Plot structure generated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate structure');
            }
            
            hideLoading();
            saveToLocalStorage();
        } catch (error) {
            console.error('Error generating structure:', error);
            showToast('Error generating structure. Please try again.', 'error');
            hideLoading();
        }
    }

    // Display generated structure
    displayStructure(structure, prompt = null, systemMessage = null) {
        const container = document.getElementById('structureContent');
        
        // Validate structure data
        if (!structure || typeof structure !== 'object') {
            console.error('displayStructure called with invalid structure:', structure);
            container.innerHTML = '<div class="error-message">❌ Structure data is missing or invalid</div>';
            return;
        }
        
        // Remove any existing preview since we're showing the actual generated structure now
        const existingPreview = container.parentNode.querySelector('#templateStructurePreview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        // Clear container and create the normal structure display
        container.innerHTML = '';
        
        // Add prompt review section if available
        if (prompt && systemMessage) {
            const promptSection = document.createElement('div');
            promptSection.className = 'prompt-review-section';
            promptSection.innerHTML = `
                <div class="prompt-review-header">
                    <h3>📋 Generated Using This Prompt</h3>
                    <button class="btn btn-outline btn-sm" onclick="showUsedPromptModal()">View Full Prompt</button>
                </div>
                <div class="prompt-summary">
                    <p><strong>Template:</strong> ${appState.templateData?.name || 'Unknown'}</p>
                    <p><strong>Story:</strong> ${appState.storyInput?.title || 'Untitled'}</p>
                    <p><strong>Influences:</strong> ${getInfluencesSummary()}</p>
                </div>
            `;
            container.appendChild(promptSection);
        }
        
        // Create editable content blocks for each act in chronological order
        const structureKeys = Object.keys(structure);
        const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
        const totalActs = chronologicalKeys.length;
        
        console.log(`🔧 displayStructure: Displaying ${totalActs} acts in chronological order:`, chronologicalKeys);
        
        chronologicalKeys.forEach((key, index) => {
            const element = structure[key];
            if (typeof element === 'object' && (element.name || element.title)) {
                const actContent = JSON.stringify(element);
                const actProgress = `${index + 1}/${totalActs}`;
                const actTitle = element.name || element.title || key.replace(/_/g, ' ').toUpperCase();
                
                console.log(`🔧 displayStructure: Creating act ${actProgress} - ${actTitle} (${key})`);
                
                // Create compact reference header with template context
                const templateAct = appState.templateData?.structure?.[key];
                if (templateAct) {
                    const referenceHeader = document.createElement('div');
                    referenceHeader.className = 'act-reference-header';
                    
                    // Get template description (truncated for compactness)
                    const templateDesc = templateAct.description || 'No template description';
                    const truncatedDesc = templateDesc.length > 120 ? templateDesc.substring(0, 117) + '...' : templateDesc;
                    
                    referenceHeader.innerHTML = `
                        <div class="template-context">
                            <span class="template-label">📋 Template:</span> ${truncatedDesc}
                        </div>
                    `;
                    
                    container.appendChild(referenceHeader);
                }
                
                // Add creative direction section for this act (BEFORE the editable content block)
                const hasActCreativeDirections = appState.templateData?.structure?.[key]?.userDirections && appState.templateData.structure[key].userDirections.trim();
                const actCreativeDirectionSection = document.createElement('div');
                actCreativeDirectionSection.className = 'creative-direction-section';
                actCreativeDirectionSection.innerHTML = `
                    <div class="creative-direction-controls">
                        <button class="btn btn-sm" 
                                onclick="showActsCreativeDirectionModal('${key}')" 
                                title="Add/edit creative direction for this act" 
                                style="font-size: 0.8rem;">
                            Add creative direction for act ${index + 1}/${totalActs}
                        </button>
                        ${hasActCreativeDirections ? `
                            <div class="creative-directions-preview">
                                <strong>✨ Your Creative Directions:</strong> ${appState.templateData.structure[key].userDirections}
                            </div>
                        ` : `
                            <span class="creative-direction-placeholder">Add creative direction to guide act generation</span>
                        `}
                    </div>
                `;
                container.appendChild(actCreativeDirectionSection);
                
                createEditableContentBlock({
                    id: `act-${key}`,
                    type: 'acts',
                    title: `${actProgress} ${actTitle}`,
                    content: actContent,
                    container: container,
                    metadata: { actKey: key },
                    onSave: async (newContent, block) => {
                        // Save the edited act content
                        await this.saveActContent(key, newContent);
                        
                        // Update the app state
                        if (appState.generatedStructure && appState.generatedStructure[key]) {
                            try {
                                const updatedAct = JSON.parse(newContent);
                                appState.generatedStructure[key] = { ...appState.generatedStructure[key], ...updatedAct };
                            } catch (e) {
                                // If not JSON, update description
                                appState.generatedStructure[key].description = newContent;
                            }
                        }
                        
                        // Save to local storage
                        saveToLocalStorage();
                    }
                });
            } else {
                console.log(`🔧 displayStructure: Skipping invalid element for key ${key}:`, element);
            }
        });
        
        // Show regenerate and approve buttons after structure is displayed
        const regenerateBtn = document.getElementById('regenerateBtn');
        const approveBtn = document.getElementById('approveBtn');
        
        if (regenerateBtn && approveBtn) {
            regenerateBtn.style.display = 'inline-block';
            approveBtn.style.display = 'inline-block';
        }
    }

    // Save act content function
    async saveActContent(actKey, content) {
        if (!appState.projectPath) {
            throw new Error('No project loaded');
        }
        
        const response = await fetch(`/api/edit-content/acts/${appState.projectPath}/${actKey}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save act content');
        }
        
        return await response.json();
    }
}

// Create global instance
const structureGenerationManager = new StructureGenerationManager();

console.log('🔧 StructureGenerationManager component loaded successfully'); 