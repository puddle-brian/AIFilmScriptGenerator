// App Initialization Manager - Handles app startup, dropdowns, and event listeners
class AppInitializationManager {
    constructor() {
        this.initialized = false;
        this.dropdownsPopulated = false;
        this.eventListenersSetup = false;
    }

    // Initialize application
    async initializeApp() {
        // Initialize authentication first
        authManager.init();
        
        // Initialize auto-save manager
        autoSaveManager.init();
        
        updateProgressBar();
        updateStepIndicators();
        
        // Navigation will be updated after localStorage restoration via updateAllProgressMeters()
        
        // 🔧 PERFORMANCE FIX: Skip dropdown population - load lazily when Step 1 is accessed
        // await this.populateDropdowns(); // Moved to lazy loading
        
        // Load from localStorage if available (unless starting fresh)
        const savedState = localStorage.getItem('filmScriptGenerator');
        if (savedState && !window.startingFreshProject) {
            try {
                const parsed = JSON.parse(savedState);
                console.log('Parsed saved state:', {
                    currentStep: parsed.currentStep,
                    projectPath: parsed.projectPath,
                    isLoadedProject: parsed.isLoadedProject,
                    hasDialogues: parsed.generatedDialogues ? Object.keys(parsed.generatedDialogues).length : 0
                });
                
                Object.assign(appState, parsed);
                
                // Successfully loaded from localStorage
                
                // Initialize plot points state tracking if not present
                if (!appState.manuallySetPlotPoints) appState.manuallySetPlotPoints = {};
                if (!appState.currentActPlotPoints) appState.currentActPlotPoints = {};
                
                // Update character, influence, and story concept displays after restoring state
                updateCharacterTags();
                updateInfluenceTags('director');
                updateInfluenceTags('screenwriter');
                updateInfluenceTags('film');
                updateInfluenceTags('tone');
                updateStoryConceptDisplay();
                updateAutoGenerateButtonVisibility();
                
                // Restore template selection UI if a template was selected
                if (appState.selectedTemplate && appState.availableTemplates) {
                    setTimeout(() => {
                        const templateElements = document.querySelectorAll('.template-option');
                        templateElements.forEach(element => {
                            const templateIdAttr = element.getAttribute('data-template-id');
                            if (templateIdAttr === appState.selectedTemplate) {
                                element.classList.add('selected');
                                
                                // Find and display the selected template
                                let selectedTemplateData = null;
                                Object.values(appState.availableTemplates).forEach(category => {
                                    if (category.templates) {
                                        const found = category.templates.find(template => template.id === appState.selectedTemplate);
                                        if (found) {
                                            selectedTemplateData = found;
                                        }
                                    }
                                });
                                
                                if (selectedTemplateData) {
                                    displaySelectedTemplate(selectedTemplateData);
                                    collapseTemplateOptions();
                                    updateTemplatePageForSelection();
                                }
                            }
                        });
                    }, 1000); // Give templates time to load
                }
                
                // Update progress meters after restoring state
                if (typeof updateAllProgressMeters === 'function') {
                    updateAllProgressMeters();
                }
                
                // If we have a loaded project path, restore the full project
                if (appState.projectPath && appState.isLoadedProject) {
                    console.log('Restoring loaded project from localStorage:', appState.projectPath);
                    try {
                        await this.restoreLoadedProject();
                        console.log('Project restored. Dialogue count:', Object.keys(appState.generatedDialogues || {}).length);
                        
                        // After restoring project data, navigate to the saved step
                        // Note: populateFormWithProject skips navigation during restore, so we handle it here
                        if (appState.currentStep > 1) {
                            console.log(`Force navigating to step ${appState.currentStep} (loaded project)`);
                            console.log('Final dialogue count before navigation:', Object.keys(appState.generatedDialogues || {}).length);
                            
                            // Small delay to ensure all async operations are complete
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            // Force navigation without validation for loaded projects
                            // since we trust the saved state from a real project
                            await forceGoToStep(appState.currentStep);
                        }
                    } catch (error) {
                        console.error('Error restoring loaded project:', error);
                        // Clear the invalid project state
                        appState.projectPath = null;
                        appState.isLoadedProject = false;
                        saveToLocalStorage();
                    }
                } else if (appState.currentStep > 1) {
                    console.log('Checking navigation for non-loaded project...');
                    console.log('Current step:', appState.currentStep);
                    console.log('Can navigate to step 7?', canNavigateToStep(7));
                    console.log('Dialogue count:', Object.keys(appState.generatedDialogues || {}).length);
                    
                    // For non-loaded projects, use normal validation
                    if (canNavigateToStep(appState.currentStep)) {
                        console.log(`Navigating to step ${appState.currentStep} (validation passed)`);
                        await goToStep(appState.currentStep);
                    } else {
                        // If we can't navigate to the saved step, find the highest valid step
                        let validStep = 1;
                        for (let step = 7; step >= 1; step--) {
                            if (canNavigateToStep(step)) {
                                validStep = step;
                                break;
                            }
                        }
                        console.log(`Saved step ${appState.currentStep} not valid, navigating to step ${validStep}`);
                        await goToStep(validStep);
                    }
                }
            } catch (e) {
                console.error('Error loading saved state:', e);
            }
        } else {
            // Initialize plot points state tracking for new sessions
            appState.manuallySetPlotPoints = {};
            appState.currentActPlotPoints = {};
        }
        
        // Final step indicator update after everything is initialized (includes progress meters)
        if (typeof updateStepIndicators === 'function') {
            updateStepIndicators();
        }
        
        // Force refresh credit widget after everything is loaded
        if (appState.isAuthenticated && appState.apiKey && window.creditWidget) {
            console.log('🔄 Force refreshing credit widget after app initialization');
            setTimeout(() => {
                window.unifiedCredits.fetchBalance().then(() => {
                    // Display is automatically updated by the unified system
                });
            }, 500);
        }
        
        // Update button visibility after initialization
        updateAutoGenerateButtonVisibility();
        
        // 🔧 FIX: Restore project header if there's an active project
        // This ensures the project title is shown when returning from profile/library pages
        if (appState.storyInput && appState.storyInput.title) {
            console.log('🎯 Restoring project header for active project:', appState.storyInput.title);
            if (typeof showProjectHeader === 'function') {
                showProjectHeader({
                    title: appState.storyInput.title,
                    logline: appState.storyInput.logline || ''
                });
            }
        } else if (appState.currentStoryConcept && appState.currentStoryConcept.title) {
            console.log('🎯 Restoring project header for current story concept:', appState.currentStoryConcept.title);
            if (typeof showProjectHeader === 'function') {
                showProjectHeader({
                    title: appState.currentStoryConcept.title,
                    logline: appState.currentStoryConcept.logline || ''
                });
            }
        }
        
        this.initialized = true;
    }

    // Populate dropdowns from user libraries ONLY (no more hardcoded JSON)
    async populateDropdowns() {
        console.log('PopulateDropdowns: Starting (user libraries only)...');
        
        try {
            // Load user's libraries (which now include starter pack content for new users)
            console.log('PopulateDropdowns: Loading user libraries...');
            const userLibraries = await this.loadUserLibraries();
            
            console.log('PopulateDropdowns: User libraries loaded:', {
                directors: userLibraries.directors?.length || 0,
                screenwriters: userLibraries.screenwriters?.length || 0,
                films: userLibraries.films?.length || 0,
                tones: userLibraries.tones?.length || 0
            });
            
            // Populate directors dropdown (user library only)
            console.log('PopulateDropdowns: Populating directors dropdown...');
            const directorSelect = document.getElementById('directorSelect');
            if (!directorSelect) {
                console.error('PopulateDropdowns: directorSelect element not found!');
            } else {
                console.log(`PopulateDropdowns: Adding ${userLibraries.directors?.length || 0} directors`);
                (userLibraries.directors || []).forEach(director => {
                    const option = document.createElement('option');
                    option.value = director;
                    option.textContent = director;
                    directorSelect.appendChild(option);
                });
            }
            
            // Populate screenwriters dropdown (user library only)
            console.log('PopulateDropdowns: Populating screenwriters dropdown...');
            const screenwriterSelect = document.getElementById('screenwriterSelect');
            if (!screenwriterSelect) {
                console.error('PopulateDropdowns: screenwriterSelect element not found!');
            } else {
                console.log(`PopulateDropdowns: Adding ${userLibraries.screenwriters?.length || 0} screenwriters`);
                (userLibraries.screenwriters || []).forEach(screenwriter => {
                    const option = document.createElement('option');
                    option.value = screenwriter;
                    option.textContent = screenwriter;
                    screenwriterSelect.appendChild(option);
                });
            }
            
            // Populate films dropdown (user library only)
            console.log('PopulateDropdowns: Populating films dropdown...');
            const filmSelect = document.getElementById('filmSelect');
            if (!filmSelect) {
                console.error('PopulateDropdowns: filmSelect element not found!');
            } else {
                console.log(`PopulateDropdowns: Adding ${userLibraries.films?.length || 0} films`);
                (userLibraries.films || []).forEach(film => {
                    const option = document.createElement('option');
                    option.value = film;
                    option.textContent = film;
                    filmSelect.appendChild(option);
                });
            }
            
            // Populate tones dropdown (user library only)
            console.log('PopulateDropdowns: Populating tones dropdown...');
            const toneSelect = document.getElementById('toneSelect');
            if (!toneSelect) {
                console.error('PopulateDropdowns: toneSelect element not found!');
            } else {
                console.log(`PopulateDropdowns: Adding ${userLibraries.tones?.length || 0} tones`);
                (userLibraries.tones || []).forEach(tone => {
                    const option = document.createElement('option');
                    option.value = tone;
                    option.textContent = tone;
                    toneSelect.appendChild(option);
                });
            }
            
            // Populate characters dropdown (user library only)
            console.log('PopulateDropdowns: Populating characters dropdown...');
            const characterSelect = document.getElementById('characterSelect');
            if (!characterSelect) {
                console.error('PopulateDropdowns: characterSelect element not found!');
            } else {
                const allCharacters = userLibraries.characters || [];
                console.log(`PopulateDropdowns: Adding ${allCharacters.length} characters`);
                allCharacters.forEach(character => {
                    const option = document.createElement('option');
                    // Store full character data as JSON
                    option.value = JSON.stringify(character);
                    option.textContent = character.name;
                    characterSelect.appendChild(option);
                });
            }
            
            // Populate story concepts dropdown (user library only)
            console.log('PopulateDropdowns: Populating story concepts dropdown...');
            const storyConceptSelect = document.getElementById('storyConceptSelect');
            if (!storyConceptSelect) {
                console.error('PopulateDropdowns: storyConceptSelect element not found!');
            } else {
                const allStoryConcepts = userLibraries.storyconcepts || [];
                console.log(`PopulateDropdowns: Adding ${allStoryConcepts.length} story concepts`);
                allStoryConcepts.forEach(concept => {
                    const option = document.createElement('option');
                    option.value = concept.name;
                    option.textContent = concept.name;
                    storyConceptSelect.appendChild(option);
                });
            }
            
            console.log('PopulateDropdowns: Successfully completed!');
            this.dropdownsPopulated = true;
        } catch (error) {
            console.error('PopulateDropdowns: Error occurred:', error);
            showToast('Error loading dropdown options. Please refresh the page.', 'error');
        }
    }

    // Load user's custom libraries for dropdowns
    async loadUserLibraries() {
        return libraryManager.loadUserLibraries();
    }

    // Restore a loaded project from localStorage on page reload
    async restoreLoadedProject() {
        if (!appState.projectPath) {
            throw new Error('No project path to restore');
        }
        
        console.log('Restoring project:', appState.projectPath);
        const username = appState.user?.username || 'guest';
        const response = await fetch(`/api/load-project/${encodeURIComponent(appState.projectPath)}?username=${encodeURIComponent(username)}`);
        
        if (!response.ok) {
            throw new Error(`Failed to restore project: ${response.status} ${response.statusText}`);
        }
        
        const projectData = await response.json();
        console.log('✅ Database project data restored:', {
            structure: Object.keys(projectData.generatedStructure || {}).length,
            plotPoints: Object.keys(projectData.plotPoints || {}).length,
            scenes: Object.keys(projectData.generatedScenes || {}).length,
            dialogues: Object.keys(projectData.generatedDialogues || {}).length
        });
        
        // DATABASE TAKES PRIORITY - Clear conflicting localStorage data before restoration
        console.log('🔄 Clearing stale localStorage data before database restoration');
        
        // Populate the form with the restored project data
        await populateFormWithProject(projectData, false, true); // Don't show toast on restore, isRestore = true
    }

    // Setup event listeners
    setupEventListeners() {
        // Story form submission
        document.getElementById('storyForm').addEventListener('submit', function(e) {
            e.preventDefault();
            appInitializationManager.handleStorySubmission();
        });
        
        // Auto-save on form changes
        const formInputs = document.querySelectorAll('#storyForm input, #storyForm select, #storyForm textarea');
        formInputs.forEach(input => {
            input.addEventListener('change', saveToLocalStorage);
        });
        
        // Total scenes field update (on Step 5)
        document.addEventListener('change', function(e) {
            if (e.target.id === 'totalScenes') {
                const newValue = parseInt(e.target.value) || 70;
                if (appState.storyInput) {
                    appState.storyInput.totalScenes = newValue;
                    saveToLocalStorage();
                    console.log('Updated totalScenes to:', newValue);
                }
            }
        });
        
        this.eventListenersSetup = true;
    }

    // Setup library change listener for ADD NEW modal integration
    setupLibraryChangeListener() {
        // Listen for library changes from +ADD NEW modals
        window.addEventListener('libraryChange', function(event) {
            const { type, entryData } = event.detail;
            
            console.log('📚 Library change event received:', { type, entryData });
            
            // Map library manager singular types to appState plural types
            const typeMap = {
                'director': 'directors',
                'screenwriter': 'screenwriters', 
                'film': 'films',
                'tone': 'tones',
                'character': 'characters',
                'storyconcept': 'storyconcepts'
            };
            
            const pluralType = typeMap[type];
            if (!pluralType) {
                console.warn('Unknown library type:', type);
                return;
            }
            
            // 🔧 FIXED: Handle characters separately from influences
            if (type === 'character') {
                console.log(`✅ ${type} "${entryData.name}" will be added to main project characters`);
                
                // Initialize projectCharacters if not present
                if (!appState.projectCharacters) {
                    appState.projectCharacters = [];
                }
                
                // Add to main project characters if not already present
                const existingCharacter = appState.projectCharacters.find(char => char.name === entryData.name);
                if (!existingCharacter) {
                    const character = {
                        name: entryData.name,
                        description: entryData.description || `Main character: ${entryData.name}`,
                        fromLibrary: true
                    };
                    appState.projectCharacters.push(character);
                    console.log(`✅ Added character "${entryData.name}" to main project characters`);
                    
                    // Update character display
                    if (typeof updateCharacterTags === 'function') {
                        updateCharacterTags();
                    }
                    if (typeof validateCharactersRequired === 'function') {
                        validateCharactersRequired();
                    }
                    
                    // Update storyInput characters
                    if (appState.storyInput && typeof getCharactersForPrompt === 'function') {
                        appState.storyInput.characters = getCharactersForPrompt();
                    }
                    
                    // Save immediately to database
                    if (window.appStateManager && typeof appStateManager.saveImmediately === 'function') {
                        appStateManager.saveImmediately();
                    } else if (window.autoSaveManager && typeof autoSaveManager.saveImmediately === 'function') {
                        autoSaveManager.saveImmediately();
                    } else {
                        // Fallback to marking dirty for delayed save
                        appState.pendingChanges = true;
                        saveToLocalStorage();
                    }
                    
                    // Show success message
                    if (window.showToast) {
                        window.showToast(`"${entryData.name}" added to main characters and saved!`, 'success');
                    }
                } else {
                    console.log(`Character "${entryData.name}" already in main project characters`);
                }
            }
            // Add to influences for types that use blue tags (directors, screenwriters, films, tones)
            else if (['directors', 'screenwriters', 'films', 'tones'].includes(pluralType)) {
                console.log(`✅ ${type} "${entryData.name}" will be added to project influences (blue tags)`);
                
                // Initialize influences if not present
                if (!appState.influences) {
                    appState.influences = { directors: [], screenwriters: [], films: [], tones: [] };
                }
                
                if (!appState.influences[pluralType]) {
                    appState.influences[pluralType] = [];
                }
                
                // Add to current project influences if not already present
                if (!appState.influences[pluralType].includes(entryData.name)) {
                    appState.influences[pluralType].push(entryData.name);
                    console.log(`✅ Added ${type} "${entryData.name}" to current project influences`);
                    
                    // Update the UI to show the blue tag
                    updateInfluenceTags(type);
                    
                    // Update storyInput influences
                    if (appState.storyInput) {
                        appState.storyInput.influences = appState.influences;
                    }
                    
                    // Auto-save the changes
                    saveToLocalStorage();
                    
                    // Show success message
                    if (window.showToast) {
                        window.showToast(`"${entryData.name}" added to project influences and saved to library!`, 'success');
                    }
                } else {
                    console.log(`${type} "${entryData.name}" already in project influences`);
                }
            } else {
                console.log(`ℹ️ ${type} "${entryData.name}" saved to library but NOT added to project influences`);
                
                // Handle story concepts - set as current story concept
                if (type === 'storyconcept') {
                    console.log('✅ Setting as current story concept in Step 1');
                    
                    // Set the current story concept
                    appState.currentStoryConcept = {
                        title: entryData.name,
                        logline: entryData.description || `Story concept: ${entryData.name}`
                    };
                    
                    // Update the story concept display
                    if (typeof updateStoryConceptDisplay === 'function') {
                        updateStoryConceptDisplay();
                    }
                    
                    // Update storyInput if it exists
                    if (appState.storyInput) {
                        appState.storyInput.storyConcept = appState.currentStoryConcept;
                    }
                    
                    // Auto-save the changes
                    saveToLocalStorage();
                    
                    // Show success message
                    if (window.showToast) {
                        window.showToast(`"${entryData.name}" set as current story concept and saved to library!`, 'success');
                    }
                }
            }
        });
        
        console.log('✅ Library change listener set up');
    }

    // Handle story form submission
    handleStorySubmission() {
        const form = document.getElementById('storyForm');
        const formData = new FormData(form);
        
        // Get title and logline from story concept
        if (!appState.currentStoryConcept) {
            showToast('Please create a story concept first', 'error');
            return;
        }
        
        appState.storyInput = {
            title: appState.currentStoryConcept.title,
            logline: appState.currentStoryConcept.logline,
            characters: getCharactersForPrompt(), // Use new character system
            tone: appState.influences.tones && appState.influences.tones.length > 0 
                ? appState.influences.tones.join(' and ') 
                : (formData.get('tone') || 'Dramatic'), // Multi-tone support with fallback to single tone
            totalScenes: 70, // Default value, will be configurable in scenes step
            influences: appState.influences, // Synchronized with current appState.influences
            influencePrompt: buildInfluencePrompt(),
            storyConcept: appState.currentStoryConcept // Store the full story concept
        };
        
        // Generate project path immediately if not exists (same logic as autogenerate)
        if (!appState.projectPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const titleSlug = appState.currentStoryConcept.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
            appState.projectPath = `${titleSlug}_${timestamp}`;
            appState.projectId = null; // Will be set when saved to database
            console.log('📁 Created project path for manual story submission:', appState.projectPath);
            
            // Show project header immediately
            showProjectHeader({
                title: appState.currentStoryConcept.title,
                logline: appState.currentStoryConcept.logline || ''
            });
        }
        
        // Mark for auto-save (project gets created here)
        if (window.autoSaveManager) {
            autoSaveManager.markDirty();
            console.log('📁 Project creation triggered via auto-save manager');
        } else {
            console.warn('⚠️ Auto-save manager not available, project may not be created');
        }
        
        saveToLocalStorage();
        
        // Update progress meters and step indicators after story creation
        updateAllProgressMeters();
        
        // Force update character tags after story creation
        updateCharacterTags();
        
        // Go to template selection
        goToStep(2);
    }

    // Initialize all systems
    async init() {
        console.log('🚀 Initializing App Initialization Manager...');
        
        // Setup event listeners first
        this.setupEventListeners();
        
        // Setup library change listener
        this.setupLibraryChangeListener();
        
        // Initialize the app
        await this.initializeApp();
        
        console.log('✅ App Initialization Manager initialized successfully');
    }
}

// Create global instance
const appInitializationManager = new AppInitializationManager(); 