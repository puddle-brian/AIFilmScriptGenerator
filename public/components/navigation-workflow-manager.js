/**
 * Navigation & Workflow Management System Component
 * Extracted from script.js for modular architecture
 * Handles navigation, workflow orchestration, progress tracking, and template management
 */

// Navigation & Workflow Manager Class
class NavigationWorkflowManager {
    constructor() {
        this.initialized = false;
        this.currentStep = 1;
        this.isNavigating = false;
    }

    init() {
        if (this.initialized) return;
        
        console.log('🧭 NavigationWorkflowManager initialized');
        this.initialized = true;
    }

    // ==================== NAVIGATION & STEP MANAGEMENT ====================

    // Get current step from DOM
    getCurrentStep() {
        // Find the currently active step
        const activeStep = document.querySelector('.workflow-step.active');
        if (activeStep) {
            const stepId = activeStep.id;
            return parseInt(stepId.replace('step', ''));
        }
        return 1;
    }

    // Navigate to next step
    goToNextStep() {
        if (window.uiManagerInstance) {
            return window.uiManagerInstance.goToNextStep();
        }
    }

    // ==================== TEMPLATE & STRUCTURE WORKFLOW ====================

    // Display template structure preview in Step 3
    async displayTemplateStructurePreview() {
        if (!window.appState?.selectedTemplate) {
            console.log('No template selected for structure preview');
            return;
        }
        
        // Check if we already have generated structure - if so, display it instead of preview
        if (window.appState.generatedStructure && Object.keys(window.appState.generatedStructure).length > 0) {
            console.log('Generated structure already exists, displaying actual structure');
            if (typeof displayStructure === 'function') {
                displayStructure(window.appState.generatedStructure, window.appState.lastUsedPrompt, window.appState.lastUsedSystemMessage);
            }
            if (typeof updateActsGenerationButton === 'function') {
                updateActsGenerationButton(); // Update button to show "Regenerate Acts"
            }
            return;
        }

        // Check for existing templateData with user edits FIRST
        if (window.appState.templateData && window.appState.templateData.structure) {
            console.log('Using existing template data with user edits:', window.appState.templateData.name);
            
            // Use the EXISTING structure container - unified approach!
            const structureContainer = document.getElementById('structureContent');
            if (!structureContainer) {
                console.log('Structure container not found');
                return;
            }
            
            // Create preview using the modified template data (with user edits)
            this.createFullTemplatePreview(window.appState.templateData, structureContainer);
            return;
        }
        
        // Fallback: If no edited template data exists, load fresh template data
        try {
            // Get template data from existing templates (no server call needed)
            const templateData = await this.getTemplateDataFromExistingTemplates(window.appState.selectedTemplate);
            if (!templateData) {
                console.log('Template data not found, creating simple preview');
                // Create a simple preview without full template data
                this.createSimpleTemplatePreview();
                return;
            }
            
            console.log('Template data loaded for preview:', templateData.name);
            
            // Use the EXISTING structure container - unified approach!
            const structureContainer = document.getElementById('structureContent');
            if (!structureContainer) {
                console.log('Structure container not found');
                return;
            }

            // Clear existing content
            structureContainer.innerHTML = '';
            
            // Add preview header
            const previewHeader = document.createElement('div');
            previewHeader.className = 'structure-preview-header';
            previewHeader.innerHTML = `
                <h3>${templateData.name} Structure Preview</h3>
                <p class="structure-preview-description">${templateData.description}</p>
            `;
            structureContainer.appendChild(previewHeader);
            
            // Create preview structure using the SAME format as displayStructure()
            if (templateData.structure) {
                Object.entries(templateData.structure).forEach(([key, act], index) => {
                    const actElement = document.createElement('div');
                    actElement.className = 'structure-element';
                    actElement.setAttribute('data-act', key);
                    
                    const actName = act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    actElement.innerHTML = `
                        <div class="structure-element-header">
                            <h3>${actName}</h3>
                            <div class="structure-element-meta">
                                <span class="act-number">Act ${index + 1}</span>
                                <span class="preview-status">Ready for generation</span>
                            </div>
                        </div>
                        <div class="structure-element-content">
                            <div class="template-description">
                                <strong>Template Guide:</strong> ${act.description || 'No description available'}
                            </div>
                            ${act.userDirections && act.userDirections.trim() ? `
                            <div class="creative-directions">
                                <strong>✨ Your Creative Directions:</strong> ${act.userDirections}
                            </div>
                            ` : ''}
                            <div class="content-placeholder">
                                <div class="placeholder-content">
                                    <span class="placeholder-icon">📝</span>
                                    <span class="placeholder-text">Your generated content will appear here</span>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    structureContainer.appendChild(actElement);
                });
            }
            
            // Store template data for generation
            window.appState.templateData = templateData;
            
        } catch (error) {
            console.error('Error loading template structure preview:', error);
            if (typeof showToast === 'function') {
                showToast('Could not load template structure preview', 'error');
            }
        }
    }

    // Get template data from already loaded templates
    async getTemplateDataFromExistingTemplates(templateId) {
        // Check if we have templates loaded
        if (!window.loadedTemplates) {
            console.log('Templates not loaded yet, loading...');
            if (typeof loadTemplates === 'function') {
                await loadTemplates();
            }
        }
        
        // Double-check templates are loaded and not null
        if (!window.loadedTemplates || typeof window.loadedTemplates !== 'object') {
            console.log('Failed to load templates, cannot get template data');
            return null;
        }
        
        // Search through all template groups
        try {
            for (const [groupKey, group] of Object.entries(window.loadedTemplates)) {
                if (group && group.templates && Array.isArray(group.templates)) {
                    const template = group.templates.find(t => t.id === templateId);
                    if (template) {
                        return template;
                    }
                }
            }
        } catch (error) {
            console.error('Error searching templates:', error);
            return null;
        }
        
        console.log(`Template ${templateId} not found in loaded templates`);
        return null;
    }

    // Fallback function to create template preview by loading template file directly
    async createSimpleTemplatePreview() {
        const structureContainer = document.getElementById('structureContent');
        if (!structureContainer) {
            console.log('Structure container not found');
            return;
        }
        
        try {
            // Try to load template data from the API endpoint
            const response = await fetch(`/api/template/${window.appState.selectedTemplate}`);
            if (response.ok) {
                const templateData = await response.json();
                console.log('Loaded template data from API:', templateData.name);
                
                // Use the full template data to create proper preview
                this.createFullTemplatePreview(templateData, structureContainer);
                return;
            }
        } catch (error) {
            console.log('Could not load template data from API, using basic preview');
        }
        
        // If template file loading fails, show basic preview
        this.createBasicTemplatePreview(structureContainer);
    }

    // Create full template preview with actual act structure
    createFullTemplatePreview(templateData, structureContainer) {
        // Clear existing content
        structureContainer.innerHTML = '';
        
        // Add preview header
        const previewHeader = document.createElement('div');
        previewHeader.className = 'structure-preview-header';
        previewHeader.innerHTML = `
            <h3>${templateData.name} Structure Preview</h3>
            <p class="structure-preview-description">${templateData.description}</p>
        `;
        structureContainer.appendChild(previewHeader);
        
        // Create preview structure
        if (templateData.structure) {
            Object.entries(templateData.structure).forEach(([key, act], index) => {
                const actElement = document.createElement('div');
                actElement.className = 'structure-element preview';
                actElement.setAttribute('data-act', key);
                
                const actName = act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                actElement.innerHTML = `
                    <div class="structure-element-header">
                        <h3>${actName}</h3>
                        <div class="structure-element-meta">
                            <span class="act-number">Act ${index + 1}</span>
                            <span class="preview-status">Template Preview</span>
                        </div>
                    </div>
                    <div class="structure-element-content">
                        <div class="template-description">
                            <strong>Template Guide:</strong> ${act.description || 'No description available'}
                        </div>
                        ${act.userDirections && act.userDirections.trim() ? `
                        <div class="creative-directions">
                            <strong>✨ Your Creative Directions:</strong> ${act.userDirections}
                        </div>
                        ` : ''}
                        <div class="content-placeholder">
                            <div class="placeholder-content">
                                <span class="placeholder-icon">📝</span>
                                <span class="placeholder-text">Ready for generation</span>
                            </div>
                        </div>
                    </div>
                `;
                
                structureContainer.appendChild(actElement);
            });
        }
    }

    // Create basic template preview
    createBasicTemplatePreview(structureContainer) {
        structureContainer.innerHTML = `
            <div class="structure-preview-header">
                <h3>Template Structure Preview</h3>
                <p class="structure-preview-description">Loading template structure...</p>
            </div>
            <div class="basic-preview-message">
                <p>📝 Template structure will be loaded when you generate your story structure.</p>
                <p>Click "Generate Acts" to create your customized story structure.</p>
            </div>
        `;
    }

    // ==================== PROGRESS & STATE MANAGEMENT ====================

    // Update all progress meters
    updateAllProgressMeters() {
        // Progress tracking functionality
        // This would call individual progress update functions
        console.log('🔄 Updating all progress meters');
    }

    // Update all generation buttons
    updateAllGenerationButtons() {
        // Button state management
        // This would update the state of generation buttons across the app
        console.log('🔄 Updating all generation buttons');
    }

    // ==================== UTILITY & HELPER FUNCTIONS ====================

    // Display scenes for a specific structural element
    displayScenesForElement(structureKey, sceneGroup, customContainer = null) {
        const container = customContainer || document.getElementById(`scenes-${structureKey}`);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (Array.isArray(sceneGroup)) {
            sceneGroup.forEach((scene, index) => {
                const sceneContent = JSON.stringify(scene);
                const sceneTitle = `Scene ${index + 1}: ${scene.title || scene.name || 'Untitled Scene'}`;
                
                if (typeof createEditableContentBlock === 'function') {
                    createEditableContentBlock({
                        id: `scene-${structureKey}-${index}`,
                        type: 'scenes',
                        title: sceneTitle,
                        content: sceneContent,
                        container: container,
                        metadata: { structureKey: structureKey, sceneIndex: index },
                        onSave: async (newContent, block) => {
                            // Save the edited scene content
                            if (typeof saveSceneContent === 'function') {
                                await saveSceneContent(structureKey, index, newContent);
                            }
                            
                            // Update the app state
                            let updatedScene;
                            try {
                                updatedScene = JSON.parse(newContent);
                            } catch (e) {
                                // If not valid JSON, update description
                                updatedScene = { ...scene, description: newContent };
                            }
                            
                            if (window.appState?.generatedScenes?.[structureKey]?.[index]) {
                                window.appState.generatedScenes[structureKey][index] = { 
                                    ...window.appState.generatedScenes[structureKey][index], 
                                    ...updatedScene 
                                };
                            }
                            
                            // Save to local storage
                            if (typeof saveToLocalStorage === 'function') {
                                saveToLocalStorage();
                            }
                        }
                    });
                }
            });
        }
    }

    // Calculate project card progress
    calculateProjectCardProgress(project) {
        let totalSteps = 0;
        let completedSteps = 0;
        
        // Count completion of different aspects
        if (project.storyInput) {
            totalSteps++;
            if (project.storyInput.title && project.storyInput.logline) {
                completedSteps++;
            }
        }
        
        if (project.generatedStructure) {
            totalSteps++;
            if (Object.keys(project.generatedStructure).length > 0) {
                completedSteps++;
            }
        }
        
        if (project.generatedScenes) {
            totalSteps++;
            if (Object.keys(project.generatedScenes).length > 0) {
                completedSteps++;
            }
        }
        
        if (project.generatedDialogues) {
            totalSteps++;
            if (Object.keys(project.generatedDialogues).length > 0) {
                completedSteps++;
            }
        }
        
        return totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    }

    // Generate project card
    generateProjectCard(project, context = 'modal') {
        const progress = this.calculateProjectCardProgress(project);
        const progressClass = progress >= 75 ? 'high' : progress >= 50 ? 'medium' : 'low';
        
        return `
            <div class="project-card ${context}" data-project-path="${project.path}">
                <div class="project-card-header">
                    <h3 class="project-title">${project.title || 'Untitled Project'}</h3>
                    <div class="project-meta">
                        <span class="project-date">${new Date(project.lastModified).toLocaleDateString()}</span>
                        <span class="project-progress ${progressClass}">${progress}%</span>
                    </div>
                </div>
                <div class="project-card-body">
                    <p class="project-logline">${project.logline || 'No logline available'}</p>
                    <div class="project-stats">
                        <span class="stat">
                            <span class="stat-label">Template:</span>
                            <span class="stat-value">${project.templateName || 'Unknown'}</span>
                        </span>
                        <span class="stat">
                            <span class="stat-label">Scenes:</span>
                            <span class="stat-value">${project.sceneCount || 0}</span>
                        </span>
                    </div>
                </div>
                <div class="project-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="loadProject('${project.path}')">
                        📂 Load Project
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="duplicateProject('${project.path}', '${project.title}')">
                        📋 Duplicate
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProject('${project.path}', '${project.title}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    // Download file utility
    downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Clear all content containers
    clearAllContentContainers() {
        const containers = [
            'structureContent',
            'plotPointsContent',
            'scenesContent',
            'dialogueContent',
            'scriptContent'
        ];
        
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '';
            }
        });
    }

    // ==================== PROJECT MANAGEMENT ====================

    // Create new project
    async newProject() {
        if (typeof showToast === 'function') {
            showToast('Starting new project...', 'info');
        }
        
        this.clearAllContentContainers();
        this.startFreshProject();
    }

    // Start fresh project
    startFreshProject() {
        // Reset app state
        if (window.appState) {
            window.appState.currentStep = 1;
            window.appState.storyInput = {};
            window.appState.selectedTemplate = null;
            window.appState.templateData = null;
            window.appState.generatedStructure = null;
            window.appState.generatedScenes = null;
            window.appState.generatedDialogues = {};
            window.appState.projectId = null;
            window.appState.projectPath = null;
            window.appState.currentStoryConcept = null;
            window.appState.customPrompt = null;
        }
        
        // Navigate to first step
        if (typeof goToStep === 'function') {
            goToStep(1);
        }
        
        // Save to localStorage
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }
    }

    // Save project
    saveProject() {
        // Trigger project save if there's data to save
        if (window.appState?.generatedStructure && window.appState?.storyInput) {
            if (typeof showToast === 'function') {
                showToast('Project auto-saves after each step. Manual save coming soon!', 'info');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('No project data to save yet.', 'error');
            }
        }
    }

    // Preview all plot points prompt
    async previewAllPlotPointsPrompt() {
        if (!window.appState?.generatedStructure || !window.appState?.storyInput || !window.appState?.generatedScenes) {
            if (typeof showToast === 'function') {
                showToast('No structure, story data, or scenes available for prompt preview.', 'error');
            }
            return;
        }

        // Check if we have a generated structure
        if (!window.appState.generatedStructure || Object.keys(window.appState.generatedStructure).length === 0) {
            if (typeof showToast === 'function') {
                showToast('No story structure found. Please generate a structure first.', 'error');
            }
            return;
        }

        // Build structure elements array for the prompt
        const structureElements = [];
        Object.entries(window.appState.generatedStructure).forEach(([key, act]) => {
            structureElements.push({
                key: key,
                name: act.name || key.replace(/_/g, ' ').toUpperCase(),
                description: act.description || '',
                characterDevelopments: act.character_developments || act.character_development || ''
            });
        });

        try {
            if (typeof showLoading === 'function') {
                showLoading('Generating all plot points prompt preview...');
            }
            
            const response = await fetch('/api/preview-plot-point-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': window.appState.apiKey
                },
                body: JSON.stringify({
                    storyInput: window.appState.storyInput,
                    structure: window.appState.generatedStructure,
                    templateData: window.appState.templateData,
                    structureElements: structureElements
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store the prompt data for the modal
                window.appState.currentPlotPrompt = {
                    systemMessage: data.systemMessage,
                    userPrompt: data.prompt,
                    promptType: data.promptType,
                    isAllPlotPoints: true
                };
                
                // Show the plot point prompt modal
                if (typeof showPlotPointPromptModal === 'function') {
                    showPlotPointPromptModal();
                }
                if (typeof hideLoading === 'function') {
                    hideLoading();
                }
            } else {
                throw new Error(data.error || 'Failed to generate plot points prompt preview');
            }
        } catch (error) {
            console.error('Error generating plot points prompt preview:', error);
            if (typeof showToast === 'function') {
                showToast('Error generating plot points prompt preview. Please try again.', 'error');
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
        }
    }

    // ==================== ACT CARDS TEMPLATE WORKFLOW ====================

    // Load template structure for act cards
    async loadTemplateStructureForActCards(templateData) {
        console.log('🎭 Loading template structure for act cards:', templateData.name);
        console.log('🔍 DEBUG: Current appState.templateData:', window.appState?.templateData);
        console.log('🔍 DEBUG: Incoming templateData:', templateData);
        
        try {
            // Check if we already have customized template data
            const templateMatches = window.appState?.templateData && 
                (window.appState.templateData.id === templateData.id || 
                 window.appState.templateData.name === templateData.name) && 
                window.appState.templateData.structure;
            
            if (templateMatches) {
                console.log('🎭 Using existing customized template data (preserving user edits)');
                console.log('🔍 DEBUG: Using customized structure keys:', Object.keys(window.appState.templateData.structure));
                const existingTemplateData = window.appState.templateData;
                
                // Update the header with template name and act count
                this.updateActCardsHeader(existingTemplateData.name, Object.keys(existingTemplateData.structure).length);
                
                // Create and display act cards with existing (potentially edited) data
                await this.createActCards(existingTemplateData.structure);
            } else {
                console.log('🎭 Fetching fresh template data from server');
                console.log('🔍 DEBUG: Condition failed because:');
                console.log('  - appState.templateData exists:', !!window.appState?.templateData);
                console.log('  - ID match:', window.appState?.templateData?.id === templateData.id);
                console.log('  - Structure exists:', !!window.appState?.templateData?.structure);
                
                // Fetch the full template data including structure
                const response = await fetch(`/api/template/${templateData.id}`);
                if (!response.ok) {
                    throw new Error('Failed to load template structure');
                }
                
                const fullTemplateData = await response.json();
                console.log('🎭 Full template data loaded:', fullTemplateData);
                
                // Store template data in appState for editing (ensure ID is included)
                window.appState.templateData = {
                    ...fullTemplateData,
                    id: templateData.id // Ensure ID is preserved for future comparisons
                };
                
                // Initialize userDirections for all acts if not present (backwards compatibility)
                if (window.appState.templateData.structure) {
                    Object.keys(window.appState.templateData.structure).forEach(actKey => {
                        if (!window.appState.templateData.structure[actKey].hasOwnProperty('userDirections')) {
                            window.appState.templateData.structure[actKey].userDirections = '';
                        }
                    });
                }
                
                console.log('🎭 Template data stored in appState for editing');
                
                // Update the header with template name and act count
                this.updateActCardsHeader(fullTemplateData.name, Object.keys(fullTemplateData.structure).length);
                
                // Create and display act cards
                await this.createActCards(fullTemplateData.structure);
            }
            
            // Show the act cards container
            const actCardsContainer = document.getElementById('actCardsContainer');
            if (actCardsContainer) {
                actCardsContainer.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error loading template structure:', error);
            // Hide act cards container on error
            const actCardsContainer = document.getElementById('actCardsContainer');
            if (actCardsContainer) {
                actCardsContainer.style.display = 'none';
            }
        }
    }

    // Update act cards header
    updateActCardsHeader(templateName, actCount) {
        // Update the header title to show the template and act count
        const headerTitle = document.querySelector('.act-cards-header h4');
        if (headerTitle) {
            headerTitle.textContent = `${templateName} contains ${actCount} acts:`;
        }
        
        // Hide the description/subtitle
        const headerDescription = document.querySelector('.act-cards-description');
        if (headerDescription) {
            headerDescription.style.display = 'none';
        }
    }

    // Create act cards
    async createActCards(templateStructure) {
        const actCardsScroll = document.getElementById('actCardsScroll');
        if (!actCardsScroll || !templateStructure) {
            console.warn('Act cards container not found or no template structure');
            return;
        }
        
        // Clear existing cards
        actCardsScroll.innerHTML = '';
        
        // Preserve original act order by fetching from original template file
        let acts = [];
        
        // Always get the correct order from the original template file
        if (window.appState?.selectedTemplate) {
            try {
                // Fetch the original template to get the correct key order
                const response = await fetch(`/api/template/${window.appState.selectedTemplate}`);
                if (response.ok) {
                    const originalTemplate = await response.json();
                    const originalOrder = Object.keys(originalTemplate.structure);
                    console.log('🔧 Using original template order:', originalOrder);
                    
                    // Use original order but with customized content
                    acts = originalOrder.map((key, index) => {
                        const act = templateStructure[key];
                        if (act) {
                            return {
                                key,
                                number: index + 1,
                                name: act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                description: act.description || 'No description available',
                                elements: act.elements || [],
                                plotPoints: act.plotPoints || (act.distribution && act.distribution.plotPoints) || 4,
                                userDirections: act.userDirections || ''
                            };
                        }
                    }).filter(Boolean);
                } else {
                    throw new Error('Failed to fetch original template');
                }
            } catch (error) {
                console.warn('Could not fetch original template order, using current order:', error);
                // Fallback: Use current object order
                acts = Object.entries(templateStructure).map(([key, act], index) => ({
                    key,
                    number: index + 1,
                    name: act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: act.description || 'No description available',
                    elements: act.elements || [],
                    plotPoints: act.plotPoints || (act.distribution && act.distribution.plotPoints) || 4,
                    userDirections: act.userDirections || ''
                }));
            }
        } else {
            // Fallback: Use current object order (for backwards compatibility)
            acts = Object.entries(templateStructure).map(([key, act], index) => ({
                key,
                number: index + 1,
                name: act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                description: act.description || 'No description available',
                elements: act.elements || [],
                plotPoints: act.plotPoints || (act.distribution && act.distribution.plotPoints) || 4,
                userDirections: act.userDirections || ''
            }));
        }
        
        const totalActs = acts.length;
        console.log('🎭 Creating act cards for:', totalActs, 'acts');
        
        // Create act cards
        acts.forEach(act => {
            const actCard = this.createActCard(act, totalActs);
            actCardsScroll.appendChild(actCard);
        });
    }

    // Create individual act card
    createActCard(act, totalActs) {
        const card = document.createElement('div');
        card.className = 'act-card';
        card.setAttribute('data-act-key', act.key);
        card.setAttribute('data-user-directions', act.userDirections || '');
        
        // Truncate title for display (keep full title for tooltip)
        const truncatedTitle = act.name.length > 20 ? act.name.substring(0, 17) + '...' : act.name;
        const truncatedDescription = act.description.length > 80 ? act.description.substring(0, 77) + '...' : act.description;
        
        // Use consistent act numbering format
        const actNumber = `${act.number}/${totalActs}`;
        
        // Get plot points from act data
        let plotPoints = 4; // default
        if (act.plotPoints) {
            plotPoints = act.plotPoints;
        } else if (act.distribution && act.distribution.plotPoints) {
            plotPoints = act.distribution.plotPoints;
        }
        
        card.innerHTML = `
            <div class="act-card-number">${actNumber}</div>
            <div class="act-card-title" data-original="${act.name}">${truncatedTitle}</div>
            <div class="act-card-description" data-original="${act.description}">${truncatedDescription}</div>
            <div class="act-card-edit-icon">✏️</div>
            <div class="act-card-plot-points" data-original="${plotPoints}">${plotPoints} pts</div>
            <div class="act-card-tooltip">
                <strong>${act.name}</strong><br>
                ${act.description}
                ${act.elements && act.elements.length > 0 ? `<br><br><em>Elements: ${act.elements.join(', ')}</em>` : ''}
                <br><br><strong>Plot Points:</strong> ${plotPoints}
            </div>
        `;
        
        // Add click handler for opening modal
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof showActDetailsModal === 'function') {
                showActDetailsModal(act);
            }
        });
        
        return card;
    }

    // Start editing act card
    startEditingActCard(card, act) {
        console.log('🎭 Starting edit mode for act:', act.name);
        
        // Close any other cards that are currently being edited
        this.closeAllEditingCards();
        
        // Add editing class
        card.classList.add('editing');
        
        // Get title, description, and plot points elements
        const titleElement = card.querySelector('.act-card-title');
        const descriptionElement = card.querySelector('.act-card-description');
        const plotPointsElement = card.querySelector('.act-card-plot-points');
        
        // Convert to editable text areas
        const titleTextarea = document.createElement('textarea');
        titleTextarea.className = 'act-card-title editable';
        titleTextarea.value = titleElement.getAttribute('data-original');
        titleTextarea.rows = 1;
        
        const descriptionTextarea = document.createElement('textarea');
        descriptionTextarea.className = 'act-card-description editable';
        descriptionTextarea.value = descriptionElement.getAttribute('data-original');
        descriptionTextarea.rows = 3;
        
        // Convert plot points to editable input
        const plotPointsInput = document.createElement('input');
        plotPointsInput.type = 'number';
        plotPointsInput.min = '1';
        plotPointsInput.max = '20';
        plotPointsInput.className = 'act-card-plot-points editable';
        plotPointsInput.value = plotPointsElement.getAttribute('data-original');
        
        // Replace elements
        titleElement.replaceWith(titleTextarea);
        descriptionElement.replaceWith(descriptionTextarea);
        plotPointsElement.replaceWith(plotPointsInput);
        
        // Auto-resize textareas
        this.autoResizeTextarea(titleTextarea);
        this.autoResizeTextarea(descriptionTextarea);
        
        // Focus on title
        titleTextarea.focus();
        titleTextarea.select();
        
        // Add auto-resize listeners
        titleTextarea.addEventListener('input', () => this.autoResizeTextarea(titleTextarea));
        descriptionTextarea.addEventListener('input', () => this.autoResizeTextarea(descriptionTextarea));
        
        // Hide tooltip during editing
        const tooltip = card.querySelector('.act-card-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    // Save act card changes
    saveActCardChanges(card, act) {
        console.log('🎭 Saving changes for act:', act.name);
        
        // Get current values from textareas and input
        const titleTextarea = card.querySelector('.act-card-title.editable');
        const descriptionTextarea = card.querySelector('.act-card-description.editable');
        const plotPointsInput = card.querySelector('.act-card-plot-points.editable');
        
        if (!titleTextarea || !descriptionTextarea || !plotPointsInput) {
            console.error('Could not find editable elements');
            return;
        }
        
        const newTitle = titleTextarea.value.trim();
        const newDescription = descriptionTextarea.value.trim();
        const newPlotPoints = parseInt(plotPointsInput.value) || 1;
        
        // Validate inputs
        if (!newTitle) {
            alert('Act title cannot be empty');
            titleTextarea.focus();
            return;
        }
        
        if (!newDescription) {
            alert('Act description cannot be empty');
            descriptionTextarea.focus();
            return;
        }
        
        if (newPlotPoints < 1 || newPlotPoints > 20) {
            alert('Plot points must be between 1 and 20');
            plotPointsInput.focus();
            return;
        }
        
        // Update the act object
        act.name = newTitle;
        act.description = newDescription;
        act.plotPoints = newPlotPoints;
        
        // Update template data in app state
        this.updateTemplateStructureInAppState(act.key, newTitle, newDescription, newPlotPoints);
        
        // Exit editing mode
        this.exitEditingMode(card, act);
        
        // Show save feedback
        this.showActCardSaveFeedback(card, 'Changes saved!');
        
        // Save to database immediately
        if (window.autoSaveManager) {
            window.autoSaveManager.saveImmediately();
        }
        
        console.log('🎭 Act updated:', { key: act.key, name: newTitle, description: newDescription });
    }

    // Cancel act card editing
    cancelActCardEditing(card, act) {
        console.log('🎭 Cancelling edit for act:', act.name);
        this.exitEditingMode(card, act);
    }

    // Exit editing mode
    exitEditingMode(card, act, silent = false) {
        if (!silent) {
            console.log('🎭 Exiting edit mode for act:', act.name);
        }
        
        // Remove editing class
        card.classList.remove('editing');
        
        // Get textareas and input
        const titleTextarea = card.querySelector('.act-card-title.editable');
        const descriptionTextarea = card.querySelector('.act-card-description.editable');
        const plotPointsInput = card.querySelector('.act-card-plot-points.editable');
        
        if (!titleTextarea || !descriptionTextarea || !plotPointsInput) return;
        
        // Create display elements with updated content
        const titleDiv = document.createElement('div');
        titleDiv.className = 'act-card-title';
        titleDiv.setAttribute('data-original', act.name);
        const truncatedTitle = act.name.length > 20 ? act.name.substring(0, 17) + '...' : act.name;
        titleDiv.textContent = truncatedTitle;
        
        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'act-card-description';
        descriptionDiv.setAttribute('data-original', act.description);
        const truncatedDescription = act.description.length > 80 ? act.description.substring(0, 77) + '...' : act.description;
        descriptionDiv.textContent = truncatedDescription;
        
        const plotPointsDiv = document.createElement('div');
        plotPointsDiv.className = 'act-card-plot-points';
        plotPointsDiv.setAttribute('data-original', act.plotPoints || 4);
        plotPointsDiv.textContent = `${act.plotPoints || 4} pts`;
        
        // Replace textareas with display elements
        titleTextarea.replaceWith(titleDiv);
        descriptionTextarea.replaceWith(descriptionDiv);
        plotPointsInput.replaceWith(plotPointsDiv);
        
        // Update tooltip
        const tooltip = card.querySelector('.act-card-tooltip');
        if (tooltip) {
            tooltip.innerHTML = `
                <strong>${act.name}</strong><br>
                ${act.description}
                ${act.elements && act.elements.length > 0 ? `<br><br><em>Elements: ${act.elements.join(', ')}</em>` : ''}
                <br><br><strong>Plot Points:</strong> ${act.plotPoints || 4}
            `;
            tooltip.style.display = '';
        }
    }

    // Update template structure in app state
    updateTemplateStructureInAppState(actKey, newTitle, newDescription, newPlotPoints, userDirections = null) {
        console.log('🔍 DEBUG: updateTemplateStructureInAppState called:', { actKey, newTitle, newDescription, newPlotPoints, userDirections });
        
        // Update the template data in appState
        if (window.appState?.templateData?.structure?.[actKey]) {
            console.log('🔍 DEBUG: Before update:', {
                name: window.appState.templateData.structure[actKey].name,
                description: window.appState.templateData.structure[actKey].description,
                userDirections: window.appState.templateData.structure[actKey].userDirections
            });
            
            window.appState.templateData.structure[actKey].name = newTitle;
            window.appState.templateData.structure[actKey].description = newDescription;
            window.appState.templateData.structure[actKey].plotPoints = newPlotPoints;
            
            // Add userDirections support - preserve existing or update if provided
            if (userDirections !== null) {
                window.appState.templateData.structure[actKey].userDirections = userDirections;
            } else if (!window.appState.templateData.structure[actKey].hasOwnProperty('userDirections')) {
                // Initialize userDirections field for backwards compatibility
                window.appState.templateData.structure[actKey].userDirections = '';
            }
            
            console.log('🔍 DEBUG: After update:', {
                name: window.appState.templateData.structure[actKey].name,
                description: window.appState.templateData.structure[actKey].description,
                userDirections: window.appState.templateData.structure[actKey].userDirections
            });
            
            // Trigger auto-save if available
            if (window.autoSaveManager) {
                console.log('🔍 DEBUG: Triggering auto-save...');
                window.autoSaveManager.markDirty();
            }
            
            console.log('🎭 Template structure updated in app state');
        } else {
            console.error('🚨 DEBUG: Failed to update template structure - missing data:', {
                hasTemplateData: !!window.appState?.templateData,
                hasStructure: !!window.appState?.templateData?.structure,
                hasActKey: !!window.appState?.templateData?.structure?.[actKey],
                actKey,
                availableKeys: window.appState?.templateData?.structure ? Object.keys(window.appState.templateData.structure) : 'none'
            });
        }
    }

    // Show act card save feedback
    showActCardSaveFeedback(card, message) {
        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = 'act-card-save-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: absolute;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Add to card
        card.style.position = 'relative';
        card.appendChild(feedback);
        
        // Show feedback
        setTimeout(() => {
            feedback.style.opacity = '1';
        }, 10);
        
        // Remove feedback after 2 seconds
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 2000);
    }

    // Auto-resize textarea
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // Close all editing cards
    closeAllEditingCards() {
        const editingCards = document.querySelectorAll('.act-card.editing');
        editingCards.forEach(card => {
            const actKey = card.getAttribute('data-act-key');
            if (actKey) {
                // Find the act data
                const act = this.getActDataFromKey(actKey);
                if (act) {
                    this.exitEditingMode(card, act, true);
                }
            }
        });
    }

    // Get act data from key
    getActDataFromKey(actKey) {
        if (window.appState?.templateData?.structure?.[actKey]) {
            const act = window.appState.templateData.structure[actKey];
            return {
                key: actKey,
                name: act.name || actKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                description: act.description || 'No description available',
                plotPoints: act.plotPoints || 4,
                userDirections: act.userDirections || ''
            };
        }
        return null;
    }

    // ==================== REGENERATE SCENES ====================

    // Regenerate scenes (simple method)
    async regenerateScenes(method = 'simple') {
        if (!window.appState?.generatedStructure || !window.appState?.projectPath) {
            if (typeof showToast === 'function') {
                showToast('No structure or project to regenerate scenes for.', 'error');
            }
            return;
        }
        
        try {
            if (typeof showLoading === 'function') {
                showLoading('Generating simple scene distribution...');
            }
            
            const response = await fetch(`/api/regenerate-scenes-simple/${window.appState.projectPath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': window.appState.apiKey
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Convert the scenes format to the format expected by displayScenes
                const convertedScenes = {};
                Object.entries(data.scenes).forEach(([key, value]) => {
                    convertedScenes[key] = value.scenes; // Extract the scenes array from the nested structure
                });
                
                window.appState.generatedScenes = convertedScenes;
                if (typeof displayScenes === 'function') {
                    displayScenes(convertedScenes);
                }
                
                // Count total scenes for display
                const totalScenes = Object.values(convertedScenes).reduce((total, scenes) => total + scenes.length, 0);
                if (typeof showToast === 'function') {
                    showToast(`Simple scenes generated successfully! (${totalScenes} scenes)`, 'success');
                }
            } else {
                throw new Error(data.error || 'Failed to regenerate scenes');
            }
            
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            if (typeof saveToLocalStorage === 'function') {
                saveToLocalStorage();
            }
        } catch (error) {
            console.error('Error regenerating scenes:', error);
            if (typeof showToast === 'function') {
                showToast('Error regenerating scenes. Please try again.', 'error');
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
        }
    }
}

// Initialize the Navigation & Workflow Manager
const navigationWorkflowManager = new NavigationWorkflowManager();
window.navigationWorkflowManager = navigationWorkflowManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    navigationWorkflowManager.init();
}); 