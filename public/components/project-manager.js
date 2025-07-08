// =====================================================
// Project Manager Component
// =====================================================
// Manages all project operations: load, save, create, delete, duplicate, etc.

class ProjectManager {
    constructor() {
        console.log('🔧 ProjectManager initialized');
    }

    // Save current project
    async saveProject() {
        try {
            showLoading('Saving project...');
            
            const response = await fetch('/api/auto-save-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    ...appState,
                    username: appState.user?.username || 'guest',
                    timestamp: new Date().toISOString()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                appState.projectId = data.projectId;
                appState.projectPath = data.projectPath;
                showToast(`Project saved! (${data.projectPath})`, 'success');
            } else {
                // Check for specific bug detection error
                if (data.action === 'reload_required') {
                    showToast(`⚠️ ${data.message}`, 'error');
                    console.error('🚨 Auto-save bug detected:', data);
                    
                    // Ask user if they want to reload
                    if (confirm('There was an issue with the project state. Would you like to reload the page to fix this? (Your progress should be preserved)')) {
                        window.location.reload();
                    }
                    return;
                }
                throw new Error(data.error || 'Failed to save project');
            }
            
            hideLoading();
            saveToLocalStorage();
        } catch (error) {
            console.error('Error saving project:', error);
            showToast('Error saving project. Please try again.', 'error');
            hideLoading();
        }
    }

    // Create a new project (save current and start fresh)
    async newProject() {
        // If there's no current project data, just start fresh
        if (!appState.storyInput || !appState.storyInput.title) {
            showToast('Starting new project...', 'info');
            this.startFreshProject();
            return;
        }
        
        // Confirm with user
        if (!confirm('Save current project and start a new one? This will save your current progress and clear the workspace.')) {
            return;
        }
        
        try {
            // Save current project first
            showLoading('Saving current project...');
            
            const response = await fetch('/api/auto-save-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    ...appState,
                    username: appState.user?.username || 'guest',
                    timestamp: new Date().toISOString()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast(`Current project saved! (${data.projectPath}) Starting new project...`, 'success');
                
                // Start fresh project after successful save
                setTimeout(() => {
                    this.startFreshProject();
                }, 1000); // Give user time to see the success message
            } else {
                // Check for specific bug detection error
                if (data.action === 'reload_required') {
                    showToast(`⚠️ ${data.message}`, 'error');
                    console.error('🚨 Auto-save bug detected during new project:', data);
                    
                    // Ask user if they want to reload
                    if (confirm('There was an issue with the project state. Would you like to reload the page to fix this? (Your current project may need to be reloaded)')) {
                        window.location.reload();
                    }
                    return;
                }
                throw new Error(data.error || 'Failed to save current project');
            }
            
            hideLoading();
        } catch (error) {
            console.error('Error saving current project:', error);
            hideLoading();
            
            // Ask user if they want to proceed without saving
            if (confirm('Failed to save current project. Would you like to start a new project anyway? (Current progress will be lost)')) {
                this.startFreshProject();
            }
        }
    }

    // Load an existing project
    async loadProject(projectPath) {
        try {
            showLoading('Loading project...');
            
            console.log('Loading project:', projectPath);
            const username = appState.user?.username || 'guest';
            const response = await fetch(`/api/load-project/${encodeURIComponent(projectPath)}?username=${encodeURIComponent(username)}`);
            console.log('Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                // Handle HTTP errors properly
                let errorMessage = 'Failed to load project';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    // If response isn't JSON, use status text
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const rawProjectData = await response.json();
            console.log('Raw project data loaded:', rawProjectData);
            
            // Handle different response formats:
            // - Direct format: { storyInput: {}, creativeDirections: {} }
            // - Wrapped format: { project: { storyInput: {}, creativeDirections: {} } }
            const projectData = rawProjectData.project || rawProjectData;
            console.log('Processed project data:', projectData);
            
            try {
                // Populate all form fields with loaded data
                console.log('About to call populateFormWithProject...');
                console.log('Project data being passed:', projectData);
                await this.populateFormWithProject(projectData);
                console.log('populateFormWithProject completed successfully');
            } catch (error) {
                console.error('Error in populateFormWithProject:', error);
                console.error('Error stack:', error.stack);
                showToast(`Error loading project: ${error.message}`, 'error');
            }
            
            // Hide modal
            this.hideLoadProjectModal();
            hideLoading();
            
        } catch (error) {
            console.error('Error loading project:', error);
            showToast(`Error loading project: ${error.message}`, 'error');
            hideLoading();
        }
    }

    // Delete a project
    async deleteProject(projectPath, projectTitle) {
        // Show confirmation dialog
        const confirmMessage = `Are you sure you want to delete the project "${projectTitle}"?\n\nThis will permanently delete all files including:\n• Story structure\n• Generated scenes\n• Dialogue\n• Exported scripts\n\nThis action cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            showLoading('Deleting project...');
            
            // Get current user info from app state
            const user = appState.user;
            if (!user || !user.id) {
                throw new Error('User not authenticated');
            }
            
            const response = await fetch(`/api/users/${user.id}/projects`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': localStorage.getItem('apiKey')
                },
                body: JSON.stringify({
                    project_name: projectPath
                })
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to delete project';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            hideLoading();
            showToast(`Project "${projectTitle}" deleted successfully!`, 'success');
            
            // Refresh the projects list
            this.showLoadProjectModal();
            
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast(`Error deleting project: ${error.message}`, 'error');
            hideLoading();
        }
    }

    // Duplicate a project
    async duplicateProject(projectPath, projectTitle) {
        try {
            // Safety check - ensure all required functions are available
            if (typeof showLoading !== 'function' || typeof hideLoading !== 'function' || typeof showToast !== 'function') {
                console.error('Required functions not available:', {
                    showLoading: typeof showLoading,
                    hideLoading: typeof hideLoading,
                    showToast: typeof showToast
                });
                alert('System not fully loaded. Please wait a moment and try again.');
                return;
            }
            
            showLoading('Duplicating project...');
            
            // Get current user info from app state
            const user = appState.user;
            if (!user || !user.id) {
                throw new Error('User not authenticated');
            }
            
            const response = await fetch(`/api/users/${user.id}/projects/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': localStorage.getItem('apiKey')
                },
                body: JSON.stringify({
                    project_name: projectPath
                })
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to duplicate project';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            hideLoading();
            showToast(`Project duplicated! New project: "${result.new_project_title}"`, 'success');
            
            // Refresh the projects list to show the new duplicate
            this.showLoadProjectModal();
            
        } catch (error) {
            console.error('Error duplicating project:', error);
            showToast(`Error duplicating project: ${error.message}`, 'error');
            hideLoading();
        }
    }

    // Show load project modal
    async showLoadProjectModal() {
        const modal = document.getElementById('loadProjectModal');
        const projectsList = document.getElementById('projectsList');
        
        modal.classList.add('show');
        projectsList.innerHTML = '<p>Loading projects...</p>';
        
        try {
            const username = appState.user?.username || 'guest';
            const response = await fetch(`/api/list-projects?username=${encodeURIComponent(username)}`);
            const data = await response.json();
            
            // Handle server errors (503, 500, etc.)
            if (!response.ok) {
                console.error('Server error loading projects:', data);
                if (response.status === 503) {
                    projectsList.innerHTML = '<p style="color: orange; text-align: center;">🔄 Services starting up, please wait a moment and try again...</p>';
                } else {
                    projectsList.innerHTML = '<p style="color: red; text-align: center;">Error loading projects. Please try again.</p>';
                }
                return;
            }
            
            // Handle error responses that returned 200 but contain errors
            if (data.error) {
                console.error('API error loading projects:', data);
                projectsList.innerHTML = '<p style="color: red; text-align: center;">Error loading projects. Please try again.</p>';
                return;
            }
            
            // Ensure we have an array
            const projects = Array.isArray(data) ? data : [];
            
            if (projects.length === 0) {
                projectsList.innerHTML = '<p style="text-align: center; color: #718096;">No previous projects found.</p>';
                return;
            }
            
            projectsList.innerHTML = '';
            
            projects.forEach(project => {
                const projectDiv = document.createElement('div');
                projectDiv.innerHTML = this.generateProjectCard(project, 'modal');
                projectsList.appendChild(projectDiv.firstElementChild);
            });
        } catch (error) {
            console.error('Error loading projects:', error);
            projectsList.innerHTML = '<p style="color: red; text-align: center;">Error loading projects. Please try again.</p>';
        }
    }

    // Hide load project modal
    hideLoadProjectModal() {
        document.getElementById('loadProjectModal').classList.remove('show');
    }

    // Generate a project card for display
    generateProjectCard(project, context = 'modal') {
        // Calculate progress based on available project data
        const progressInfo = this.calculateProjectCardProgress(project);
        const progressBadge = `<span class="progress-badge" title="${progressInfo.icon} ${progressInfo.label}">${progressInfo.step}/7</span>`;
        
        // Safe fallback values for undefined properties
        const safeTitle = project.title || 'Untitled Project';
        const safeLogline = project.logline || 'No description available';
        const escapedTitle = safeTitle.replace(/'/g, "\\'");
        
        // Different actions based on context
        const actions = context === 'profile' ? `
            <button class="load-project-btn" onclick="event.stopPropagation(); openProject('${project.path}')">
                📁 Open Project
            </button>
            <button class="duplicate-project-btn" onclick="event.stopPropagation(); duplicateProject('${project.path}', '${escapedTitle}')">
                📄 Duplicate
            </button>
            <button class="delete-project-btn" onclick="event.stopPropagation(); (async () => { try { await deleteProject('${project.path}', '${escapedTitle}'); } catch(e) { console.error('Delete error:', e); } })()">
                🗑️ Delete
            </button>
        ` : `
            <button class="load-project-btn" onclick="(async () => { try { await loadProject('${project.path}'); } catch(e) { console.error('Load error:', e); } })()">
                📁 Load Project
            </button>
            <button class="duplicate-project-btn" onclick="(async () => { try { await duplicateProject('${project.path}', '${escapedTitle}'); } catch(e) { console.error('Duplicate error:', e); } })()">
                📄 Duplicate
            </button>
            <button class="delete-project-btn" onclick="(async () => { try { await deleteProject('${project.path}', '${escapedTitle}'); } catch(e) { console.error('Delete error:', e); } })()">
                🗑️ Delete
            </button>
        `;
        
        return `
            <div class="project-item">
                <div class="project-header">
                    <h4>${safeTitle}</h4>
                    ${progressBadge}
                </div>
                <div class="project-meta">
                    <strong>Last saved:</strong> ${new Date(project.updatedAt || project.createdAt).toLocaleString()}
                </div>
                <div class="project-logline">"${safeLogline}"</div>
                <div class="project-actions">
                    ${actions}
                </div>
            </div>
        `;
    }

    // Calculate project progress for display
    calculateProjectCardProgress(project) {
        // Step labels and icons for each step
        const stepInfo = {
            1: { label: 'Story Concept', icon: '💡' },
            2: { label: 'Template Selection', icon: '📋' },
            3: { label: 'Structure Generation', icon: '🏗️' },
            4: { label: 'Plot Points', icon: '📍' },
            5: { label: 'Scene Generation', icon: '🎬' },
            6: { label: 'Dialogue Generation', icon: '💬' },
            7: { label: 'Script Complete', icon: '✅' }
        };
        
        // Use the same logic as the profile page - check thumbnail_data for currentStep
        if (project.thumbnail_data && project.thumbnail_data.currentStep) {
            const currentStep = project.thumbnail_data.currentStep;
            return {
                step: currentStep,
                label: stepInfo[currentStep].label,
                icon: stepInfo[currentStep].icon
            };
        }
        
        // Fallback to basic calculation if no thumbnail_data
        let currentStep = 1; // Default to step 1 (Story Concept)
        
        // If we have title and logline, we're at least at step 1
        if (project.title && project.logline) {
            currentStep = 1;
            
            // If we have a total scenes count, it suggests they've made some progress
            if (project.totalScenes && project.totalScenes > 0) {
                currentStep = 2; // Likely at least selected a template
            }
        }
        
        return {
            step: currentStep,
            label: stepInfo[currentStep].label,
            icon: stepInfo[currentStep].icon
        };
    }

    // Populate form with project data
    async populateFormWithProject(projectData, showToastMessage = true, isRestore = false) {
        console.log('=== START populateFormWithProject ===');
        console.log('Populating form with project data:', projectData);
        console.log('Is restore operation:', isRestore);
        
        // Refresh dropdowns to include any new custom library entries
        await populateDropdowns();
        
        // Note: We don't clear existing state here anymore - we'll overwrite with loaded data
        console.log('Loading project data (preserving existing state until overwritten)...');
        
        // Populate basic story info
        console.log('Populating basic story info...');
        console.log('Loading project with title:', projectData.storyInput.title);
        
        // Restore story concept if available
        console.log('🔍 STORY CONCEPT DEBUG:', {
            hasStoryConcept: !!projectData.storyInput.storyConcept,
            storyConceptData: projectData.storyInput.storyConcept,
            fallbackTitle: projectData.storyInput.title,
            fallbackLogline: projectData.storyInput.logline
        });
        
        // Load project data (unified v2.0 format - with temporary legacy localStorage compatibility)
        appState.currentStoryConcept = projectData.storyInput?.storyConcept || {};
        
        // 🔧 FIXED: Always load current character data from database
        // The database now stores the authoritative character data in projectCharacters
        appState.projectCharacters = projectData.projectCharacters || [];
        console.log('✅ Characters loaded from project data:', appState.projectCharacters.length);
        
        // 🔧 LEGACY CLEANUP: Remove any stale character data from storyInput to prevent conflicts
        if (projectData.storyInput?.charactersData) {
            console.log('🧹 Cleaning up legacy charactersData field');
            delete projectData.storyInput.charactersData;
        }
        
        appState.influences = projectData.influences || projectData.storyInput?.influences || { directors: [], screenwriters: [], films: [], tones: [] };
        appState.storyInput = projectData.storyInput || {};
        
        // 🔧 CRITICAL FIX: Always regenerate formatted character strings when loading projects
        // This prevents [object Object] issues in prompts caused by character objects being saved in storyInput.characters
        if (appState.projectCharacters && appState.projectCharacters.length > 0 && appState.storyInput) {
            appState.storyInput.characters = getCharactersForPrompt();
            console.log('🔧 Fixed character format on project load:', appState.storyInput.characters);
        }
        
        // Temporary fallbacks for legacy localStorage data (can be removed after migration period)
        appState.selectedTemplate = projectData.selectedTemplate || projectData.template?.id;
        appState.templateData = projectData.templateData || projectData.template;
        
        // 🆕 Step 1: Initialize userDirections for loaded projects if not present (backwards compatibility)
        if (appState.templateData && appState.templateData.structure) {
            Object.keys(appState.templateData.structure).forEach(actKey => {
                if (!appState.templateData.structure[actKey].hasOwnProperty('userDirections')) {
                    appState.templateData.structure[actKey].userDirections = '';
                }
            });
        }
        
        // 🔍 DEBUG: Log restored template data
        console.log('🔍 DEBUG: Template data restoration:', {
            selectedTemplate: appState.selectedTemplate,
            hasTemplateData: !!appState.templateData,
            templateDataSource: projectData.templateData ? 'projectData.templateData' : (projectData.template ? 'projectData.template (legacy)' : 'none'),
            templateData: appState.templateData ? {
                id: appState.templateData.id,
                name: appState.templateData.name,
                hasStructure: !!appState.templateData.structure,
                structureKeys: appState.templateData.structure ? Object.keys(appState.templateData.structure) : [],
                hasOriginalOrder: !!appState.templateData.originalOrder,
                hasUserDirections: appState.templateData.structure ? Object.keys(appState.templateData.structure).some(key => 
                    appState.templateData.structure[key].hasOwnProperty('userDirections')) : false
            } : null
        });
        
        appState.generatedStructure = projectData.generatedStructure || projectData.structure || {};
        appState.plotPoints = projectData.plotPoints || {};
        appState.generatedScenes = normalizeGeneratedScenes(projectData.generatedScenes || projectData.scenes || {});
        appState.generatedDialogues = normalizeGeneratedDialogues(projectData.generatedDialogues || projectData.dialogue || {});
        appState.projectId = projectData.projectId || projectData.id;
        appState.projectPath = projectData.projectPath;
        appState.creativeDirections = projectData.creativeDirections || {}; // 🆕 Load creative directions
        appState.globalCreativeDirections = projectData.globalCreativeDirections || {
            plotPoints: "",
            scenes: "",
            dialogue: ""
        }; // 🆕 Load global creative directions
        
        // 🔧 FIX: Load plot points from database if not already present
        if (appState.projectPath && (!appState.plotPoints || Object.keys(appState.plotPoints).length === 0)) {
            try {
                console.log('🔄 Loading plot points from database...');
                await loadExistingPlotPoints();
                console.log('✅ Plot points loaded:', Object.keys(appState.plotPoints || {}).length, 'acts');
            } catch (error) {
                console.log('⚠️ Could not load plot points:', error.message);
            }
        }
        
        // Update UI
        updateStoryConceptDisplay();
        updateCharacterTags();
        validateCharactersRequired();
        updateInfluenceTags('director');
        updateInfluenceTags('screenwriter');
        updateInfluenceTags('film');
        updateInfluenceTags('tone');
        
        console.log('✅ Project loaded (unified v2.0):', {
            storyConcept: !!appState.currentStoryConcept,
            characters: appState.projectCharacters.length,
            template: appState.selectedTemplate,
            structure: Object.keys(appState.generatedStructure).length,
            plotPoints: Object.keys(appState.plotPoints).length,
            scenes: Object.keys(appState.generatedScenes).length,
            dialogues: Object.keys(appState.generatedDialogues).length
        });
        
        // Determine which step to show based on available data (using appState now that it's populated)
        let targetStep = 1;
        let maxAvailableStep = 1;
        
        if (appState.generatedStructure && Object.keys(appState.generatedStructure).length > 0) {
            maxAvailableStep = 3; // Structure available
            console.log('Structure available for step 3');
            
            if (appState.plotPoints && Object.keys(appState.plotPoints).length > 0) {
                maxAvailableStep = 4; // Plot points available
                console.log('Plot points available for step 4');
            }
            
            if (appState.generatedScenes && Object.keys(appState.generatedScenes).length > 0) {
                maxAvailableStep = 5; // Scenes available
                console.log('Scenes available for step 5');
                
                if (appState.generatedDialogues && Object.keys(appState.generatedDialogues).length > 0) {
                    maxAvailableStep = 6; // Dialogue available
                    console.log('Dialogues available for step 6');
                }
            }
        }
        
        // Determine target step based on saved project data or restore operation
        console.log(`🔍 STEP DEBUG: projectData.currentStep = ${projectData.currentStep}, maxAvailableStep = ${maxAvailableStep}, isRestore = ${isRestore}`);
        if (projectData.currentStep) {
            // If project has a saved step, trust it and use it
            // This allows users to return to their last working step even if prerequisites aren't complete
            targetStep = projectData.currentStep;
            console.log(`✅ Using saved project step ${targetStep} (max available: ${maxAvailableStep})`);
        } else if (isRestore && appState.currentStep) {
            // If restoring and current step is available, stay on current step
            targetStep = appState.currentStep;
            console.log(`✅ Restore: staying on current step ${targetStep}`);
        } else {
            // If no saved step, go to highest available step based on content
            targetStep = maxAvailableStep;
            console.log(`❌ No saved step: going to highest available step ${targetStep}`);
            console.log(`   - projectData.currentStep: ${projectData.currentStep}`);
            console.log(`   - isRestore: ${isRestore}`);
            console.log(`   - appState.currentStep: ${appState.currentStep}`);
        }
        
        // Make sure templates are loaded first
        if (targetStep >= 2) {
            try {
                console.log('Loading templates...');
                await loadTemplates();
                console.log('Templates loaded successfully');
                
                // Restore template selection (unified v2.0 format only)
                if (projectData.selectedTemplate) {
                    console.log('Restoring template:', projectData.selectedTemplate);
                    appState.selectedTemplate = projectData.selectedTemplate;
                    appState.templateData = projectData.templateData;
                    
                    // Update the UI - wait for templates to be loaded
                    setTimeout(() => {
                        const templateElements = document.querySelectorAll('.template-option');
                        templateElements.forEach(element => {
                            const templateIdAttr = element.getAttribute('data-template-id');
                            if (templateIdAttr === projectData.selectedTemplate) {
                                element.classList.add('selected');
                                console.log('✅ Template UI restored:', projectData.selectedTemplate);
                                
                                // Find and display the selected template
                                let selectedTemplateData = null;
                                if (appState.availableTemplates) {
                                    Object.values(appState.availableTemplates).forEach(category => {
                                        if (category.templates) {
                                            const found = category.templates.find(template => template.id === projectData.selectedTemplate);
                                            if (found) {
                                                selectedTemplateData = found;
                                            }
                                        }
                                    });
                                }
                                
                                if (selectedTemplateData) {
                                    // 🔧 Use customized template data from database if available
                                    const templateDataToDisplay = projectData.templateData || selectedTemplateData;
                                    console.log('🔍 DEBUG: Template restoration:');
                                    console.log('  - selectedTemplateData:', selectedTemplateData.name);
                                    console.log('  - projectData.templateData exists:', !!projectData.templateData);
                                    console.log('  - Using templateDataToDisplay:', templateDataToDisplay.name);
                                    console.log('  - templateDataToDisplay has customizations:', templateDataToDisplay !== selectedTemplateData);
                                    
                                    // 🔧 CRITICAL FIX: Don't call displaySelectedTemplate if we already have customized template data
                                    // This prevents overwriting the restored customizations
                                    if (projectData.templateData && projectData.templateData.structure) {
                                        console.log('🔧 SKIPPING displaySelectedTemplate - using existing customized data');
                                        // Just update the UI elements without calling loadTemplateStructureForActCards
                                        const display = document.getElementById('selectedTemplateDisplay');
                                        const name = document.getElementById('selectedTemplateName');
                                        const description = document.getElementById('selectedTemplateDescription');
                                        const category = document.getElementById('selectedTemplateCategory');
                                        
                                        if (display && name && description && category) {
                                            name.textContent = templateDataToDisplay.name;
                                            description.textContent = templateDataToDisplay.description;
                                            category.textContent = templateDataToDisplay.category ? templateDataToDisplay.category.replace('_', ' ').toUpperCase() : '';
                                            display.style.display = 'block';
                                        }
                                        
                                        // Load act cards with the CUSTOMIZED data
                                        loadTemplateStructureForActCards(templateDataToDisplay);
                                    } else {
                                        console.log('🔧 CALLING displaySelectedTemplate - no customizations found');
                                        displaySelectedTemplate(templateDataToDisplay);
                                    }
                                    collapseTemplateOptions();
                                    updateTemplatePageForSelection();
                                }
                            }
                        });
                    }, 500); // Give templates time to load
                }
            } catch (error) {
                console.error('Error loading templates:', error);
                // Continue anyway, just log the error
            }
        }
        
        // Navigate to appropriate step (only if not a restore operation)
        if (!isRestore) {
            console.log('Navigating to step:', targetStep);
            console.log('Navigation prerequisites check:');
            console.log('  - appState.storyInput:', !!appState.storyInput);
            console.log('  - appState.selectedTemplate:', appState.selectedTemplate);
            console.log('  - appState.generatedStructure exists:', !!appState.generatedStructure);
            console.log('  - appState.plotPoints keys:', Object.keys(appState.plotPoints || {}));
            console.log('  - appState.generatedScenes exists:', !!appState.generatedScenes);
            
            goToStep(targetStep);
            console.log('Navigation completed');
        } else {
            console.log('Skipping navigation during restore - will be handled by initializeApp');
        }
        
        // Always display content if it exists (regardless of restore status)
        // This ensures content is visible on page reload
        console.log('Checking content to display...');
        
        // If we have a structure, display it
        if (appState.generatedStructure && Object.keys(appState.generatedStructure).length > 0) {
            console.log('Displaying structure:', appState.generatedStructure);
            displayStructure(appState.generatedStructure);
            updateActsGenerationButton(); // Update button to show "Regenerate Acts"
            console.log('Structure display completed');
        }
        
        // If we have plot points, they will be displayed when displayPlotPointsGeneration is called in goToStepInternal
        // No need to explicitly display them here as they're handled by the step navigation
        
        // If we have scenes, display them
        if (appState.generatedScenes && Object.keys(appState.generatedScenes).length > 0) {
            console.log('Displaying scenes:', appState.generatedScenes);
            displayScenes(appState.generatedScenes);
            console.log('Scenes display completed');
        }
        
        // If we have dialogue, ensure the dialogue generation interface is set up
        if (appState.generatedDialogues && Object.keys(appState.generatedDialogues).length > 0) {
            console.log('Setting up dialogue restoration');
            console.log('Available dialogue keys:', Object.keys(appState.generatedDialogues));
            
            // Store dialogue restoration for later (will be handled by displayDialogueGeneration when step 6 is reached)
            appState.pendingDialogueRestore = appState.generatedDialogues;
            console.log('Dialogue restoration queued for step 6');
        }
        
        // Mark this as a loaded project so it can be restored on page reload
        appState.isLoadedProject = true;
        
        console.log('Saving to localStorage...');
        saveToLocalStorage();
        console.log('=== END populateFormWithProject ===');
        
        // Show project header with loaded project data
        showProjectHeader({
            title: projectData.storyInput.title,
            templateName: projectData.template ? projectData.template.name : 'Unknown',
            totalScenes: projectData.storyInput.totalScenes,
            projectId: projectData.projectId
        });
        
        // Show success message if requested
        if (showToastMessage) {
            showToast(`Project "${projectData.storyInput.title}" loaded successfully!`, 'success');
        }
        
        // Update autogenerate button visibility (should hide for loaded projects)
        updateAutoGenerateButtonVisibility();
        
        // Update all generation buttons to show Generate/Regenerate appropriately
        updateAllGenerationButtons();
        
        // Update global creative direction indicators
        updateGlobalDirectionIndicators();
    }

    // Clear all content containers when starting fresh
    clearAllContentContainers() {
        // Clear structure content
        const structureContainer = document.getElementById('structureContent');
        if (structureContainer) {
            structureContainer.innerHTML = '';
        }
        
        // Clear template structure preview
        const previewContainer = document.getElementById('templateStructurePreview');
        if (previewContainer) {
            previewContainer.remove();
        }
        
        // Clear plot points content
        const plotPointsContainer = document.getElementById('plotPointsContent');
        if (plotPointsContainer) {
            plotPointsContainer.innerHTML = '';
        }
        
        // Clear scenes content
        const scenesContainer = document.getElementById('scenesContent');
        if (scenesContainer) {
            scenesContainer.innerHTML = '';
        }
        
        // Clear dialogue content
        const dialogueContainer = document.getElementById('dialogueContent');
        if (dialogueContainer) {
            dialogueContainer.innerHTML = '';
        }
        
        // Hide action buttons
        const regenerateBtn = document.getElementById('regenerateBtn');
        const approveBtn = document.getElementById('approveBtn');
        if (regenerateBtn) regenerateBtn.style.display = 'none';
        if (approveBtn) approveBtn.style.display = 'none';
        
        console.log('✅ All content containers cleared');
    }

    // Helper function to start a fresh project
    startFreshProject() {
        console.log('🆕 Starting completely fresh project...');
        
        // Set flag to prevent automatic project restoration
        window.startingFreshProject = true;
        
        // Clear all app state completely
        Object.assign(appState, {
            currentStep: 1,
            storyInput: {},
            selectedTemplate: null,
            templateData: null,
            generatedStructure: {},
            generatedScenes: {},
            generatedDialogues: {},
            projectId: null,
            projectPath: null,
            isLoadedProject: false,  // Explicitly set to false
            projectCharacters: [],   // Clear characters
            influences: {
                directors: [],
                screenwriters: [],
                films: [],
                tones: []            // Clear tones too
            },
            currentStoryConcept: null,
            customPrompt: null,
            originalPrompt: null,
            isEditMode: false,
            plotPoints: {},
            creativeDirections: {},
            globalCreativeDirections: {
                plotPoints: "",
                scenes: "",
                dialogue: ""
            },
            pendingDialogueRestore: null,
            lastSaveTime: null,
            saveInProgress: false,
            pendingChanges: false
        });
        
        // Clear all content containers
        this.clearAllContentContainers();
        
        // Reset UI elements
        const storyTitle = document.getElementById('storyTitle');
        const storyLogline = document.getElementById('storyLogline');
        const totalScenes = document.getElementById('totalScenes');
        const tone = document.getElementById('tone');
        
        if (storyTitle) storyTitle.value = '';
        if (storyLogline) storyLogline.value = '';
        if (totalScenes) totalScenes.value = '70';
        if (tone) tone.value = '';
        
        // Clear influence tags
        updateInfluenceTags('director');
        updateInfluenceTags('screenwriter');
        updateInfluenceTags('film');
        updateInfluenceTags('tone');
        
        // Clear character tags
        updateCharacterTags();
        
        // Clear story concept display
        updateStoryConceptDisplay();
        
        // Hide project header
        hideProjectHeader();
        
        // Reset template selection
        const templateElements = document.querySelectorAll('.template-option');
        templateElements.forEach(element => {
            element.classList.remove('selected');
        });
        
        const selectedTemplateDisplay = document.getElementById('selectedTemplateDisplay');
        if (selectedTemplateDisplay) {
            selectedTemplateDisplay.style.display = 'none';
        }
        
        // Go to step 1
        goToStep(1);
        
        // Update navigation and buttons
        updateAutoGenerateButtonVisibility();
        updateAllGenerationButtons();
        updateGlobalDirectionIndicators();
        
        // Save cleared state
        saveToLocalStorage();
        
        console.log('✅ Fresh project started successfully');
        showToast('New project started! Begin by entering your story concept.', 'success');
    }
}

// Create global instance
const projectManager = new ProjectManager();
window.projectManagerInstance = projectManager;

// Legacy wrapper functions for backward compatibility
async function saveProject() {
    return await projectManager.saveProject();
}

async function newProject() {
    return await projectManager.newProject();
}

async function loadProject(projectPath) {
    // Safety check - ensure component is loaded
    if (!window.projectManagerInstance) {
        console.error('Project Manager not loaded yet');
        alert('System still loading. Please wait a moment and try again.');
        return;
    }
    return await window.projectManagerInstance.loadProject(projectPath);
}

async function deleteProject(projectPath, projectTitle) {
    // Safety check - ensure component is loaded
    if (!window.projectManagerInstance) {
        console.error('Project Manager not loaded yet');
        alert('System still loading. Please wait a moment and try again.');
        return;
    }
    return await window.projectManagerInstance.deleteProject(projectPath, projectTitle);
}

async function duplicateProject(projectPath, projectTitle) {
    // Safety check - ensure component is loaded
    if (!window.projectManagerInstance) {
        console.error('Project Manager not loaded yet');
        alert('System still loading. Please wait a moment and try again.');
        return;
    }
    return await window.projectManagerInstance.duplicateProject(projectPath, projectTitle);
}

async function showLoadProjectModal() {
    // Safety check - ensure component is loaded
    if (!window.projectManagerInstance) {
        console.error('Project Manager not loaded yet');
        alert('System still loading. Please wait a moment and try again.');
        return;
    }
    return await window.projectManagerInstance.showLoadProjectModal();
}

function hideLoadProjectModal() {
    return projectManager.hideLoadProjectModal();
}

function generateProjectCard(project, context = 'modal') {
    return projectManager.generateProjectCard(project, context);
}

function calculateProjectCardProgress(project) {
    return projectManager.calculateProjectCardProgress(project);
}

async function populateFormWithProject(projectData, showToastMessage = true, isRestore = false) {
    return await projectManager.populateFormWithProject(projectData, showToastMessage, isRestore);
}

function clearAllContentContainers() {
    return projectManager.clearAllContentContainers();
}

function startFreshProject() {
    return projectManager.startFreshProject();
}

console.log('✅ Project Manager Component loaded successfully'); 