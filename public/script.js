// Global state management
const appState = {
    currentStep: 1,
    storyInput: {},
    selectedTemplate: null,
    templateData: null,
    generatedStructure: null,
    generatedScenes: null,
    generatedDialogues: {},
    projectId: null,
    projectPath: null, // Add this line
    availableTemplates: [],
    influences: {
        directors: [],
        screenwriters: [],
        films: [],
        tones: []
    },
    projectCharacters: [], // Add characters to appState for persistence
    currentStoryConcept: null, // Current story concept (title + logline)
    customPrompt: null,
    originalPrompt: null,
    isEditMode: false,
    plotPoints: {},
    selectedModel: 'claude-sonnet-4-20250514', // Default to latest model
    // Global Creative Directions - NEW FEATURE
    globalCreativeDirections: {
        plotPoints: "",    // Global direction for Step 4
        scenes: "",        // Global direction for Step 5  
        dialogue: ""       // Global direction for Step 6
    },
    // Authentication state
    isAuthenticated: false,
    user: null,
    apiKey: null,
    // Auto-save state
    lastSaveTime: null,
    saveInProgress: false,
    pendingChanges: false,
    autoSaveEnabled: true
};

// Make appState available globally for other components
window.appState = appState;

// ✅ Authentication Management - MOVED TO components/auth-manager.js
// Legacy authManager reference for backward compatibility
const authManager = window.authManagerInstance;

// Model pricing information
const modelPricing = {
    'claude-sonnet-4-20250514': { input: 3, output: 15, description: 'Latest & Best' },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15, description: 'Best Quality' },
    'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25, description: 'Fast & Cheap' },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25, description: 'Cheapest' }
};

// Global character management variables (projectCharacters moved to appState for persistence)
// editingCharacterIndex - MOVED TO components/character-manager.js

// Editable Content Block System - moved to components/editable-content-system.js
// Keeping backward compatibility function
function createEditableContentBlock(options) {
    return window.editableContentSystem ? window.editableContentSystem.createBlock(options) : null;
}

// ✅ Find template ID by name - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function findTemplateIdByName(templateName) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.findTemplateIdByName(templateName);
    }
        return null;
}

// DOM Elements - MOVED TO components/ui-manager.js
// Legacy compatibility maintained through UI Manager component

// ✅ Influence Management Functions - MOVED TO components/library-manager.js
// Legacy wrapper functions are provided by the library manager

// ✅ Universal Library System Configuration - MOVED TO components/library-manager.js
// Legacy access to LIBRARY_TYPES through library manager
const LIBRARY_TYPES = window.libraryManagerInstance ? window.libraryManagerInstance.LIBRARY_TYPES : {};

// ✅ Universal library saving system - MOVED TO components/library-manager.js
// Legacy wrapper functions are provided by the library manager

// ✅ saveToLibraryAndContinue - MOVED TO components/library-manager.js
async function saveToLibraryAndContinue(type, isNewEntry = false) {
    return libraryManager.saveToLibraryAndContinue(type, isNewEntry);
}

function setupUniversalLibraryKeyboardSupport() {
    // Keyboard support is now handled by the modal forms directly
    console.log('Universal Library System: Keyboard support initialized');
}

// ✅ removeInfluence - MOVED TO components/library-manager.js  
function removeInfluence(type, value) {
    return libraryManager.removeInfluence(type, value);
}

// ✅ hideUniversalLibrarySaveModal - MOVED TO components/library-manager.js

// Helper function to properly initialize a new project when story concept is created
function initializeNewProjectFromStoryConcept(title, logline) {
    console.log('🚀 Initializing new project from story concept:', title);
    
    // Set the story input data to trigger project creation
    appState.storyInput = {
        title: title,
        logline: logline || '',
        characters: appState.projectCharacters || [],
        charactersData: appState.projectCharacters || [],
        totalScenes: document.getElementById('totalScenes')?.value || '70',
        tone: document.getElementById('tone')?.value || '',
        influences: appState.influences || { directors: [], screenwriters: [], films: [] },
        influencePrompt: buildInfluencePrompt(),
        customPrompt: null,
        storyConcept: {
            title: title,
            logline: logline || '',
            fromLibrary: false
        }
    };
    
    // Also set the current story concept for immediate display
    appState.currentStoryConcept = {
        title: title,
        logline: logline || '',
        fromLibrary: false
    };
    
    // Generate project path immediately
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
    appState.projectPath = `${titleSlug}_${timestamp}`;
    appState.projectId = null; // Will be set when saved to database
    appState.currentStep = 1; // Set to step 1 since this is a new story concept
    
    // Show project header immediately
    if (typeof showProjectHeader === 'function') {
        showProjectHeader({
            title: title,
            logline: logline || ''
        });
    }
    
    // Mark as having changes to trigger auto-save
    appState.pendingChanges = true;
    
    // Save immediately so the project appears in lists right away
    if (autoSaveManager && typeof autoSaveManager.saveImmediately === 'function') {
        autoSaveManager.saveImmediately();
    }
    
    // Save to localStorage immediately
    saveToLocalStorage();
    
    // Update progress meters and step indicators after story creation
    if (typeof updateAllProgressMeters === 'function') {
        updateAllProgressMeters();
    }
    if (typeof updateStepIndicators === 'function') {
        updateStepIndicators();
    }
    if (typeof updateUniversalNavigation === 'function') {
        updateUniversalNavigation();
    }
    if (typeof updateBreadcrumbNavigation === 'function') {
        updateBreadcrumbNavigation();
    }
    
    console.log('✅ New project initialized:', {
        title: appState.storyInput.title,
        projectPath: appState.projectPath,
        hasProjectData: !!(appState.storyInput && appState.storyInput.title)
    });
    
    // Show success message
    showToast(`New project "${title}" created and ready!`, 'success');
    
    return appState.projectPath;
}

// removeCharacter function - MOVED TO components/character-manager.js

// Custom tone addition is now handled by the universal system via addFromDropdownOrNew('tone')

// Smart unified function - adds from dropdown if selected, otherwise opens modal for new entry
function addFromDropdownOrNew(type) {
    const selectElement = document.getElementById(type === 'tone' ? 'toneSelect' : (type === 'storyconcept' ? 'storyConceptSelect' : `${type}Select`));
    
    // If something is selected in dropdown, add it
    if (selectElement && selectElement.value) {
        const value = selectElement.value;
        
        if (type === 'character') {
            // For characters, add to main story characters (not influences)
            selectElement.value = '';
            
            // Parse character data from JSON (new format) or handle legacy string format
            let characterData;
            try {
                characterData = JSON.parse(value);
                // Handle different possible character data structures
                if (typeof characterData === 'string') {
                    characterData = { name: characterData, description: '' };
                } else if (characterData.entry_data) {
                    characterData = characterData.entry_data;
                } else if (!characterData.name) {
                    characterData = { name: value, description: '' };
                }
            } catch (e) {
                // Legacy string format fallback
                characterData = { name: value, description: '' };
            }
            
            // Check if character already exists in project
            const existingCharacter = appState.projectCharacters.find(char => char.name === characterData.name);
            if (!existingCharacter) {
                // Add character to project with real description from library
                appState.projectCharacters.push({
                    name: characterData.name,
                    description: characterData.description,
                    fromLibrary: true
                });
                updateCharacterTags();
                validateCharactersRequired();
                saveToLocalStorage();
                
                // Mark as dirty to trigger auto-save
                appState.pendingChanges = true;
                if (autoSaveManager) {
                    autoSaveManager.markDirty();
                }
                
                showToast(`Added "${characterData.name}" to your main characters`, 'success');
                
                // Check if this is a custom entry (not in default dropdown)
                checkAndOfferLibrarySave(type, characterData.name);
            } else {
                showToast(`"${characterData.name}" is already in your characters`, 'warning');
            }
        } else if (type === 'storyconcept') {
            // For story concepts, we need to get the full concept data from the library
            selectElement.value = '';
            
            // Load the story concept from user library
            loadUserLibraries().then(userLibraries => {
                const storyConcepts = userLibraries.storyconcepts || [];
                const conceptData = storyConcepts.find(concept => concept.name === value);
                
                if (conceptData) {
                    // Store the concept data in appState
                    appState.currentStoryConcept = {
                        title: conceptData.name,
                        logline: conceptData.description || '',
                        fromLibrary: true
                    };
                    
                    updateStoryConceptDisplay();
                    
                    // Initialize a new project with this existing story concept
                    initializeNewProjectFromStoryConcept(conceptData.name, conceptData.description || '');
                    
                    saveToLocalStorage();
                    showToast(`Story concept "${conceptData.name}" loaded and project initialized!`, 'success');
                } else {
                    showToast(`Could not find story concept data`, 'error');
                }
            });
        } else {
            // For influences, clear selection and add to tags
            selectElement.value = '';
            
            // Ensure influences object and specific array exist
            if (!appState.influences) {
                appState.influences = {};
            }
            
            const pluralType = type + 's';
            if (!appState.influences[pluralType]) {
                appState.influences[pluralType] = [];
            }
            
            if (value && !appState.influences[pluralType].includes(value)) {
                appState.influences[pluralType].push(value);
                updateInfluenceTags(type);
                saveToLocalStorage();
                
                // Mark as dirty to trigger auto-save
                appState.pendingChanges = true;
                if (autoSaveManager) {
                    autoSaveManager.markDirty();
                }
                
                showToast(`Added "${value}" to your influences`, 'success');
                
                // Check if this is a custom entry (not in default dropdown)
                checkAndOfferLibrarySave(type, value);
            }
        }
    } else {
        // Nothing selected, open modal to create new entry
        addNewToLibrary(type);
    }
}

// Universal "Add New" function - directly opens modal for creating new library entries
function addNewToLibrary(type) {
    console.log('Universal Library System: Direct add new', type);
    
    // Re-check authentication status in case it wasn't initialized properly
    authManager.checkAuthStatus();
    
    // 📚 Use centralized LibraryManager with cleaner API
    if (window.libraryManager) {
        try {
            window.libraryManager.showNewEntryModal(type);
        } catch (error) {
            console.warn('LibraryManager showNewEntryModal failed:', error);
            // Fallback to original implementation
            fallbackAddNewToLibrary(type);
        }
    } else {
        // Fallback if LibraryManager not available
        fallbackAddNewToLibrary(type);
    }
}

// Fallback implementation for backward compatibility
function fallbackAddNewToLibrary(type) {
    if (!appState.isAuthenticated) {
        showToast('Please log in to save items to your library', 'error');
        return;
    }
    
    const config = LIBRARY_TYPES[type];
    if (!config) {
        console.warn(`Unknown library type: ${type}`);
        return;
    }
    
    // Show modal directly with empty values
    showUniversalLibrarySaveModal(type, '', config, true);
}

// ✅ updateInfluenceTags - MOVED TO components/library-manager.js
function updateInfluenceTags(type) {
    return libraryManager.updateInfluenceTags(type);
}

// updateCharacterTags function - MOVED TO components/character-manager.js

function updateStoryConceptDisplay() {
    const displayContainer = document.getElementById('storyConceptDisplay');
    const selectorContainer = document.getElementById('storyConceptSelector');
    if (!displayContainer || !selectorContainer) return;
    
    if (appState.currentStoryConcept) {
        // Hide the dropdown selector
        selectorContainer.style.display = 'none';
        
        // Show the concept display
        displayContainer.style.display = 'block';
        displayContainer.innerHTML = `
            <div class="story-concept-card">
                <div class="story-concept-content">
                    <div class="story-concept-title">${appState.currentStoryConcept.title}</div>
                    <div class="story-concept-logline">${appState.currentStoryConcept.logline}</div>
                </div>
                <div class="story-concept-actions">
                    <button type="button" class="btn edit-concept-btn" onclick="editStoryConcept()" title="Edit concept">✏️ Edit</button>
                    <button type="button" class="btn remove-concept-btn" onclick="removeStoryConcept()" title="Remove concept">× Remove</button>
                </div>
            </div>
        `;
    } else {
        // Show the dropdown selector
        selectorContainer.style.display = 'flex';
        
        // Hide the concept display
        displayContainer.style.display = 'none';
        displayContainer.innerHTML = '';
    }
    
    // Update progress meters when story concept changes
    if (typeof updateAllProgressMeters === 'function') {
        updateAllProgressMeters();
    }
    
    // Update autogenerate button visibility when story concept changes
    updateAutoGenerateButtonVisibility();
}

function editStoryConcept() {
    if (!appState.currentStoryConcept) return;
    
    const config = LIBRARY_TYPES.storyconcept;
    
    // Generate the key for the existing story concept
    const storyConceptKey = appState.currentStoryConcept.title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')         // Replace spaces with hyphens
        .replace(/-+/g, '-')          // Remove multiple hyphens
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
    
    // Set the editing state to indicate this is an update, not a new entry
    window.editingLibraryEntry = {
        type: 'storyconcepts',
        key: storyConceptKey,
        data: {
            name: appState.currentStoryConcept.title,
            description: appState.currentStoryConcept.logline || ''
        },
        originalName: appState.currentStoryConcept.title
    };
    
    showUniversalLibrarySaveModal('storyconcept', appState.currentStoryConcept.title, config, false);
    
    // Pre-populate the modal with current values
    setTimeout(() => {
        document.getElementById('universalLibraryEntryName').value = appState.currentStoryConcept.title;
        document.getElementById('universalLibraryEntryDescription').value = appState.currentStoryConcept.logline;
    }, 100);
}

function removeStoryConcept() {
    // Confirm with user since this will reset the entire project
    if (!confirm('Removing the story concept will reset your entire project and clear all generated content. Are you sure you want to continue?')) {
        return;
    }
    
    // Use the same logic as starting a fresh project
    // This resets everything: story, template, structure, plot points, scenes, dialogue
    startFreshProject();
    
    showToast('Story concept removed - project reset to start fresh', 'success');
}

function createNewStoryConcept() {
    // Just open the modal to create a new story concept
    const config = LIBRARY_TYPES.storyconcept;
    showUniversalLibrarySaveModal('storyconcept', '', config, true);
}

// Edit functions for clickable tags in step 1
async function editInfluenceEntry(type, influenceName) {
    
    // Get the config for this type
    const config = LIBRARY_TYPES[type];
    if (!config) {
        console.warn(`Unknown influence type: ${type}`);
        return;
    }
    
    // Load user libraries to find the full data for this entry
    const userLibraries = await loadUserLibraries();
    const libraryType = type + 's'; // Convert to plural (directors, screenwriters, etc.)
    const libraryEntries = userLibraries[libraryType] || [];
    
    // Find the entry data - try multiple strategies to handle name changes
    let entryData = null;
    
    // Strategy 1: Exact name match (handles most cases)
    console.log(`🔍 STRATEGY 1: Looking for exact name match for "${influenceName}" in ${libraryEntries.length} entries`);
    
    entryData = libraryEntries.find(entry => {
        const entryName = typeof entry === 'string' ? entry : 
                         (entry.name ? entry.name : 
                         (entry.entry_data && entry.entry_data.name ? entry.entry_data.name : 'unknown'));
        
        console.log(`🔍 Checking entry: "${entryName}" against "${influenceName}"`);
        
        if (typeof entry === 'string') {
            const match = entry === influenceName;
            if (match) console.log(`✅ String match found: "${entry}"`);
            return match;
        } else if (entry.name) {
            // For influences: {name, entry_key}
            const match = entry.name === influenceName;
            if (match) console.log(`✅ Entry name match found: "${entry.name}"`);
            return match;
        } else if (entry.entry_data && entry.entry_data.name) {
            // For characters/story concepts: {entry_data: {name, description}, entry_key}
            const match = entry.entry_data.name === influenceName;
            if (match) console.log(`✅ Entry data name match found: "${entry.entry_data.name}"`);
            return match;
        }
        return false;
    });
    
    if (entryData) {
        console.log(`✅ STRATEGY 1 SUCCESS: Found exact match`, {
            type: typeof entryData,
            name: typeof entryData === 'string' ? entryData : (entryData.name || entryData.entry_data?.name),
            key: entryData.entry_key || entryData.key || 'no-key'
        });
    } else {
        console.log(`❌ STRATEGY 1 FAILED: No exact name match found for "${influenceName}"`);
    }
    
    // Strategy 2: If not found, try to find by generated key match
    if (!entryData) {
        const searchKey = influenceName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
            
        console.log(`🔍 FALLBACK SEARCH: Looking for key "${searchKey}" in ${libraryEntries.length} entries`);
        console.log(`📋 Available entries:`, libraryEntries.map(e => ({
            name: e.name || e.entry_data?.name || (typeof e === 'string' ? e : 'unknown'),
            key: e.entry_key || e.key || 'no-key'
        })));
        
        entryData = libraryEntries.find(entry => {
            const entryKey = entry.entry_key || entry.key || '';
            const entryName = entry.name || entry.entry_data?.name || (typeof entry === 'string' ? entry : '');
            
            console.log(`🔍 Checking entry: name="${entryName}", key="${entryKey}" against search="${searchKey}"`);
            
            // Direct key match
            if (entry.entry_key === searchKey || entry.key === searchKey) {
                console.log(`✅ Direct key match found!`);
                return true;
            }
            
            // Check if search key starts with entry key (handles "cosmic-horror-edit1" -> "cosmic-horror")
            if (entryKey && searchKey.startsWith(entryKey + '-')) {
                console.log(`✅ Search key starts with entry key: "${searchKey}" starts with "${entryKey}"`);
                return true;
            }
            
            // Check if entry key starts with search key (reverse case)
            if (entryKey && entryKey.startsWith(searchKey + '-')) {
                console.log(`✅ Entry key starts with search key: "${entryKey}" starts with "${searchKey}"`);
                return true;
            }
            
            // Try removing edit suffixes and comparing base names
            const baseSearchKey = searchKey.replace(/-edit\d*$/g, '');
            const baseEntryKey = entryKey.replace(/-edit\d*$/g, '');
            if (baseSearchKey && baseEntryKey && baseSearchKey === baseEntryKey) {
                console.log(`✅ Base key match: "${baseSearchKey}" matches "${baseEntryKey}"`);
                return true;
            }
            
            return false;
        });
        
        if (entryData) {
            console.log(`✅ Found by fallback search:`, {
                name: entryData.name || entryData.entry_data?.name || 'string-entry',
                key: entryData.entry_key || entryData.key || 'no-key'
            });
        } else {
            console.log(`❌ No entry found for "${searchKey}"`);
        }
    }
    
    if (entryData) {
        // Extract the actual data based on the structure found
        let actualData, actualKey;
        
        if (typeof entryData === 'string') {
            // Simple string entry - we need to derive the original key
            actualData = { name: entryData, description: '' };
            
            // For string entries, we need to find the original base name and key
            // Strip edit suffixes to get the original base name
            const originalName = entryData.replace(/\s*\(edit\d*\)\s*/g, '');
            actualKey = originalName.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                .replace(/\s+/g, '-')         // Replace spaces with hyphens
                .replace(/-+/g, '-')          // Remove multiple hyphens
                .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
                
            console.log(`🔧 STRING ENTRY KEY DERIVATION: "${entryData}" -> original: "${originalName}" -> key: "${actualKey}"`);
        } else if (entryData.name) {
            // For influences: {name, entry_key}
            actualData = { name: entryData.name, description: entryData.description || '' };
            actualKey = entryData.entry_key || entryData.key;
        } else if (entryData.entry_data && entryData.entry_data.name) {
            // For characters/story concepts: {entry_data: {name, description}, entry_key}
            actualData = entryData.entry_data;
            actualKey = entryData.entry_key;
        } else {
            actualData = { name: influenceName, description: '' };
            // Strip edit suffixes to get original key for fallback case too
            const originalName = influenceName.replace(/\s*\(edit\d*\)\s*/g, '');
            actualKey = originalName.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                .replace(/\s+/g, '-')         // Replace spaces with hyphens
                .replace(/-+/g, '-')          // Remove multiple hyphens
                .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
                
            console.log(`🔧 FALLBACK KEY DERIVATION: "${influenceName}" -> original: "${originalName}" -> key: "${actualKey}"`);
        }
        
        // Store editing state for the universal modal
        window.editingLibraryEntry = {
            type: libraryType,
            key: actualKey,
            data: actualData,
            originalName: actualData.name, // Store original name for influence replacement
            isFromStep1: true // Flag to know this came from step 1
        };
        
        console.log(`🎯 SETUP EDIT: Setting up edit for "${influenceName}"`);
        console.log(`   - Library Type: ${libraryType}`);
        console.log(`   - Generated Key: "${actualKey}"`);
        console.log(`   - Entry Data:`, actualData);
        
        // Show universal modal with pre-filled data
        showUniversalLibrarySaveModal(type, actualData.name, config, false);
        
        // Pre-fill description if exists
        setTimeout(() => {
            const descField = document.getElementById('universalLibraryEntryDescription');
            if (descField && actualData.description) {
                descField.value = actualData.description;
            }
        }, 100);
    } else {
        // Entry not found in library, maybe it's a default entry
        // Create a new library entry with this name
        showUniversalLibrarySaveModal(type, influenceName, config, true);
        showToast('This entry is not in your library yet. You can save it now!', 'info');
    }
}

// editCharacterEntry function - MOVED TO components/character-manager.js

// ✅ buildInfluencePrompt - MOVED TO components/library-manager.js
function buildInfluencePrompt() {
    return libraryManager.buildInfluencePrompt();
}

// Story Analysis System functions moved to /components/story-analysis-system.js

// displayStoryAnalysis function moved to story-analysis-system.js

// Story analysis functions moved to story-analysis-system.js (applyRecommendedTemplate, getScoreClass, hideStoryAnalysis, modal functions)

// Apply AI Suggestions Functions moved to story-analysis-system.js

// Remaining story analysis functions moved to story-analysis-system.js (showImprovementPreviewModal, hideImprovementPreviewModal, applySelectedImprovements)

// Model selection functions
function setupModelSelector() {
    // Setup both model selectors (main form and project header)
    const modelSelectors = [
        { element: 'modelSelect', cost: 'modelCost' },
        { element: 'modelSelectMain', cost: 'modelCostMain' }
    ];
    
    modelSelectors.forEach(selector => {
        const modelSelect = document.getElementById(selector.element);
        if (modelSelect) {
            // Set initial model
            modelSelect.value = appState.selectedModel;
            
            // Add event listener for model changes
            modelSelect.addEventListener('change', function() {
                appState.selectedModel = this.value;
                
                // Sync both selectors
                modelSelectors.forEach(s => {
                    const element = document.getElementById(s.element);
                    if (element && element !== this) {
                        element.value = this.value;
                    }
                });
                
                updateModelCost();
                saveToLocalStorage();
                showToast(`Switched to ${modelPricing[this.value]?.description || 'selected'} model`, 'success');
            });
        }
    });
    
    // Initial cost update
    updateModelCost();
}

// Initialize global model selector in header
function initializeGlobalModelSelector() {
    console.log('Initializing global model selector...');
    
    const globalModelSelect = document.getElementById('globalModelSelect');
    const modelSelectProject = document.getElementById('modelSelect');
    const globalSaveBtn = document.getElementById('globalSaveBtn');
    
    // Set default model
    if (globalModelSelect) {
        globalModelSelect.value = appState.selectedModel;
        
        // Sync global model selector changes
        globalModelSelect.addEventListener('change', function() {
            console.log('Global model selector changed to:', this.value);
            
            // Update app state
            appState.selectedModel = this.value;
            
            // Sync with all other model selectors
            const modelSelectors = ['modelSelect', 'modelSelectMain'];
            modelSelectors.forEach(selectorId => {
                const element = document.getElementById(selectorId);
                if (element) {
                    element.value = this.value;
                }
            });
            
            // Update cost displays
            updateModelCost();
            
            // Save to localStorage
            saveToLocalStorage();
            
            // Mark project as dirty if we have project data
            if (appState.projectPath || appState.logline) {
                autoSaveManager.markDirty();
            }
            
            showToast(`Switched to ${modelPricing[this.value]?.description || 'selected'} model`, 'success');
        });
    }
    
    // Show save button when project is loaded
    function updateGlobalSaveButton() {
        if (globalSaveBtn) {
            if (appState.projectPath || appState.logline || appState.currentStoryConcept) {
                globalSaveBtn.style.display = 'inline-block';
            } else {
                globalSaveBtn.style.display = 'none';
            }
        }
    }
    
    // Update save button visibility on app state changes
    updateGlobalSaveButton();
    
    // Set up periodic check for save button visibility
    setInterval(updateGlobalSaveButton, 2000);
}

function updateModelCost() {
    const costElements = ['modelCost', 'modelCostMain'];
    const pricing = modelPricing[appState.selectedModel];
    
    costElements.forEach(elementId => {
        const modelCost = document.getElementById(elementId);
        if (modelCost && pricing) {
            modelCost.textContent = `~$${pricing.input}/$${pricing.output} per million tokens`;
        }
    });
}

function getSelectedModel() {
    return appState.selectedModel;
}

// Check if project has any existing content (check for actual content, not just empty objects)
function hasExistingContent() {
    // Check for actual content in generated objects
    const hasGeneratedStructure = appState.generatedStructure && Object.keys(appState.generatedStructure).length > 0;
    const hasGeneratedPlotPoints = appState.generatedPlotPoints && Object.keys(appState.generatedPlotPoints).length > 0;
    const hasGeneratedScenes = appState.generatedScenes && Object.keys(appState.generatedScenes).length > 0;
    const hasGeneratedDialogues = appState.generatedDialogues && Object.keys(appState.generatedDialogues).length > 0;
    
    return !!(
        hasGeneratedStructure ||
        hasGeneratedPlotPoints ||
        hasGeneratedScenes ||
        hasGeneratedDialogues ||
        appState.projectPath ||
        appState.isLoadedProject ||
        (appState.storyInput && (appState.storyInput.title || appState.storyInput.logline)) ||
        (appState.selectedTemplate && appState.selectedTemplate !== '') ||
        (appState.projectCharacters && appState.projectCharacters.length > 0) ||
        (appState.influences && (
            appState.influences.directors?.length > 0 ||
            appState.influences.screenwriters?.length > 0 ||
            appState.influences.films?.length > 0 ||
            appState.influences.tones?.length > 0
        ))
    );
}

// Update both button visibilities based on project state  
function updateAutoGenerateButtonVisibility() {
    const autoGenerateBtn = document.getElementById('autoGenerateBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    // Check if we have story concept content specifically
    const hasStoryConcept = !!(appState.storyInput && (appState.storyInput.title || appState.storyInput.logline));
    const hasAnyContent = hasExistingContent();
    
    // 🔧 DEBUG: Log the current state
    console.log('🔧 Button visibility check:', {
        hasStoryConcept,
        hasAnyContent,
        projectPath: appState.projectPath,
        isLoadedProject: appState.isLoadedProject,
        storyInputTitle: appState.storyInput?.title,
        storyInputLogline: appState.storyInput?.logline,
        selectedTemplate: appState.selectedTemplate,
        charactersCount: appState.projectCharacters?.length || 0,
        influencesDirectors: appState.influences?.directors?.length || 0,
        influencesScreenwriters: appState.influences?.screenwriters?.length || 0,
        influencesFilms: appState.influences?.films?.length || 0,
        influencesTones: appState.influences?.tones?.length || 0
    });
    
    // Autogenerate button: show only for brand new projects (no content at all)
    if (autoGenerateBtn) {
        if (hasAnyContent) {
            autoGenerateBtn.style.display = 'none';
            console.log('🔧 Hiding autogenerate button (has content)');
        } else {
            autoGenerateBtn.style.display = 'inline-block';
            console.log('🔧 Showing autogenerate button (no content)');
        }
    }
    
    // AI feedback button: show only when there's a story concept to analyze
    const genieContainer = document.getElementById('genieContainer');
    if (genieContainer) {
        if (hasStoryConcept) {
            genieContainer.style.display = 'flex';
            console.log('🔧 Showing story critique button (has story concept)');
        } else {
            genieContainer.style.display = 'none';
            console.log('🔧 Hiding story critique button (no story concept)');
        }
    }
}

// Auto-generation for debugging
async function autoGenerate() {
    console.log('🎲 AutoGenerate: Starting...');
    
    try {
    // Mad libs style logline generation
    const protagonists = [
        "a reclusive artist", "an aging professor", "a young immigrant", "a former dancer", 
        "a night shift worker", "a small-town librarian", "a retired diplomat", "a street musician",
        "a documentary filmmaker", "an insomniac translator", "a funeral director", "a lighthouse keeper"
    ];
    
    const situations = [
        "discovers a hidden room in their apartment", "receives mysterious letters from a stranger",
        "witnesses a crime that may not have happened", "inherits a peculiar family heirloom",
        "becomes obsessed with a neighbor's routine", "finds old film reels in their basement",
        "starts hearing voices from the past", "encounters their doppelganger",
        "begins losing memories of their childhood", "discovers they're being followed",
        "finds a diary that predicts the future", "becomes convinced time is moving backward"
    ];
    
    const consequences = [
        "questioning the nature of reality", "confronting buried family secrets",
        "unraveling a decades-old mystery", "facing their deepest fears",
        "discovering they're not who they thought they were", "realizing nothing is as it seems",
        "confronting the ghosts of their past", "questioning their own sanity",
        "uncovering a conspiracy that involves them", "learning the truth about their identity"
    ];
    
    const protagonist = protagonists[Math.floor(Math.random() * protagonists.length)];
    const situation = situations[Math.floor(Math.random() * situations.length)];
    const consequence = consequences[Math.floor(Math.random() * consequences.length)];
    
    const logline = `${protagonist.charAt(0).toUpperCase() + protagonist.slice(1)} ${situation}, leading to ${consequence}.`;
    
    // Random character combinations
    const characterTypes = [
        "An introspective protagonist struggling with isolation and memory",
        "A mysterious neighbor who may or may not exist",
        "An elderly relative harboring family secrets",
        "A younger character representing lost innocence",
        "A figure from the past who haunts the present",
        "An authority figure who cannot be trusted",
        "A lover or former lover who embodies desire and loss",
        "A child who sees things adults cannot"
    ];
    
    const shuffledCharacters = [...characterTypes].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 2);
    const characters = shuffledCharacters.join("; ");
    
    // Random title generation
    const titleWords1 = ["The", "A", "Last", "First", "Hidden", "Lost", "Silent", "Broken", "Empty", "Distant"];
    const titleWords2 = ["Room", "Mirror", "Letter", "Dance", "Memory", "Portrait", "Garden", "Window", "Shadow", "Dream"];
    const title = `${titleWords1[Math.floor(Math.random() * titleWords1.length)]} ${titleWords2[Math.floor(Math.random() * titleWords2.length)]}`;
    
    // Load user libraries (which include starter pack content)
    console.log('🎲 AutoGenerate: Loading user libraries...');
    const userLibraries = await loadUserLibraries();
    console.log('🎲 AutoGenerate: User libraries loaded:', {
        directors: userLibraries.directors?.length || 0,
        screenwriters: userLibraries.screenwriters?.length || 0,
        films: userLibraries.films?.length || 0,
        tones: userLibraries.tones?.length || 0
    });
    
    // Clear existing influences
    appState.influences = { directors: [], screenwriters: [], films: [], tones: [] };
    
    // Add random influences (1-3 of each type) from user's libraries
    const randomDirectors = [...(userLibraries.directors || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomScreenwriters = [...(userLibraries.screenwriters || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomFilms = [...(userLibraries.films || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    
    appState.influences.directors = randomDirectors;
    appState.influences.screenwriters = randomScreenwriters;
    appState.influences.films = randomFilms;
    
    // Auto-generate sample characters BEFORE creating the project
    // Use random characters from user's character library (characters are now objects with name and description)
    if (userLibraries.characters && userLibraries.characters.length > 0) {
        const shuffledCharacters = [...userLibraries.characters].sort(() => 0.5 - Math.random());
        appState.projectCharacters = shuffledCharacters.slice(0, Math.min(3, shuffledCharacters.length)).map(character => ({
            name: character.name,
            description: character.description,
            fromLibrary: true
        }));
    } else {
        // Fallback if no characters in library
        appState.projectCharacters = [
            { name: "Main Character", description: characters },
            { name: "Supporting Character", description: "A key figure in the protagonist's journey" }
        ];
    }
    
    // Add random tone to influences
    const randomTones = [...(userLibraries.tones || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 1);
    appState.influences.tones = randomTones;
    
    // Initialize new project from story concept (this does all the proper setup)
    console.log('🎲 AutoGenerate: Initializing project with:', { title, logline });
    initializeNewProjectFromStoryConcept(title, logline);
    console.log('🎲 AutoGenerate: Project initialized. Story concept should now be visible.');
    
    // Set random total scenes after project is initialized
    if (appState.storyInput) {
        appState.storyInput.totalScenes = Math.floor(Math.random() * 50) + 40; // 40-90 scenes
    }
    
    // Update ALL UI displays after project setup
    updateInfluenceTags('director');
    updateInfluenceTags('screenwriter');
    updateInfluenceTags('film');
    updateInfluenceTags('tone');
    updateCharacterTags(); // This was missing!
    updateStoryConceptDisplay(); // This was missing!
    
    console.log('Auto-generated story concept:', {
        title,
        logline,
        characters,
        influences: appState.influences
    });
    
    showToast('Auto-generated story concept, characters, and influences!', 'success');
    
    } catch (error) {
        console.error('🎲 AutoGenerate: Error occurred:', error);
        showToast('Error during auto-generation: ' + error.message, 'error');
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    setupEventListeners();
    setupModelSelector();
    initializeGlobalModelSelector();
    loadTemplates();
    setupUniversalLibraryKeyboardSupport();
    setupLibraryChangeListener();
});

// ✅ initializeApp - MOVED TO components/app-initialization-manager.js
async function initializeApp() {
    return appInitializationManager.initializeApp();
}

// ✅ populateDropdowns - MOVED TO components/app-initialization-manager.js
async function populateDropdowns() {
    return appInitializationManager.populateDropdowns();
}

// ✅ loadUserLibraries - MOVED TO components/app-initialization-manager.js
async function loadUserLibraries() {
    return appInitializationManager.loadUserLibraries();
}

// ✅ restoreLoadedProject - MOVED TO components/app-initialization-manager.js
async function restoreLoadedProject() {
    return appInitializationManager.restoreLoadedProject();
}

// ✅ setupEventListeners - MOVED TO components/app-initialization-manager.js
function setupEventListeners() {
    return appInitializationManager.setupEventListeners();
}

// ✅ setupLibraryChangeListener - MOVED TO components/app-initialization-manager.js
function setupLibraryChangeListener() {
    return appInitializationManager.setupLibraryChangeListener();
}

// ✅ handleStorySubmission - MOVED TO components/app-initialization-manager.js
function handleStorySubmission() {
    return appInitializationManager.handleStorySubmission();
}

// ✅ Load available templates - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
async function loadTemplates() {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.loadTemplates();
    }
}

// ✅ Display template options - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function displayTemplates(groupedTemplates) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.displayTemplates(groupedTemplates);
    }
}

// ✅ Select template - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function selectTemplate(templateId) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.selectTemplate(templateId);
    }
}

// ✅ Template UI functions - MOVED TO components/template-manager.js
// Legacy functions for backward compatibility
function collapseTemplateOptions() {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.collapseTemplateOptions();
    }
}

function expandTemplateOptions() {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.expandTemplateOptions();
    }
}

function updateTemplatePageForSelection() {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.updateTemplatePageForSelection();
    }
}

// ✅ Change template - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function changeTemplate() {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.changeTemplate();
    }
}

// Preview prompt that will be sent to Claude
async function previewPrompt() {
    console.log('🔍 DEBUG: previewPrompt() called');
    console.log('🔍 DEBUG: appState.selectedTemplate:', appState.selectedTemplate);
    console.log('🔍 DEBUG: appState.templateData exists:', !!appState.templateData);
    console.log('🔍 DEBUG: appState.templateData structure exists:', !!(appState.templateData && appState.templateData.structure));
    
    if (!appState.selectedTemplate) {
        showToast('Please select a template first.', 'error');
        return;
    }
    
    // Create story input for server - always ensure characters are formatted strings
    let storyInput = appState.storyInput;
    if (!storyInput) {
        storyInput = {
            title: '[Your Story Title]',
            logline: '[Your story logline describing the main plot]',
            characters: '[Your main characters]',
            tone: 'Dramatic',
            totalScenes: 70,
            influences: { directors: [], screenwriters: [], films: [] },
            influencePrompt: ''
        };
    } else {
        // 🔧 CRITICAL FIX: Always use formatted character strings for server
        // Clone storyInput and ensure characters field contains formatted strings, not objects
        storyInput = {
            ...storyInput,
            characters: getCharactersForPrompt() || storyInput.characters || '[Your main characters]'
        };
        console.log('🔧 Fixed character format for prompt preview:', storyInput.characters);
    }
    
    console.log('🔍 DEBUG: About to send request with:', {
        storyInput: storyInput.title,
        template: appState.selectedTemplate,
        hasCustomTemplateData: !!appState.templateData,
        customTemplateDataKeys: appState.templateData ? Object.keys(appState.templateData) : []
    });
    
    if (appState.templateData && appState.templateData.structure) {
        console.log('🔍 DEBUG: Custom template structure keys:', Object.keys(appState.templateData.structure));
        // Log a sample act to verify customizations
        const firstActKey = Object.keys(appState.templateData.structure)[0];
        if (firstActKey) {
            console.log('🔍 DEBUG: Sample act data:', {
                key: firstActKey,
                name: appState.templateData.structure[firstActKey].name,
                description: appState.templateData.structure[firstActKey].description
            });
        }
    }
    
    try {
        showLoading('Generating prompt preview...');
        
        // 🔧 Fix template key order before sending to server (same as generateStructure)
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
                        console.log('🔧 Fixed template key order for preview:', Object.keys(orderedStructure));
                    }
                }
            } catch (error) {
                console.warn('Could not fix template order for preview, using current order:', error);
            }
        }

        const response = await fetch('/api/preview-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                storyInput: storyInput,
                template: appState.selectedTemplate,
                customTemplateData: customTemplateData // 🔧 Send order-corrected template data
            })
        });
        
        console.log('🔍 DEBUG: Response received, status:', response.status);
        
        const data = await response.json();
        
        console.log('🔍 DEBUG: Server response data:', {
            hasDebugInfo: !!data.debugInfo,
            debugInfo: data.debugInfo
        });
        
        if (response.ok) {
            // Store original prompt
            appState.originalPrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                templateStructure: JSON.stringify(data.template.structure, null, 2)
            };
            
            // Display the prompt in the modal (use custom if available, otherwise original)
            const promptToShow = appState.customPrompt || appState.originalPrompt;
            document.getElementById('systemMessageContent').textContent = promptToShow.systemMessage;
            document.getElementById('userPromptContent').textContent = promptToShow.userPrompt;
            document.getElementById('templateStructureContent').textContent = promptToShow.templateStructure;
            
            // Show custom prompt notice if using custom prompt
            document.getElementById('customPromptNotice').style.display = appState.customPrompt ? 'block' : 'none';
            
            showPromptPreviewModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate prompt preview');
        }
    } catch (error) {
        console.error('Error generating prompt preview:', error);
        showToast('Error generating prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// ✅ Show prompt preview modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function showPromptPreviewModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showPromptPreviewModal();
    }
}

// ✅ Hide prompt preview modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function hidePromptPreviewModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hidePromptPreviewModal();
    }
}

// 🔧 MOVED TO: public/components/structure-generation-manager.js
// Legacy function for backward compatibility
async function generateStructureWithCustomPrompt() {
    return await structureGenerationManager.generateStructureWithCustomPrompt();
}

// ===== LEGACY COMPATIBILITY WRAPPERS =====
// These functions now delegate to the GenerationButtonManager component

// Update the acts generation button text based on whether acts exist
function updateActsGenerationButton() {
    return generationButtonManager.updateActsGenerationButton();
}

// Update the "Generate All Plot Points" button text based on whether ALL acts have plot points
function updateGenerateAllPlotPointsButton() {
    return generationButtonManager.updateGenerateAllPlotPointsButton();
}

// Update the "Generate All Scenes" button text based on whether ALL acts with plot points have scenes
function updateGenerateAllScenesButton() {
    return generationButtonManager.updateGenerateAllScenesButton();
}

// Update the "Generate All Dialogue" button text based on whether ALL scenes have dialogue
function updateGenerateAllDialogueButton() {
    return generationButtonManager.updateGenerateAllDialogueButton();
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function updateAllGenerationButtons() {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.updateAllGenerationButtons();
    }
    return generationButtonManager.updateAllGenerationButtons();
}



// 🔧 MOVED TO: public/components/structure-generation-manager.js
// Legacy function for backward compatibility
async function generateStructure() {
    return await structureGenerationManager.generateStructure();
}

// ✅ Get chronological act order - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function getChronologicalActOrder(templateData, structureKeys) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.getChronologicalActOrder(templateData, structureKeys);
    }
    return structureKeys;
}

// 🔧 MOVED TO: public/components/structure-generation-manager.js
// Legacy function for backward compatibility
function displayStructure(structure, prompt = null, systemMessage = null) {
    return structureGenerationManager.displayStructure(structure, prompt, systemMessage);
}

// 🔧 MOVED TO: public/components/structure-generation-manager.js
// Legacy function for backward compatibility
async function saveActContent(actKey, content) {
    return await structureGenerationManager.saveActContent(actKey, content);
}

// Show the prompt that was used for the current structure
function showUsedPromptModal() {
    if (appState.lastUsedPrompt && appState.lastUsedSystemMessage) {
        document.getElementById('systemMessageContent').textContent = appState.lastUsedSystemMessage;
        document.getElementById('userPromptContent').textContent = appState.lastUsedPrompt;
        document.getElementById('templateStructureContent').textContent = JSON.stringify(appState.templateData?.structure || {}, null, 2);
        showPromptPreviewModal();
    }
}

// Get a summary of influences for display
function getInfluencesSummary() {
    const influences = appState.storyInput?.influences || { directors: [], screenwriters: [], films: [] };
    const parts = [];
    
    if (influences.directors?.length > 0) {
        parts.push(`${influences.directors.length} director(s)`);
    }
    if (influences.screenwriters?.length > 0) {
        parts.push(`${influences.screenwriters.length} screenwriter(s)`);
    }
    if (influences.films?.length > 0) {
        parts.push(`${influences.films.length} film(s)`);
    }

    
    return parts.length > 0 ? parts.join(', ') : 'None';
}

// Toggle edit mode for prompts
function toggleEditMode() {
    appState.isEditMode = !appState.isEditMode;
    
    if (appState.isEditMode) {
        // Show editors, hide viewers
        document.getElementById('systemMessageContent').style.display = 'none';
        document.getElementById('userPromptContent').style.display = 'none';
        document.getElementById('templateStructureContent').style.display = 'none';
        
        document.getElementById('systemMessageEditor').style.display = 'block';
        document.getElementById('userPromptEditor').style.display = 'block';
        document.getElementById('templateStructureEditor').style.display = 'block';
        
        // Copy content to editors
        document.getElementById('systemMessageEditor').value = document.getElementById('systemMessageContent').textContent;
        document.getElementById('userPromptEditor').value = document.getElementById('userPromptContent').textContent;
        document.getElementById('templateStructureEditor').value = document.getElementById('templateStructureContent').textContent;
        
        // Show save button
        document.getElementById('savePromptBtn').style.display = 'inline-block';
        
        // Update button text
        document.querySelector('button[onclick="toggleEditMode()"]').innerHTML = '👁️ View';
    } else {
        // Show viewers, hide editors
        document.getElementById('systemMessageContent').style.display = 'block';
        document.getElementById('userPromptContent').style.display = 'block';
        document.getElementById('templateStructureContent').style.display = 'block';
        
        document.getElementById('systemMessageEditor').style.display = 'none';
        document.getElementById('userPromptEditor').style.display = 'none';
        document.getElementById('templateStructureEditor').style.display = 'none';
        
        // Hide save button
        document.getElementById('savePromptBtn').style.display = 'none';
        
        // Update button text
        document.querySelector('button[onclick="toggleEditMode()"]').innerHTML = '✏️ Edit';
    }
}

// Save custom prompt
function saveCustomPrompt() {
    appState.customPrompt = {
        systemMessage: document.getElementById('systemMessageEditor').value,
        userPrompt: document.getElementById('userPromptEditor').value,
        templateStructure: document.getElementById('templateStructureEditor').value
    };
    
    // Update the displayed content
    document.getElementById('systemMessageContent').textContent = appState.customPrompt.systemMessage;
    document.getElementById('userPromptContent').textContent = appState.customPrompt.userPrompt;
    document.getElementById('templateStructureContent').textContent = appState.customPrompt.templateStructure;
    
    // Show custom prompt notice
    document.getElementById('customPromptNotice').style.display = 'block';
    
    // Exit edit mode
    appState.isEditMode = false;
    toggleEditMode();
    
    showToast('Custom prompt saved! You can now generate with your modified prompt.', 'success');
    saveToLocalStorage();
}

// Reset to original prompt
function resetPrompt() {
    if (appState.originalPrompt) {
        document.getElementById('systemMessageContent').textContent = appState.originalPrompt.systemMessage;
        document.getElementById('userPromptContent').textContent = appState.originalPrompt.userPrompt;
        document.getElementById('templateStructureContent').textContent = appState.originalPrompt.templateStructure;
        
        // Reset editors too if in edit mode
        if (appState.isEditMode) {
            document.getElementById('systemMessageEditor').value = appState.originalPrompt.systemMessage;
            document.getElementById('userPromptEditor').value = appState.originalPrompt.userPrompt;
            document.getElementById('templateStructureEditor').value = appState.originalPrompt.templateStructure;
        }
        
        // Clear custom prompt
        appState.customPrompt = null;
        document.getElementById('customPromptNotice').style.display = 'none';
        
        showToast('Prompt reset to original version.', 'success');
        saveToLocalStorage();
    }
}

// Generate with current prompt (original or custom)
async function generateWithCurrentPrompt() {
    hidePromptPreviewModal();
    
    if (appState.customPrompt) {
        // Use custom prompt
        await generateStructureWithCustomPrompt();
    } else {
        // Use original prompt
        await generateStructure();
    }
}

// Regenerate structure
async function regenerateStructure() {
    await generateStructure();
}

// Navigate to plot points (removed approval concept)
async function goToPlotPoints() {
    console.log('Navigating to plot points generation');
    goToStep(4); // Go to plot points step
    await displayPlotPointsGeneration();
}

// Update total plot points and recalculate distributions
function updateTotalPlotPoints(newTotal) {
    const totalValue = parseInt(newTotal);
    if (totalValue >= 20 && totalValue <= 80) {
        appState.totalPlotPoints = totalValue;
        console.log(`📊 Updated total plot points to: ${totalValue}`);
        
        // Smart redistribution: preserve manual values, scale others proportionally
        redistributePlotPointsIntelligently(totalValue);
        
        // Save to localStorage
        saveToLocalStorage();
    }
}

// Smart redistribution that preserves user's manual choices
function redistributePlotPointsIntelligently(newTotal) {
    console.log(`📊 === REDISTRIBUTION START === Total: ${newTotal}`);
    
    if (!appState.generatedStructure) {
        console.log('📊 No structure available for redistribution');
        return;
    }
    
    const structureKeys = Object.keys(appState.generatedStructure);
    const manualPlotPoints = appState.manuallySetPlotPoints || {};
    
    console.log(`📊 Structure keys:`, structureKeys);
    console.log(`📊 Manual plot points:`, manualPlotPoints);
    
    // Get all dropdowns first
    const allDropdowns = document.querySelectorAll('.plot-points-count-select');
    console.log(`📊 Found ${allDropdowns.length} dropdowns for ${structureKeys.length} structure keys`);
    
    if (allDropdowns.length === 0) {
        console.log('📊 No dropdowns found, interface may not be ready');
        return;
    }
    
    // Debug: Log current dropdown values before changes
    allDropdowns.forEach(dropdown => {
        console.log(`📊 Dropdown ${dropdown.id}: current value = ${dropdown.value}`);
    });
    
    // Calculate current manual total
    let manualTotal = 0;
    let manualKeys = [];
    let automaticKeys = [];
    
    structureKeys.forEach(key => {
        if (manualPlotPoints[key]) {
            const dropdown = document.getElementById(`plotPointsCount-${key}`);
            if (dropdown) {
                manualTotal += parseInt(dropdown.value);
                manualKeys.push(key);
            }
        } else {
            automaticKeys.push(key);
        }
    });
    
    console.log(`📊 Redistributing: Total=${newTotal}, Manual=${manualTotal} (${manualKeys.length} acts), Automatic=${automaticKeys.length} acts`);
    
    // Handle edge cases without regenerating interface
    if (automaticKeys.length === 0) {
        console.log('📊 All acts are manually set, no redistribution possible');
        return;
    }
    
    // Calculate remaining points for automatic distribution
    let remainingPoints = newTotal - manualTotal;
    
    // If manual values exceed new total, proportionally reduce automatic acts
    if (remainingPoints <= 0) {
        console.log('⚠️ Manual values exceed/equal new total, setting automatic acts to minimum');
        automaticKeys.forEach(key => {
            const dropdown = document.getElementById(`plotPointsCount-${key}`);
            if (dropdown) {
                dropdown.value = 1; // Minimum value
                console.log(`📊 Set ${key} to minimum: 1 plot point`);
            }
        });
        return;
    }
    
    // Calculate proportional weights based on CURRENT dropdown values
    let totalAutomaticWeight = 0;
    const automaticWeights = {};
    
    // First pass: get current values for all automatic acts
    automaticKeys.forEach(key => {
        const dropdown = document.getElementById(`plotPointsCount-${key}`);
        const currentValue = dropdown ? parseInt(dropdown.value) : 1;
        automaticWeights[key] = currentValue;
        totalAutomaticWeight += currentValue;
    });
    
    console.log(`📊 Current automatic weights:`, automaticWeights, `Total: ${totalAutomaticWeight}`);
    
    // Redistribute remaining points proportionally among automatic acts
    automaticKeys.forEach(key => {
        const weight = automaticWeights[key];
        const proportionalShare = totalAutomaticWeight > 0 ? (weight / totalAutomaticWeight) : (1 / automaticKeys.length);
        let newValue = Math.round(remainingPoints * proportionalShare);
        newValue = Math.max(1, newValue); // Minimum 1 plot point
        
        const dropdown = document.getElementById(`plotPointsCount-${key}`);
        if (dropdown) {
            // Ensure dropdown can handle the new value by adding options if needed
            ensureDropdownHasOption(dropdown, newValue);
            dropdown.value = newValue;
            console.log(`📊 Auto-redistributed ${key}: ${newValue} plot points (weight: ${weight.toFixed(1)}%)`);
        }
    });
    
    // Handle rounding errors by adjusting the last automatic act
    if (automaticKeys.length > 0) {
        const actualTotal = structureKeys.reduce((sum, key) => {
            const dropdown = document.getElementById(`plotPointsCount-${key}`);
            const value = dropdown ? parseInt(dropdown.value) : 0;
            return sum + (isNaN(value) ? 0 : value);
        }, 0);
        
        const difference = newTotal - actualTotal;
        if (difference !== 0 && !isNaN(difference)) {
            const lastAutomaticKey = automaticKeys[automaticKeys.length - 1];
            const lastDropdown = document.getElementById(`plotPointsCount-${lastAutomaticKey}`);
            if (lastDropdown) {
                const currentValue = parseInt(lastDropdown.value) || 0;
                const newValue = Math.max(1, currentValue + difference);
                
                // Ensure dropdown can handle the new value by adding options if needed
                ensureDropdownHasOption(lastDropdown, newValue);
                lastDropdown.value = newValue;
                console.log(`📊 Rounding adjustment for ${lastAutomaticKey}: ${newValue} plot points (difference: ${difference})`);
            }
        }
    }
    
    // 🔧 CRITICAL FIX: Save updated values to appState for persistence
    console.log('📊 === SAVING REDISTRIBUTED VALUES ===');
    if (!appState.currentActPlotPoints) appState.currentActPlotPoints = {};
    
    allDropdowns.forEach(dropdown => {
        const structureKey = dropdown.id.replace('plotPointsCount-', '');
        const newValue = parseInt(dropdown.value);
        if (!isNaN(newValue)) {
            appState.currentActPlotPoints[structureKey] = newValue;
            console.log(`📊 Saved redistributed value: ${structureKey} = ${newValue}`);
        }
    });
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Debug: Log dropdown values after changes
    console.log('📊 === FINAL DROPDOWN VALUES ===');
    allDropdowns.forEach(dropdown => {
        console.log(`📊 After: ${dropdown.id} = ${dropdown.value}`);
    });
    
    console.log('📊 Redistribution complete');
}

// Reset plot points to template defaults
function resetPlotPointsToDefault() {
    console.log('🔄 Resetting plot points to template defaults...');
    
    if (!appState.generatedStructure || !appState.templateData) {
        console.log('⚠️ No structure or template data available for reset');
        return;
    }
    
    // Clear manual tracking state
    appState.manuallySetPlotPoints = {};
    appState.currentActPlotPoints = {};
    
    // Reset total to template default
    const defaultTotal = appState.templateData.total_plot_points || 40;
    appState.totalPlotPoints = defaultTotal;
    
    // Update total input field
    const totalInput = document.getElementById('totalPlotPoints');
    if (totalInput) {
        totalInput.value = defaultTotal;
    }
    
    // Reset each dropdown to its original template value
    const structureKeys = Object.keys(appState.generatedStructure);
    structureKeys.forEach(key => {
        const storyAct = appState.generatedStructure[key];
        const dropdown = document.getElementById(`plotPointsCount-${key}`);
        
        if (dropdown) {
            // Get original template value - prioritize template data over generated structure
            let originalValue = 4; // Default fallback
            
            // 1. First try template data (most reliable)
            if (appState.templateData?.structure?.[key]?.plotPoints) {
                originalValue = appState.templateData.structure[key].plotPoints;
            }
            // 2. Fallback to generated structure
            else if (storyAct.plotPoints) {
                originalValue = storyAct.plotPoints;
            }
            
            // Ensure dropdown has the option
            ensureDropdownHasOption(dropdown, originalValue);
            dropdown.value = originalValue;
            
            console.log(`🔄 Reset ${key} to template default: ${originalValue} plot points`);
        }
    });
    
    // Save to localStorage
    saveToLocalStorage();
    
    console.log(`🔄 Reset complete: Total=${defaultTotal}, Manual tracking cleared`);
}

// Helper function to ensure dropdown has an option for a specific value
function ensureDropdownHasOption(dropdown, targetValue) {
    // Check if option already exists
    const existingOption = dropdown.querySelector(`option[value="${targetValue}"]`);
    if (existingOption) {
        return; // Option already exists
    }
    
    // Find the highest existing option value
    const options = Array.from(dropdown.options);
    const maxExistingValue = Math.max(...options.map(opt => parseInt(opt.value) || 0));
    
    // Add missing options up to the target value
    for (let i = maxExistingValue + 1; i <= targetValue; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} Plot Point${i > 1 ? 's' : ''}`;
        dropdown.appendChild(option);
    }
}

// Sync current dropdown values to appState for persistence
function syncDropdownValuesToState() {
    // Initialize if needed
    if (!appState.currentActPlotPoints) appState.currentActPlotPoints = {};
    
    // Find all plot point dropdowns and sync their values
    const allDropdowns = document.querySelectorAll('.plot-points-count-select');
    allDropdowns.forEach(dropdown => {
        const structureKey = dropdown.id.replace('plotPointsCount-', '');
        const currentValue = parseInt(dropdown.value);
        if (!isNaN(currentValue)) {
            appState.currentActPlotPoints[structureKey] = currentValue;
            console.log(`📊 Synced dropdown value for ${structureKey}: ${currentValue}`);
        }
    });
    
    // Save to localStorage
    saveToLocalStorage();
}

// Update individual act plot points and recalculate total (bidirectional sync)
function updateIndividualActPlotPoints(structureKey, newValue) {
    const value = parseInt(newValue);
    
    // Initialize state tracking if needed
    if (!appState.manuallySetPlotPoints) appState.manuallySetPlotPoints = {};
    if (!appState.currentActPlotPoints) appState.currentActPlotPoints = {};
    
    // Track this as manually set
    appState.manuallySetPlotPoints[structureKey] = true;
    appState.currentActPlotPoints[structureKey] = value;
    
    // Calculate new total by summing all current dropdown values
    const allDropdowns = document.querySelectorAll('.plot-points-count-select');
    let newTotal = 0;
    allDropdowns.forEach(dropdown => {
        newTotal += parseInt(dropdown.value);
    });
    
    // Update total input and appState
    const totalInput = document.getElementById('totalPlotPoints');
    if (totalInput) {
        totalInput.value = newTotal;
    }
    appState.totalPlotPoints = newTotal;
    
    console.log(`📊 Individual act ${structureKey} changed to ${value}, new total: ${newTotal}`);
    
    // Save to localStorage
    saveToLocalStorage();
}

// Display plot points generation interface
async function displayPlotPointsGeneration() {
    const container = document.getElementById('plotPointsContent');
    
    if (!appState.generatedStructure) {
        container.innerHTML = '<p>No structure available. Please generate a structure first.</p>';
        return;
    }

    // Plot point distribution system active - using template-based defaults

    let html = '<div class="plot-points-generation">';
    html += '<p class="generation-info"><strong>Generate plot points for each story act.</strong> These will create the causal narrative spine that guides scene creation.</p>';
    
    // Add total plot points configuration
    const defaultTotal = appState.templateData?.total_plot_points || 40;
    const currentTotal = appState.totalPlotPoints || defaultTotal;
    
    html += `
        <div class="total-plot-points-config" style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                <label for="totalPlotPoints" style="font-weight: 600; color: #374151;">Total Plot Points:</label>
                <input type="number" id="totalPlotPoints" value="${currentTotal}" min="20" max="80" 
                       style="width: 80px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px;"
                       onchange="updateTotalPlotPoints(this.value)">
                <span style="color: #6b7280; font-size: 0.9em;">Default: ${defaultTotal}</span>
                <button onclick="resetPlotPointsToDefault()" 
                        style="padding: 6px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; color: #374151; font-size: 0.85em; cursor: pointer; transition: background 0.2s;"
                        onmouseover="this.style.background='#e5e7eb'" 
                        onmouseout="this.style.background='#f3f4f6'"
                        title="Reset all plot points to template defaults">
                    🔄 Reset to Default
                </button>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 0.85em;">
                This total will be distributed across all acts based on their narrative importance. You can override individual act values after generation.
            </p>
        </div>
    `;
    
    // First, try to load existing plot points from the project
    await loadExistingPlotPoints();
    
    // 🔧 CRITICAL FIX: Clear stale cached plot points values to use fresh template values
    // Only clear if we haven't manually set any values yet
    if (!appState.manuallySetPlotPoints || Object.keys(appState.manuallySetPlotPoints).length === 0) {
        console.log('📊 Clearing stale cached plot points to use fresh template values');
        appState.currentActPlotPoints = {};
    }
    
    // Display each story act with plot points generation in chronological order
    const structureKeys = Object.keys(appState.generatedStructure);
    const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
    
    // 🔧 DEBUG: Show current state before processing
    console.log(`📊 DEBUG: appState.currentActPlotPoints:`, appState.currentActPlotPoints);
    
    chronologicalKeys.forEach((structureKey, index) => {
        const storyAct = appState.generatedStructure[structureKey];
        
        // Get act progress notation (X/Y format) 
        const totalActs = chronologicalKeys.length;
        const actProgress = `${index + 1}/${totalActs}`;
        const actName = storyAct.name || structureKey.replace(/_/g, ' ').toUpperCase();
        
        // 🔧 CRITICAL FIX: Priority order for plot point values
        let recommendedPlotPoints = 4; // Default fallback
        
        // 1. FIRST: Check if we have a current saved value in appState.currentActPlotPoints
        if (appState.currentActPlotPoints && appState.currentActPlotPoints[structureKey]) {
            recommendedPlotPoints = appState.currentActPlotPoints[structureKey];
            console.log(`📊 ✅ Using saved current value: ${recommendedPlotPoints} for ${structureKey}`);
        }
        // 2. SECOND: Try to get plot points directly from the template data (main source)
        else if (appState.templateData?.structure?.[structureKey]?.plotPoints) {
            recommendedPlotPoints = appState.templateData.structure[structureKey].plotPoints;
            console.log(`📊 ✅ Using template plotPoints: ${recommendedPlotPoints} for ${structureKey}`);
        }
        // 3. THIRD: Try to get plot points from the generated structure (preserved from template)
        else if (storyAct.plotPoints) {
            recommendedPlotPoints = storyAct.plotPoints;
            console.log(`📊 ⚠️  Using preserved plot points from generated structure: ${recommendedPlotPoints} for ${structureKey}`);
        }
        // 4. FOURTH: Fallback to template distribution data
        else {
            const templateDistribution = appState.templateData?.structure?.[structureKey]?.distribution;
            const totalPlotPoints = appState.totalPlotPoints || appState.templateData?.total_plot_points || 40;
            
            if (templateDistribution && templateDistribution.percentage) {
                // Calculate based on percentage of total
                recommendedPlotPoints = Math.round((templateDistribution.percentage / 100) * totalPlotPoints);
                recommendedPlotPoints = Math.max(1, recommendedPlotPoints); // Minimum 1 plot point
            } else if (templateDistribution && templateDistribution.plotPoints) {
                // Use fixed value from template (legacy)
                recommendedPlotPoints = templateDistribution.plotPoints;
            }
        }
        
        // Optional debug logging (remove in production)
        // console.log(`🎯 Plot Points for ${structureKey}: ${recommendedPlotPoints} plot points`);
        
        // Create options with the optimal value auto-selected
        const createOption = (value, label) => {
            const isSelected = value === recommendedPlotPoints;
            return `<option value="${value}" ${isSelected ? 'selected' : ''}>${label}</option>`;
        };
        
        html += `
            <div class="structure-element-card" id="plotPoints-${structureKey}">
                <div class="element-header">
                    <h3>${actProgress} ${actName}</h3>
                    <div class="element-actions">
                        <div class="plot-points-controls">
                            <select class="plot-points-count-select" id="plotPointsCount-${structureKey}" 
                                    onchange="updateIndividualActPlotPoints('${structureKey}', this.value)">
                                ${Array.from({length: 25}, (_, i) => i + 1).map(value => 
                                    createOption(value, `${value} Plot Point${value > 1 ? 's' : ''}`)
                                ).join('')}
                            </select>
                            ${(() => {
                                const canGenerate = canGeneratePlotPointsForElement(structureKey);
                                const buttonClass = canGenerate ? 'btn btn-primary' : 'btn btn-primary btn-disabled';
                                
                                // Check if plot points already exist for this act
                                const hasExistingPlotPoints = hasPlotPointsForElement(structureKey);
                                const actionText = hasExistingPlotPoints ? 'Regenerate' : 'Generate';
                                const actionIcon = hasExistingPlotPoints ? '🔄' : '📋';
                                
                                let buttonTitle = `${actionText} plot points for Act ${actProgress}`;
                                if (!canGenerate) {
                                    const structureKeys = Object.keys(appState.generatedStructure);
                                    const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
                                    const currentActIndex = chronologicalKeys.indexOf(structureKey);
                                    const missingPreviousActs = [];
                                    
                                    for (let i = 0; i < currentActIndex; i++) {
                                        const previousActKey = chronologicalKeys[i];
                                        if (!hasPlotPointsForElement(previousActKey)) {
                                            const previousAct = appState.generatedStructure[previousActKey];
                                            missingPreviousActs.push(previousAct.name || previousActKey);
                                        }
                                    }
                                    
                                    buttonTitle = `Complete previous acts first: ${missingPreviousActs.join(', ')}`;
                                }
                                
                                // Escape HTML attributes to prevent syntax errors
                                const escapedTitle = buttonTitle.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                                
                                const buttonOnClick = canGenerate ? 
                                    `generateElementPlotPoints('${structureKey}')` : 
                                    `showToast('Please generate plot points for previous acts first to maintain causal narrative flow.', 'error')`;
                                
                                return `<button class="${buttonClass}" onclick="${buttonOnClick}" title="${escapedTitle}">
                                    ${actionIcon} ${actionText} Plot Points for Act ${actProgress}
                                </button>`;
                            })()}
                        </div>
                        <button class="btn btn-outline" onclick="previewElementPlotPointsPrompt('${structureKey}')" title="Preview the prompt for plot points generation">
                            🔍 Preview Prompt
                        </button>
                    </div>
                </div>
                <div class="element-description">
                    <p><strong>Purpose:</strong> ${storyAct.description}</p>
                    ${storyAct.character_development ? `<p><strong>Character Development:</strong> ${storyAct.character_development}</p>` : ''}
                </div>
                <div class="creative-direction-section">
                    <div class="creative-direction-controls">
                        <button class="btn btn-sm" 
                                onclick="showPlotPointsCreativeDirectionModal('${structureKey}')"
                                title="Set creative direction for plot points in this act"
                                style="font-size: 0.8rem;">
                            Add creative direction for plot points on act ${actProgress}
                        </button>
                        ${(() => {
                            const plotPointsDirection = getEffectiveCreativeDirection('plotPoints', structureKey);
                            return plotPointsDirection ? `
                                <div class="creative-directions-preview">
                                    <strong>✨ Your Plot Points Direction:</strong> ${plotPointsDirection}
                                </div>
                            ` : `
                                <span class="creative-direction-placeholder">Add creative direction to guide plot points generation for this act</span>
                            `;
                        })()}
                    </div>
                </div>
                <div class="plot-points-container" id="plotPoints-container-${structureKey}">
                    <p class="no-plot-points">No plot points generated yet. Click "Generate Plot Points" to create causal story beats for this act.</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // 🔧 CRITICAL FIX: Sync dropdown values to appState.currentActPlotPoints for persistence
    // But only sync the values that were correctly set from template, not override them
    setTimeout(() => {
        syncDropdownValuesToState();
    }, 100); // Small delay to ensure DOM is fully rendered
    
    // Display any existing plot points that were loaded
    if (appState.plotPoints) {
        Object.entries(appState.plotPoints).forEach(([structureKey, plotPoints]) => {
            displayElementPlotPoints(structureKey, plotPoints);
        });
    }
}

// Load existing plot points from the project
async function loadExistingPlotPoints() {
    if (!appState.projectPath) {
        console.log('No project path available for loading plot points');
        return;
    }
    
    try {
        // 🌐 Use centralized API client with consistent error handling
        if (window.apiClient && appState.user) {
            window.apiClient.setApiKey(appState.apiKey);
            const data = await window.apiClient.loadPlotPoints(appState.projectPath, appState.user.username);
            if (data.plotPoints && Object.keys(data.plotPoints).length > 0) {
                appState.plotPoints = data.plotPoints;
                console.log('✅ Loaded existing plot points via API client:', data.plotPoints);
            }
        } else {
            // Fallback to direct fetch if API client not available
            const response = await fetch(`/api/load-plot-points/${encodeURIComponent(appState.projectPath)}${appState.user ? '?username=' + encodeURIComponent(appState.user.username) : ''}`);
            if (response.ok) {
                const data = await response.json();
                if (data.plotPoints && Object.keys(data.plotPoints).length > 0) {
                    appState.plotPoints = data.plotPoints;
                    console.log('✅ Loaded existing plot points via fallback:', data.plotPoints);
                }
            } else {
                console.log('No existing plot points found');
            }
        }
    } catch (error) {
        console.log('❌ Failed to load existing plot points:', error);
    }
}

// Generate plot points for a specific story act
// 🔧 MOVED TO: public/components/plot-points-generation-manager.js
// Legacy function for backward compatibility
async function generateElementPlotPoints(structureKey) {
    return await plotPointsGenerationManager.generateElementPlotPoints(structureKey);
}

// 🔧 MOVED TO: public/components/plot-points-generation-manager.js
// Legacy function for backward compatibility
function displayElementPlotPoints(structureKey, plotPoints) {
    return plotPointsGenerationManager.displayElementPlotPoints(structureKey, plotPoints);
}

// 🔧 MOVED TO: public/components/plot-points-generation-manager.js
// Legacy function for backward compatibility
async function savePlotPointsContent(structureKey, content) {
    return await plotPointsGenerationManager.savePlotPointsContent(structureKey, content);
}

// 🔧 MOVED TO: public/components/plot-points-generation-manager.js
// Legacy function for backward compatibility
async function regenerateAllPlotPointsForElement(structureKey) {
    return await plotPointsGenerationManager.regenerateAllPlotPointsForElement(structureKey);
}

// 🔧 MOVED TO: public/components/plot-points-generation-manager.js
// Legacy function for backward compatibility
async function regenerateElementPlotPoint(structureKey, plotPointIndex) {
    return await plotPointsGenerationManager.regenerateElementPlotPoint(structureKey, plotPointIndex);
}

// Preview individual plot point regeneration prompt
async function previewIndividualPlotPointPrompt(structureKey, plotPointIndex) {
    if (!appState.generatedStructure || !appState.storyInput || !appState.projectPath) {
        showToast('No structure, story data, or project available for prompt preview.', 'error');
        return;
    }

    if (!appState.plotPoints || !appState.plotPoints[structureKey]) {
        showToast('No plot points found for this act. Please generate plot points first.', 'error');
        return;
    }

    const storyAct = appState.generatedStructure[structureKey];
    const existingPlotPoints = appState.plotPoints[structureKey];
    
    if (!storyAct) {
        showToast('Story act not found.', 'error');
        return;
    }

    try {
        showLoading('Generating individual plot point prompt preview...');
        
        const response = await fetch('/api/preview-individual-plot-point-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectPath: appState.projectPath,
                structureKey: structureKey,
                plotPointIndex: plotPointIndex,
                existingPlotPoints: existingPlotPoints
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the prompt data for the modal
            appState.currentIndividualPlotPointPrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                storyAct: data.storyAct,
                structureKey: structureKey,
                plotPointIndex: plotPointIndex,
                targetPlotPoint: existingPlotPoints[plotPointIndex],
                hierarchicalPrompt: data.hierarchicalPrompt
            };
            
            // Show the individual plot point prompt modal
            showIndividualPlotPointPromptModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate individual plot point prompt preview');
        }
    } catch (error) {
        console.error('Error generating individual plot point prompt preview:', error);
        showToast('Error generating individual plot point prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// ✅ Show individual plot point prompt modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function showIndividualPlotPointPromptModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showIndividualPlotPointPromptModal();
    }
}

// ✅ Hide individual plot point prompt modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function hideIndividualPlotPointPromptModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hideIndividualPlotPointPromptModal();
    }
}

// Preview plot points generation prompt for an element
async function previewElementPlotPointsPrompt(structureKey) {
    if (!appState.generatedStructure || !appState.storyInput || !appState.projectPath) {
        showToast('No structure, story data, or project available for prompt preview.', 'error');
        return;
    }

    const storyAct = appState.generatedStructure[structureKey];
    
    if (!storyAct) {
        showToast('Story act not found.', 'error');
        return;
    }

    try {
        showLoading('Generating plot points prompt preview...');
        
        const response = await fetch('/api/preview-act-plot-points-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                projectPath: appState.projectPath,
                structureKey: structureKey,
                desiredSceneCount: (() => {
                    const plotPointsCountSelect = document.getElementById(`plotPointsCount-${structureKey}`);
                    return plotPointsCountSelect ? parseInt(plotPointsCountSelect.value) : 4;
                })()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Clear any existing plot prompt to avoid conflicts
            appState.currentPlotPrompt = null;
            
            // Store the prompt data for the modal
            appState.currentPlotPointsPrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                storyAct: data.storyAct,
                structureKey: structureKey,
                desiredSceneCount: data.desiredSceneCount,
                hierarchicalPrompt: data.hierarchicalPrompt
            };
            
            // Show the plot points prompt modal
            showPlotPointPromptModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate plot points prompt preview');
        }
    } catch (error) {
        console.error('Error generating plot points prompt preview:', error);
        showToast('Error generating plot points prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// 🔧 MOVED TO: public/components/generation-helper-manager.js
// Legacy function for backward compatibility
function checkPlotPointsCompletion() {
    return generationHelperManager.checkPlotPointsCompletion();
}

// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
async function previewElementScenesPrompt(structureKey) {
    return await sceneGenerationManager.previewElementScenesPrompt(structureKey);
}

// Generate scenes for a specific story act
// 🔧 MOVED TO: public/components/generation-helper-manager.js
// Legacy function for backward compatibility
function hasPlotPointsForElement(structureKey) {
    return generationHelperManager.hasPlotPointsForElement(structureKey);
}

// 🔧 MOVED TO: public/components/generation-helper-manager.js
// Legacy function for backward compatibility
function canGeneratePlotPointsForElement(structureKey) {
    return generationHelperManager.canGeneratePlotPointsForElement(structureKey);
}

// This function has been replaced with proper hierarchical implementation



// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
async function generateAllScenes() {
    return await sceneGenerationManager.generateAllScenes();
}

// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
async function previewAllScenesPrompt() {
    return await sceneGenerationManager.previewAllScenesPrompt();
}

// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
function displayScenes(scenes) {
    return sceneGenerationManager.displayScenes(scenes);
}

// Generate plot points for all scenes with causal connections
async function generateAllPlotPoints() {
    console.log('generateAllPlotPoints() called!');
    
    if (!appState.generatedStructure || !appState.projectPath) {
        showToast('No structure available to generate plot points for.', 'error');
        return;
    }
    
    const structureKeys = Object.keys(appState.generatedStructure);
    
    if (structureKeys.length === 0) {
        showToast('No structural elements found.', 'error');
        return;
    }
    
    try {
        // Start hierarchical progress tracking
        progressTracker.start(structureKeys.length, 'Generating Plot Points', 'acts');
        
        // Generate plot points for each structural element sequentially
        for (let i = 0; i < structureKeys.length; i++) {
            const structureKey = structureKeys[i];
            const actNumber = i + 1;
            
            console.log(`Generating plot points for: ${structureKey}`);
            
            // Update hierarchy display - show current act being processed
            progressTracker.updateHierarchy(actNumber, structureKeys.length);
            
            // Get the desired plot point count from the dropdown (or use default)
            const plotPointsCountSelect = document.getElementById(`plotPointsCount-${structureKey}`);
            const desiredSceneCount = plotPointsCountSelect ? parseInt(plotPointsCountSelect.value) : 4;
            
            const response = await fetch(`/api/generate-plot-points-for-act/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    desiredSceneCount: desiredSceneCount,
                    model: getSelectedModel(),
                    creativeDirections: getRelevantCreativeDirections('plot-points', { structureKey }) // 🚀 OPTIMIZED: Send only relevant creative directions
                }),
                signal: progressTracker.abortController?.signal
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log(`Plot points generated for ${structureKey}:`, data);
                
                // Store plot points in app state
                if (!appState.plotPoints) {
                    appState.plotPoints = {};
                }
                appState.plotPoints[structureKey] = data.plotPoints;
                
                // Display the generated plot points immediately
                displayElementPlotPoints(structureKey, data.plotPoints);
                
                // Update preview with ALL plot points for this act
                if (data.plotPoints && data.plotPoints.length > 0) {
                    data.plotPoints.forEach((plotPoint, index) => {
                        const hierarchicalNumber = `${actNumber}.${index + 1}`;
                        progressTracker.updatePreview(plotPoint, hierarchicalNumber);
                    });
                }
                
                // Increment progress step
                progressTracker.incrementStep(`Generated ${data.plotPoints.length} plot points`);
            } else {
                throw new Error(`Failed to generate plot points for ${structureKey}: ${data.error}`);
            }
        }
        
        progressTracker.finish();
        showToast(`Successfully generated plot points for all ${structureKeys.length} structural elements!`, 'success');
        
        // Update the completion check
        checkPlotPointsCompletion();
        updateGenerateAllPlotPointsButton(); // Update button to show "Regenerate All Plot Points"
        saveToLocalStorage();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Plot points generation cancelled by user');
            return; // Don't show error toast for cancellation
        }
        
        console.error('Error generating all plot points:', error);
        showToast(`Error generating plot points: ${error.message}`, 'error');
        progressTracker.finish();
    }
}

// Generate a plot point for a specific scene
async function generatePlotPoint(structureKey, sceneIndex) {
    if (!appState.projectPath) {
        showToast('No project loaded. Please create or load a project first.', 'error');
        return;
    }
    
    try {
        showLoading(`Generating plot point for Scene ${sceneIndex + 1}...`);
        
        const response = await fetch(`/api/generate-plot-point/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: getSelectedModel()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Individual plot point response:', data);
            console.log(`Looking for scene ${structureKey}[${sceneIndex}]:`, appState.generatedScenes[structureKey]?.[sceneIndex]);
            
            // Update the specific scene with its plot point
            if (appState.generatedScenes[structureKey] && appState.generatedScenes[structureKey][sceneIndex]) {
                console.log(`Setting individual plot point:`, data.plotPoint);
                appState.generatedScenes[structureKey][sceneIndex].plot_point = data.plotPoint;
                console.log('Scene after update:', appState.generatedScenes[structureKey][sceneIndex]);
            } else {
                console.log(`Scene not found for individual plot point: ${structureKey}[${sceneIndex}]`);
            }
            
            // Refresh the display for this structural element
            displayScenesForElement(structureKey, appState.generatedScenes[structureKey]);
            
            showToast(`Plot point generated for Scene ${sceneIndex + 1}!`, 'success');
            saveToLocalStorage();
        } else {
            throw new Error(data.error || 'Failed to generate plot point');
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error generating plot point:', error);
        showToast('Error generating plot point. Please try again.', 'error');
        hideLoading();
    }
}

// Generate a single scene for a specific structural element and scene index
async function generateIndividualScene(structureKey, sceneIndex) {
    if (!appState.projectPath) {
        showToast('No project loaded. Please create or load a project first.', 'error');
        return;
    }
    
    try {
        showLoading(`Regenerating Scene ${sceneIndex + 1}...`);
        
        const response = await fetch(`/api/generate-individual-scene/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
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
            // Update the specific scene in the app state
            if (!appState.generatedScenes) {
                appState.generatedScenes = {};
            }
            if (!appState.generatedScenes[structureKey]) {
                appState.generatedScenes[structureKey] = [];
            }
            
            // Replace the specific scene
            appState.generatedScenes[structureKey][sceneIndex] = data.scene;
            
            // Refresh the display for this structural element
            displayScenesForElement(structureKey, appState.generatedScenes[structureKey]);
            
            showToast(`Scene ${sceneIndex + 1} regenerated successfully!`, 'success');
            saveToLocalStorage();
        } else {
            throw new Error(data.error || 'Failed to generate scene');
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error generating individual scene:', error);
        showToast('Error regenerating scene. Please try again.', 'error');
        hideLoading();
    }
}

// Preview scene generation prompt
async function previewScenePrompt(structureKey, sceneIndex) {
    if (!appState.generatedStructure || !appState.storyInput) {
        showToast('No structure or story data available for prompt preview.', 'error');
        return;
    }

    const structureElement = appState.generatedStructure[structureKey];
    const existingScene = appState.generatedScenes?.[structureKey]?.[sceneIndex];
    
    if (!structureElement) {
        showToast('Structure element not found.', 'error');
        return;
    }

    try {
        showLoading('Generating scene prompt preview...');
        
        const response = await fetch('/api/preview-scene-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                structureElement: structureElement,
                existingScene: existingScene,
                sceneIndex: sceneIndex,
                sceneCount: 3,
                projectPath: appState.projectPath // Include project path for hierarchical context
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the prompt data for the modal
            appState.currentScenePrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                structureElement: data.structureElement,
                sceneIndex: sceneIndex,
                structureKey: structureKey
            };
            
            // Show the scene prompt modal
            showScenePromptModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate scene prompt preview');
        }
    } catch (error) {
        console.error('Error generating scene prompt preview:', error);
        showToast('Error generating scene prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// Preview plot point generation prompt
async function previewPlotPointPrompt(structureKey, sceneIndex) {
    if (!appState.generatedStructure || !appState.storyInput || !appState.generatedScenes) {
        showToast('No structure, story data, or scenes available for prompt preview.', 'error');
        return;
    }

    const structureElement = appState.generatedStructure[structureKey];
    const targetScene = appState.generatedScenes[structureKey]?.[sceneIndex];
    
    if (!structureElement || !targetScene) {
        showToast('Structure element or scene not found.', 'error');
        return;
    }

    // Build all scenes array for context
    const allScenes = [];
    Object.entries(appState.generatedScenes).forEach(([key, scenes]) => {
        if (Array.isArray(scenes)) {
            scenes.forEach((scene, index) => {
                allScenes.push({
                    title: scene.title || scene.name || 'Untitled Scene',
                    description: scene.description || '',
                    location: scene.location || '',
                    structureElement: appState.generatedStructure[key]?.name || key,
                    isTarget: key === structureKey && index === sceneIndex
                });
            });
        }
    });

    try {
        showLoading('Generating plot point prompt preview...');
        
        const response = await fetch('/api/preview-plot-point-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                allScenes: allScenes,
                targetScene: targetScene,
                sceneIndex: allScenes.findIndex(scene => scene.isTarget),
                structureElement: structureElement
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the prompt data for the modal
            appState.currentPlotPrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                targetScene: data.targetScene,
                sceneIndex: data.sceneIndex,
                structureKey: structureKey,
                actualSceneIndex: sceneIndex
            };
            
            // Show the plot point prompt modal
            showPlotPointPromptModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate plot point prompt preview');
        }
    } catch (error) {
        console.error('Error generating plot point prompt preview:', error);
        showToast('Error generating plot point prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// ✅ Project Header Management - MOVED TO components/ui-manager.js
// Legacy functions for backward compatibility
function showProjectHeader(projectData) {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showProjectHeader(projectData);
    }
}

function hideProjectHeader() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hideProjectHeader();
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function getCurrentStep() {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.getCurrentStep();
    }
    return 1;
}

function saveProject() {
    // Trigger project save if there's data to save
    if (appState.generatedStructure && appState.storyInput) {
        showToast('Project auto-saves after each step. Manual save coming soon!', 'info');
    } else {
        showToast('No project data to save yet.', 'error');
    }
}

// Simple scene distribution (kept for compatibility)
async function regenerateScenes(method = 'simple') {
    if (!appState.generatedStructure || !appState.projectPath) {
        showToast('No structure or project to regenerate scenes for.', 'error');
        return;
    }
    
    try {
        showLoading('Generating simple scene distribution...');
        
        const response = await fetch(`/api/regenerate-scenes-simple/${appState.projectPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Convert the scenes format to the format expected by displayScenes
            const convertedScenes = {};
            Object.entries(data.scenes).forEach(([key, value]) => {
                convertedScenes[key] = value.scenes; // Extract the scenes array from the nested structure
            });
            
            appState.generatedScenes = convertedScenes;
            displayScenes(convertedScenes);
            
            // Count total scenes for display
            const totalScenes = Object.values(convertedScenes).reduce((total, scenes) => total + scenes.length, 0);
            showToast(`Simple scenes generated successfully! (${totalScenes} scenes)`, 'success');
        } else {
            throw new Error(data.error || 'Failed to regenerate scenes');
        }
        
        hideLoading();
        saveToLocalStorage();
    } catch (error) {
        console.error('Error regenerating scenes:', error);
        showToast('Error regenerating scenes. Please try again.', 'error');
        hideLoading();
    }
}

// MOVED TO dialogue-generation-manager.js - Legacy compatibility wrapper will be loaded from component

// 🔧 MOVED TO: public/components/generation-helper-manager.js
// Legacy function for backward compatibility
function calculateHierarchicalSceneNumber(structureKey, sceneIndex, scene) {
    return generationHelperManager.calculateHierarchicalSceneNumber(structureKey, sceneIndex, scene);
}

// MOVED TO dialogue-generation-manager.js - Legacy compatibility wrapper will be loaded from component
// MOVED TO dialogue-generation-manager.js - Legacy compatibility wrapper will be loaded from component
// MOVED TO dialogue-generation-manager.js - Legacy compatibility wrapper will be loaded from component
function displayHierarchicalDialogueContent_MOVED_TO_COMPONENT(structureKey, plotPoints, sceneGroup, actNumber) {
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
        displayDialogueScenesFlat(structureKey, sceneGroup, flatContainer);
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
        
        // Compact plot point header
        const plotPointHeader = document.createElement('div');
        plotPointHeader.className = 'dialogue-plot-point-header compact';
        
        // Determine if we should show the generate button
        const hasScenesForButton = plotPointScenes.length > 0;
        
        // Check if dialogue already exists for any scenes in this plot point
        const hasExistingDialogueForPlotPoint = hasScenesForButton && plotPointScenes.some(scene => {
            const globalSceneIndex = hasScenes ? sceneGroup.indexOf(scene) : -1;
            const sceneId = `${structureKey}-${globalSceneIndex}`;
            return appState.generatedDialogues && appState.generatedDialogues[sceneId];
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
            plotPointScenes.forEach((scene, sceneIndex) => {
                const sceneNumber = `${plotPointNumber}.${sceneIndex + 1}`;
                const globalSceneIndex = hasScenes ? sceneGroup.indexOf(scene) : -1;
                const sceneId = `${structureKey}-${globalSceneIndex}`;
                
                const sceneElement = document.createElement('div');
                sceneElement.className = 'hierarchical-dialogue-scene';
                sceneElement.id = `dialogue-scene-${structureKey}-${plotPointIndex}-${sceneIndex}`;
                
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
                        await saveDialogueContent(structureKey, globalSceneIndex, newContent);
                        
                        // Update the app state
                        if (!appState.generatedDialogues) {
                            appState.generatedDialogues = {};
                        }
                        appState.generatedDialogues[sceneId] = newContent;
                        
                        // Save to local storage
                        saveToLocalStorage();
                    }
                });
                
                scenesContainer.appendChild(sceneElement);
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
        container.appendChild(plotPointElement);
    });
}

// Fallback function for displaying dialogue scenes without hierarchical structure
function displayDialogueScenesFlat(structureKey, sceneGroup, container) {
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
                await saveDialogueContent(structureKey, index, newContent);
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

function displayDialogueGeneration() {
    const container = document.getElementById('dialogueContent');
    container.innerHTML = '';

    if (appState.generatedStructure && appState.generatedScenes) {
        console.log('Displaying dialogue with hierarchical structure:', appState.generatedStructure);
        
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
            
            console.log(`Processing dialogue for ${structureKey}: hasScenes=${hasScenes}, sceneCount=${sceneCount}, hasPlotPoints=${hasPlotPoints}`);
            
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
            
            console.log(`Appending dialogue group element for ${structureKey} to container`);
            container.appendChild(groupElement);
            
            // Always display hierarchical dialogue content (even if empty)
            console.log(`Displaying hierarchical dialogue content for ${structureKey}: ${plotPoints?.length || 0} plot points, ${sceneCount} scenes`);
            displayHierarchicalDialogueContent(structureKey, plotPoints, sceneGroup, currentActIndex + 1);
        });
        
        console.log('Finished creating all dialogue groups');
    } else {
        console.log('No structure/scenes available - showing fallback message');
        container.innerHTML = '<p>No scenes available for dialogue generation. Please complete Steps 1-5 first.</p>';
    }

    // Handle any pending dialogue restoration from page reload
    if (appState.pendingDialogueRestore) {
        console.log('Processing pending dialogue restoration:', appState.pendingDialogueRestore);
        
        // Merge pending dialogue into current state if not already present
        Object.entries(appState.pendingDialogueRestore).forEach(([dialogueKey, dialogue]) => {
            if (!appState.generatedDialogues[dialogueKey]) {
                appState.generatedDialogues[dialogueKey] = dialogue;
                console.log(`Restored dialogue for: ${dialogueKey}`);
            }
        });
        
        // Clear the pending restoration
        delete appState.pendingDialogueRestore;
        
        // Refresh the dialogue display to show restored content
        setTimeout(() => {
            displayDialogueGeneration();
        }, 100);
    }
    
    console.log('Hierarchical dialogue interface displayed with existing content restored');
}

// Helper function to generate dialogue for all scenes in a specific act
async function generateDialogueForPlotPoint(structureKey, plotPointIndex) {
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
                await generateDialogue(structureKey, globalSceneIndex);
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

async function generateAllDialogueForAct(structureKey) {
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
            await generateDialogue(structureKey, globalSceneIndex + i);
        }
        
        hideLoading();
        showToast(`Successfully generated dialogue for all scenes in ${structureKey}!`, 'success');
    } catch (error) {
        console.error(`Error generating dialogue for ${structureKey}:`, error);
        showToast(`Error generating dialogue for ${structureKey}. Please try again.`, 'error');
        hideLoading();
    }
}

// Helper function to preview dialogue prompts for all scenes in a specific act
async function previewAllDialoguePromptsForAct(structureKey) {
    const sceneGroup = appState.generatedScenes[structureKey];
    if (!sceneGroup || !Array.isArray(sceneGroup) || sceneGroup.length === 0) {
        showToast(`No scenes available in ${structureKey} for dialogue preview.`, 'error');
        return;
    }
    
    // For now, just preview the first scene's prompt with a note about the act
    showToast(`Dialogue prompt preview for individual scenes coming soon! Use the scene-level preview buttons for now.`, 'info');
}

// Save dialogue content function
async function saveDialogueContent(structureKey, sceneIndex, content) {
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

// Generate dialogue for a specific scene
async function generateDialogue(structureKey, sceneIndex) {
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
        saveToLocalStorage();
    } catch (error) {
        console.error('Error generating dialogue:', error);
        showToast('Error generating dialogue. Please try again.', 'error');
        hideLoading();
    }
}

// MOVED TO dialogue-generation-manager.js - Legacy compatibility wrapper will be loaded from component

// MOVED TO dialogue-generation-manager.js - Legacy compatibility wrapper will be loaded from component

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function finalizeScript() {
    return window.scriptAssemblyManagerInstance.finalizeScript();
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function assembleScript() {
    return window.scriptAssemblyManagerInstance.assembleScript();
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function generateTitlePage() {
    return window.scriptAssemblyManagerInstance.generateTitlePage();
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function formatSceneForScreenplay(dialogue, sceneNumber) {
    return window.scriptAssemblyManagerInstance.formatSceneForScreenplay(dialogue, sceneNumber);
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function formatPlaceholderScene(scene, sceneNumber) {
    return window.scriptAssemblyManagerInstance.formatPlaceholderScene(scene, sceneNumber);
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber) {
    return window.scriptAssemblyManagerInstance.formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber);
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function formatActFallback(act, actKey, sceneNumber) {
    return window.scriptAssemblyManagerInstance.formatActFallback(act, actKey, sceneNumber);
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
async function exportScript(format = 'text') {
    return await window.scriptAssemblyManagerInstance.exportScript(format);
}

// Save project
// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
async function saveProject() {
    return await window.projectManagerInstance.saveProject();
}

// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function downloadFile(content, filename, contentType) {
    return window.scriptAssemblyManagerInstance.downloadFile(content, filename, contentType);
}

// 🔧 EXTRACTED TO: components/progress-tracker.js
// Functions moved: forceGoToStep, goToStep, goToStepInternal, canNavigateToStep, isStepFullyComplete, handleStepClick

// 🔧 EXTRACTED TO: components/progress-tracker.js
// Functions moved: updateProgressBar, updateStepIndicators, updateAllProgressMeters, updateStepHeaderProgressMeter, startOver

// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
async function newProject() {
    return await window.projectManagerInstance.newProject();
}

// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
function clearAllContentContainers() {
    return window.projectManagerInstance.clearAllContentContainers();
}

// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
function startFreshProject() {
    return window.projectManagerInstance.startFreshProject();
}

// Enhanced hierarchical progress tracking system
const progressTracker = {
    isActive: false,
    totalSteps: 0,
    currentStep: 0,
    hierarchy: {},
    abortController: null,
    
    start(totalSteps, title = 'Generating...', unitName = 'operations') {
        this.isActive = true;
        this.totalSteps = totalSteps;
        this.currentStep = 0;
        this.hierarchy = {};
        this.unitName = unitName;
        this.abortController = new AbortController();
        this.showEnhancedLoading(title);
    },
    
    updateHierarchy(level1, level1Total, level2 = null, level2Total = null, level3 = null, level3Total = null) {
        this.hierarchy = {
            level1: { current: level1, total: level1Total },
            level2: level2 !== null ? { current: level2, total: level2Total } : null,
            level3: level3 !== null ? { current: level3, total: level3Total } : null
        };
        this.updateProgressDisplay();
    },
    
    incrementStep(description = '') {
        this.currentStep++;
        this.updateProgressDisplay(description);
    },
    
    updateProgressDisplay(description = '') {
        if (!this.isActive) return;
        
        // Build hierarchical progress string
        let hierarchyText = '';
        if (this.hierarchy.level1) {
            hierarchyText += `Processing Act ${this.hierarchy.level1.current} of ${this.hierarchy.level1.total}`;
            
            if (this.hierarchy.level2) {
                hierarchyText += ` - Plot Point ${this.hierarchy.level2.current}/${this.hierarchy.level2.total}`;
                
                if (this.hierarchy.level3) {
                    hierarchyText += ` - Scene ${this.hierarchy.level3.current}/${this.hierarchy.level3.total}`;
                }
            }
        }
        
        const progressText = hierarchyText || `Step ${this.currentStep}/${this.totalSteps}`;
        const fullMessage = description ? `${progressText}: ${description}` : progressText;
        
        // Update the progress display - target the correct elements in the loadingOverlay
        const progressTextElement = document.querySelector('.hierarchical-progress .progress-text');
        const progressBarElement = document.querySelector('.hierarchical-progress .progress-bar');
        const progressDetailsElement = document.querySelector('.hierarchical-progress .progress-details');
        
        if (progressTextElement) {
            progressTextElement.textContent = fullMessage;
        }
        
        if (progressBarElement) {
            progressBarElement.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        }
        
        if (progressDetailsElement) {
            progressDetailsElement.textContent = `${this.currentStep}/${this.totalSteps} ${this.unitName} completed`;
        }
    },
    
    updatePreview(content, label = 'Latest') {
        if (!this.isActive || !content) return;
        
        const previewElement = document.querySelector('.progress-preview');
        const previewContentElement = document.querySelector('.preview-content');
        const previewLabelElement = document.querySelector('.preview-label');
        
        if (previewElement && previewContentElement) {
            // First time setup
            if (previewContentElement.textContent === '') {
                if (previewLabelElement) {
                    previewLabelElement.textContent = 'Generated Content:';
                }
                previewElement.style.display = 'block';
            }
            
            // Create a new entry with separator
            const newEntry = document.createElement('div');
            newEntry.style.cssText = 'margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.2);';
            
            const entryLabel = document.createElement('div');
            entryLabel.style.cssText = 'font-weight: 600; font-size: 10px; color: rgba(255, 255, 255, 0.6); margin-bottom: 4px; text-transform: uppercase;';
            entryLabel.textContent = label;
            
            const entryContent = document.createElement('div');
            entryContent.style.cssText = 'white-space: pre-wrap; word-wrap: break-word;';
            entryContent.textContent = content;
            
            newEntry.appendChild(entryLabel);
            newEntry.appendChild(entryContent);
            
            // Append to the content area
            previewContentElement.appendChild(newEntry);
            
            // Auto-scroll to bottom to show latest content
            previewElement.scrollTop = previewElement.scrollHeight;
        }
    },
    
    showEnhancedLoading(title) {
        // Target the loading overlay container instead of the p element
        if (!elements.loadingOverlay) {
            console.error('loadingOverlay element not found');
            return;
        }
        
        elements.loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="hierarchical-progress">
                <div class="progress-text">${title}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
                <div class="progress-details">0/${this.totalSteps} ${this.unitName} completed</div>
                <div class="progress-preview" style="margin-top: 12px; padding: 12px 16px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; max-height: 200px; overflow-y: auto; font-size: 12px; line-height: 1.4; color: rgba(255, 255, 255, 0.95); display: none; white-space: pre-wrap; word-wrap: break-word;">
                    <div class="preview-label" style="font-weight: 600; margin-bottom: 8px; color: rgba(255, 255, 255, 0.7);">Generated Content:</div>
                    <div class="preview-content"></div>
                </div>
                <div class="progress-actions" style="margin-top: 16px; display: flex; justify-content: center;">
                    <button onclick="progressTracker.cancel()" style="background: rgba(239, 68, 68, 0.9) !important; color: white !important; border: none !important; padding: 8px 16px !important; border-radius: 6px !important; font-size: 13px !important; font-weight: 500 !important; cursor: pointer !important; transition: all 0.2s ease !important;">Cancel Generation</button>
                </div>
            </div>
        `;
        elements.loadingOverlay.classList.add('active');
    },
    
    cancel() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isActive = false;
        this.hierarchy = {};
        this.abortController = null;
        
        // Clear preview content when cancelling
        const previewContentElement = document.querySelector('.preview-content');
        if (previewContentElement) {
            previewContentElement.innerHTML = '';
        }
        
        hideLoading();
        showToast('Generation cancelled by user', 'info');
    },
    
    finish() {
        this.isActive = false;
        this.hierarchy = {};
        this.abortController = null;
        
        // Clear preview content for next generation
        const previewContentElement = document.querySelector('.preview-content');
        if (previewContentElement) {
            previewContentElement.innerHTML = '';
        }
        
        hideLoading();
    }
};

// ✅ Loading functions - MOVED TO components/ui-manager.js
// Legacy functions for backward compatibility
function showLoading(message = 'Loading...') {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showLoading(message);
    }
}

function hideLoading() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hideLoading();
    }
}

// ✅ Toast notification functions - MOVED TO components/ui-manager.js
// Legacy functions for backward compatibility
function showToast(message, type = 'success') {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showToast(message, type);
    }
}

function hideToast() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hideToast();
    }
}

// 🔧 Creative Direction Functions moved to components/creative-direction-manager.js
// Legacy compatibility functions are provided by the component

// Normalize generated scenes data structure
// 🔧 MOVED TO: public/components/generation-helper-manager.js
// Legacy function for backward compatibility
function normalizeGeneratedScenes(scenesData) {
    return generationHelperManager.normalizeGeneratedScenes(scenesData);
}

// 🔧 MOVED TO: public/components/generation-helper-manager.js
// Legacy function for backward compatibility
function normalizeGeneratedDialogues(dialoguesData) {
    return generationHelperManager.normalizeGeneratedDialogues(dialoguesData);
}

// ✅ Save to localStorage - MOVED TO components/app-state-manager.js
// Legacy function for backward compatibility
function saveToLocalStorage() {
    if (window.appStateManagerInstance) {
        window.appStateManagerInstance.saveToLocalStorage();
    }
}

// Load Project Modal Functions
// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
async function showLoadProjectModal() {
    return await window.projectManagerInstance.showLoadProjectModal();
}

// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
function hideLoadProjectModal() {
    return window.projectManagerInstance.hideLoadProjectModal();
}

// ✅ MOVED TO: components/project-manager.js
// Legacy function for backward compatibility
async function loadProject(projectPath) {
    return await window.projectManagerInstance.loadProject(projectPath);
}

// 🔧 MOVED TO: public/components/project-manager.js
// Legacy function for backward compatibility
async function populateFormWithProject(projectData, showToastMessage = true, isRestore = false) {
    return await window.projectManagerInstance.populateFormWithProject(projectData, showToastMessage, isRestore);
}

// ✅ Show scene prompt modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function showScenePromptModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showScenePromptModal();
    }
}

// ✅ Hide scene prompt modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function hideScenePromptModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hideScenePromptModal();
    }
}

// ✅ Show plot point prompt modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function showPlotPointPromptModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.showPlotPointPromptModal();
    }
}

// ✅ Hide plot point prompt modal - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function hidePlotPointPromptModal() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.hidePlotPointPromptModal();
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
async function previewAllPlotPointsPrompt() {
    if (window.navigationWorkflowManager) {
        return await window.navigationWorkflowManager.previewAllPlotPointsPrompt();
    }
}

// 🔧 MOVED TO: public/components/project-manager.js
// Legacy function for backward compatibility
async function deleteProject(projectPath, projectTitle) {
    return await window.projectManagerInstance.deleteProject(projectPath, projectTitle);
}

// 🔧 MOVED TO: public/components/project-manager.js
// Legacy function for backward compatibility
async function duplicateProject(projectPath, projectTitle) {
    return await window.projectManagerInstance.duplicateProject(projectPath, projectTitle);
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showToast('An unexpected error occurred. Please try again.', 'error');
});

// API error handling
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showToast('Network error. Please check your connection.', 'error');
});

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('loadProjectModal');
    if (e.target === modal) {
        hideLoadProjectModal();
    }
});

// Display scenes for a specific structural element
// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function displayScenesForElement(structureKey, sceneGroup, customContainer = null) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.displayScenesForElement(structureKey, sceneGroup, customContainer);
    }
}

// Save scene content function
// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
async function saveSceneContent(structureKey, sceneIndex, content) {
    return await sceneGenerationManager.saveSceneContent(structureKey, sceneIndex, content);
}

// ✅ Continue to next step after template selection - MOVED TO components/ui-manager.js
// Legacy function for backward compatibility
function goToNextStep() {
    if (window.uiManagerInstance) {
        return window.uiManagerInstance.goToNextStep();
    }
}

// Display selected template on Acts page
// ✅ Display selected template - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function displaySelectedTemplate(templateData) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.displaySelectedTemplate(templateData);
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
async function displayTemplateStructurePreview() {
    if (window.navigationWorkflowManager) {
        return await window.navigationWorkflowManager.displayTemplateStructurePreview();
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
async function getTemplateDataFromExistingTemplates(templateId) {
    if (window.navigationWorkflowManager) {
        return await window.navigationWorkflowManager.getTemplateDataFromExistingTemplates(templateId);
    }
    return null;
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
async function createSimpleTemplatePreview() {
    if (window.navigationWorkflowManager) {
        return await window.navigationWorkflowManager.createSimpleTemplatePreview();
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function createFullTemplatePreview(templateData, structureContainer) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.createFullTemplatePreview(templateData, structureContainer);
    }
}

// Basic fallback preview when no template data is available
function createBasicTemplatePreview(structureContainer) {
    // Clear existing content
    structureContainer.innerHTML = '';
    
    // Add preview header
    const previewHeader = document.createElement('div');
    previewHeader.className = 'structure-preview-header';
    previewHeader.innerHTML = `
        <h3>Template Structure Preview</h3>
        <p class="structure-preview-description">Selected template: ${appState.selectedTemplate || 'Unknown'}</p>
    `;
    structureContainer.appendChild(previewHeader);
    
    // Add a simple placeholder
    const placeholderElement = document.createElement('div');
    placeholderElement.className = 'structure-element preview-mode';
    placeholderElement.innerHTML = `
        <div class="structure-element-header">
            <h3>Story Structure</h3>
            <div class="structure-element-meta">
                <span class="preview-status">Ready for generation</span>
            </div>
        </div>
        <div class="structure-element-content">
            <div class="template-description">
                <strong>Template:</strong> ${appState.selectedTemplate || 'Unknown template'} structure will be generated based on your story.
            </div>
            <div class="content-placeholder">
                <div class="placeholder-content">
                    <span class="placeholder-icon">🎬</span>
                    <span class="placeholder-text">Click "Generate Acts" to create your story structure</span>
                </div>
            </div>
        </div>
    `;
    
    structureContainer.appendChild(placeholderElement);
}

// Preview dialogue generation prompt
async function previewDialoguePrompt(structureKey, sceneIndex) {
    if (!appState.generatedScenes || !appState.storyInput) {
        showToast('No scenes or story data available for prompt preview.', 'error');
        return;
    }

    const scene = appState.generatedScenes[structureKey]?.[sceneIndex];
    
    if (!scene) {
        showToast('Scene not found.', 'error');
        return;
    }

    try {
        showLoading('Generating dialogue prompt preview...');
        
        const response = await fetch('/api/preview-dialogue-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                scene: scene,
                storyInput: appState.storyInput,
                context: `This scene is part of the ${structureKey.replace(/_/g, ' ')} section of the story.`,
                projectPath: appState.projectPath,
                structureKey: Object.keys(appState.generatedStructure).indexOf(structureKey),
                sceneIndex: sceneIndex
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the prompt data for the modal
            appState.currentDialoguePrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                scene: data.scene,
                structureKey: structureKey,
                sceneIndex: sceneIndex,
                hierarchicalPrompt: data.hierarchicalPrompt
            };
            
            // Show the dialogue prompt modal
            showDialoguePromptModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate dialogue prompt preview');
        }
    } catch (error) {
        console.error('Error generating dialogue prompt preview:', error);
        showToast('Error generating dialogue prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// Show dialogue prompt modal
function showDialoguePromptModal() {
    const modal = document.getElementById('dialoguePromptModal');
    const prompt = appState.currentDialoguePrompt;
    
    if (!prompt) {
        showToast('No dialogue prompt data available.', 'error');
        return;
    }
    
    // Populate modal content
    document.getElementById('dialoguePromptSystemMessage').textContent = prompt.systemMessage;
    document.getElementById('dialoguePromptUserPrompt').textContent = prompt.userPrompt;
    
    // Update modal title
    const modalTitle = document.querySelector('#dialoguePromptModal .modal-header h3');
    
    if (prompt.previewNote) {
        // This is for "Generate All Dialogue" preview
        modalTitle.textContent = 'All Dialogue Generation Prompt Preview';
        
        // Add or update preview note
        let previewNoteElement = document.getElementById('dialoguePromptPreviewNote');
        if (!previewNoteElement) {
            previewNoteElement = document.createElement('div');
            previewNoteElement.id = 'dialoguePromptPreviewNote';
            previewNoteElement.className = 'prompt-preview-note';
            previewNoteElement.style.cssText = 'background: #e8f5e8; border: 1px solid #4caf50; border-radius: 4px; padding: 10px; margin-bottom: 15px; font-size: 0.9rem; color: #2e7d32;';
            
            const modalBody = document.querySelector('#dialoguePromptModal .modal-body');
            modalBody.insertBefore(previewNoteElement, modalBody.firstChild);
        }
        previewNoteElement.textContent = `ℹ️ ${prompt.previewNote}`;
        previewNoteElement.style.display = 'block';
    } else {
        // This is for individual dialogue prompt
        const sceneName = prompt.scene?.title || prompt.scene?.name || 'Untitled Scene';
        modalTitle.textContent = `Dialogue Generation Prompt - ${sceneName}`;
        
        // Hide preview note if it exists
        const previewNoteElement = document.getElementById('dialoguePromptPreviewNote');
        if (previewNoteElement) {
            previewNoteElement.style.display = 'none';
        }
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Hide dialogue prompt modal
function hideDialoguePromptModal() {
    document.getElementById('dialoguePromptModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Character Management System
// Note: projectCharacters and editingCharacterIndex are declared globally at the top of the file

// ✅ Character management functions - MOVED TO components/character-manager.js
// Legacy references maintained for backward compatibility

// Character form submission - MOVED TO components/character-manager.js



// Character validation and prompt functions - MOVED TO components/character-manager.js

// Character modal handlers and initialization - MOVED TO components/character-manager.js

// Global auth utilities for testing and debugging
window.authUtils = {
    switchUser: (username, userData, apiKey) => {
        // For testing: manually switch to a different user
        // 🔧 PRESERVE USER PREFERENCES during test user switching
        const preservedModel = window.appState?.selectedModel;
        
        localStorage.setItem('apiKey', apiKey);
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.removeItem('filmScriptGenerator'); // Clear old state
        
        // 🔧 SAVE PRESERVED MODEL SELECTION back to localStorage
        if (preservedModel) {
            try {
                localStorage.setItem('filmScriptGenerator', JSON.stringify({
                    selectedModel: preservedModel
                }));
                console.log('💾 Preserved model selection during user switch:', preservedModel);
            } catch (error) {
                console.error('Error saving preserved model during user switch:', error);
            }
        }
        
        authManager.checkAuthStatus();
        authManager.updateUI();
        window.location.reload(); // Reload to ensure clean state
    },
    clearAllData: () => {
        // For testing: completely clear all stored data
        localStorage.clear();
        authManager.resetAppState();
        authManager.updateUI();
        window.location.reload();
    },
    getCurrentUser: () => appState.user,
    isAuthenticated: () => appState.isAuthenticated
};

// ✅ Auto-Save Manager - MOVED TO components/app-state-manager.js
// Legacy reference for backward compatibility
const autoSaveManager = window.autoSaveManager || {
    init: () => console.log('AutoSaveManager not available'),
    markDirty: () => {},
    saveImmediately: () => Promise.resolve(),
    hasProjectData: () => false,
    destroy: () => {}
};

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function calculateProjectCardProgress(project) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.calculateProjectCardProgress(project);
    }
    return 0;
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function generateProjectCard(project, context = 'modal') {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.generateProjectCard(project, context);
    }
    return '';
}

// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
async function generateScenesForElement(structureKey) {
    return await sceneGenerationManager.generateScenesForElement(structureKey);
}

// Display hierarchical content: Act -> Plot Points -> Scenes
function displayHierarchicalContent(structureKey, plotPoints, sceneGroup, actNumber) {
    const container = document.getElementById(`hierarchical-content-${structureKey}`);
    if (!container) return;
    
    // Clear any existing content
    container.innerHTML = '';
    
    const hasPlotPoints = hasPlotPointsForElement(structureKey);
    const hasScenes = sceneGroup && Array.isArray(sceneGroup) && sceneGroup.length > 0;
    
    if (!hasPlotPoints && !hasScenes) {
        container.innerHTML = '<p class="no-content">No plot points or scenes generated yet.</p>';
        return;
    }
    
    if (!hasPlotPoints && hasScenes) {
        // Fallback: show scenes without plot point structure
        container.innerHTML = `
            <div class="scenes-fallback">
                <h4>⚠️ Scenes (Generated without plot points)</h4>
                <p class="warning-text">These scenes were generated without the hierarchical plot point structure. Consider regenerating with plot points for better organization.</p>
                <div class="flat-scenes-container"></div>
            </div>
        `;
        const flatContainer = container.querySelector('.flat-scenes-container');
        displayScenesForElement(structureKey, sceneGroup, flatContainer);
        return;
    }
    
    // Create hierarchical structure: Plot Points -> Scenes
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
        plotPointElement.className = 'hierarchical-plot-point';
        plotPointElement.id = `plot-point-${structureKey}-${plotPointIndex}`;
        
        // Plot point header
        const plotPointHeader = document.createElement('div');
        plotPointHeader.className = 'plot-point-header';
        
        // Check for creative directions for this plot point
        const scenesKey = `${structureKey}_${plotPointIndex}`;
        const scenesDirection = getEffectiveCreativeDirection('scenes', scenesKey);
        
        plotPointHeader.innerHTML = `
            <!-- Plot Point Number Header with Generation Controls -->
            <div class="plot-point-header-row">
                <div class="plot-point-number-section">
                    <span class="plot-point-number-badge">${plotPointNumber}</span>
                    <span class="plot-point-label">Plot Point</span>
                    <span class="scene-count">${plotPointScenes.length} scene${plotPointScenes.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="plot-point-controls">
                    <button class="btn btn-primary btn-sm generate-scenes-btn" onclick="generateScenesForPlotPoint('${structureKey}', ${plotPointIndex})" title="${plotPointScenes.length > 0 ? 'Regenerate' : 'Generate'} scenes for this specific plot point">
                        ${plotPointScenes.length > 0 ? '🔄 Regenerate' : '🎬 Generate'} Scenes for Plot Point ${plotPointNumber}
                    </button>
                </div>
            </div>
            
            <!-- Plot Point Description (own line, truncated if too long) -->
            <div class="plot-point-description-section">
                <div class="plot-point-text" title="${plotPoint}">
                    ${plotPoint.length > 250 ? plotPoint.substring(0, 250) + '...' : plotPoint}
                </div>
            </div>
            
            <!-- Creative Direction Section (dedicated row) -->
            <div class="creative-direction-section">
                <div class="creative-direction-controls">
                    <button class="btn btn-outline btn-sm" 
                            onclick="showScenesCreativeDirectionModal('${structureKey}', ${plotPointIndex})"
                            title="Set creative direction for scenes in this plot point"
                            style="font-size: 0.8rem;">
                        Add creative direction for scenes on plot point ${plotPointNumber}
                    </button>
                    ${scenesDirection ? `
                        <div class="creative-directions-preview">
                            <strong>✨ Your Scenes Direction:</strong> ${scenesDirection}
                        </div>
                    ` : `
                        <span class="creative-direction-placeholder">Add creative direction to guide scene generation for this plot point</span>
                    `}
                </div>
            </div>
        `;
        
        plotPointElement.appendChild(plotPointHeader);
        
        // Scenes container for this plot point
        const scenesContainer = document.createElement('div');
        scenesContainer.className = 'plot-point-scenes';
        scenesContainer.id = `scenes-${structureKey}-${plotPointIndex}`;
        
        if (plotPointScenes.length > 0) {
            // Display scenes for this plot point
            plotPointScenes.forEach((scene, sceneIndex) => {
                const sceneNumber = `${plotPointNumber}.${sceneIndex + 1}`;
                const globalSceneIndex = hasScenes ? sceneGroup.indexOf(scene) : -1;
                
                const sceneElement = document.createElement('div');
                sceneElement.className = 'hierarchical-scene';
                sceneElement.id = `scene-${structureKey}-${plotPointIndex}-${sceneIndex}`;
                
                // Scene header
                const sceneHeader = document.createElement('div');
                sceneHeader.className = 'scene-header';
                sceneHeader.innerHTML = `
                    <h5 class="scene-title">
                        <span class="scene-number">${sceneNumber}</span>
                        <span class="scene-name">${scene.title || scene.name || 'Untitled Scene'}</span>
                    </h5>
                `;
                
                sceneElement.appendChild(sceneHeader);
                
                // Scene content (editable)
                const sceneContent = JSON.stringify(scene);
                const sceneContentContainer = document.createElement('div');
                sceneContentContainer.className = 'scene-content-container';
                sceneElement.appendChild(sceneContentContainer);
                
                // Create editable content block for the scene
                createEditableContentBlock({
                    id: `hierarchical-scene-${structureKey}-${plotPointIndex}-${sceneIndex}`,
                    type: 'scenes',
                    title: '', // Title already shown in header
                    content: sceneContent,
                    container: sceneContentContainer,
                    hideTitle: true, // Don't show duplicate title
                    metadata: { structureKey: structureKey, sceneIndex: globalSceneIndex, plotPointIndex: plotPointIndex },
                    onSave: async (newContent, block) => {
                        // Save the edited scene content
                        await saveSceneContent(structureKey, globalSceneIndex, newContent);
                        
                        // Update the app state
                        let updatedScene;
                        try {
                            updatedScene = JSON.parse(newContent);
                        } catch (e) {
                            // If not valid JSON, update description
                            updatedScene = { ...scene, description: newContent };
                        }
                        
                        if (appState.generatedScenes && appState.generatedScenes[structureKey] && appState.generatedScenes[structureKey][globalSceneIndex]) {
                            appState.generatedScenes[structureKey][globalSceneIndex] = { ...appState.generatedScenes[structureKey][globalSceneIndex], ...updatedScene };
                        }
                        
                        // Save to local storage
                        saveToLocalStorage();
                    }
                });
                
                scenesContainer.appendChild(sceneElement);
            });
        } else {
            // No scenes for this plot point yet
            scenesContainer.innerHTML = `
                <div class="no-scenes-for-plot-point">
                    <p class="placeholder-text">No scenes generated for this plot point yet.</p>
                </div>
            `;
        }
        
        plotPointElement.appendChild(scenesContainer);
        container.appendChild(plotPointElement);
    });
}

// 🔧 MOVED TO: public/components/scene-generation-manager.js
// Legacy function for backward compatibility
async function generateScenesForPlotPoint(structureKey, plotPointIndex) {
    return await sceneGenerationManager.generateScenesForPlotPoint(structureKey, plotPointIndex);
}

// Compact Screenplay Calculator - Simple, encapsulated functionality
function initializeCompactCalculator() {
    const totalScenesInput = document.getElementById('totalScenes');
    const estimatesContainer = document.getElementById('screenplayEstimates');
    
    console.log('🔥 CALCULATOR INIT:', { 
        totalScenesInput: !!totalScenesInput, 
        estimatesContainer: !!estimatesContainer,
        currentValue: totalScenesInput?.value 
    });
    
    if (!totalScenesInput || !estimatesContainer) {
        console.log('❌ Calculator elements not found');
        return;
    }
    
    // Set up input listener
    totalScenesInput.addEventListener('input', updateCompactEstimates);
    console.log('✅ Calculator event listener added');
    
    // Update estimates when model changes
    const modelSelectors = ['modelSelect', 'modelSelectMain'];
    modelSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.addEventListener('change', updateCompactEstimates);
        }
    });
    
    // Initial calculation
    updateCompactEstimates();
}

function updateCompactEstimates() {
    console.log('🔥 UPDATE ESTIMATES CALLED');
    const totalScenesInput = document.getElementById('totalScenes');
    const estimatesContainer = document.getElementById('screenplayEstimates');
    
    if (!totalScenesInput || !estimatesContainer) {
        console.log('❌ Calculator elements not found in update');
        return;
    }
    
    const sceneCount = parseInt(totalScenesInput.value) || 70;
    
    // Save to app state
    if (appState.storyInput) {
        appState.storyInput.totalScenes = sceneCount;
        saveToLocalStorage();
    }
    
    // Calculate estimates using real data
    const estimates = calculateCompactEstimates(sceneCount);
    
    // Update display
    updateCompactEstimateElements(estimates);
    
    // Show the estimates container
    estimatesContainer.style.display = 'block';
}

function calculateCompactEstimates(sceneCount) {
    // 🔥 FIX: Always use the input field value, not existing project data
    // This shows what the user is PLANNING to generate, not what they currently have
    
    // Calculate EXPECTED total plot points (not just generated ones)
    const totalActs = appState.generatedStructure ? Object.keys(appState.generatedStructure).length : 15;
    const avgPlotPointsPerAct = 3; // Same logic as server
    const totalPlotPoints = totalActs * avgPlotPointsPerAct;
    
    console.log(`🎬 Frontend calculation: ${totalActs} acts × ${avgPlotPointsPerAct} plot points per act = ${totalPlotPoints} expected plot points`);
    
    // Runtime calculation (industry standard: ~1 minute per scene)
    const runtime = Math.round(sceneCount * 1.2); // Slightly more realistic estimate
    
    // Scenes per plot point
    const scenesPerPlot = (sceneCount / totalPlotPoints).toFixed(1);
    

    
    // Token-based cost estimation
    const selectedModel = getSelectedModel();
    const modelPricing = {
        'claude-sonnet-4-20250514': { input: 3, output: 15 },
        'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
        'claude-3-5-haiku-20241022': { input: 1, output: 5 },
        'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
    };
    
    const pricing = modelPricing[selectedModel] || modelPricing['claude-3-5-sonnet-20241022'];
    
    // Realistic token estimates for COMPLETE project (scenes + dialogue):
    
    // Scene generation (compact JSON):
    const sceneInputTokensPerScene = 1200; // Prompt + context + plot points
    const sceneOutputTokensPerScene = 150; // Generated scene content (~100-150 words, compact JSON)
    
    // Dialogue generation (full screenplay format):
    const dialogueInputTokensPerScene = 1500; // Scene context + dialogue prompt
    const dialogueOutputTokensPerScene = 800; // Full screenplay page (~500-800 words with formatting)
    
    // Total tokens for complete project (scenes + dialogue)
    const totalInputTokens = sceneCount * (sceneInputTokensPerScene + dialogueInputTokensPerScene);
    const totalOutputTokens = sceneCount * (sceneOutputTokensPerScene + dialogueOutputTokensPerScene);
    
    // Calculate cost (pricing is per million tokens)
    const inputCost = (totalInputTokens / 1000000) * pricing.input;
    const outputCost = (totalOutputTokens / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    // Round to reasonable precision
    const displayCost = totalCost < 1 ? `~$${totalCost.toFixed(2)}` : `~$${Math.round(totalCost)}`;
    
    // Get friendly model name
    const modelNames = {
        'claude-sonnet-4-20250514': 'Claude 4',
        'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku-20241022': 'Haiku 3.5',
        'claude-3-haiku-20240307': 'Haiku 3'
    };
    const modelDisplayName = modelNames[selectedModel] || 'Claude 3.5';
    
    return {
        runtime: `~${runtime} min`,
        scenesPerPlot: `${scenesPerPlot} scenes/plot`,
        cost: `${displayCost} with ${modelDisplayName}`
    };
}

function updateCompactEstimateElements(estimates) {
    const runtimeEst = document.getElementById('runtimeEst');
    const scenesPerPlotEst = document.getElementById('scenesPerPlotEst');
    const costEst = document.getElementById('costEst');
    
    if (runtimeEst) runtimeEst.textContent = estimates.runtime;
    if (scenesPerPlotEst) scenesPerPlotEst.textContent = estimates.scenesPerPlot;
    if (costEst) costEst.textContent = estimates.cost;
}

// Dialogue Page Estimates - Read-only version based on actual scene count
function initializeDialogueEstimates() {
    // Update estimates when model changes
    const modelSelectors = ['modelSelect', 'modelSelectMain'];
    modelSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            // Remove existing listener to avoid duplicates
            selector.removeEventListener('change', updateDialogueEstimates);
            selector.addEventListener('change', updateDialogueEstimates);
        }
    });
    
    updateDialogueEstimates();
}

function updateDialogueEstimates() {
    const estimatesContainer = document.getElementById('dialogueScriptEstimates');
    if (!estimatesContainer) return;
    
    // Use target scene count from Step 5 for "cost at completion" estimate
    let targetScenes = 70; // Default
    
    // Get target from app state (saved from Step 5 input)
    if (appState.storyInput && appState.storyInput.totalScenes) {
        targetScenes = appState.storyInput.totalScenes;
    } else {
        // Fallback: try to get from the input field if still available
        const totalScenesInput = document.getElementById('totalScenes');
        if (totalScenesInput && totalScenesInput.value) {
            targetScenes = parseInt(totalScenesInput.value) || 70;
        }
    }
    
    // Calculate estimates using target scene count (cost at completion)
    const estimates = calculateCompactEstimates(targetScenes);
    
    // Update dialogue-specific elements
    const dialogueRuntimeEst = document.getElementById('dialogueRuntimeEst');
    const dialogueScenesPerPlotEst = document.getElementById('dialogueScenesPerPlotEst');
    const dialogueCostEst = document.getElementById('dialogueCostEst');
    
    if (dialogueRuntimeEst) dialogueRuntimeEst.textContent = estimates.runtime;
    if (dialogueScenesPerPlotEst) dialogueScenesPerPlotEst.textContent = estimates.scenesPerPlot;
    if (dialogueCostEst) dialogueCostEst.textContent = estimates.cost;
    
    // Show the estimates container
    estimatesContainer.style.display = 'inline-block';
}

// 🔧 EXTRACTED TO: components/progress-tracker.js
// Functions moved: updateUniversalNavigation, getForwardButtonText, updateBreadcrumbNavigation

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
async function loadTemplateStructureForActCards(templateData) {
    if (window.navigationWorkflowManager) {
        return await window.navigationWorkflowManager.loadTemplateStructureForActCards(templateData);
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function updateActCardsHeader(templateName, actCount) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.updateActCardsHeader(templateName, actCount);
    }
}

async function createActCards(templateStructure) {
    const actCardsScroll = document.getElementById('actCardsScroll');
    if (!actCardsScroll || !templateStructure) {
        console.warn('Act cards container not found or no template structure');
                return;
            }
            
    // Clear existing cards
    actCardsScroll.innerHTML = '';
    
    // 🔧 FIX: Preserve original act order by fetching from original template file
    let acts = [];
    
    // Always get the correct order from the original template file
    if (appState.selectedTemplate) {
        try {
            // Fetch the original template to get the correct key order
            const response = await fetch(`/api/template/${appState.selectedTemplate}`);
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
                            userDirections: act.userDirections || '' // 🆕 Step 1: Include userDirections
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
                userDirections: act.userDirections || '' // 🆕 Step 1: Include userDirections
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
            userDirections: act.userDirections || '' // 🆕 Step 1: Include userDirections
        }));
    }
    
    const totalActs = acts.length;
    console.log('🎭 Creating act cards for:', totalActs, 'acts');
    
    // Create act cards
    acts.forEach(act => {
        const actCard = createActCard(act, totalActs);
        actCardsScroll.appendChild(actCard);
    });
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function createActCard(act, totalActs) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.createActCard(act, totalActs);
    }
    return document.createElement('div');
}

// Enhanced Template Selection - Phase 2: Inline Editing Functions
// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function startEditingActCard(card, act) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.startEditingActCard(card, act);
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function saveActCardChanges(card, act) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.saveActCardChanges(card, act);
    }
}

function cancelActCardEditing(card, act) {
    console.log('🎭 Cancelling edit for act:', act.name);
    exitEditingMode(card, act);
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function exitEditingMode(card, act, silent = false) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.exitEditingMode(card, act, silent);
    }
}

function updateTemplateStructureInAppState(actKey, newTitle, newDescription, newPlotPoints, userDirections = null) {
    console.log('🔍 DEBUG: updateTemplateStructureInAppState called:', { actKey, newTitle, newDescription, newPlotPoints, userDirections });
    console.log('🔍 DEBUG: Current appState.templateData exists:', !!appState.templateData);
    console.log('🔍 DEBUG: Current structure exists:', !!(appState.templateData && appState.templateData.structure));
    console.log('🔍 DEBUG: Available structure keys:', appState.templateData && appState.templateData.structure ? Object.keys(appState.templateData.structure) : 'none');
    console.log('🔍 DEBUG: Act key exists:', !!(appState.templateData && appState.templateData.structure && appState.templateData.structure[actKey]));
    
    // Update the template data in appState
    if (appState.templateData && appState.templateData.structure && appState.templateData.structure[actKey]) {
        console.log('🔍 DEBUG: Before update:', {
            name: appState.templateData.structure[actKey].name,
            description: appState.templateData.structure[actKey].description,
            userDirections: appState.templateData.structure[actKey].userDirections
        });
        
        appState.templateData.structure[actKey].name = newTitle;
        appState.templateData.structure[actKey].description = newDescription;
        appState.templateData.structure[actKey].plotPoints = newPlotPoints;
        
        // 🆕 Step 1: Add userDirections support - preserve existing or update if provided
        if (userDirections !== null) {
            appState.templateData.structure[actKey].userDirections = userDirections;
        } else if (!appState.templateData.structure[actKey].hasOwnProperty('userDirections')) {
            // Initialize userDirections field for backwards compatibility
            appState.templateData.structure[actKey].userDirections = '';
        }
        
        console.log('🔍 DEBUG: After update:', {
            name: appState.templateData.structure[actKey].name,
            description: appState.templateData.structure[actKey].description,
            userDirections: appState.templateData.structure[actKey].userDirections
        });
        
        // Trigger auto-save if available
        if (window.autoSaveManager) {
            console.log('🔍 DEBUG: Triggering auto-save...');
            autoSaveManager.markDirty();
        }
        
        console.log('🎭 Template structure updated in app state');
        console.log('🔍 DEBUG: Full templateData after update:', {
            id: appState.templateData.id,
            name: appState.templateData.name,
            structureKeys: Object.keys(appState.templateData.structure)
        });
    } else {
        console.error('🚨 DEBUG: Failed to update template structure - missing data:', {
            hasTemplateData: !!appState.templateData,
            hasStructure: !!(appState.templateData && appState.templateData.structure),
            hasActKey: !!(appState.templateData && appState.templateData.structure && appState.templateData.structure[actKey]),
            actKey,
            availableKeys: appState.templateData && appState.templateData.structure ? Object.keys(appState.templateData.structure) : 'none'
        });
    }
}

function showActCardSaveFeedback(card, message) {
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
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 0.8rem;
        white-space: nowrap;
        z-index: 1001;
        animation: fadeInOut 2s ease-in-out;
    `;
    
    // Add animation keyframes if not already present
    if (!document.querySelector('#actCardFeedbackStyles')) {
        const style = document.createElement('style');
        style.id = 'actCardFeedbackStyles';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to card
    card.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 2000);
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function autoResizeTextarea(textarea) {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.autoResizeTextarea(textarea);
    }
}

// ✅ MOVED TO: components/navigation-workflow-manager.js
// Legacy function for backward compatibility
function closeAllEditingCards() {
    if (window.navigationWorkflowManager) {
        return window.navigationWorkflowManager.closeAllEditingCards();
    }
}

// Acts Creative Direction Modal Functions
let currentActsKey = null;

function showActsCreativeDirectionModal(actKey) {
    currentActsKey = actKey;
    
    // Get act data from either generated structure OR template data (for preview mode)
    let actData = null;
    if (appState.generatedStructure?.[actKey]) {
        // Generated structure exists - use it
        actData = appState.generatedStructure[actKey];
    } else if (appState.templateData?.structure?.[actKey]) {
        // Template preview mode - use template data
        actData = appState.templateData.structure[actKey];
    } else {
        console.error('Act data not found for key:', actKey);
        showToast('Act data not found', 'error');
        return;
    }
    
    // Populate modal
    document.getElementById('actsActName').value = actData.name || actKey.replace(/_/g, ' ').toUpperCase();
    
    // Get existing creative direction from template data (Step 2) or appState
    const existingDirection = appState.templateData?.structure?.[actKey]?.userDirections || '';
    document.getElementById('actsCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('actsCreativeDirectionModal').style.display = 'block';
}

function hideActsCreativeDirectionModal() {
    document.getElementById('actsCreativeDirectionModal').style.display = 'none';
    currentActsKey = null;
}

function saveActsCreativeDirection() {
    if (!currentActsKey) return;
    
    const direction = document.getElementById('actsCreativeDirections').value.trim();
    
    // Save to template data structure (same as Step 2)
    if (!appState.templateData.structure[currentActsKey]) {
        appState.templateData.structure[currentActsKey] = {};
    }
    
    if (direction) {
        appState.templateData.structure[currentActsKey].userDirections = direction;
    } else {
        delete appState.templateData.structure[currentActsKey].userDirections;
    }
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Acts creative direction saved!', 'success');
    
    // Hide modal
    hideActsCreativeDirectionModal();
    
    // Refresh display to show updated creative direction
    if (appState.generatedStructure && Object.keys(appState.generatedStructure).length > 0) {
        // Generated structure exists - refresh it
        displayStructure(appState.generatedStructure);
    } else {
        // Template preview mode - refresh the preview
        const structureContainer = document.getElementById('structureContent');
        if (structureContainer && appState.templateData) {
            createFullTemplatePreview(appState.templateData, structureContainer);
        }
    }
}

// Scenes Creative Direction Modal Functions
let currentScenesAct = null;
let currentScenesPlotPoint = null;

function showScenesCreativeDirectionModal(actKey, plotPointIndex) {
    currentScenesAct = actKey;
    currentScenesPlotPoint = plotPointIndex;
    
    // Populate modal
    const actData = appState.generatedStructure[actKey];
    const plotPoints = appState.plotPoints[actKey]?.plotPoints || [];
    const plotPointText = plotPoints[plotPointIndex] || `Plot Point ${plotPointIndex + 1}`;
    
    document.getElementById('scenesActName').value = actData?.name || actKey;
    document.getElementById('scenesPlotPointText').value = plotPointText;
    
    // Get existing creative direction
    const scenesKey = `${actKey}_${plotPointIndex}`;
    const existingDirection = appState.creativeDirections?.scenes?.[scenesKey] || '';
    document.getElementById('scenesCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('scenesCreativeDirectionModal').style.display = 'block';
}

function hideScenesCreativeDirectionModal() {
    document.getElementById('scenesCreativeDirectionModal').style.display = 'none';
    currentScenesAct = null;
    currentScenesPlotPoint = null;
}

function saveScenesCreativeDirection() {
    if (!currentScenesAct || currentScenesPlotPoint === null) return;
    
    const direction = document.getElementById('scenesCreativeDirections').value.trim();
    const scenesKey = `${currentScenesAct}_${currentScenesPlotPoint}`;
    
    // Initialize creative directions structure if needed
    if (!appState.creativeDirections) appState.creativeDirections = {};
    if (!appState.creativeDirections.scenes) appState.creativeDirections.scenes = {};
    
    // Save direction
    if (direction) {
        appState.creativeDirections.scenes[scenesKey] = direction;
    } else {
        delete appState.creativeDirections.scenes[scenesKey];
    }
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Scenes creative direction saved!', 'success');
    
    // Hide modal
    hideScenesCreativeDirectionModal();
    
    // Refresh display to show creative direction
    displayScenes(appState.generatedScenes || {});
}

// Plot Points Creative Direction Modal Functions
let currentPlotPointsAct = null;

function showPlotPointsCreativeDirectionModal(actKey) {
    const actData = appState.generatedStructure[actKey];
    if (!actData) return;
    
    currentPlotPointsAct = actKey;
    
    // Populate modal
    document.getElementById('plotPointsActName').value = actData.name || actKey;
    
    // Get existing creative direction
    const existingDirection = appState.creativeDirections?.plotPoints?.[actKey] || '';
    document.getElementById('plotPointsCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('plotPointsCreativeDirectionModal').style.display = 'block';
}

function hidePlotPointsCreativeDirectionModal() {
    document.getElementById('plotPointsCreativeDirectionModal').style.display = 'none';
    currentPlotPointsAct = null;
}

function savePlotPointsCreativeDirection() {
    if (!currentPlotPointsAct) return;
    
    const direction = document.getElementById('plotPointsCreativeDirections').value.trim();
    
    // Initialize creative directions structure if needed
    if (!appState.creativeDirections) appState.creativeDirections = {};
    if (!appState.creativeDirections.plotPoints) appState.creativeDirections.plotPoints = {};
    
    // Save direction
    if (direction) {
        appState.creativeDirections.plotPoints[currentPlotPointsAct] = direction;
    } else {
        delete appState.creativeDirections.plotPoints[currentPlotPointsAct];
    }
    

    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Plot points creative direction saved!', 'success');
    
    // Hide modal
    hidePlotPointsCreativeDirectionModal();
    
    // Refresh display to show creative direction
    displayPlotPointsGeneration();
}

// 🆕 Step 2: Act Details Modal Functions
let currentEditingAct = null; // Track which act is being edited

function showActDetailsModal(act) {
    console.log('🎭 Opening act details modal for:', act.name, 'act object:', act);
    
    // Store the act being edited
    currentEditingAct = act;
    console.log('🎭 Set currentEditingAct to:', currentEditingAct);
    
    // Get current data from appState.templateData (most up-to-date)
    const actData = appState.templateData?.structure?.[act.key];
    if (!actData) {
        console.error('Could not find act data in appState.templateData');
        return;
    }
    
    // Populate modal fields
    document.getElementById('actDetailsModalTitle').textContent = `Edit Details: ${act.name}`;
    document.getElementById('actDetailsName').value = actData.name || act.name;
    document.getElementById('actDetailsDescription').value = actData.description || act.description;
    document.getElementById('actDetailsDirections').value = actData.userDirections || '';
    document.getElementById('actDetailsPlotPoints').value = actData.plotPoints || act.plotPoints || 4;
    
    // Show modal
    const modal = document.getElementById('actDetailsModal');
    modal.style.display = 'block';
    
    // 🔧 Re-enable save button in case it was disabled from previous save
    const saveButton = modal.querySelector('.btn-primary');
    if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    }
}

function hideActDetailsModal() {
    console.log('🎭 Closing act details modal, currentEditingAct was:', currentEditingAct);
    
    // Clear the editing state
    currentEditingAct = null;
    console.log('🎭 Cleared currentEditingAct to null');
    
    // Hide modal
    const modal = document.getElementById('actDetailsModal');
    modal.style.display = 'none';
    console.log('🎭 Modal hidden');
}

function saveActDetails() {
    console.log('🎭 saveActDetails called, currentEditingAct:', currentEditingAct);
    
    if (!currentEditingAct) {
        console.error('❌ No act being edited - currentEditingAct is null/undefined');
        console.log('❌ This appears to be a duplicate call - ignoring');
        return;
    }
    
    // 🔧 Prevent duplicate calls by temporarily storing reference
    const actToSave = currentEditingAct;
    console.log('🎭 Saving act details for:', actToSave.name);
    
    // 🔧 Disable save button to prevent double-clicks
    const modal = document.getElementById('actDetailsModal');
    const saveButton = modal.querySelector('.btn-primary');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }
    
    // Get values from modal
    const newName = document.getElementById('actDetailsName').value.trim();
    const newDescription = document.getElementById('actDetailsDescription').value.trim();
    const newDirections = document.getElementById('actDetailsDirections').value.trim();
    const newPlotPoints = parseInt(document.getElementById('actDetailsPlotPoints').value) || 4;
    
    // Validate inputs
    if (!newName) {
        alert('Act name cannot be empty');
        document.getElementById('actDetailsName').focus();
        // Re-enable save button on validation error
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Changes';
        }
        return;
    }
    
    if (!newDescription) {
        alert('Template description cannot be empty');
        document.getElementById('actDetailsDescription').focus();
        // Re-enable save button on validation error
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Changes';
        }
        return;
    }
    
    if (newPlotPoints < 1 || newPlotPoints > 20) {
        alert('Plot points must be between 1 and 20');
        document.getElementById('actDetailsPlotPoints').focus();
        // Re-enable save button on validation error
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Changes';
        }
        return;
    }
    
    // Update the act object with new values
    actToSave.name = newName;
    actToSave.description = newDescription;
    actToSave.plotPoints = newPlotPoints;
    actToSave.userDirections = newDirections; // 🆕 Add userDirections
    
    // Update template data in app state (including userDirections)
    updateTemplateStructureInAppState(
        actToSave.key, 
        newName, 
        newDescription, 
        newPlotPoints, 
        newDirections  // 🆕 Pass userDirections
    );
    
    // Update the act card display
    updateActCardDisplay(actToSave);
    
    // Hide modal
    hideActDetailsModal();
    
    // Show success feedback
    showToast('Act details saved successfully!', 'success');
    
    // 🔧 Save to database immediately
    if (window.autoSaveManager) {
        autoSaveManager.saveImmediately();
    }
    
    console.log('🎭 Act updated:', { 
        key: actToSave.key, 
        name: newName, 
        description: newDescription,
        userDirections: newDirections
    });
}

function updateActCardDisplay(act) {
    // Find the act card and update its display
    const card = document.querySelector(`[data-act-key="${act.key}"]`);
    if (!card) {
        console.error('Could not find act card to update');
        return;
    }
    
    // Update title
    const titleElement = card.querySelector('.act-card-title');
    if (titleElement) {
        titleElement.setAttribute('data-original', act.name);
        const truncatedTitle = act.name.length > 20 ? act.name.substring(0, 17) + '...' : act.name;
        titleElement.textContent = truncatedTitle;
    }
    
    // Update description
    const descriptionElement = card.querySelector('.act-card-description');
    if (descriptionElement) {
        descriptionElement.setAttribute('data-original', act.description);
        const truncatedDescription = act.description.length > 80 ? act.description.substring(0, 77) + '...' : act.description;
        descriptionElement.textContent = truncatedDescription;
    }
    
    // Update plot points
    const plotPointsElement = card.querySelector('.act-card-plot-points');
    if (plotPointsElement) {
        plotPointsElement.setAttribute('data-original', act.plotPoints);
        plotPointsElement.textContent = `${act.plotPoints} pts`;
    }
    
    // Update userDirections data attribute
    card.setAttribute('data-user-directions', act.userDirections || '');
    
    // Update tooltip
    const tooltip = card.querySelector('.act-card-tooltip');
    if (tooltip) {
        tooltip.innerHTML = `
            <strong>${act.name}</strong><br>
            ${act.description}
            ${act.elements && act.elements.length > 0 ? `<br><br><em>Elements: ${act.elements.join(', ')}</em>` : ''}
            <br><br><strong>Plot Points:</strong> ${act.plotPoints}
            ${act.userDirections ? `<br><br><strong>✨ Your Directions:</strong> ${act.userDirections}` : ''}
        `;
    }
    
    console.log('🎭 Act card display updated');
}

// Close modal when clicking outside - improved race condition protection
window.addEventListener('click', (e) => {
    const modal = document.getElementById('actDetailsModal');
    // Only close if clicking on the modal backdrop (not the content)
    // and the modal is actually visible
    if (e.target === modal && modal.style.display === 'block') {
        console.log('🎭 Closing modal due to outside click');
        hideActDetailsModal();
    }
});

// 🎬 Dialogue Creative Direction Modal Functions
let currentDialogueAct = null;
let currentDialogueScene = null;

function showDialogueCreativeDirectionModal(actKey, sceneIndex) {
    currentDialogueAct = actKey;
    currentDialogueScene = sceneIndex;
    
    // Get scene information
    const sceneGroup = appState.generatedScenes[actKey];
    const scene = sceneGroup && sceneGroup[sceneIndex] ? sceneGroup[sceneIndex] : null;
    const actData = appState.generatedStructure[actKey];
    
    if (!scene) {
        showToast('Scene not found', 'error');
        return;
    }
    
    // Populate modal
    document.getElementById('dialogueActName').value = actData?.name || actKey;
    document.getElementById('dialogueSceneTitle').value = scene.title || scene.name || `Scene ${sceneIndex + 1}`;
    
    // Get existing creative direction
    const dialogueKey = `${actKey}_${sceneIndex}`;
    const existingDirection = appState.creativeDirections?.dialogue?.[dialogueKey] || '';
    document.getElementById('dialogueCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('dialogueCreativeDirectionModal').style.display = 'block';
}

function hideDialogueCreativeDirectionModal() {
    document.getElementById('dialogueCreativeDirectionModal').style.display = 'none';
    currentDialogueAct = null;
    currentDialogueScene = null;
}

function saveDialogueCreativeDirection() {
    if (!currentDialogueAct || currentDialogueScene === null) return;
    
    const direction = document.getElementById('dialogueCreativeDirections').value.trim();
    const dialogueKey = `${currentDialogueAct}_${currentDialogueScene}`;
    
    // Initialize creative directions structure if needed
    if (!appState.creativeDirections) appState.creativeDirections = {};
    if (!appState.creativeDirections.dialogue) appState.creativeDirections.dialogue = {};
    
    // Save direction
    if (direction) {
        appState.creativeDirections.dialogue[dialogueKey] = direction;
    } else {
        delete appState.creativeDirections.dialogue[dialogueKey];
    }
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Dialogue creative direction saved!', 'success');
    
    // Hide modal
    hideDialogueCreativeDirectionModal();
    
    // Refresh display to show creative direction
    displayDialogueGeneration();
}

// ==================================================
// GLOBAL CREATIVE DIRECTION MODAL FUNCTIONS
// ==================================================

// Global Plot Points Creative Direction Modal Functions
function showGlobalPlotPointsCreativeDirectionModal() {
    // Populate modal with existing global direction
    const existingDirection = appState.globalCreativeDirections?.plotPoints || '';
    document.getElementById('globalPlotPointsCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('globalPlotPointsCreativeDirectionModal').style.display = 'block';
}

function hideGlobalPlotPointsCreativeDirectionModal() {
    document.getElementById('globalPlotPointsCreativeDirectionModal').style.display = 'none';
}

function saveGlobalPlotPointsCreativeDirection() {
    const direction = document.getElementById('globalPlotPointsCreativeDirections').value.trim();
    
    // Initialize global directions if needed
    if (!appState.globalCreativeDirections) appState.globalCreativeDirections = { plotPoints: "", scenes: "", dialogue: "" };
    
    // Save direction
    appState.globalCreativeDirections.plotPoints = direction;
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Global plot points creative direction saved!', 'success');
    
    // Hide modal
    hideGlobalPlotPointsCreativeDirectionModal();
    
    // Update UI to show global direction is active
    updateGlobalDirectionIndicators();
}

// Global Scenes Creative Direction Modal Functions
function showGlobalScenesCreativeDirectionModal() {
    // Populate modal with existing global direction
    const existingDirection = appState.globalCreativeDirections?.scenes || '';
    document.getElementById('globalScenesCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('globalScenesCreativeDirectionModal').style.display = 'block';
}

function hideGlobalScenesCreativeDirectionModal() {
    document.getElementById('globalScenesCreativeDirectionModal').style.display = 'none';
}

function saveGlobalScenesCreativeDirection() {
    const direction = document.getElementById('globalScenesCreativeDirections').value.trim();
    
    // Initialize global directions if needed
    if (!appState.globalCreativeDirections) appState.globalCreativeDirections = { plotPoints: "", scenes: "", dialogue: "" };
    
    // Save direction
    appState.globalCreativeDirections.scenes = direction;
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Global scenes creative direction saved!', 'success');
    
    // Hide modal
    hideGlobalScenesCreativeDirectionModal();
    
    // Update UI to show global direction is active
    updateGlobalDirectionIndicators();
}

// Global Dialogue Creative Direction Modal Functions
function showGlobalDialogueCreativeDirectionModal() {
    // Populate modal with existing global direction
    const existingDirection = appState.globalCreativeDirections?.dialogue || '';
    document.getElementById('globalDialogueCreativeDirections').value = existingDirection;
    
    // Show modal
    document.getElementById('globalDialogueCreativeDirectionModal').style.display = 'block';
}

function hideGlobalDialogueCreativeDirectionModal() {
    document.getElementById('globalDialogueCreativeDirectionModal').style.display = 'none';
}

function saveGlobalDialogueCreativeDirection() {
    const direction = document.getElementById('globalDialogueCreativeDirections').value.trim();
    
    // Initialize global directions if needed
    if (!appState.globalCreativeDirections) appState.globalCreativeDirections = { plotPoints: "", scenes: "", dialogue: "" };
    
    // Save direction
    appState.globalCreativeDirections.dialogue = direction;
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Show success message
    showToast('Global dialogue creative direction saved!', 'success');
    
    // Hide modal
    hideGlobalDialogueCreativeDirectionModal();
    
    // Update UI to show global direction is active
    updateGlobalDirectionIndicators();
}

// Update global direction indicators in the UI
function updateGlobalDirectionIndicators() {
    // This function will be used to show visual indicators when global directions are active
    // For now, we could update button text or add visual cues
    
    // Update plot points button text if global direction is set
    const plotPointsBtn = document.querySelector('.plot-generation-section button[onclick="showGlobalPlotPointsCreativeDirectionModal()"]');
    if (plotPointsBtn && appState.globalCreativeDirections?.plotPoints) {
        plotPointsBtn.innerHTML = '🎨 Edit creative direction for all acts 📋';
        plotPointsBtn.title = 'Global direction active - click to edit';
    }
    
    // Update scenes button text if global direction is set
    const scenesBtn = document.querySelector('.scenes-generation-section button[onclick="showGlobalScenesCreativeDirectionModal()"]');
    if (scenesBtn && appState.globalCreativeDirections?.scenes) {
        scenesBtn.innerHTML = '🎨 Edit creative direction for all plot points 📋';
        scenesBtn.title = 'Global direction active - click to edit';
    }
    
    // Update dialogue button text if global direction is set
    const dialogueBtn = document.querySelector('.dialogue-generation-section button[onclick="showGlobalDialogueCreativeDirectionModal()"]');
    if (dialogueBtn && appState.globalCreativeDirections?.dialogue) {
        dialogueBtn.innerHTML = '🎨 Edit creative direction for all scenes 📋';
        dialogueBtn.title = 'Global direction active - click to edit';
    }
}



// ✅ MOVED TO: components/script-assembly-manager.js
// Legacy function for backward compatibility
function addSceneNavigation() {
    return window.scriptAssemblyManagerInstance.addSceneNavigation();
}

// Initialize the App Initialization Manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing App Initialization Manager...');
    appInitializationManager.init();
});