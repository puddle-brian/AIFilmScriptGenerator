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

// DOM Elements
const elements = {
    progressFill: document.getElementById('progressFill'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// Influence Management Functions
function addInfluence(type) {
    const selectElement = document.getElementById(`${type}Select`);
    
    let value = '';
    if (selectElement && selectElement.value) {
        value = selectElement.value;
        selectElement.value = '';
    }
    
    if (value && !appState.influences[type + 's'].includes(value)) {
        appState.influences[type + 's'].push(value);
    
        console.log('  - Current influences:', appState.influences);
        
        // 🔧 SYNC FIX: Keep storyInput.influences synchronized
        if (appState.storyInput) {
            appState.storyInput.influences = appState.influences;
            appState.storyInput.influencePrompt = buildInfluencePrompt();
            console.log('  - Synchronized to storyInput.influences');
        }
        
        updateInfluenceTags(type);
        saveToLocalStorage();
        
        // Mark as dirty to trigger auto-save
        appState.pendingChanges = true;
        if (autoSaveManager) {
            autoSaveManager.markDirty();
        }
        console.log('  - Marked as dirty for auto-save');
        
        // Check if this is a custom entry (not in default dropdown)
        checkAndOfferLibrarySave(type, value);
    }
}

// Universal Library System Configuration
const LIBRARY_TYPES = {
    director: {
        singular: 'director',
        plural: 'directors',
        displayName: 'Director',
        placeholder: 'e.g., "Christopher Nolan", "classic film noir directors", "a cross between Kubrick and Wes Anderson"'
    },
    screenwriter: {
        singular: 'screenwriter', 
        plural: 'screenwriters',
        displayName: 'Screenwriter',
        placeholder: 'e.g., "Charlie Kaufman", "witty British comedy writers", "Shakespeare meets Tarantino"'
    },
    film: {
        singular: 'film',
        plural: 'films', 
        displayName: 'Film',
        placeholder: 'e.g., "Inception", "moody 1970s thrillers", "a blend of Casablanca and Blade Runner"'
    },
    character: {
        singular: 'character',
        plural: 'characters',
        displayName: 'Character',
        placeholder: 'Describe this character\'s role, personality, and background...'
    },
    tone: {
        singular: 'tone',
        plural: 'tones',
        displayName: 'Tone',
        placeholder: 'e.g., "dark comedy", "melancholic and introspective", "fast-paced thriller"'
    },
    storyconcept: {
        singular: 'story concept',
        plural: 'storyconcepts',
        displayName: 'Story Concept',
        placeholder: 'Write or paste your story idea here - be as brief or detailed as you like...'
    }
};

// Universal library saving system
async function checkAndOfferLibrarySave(type, value) {
    // Re-check authentication status in case it wasn't initialized properly
    authManager.checkAuthStatus();
    
    // 📚 Use centralized LibraryManager with cleaner API
    if (window.libraryManager) {
        try {
            await window.libraryManager.checkAndOfferSave(type, value);
        } catch (error) {
            console.warn('LibraryManager checkAndOfferSave failed:', error);
            // Fallback to original implementation
            fallbackCheckAndOfferLibrarySave(type, value);
        }
    } else {
        // Fallback if LibraryManager not available
        fallbackCheckAndOfferLibrarySave(type, value);
    }
}

// Fallback implementation for backward compatibility
async function fallbackCheckAndOfferLibrarySave(type, value) {
    // Skip if user is not authenticated
    if (!appState.isAuthenticated) {
        console.log('Universal Library System: User not authenticated, skipping library save offer');
        return;
    }
    
    const config = LIBRARY_TYPES[type];
    if (!config) {
        console.warn(`Unknown library type: ${type}`);
        return;
    }
    
    try {
        // Check if this value already exists in user's library
        let userLibrary = [];
        if (appState.isAuthenticated && appState.user) {
            // 🌐 Use centralized API client with consistent error handling
            if (window.apiClient) {
                window.apiClient.setApiKey(appState.apiKey);
                userLibrary = await window.apiClient.getUserLibrary(appState.user.username, config.plural);
            } else {
                // Fallback to direct fetch if API client not available
                const response = await fetch(`/api/user-libraries/${appState.user.username}/${config.plural}`);
                userLibrary = await response.json();
            }
        }
        
        const exists = userLibrary.some(item => 
            item.entry_data.name === value || 
            item.entry_key === value
        );
        
        if (!exists) {
            // Show universal save-to-library modal
            showUniversalLibrarySaveModal(type, value, config);
        }
    } catch (error) {
        console.warn('Could not check user library:', error);
        // Show modal anyway if there's an error
        showUniversalLibrarySaveModal(type, value, config);
    }
}



function hideUniversalLibrarySaveModal() {
    const modal = document.getElementById('universalLibrarySaveModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// Helper function to properly initialize a new project when story concept is created
function initializeNewProjectFromStoryConcept(title, logline) {
    console.log('🚀 Initializing new project from story concept:', title);
    
    // Set the story input data to trigger project creation
    appState.storyInput = {
        title: title,
        logline: logline || '',
        characters: appState.projectCharacters || [],
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
    showProjectHeader({
        title: title,
        logline: logline || ''
    });
    
    // Mark as having changes to trigger auto-save
    appState.pendingChanges = true;
    
    // Save immediately so the project appears in lists right away
    if (autoSaveManager && typeof autoSaveManager.saveImmediately === 'function') {
        autoSaveManager.saveImmediately();
    }
    
    // Save to localStorage immediately
    saveToLocalStorage();
    
    // Update progress meters and step indicators after story creation
    updateAllProgressMeters();
    updateStepIndicators();
    updateUniversalNavigation();
    updateBreadcrumbNavigation();
    
    console.log('✅ New project initialized:', {
        title: appState.storyInput.title,
        projectPath: appState.projectPath,
        hasProjectData: !!(appState.storyInput && appState.storyInput.title)
    });
    
    // Show success message
    showToast(`New project "${title}" created and ready!`, 'success');
    
    return appState.projectPath;
}

async function saveToLibraryAndContinue(type, isNewEntry = false) {
    const name = document.getElementById('universalLibraryEntryName').value.trim();
    const descriptionElement = document.getElementById('universalLibraryEntryDescription');
    const description = descriptionElement ? descriptionElement.value.trim() : '';
    const config = LIBRARY_TYPES[type];
    
    if (!name) {
        showToast('Please provide a name', 'error');
        return;
    }
    
    try {
        // Check if we're editing an existing entry
        const isEditing = window.editingLibraryEntry;
        let url, method;
        
        if (isEditing && !isEditing.isNewCharacterEntry) {
            // Editing existing entry - ALWAYS use the original key, ignore name changes
            method = 'PUT';
            url = `/api/user-libraries/${appState.user.username}/${isEditing.type}/${encodeURIComponent(isEditing.key)}`;
            console.log(`🔧 EDIT: Using original key "${isEditing.key}" for editing, regardless of name changes`);
            console.log(`   - Original name: "${isEditing.data?.name}""`);
            console.log(`   - New name: "${name}"`);
        } else {
            // Creating new entry - generate new key from current name
            method = 'POST';
            // Generate safe entry key (same logic as server-side)
            let entryKey = name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                .replace(/\s+/g, '-')         // Replace spaces with hyphens
                .replace(/-+/g, '-')          // Remove multiple hyphens
                .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
                
            // Truncate to 47 chars to fit database constraint (VARCHAR(50))
            if (entryKey.length > 47) {
                entryKey = entryKey.substring(0, 47) + '...';
            }
            
            url = `/api/user-libraries/${appState.user.username}/${config.plural}/${entryKey}`;
            console.log(`🆕 NEW: Generated key "${entryKey}" from name "${name}"`);
        }
        
        // For characters and story concepts, store both name and description
        // For influences, store just the name (which is actually the full influence phrase)
        const entryData = (type === 'character' || type === 'storyconcept') ? {
            name, 
            description: description || (type === 'character' ? `Main character: ${name}` : `Story concept: ${name}`)
        } : {
            name,
            description: `${config.displayName} influence: ${name}` // Simple fallback for database
        };
        
        const response = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify(isEditing && !isEditing.isNewCharacterEntry ? entryData : entryData)
        });
        
        if (response.ok) {
            const action = (isEditing && !isEditing.isNewCharacterEntry) ? 'updated' : 'saved';
            showToast(`"${name}" ${action} in your ${config.plural} library!`, 'success');
            
            // If editing from step 1, update the current project state
            if (isEditing && isEditing.isFromStep1) {
                if (type === 'character' && typeof isEditing.characterIndex === 'number') {
                    // Update the character in the project
                    const originalName = appState.projectCharacters[isEditing.characterIndex].name;
                    appState.projectCharacters[isEditing.characterIndex] = {
                        name: name,
                        description: description || `Main character: ${name}`,
                        fromLibrary: true
                    };
                    updateCharacterTags();
                    saveToLocalStorage();
                } else if (type !== 'character') {
                    // Update influence in the project
                    const pluralType = config.plural;
                    const influences = appState.influences[pluralType];
                    if (influences && isEditing.data && isEditing.data.name) {
                        const oldName = isEditing.data.name;
                        const index = influences.indexOf(oldName);
                        if (index !== -1) {
                            influences[index] = name;
                            updateInfluenceTags(type);
                            saveToLocalStorage();
                        }
                    }
                }
            }
            
            // For new entries, also add to the current form
            if (isNewEntry) {
                if (type === 'tone') {
                    // Add to tone influences array (like other influences)
                    // Ensure tones array exists
                    if (!appState.influences.tones) {
                        appState.influences.tones = [];
                    }
                    
                    if (!appState.influences.tones.includes(name)) {
                        appState.influences.tones.push(name);
                        updateInfluenceTags('tone');
                        saveToLocalStorage();
                        
                        // Mark as dirty to trigger auto-save
                        appState.pendingChanges = true;
                        if (autoSaveManager) {
                            autoSaveManager.markDirty();
                        }
                    }
                } else if (type === 'character') {
                    // Add to main story characters (not influences)
                    const existingCharacter = appState.projectCharacters.find(char => char.name === name);
                    if (!existingCharacter) {
                        const character = {
                            name: name,
                            description: description || `Main character: ${name}`,
                            fromLibrary: true
                        };
                        appState.projectCharacters.push(character);
                        
                        
                        // Update character tags display (similar to influences)
                        updateCharacterTags();
                        validateCharactersRequired();
                        saveToLocalStorage();
                        
                        // Mark as dirty to trigger auto-save
                        appState.pendingChanges = true;
                        if (autoSaveManager) {
                            autoSaveManager.markDirty();
                        }
                
                    }
                } else if (type === 'storyconcept') {
                    // For story concepts, create concept display AND initialize new project
                    
                    appState.currentStoryConcept = {
                        title: name,
                        logline: description || '',
                        fromLibrary: true
                    };
                    
                    updateStoryConceptDisplay();
                    
                    // Initialize a new project with this story concept
                    initializeNewProjectFromStoryConcept(name, description || '');
                    
                    showToast(`Story concept "${name}" created and project initialized!`, 'success');
                } else {
                    // Handle influence editing vs new additions
                    let actionTaken = false;
                    
                    if (window.editingLibraryEntry && window.editingLibraryEntry.originalName) {
                        // We're editing an existing influence - replace the original entry
                        const originalName = window.editingLibraryEntry.originalName;
                        const originalIndex = appState.influences[config.plural].indexOf(originalName);
                        
                        if (originalIndex > -1) {
                            // Replace the original entry with the new name
                            appState.influences[config.plural][originalIndex] = name;
                            console.log(`🔄 INFLUENCE EDIT: Replaced "${originalName}" with "${name}"`);
                            actionTaken = true;
                        } else {
                            console.log(`⚠️ INFLUENCE EDIT: Original "${originalName}" not found in influences, adding as new`);
                        }
                    }
                    
                    // If not editing or original not found, add as new (but check for duplicates)
                    if (!actionTaken && !appState.influences[config.plural].includes(name)) {
                        appState.influences[config.plural].push(name);
                        console.log(`🔍 INFLUENCE DEBUG: Added ${type} "${name}" to appState.influences`);
                        actionTaken = true;
                    }
                    
                    if (actionTaken) {
                        console.log('  - Current influences:', appState.influences);
                        
                        // 🔧 SYNC FIX: Keep storyInput.influences synchronized
                        if (appState.storyInput) {
                            appState.storyInput.influences = appState.influences;
                            appState.storyInput.influencePrompt = buildInfluencePrompt();
                            console.log('  - Synchronized to storyInput.influences');
                        }
                        
                        updateInfluenceTags(type);
                        saveToLocalStorage();
                        
                        // Mark as dirty to trigger auto-save
                        appState.pendingChanges = true;
                        if (autoSaveManager) {
                            autoSaveManager.markDirty();
                        }
                        console.log('  - Marked as dirty for auto-save');
                    } else {
                        console.log(`ℹ️ INFLUENCE: "${name}" already exists, no action taken`);
                    }
                }
            }
            
            // Refresh dropdowns to include the new entry
            await populateDropdowns();
        } else {
            showToast('Failed to save to library', 'error');
        }
    } catch (error) {
        console.error('Error saving to library:', error);
        showToast('Error saving to library', 'error');
    }
    
    // Clear editing state
    if (window.editingLibraryEntry) {
        window.editingLibraryEntry = null;
    }
    
    hideUniversalLibrarySaveModal();
}

// Setup keyboard support for universal library system
function setupUniversalLibraryKeyboardSupport() {
    // The custom input fields have been removed in favor of direct "Add New" buttons
    // Keyboard support is now handled by the modal forms directly
    console.log('Universal Library System: Keyboard support initialized');
}

function removeInfluence(type, value) {
    // Ensure influences object and specific array exist
    if (!appState.influences) {
        appState.influences = {};
    }
    
    const pluralType = type + 's';
    if (!appState.influences[pluralType]) {
        appState.influences[pluralType] = [];
    }
    
    const index = appState.influences[pluralType].indexOf(value);
    if (index > -1) {
        appState.influences[pluralType].splice(index, 1);
        
        // 🔧 SYNC FIX: Keep storyInput.influences synchronized
        if (appState.storyInput) {
            appState.storyInput.influences = appState.influences;
            appState.storyInput.influencePrompt = buildInfluencePrompt();
            console.log('🔄 REMOVE INFLUENCE: Synchronized to storyInput.influences');
        }
        
        updateInfluenceTags(type);
        saveToLocalStorage();
        
        // Mark as dirty to trigger auto-save
        appState.pendingChanges = true;
        if (autoSaveManager) {
            autoSaveManager.markDirty();
        }
    }
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

// Enhanced universal modal to handle both save-existing and create-new flows
function showUniversalLibrarySaveModal(type, value, config, isNewEntry = false) {
    
    // Check if this is an edit operation (existing entry from library)
    const isEdit = window.editingLibraryEntry && !isNewEntry;
    
    const modalTitle = isNewEntry ? `Add New ${
        type === 'director' ? 'Directional Style' : 
        type === 'screenwriter' ? 'Prose Style' : 
        type === 'film' ? 'Essence' : 
        type === 'tone' ? 'Tone & Atmosphere' : 
        config.displayName
    }` : isEdit ? `Edit ${
        type === 'director' ? 'Directional Style' : 
        type === 'screenwriter' ? 'Prose Style' : 
        type === 'film' ? 'Essence' : 
        type === 'tone' ? 'Tone & Atmosphere' : 
        config.displayName
    }` : `Save ${
        type === 'director' ? 'Directional Style' : 
        type === 'screenwriter' ? 'Prose Style' : 
        type === 'film' ? 'Essence' : 
        type === 'tone' ? 'Tone & Atmosphere' : 
        config.displayName
    } to Library`;
    
    const modalMessage = isNewEntry ? 
        `Create a new ${
            type === 'director' ? 'directional influence' : 
            type === 'screenwriter' ? 'prose influence' : 
            type === 'film' ? 'creative influence' : 
            type === 'tone' ? 'tone influence' : 
            config.singular
        } for your library:` : isEdit ? 
        `Edit this ${
            type === 'director' ? 'directional influence' : 
            type === 'screenwriter' ? 'prose influence' : 
            type === 'film' ? 'creative influence' : 
            type === 'tone' ? 'tone influence' : 
            config.singular
        }:` :
        `Would you like to save "<strong>${value}</strong>" to your ${
            type === 'director' ? 'directional styles' : 
            type === 'screenwriter' ? 'prose styles' : 
            type === 'film' ? 'essences' : 
            type === 'tone' ? 'tones & atmosphere' : 
            config.plural
        } library for future projects?`;
    
    // Create prompt context help text based on type
    let promptHelpText = '';
    if (type === 'director') {
        promptHelpText = `This will appear in prompts as: "With direction reminiscent of <em>[what you enter]</em>, ..."`;
    } else if (type === 'screenwriter') {
        promptHelpText = `This will appear in prompts as: "with prose style that invokes <em>[what you enter]</em>, ..."`;
    } else if (type === 'film') {
        promptHelpText = `This will appear in prompts as: "channeling the essence of <em>[what you enter]</em>, ..."`;
    } else if (type === 'character') {
        promptHelpText = `Characters use both name and description in prompts for detailed character development.`;
    } else if (type === 'tone') {
        promptHelpText = `This tone will be used throughout your story generation.`;
    } else if (type === 'storyconcept') {
                        promptHelpText = `This story description will be included in every AI prompt as your story develops, guiding all generated content.`;
    }
    
    // For characters and story concepts, keep the name/description structure since they use both fields
    // For influences (director/screenwriter/film), use single field that matches prompt usage
    const isComplexType = type === 'character' || type === 'storyconcept';
    
    const modalHtml = `
        <div class="modal universal-library-modal" id="universalLibrarySaveModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${modalTitle}</h3>
                    <button class="modal-close" onclick="hideUniversalLibrarySaveModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${modalMessage}</p>
                    <form id="universalLibrarySaveForm">
                        ${isComplexType ? `
                            <div class="form-group">
                                <label for="universalLibraryEntryName">${type === 'character' ? 'Character Name' : 'Story Title'}</label>
                                <input type="text" id="universalLibraryEntryName" value="${value}" required>
                            </div>
                            <div class="form-group">
                                <label for="universalLibraryEntryDescription">${type === 'character' ? 'Character Description' : 'Story Description'}</label>
                                <textarea id="universalLibraryEntryDescription" rows="3" 
                                    placeholder="${config.placeholder}"></textarea>
                                ${type === 'storyconcept' ? `<small class="form-help">${promptHelpText}</small>` : ''}
                            </div>
                        ` : `
                            <div class="form-group">
                                <label for="universalLibraryEntryName">${type === 'director' ? 'Direction reminiscent of...' : 
                                    type === 'screenwriter' ? 'Prose style that invokes...' : 
                                    type === 'film' ? 'Channeling the essence of...' : 
                                    type === 'tone' ? 'Tone and atmosphere inspired by...' : 
                                    `${config.displayName} Influence`}</label>
                                <input type="text" id="universalLibraryEntryName" value="${value}" required 
                                    placeholder="${config.placeholder}">
                                <small class="form-help">${promptHelpText}</small>
                            </div>
                        `}
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideUniversalLibrarySaveModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveToLibraryAndContinue('${type}', ${isNewEntry})">
                        ${isNewEntry ? 'Add to Library' : isEdit ? 'Update' : 'Save to Library'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('universalLibrarySaveModal');
    if (existingModal) existingModal.remove();
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('universalLibrarySaveModal').classList.add('show');
    
    // Focus on the name input and set up Enter key handling
    setTimeout(() => {
        const nameInput = document.getElementById('universalLibraryEntryName');
        const descInput = document.getElementById('universalLibraryEntryDescription');
        
        nameInput.focus();
        
        // Add Enter key handling for form submission
        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveToLibraryAndContinue(type, isNewEntry);
            }
        };
        
        nameInput.addEventListener('keypress', handleEnterKey);
        if (descInput) {
            descInput.addEventListener('keypress', handleEnterKey);
        }
    }, 100);
}

function updateInfluenceTags(type) {
    const container = document.getElementById(`${type}Tags`);
    if (!container) return; // Handle case where element doesn't exist
    
    container.innerHTML = '';
    
    // Ensure influences object and specific array exist
    if (!appState.influences) {
        appState.influences = {};
    }
    
    const pluralType = type + 's';
    if (!appState.influences[pluralType]) {
        appState.influences[pluralType] = [];
    }
    
    appState.influences[pluralType].forEach(influence => {
        const tag = document.createElement('div');
        tag.className = 'influence-tag clickable-tag';
        tag.innerHTML = `
            <span onclick="editInfluenceEntry('${type}', '${influence.replace(/'/g, "\\'")}');" style="cursor: pointer; flex: 1;">${influence}</span>
            <button type="button" class="remove-tag" onclick="removeInfluence('${type}', '${influence.replace(/'/g, "\\'")}')">×</button>
        `;
        container.appendChild(tag);
    });
    
    // Update autogenerate button visibility when influences change
    updateAutoGenerateButtonVisibility();
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
    showUniversalLibrarySaveModal('storyconcept', appState.currentStoryConcept.title, config, true);
    
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
                         (entry.entry_data && entry.entry_data.name ? entry.entry_data.name : 
                         (entry.name ? entry.name : 'unknown'));
        
        console.log(`🔍 Checking entry: "${entryName}" against "${influenceName}"`);
        
        if (typeof entry === 'string') {
            const match = entry === influenceName;
            if (match) console.log(`✅ String match found: "${entry}"`);
            return match;
        } else if (entry.entry_data && entry.entry_data.name) {
            const match = entry.entry_data.name === influenceName;
            if (match) console.log(`✅ Entry data name match found: "${entry.entry_data.name}"`);
            return match;
        } else if (entry.name) {
            const match = entry.name === influenceName;
            if (match) console.log(`✅ Entry name match found: "${entry.name}"`);
            return match;
        }
        return false;
    });
    
    if (entryData) {
        console.log(`✅ STRATEGY 1 SUCCESS: Found exact match`, {
            type: typeof entryData,
            name: typeof entryData === 'string' ? entryData : (entryData.entry_data?.name || entryData.name),
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
            name: e.entry_data?.name || e.name || (typeof e === 'string' ? e : 'unknown'),
            key: e.entry_key || e.key || 'no-key'
        })));
        
        entryData = libraryEntries.find(entry => {
            const entryKey = entry.entry_key || entry.key || '';
            const entryName = entry.entry_data?.name || entry.name || (typeof entry === 'string' ? entry : '');
            
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
                name: entryData.entry_data?.name || entryData.name || 'string-entry',
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
        } else if (entryData.entry_data && entryData.entry_data.name) {
            actualData = entryData.entry_data;
            actualKey = entryData.entry_key;
        } else if (entryData.name) {
            actualData = { name: entryData.name, description: entryData.description || '' };
            actualKey = entryData.entry_key || entryData.key;
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

function buildInfluencePrompt() {
    let prompt = '';
    
    if (appState.influences.directors.length > 0) {
        prompt += `With direction reminiscent of ${appState.influences.directors.join(', ')}, `;
    }
    
    if (appState.influences.screenwriters.length > 0) {
        prompt += `with prose style that invokes ${appState.influences.screenwriters.join(', ')}, `;
    }
    
    if (appState.influences.films.length > 0) {
        prompt += `channeling the essence of ${appState.influences.films.join(', ')}, `;
    }
    
    if (appState.influences.tones.length > 0) {
        prompt += `with tone and atmosphere inspired by ${appState.influences.tones.join(' and ')}, `;
    }
    
    return prompt;
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

// Initialize application
async function initializeApp() {

    
    // Initialize authentication first
    authManager.init();
    
    // Initialize auto-save manager
    autoSaveManager.init();
    
    updateProgressBar();
    updateStepIndicators();
    
    // Navigation will be updated after localStorage restoration via updateAllProgressMeters()
    
    // Populate dropdowns from JSON files
    await populateDropdowns();
    
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
                    await restoreLoadedProject();
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

}

// Populate dropdowns from user libraries ONLY (no more hardcoded JSON)
async function populateDropdowns() {
    console.log('PopulateDropdowns: Starting (user libraries only)...');
    
    try {
        // Load user's libraries (which now include starter pack content for new users)
        console.log('PopulateDropdowns: Loading user libraries...');
        const userLibraries = await loadUserLibraries();
        
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
    } catch (error) {
        console.error('PopulateDropdowns: Error occurred:', error);
        showToast('Error loading dropdown options. Please refresh the page.', 'error');
    }
}

// Load user's custom libraries for dropdowns
async function loadUserLibraries() {
    // Re-check authentication status in case it wasn't initialized properly
    authManager.checkAuthStatus();
    
    // Skip user libraries for guest users (not authenticated)
    if (!appState.isAuthenticated) {
        return { directors: [], screenwriters: [], films: [], tones: [], characters: [], storyconcepts: [] };
    }
    
    try {
        const libraryTypes = ['directors', 'screenwriters', 'films', 'tones', 'characters', 'storyconcepts'];
        const userLibraries = { directors: [], screenwriters: [], films: [], tones: [], characters: [], storyconcepts: [] };
        
        // Load each library type from the API with timeout
        for (const type of libraryTypes) {
            try {
                // Add 5-second timeout to prevent hanging
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(`/api/user-libraries/${appState.user.username}/${type}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const libraries = await response.json();
                    // For characters and story concepts, preserve full data structure; for others, just get name
                    if (type === 'characters') {
                        userLibraries[type] = libraries.map(lib => lib.entry_data);
                    } else if (type === 'storyconcepts') {
                        userLibraries[type] = libraries.map(lib => lib.entry_data);
                    } else {
                        userLibraries[type] = libraries.map(lib => lib.entry_data.name);
                    }
                }
            } catch (error) {
                // Continue with empty array for this type
            }
        }
        
        return userLibraries;
    } catch (error) {
        console.error('LoadUserLibraries: Error occurred:', error);
        return { directors: [], screenwriters: [], films: [], tones: [], characters: [], storyconcepts: [] };
    }
}

// Restore a loaded project from localStorage on page reload
async function restoreLoadedProject() {
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
function setupEventListeners() {
    // Story form submission
    document.getElementById('storyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleStorySubmission();
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
}

// Setup library change listener for ADD NEW modal integration
function setupLibraryChangeListener() {
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
function handleStorySubmission() {
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
        const titleSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
        appState.projectPath = `${titleSlug}_${timestamp}`;
        appState.projectId = null; // Will be set when saved to database
        console.log('📁 Created project path for manual story submission:', appState.projectPath);
        
        // Show project header immediately
        showProjectHeader({
            title: title,
            logline: logline || appState.storyInput.logline || ''
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
    updateStepIndicators();
    
    goToStep(2);
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

// Show prompt preview modal
function showPromptPreviewModal() {
    document.getElementById('promptPreviewModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Hide prompt preview modal
function hidePromptPreviewModal() {
    document.getElementById('promptPreviewModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Generate structure with custom prompt
async function generateStructureWithCustomPrompt() {
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
            
            displayStructure(data.structure, appState.customPrompt.userPrompt, appState.customPrompt.systemMessage);
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

// Update the acts generation button text based on whether acts exist
function updateActsGenerationButton() {
    const button = document.getElementById('generateActsBtn');
    if (!button) return;
    
    const hasExistingActs = appState.generatedStructure && 
                           Object.keys(appState.generatedStructure).length > 0 &&
                           Object.keys(appState.generatedStructure).some(key =>
                               appState.generatedStructure[key] &&
                               appState.generatedStructure[key].description
                           );
    
    if (hasExistingActs) {
        button.innerHTML = '🔄 Regenerate Acts';
        button.title = 'Regenerate story acts using the selected template';
    } else {
        button.innerHTML = '📋 Generate Acts';
        button.title = 'Generate story acts using the selected template';
    }
}

// Update the "Generate All Plot Points" button text based on whether ALL acts have plot points
function updateGenerateAllPlotPointsButton() {
    const button = document.getElementById('generateAllPlotPointsBtn');
    if (!button) return;
    
    // Check if ALL acts have plot points (not just any acts)
    const structureKeys = appState.generatedStructure ? Object.keys(appState.generatedStructure) : [];
    const allActsHavePlotPoints = structureKeys.length > 0 && structureKeys.every(key =>
        hasPlotPointsForElement(key) // Use existing helper function for consistency
    );
    
    if (allActsHavePlotPoints) {
        button.innerHTML = '🔄 Regenerate All Plot Points';
        button.title = 'Regenerate connected plot points for all acts';
    } else {
        button.innerHTML = '📋 Generate All Plot Points';
        button.title = 'Generate connected plot points for all acts';
    }
}

// Update the "Generate All Scenes" button text based on whether ALL acts with plot points have scenes
function updateGenerateAllScenesButton() {
    const button = document.getElementById('generateAllScenesBtn');
    if (!button) return;
    
    // Get acts that have plot points using the correct helper function
    const actsWithPlotPoints = [];
    if (appState.generatedStructure) {
        Object.keys(appState.generatedStructure).forEach(key => {
            if (hasPlotPointsForElement(key)) {
                actsWithPlotPoints.push(key);
            }
        });
    }
    
    // Check if ALL acts with plot points also have scenes
    const allActsWithPlotPointsHaveScenes = actsWithPlotPoints.length > 0 && actsWithPlotPoints.every(key => {
        return appState.generatedScenes &&
               appState.generatedScenes[key] && 
               Array.isArray(appState.generatedScenes[key]) &&
               appState.generatedScenes[key].length > 0;
    });
    
    if (allActsWithPlotPointsHaveScenes) {
        button.innerHTML = '🔄 Regenerate All Scenes';
        button.title = 'Regenerate scenes for all acts that have plot points';
    } else {
        button.innerHTML = '🎬 Generate All Scenes';
        button.title = 'Generate scenes for all acts that have plot points';
    }
}

// Update the "Generate All Dialogue" button text based on whether ALL scenes have dialogue
function updateGenerateAllDialogueButton() {
    const button = document.getElementById('generateAllDialogueBtn');
    if (!button) return;
    
    // Get all scenes that exist
    const allScenes = [];
    if (appState.generatedScenes) {
        Object.values(appState.generatedScenes).forEach(actScenes => {
            if (Array.isArray(actScenes)) {
                allScenes.push(...actScenes);
            }
        });
    }
    
    // Check if ALL scenes have dialogue
    const allScenesHaveDialogue = allScenes.length > 0 && allScenes.every(scene =>
        appState.generatedDialogues &&
        appState.generatedDialogues[scene.id] &&
        appState.generatedDialogues[scene.id].length > 0
    );
    
    if (allScenesHaveDialogue) {
        button.innerHTML = '🔄 Regenerate All Dialogue';
        button.title = 'Regenerate dialogue for all scenes that exist';
    } else {
        button.innerHTML = '💬 Generate All Dialogue';
        button.title = 'Generate dialogue for all scenes that exist';
    }
}

// Update all generation buttons
function updateAllGenerationButtons() {
    updateActsGenerationButton();
    updateGenerateAllPlotPointsButton();
    updateGenerateAllScenesButton();
    updateGenerateAllDialogueButton();
}



// Generate structure
async function generateStructure() {
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
            
            displayStructure(data.structure, data.prompt, data.systemMessage);
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

// ✅ Get chronological act order - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function getChronologicalActOrder(templateData, structureKeys) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.getChronologicalActOrder(templateData, structureKeys);
    }
    return structureKeys;
}

// Display generated structure
function displayStructure(structure, prompt = null, systemMessage = null) {
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
                    await saveActContent(key, newContent);
                    
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
async function saveActContent(actKey, content) {
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
async function generateElementPlotPoints(structureKey) {
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
            
            // Display the generated plot points
            displayElementPlotPoints(structureKey, data.plotPoints);
            
            // Update progress meters after generating plot points
            console.log('🔍 PROGRESS UPDATE: Updating progress meters after plot points generation');
            updateAllProgressMeters();
            
            // 🔥 FIX: Update navigation system when individual plot points are generated
            updateStepIndicators();
            updateUniversalNavigation();
            updateBreadcrumbNavigation();
            
            // Refresh the plot points display to update button states for subsequent acts
            displayPlotPointsGeneration();
            
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
function displayElementPlotPoints(structureKey, plotPoints) {
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
            await savePlotPointsContent(structureKey, newContent);
            
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
            displayPlotPointsGeneration();
        }
    });
    
    // Redundant plot point actions removed - use main "Generate Plot Points" and "Preview Prompt" buttons instead
}

// Save plot points content function
async function savePlotPointsContent(structureKey, content) {
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
async function regenerateAllPlotPointsForElement(structureKey) {
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
async function regenerateElementPlotPoint(structureKey, plotPointIndex) {
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
            displayElementPlotPoints(structureKey, appState.plotPoints[structureKey]);
            
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

// Show individual plot point prompt modal
function showIndividualPlotPointPromptModal() {
    const modal = document.getElementById('individualPlotPointPromptModal');
    const prompt = appState.currentIndividualPlotPointPrompt;
    
    if (!prompt) {
        showToast('No individual plot point prompt data available.', 'error');
        return;
    }
    
    // Populate modal content
    document.getElementById('individualPlotPointPromptSystemMessage').textContent = prompt.systemMessage;
    document.getElementById('individualPlotPointPromptUserPrompt').textContent = prompt.userPrompt;
    
    // Update modal title
    const modalTitle = document.querySelector('#individualPlotPointPromptModal .modal-header h3');
    const plotPointNumber = prompt.plotPointIndex + 1;
    const actName = prompt.storyAct?.name || prompt.structureKey.replace(/_/g, ' ').toUpperCase();
    modalTitle.textContent = `Plot Point ${plotPointNumber} Regeneration Prompt - ${actName}`;
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Hide individual plot point prompt modal
function hideIndividualPlotPointPromptModal() {
    document.getElementById('individualPlotPointPromptModal').classList.remove('show');
    document.body.style.overflow = 'auto';
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

// Check if all plot points are generated and enable continue button
function checkPlotPointsCompletion() {
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

// Preview scene generation prompt for an element
async function previewElementScenesPrompt(structureKey) {
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
                totalScenes: currentTotalScenes
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

// Generate scenes for a specific story act
// Check if plot points exist for a structural element
function hasPlotPointsForElement(structureKey) {
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
function canGeneratePlotPointsForElement(structureKey) {
    if (!appState.generatedStructure) return false;
    
    const structureKeys = Object.keys(appState.generatedStructure);
    const chronologicalKeys = getChronologicalActOrder(appState.templateData, structureKeys);
    const currentActIndex = chronologicalKeys.indexOf(structureKey);
    
    // First act can always generate plot points
    if (currentActIndex === 0) return true;
    
    // Check if all previous acts have plot points
    for (let i = 0; i < currentActIndex; i++) {
        const previousActKey = chronologicalKeys[i];
        if (!hasPlotPointsForElement(previousActKey)) {
            return false;
        }
    }
    
    return true;
}

// This function has been replaced with proper hierarchical implementation



// Generate scenes for all acts that have plot points
async function generateAllScenes() {
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
    
    // Filter to only include acts that have plot points
    const actsWithPlotPoints = structureKeys.filter(key => hasPlotPointsForElement(key));
    
    if (actsWithPlotPoints.length === 0) {
        showToast('No acts have plot points yet. Please generate plot points first in Step 4.', 'error');
        return;
    }
    
    try {
        // Start hierarchical progress tracking
        progressTracker.start(actsWithPlotPoints.length, 'Generating Scenes', 'acts');
        
        // Generate scenes for each structural element that has plot points sequentially
        // Get current totalScenes value from calculator widget
        const totalScenesInput = document.getElementById('totalScenes');
        const currentTotalScenes = totalScenesInput ? parseInt(totalScenesInput.value) || 70 : 70;
        
        for (let i = 0; i < actsWithPlotPoints.length; i++) {
            const structureKey = actsWithPlotPoints[i];
            const actNumber = i + 1;
            
            console.log(`Generating scenes for: ${structureKey}`);
            
            // Update hierarchy display
            progressTracker.updateHierarchy(actNumber, actsWithPlotPoints.length);
            
            const response = await fetch(`/api/generate-all-scenes-for-act/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    model: getSelectedModel(),
                    totalScenes: currentTotalScenes,
                    creativeDirections: getRelevantCreativeDirections('scenes', { structureKey }) // 🚀 OPTIMIZED: Send only relevant creative directions
                }),
                signal: progressTracker.abortController?.signal
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log(`Hierarchical scenes generated for ${structureKey}:`, data);
                
                // Store scenes in app state - flatten plot point structure
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
                
                // Update preview with ALL scenes for this act
                if (allScenes && allScenes.length > 0) {
                    // Group scenes by plot point to get proper numbering
                    const scenesByPlotPoint = {};
                    allScenes.forEach(scene => {
                        const plotPointIndex = scene.plotPointIndex || 0;
                        if (!scenesByPlotPoint[plotPointIndex]) {
                            scenesByPlotPoint[plotPointIndex] = [];
                        }
                        scenesByPlotPoint[plotPointIndex].push(scene);
                    });
                    
                    // Display scenes with proper hierarchical numbering
                    Object.keys(scenesByPlotPoint).forEach(plotPointIndex => {
                        const plotPointScenes = scenesByPlotPoint[plotPointIndex];
                        plotPointScenes.forEach((scene, sceneIndex) => {
                            const sceneText = scene.scene || scene.description || scene.title || 'Scene generated';
                            const hierarchicalNumber = `${actNumber}.${parseInt(plotPointIndex) + 1}.${sceneIndex + 1}`;
                            progressTracker.updatePreview(sceneText, hierarchicalNumber);
                        });
                    });
                }
                
                // Increment progress step
                progressTracker.incrementStep(`Generated ${allScenes.length} scenes`);
            } else {
                throw new Error(`Failed to generate scenes for ${structureKey}: ${data.error}`);
            }
        }
        
        // Refresh the scenes display after all scenes are generated
        displayScenes(appState.generatedScenes);
        
        // 🔥 Refresh credits after successful generation
        window.creditWidget.refreshAfterOperation();
        
        // 🔥 FIX: Update navigation system when scenes are generated
        updateStepIndicators();
        updateUniversalNavigation();
        updateBreadcrumbNavigation();
        
        progressTracker.finish();
        showToast(`Successfully generated scenes for ${actsWithPlotPoints.length} acts!`, 'success');
        
        updateGenerateAllScenesButton(); // Update button to show "Regenerate All Scenes"
        saveToLocalStorage();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Scenes generation cancelled by user');
            return; // Don't show error toast for cancellation
        }
        
        console.error('Error generating all scenes:', error);
        showToast(`Error generating scenes: ${error.message}`, 'error');
        progressTracker.finish();
    }
}

// Preview all scenes generation prompts
async function previewAllScenesPrompt() {
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
                totalScenes: currentTotalScenes
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

// Update the scenes generation to use plot points
function displayScenes(scenes) {
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

// Project Header Management
function showProjectHeader(projectData) {
    const indicator = document.getElementById('currentProjectIndicator');
    const projectNameEl = document.getElementById('currentProjectName');
    
    if (projectData && indicator && projectNameEl) {
        projectNameEl.textContent = projectData.title || 'Untitled Project';
        indicator.style.display = 'flex';
    }
}

function hideProjectHeader() {
    const indicator = document.getElementById('currentProjectIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function getCurrentStep() {
    // Find the currently active step
    const activeStep = document.querySelector('.workflow-step.active');
    if (activeStep) {
        const stepId = activeStep.id;
        return parseInt(stepId.replace('step', ''));
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

// Navigate to dialogue generation (removed approval concept)
function goToDialogue() {
    if (!appState.generatedScenes) {
        showToast('No scenes available for dialogue generation.', 'error');
        return;
    }
    
    displayDialogueGeneration();
    goToStep(6); // Go to dialogue step (now step 6)
    showToast('Ready to generate dialogue!', 'success');
}

// Helper function to calculate hierarchical scene number
function calculateHierarchicalSceneNumber(structureKey, sceneIndex, scene) {
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

// Display dialogue generation interface
// Display hierarchical dialogue content: Act -> Plot Points -> Scenes (with dialogue)
// This mirrors the scenes hierarchy but with compact act/plot point levels to focus on dialogue
function displayHierarchicalDialogueContent(structureKey, plotPoints, sceneGroup, actNumber) {
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

// Generate dialogue for all scenes that exist
async function generateAllDialogue() {
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
            
            console.log(`Generating dialogue for scene: ${scene.title || 'Untitled'} (${sceneId})`);
            
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
                console.log(`Dialogue generated for ${sceneId}:`, data.dialogue);
                
                // Store dialogue in app state
                appState.generatedDialogues[sceneId] = data.dialogue;
                
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
        
        // Update all editable blocks with new dialogue content
        if (window.editableBlocks) {
            allScenes.forEach(sceneData => {
                const { structureKey, sceneIndex, sceneId } = sceneData;
                const dialogueContent = appState.generatedDialogues[sceneId];
                
                if (dialogueContent) {
                    // Find and update the editable block that matches this scene
                    Object.values(window.editableBlocks).forEach(block => {
                        if (block.metadata && 
                            block.metadata.structureKey === structureKey && 
                            block.metadata.sceneIndex === sceneIndex &&
                            block.type === 'dialogue') {
                            block.updateContent(dialogueContent);
                        }
                    });
                }
            });
        }
        
        // Refresh the dialogue display after all dialogues are generated
        displayDialogueGeneration();
        
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
            console.log('Dialogue generation cancelled by user');
            return; // Don't show error toast for cancellation
        }
        
        console.error('Error generating all dialogue:', error);
        showToast(`Error generating dialogue: ${error.message}`, 'error');
        progressTracker.finish();
    }
}

// Preview all dialogue generation prompts
async function previewAllDialoguePrompts() {
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
                    scene: scene
                });
            });
        }
    });
    
    if (allScenes.length === 0) {
        showToast('No scenes found. Please generate scenes first in Step 5.', 'error');
        return;
    }

    try {
        showLoading('Generating all dialogue prompts preview...');
        
        // For simplicity, we'll preview the prompt for the first scene
        // In a more complete implementation, you might show all prompts or let user select
        const firstScene = allScenes[0];
        
        const response = await fetch('/api/preview-dialogue-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                scene: firstScene.scene,
                storyInput: appState.storyInput,
                context: `This scene is part of the ${firstScene.structureKey.replace(/_/g, ' ')} section of the story.`,
                projectPath: appState.projectPath,
                structureKey: Object.keys(appState.generatedStructure).indexOf(firstScene.structureKey),
                sceneIndex: firstScene.sceneIndex
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the prompt data for the modal
            appState.currentDialoguePrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                scene: firstScene.scene,
                structureKey: firstScene.structureKey,
                sceneIndex: firstScene.sceneIndex,
                hierarchicalPrompt: data.hierarchicalPrompt,
                previewNote: `This shows the prompt structure for generating dialogue. This example is for "${firstScene.scene.title || 'Untitled Scene'}" - similar prompts will be used for all ${allScenes.length} scenes.`
            };
            
            // Show the dialogue prompt modal
            showDialoguePromptModal();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to generate dialogue prompt preview');
        }
    } catch (error) {
        console.error('Error generating all dialogue prompts preview:', error);
        showToast('Error generating dialogue prompt preview. Please try again.', 'error');
        hideLoading();
    }
}

// Finalize script
function finalizeScript() {
    if (Object.keys(appState.generatedDialogues).length === 0) {
        showToast('Please generate dialogue for at least one scene.', 'error');
        return;
    }
    
    assembleScript();
    goToStep(7); // Go to final script step (now step 7)
    showToast('Script assembled with your generated scenes!', 'success');
}

// Assemble final script in professional format
function assembleScript() {
    let script = '';
    let sceneNumber = 1;
    let totalGeneratedScenes = 0;
    let totalScenes = 0;
    
    // Debug logging (minimal)
    console.log('=== ASSEMBLE SCRIPT DEBUG ===');
    
    // Professional title page
    script += generateTitlePage();
    
    // Start screenplay content
    script += '\n\n\nFADE IN:\n\n';
    
    // Count total available dialogues first
    const totalDialogues = Object.keys(appState.generatedDialogues || {}).length;
    console.log('Total dialogues available:', totalDialogues);
    console.log('Available dialogue keys:', Object.keys(appState.generatedDialogues || {}));
    console.log('Template structure exists:', !!appState.templateData?.structure);
    console.log('Generated scenes exists:', !!appState.generatedScenes);
    console.log('Generated plot points exists:', !!appState.plotPoints);
    console.log('Available plot point keys:', Object.keys(appState.plotPoints || {}));
    console.log('Full appState.plotPoints:', appState.plotPoints);
    console.log('🔍 SCENE DEBUGGING - Full appState.generatedScenes:', appState.generatedScenes);
    console.log('🔍 SCENE DEBUGGING - Scene keys:', Object.keys(appState.generatedScenes || {}));
    
    // Always use template structure as foundation if available
    if (appState.templateData && appState.templateData.structure) {
        console.log('Using complete template structure with hierarchical fallbacks');
        const templateStructure = appState.templateData.structure;
        console.log('Template structure keys:', Object.keys(templateStructure));
        
        Object.keys(templateStructure).forEach((actKey) => {
            const act = templateStructure[actKey];
            console.log(`Processing act: ${actKey}`);
            
            // Check if we have plot points for this act
            const plotPoints = appState.plotPoints && appState.plotPoints[actKey];
            console.log(`Plot points for ${actKey}:`, plotPoints);
            
            if (plotPoints && Array.isArray(plotPoints)) {
                // Track overall scene count for this act (for old dialogue key fallback)
                let actSceneCount = 0;
                
                // Process each plot point
                plotPoints.forEach((plotPoint, plotIndex) => {
                    const plotPointKey = `${actKey}-${plotIndex}`;
                    
                    // Check if we have scenes for this plot point
                    const scenes = appState.generatedScenes && appState.generatedScenes[plotPointKey];
                    console.log(`🔍 Looking for scenes with key: ${plotPointKey}`);
                    console.log(`🔍 Found scenes:`, scenes);
                    
                    if (scenes && Array.isArray(scenes)) {
                        // Process each scene
                        scenes.forEach((scene, sceneIndex) => {
                            const sceneId = `${plotPointKey}-${sceneIndex}`;
                            totalScenes++;
                            
                            // 1. Check for dialogue (highest priority)
                            let dialogueFound = false;
                            let dialogueContent = null;
                            
                            console.log(`Looking for dialogue for scene ${sceneId}, title: ${scene.title}`);
                            
                            // Try multiple key formats for dialogue
                            if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                                dialogueContent = appState.generatedDialogues[sceneId];
                                dialogueFound = true;
                                console.log(`Found dialogue using sceneId: ${sceneId}`);
                            }
                            else if (appState.generatedDialogues && scene.title && appState.generatedDialogues[scene.title]) {
                                dialogueContent = appState.generatedDialogues[scene.title];
                                dialogueFound = true;
                                console.log(`Found dialogue using scene title: ${scene.title}`);
                            }
                            else if (appState.generatedDialogues && scene.title) {
                                const normalizedTitle = scene.title.replace(/\s+/g, '_');
                                if (appState.generatedDialogues[normalizedTitle]) {
                                    dialogueContent = appState.generatedDialogues[normalizedTitle];
                                    dialogueFound = true;
                                    console.log(`Found dialogue using normalized title: ${normalizedTitle}`);
                                }
                            }
                            // FALLBACK: Try old dialogue key formats
                            else {
                                // Try old format with overall act scene count (actKey-actSceneCount)
                                const oldFormatKey1 = `${actKey}-${actSceneCount}`;
                                if (appState.generatedDialogues && appState.generatedDialogues[oldFormatKey1]) {
                                    dialogueContent = appState.generatedDialogues[oldFormatKey1];
                                    dialogueFound = true;
                                    console.log(`Found dialogue using old format key (act scene count): ${oldFormatKey1}`);
                                }
                                // Try old format with plot point scene index (actKey-sceneIndex)
                                else {
                                    const oldFormatKey2 = `${actKey}-${sceneIndex}`;
                                    if (appState.generatedDialogues && appState.generatedDialogues[oldFormatKey2]) {
                                        dialogueContent = appState.generatedDialogues[oldFormatKey2];
                                        dialogueFound = true;
                                        console.log(`Found dialogue using old format key (plot scene index): ${oldFormatKey2}`);
                                    }
                                }
                            }
                            
                            if (!dialogueFound) {
                                console.log(`No dialogue found for scene ${sceneId} with title ${scene.title}`);
                            }
                            
                            if (dialogueFound) {
                                // Dialogue exists - use it
                                script += formatSceneForScreenplay(dialogueContent, sceneNumber);
                                totalGeneratedScenes++;
                            } else {
                                // 2. No dialogue - fall back to scene description
                                script += formatPlaceholderScene(scene, sceneNumber);
                            }
                            
                            actSceneCount++;
                            sceneNumber++;
                        });
                    } else {
                        // 3. No scenes - but check for dialogue first (since dialogue can't exist without scenes)
                        console.log(`🔍 No scenes found for ${plotPointKey}, but checking for dialogue anyway`);
                        
                        // If we have dialogue, there MUST be scenes somewhere - let's find them
                        let dialogueFound = false;
                        let dialogueContent = null;
                        
                        if (appState.generatedDialogues) {
                            // Try the old format that corresponds to this plot point
                            const possibleKeys = [
                                `${actKey}-${plotIndex}`,
                                `${actKey}-0`, // First scene in act
                                `${actKey}-${sceneNumber-1}` // Based on scene number
                            ];
                            
                            for (const key of possibleKeys) {
                                if (appState.generatedDialogues[key]) {
                                    dialogueContent = appState.generatedDialogues[key];
                                    dialogueFound = true;
                                    console.log(`🔍 Found dialogue for ${plotPointKey} using key: ${key}`);
                                    break;
                                }
                            }
                        }
                        
                        totalScenes++;
                        if (dialogueFound) {
                            script += formatSceneForScreenplay(dialogueContent, sceneNumber);
                            totalGeneratedScenes++;
                        } else {
                            script += formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber);
                        }
                        sceneNumber++;
                    }
                });
            } else {
                // 4. No plot points - fall back to act description
                console.log(`No plot points for ${actKey}, using act fallback`);
                
                // Before falling back to act description, try to find any dialogue that starts with this actKey
                let foundOldDialogue = false;
                if (appState.generatedDialogues) {
                    const dialogueKeys = Object.keys(appState.generatedDialogues);
                    console.log(`Checking for old-format dialogue for ${actKey}, available keys:`, dialogueKeys);
                    const matchingKey = dialogueKeys.find(key => key.startsWith(actKey + '-'));
                    if (matchingKey) {
                        console.log(`Found old-format dialogue for ${actKey}: ${matchingKey}`);
                        script += formatSceneForScreenplay(appState.generatedDialogues[matchingKey], sceneNumber);
                        totalGeneratedScenes++;
                        foundOldDialogue = true;
                    } else {
                        console.log(`No old-format dialogue found for ${actKey}`);
                    }
                }
                
                if (!foundOldDialogue) {
                    script += formatActFallback(act, actKey, sceneNumber);
                }
                
                totalScenes++;
                sceneNumber++;
            }
        });
    }
    // Legacy fallback: if no template structure, try to use existing generated content
    else if (appState.generatedScenes && Object.keys(appState.generatedScenes).length > 0) {
        console.log('No template structure, using existing generated scenes');
        let structureKeys = Object.keys(appState.generatedScenes);
        
        structureKeys.forEach((structureKey) => {
            const sceneGroup = appState.generatedScenes[structureKey];
            if (sceneGroup && Array.isArray(sceneGroup)) {
                sceneGroup.forEach((scene, index) => {
                    const sceneId = `${structureKey}-${index}`;
                    totalScenes++;
                    
                    // Check for dialogue
                    let dialogueFound = false;
                    let dialogueContent = null;
                    
                    if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                        dialogueContent = appState.generatedDialogues[sceneId];
                        dialogueFound = true;
                    }
                    else if (appState.generatedDialogues && scene.title && appState.generatedDialogues[scene.title]) {
                        dialogueContent = appState.generatedDialogues[scene.title];
                        dialogueFound = true;
                    }
                    
                    if (dialogueFound) {
                        script += formatSceneForScreenplay(dialogueContent, sceneNumber);
                        totalGeneratedScenes++;
                    } else {
                        script += formatPlaceholderScene(scene, sceneNumber);
                    }
                    
                    sceneNumber++;
                });
            }
        });
    } else {
        // Final fallback: if no structure at all, just add generated dialogues
        console.log('No structure, using fallback dialogue method');
        console.log('Available dialogues in fallback:', Object.keys(appState.generatedDialogues || {}));
        Object.values(appState.generatedDialogues || {}).forEach(dialogue => {
            script += formatSceneForScreenplay(dialogue, sceneNumber);
            totalGeneratedScenes++;
            sceneNumber++;
        });
        totalScenes = totalGeneratedScenes;
    }
    
    script += '\n\nFADE OUT.\n\nTHE END';
    
    // Display script preview
    document.getElementById('scriptPreview').textContent = script;
    
    // Add scene navigation
    addSceneNavigation();
    
    // Update statistics with better page estimation
    const estimatedPages = Math.ceil(script.split('\n').length / 55); // ~55 lines per page
    
    console.log(`Final counts - Generated: ${totalGeneratedScenes}, Total: ${totalScenes}`);
    
    // Update DOM elements with correct IDs for final script display
    const totalScenesElement = document.getElementById('totalScenesDisplay');
    const estimatedPagesElement = document.getElementById('estimatedPagesDisplay');
    
    console.log('totalScenesDisplay element:', totalScenesElement);
    console.log('estimatedPagesDisplay element:', estimatedPagesElement);
    
    if (totalScenesElement) {
        totalScenesElement.textContent = `${totalGeneratedScenes}/${totalScenes} scenes`;
        console.log(`Updated totalScenesDisplay to: ${totalGeneratedScenes}/${totalScenes} scenes`);
    } else {
        console.error('totalScenesDisplay element not found!');
    }
    
    if (estimatedPagesElement) {
        estimatedPagesElement.textContent = estimatedPages;
        console.log(`Updated estimatedPagesDisplay to: ${estimatedPages}`);
    } else {
        console.error('estimatedPagesDisplay element not found!');
    }
    
    saveToLocalStorage();
}

// Generate professional title page
function generateTitlePage() {
    const title = appState.storyInput?.title || 'UNTITLED';
    
    // Use actual username if available, otherwise generic
    const author = appState.user?.username || 'Writer';
    
    // Contact info in bottom right corner (just email is sufficient for spec scripts)
    const contactInfo = appState.user?.email || 'writer@example.com';
    
    return `




                                    ${title.toUpperCase()}


                                   written by

                                    ${author}
























                                                     ${contactInfo}`;
}

// Format scene for professional screenplay layout
function formatSceneForScreenplay(dialogue, sceneNumber) {
    // Add page break suggestion every few scenes
    let formatted = '';
    
    if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
        formatted += '\n\n                         [PAGE BREAK]\n\n';
    }
    
    // Clean up and format the dialogue
    const lines = dialogue.split('\n');
    let inDialogue = false;
    let currentCharacter = '';
    
    for (let line of lines) {
        line = line.trim();
        if (!line) {
            formatted += '\n';
            continue;
        }
        
        // Scene headings (INT./EXT.)
        if (line.match(/^(INT\.|EXT\.)/i)) {
            formatted += `\nSCENE ${sceneNumber}\n\n${line.toUpperCase()}\n\n`;
        }
        // Character names (all caps, no colon)
        else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
            currentCharacter = line.replace(':', '').trim();
            formatted += `                    ${currentCharacter}\n`;
            inDialogue = true;
        }
        // Parentheticals
        else if (line.match(/^\(.+\)$/)) {
            formatted += `                  ${line}\n`;
        }
        // Dialogue lines
        else if (inDialogue && !line.match(/^(INT\.|EXT\.)/i)) {
            // Center dialogue text
            formatted += `          ${line}\n`;
        }
        // Action lines
        else {
            formatted += `${line}\n`;
            inDialogue = false;
        }
    }
    
    formatted += '\n\n';
    return formatted;
}

// Format placeholder scene professionally
function formatPlaceholderScene(scene, sceneNumber) {
    const location = scene.location || 'LOCATION NOT SPECIFIED';
    const time = scene.time_of_day || scene.time || 'TIME NOT SPECIFIED';
    const sceneHeading = `INT. ${location.toUpperCase()} - ${time.toUpperCase()}`;
    
    let formatted = '';
    
    if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
        formatted += '\n\n                         [PAGE BREAK]\n\n';
    }
    
    formatted += `SCENE ${sceneNumber}\n\n${sceneHeading}\n\n`;
    formatted += `${scene.description || 'Scene description not available.'}\n\n`;
    formatted += `                    [DIALOGUE NOT GENERATED]\n\n`;
    formatted += `          This scene requires dialogue generation\n`;
    formatted += `          to complete the screenplay.\n\n\n`;
    
    return formatted;
}

// Format plot point fallback when no scenes exist
function formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber) {
    let formatted = '';
    
    if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
        formatted += '\n\n                         [PAGE BREAK]\n\n';
    }
    
    formatted += `SCENE ${sceneNumber}\n\n`;
    formatted += `INT. LOCATION TO BE DETERMINED - DAY\n\n`;
    formatted += `${plotPoint.description || plotPoint.title || 'Plot point description not available.'}\n\n`;
    formatted += `                    [SCENES NOT GENERATED]\n\n`;
    formatted += `          This plot point requires scene generation\n`;
    formatted += `          to break down into specific scenes.\n\n\n`;
    
    return formatted;
}

// Format act fallback when no plot points exist
function formatActFallback(act, actKey, sceneNumber) {
    let formatted = '';
    
    if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
        formatted += '\n\n                         [PAGE BREAK]\n\n';
    }
    
    formatted += `SCENE ${sceneNumber}\n\n`;
    formatted += `INT. LOCATION TO BE DETERMINED - DAY\n\n`;
    
    // Try to get the generated act title first, then fall back to template
    let actContent = '';
    const generatedAct = appState.generatedStructure && appState.generatedStructure[actKey];
    
    if (generatedAct && generatedAct.name) {
        // Use generated act title
        actContent = generatedAct.name;
    } else if (generatedAct && generatedAct.description) {
        // Use generated act description
        actContent = generatedAct.description;
    } else {
        // Fall back to template
        actContent = act.description || act.title || 'Act description not available.';
    }
    
    formatted += `${actContent}\n\n`;
    formatted += `                    [PLOT POINTS NOT GENERATED]\n\n`;
    formatted += `          This act requires plot point generation\n`;
    formatted += `          to break down into specific story beats.\n\n\n`;
    
    console.log(`🚨 formatActFallback called for ${actKey} - this should not happen if plot points exist!`);
    console.log(`🔍 appState.plotPoints:`, appState.plotPoints);
    console.log(`🔍 Available plot point keys:`, Object.keys(appState.plotPoints || {}));
    
    return formatted;
}

// Export script
async function exportScript(format = 'text') {
    if (!appState.storyInput || Object.keys(appState.generatedDialogues).length === 0) {
        showToast('No script to export.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectData: appState,
                format: format,
                projectPath: appState.projectPath
            })
        });
        
        if (format === 'json') {
            const data = await response.json();
            downloadFile(JSON.stringify(data, null, 2), `${appState.storyInput.title || 'script'}.json`, 'application/json');
        } else {
            // Let the browser handle the download using server's headers (preserves correct filename and content-type)
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Extract filename from server response headers if available
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `${appState.storyInput.title || 'script'}.txt`; // fallback
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
        
        // Mark as exported and update step indicators
        appState.hasExported = true;
        updateStepIndicators();
        updateUniversalNavigation();
        updateBreadcrumbNavigation();
        saveToLocalStorage();
        
        showToast('Script exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting script:', error);
        showToast('Error exporting script. Please try again.', 'error');
    }
}

// Save project
async function saveProject() {
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

// Utility function to download files
function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 🔧 EXTRACTED TO: components/progress-tracker.js
// Functions moved: forceGoToStep, goToStep, goToStepInternal, canNavigateToStep, isStepFullyComplete, handleStepClick

// 🔧 EXTRACTED TO: components/progress-tracker.js
// Functions moved: updateProgressBar, updateStepIndicators, updateAllProgressMeters, updateStepHeaderProgressMeter, startOver

// New Project - Save current project and start fresh
async function newProject() {
    // If there's no current project data, just start fresh
    if (!appState.storyInput || !appState.storyInput.title) {
        showToast('Starting new project...', 'info');
        startFreshProject();
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
                startFreshProject();
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
            startFreshProject();
        }
    }
}

// Clear all content containers when starting fresh
function clearAllContentContainers() {
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
function startFreshProject() {
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
        customPrompt: null,
        originalPrompt: null,
        isEditMode: false,
        plotPoints: {},
        totalPlotPoints: null,  // Reset to null so template default will be used
        manuallySetPlotPoints: {},  // Reset manual tracking
        currentActPlotPoints: {},    // Reset current values tracking
        currentStoryConcept: null,   // Clear story concept
        generatedPlotPoints: {},     // Clear plot points
        user: appState.user,         // Preserve user data
        apiKey: appState.apiKey,     // Preserve API key
        isAuthenticated: appState.isAuthenticated  // Preserve auth state
    });
    
    // Clear template UI selection state
    document.querySelectorAll('.template-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Hide selected template display
    const selectedDisplay = document.getElementById('selectedTemplateDisplay');
    if (selectedDisplay) {
        selectedDisplay.style.display = 'none';
    }
    
    // Reset template step description
    const stepDescription = document.getElementById('templateStepDescription');
    if (stepDescription) {
        stepDescription.textContent = 'Select a story structure template that best fits your narrative:';
    }
    
    // Expand template options
    expandTemplateOptions();
    
    // Clear story concept
    appState.currentStoryConcept = null;
    updateStoryConceptDisplay();
    // Clear project characters
    appState.projectCharacters = [];
    updateCharacterTags();
    document.getElementById('totalScenes').value = '70';
    
    // Clear influences arrays
    appState.influences = { directors: [], screenwriters: [], films: [], tones: [] };
    
    // Clear influence tags
    updateInfluenceTags('director');
    updateInfluenceTags('screenwriter');
    updateInfluenceTags('film');
    updateInfluenceTags('tone');
    
    // Hide project header
    hideProjectHeader();
    
    // Clear any existing content displays
    clearAllContentContainers();
    
    // Go to step 1
    goToStep(1);
    
    // Clear localStorage
    localStorage.removeItem('filmScriptGenerator');
    
    // Update autogenerate button visibility (should show for fresh project)
    console.log('🆕 About to update button visibility for fresh project');
    updateAutoGenerateButtonVisibility();
    
    // Force ensure autogenerate button is visible for fresh project
    const autoGenerateBtn = document.getElementById('autoGenerateBtn');
    if (autoGenerateBtn) {
        autoGenerateBtn.style.display = 'inline-block';
        console.log('🆕 Forced autogenerate button visible');
    }
    
    showToast('Ready to create your new project!', 'success');
    
    // Clear the flag after a short delay to allow UI updates
    setTimeout(() => {
        window.startingFreshProject = false;
        console.log('🆕 Fresh project flag cleared');
    }, 1000);
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

// Loading functions
function showLoading(message = 'Loading...') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

// Toast notification functions
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    elements.toast.classList.remove('show');
}

// 🔧 Creative Direction Functions moved to components/creative-direction-manager.js
// Legacy compatibility functions are provided by the component

// Normalize generated scenes data structure
function normalizeGeneratedScenes(scenesData) {
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
function normalizeGeneratedDialogues(dialoguesData) {
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

// ✅ Save to localStorage - MOVED TO components/app-state-manager.js
// Legacy function for backward compatibility
function saveToLocalStorage() {
    if (window.appStateManagerInstance) {
        window.appStateManagerInstance.saveToLocalStorage();
    }
}

// Load Project Modal Functions
async function showLoadProjectModal() {
    const modal = document.getElementById('loadProjectModal');
    const projectsList = document.getElementById('projectsList');
    
    modal.classList.add('show');
    projectsList.innerHTML = '<p>Loading projects...</p>';
    
    try {
        const username = appState.user?.username || 'guest';
        const response = await fetch(`/api/list-projects?username=${encodeURIComponent(username)}`);
        const projects = await response.json();
        
        if (projects.length === 0) {
            projectsList.innerHTML = '<p style="text-align: center; color: #718096;">No previous projects found.</p>';
            return;
        }
        
        projectsList.innerHTML = '';
        
        projects.forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.innerHTML = generateProjectCard(project, 'modal');
            projectsList.appendChild(projectDiv.firstElementChild);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        projectsList.innerHTML = '<p style="color: red; text-align: center;">Error loading projects. Please try again.</p>';
    }
}

function hideLoadProjectModal() {
    document.getElementById('loadProjectModal').classList.remove('show');
}

async function loadProject(projectPath) {
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
        
        const projectData = await response.json();
        console.log('Project data loaded:', projectData);
        
        try {
            // Populate all form fields with loaded data
            console.log('About to call populateFormWithProject...');
            console.log('Project data being passed:', projectData);
            await populateFormWithProject(projectData);
            console.log('populateFormWithProject completed successfully');
        } catch (error) {
            console.error('Error in populateFormWithProject:', error);
            console.error('Error stack:', error.stack);
            showToast(`Error loading project: ${error.message}`, 'error');
        }
        
        // Hide modal
        hideLoadProjectModal();
        hideLoading();
        
    } catch (error) {
        console.error('Error loading project:', error);
        showToast(`Error loading project: ${error.message}`, 'error');
        hideLoading();
    }
}

async function populateFormWithProject(projectData, showToastMessage = true, isRestore = false) {
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

// Show scene prompt modal
function showScenePromptModal() {
    const modal = document.getElementById('scenePromptModal');
    const prompt = appState.currentScenePrompt;
    
    // Populate modal content
    document.getElementById('scenePromptSystemMessage').textContent = prompt.systemMessage;
    document.getElementById('scenePromptUserPrompt').textContent = prompt.userPrompt;
    
    // Update modal title
    const modalTitle = document.querySelector('#scenePromptModal .modal-header h3');
    
    if (prompt.previewNote) {
        // This is for "Generate All Scenes" preview
        modalTitle.textContent = 'All Scenes Generation Prompt Preview';
        
        // Add or update preview note
        let previewNoteElement = document.getElementById('scenePromptPreviewNote');
        if (!previewNoteElement) {
            previewNoteElement = document.createElement('div');
            previewNoteElement.id = 'scenePromptPreviewNote';
            previewNoteElement.className = 'prompt-preview-note';
            previewNoteElement.style.cssText = 'background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; padding: 10px; margin-bottom: 15px; font-size: 0.9rem; color: #1565c0;';
            
            const modalBody = document.querySelector('#scenePromptModal .modal-body');
            modalBody.insertBefore(previewNoteElement, modalBody.firstChild);
        }
        previewNoteElement.textContent = `ℹ️ ${prompt.previewNote}`;
        previewNoteElement.style.display = 'block';
    } else {
        // This is for individual scene prompt
        if (prompt.isElementGeneration) {
            modalTitle.textContent = `Scene Generation Prompt - ${prompt.structureElement.name}`;
        } else {
            modalTitle.textContent = `Scene Generation Prompt - ${prompt.structureElement.name} (Scene ${prompt.sceneIndex + 1})`;
        }
        
        // Hide preview note if it exists
        const previewNoteElement = document.getElementById('scenePromptPreviewNote');
        if (previewNoteElement) {
            previewNoteElement.style.display = 'none';
        }
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Hide scene prompt modal
function hideScenePromptModal() {
    document.getElementById('scenePromptModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Show plot point prompt modal
function showPlotPointPromptModal() {
    const modal = document.getElementById('plotPointPromptModal');
    const prompt = appState.currentPlotPointsPrompt || appState.currentPlotPrompt;
    
    console.log('showPlotPointPromptModal called');
    console.log('appState.currentPlotPointsPrompt:', appState.currentPlotPointsPrompt);
    console.log('appState.currentPlotPrompt:', appState.currentPlotPrompt);
    console.log('Using prompt:', prompt);
    
    if (!prompt) {
        showToast('No prompt data available.', 'error');
        return;
    }
    
    // Populate modal content
    document.getElementById('plotPointPromptSystemMessage').textContent = prompt.systemMessage;
    document.getElementById('plotPointPromptUserPrompt').textContent = prompt.userPrompt;
    
    // Update modal title
    const modalTitle = document.querySelector('#plotPointPromptModal .modal-header h3');
    console.log('prompt.promptType:', prompt.promptType);
    console.log('prompt.storyAct:', prompt.storyAct);
    console.log('prompt.isAllPlotPoints:', prompt.isAllPlotPoints);
    
    if (prompt.promptType === 'act_plot_points') {
        modalTitle.textContent = `Plot Points Generation Prompt - ${prompt.storyAct.name}`;
        console.log('Set title to act:', prompt.storyAct.name);
    } else if (prompt.isAllPlotPoints) {
        modalTitle.textContent = 'Plot Point Generation Prompt - All Scenes';
        console.log('Set title to All Scenes');
    } else {
        modalTitle.textContent = `Plot Point Generation Prompt - Scene ${prompt.actualSceneIndex + 1}`;
        console.log('Set title to Scene:', prompt.actualSceneIndex + 1);
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Hide plot point prompt modal
function hidePlotPointPromptModal() {
    document.getElementById('plotPointPromptModal').classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Preview all plot points generation prompt
async function previewAllPlotPointsPrompt() {
    if (!appState.generatedStructure || !appState.storyInput || !appState.generatedScenes) {
        showToast('No structure, story data, or scenes available for prompt preview.', 'error');
        return;
    }

    // Check if we have a generated structure (plot points are generated FROM structure, not scenes)
    if (!appState.generatedStructure || Object.keys(appState.generatedStructure).length === 0) {
        showToast('No story structure found. Please generate a structure first.', 'error');
        return;
    }

    // Build structure elements array for the prompt
    const structureElements = [];
    Object.entries(appState.generatedStructure).forEach(([key, act]) => {
        structureElements.push({
            key: key,
            name: act.name || key.replace(/_/g, ' ').toUpperCase(),
            description: act.description || '',
            characterDevelopments: act.character_developments || act.character_development || ''
        });
    });

    try {
        showLoading('Generating all plot points prompt preview...');
        
        const response = await fetch('/api/preview-plot-point-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                structure: appState.generatedStructure,
                templateData: appState.templateData,
                structureElements: structureElements
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the prompt data for the modal
            appState.currentPlotPrompt = {
                systemMessage: data.systemMessage,
                userPrompt: data.prompt,
                promptType: data.promptType,
                isAllPlotPoints: true
            };
            
            // Show the plot point prompt modal
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

async function deleteProject(projectPath, projectTitle) {
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
        showLoadProjectModal();
        
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast(`Error deleting project: ${error.message}`, 'error');
        hideLoading();
    }
}

async function duplicateProject(projectPath, projectTitle) {
    try {
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
        showLoadProjectModal();
        
    } catch (error) {
        console.error('Error duplicating project:', error);
        showToast(`Error duplicating project: ${error.message}`, 'error');
        hideLoading();
    }
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
function displayScenesForElement(structureKey, sceneGroup, customContainer = null) {
    const container = customContainer || document.getElementById(`scenes-${structureKey}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (Array.isArray(sceneGroup)) {
        sceneGroup.forEach((scene, index) => {
            const sceneContent = JSON.stringify(scene);
            const sceneTitle = `Scene ${index + 1}: ${scene.title || scene.name || 'Untitled Scene'}`;
            
            createEditableContentBlock({
                id: `scene-${structureKey}-${index}`,
                type: 'scenes',
                title: sceneTitle,
                content: sceneContent,
                container: container,
                metadata: { structureKey: structureKey, sceneIndex: index },
                onSave: async (newContent, block) => {
                    // Save the edited scene content
                    await saveSceneContent(structureKey, index, newContent);
                    
                    // Update the app state
                    let updatedScene;
                    try {
                        updatedScene = JSON.parse(newContent);
                    } catch (e) {
                        // If not valid JSON, update description
                        updatedScene = { ...scene, description: newContent };
                    }
                    
                    if (appState.generatedScenes && appState.generatedScenes[structureKey] && appState.generatedScenes[structureKey][index]) {
                        appState.generatedScenes[structureKey][index] = { ...appState.generatedScenes[structureKey][index], ...updatedScene };
                    }
                    
                    // Save to local storage
                    saveToLocalStorage();
                }
            });
            
            // Individual scene actions removed - use plot point level generation instead
        });
    }
}

// Save scene content function
async function saveSceneContent(structureKey, sceneIndex, content) {
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

// Continue to next step after template selection
function goToNextStep() {
    if (!appState.selectedTemplate) {
        showToast('Please select a template first.', 'error');
        return;
    }
    
    // Navigate to Acts page
    goToStep(3);
    saveToLocalStorage();
}

// Display selected template on Acts page
// ✅ Display selected template - MOVED TO components/template-manager.js
// Legacy function for backward compatibility
function displaySelectedTemplate(templateData) {
    if (window.templateManagerInstance) {
        return window.templateManagerInstance.displaySelectedTemplate(templateData);
    }
}

// NEW: Display template structure preview in Step 3 (UNIFIED CONTAINERS)
async function displayTemplateStructurePreview() {
    if (!appState.selectedTemplate) {
        console.log('No template selected for structure preview');
        return;
    }
    
    // Check if we already have generated structure - if so, display it instead of preview
    if (appState.generatedStructure && Object.keys(appState.generatedStructure).length > 0) {
        console.log('Generated structure already exists, displaying actual structure');
        displayStructure(appState.generatedStructure, appState.lastUsedPrompt, appState.lastUsedSystemMessage);
        updateActsGenerationButton(); // Update button to show "Regenerate Acts"
        return;
    }

    // 🔧 FIX: Check for existing templateData with user edits FIRST
    if (appState.templateData && appState.templateData.structure) {
        console.log('Using existing template data with user edits:', appState.templateData.name);
        
        // Use the EXISTING structure container - unified approach!
        const structureContainer = document.getElementById('structureContent');
        if (!structureContainer) {
            console.log('Structure container not found');
            return;
        }
        
        // Create preview using the modified template data (with user edits)
        createFullTemplatePreview(appState.templateData, structureContainer);
        return;
    }
    
    // Fallback: If no edited template data exists, load fresh template data
    try {
        // Get template data from existing templates (no server call needed)
        const templateData = await getTemplateDataFromExistingTemplates(appState.selectedTemplate);
        if (!templateData) {
            console.log('Template data not found, creating simple preview');
            // Create a simple preview without full template data
            createSimpleTemplatePreview();
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
        appState.templateData = templateData;
        
    } catch (error) {
        console.error('Error loading template structure preview:', error);
        showToast('Could not load template structure preview', 'error');
    }
}

// Helper function to get template data from already loaded templates
async function getTemplateDataFromExistingTemplates(templateId) {
    // Check if we have templates loaded
    if (!window.loadedTemplates) {
        console.log('Templates not loaded yet, loading...');
        await loadTemplates();
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
async function createSimpleTemplatePreview() {
    const structureContainer = document.getElementById('structureContent');
    if (!structureContainer) {
        console.log('Structure container not found');
        return;
    }
    
    try {
        // Try to load template data from the API endpoint
        const response = await fetch(`/api/template/${appState.selectedTemplate}`);
        if (response.ok) {
            const templateData = await response.json();
            console.log('Loaded template data from API:', templateData.name);
            
            // Use the full template data to create proper preview
            createFullTemplatePreview(templateData, structureContainer);
            return;
        }
    } catch (error) {
        console.log('Could not load template data from API, using basic preview');
    }
    
    // If template file loading fails, show basic preview
    createBasicTemplatePreview(structureContainer);
}

// Create full template preview with actual act structure
function createFullTemplatePreview(templateData, structureContainer) {
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
        const totalActs = Object.keys(templateData.structure).length;
        Object.entries(templateData.structure).forEach(([key, act], index) => {
            const actElement = document.createElement('div');
            actElement.className = 'structure-element preview-mode';
            actElement.setAttribute('data-act', key);
            
            const actName = act.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const actNumber = `${index + 1}/${totalActs}`;
            
                            // Check if there are creative directions
                const hasCreativeDirections = act.userDirections && act.userDirections.trim();
                const creativeDirectionsHtml = `
                    <div class="creative-direction-section">
                        <div class="creative-direction-controls">
                            <button class="btn btn-sm" 
                                    onclick="showActsCreativeDirectionModal('${key}')" 
                                    title="Add/edit creative direction for this act" 
                                    style="font-size: 0.8rem;">
                                Add creative direction for act ${index + 1}/${totalActs}
                            </button>
                            ${hasCreativeDirections ? `
                                <div class="creative-directions-preview">
                                    <strong>✨ Your Creative Directions:</strong> ${act.userDirections}
                                </div>
                            ` : `
                                <span class="creative-direction-placeholder">Add creative direction to guide act generation</span>
                            `}
                        </div>
                    </div>
                `;
                
                actElement.innerHTML = `
                    <div class="structure-element-header">
                        <h3><span class="act-progress">${actNumber}</span> ${actName}</h3>
                        <div class="structure-element-meta">
                            <span class="preview-status">Ready for generation</span>
                        </div>
                    </div>
                    <div class="structure-element-content">
                        ${creativeDirectionsHtml}
                        <div class="template-description">
                            <strong>Template Guide:</strong> ${act.description || 'No description available'}
                        </div>
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
    appState.templateData = templateData;
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
        localStorage.setItem('apiKey', apiKey);
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.removeItem('filmScriptGenerator'); // Clear old state
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

// Calculate progress for project cards based on available metadata
function calculateProjectCardProgress(project) {
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

// Shared Project Card Generator - Reuses the modal card format
function generateProjectCard(project, context = 'modal') {
    // Calculate progress based on available project data
    const progressInfo = calculateProjectCardProgress(project);
    const progressBadge = `<span class="progress-badge" title="${progressInfo.icon} ${progressInfo.label}">${progressInfo.step}/7</span>`;
    
    // Different actions based on context
    const actions = context === 'profile' ? `
        <button class="load-project-btn" onclick="event.stopPropagation(); openProject('${project.path}')">
            📁 Open Project
        </button>
        <button class="duplicate-project-btn" onclick="event.stopPropagation(); duplicateProject('${project.path}', '${project.title.replace(/'/g, "\\'")}')">
            📄 Duplicate
        </button>
        <button class="delete-project-btn" onclick="event.stopPropagation(); deleteProject('${project.path}', '${project.title.replace(/'/g, "\\'")}')">
            🗑️ Delete
        </button>
    ` : `
        <button class="load-project-btn" onclick="loadProject('${project.path}')">
            📁 Load Project
        </button>
        <button class="duplicate-project-btn" onclick="duplicateProject('${project.path}', '${project.title.replace(/'/g, "\\'")}')">
            📄 Duplicate
        </button>
        <button class="delete-project-btn" onclick="deleteProject('${project.path}', '${project.title.replace(/'/g, "\\'")}')">
            🗑️ Delete
        </button>
    `;
    
    return `
        <div class="project-item">
            <div class="project-header">
                <h4>${project.title}</h4>
                ${progressBadge}
            </div>
            <div class="project-meta">
                <strong>Last saved:</strong> ${new Date(project.updatedAt || project.createdAt).toLocaleString()}
            </div>
            <div class="project-logline">"${project.logline}"</div>
            <div class="project-actions">
                ${actions}
            </div>
        </div>
    `;
}

// Generate scenes for a structural element using proper hierarchical flow
async function generateScenesForElement(structureKey) {
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
                totalScenes: currentTotalScenes
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

// Generate scenes for a specific plot point
async function generateScenesForPlotPoint(structureKey, plotPointIndex) {
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
                creativeDirections: getRelevantCreativeDirections({ 
                    type: 'scenes', 
                    actKey: structureKey, 
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

// Enhanced Template Selection - Act Cards Functions
async function loadTemplateStructureForActCards(templateData) {
    console.log('🎭 Loading template structure for act cards:', templateData.name);
    console.log('🔍 DEBUG: Current appState.templateData:', appState.templateData);
    console.log('🔍 DEBUG: Incoming templateData:', templateData);
    
    try {
        // 🔧 FIX #3: Check if we already have customized template data
        // Compare by name since database templateData might not have id field
        const templateMatches = appState.templateData && 
            (appState.templateData.id === templateData.id || 
             appState.templateData.name === templateData.name) && 
            appState.templateData.structure;
        
        if (templateMatches) {
            console.log('🎭 Using existing customized template data (preserving user edits)');
            console.log('🔍 DEBUG: Using customized structure keys:', Object.keys(appState.templateData.structure));
            const existingTemplateData = appState.templateData;
            
            // Update the header with template name and act count
            updateActCardsHeader(existingTemplateData.name, Object.keys(existingTemplateData.structure).length);
            
            // Create and display act cards with existing (potentially edited) data
            await createActCards(existingTemplateData.structure);
        } else {
            console.log('🎭 Fetching fresh template data from server');
            console.log('🔍 DEBUG: Condition failed because:');
            console.log('  - appState.templateData exists:', !!appState.templateData);
            console.log('  - ID match:', appState.templateData?.id === templateData.id);
            console.log('  - Structure exists:', !!appState.templateData?.structure);
            
            // Fetch the full template data including structure
            const response = await fetch(`/api/template/${templateData.id}`);
            if (!response.ok) {
                throw new Error('Failed to load template structure');
            }
            
            const fullTemplateData = await response.json();
            console.log('🎭 Full template data loaded:', fullTemplateData);
            
            // Store template data in appState for editing (ensure ID is included)
            appState.templateData = {
                ...fullTemplateData,
                id: templateData.id // Ensure ID is preserved for future comparisons
            };
            
            // 🆕 Step 1: Initialize userDirections for all acts if not present (backwards compatibility)
            if (appState.templateData.structure) {
                Object.keys(appState.templateData.structure).forEach(actKey => {
                    if (!appState.templateData.structure[actKey].hasOwnProperty('userDirections')) {
                        appState.templateData.structure[actKey].userDirections = '';
                    }
                });
            }
            
            console.log('🎭 Template data stored in appState for editing');
            
            // Update the header with template name and act count
            updateActCardsHeader(fullTemplateData.name, Object.keys(fullTemplateData.structure).length);
            
            // Create and display act cards
            await createActCards(fullTemplateData.structure);
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

function updateActCardsHeader(templateName, actCount) {
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

function createActCard(act, totalActs) {
    const card = document.createElement('div');
    card.className = 'act-card';
    card.setAttribute('data-act-key', act.key);
    // 🆕 Step 1: Store userDirections in data attribute for future UI use
    card.setAttribute('data-user-directions', act.userDirections || '');
    
    // Truncate title for display (keep full title for tooltip)
    const truncatedTitle = act.name.length > 20 ? act.name.substring(0, 17) + '...' : act.name;
    const truncatedDescription = act.description.length > 80 ? act.description.substring(0, 77) + '...' : act.description;
    
    // Use consistent act numbering format like the rest of the site
    const actNumber = `${act.number}/${totalActs}`;
    
    // Get plot points from act data (handle both old and new formats)
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
        <div class="act-card-edit-controls">
            <div class="act-card-edit-primary">
                <button class="act-card-edit-btn save">Save</button>
                <button class="act-card-edit-btn cancel">Cancel</button>
                    </div>
            <div class="act-card-edit-secondary">
                <!-- Future delete button will go here -->
                </div>
                </div>
        <div class="act-card-tooltip">
            <strong>${act.name}</strong><br>
            ${act.description}
            ${act.elements && act.elements.length > 0 ? `<br><br><em>Elements: ${act.elements.join(', ')}</em>` : ''}
            <br><br><strong>Plot Points:</strong> ${plotPoints}
                </div>
            `;
            
    // Add click handler for the edit icon only
    const editIcon = card.querySelector('.act-card-edit-icon');
    editIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 🆕 Step 2: Open modal instead of inline editing
        showActDetailsModal(act);
    });
    
    // 🆕 Step 2: Removed old button event listeners - now using modal
    
    return card;
}

// Enhanced Template Selection - Phase 2: Inline Editing Functions
function startEditingActCard(card, act) {
    console.log('🎭 Starting edit mode for act:', act.name);
    
    // Close any other cards that are currently being edited
    closeAllEditingCards();
    
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
    autoResizeTextarea(titleTextarea);
    autoResizeTextarea(descriptionTextarea);
    
    // Focus on title
    titleTextarea.focus();
    titleTextarea.select();
    
    // Add auto-resize listeners
    titleTextarea.addEventListener('input', () => autoResizeTextarea(titleTextarea));
    descriptionTextarea.addEventListener('input', () => autoResizeTextarea(descriptionTextarea));
    
    // Hide tooltip during editing
    const tooltip = card.querySelector('.act-card-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function saveActCardChanges(card, act) {
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
    updateTemplateStructureInAppState(act.key, newTitle, newDescription, newPlotPoints);
    
    // Exit editing mode
    exitEditingMode(card, act);
    
    // Show save feedback
    showActCardSaveFeedback(card, 'Changes saved!');
    
    // 🔧 Save to database immediately (consistent with database-first architecture)
    if (window.autoSaveManager) {
        autoSaveManager.saveImmediately();
    }
    
    console.log('🎭 Act updated:', { key: act.key, name: newTitle, description: newDescription });
}

function cancelActCardEditing(card, act) {
    console.log('🎭 Cancelling edit for act:', act.name);
    exitEditingMode(card, act);
}

function exitEditingMode(card, act, silent = false) {
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

function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    textarea.style.height = textarea.scrollHeight + 'px';
}

function closeAllEditingCards() {
    // Find all cards currently in editing mode
    const editingCards = document.querySelectorAll('.act-card.editing');
    
    if (editingCards.length > 0) {
        console.log('🎭 Closing', editingCards.length, 'open editing cards');
    }
    
    editingCards.forEach(card => {
        // Get the act data from the card
        const actKey = card.getAttribute('data-act-key');
        
        // 🔧 FIX: Get act data from appState.templateData instead of DOM reconstruction
        if (appState.templateData && appState.templateData.structure && appState.templateData.structure[actKey]) {
            const act = {
                key: actKey,
                name: appState.templateData.structure[actKey].name,
                description: appState.templateData.structure[actKey].description,
                plotPoints: appState.templateData.structure[actKey].plotPoints || 4
            };
            
            console.log('🔧 Closing card for act:', act.name, 'using data from appState');
            
            // Cancel editing for this card (without logging since it's auto-close)
            exitEditingMode(card, act, true);
        } else {
            console.warn('🚨 Could not find act data for key:', actKey, 'in appState.templateData');
            
            // Fallback: Try to reconstruct from DOM (original behavior)
            const titleElement = card.querySelector('.act-card-title.editable') || card.querySelector('.act-card-title');
            const descriptionElement = card.querySelector('.act-card-description.editable') || card.querySelector('.act-card-description');
            
            if (titleElement && descriptionElement) {
                const plotPointsElement = card.querySelector('.act-card-plot-points.editable') || card.querySelector('.act-card-plot-points');
                const act = {
                    key: actKey,
                    name: titleElement.getAttribute('data-original') || titleElement.textContent || 'Untitled Act',
                    description: descriptionElement.getAttribute('data-original') || descriptionElement.textContent || 'No description',
                    plotPoints: plotPointsElement ? (parseInt(plotPointsElement.getAttribute('data-original')) || 4) : 4
                };
                
                console.log('🔧 Using fallback DOM reconstruction for act:', act.name);
                
                // Cancel editing for this card (without logging since it's auto-close)
                exitEditingMode(card, act, true);
            }
        }
    });
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

// Simple scene navigation
function addSceneNavigation() {
    const scriptPreview = document.getElementById('scriptPreview');
    if (!scriptPreview) return;
    
    const scriptText = scriptPreview.textContent;
    const lines = scriptText.split('\n');
    const scenes = [];
    
    // Build scene titles from appState data
    const sceneData = [];
    if (appState.generatedScenes) {
        let structureKeys = Object.keys(appState.generatedScenes);
        
        // Use template order if available
        if (appState.templateData && appState.templateData.structure) {
            const templateKeys = Object.keys(appState.templateData.structure);
            structureKeys = templateKeys.filter(key => appState.generatedScenes[key]);
        }
        
        structureKeys.forEach((structureKey) => {
            const sceneGroup = appState.generatedScenes[structureKey];
            if (sceneGroup && Array.isArray(sceneGroup)) {
                sceneGroup.forEach((scene, index) => {
                    sceneData.push({
                        title: scene.title || `Scene ${structureKey}-${index}`,
                        location: scene.location || 'Unknown Location'
                    });
                });
            }
        });
    }
    
    // Find scene headers and match with scene data
    let sceneIndex = 0;
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.match(/^(INT\.|EXT\.)/i)) {
            const sceneTitle = sceneData[sceneIndex] ? sceneData[sceneIndex].title : trimmed;
            scenes.push({
                title: sceneTitle,
                lineNumber: index
            });
            sceneIndex++;
        }
    });
    
    if (scenes.length === 0) return;
    
    // Add dropdown if it doesn't exist
    let navDropdown = document.getElementById('sceneNavDropdown');
    if (!navDropdown) {
        const navContainer = document.createElement('div');
        navContainer.className = 'scene-nav';
        navContainer.innerHTML = `
            <select id="sceneNavDropdown">
                <option value="">Jump to scene...</option>
                ${scenes.map((scene, index) => `
                    <option value="${scene.lineNumber}">Scene ${index + 1}: ${scene.title}</option>
                `).join('')}
            </select>
        `;
        scriptPreview.parentNode.insertBefore(navContainer, scriptPreview);
        navDropdown = document.getElementById('sceneNavDropdown');
    }
    
    // Navigation handler
    navDropdown.addEventListener('change', function() {
        const lineNumber = parseInt(this.value);
        if (!lineNumber) return;
        
        // Calculate approximate scroll position
        const totalLines = lines.length;
        const percentage = lineNumber / totalLines;
        const scrollPosition = scriptPreview.scrollHeight * percentage;
        
        scriptPreview.scrollTop = scrollPosition;
        this.value = ''; // Reset dropdown
    });
}