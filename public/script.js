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
        films: []
    },
    projectCharacters: [], // Add characters to appState for persistence
    currentStoryConcept: null, // Current story concept (title + logline)
    customPrompt: null,
    originalPrompt: null,
    isEditMode: false,
    plotPoints: {},
    selectedModel: 'claude-sonnet-4-20250514', // Default to latest model
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

// Authentication Management
const authManager = {
    init() {
        this.checkAuthStatus();
        this.updateUI();
    },
    
    checkAuthStatus() {
        const apiKey = localStorage.getItem('apiKey');
        const userData = localStorage.getItem('userData');
        
        if (apiKey && userData) {
            try {
                const newUser = JSON.parse(userData);
                
                // Check if user has changed
                const userChanged = appState.user && appState.user.username !== newUser.username;
                
                appState.apiKey = apiKey;
                appState.user = newUser;
                appState.isAuthenticated = true;
                
                // If user changed, reset app state to prevent data mixing
                if (userChanged) {
                    console.log(`User changed from ${appState.user.username} to ${newUser.username}, resetting app state`);
                    this.resetAppState();
                }
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                this.clearAuth();
            }
        }
    },
    
    updateUI() {
        const guestActions = document.getElementById('guestActions');
        const userControls = document.getElementById('userControls');
        const userName = document.getElementById('userName');
        const profileUsername = document.getElementById('profileUsername');
        
        if (appState.isAuthenticated && appState.user) {
            // Show authenticated user UI
            if (guestActions) guestActions.style.display = 'none';
            if (userControls) userControls.style.display = 'flex';
            if (userName) {
                userName.textContent = appState.user.username;
            }
            if (profileUsername) {
                profileUsername.textContent = appState.user.username;
            }
            
            // Initialize credit widget if available
            if (window.creditWidget && typeof window.creditWidget.fetchBalance === 'function') {
                window.creditWidget.fetchBalance();
            }
        } else {
            // Show guest UI
            if (guestActions) guestActions.style.display = 'flex';
            if (userControls) userControls.style.display = 'none';
            
            // Show registration prompt for key actions
            this.showRegistrationPrompts();
        }
    },
    
    showRegistrationPrompts() {
        // Add visual indicators that registration is needed for generation
        const generateButtons = document.querySelectorAll('.btn-primary');
        generateButtons.forEach(button => {
            if (button.textContent.includes('Continue') || 
                button.textContent.includes('Generate') ||
                button.textContent.includes('Create')) {
                button.onclick = (e) => {
                    e.preventDefault();
                    this.showRegistrationModal();
                };
            }
        });
    },
    
    showRegistrationModal() {
        const modalHtml = `
            <div class="modal-overlay" id="registrationPromptModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🚀 Ready to Generate Your Script?</h3>
                        <button class="modal-close" onclick="authManager.hideRegistrationModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>To use AI-powered script generation, you'll need a free account with <strong>100 free credits</strong> to get started!</p>
                        <div class="registration-benefits">
                            <ul>
                                <li>✨ <strong>100 free credits</strong> (worth $1.00)</li>
                                <li>🎬 Generate complete film scripts</li>
                                <li>💾 Save and manage your projects</li>
                                <li>📊 Track your usage and costs</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="authManager.hideRegistrationModal()">Maybe Later</button>
                        <a href="register.html" class="btn btn-primary">Create Free Account</a>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },
    
    hideRegistrationModal() {
        const modal = document.getElementById('registrationPromptModal');
        if (modal) modal.remove();
    },
    
    clearAuth() {
        localStorage.removeItem('apiKey');
        localStorage.removeItem('userData');
        localStorage.removeItem('filmScriptGenerator'); // Clear app state when auth changes
        appState.isAuthenticated = false;
        appState.user = null;
        appState.apiKey = null;
        
        // Reset app state to defaults when user changes
        this.resetAppState();
        this.updateUI();
    },
    
    resetAppState() {
        // Reset all user-specific state when switching users
        Object.assign(appState, {
            currentStep: 1,
            storyInput: {},
            selectedTemplate: null,
            templateData: null,
            generatedStructure: null,
            generatedScenes: null,
            generatedDialogues: {},
            projectId: null,
            projectPath: null,
            influences: {
                directors: [],
                screenwriters: [],
                films: []
            },
            projectCharacters: [],
            currentStoryConcept: null,
            customPrompt: null,
            originalPrompt: null,
            isEditMode: false,
            plotPoints: {}
        });
        
        // Update UI elements
        if (typeof updateCharacterTags === 'function') updateCharacterTags();
        if (typeof updateInfluenceTags === 'function') {
            updateInfluenceTags('director');
            updateInfluenceTags('screenwriter');
            updateInfluenceTags('film');
        }
        if (typeof updateStoryConceptDisplay === 'function') updateStoryConceptDisplay();
    }
};

// Global logout function
function logout() {
    authManager.clearAuth();
    window.location.href = 'login.html';
}

// Profile dropdown functions
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    const isOpen = dropdown.classList.contains('open');
    
    if (isOpen) {
        closeProfileDropdown();
    } else {
        openProfileDropdown();
    }
}

function openProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.add('open');
    
    // Close dropdown when clicking outside or pressing escape
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
}

function closeProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.remove('open');
    
    // Remove event listeners
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleOutsideClick(event) {
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown.contains(event.target)) {
        closeProfileDropdown();
    }
}

function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        closeProfileDropdown();
    }
}

// Model pricing information
const modelPricing = {
    'claude-sonnet-4-20250514': { input: 3, output: 15, description: 'Latest & Best' },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15, description: 'Best Quality' },
    'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25, description: 'Fast & Cheap' },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25, description: 'Cheapest' }
};

// Global character management variables (projectCharacters moved to appState for persistence)
let editingCharacterIndex = null;

// Unified Editable Content Block System
class EditableContentBlock {
    constructor(options) {
        this.id = options.id;
        this.type = options.type; // 'acts', 'plot-points', 'scenes', 'dialogue'
        this.title = options.title;
        this.content = options.content;
        this.originalContent = options.content;
        this.container = options.container;
        this.onSave = options.onSave; // Callback function for saving
        this.onCancel = options.onCancel; // Optional callback for canceling
        this.metadata = options.metadata || {}; // Additional data like structureKey, index, etc.
        this.isEditing = false;
        this.element = null;
        
        this.render();
    }
    
    render() {
        const blockId = `editable-block-${this.id}`;
        const textareaId = `textarea-${this.id}`;
        
        this.element = document.createElement('div');
        this.element.className = 'editable-content-block';
        this.element.id = blockId;
        
        this.element.innerHTML = `
            <div class="editable-content-header">
                <div class="editable-content-title">
                    ${this.title}
                    <span class="content-type-badge ${this.type}">${this.type.replace('-', ' ')}</span>
                </div>
                <div class="editable-content-actions">
                    <button class="edit-btn" onclick="editableBlocks['${this.id}'].startEdit()">
                        ✏️ Edit
                    </button>
                </div>
            </div>
            <div class="editable-content-body">
                <div class="editable-content-display">
                    ${this.formatContentForDisplay(this.content)}
                </div>
                <div class="editable-content-editor">
                    <textarea id="${textareaId}" placeholder="Enter your content here...">${this.content}</textarea>
                    <div class="editable-content-editor-actions">
                        <button class="cancel-btn" onclick="editableBlocks['${this.id}'].cancelEdit()">
                            Cancel
                        </button>
                        <button class="save-btn" onclick="editableBlocks['${this.id}'].saveEdit()">
                            Save Changes
                        </button>
                    </div>
                </div>
                <div class="editable-content-meta">
                    Last modified: ${new Date().toLocaleString()}
                </div>
            </div>
        `;
        
        this.container.appendChild(this.element);
        
        // Store reference for global access
        if (!window.editableBlocks) {
            window.editableBlocks = {};
        }
        window.editableBlocks[this.id] = this;
    }
    
    formatContentForDisplay(content) {
        // Format content based on type
        switch (this.type) {
            case 'acts':
                return this.formatActsContent(content);
            case 'plot-points':
                return this.formatPlotPointsContent(content);
            case 'scenes':
                return this.formatScenesContent(content);
            case 'dialogue':
                return this.formatDialogueContent(content);
            default:
                return `<p>${content}</p>`;
        }
    }
    
    formatActsContent(content) {
        // If content is a JSON string, parse it
        if (typeof content === 'string' && content.startsWith('{')) {
            try {
                const parsed = JSON.parse(content);
                return `
                    <p><strong>Description:</strong> ${parsed.description || 'No description'}</p>
                    ${parsed.character_development ? `<p><strong>Character Development:</strong> ${parsed.character_development}</p>` : ''}
                `;
            } catch (e) {
                return `<p>${content}</p>`;
            }
        }
        return `<p>${content}</p>`;
    }
    
    formatPlotPointsContent(content) {
        // If content is an array or JSON array string
        if (Array.isArray(content)) {
            return `
                <ol>
                    ${content.map(point => `<li>${point}</li>`).join('')}
                </ol>
            `;
        } else if (typeof content === 'string' && content.startsWith('[')) {
            try {
                const parsed = JSON.parse(content);
                return `
                    <ol>
                        ${parsed.map(point => `<li>${point}</li>`).join('')}
                    </ol>
                `;
            } catch (e) {
                return `<p>${content}</p>`;
            }
        }
        return `<p>${content}</p>`;
    }
    
    formatScenesContent(content) {
        // If content is a JSON string, parse it
        if (typeof content === 'string' && content.startsWith('{')) {
            try {
                const parsed = JSON.parse(content);
                return `
                    <h3>${parsed.title || parsed.name || 'Untitled Scene'}</h3>
                    <p><strong>Location:</strong> ${parsed.location || 'Not specified'}</p>
                    <p><strong>Time:</strong> ${parsed.time_of_day || parsed.time || 'Not specified'}</p>
                    <p><strong>Description:</strong> ${parsed.description || 'No description'}</p>
                `;
            } catch (e) {
                return `<p>${content}</p>`;
            }
        }
        return `<p>${content}</p>`;
    }
    
    formatDialogueContent(content) {
        // Format dialogue content with proper screenplay formatting
        return `<pre class="screenplay-content">${content}</pre>`;
    }
    
    startEdit() {
        this.isEditing = true;
        this.element.classList.add('editing');
        
        // Focus on the textarea
        const textarea = this.element.querySelector('textarea');
        if (textarea) {
            textarea.focus();
            textarea.select();
        }
    }
    
    cancelEdit() {
        this.isEditing = false;
        this.element.classList.remove('editing');
        
        // Restore original content
        const textarea = this.element.querySelector('textarea');
        if (textarea) {
            textarea.value = this.content;
        }
        
        if (this.onCancel) {
            this.onCancel(this);
        }
    }
    
    async saveEdit() {
        const textarea = this.element.querySelector('textarea');
        if (!textarea) return;
        
        const newContent = textarea.value.trim();
        
        if (newContent === this.content) {
            // No changes, just exit edit mode
            this.cancelEdit();
            return;
        }
        
        try {
            // Show loading state
            this.element.classList.add('loading');
            const saveBtn = this.element.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }
            
            // Call the save callback
            if (this.onSave) {
                await this.onSave(newContent, this);
            }
            
            // Update content and display
            this.content = newContent;
            this.updateDisplay();
            
            // Exit edit mode
            this.isEditing = false;
            this.element.classList.remove('editing');
            
            // Show success feedback
            this.showSaveFeedback('Content saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving content:', error);
            this.showSaveFeedback('Error saving content. Please try again.', 'error');
        } finally {
            // Remove loading state
            this.element.classList.remove('loading');
            const saveBtn = this.element.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        }
    }
    
    updateDisplay() {
        const displayDiv = this.element.querySelector('.editable-content-display');
        if (displayDiv) {
            displayDiv.innerHTML = this.formatContentForDisplay(this.content);
        }
        
        // Update metadata
        const metaDiv = this.element.querySelector('.editable-content-meta');
        if (metaDiv) {
            metaDiv.innerHTML = `Last modified: ${new Date().toLocaleString()}`;
        }
    }
    
    showSaveFeedback(message, type) {
        // Remove existing feedback
        const existingFeedback = this.element.querySelector('.content-save-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
        
        // Create new feedback
        const feedback = document.createElement('div');
        feedback.className = `content-save-feedback ${type}`;
        feedback.textContent = message;
        
        // Insert at the top of the body
        const body = this.element.querySelector('.editable-content-body');
        body.insertBefore(feedback, body.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 3000);
    }
    
    updateContent(newContent) {
        this.content = newContent;
        this.updateDisplay();
        
        // Update textarea if in edit mode
        if (this.isEditing) {
            const textarea = this.element.querySelector('textarea');
            if (textarea) {
                textarea.value = newContent;
            }
        }
    }
    
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Remove from global registry
        if (window.editableBlocks && window.editableBlocks[this.id]) {
            delete window.editableBlocks[this.id];
        }
    }
}

// Helper function to create editable content blocks
function createEditableContentBlock(options) {
    return new EditableContentBlock(options);
}

// Find template ID by its display name
function findTemplateIdByName(templateName) {
    if (!templateName || !appState.availableTemplates) {
        return null;
    }
    
    // Search through all categories to find the template
    for (const category of Object.values(appState.availableTemplates)) {
        if (category.templates) {
            const template = category.templates.find(t => t.name === templateName);
            if (template) {
                return template.id;
            }
        }
    }
    
    return null; // Template not found
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
        console.log(`🔍 INFLUENCE DEBUG: Added ${type} "${value}" to appState.influences`);
        console.log('  - Current influences:', appState.influences);
        
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
    
    // Skip if user is not authenticated
    if (!appState.isAuthenticated) {
        console.log('Universal Library System: User not authenticated, skipping library save offer');
        console.log('Authentication status:', appState.isAuthenticated);
        console.log('User:', appState.user);
        console.log('API Key in localStorage:', localStorage.getItem('apiKey') ? 'Present' : 'Missing');
        console.log('User data in localStorage:', localStorage.getItem('userData') ? 'Present' : 'Missing');
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
            const response = await fetch(`/api/user-libraries/${appState.user.username}/${config.plural}`);
            userLibrary = await response.json();
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
            // Editing existing entry
            method = 'PUT';
            url = `/api/user-libraries/${appState.user.username}/${isEditing.type}/${isEditing.key}`;
        } else {
            // Creating new entry
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
            headers: { 'Content-Type': 'application/json' },
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
                    // Add to tone dropdown and select it
                    const toneSelect = document.getElementById('tone');
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    option.selected = true;
                    toneSelect.appendChild(option);
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
                        console.log(`🔍 CHARACTER DEBUG: Added new character:`, character);
                        console.log(`🔍 CHARACTER DEBUG: Current projectCharacters:`, appState.projectCharacters);
                        
                        // Update character tags display (similar to influences)
                        updateCharacterTags();
                        validateCharactersRequired();
                        saveToLocalStorage();
                        
                        // Mark as dirty to trigger auto-save
                        appState.pendingChanges = true;
                        if (autoSaveManager) {
                            autoSaveManager.markDirty();
                        }
                        console.log(`🔍 CHARACTER DEBUG: Marked as dirty for auto-save`);
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
                    // Add to influence tags
                    if (!appState.influences[config.plural].includes(name)) {
                        appState.influences[config.plural].push(name);
                        console.log(`🔍 INFLUENCE DEBUG: Added ${type} "${name}" to appState.influences`);
                        console.log('  - Current influences:', appState.influences);
                        
                        updateInfluenceTags(type);
                        saveToLocalStorage();
                        
                        // Mark as dirty to trigger auto-save
                        appState.pendingChanges = true;
                        if (autoSaveManager) {
                            autoSaveManager.markDirty();
                        }
                        console.log('  - Marked as dirty for auto-save');
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
    const index = appState.influences[type + 's'].indexOf(value);
    if (index > -1) {
        appState.influences[type + 's'].splice(index, 1);
        updateInfluenceTags(type);
        saveToLocalStorage();
        
        // Mark as dirty to trigger auto-save
        appState.pendingChanges = true;
        if (autoSaveManager) {
            autoSaveManager.markDirty();
        }
    }
}

function removeCharacter(index) {
    if (index >= 0 && index < appState.projectCharacters.length) {
        appState.projectCharacters.splice(index, 1);
        updateCharacterTags();
        validateCharactersRequired();
        saveToLocalStorage();
        
        // Mark as dirty to trigger auto-save
        appState.pendingChanges = true;
        if (autoSaveManager) {
            autoSaveManager.markDirty();
        }
    }
}

// Handle custom tone addition
function addCustomTone() {
    const customInput = document.getElementById('customTone');
    const toneSelect = document.getElementById('tone');
    
    let value = customInput.value.trim();
    
    if (value) {
        // Set the tone in the dropdown
        toneSelect.value = value;
        
        // Create option if it doesn't exist
        if (!Array.from(toneSelect.options).some(option => option.value === value)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            option.selected = true;
            toneSelect.appendChild(option);
        }
        
        // Clear the input
        customInput.value = '';
        
        // Offer to save to library if authenticated
        if (appState.isAuthenticated) {
            checkAndOfferLibrarySave('tone', value);
        }
        
        showToast(`Custom tone "${value}" added`, 'success');
    }
}

// Smart unified function - adds from dropdown if selected, otherwise opens modal for new entry
function addFromDropdownOrNew(type) {
    const selectElement = document.getElementById(type === 'tone' ? 'tone' : (type === 'storyconcept' ? 'storyConceptSelect' : `${type}Select`));
    
    // If something is selected in dropdown, add it
    if (selectElement && selectElement.value) {
        const value = selectElement.value;
        
        if (type === 'tone') {
            // For tone, just confirm and offer to save to library (keep selection)
            showToast(`Tone "${value}" selected`, 'success');
            checkAndOfferLibrarySave(type, value);
        } else if (type === 'character') {
            // For characters, add to main story characters (not influences)
            selectElement.value = '';
            
            // Check if character already exists in project
            const existingCharacter = appState.projectCharacters.find(char => char.name === value);
            if (!existingCharacter) {
                // Add character to project (with basic description)
                appState.projectCharacters.push({
                    name: value,
                    description: `Main character: ${value}`,
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
                
                showToast(`Added "${value}" to your main characters`, 'success');
                
                // Check if this is a custom entry (not in default dropdown)
                checkAndOfferLibrarySave(type, value);
            } else {
                showToast(`"${value}" is already in your characters`, 'warning');
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
            
            if (value && !appState.influences[type + 's'].includes(value)) {
                appState.influences[type + 's'].push(value);
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
    
    console.log('Authentication status:', appState.isAuthenticated);
    console.log('User:', appState.user);
    console.log('API Key in localStorage:', localStorage.getItem('apiKey') ? 'Present' : 'Missing');
    console.log('User data in localStorage:', localStorage.getItem('userData') ? 'Present' : 'Missing');
    
    if (!appState.isAuthenticated) {
        showToast('Please log in to save items to your library', 'error');
        return;
    }
    
    const config = LIBRARY_TYPES[type];
    if (!config) {
        console.warn(`Unknown library type: ${type}`);
        return;
    }
    
    console.log('About to show modal for', type, 'with config:', config);
    
    // Show modal directly with empty values
    showUniversalLibrarySaveModal(type, '', config, true);
}

// Enhanced universal modal to handle both save-existing and create-new flows
function showUniversalLibrarySaveModal(type, value, config, isNewEntry = false) {
    
    const modalTitle = isNewEntry ? `Add New ${config.displayName}` : `Save ${config.displayName} to Library`;
    const modalMessage = isNewEntry ? 
        `Create a new ${config.singular} for your library:` :
        `Would you like to save "<strong>${value}</strong>" to your ${config.plural} library for future projects?`;
    
    // Create prompt context help text based on type
    let promptHelpText = '';
    if (type === 'director') {
        promptHelpText = `This will appear in prompts as: "In the directorial style of <em>[what you enter]</em>, ..."`;
    } else if (type === 'screenwriter') {
        promptHelpText = `This will appear in prompts as: "with screenplay influences from <em>[what you enter]</em>, ..."`;
    } else if (type === 'film') {
        promptHelpText = `This will appear in prompts as: "drawing inspiration from films like <em>[what you enter]</em>, ..."`;
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
                                <label for="universalLibraryEntryName">${config.displayName} Influence</label>
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
                        ${isNewEntry ? 'Add to Library' : 'Save to Library'}
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
    
    // Focus on the name input
    setTimeout(() => {
        document.getElementById('universalLibraryEntryName').focus();
    }, 100);
}

function updateInfluenceTags(type) {
    const container = document.getElementById(`${type}Tags`);
    container.innerHTML = '';
    
    appState.influences[type + 's'].forEach(influence => {
        const tag = document.createElement('div');
        tag.className = 'influence-tag clickable-tag';
        tag.innerHTML = `
            <span onclick="editInfluenceEntry('${type}', '${influence.replace(/'/g, "\\'")}');" style="cursor: pointer; flex: 1;">${influence}</span>
            <button type="button" class="remove-tag" onclick="removeInfluence('${type}', '${influence.replace(/'/g, "\\'")}')">×</button>
        `;
        container.appendChild(tag);
    });
}

function updateCharacterTags() {
    const container = document.getElementById('characterTags');
    if (!container) return; // Handle case where element doesn't exist
    
    container.innerHTML = '';
    
    appState.projectCharacters.forEach((character, index) => {
        const tag = document.createElement('div');
        tag.className = 'influence-tag clickable-tag';
        tag.innerHTML = `
            <span onclick="editCharacterEntry(${index});" style="cursor: pointer; flex: 1;">${character.name}</span>
            <button type="button" class="remove-tag" onclick="removeCharacter(${index})" title="Remove character">×</button>
        `;
        container.appendChild(tag);
    });
}

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
    appState.currentStoryConcept = null;
    
    // Reset the dropdown selection
    const dropdown = document.getElementById('storyConceptSelect');
    if (dropdown) {
        dropdown.value = '';
    }
    
    updateStoryConceptDisplay();
    saveToLocalStorage();
    showToast('Story concept removed', 'success');
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
    
    // Find the entry data - library entries can be strings or objects
    const entryData = libraryEntries.find(entry => {
        // Handle different possible data structures
        if (typeof entry === 'string') {
            return entry === influenceName;
        } else if (entry.entry_data && entry.entry_data.name) {
            return entry.entry_data.name === influenceName;
        } else if (entry.name) {
            return entry.name === influenceName;
        }
        return false;
    });
    
    if (entryData) {
        // Extract the actual data based on the structure found
        let actualData, actualKey;
        
        if (typeof entryData === 'string') {
            // Simple string entry
            actualData = { name: entryData, description: '' };
            actualKey = entryData.toLowerCase().replace(/\s+/g, '_');
        } else if (entryData.entry_data && entryData.entry_data.name) {
            actualData = entryData.entry_data;
            actualKey = entryData.entry_key;
        } else if (entryData.name) {
            actualData = { name: entryData.name, description: entryData.description || '' };
            actualKey = entryData.entry_key || entryData.key;
        } else {
            actualData = { name: influenceName, description: '' };
            actualKey = influenceName.toLowerCase().replace(/\s+/g, '_');
        }
        
        // Store editing state for the universal modal
        window.editingLibraryEntry = {
            type: libraryType,
            key: actualKey,
            data: actualData,
            isFromStep1: true // Flag to know this came from step 1
        };
        
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

async function editCharacterEntry(characterIndex) {
    console.log('Editing character entry:', characterIndex);
    
    const character = appState.projectCharacters[characterIndex];
    if (!character) {
        console.warn('Character not found:', characterIndex);
        return;
    }
    
    // Get the config for characters
    const config = LIBRARY_TYPES.character;
    
    // Load user libraries to find the full data for this character
    const userLibraries = await loadUserLibraries();
    const characterEntries = userLibraries.characters || [];
    
    // Find the entry data - library entries can be strings or objects
    const entryData = characterEntries.find(entry => {
        // Handle different possible data structures
        if (typeof entry === 'string') {
            return entry === character.name;
        } else if (entry.entry_data && entry.entry_data.name) {
            return entry.entry_data.name === character.name;
        } else if (entry.name) {
            return entry.name === character.name;
        }
        return false;
    });
    
    if (entryData) {
        // Extract the actual data based on the structure found
        let actualData, actualKey;
        
        if (typeof entryData === 'string') {
            // Simple string entry
            actualData = { name: entryData, description: character.description || '' };
            actualKey = entryData.toLowerCase().replace(/\s+/g, '_');
        } else if (entryData.entry_data && entryData.entry_data.name) {
            actualData = entryData.entry_data;
            actualKey = entryData.entry_key;
        } else if (entryData.name) {
            actualData = { name: entryData.name, description: entryData.description || '' };
            actualKey = entryData.entry_key || entryData.key;
        } else {
            actualData = { name: character.name, description: character.description || '' };
            actualKey = character.name.toLowerCase().replace(/\s+/g, '_');
        }
        
        // Store editing state for the universal modal
        window.editingLibraryEntry = {
            type: 'characters',
            key: actualKey,
            data: actualData,
            isFromStep1: true,
            characterIndex: characterIndex // Store the index for project character updates
        };
        
        // Show universal modal with pre-filled data
        showUniversalLibrarySaveModal('character', actualData.name, config, false);
        
        // Pre-fill description
        setTimeout(() => {
            const descField = document.getElementById('universalLibraryEntryDescription');
            if (descField && actualData.description) {
                descField.value = actualData.description;
            }
        }, 100);
    } else {
        // Character not found in library, create a new library entry
        window.editingLibraryEntry = {
            isFromStep1: true,
            characterIndex: characterIndex,
            isNewCharacterEntry: true
        };
        
        // Show modal with current character data
        showUniversalLibrarySaveModal('character', character.name, config, true);
        
        // Pre-fill description with current character description
        setTimeout(() => {
            const descField = document.getElementById('universalLibraryEntryDescription');
            if (descField && character.description) {
                descField.value = character.description;
            }
        }, 100);
    }
}

function buildInfluencePrompt() {
    let prompt = '';
    
    if (appState.influences.directors.length > 0) {
        prompt += `In the directorial style of ${appState.influences.directors.join(', ')}, `;
    }
    
    if (appState.influences.screenwriters.length > 0) {
        prompt += `with screenplay influences from ${appState.influences.screenwriters.join(', ')}, `;
    }
    
    if (appState.influences.films.length > 0) {
        prompt += `drawing inspiration from films like ${appState.influences.films.join(', ')}, `;
    }
    

    
    return prompt;
}

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

// Auto-generation for debugging
async function autoGenerate() {
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
    const userLibraries = await loadUserLibraries();
    
    // Clear existing influences
    appState.influences = { directors: [], screenwriters: [], films: [] };
    
    // Add random influences (1-3 of each type) from user's libraries
    const randomDirectors = [...(userLibraries.directors || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomScreenwriters = [...(userLibraries.screenwriters || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomFilms = [...(userLibraries.films || [])].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    
    appState.influences.directors = randomDirectors;
    appState.influences.screenwriters = randomScreenwriters;
    appState.influences.films = randomFilms;
    
    // Create story concept
    appState.currentStoryConcept = {
        title: title,
        logline: logline,
        fromLibrary: false
    };
    updateStoryConceptDisplay();
    
    // Auto-generate sample characters
    appState.projectCharacters = [
        { name: "Protagonist", description: characters },
        { name: "Supporting Character", description: "A key figure in the protagonist's journey" }
    ];
    updateCharacterTags();
    
    // Set random total scenes (will be set when user reaches Step 5)
    appState.storyInput.totalScenes = Math.floor(Math.random() * 50) + 40; // 40-90 scenes
    
    document.getElementById('tone').value = (userLibraries.tones || [])[Math.floor(Math.random() * (userLibraries.tones?.length || 1))] || '';
    
    // Update influence tags
    updateInfluenceTags('director');
    updateInfluenceTags('screenwriter');
    updateInfluenceTags('film');
    
    // Mark as dirty to trigger auto-save for all the changes
    appState.pendingChanges = true;
    if (autoSaveManager) {
        autoSaveManager.markDirty();
    }
    
    console.log('Auto-generated story concept:', {
        title,
        logline,
        characters,
        influences: appState.influences
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    setupEventListeners();
    setupModelSelector();
    initializeGlobalModelSelector();
    loadTemplates();
    setupUniversalLibraryKeyboardSupport();
});

// Initialize application
async function initializeApp() {
    console.log('=== INITIALIZE APP DEBUG ===');
    
    // Initialize authentication first
    authManager.init();
    
    // Initialize auto-save manager
    autoSaveManager.init();
    
    updateProgressBar();
    updateStepIndicators();
    
    // Populate dropdowns from JSON files
    await populateDropdowns();
    
    // Load from localStorage if available
    const savedState = localStorage.getItem('filmScriptGenerator');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            console.log('Parsed saved state:', {
                currentStep: parsed.currentStep,
                projectPath: parsed.projectPath,
                isLoadedProject: parsed.isLoadedProject,
                hasDialogues: parsed.generatedDialogues ? Object.keys(parsed.generatedDialogues).length : 0
            });
            
            Object.assign(appState, parsed);
            
            // Update character, influence, and story concept displays after restoring state
            updateCharacterTags();
            updateInfluenceTags('director');
            updateInfluenceTags('screenwriter');
            updateInfluenceTags('film');
            updateStoryConceptDisplay();
            
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
    }
    console.log('=== INITIALIZE APP COMPLETE ===');
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
        const toneSelect = document.getElementById('tone');
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
                option.value = character;
                option.textContent = character;
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
                option.value = concept;
                option.textContent = concept;
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
        return { directors: [], screenwriters: [], films: [], tones: [], characters: [] };
    }
    
    try {
        const libraryTypes = ['directors', 'screenwriters', 'films', 'tones', 'characters'];
        const userLibraries = { directors: [], screenwriters: [], films: [], tones: [], characters: [] };
        
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
                    userLibraries[type] = libraries.map(lib => lib.entry_data.name);
                }
            } catch (error) {
                // Continue with empty array for this type
            }
        }
        
        return userLibraries;
    } catch (error) {
        console.error('LoadUserLibraries: Error occurred:', error);
        return { directors: [], screenwriters: [], films: [], tones: [], characters: [] };
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
        charactersData: appState.projectCharacters, // Store structured character data
        tone: formData.get('tone'),
        totalScenes: 70, // Default value, will be configurable in scenes step
        influences: appState.influences,
        influencePrompt: buildInfluencePrompt(),
        storyConcept: appState.currentStoryConcept // Store the full story concept
    };
    
    // Mark for auto-save (project gets created here)
    // Temporarily disabled until auto-save is fully stabilized
    // autoSaveManager.markDirty();
    
    saveToLocalStorage();
    goToStep(2);
}

// Load available templates
async function loadTemplates() {
    try {
        showLoading('Loading templates...');
        const response = await fetch('/api/templates');
        const groupedTemplates = await response.json();
        
        appState.availableTemplates = groupedTemplates;
        displayTemplates(groupedTemplates);
        hideLoading();
    } catch (error) {
        console.error('Error loading templates:', error);
        showToast('Error loading templates. Please refresh the page.', 'error');
        hideLoading();
    }
}

// Display template options in groups
function displayTemplates(groupedTemplates) {
    const container = document.getElementById('templateOptions');
    container.innerHTML = '';
    
    // Ensure container starts in expanded state
    container.classList.add('template-options-expanded');
    container.classList.remove('template-options-collapsed');
    
    Object.entries(groupedTemplates).forEach(([categoryKey, category]) => {
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'template-category';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <h3>${category.title}</h3>
            <p class="category-description">${category.description}</p>
        `;
        
        const templatesGrid = document.createElement('div');
        templatesGrid.className = 'templates-grid';
        
        // Add templates in this category
        category.templates.forEach(template => {
            const templateElement = document.createElement('div');
            templateElement.className = 'template-option';
            templateElement.dataset.templateId = template.id;
            templateElement.innerHTML = `
                <h4>${template.name}</h4>
                <p class="template-description">${template.description}</p>
                ${template.examples ? `<p class="template-examples"><strong>Examples:</strong> ${template.examples}</p>` : ''}
            `;
            
            templateElement.addEventListener('click', () => selectTemplate(template.id));
            templatesGrid.appendChild(templateElement);
        });
        
        categorySection.appendChild(categoryHeader);
        categorySection.appendChild(templatesGrid);
        container.appendChild(categorySection);
    });
}

// Select template
function selectTemplate(templateId) {
    // Add visual feedback for selection
    const clickedTemplate = document.querySelector(`[data-template-id="${templateId}"]`);
    if (clickedTemplate) {
        clickedTemplate.classList.add('selecting');
        setTimeout(() => clickedTemplate.classList.remove('selecting'), 100);
    }
    
    // Remove previous selection
    document.querySelectorAll('.template-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to clicked template
    document.querySelector(`[data-template-id="${templateId}"]`).classList.add('selected');
    
    appState.selectedTemplate = templateId;
    document.getElementById('selectTemplateBtn').disabled = false;
    
    // Find and display the selected template immediately
    let selectedTemplateData = null;
    Object.values(appState.availableTemplates).forEach(category => {
        if (category.templates) {
            const found = category.templates.find(template => template.id === templateId);
            if (found) {
                selectedTemplateData = found;
            }
        }
    });
    
    if (selectedTemplateData) {
        displaySelectedTemplate(selectedTemplateData);
        
        // Collapse template options and update UI
        setTimeout(() => {
            collapseTemplateOptions();
            updateTemplatePageForSelection();
        }, 200);
    }
    
    saveToLocalStorage();
}

// Collapse template options after selection
function collapseTemplateOptions() {
    const templateOptions = document.getElementById('templateOptions');
    templateOptions.classList.add('template-options-collapsed');
    templateOptions.classList.remove('template-options-expanded');
}

// Expand template options for browsing
function expandTemplateOptions() {
    const templateOptions = document.getElementById('templateOptions');
    templateOptions.classList.add('template-options-expanded');
    templateOptions.classList.remove('template-options-collapsed');
}

// Update page UI for selected state
function updateTemplatePageForSelection() {
    const stepDescription = document.getElementById('templateStepDescription');
    stepDescription.textContent = 'Selected template:';
    
    // Scroll to show the selected template
    document.getElementById('selectedTemplateDisplay').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Change template function (expand options again)
function changeTemplate() {
    const stepDescription = document.getElementById('templateStepDescription');
    stepDescription.textContent = 'Select a story structure template that best fits your narrative:';
    
    // Hide selected template display
    document.getElementById('selectedTemplateDisplay').style.display = 'none';
    
    // Clear selection
    document.querySelectorAll('.template-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Clear app state
    appState.selectedTemplate = null;
    document.getElementById('selectTemplateBtn').disabled = true;
    
    // Expand template options
    expandTemplateOptions();
    
    // Scroll to template options
    document.getElementById('templateOptions').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
    
    saveToLocalStorage();
}

// Preview prompt that will be sent to Claude
async function previewPrompt() {
    if (!appState.selectedTemplate) {
        showToast('Please select a template first.', 'error');
        return;
    }
    
    // Create sample story input if none exists
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
    }
    
    try {
        showLoading('Generating prompt preview...');
        
        const response = await fetch('/api/preview-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storyInput: storyInput,
                template: appState.selectedTemplate
            })
        });
        
        const data = await response.json();
        
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
        
        const response = await fetch('/api/generate-structure-custom', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                template: appState.selectedTemplate,
                customPrompt: appState.customPrompt,
                model: getSelectedModel()
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
        
        const response = await fetch('/api/generate-structure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                template: appState.selectedTemplate,
                model: getSelectedModel()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 🔥 Refresh credits after successful generation
            window.creditWidget.refreshAfterOperation();
            
            appState.generatedStructure = data.generatedStructure;
            appState.templateData = data.templateData;
            appState.projectId = data.projectId;
            appState.projectPath = data.projectPath;
            appState.lastUsedPrompt = data.prompt;
            appState.lastUsedSystemMessage = data.systemMessage;
            
            // Show project header now that we have a project
            showProjectHeader({
                title: appState.storyInput.title,
                templateName: appState.templateData ? appState.templateData.name : 'Unknown',
                totalScenes: appState.storyInput.totalScenes,
                projectId: appState.projectId
            });
            
            displayStructure(data.generatedStructure, data.prompt, data.systemMessage);
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
function displayStructure(structure, prompt = null, systemMessage = null) {
    const container = document.getElementById('structureContent');
    
    // Validate structure data
    if (!structure || typeof structure !== 'object') {
        console.error('displayStructure called with invalid structure:', structure);
        container.innerHTML = '<div class="error-message">❌ Structure data is missing or invalid</div>';
        return;
    }
    
    // Check if we already have a preview showing
    const existingPreview = container.parentNode.querySelector('#templateStructurePreview');
    if (existingPreview) {
        // Update the existing preview cards with generated content
        Object.entries(structure).forEach(([key, element]) => {
            if (typeof element === 'object' && element.name) {
                const previewCard = existingPreview.querySelector(`[data-act-key="${key}"]`);
                if (previewCard) {
                    const placeholder = previewCard.querySelector('.act-placeholder');
                    if (placeholder) {
                        // Replace placeholder with generated content
                        placeholder.innerHTML = `
                            <div class="generated-content">
                                <p><strong>Generated Content:</strong></p>
                                <p>${element.description || 'No description available'}</p>
                                ${element.character_developments || element.character_development ? 
                                    `<p><strong>Character Development:</strong> ${element.character_developments || element.character_development}</p>` : ''}
                                ${element.important_plot_points ? 
                                    `<p><strong>Key Plot Points:</strong> ${element.important_plot_points}</p>` : ''}
                            </div>
                        `;
                        placeholder.style.background = 'rgba(79, 172, 254, 0.1)';
                        placeholder.style.borderColor = '#4facfe';
                        placeholder.style.borderStyle = 'solid';
                    }
                }
            }
        });
        
        // Update the preview header to show completion
        const previewHint = existingPreview.querySelector('.structure-preview-hint');
        if (previewHint) {
            previewHint.innerHTML = '<strong>✅ Generated:</strong> Your story structure has been created successfully!';
            previewHint.style.borderLeftColor = '#68d391';
            previewHint.style.background = 'rgba(104, 211, 145, 0.1)';
        }
        
        // Don't create duplicate content in container
        container.innerHTML = '';
    } else {
        // No preview exists, create the normal structure display
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
        
        // Create editable content blocks for each act
        const totalActs = Object.keys(structure).length;
        Object.entries(structure).forEach(([key, element], index) => {
            if (typeof element === 'object' && element.name) {
                const actContent = JSON.stringify(element);
                const actProgress = `${index + 1}/${totalActs}`;
                const actTitle = element.name || key.replace(/_/g, ' ').toUpperCase();
                
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
            }
        });
    }
    
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
            'Content-Type': 'application/json'
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
    if (influences.characters?.length > 0) {
        parts.push(`${influences.characters.length} character(s)`);
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

// Approve structure and generate scenes
async function approveStructure() {
    console.log('Structure approved, proceeding to plot points generation');
    goToStep(4); // Go to plot points step
    await displayPlotPointsGeneration();
}

// Display plot points generation interface
async function displayPlotPointsGeneration() {
    const container = document.getElementById('plotPointsContent');
    
    if (!appState.generatedStructure) {
        container.innerHTML = '<p>No structure available. Please generate a structure first.</p>';
        return;
    }

    let html = '<div class="plot-points-generation">';
    html += '<p class="generation-info"><strong>Generate plot points for each story act.</strong> These will create the causal narrative spine that guides scene creation.</p>';
    
    // First, try to load existing plot points from the project
    await loadExistingPlotPoints();
    
    // Display each story act with plot points generation
    Object.entries(appState.generatedStructure).forEach(([structureKey, storyAct]) => {
        html += `
            <div class="structure-element-card" id="plotPoints-${structureKey}">
                <div class="element-header">
                    <h3>${storyAct.name || structureKey.replace(/_/g, ' ').toUpperCase()}</h3>
                    <div class="element-actions">
                        <div class="plot-points-controls">
                            <select class="plot-points-count-select" id="plotPointsCount-${structureKey}">
                                <option value="2">2 Plot Points</option>
                                <option value="3">3 Plot Points</option>
                                <option value="4" selected>4 Plot Points</option>
                                <option value="5">5 Plot Points</option>
                                <option value="6">6 Plot Points</option>
                            </select>
                            <button class="btn btn-primary" onclick="generateElementPlotPoints('${structureKey}')" title="Generate plot points for this act">
                                📋 Generate Plot Points
                            </button>
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
                <div class="plot-points-container" id="plotPoints-container-${structureKey}">
                    <p class="no-plot-points">No plot points generated yet. Click "Generate Plot Points" to create causal story beats for this act.</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
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
        const response = await fetch(`/api/load-plot-points/${encodeURIComponent(appState.projectPath)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.plotPoints && Object.keys(data.plotPoints).length > 0) {
                appState.plotPoints = data.plotPoints;
                console.log('Loaded existing plot points:', data.plotPoints);
            }
        } else {
            console.log('No existing plot points found');
        }
    } catch (error) {
        console.log('Failed to load existing plot points:', error);
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
        
        const response = await fetch(`/api/generate-plot-points-for-act/${appState.projectPath}/${structureKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                desiredSceneCount: desiredSceneCount,
                model: getSelectedModel()
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
    
    // Create editable content block for plot points
    const plotPointsContent = Array.isArray(plotPoints) ? JSON.stringify(plotPoints) : plotPoints;
    const actName = appState.generatedStructure[structureKey]?.name || structureKey.replace(/_/g, ' ').toUpperCase();
    
    // Get act progress notation (X/Y format)
    const structureKeys = Object.keys(appState.generatedStructure || {});
    const totalActs = structureKeys.length;
    const currentActIndex = structureKeys.indexOf(structureKey);
    const actProgress = currentActIndex !== -1 ? `${currentActIndex + 1}/${totalActs}` : '';
    const titleWithProgress = actProgress ? `${actProgress} ${actName} - Plot Points` : `Plot Points - ${actName}`;
    
    createEditableContentBlock({
        id: `plot-points-${structureKey}`,
        type: 'plot-points',
        title: titleWithProgress,
        content: plotPointsContent,
        container: container,
        metadata: { structureKey: structureKey },
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
        }
    });
    
    // Add regeneration actions below the editable block
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'plot-points-actions';
    actionsDiv.style.marginTop = '15px';
    actionsDiv.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="regenerateAllPlotPointsForElement('${structureKey}')" title="Regenerate all plot points for this act">
            🔄 Regenerate All Plot Points
        </button>
        <button class="btn btn-outline btn-sm" onclick="previewElementPlotPointsPrompt('${structureKey}')" title="Preview the prompt for generating plot points">
            🔍 Preview Prompt
        </button>
    `;
    container.appendChild(actionsDiv);
}

// Save plot points content function
async function savePlotPointsContent(structureKey, content) {
    if (!appState.projectPath) {
        throw new Error('No project loaded');
    }
    
    const response = await fetch(`/api/edit-content/plot-points/${appState.projectPath}/${structureKey}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
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
        
        const response = await fetch(`/api/generate-plot-points-for-act/${appState.projectPath}/${structureKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                desiredSceneCount: 4, // Default value
                model: getSelectedModel()
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
                'Content-Type': 'application/json'
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
                'Content-Type': 'application/json'
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
    
    return allGenerated;
}

// Preview scene generation prompt for an element
async function previewElementScenesPrompt(structureKey) {
    if (!appState.generatedStructure || !appState.storyInput) {
        showToast('No structure or story data available for prompt preview.', 'error');
        return;
    }

    const structureElement = appState.generatedStructure[structureKey];
    
    if (!structureElement) {
        showToast('Structure element not found.', 'error');
        return;
    }

    try {
        showLoading('Generating scene generation prompt preview...');
        
        const response = await fetch('/api/preview-scene-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                structureElement: structureElement,
                sceneIndex: null, // null for multiple scenes generation
                sceneCount: 3, // Default scene count per act
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
                structureKey: structureKey,
                isElementGeneration: true
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

// Generate scenes for a specific story act
// Check if plot points exist for a structural element
function hasPlotPointsForElement(structureKey) {
    return appState.plotPoints && 
           appState.plotPoints[structureKey] && 
           Array.isArray(appState.plotPoints[structureKey]) && 
           appState.plotPoints[structureKey].length > 0;
}

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

    const sceneCount = 3; // Default scenes per act
    
    try {
        showLoading(`Generating scenes for ${structureKey}...`);
        
        const response = await fetch(`/api/generate-scene/${appState.projectPath}/${structureKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sceneCount: sceneCount,
                model: getSelectedModel()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Scenes generated:', data);
            
            // Store scenes in app state
            if (!appState.generatedScenes) {
                appState.generatedScenes = {};
            }
            appState.generatedScenes[structureKey] = data.scenes;
            
            // Refresh the scenes display
            displayScenes(appState.generatedScenes);
            
            showToast(`Generated ${data.scenes.length} scenes for ${structureKey}!`, 'success');
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
        showLoading(`Generating scenes for ${actsWithPlotPoints.length} acts with plot points...`);
        
        // Generate scenes for each structural element that has plot points sequentially
        for (const structureKey of actsWithPlotPoints) {
            console.log(`Generating scenes for: ${structureKey}`);
            
            const response = await fetch(`/api/generate-scene/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sceneCount: 3, // Default scenes per act
                    model: getSelectedModel()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log(`Scenes generated for ${structureKey}:`, data);
                
                // Store scenes in app state
                if (!appState.generatedScenes) {
                    appState.generatedScenes = {};
                }
                appState.generatedScenes[structureKey] = data.scenes;
            } else {
                throw new Error(`Failed to generate scenes for ${structureKey}: ${data.error}`);
            }
        }
        
        // Refresh the scenes display after all scenes are generated
        displayScenes(appState.generatedScenes);
        
        // 🔥 Refresh credits after successful generation
        window.creditWidget.refreshAfterOperation();
        
        hideLoading();
        showToast(`Successfully generated scenes for ${actsWithPlotPoints.length} acts!`, 'success');
        
        saveToLocalStorage();
        
    } catch (error) {
        console.error('Error generating all scenes:', error);
        showToast(`Error generating scenes: ${error.message}`, 'error');
        hideLoading();
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
        
        const response = await fetch('/api/preview-scene-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                structureElement: structureElement,
                sceneIndex: null, // null for multiple scenes generation
                sceneCount: 3, // Default scene count per act
                projectPath: appState.projectPath
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
                sceneCount: 3,
                hierarchicalPrompt: data.hierarchicalPrompt,
                previewNote: `This shows the prompt structure for generating scenes. This example is for "${structureElement.name || firstActKey}" - similar prompts will be used for all ${actsWithPlotPoints.length} acts with plot points.`
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
        
        Object.entries(appState.generatedStructure).forEach(([structureKey, storyAct]) => {
            const sceneGroup = scenes ? scenes[structureKey] : null;
            const plotPoints = appState.plotPoints ? appState.plotPoints[structureKey] : null;
            const hasScenes = sceneGroup && Array.isArray(sceneGroup) && sceneGroup.length > 0;
            const hasPlotPoints = plotPoints && Array.isArray(plotPoints) && plotPoints.length > 0;
            const sceneCount = hasScenes ? sceneGroup.length : 0;
            
            console.log(`Processing ${structureKey}: hasScenes=${hasScenes}, sceneCount=${sceneCount}, hasPlotPoints=${hasPlotPoints}`);
            
            const groupElement = document.createElement('div');
            groupElement.className = 'scene-group';
            groupElement.id = `scene-group-${structureKey}`;
            
            // Check if this element has plot points for scene generation
            const canGenerateScenes = hasPlotPointsForElement(structureKey);
            const generateButtonClass = canGenerateScenes ? 'btn btn-primary' : 'btn btn-primary btn-disabled';
            const generateButtonTitle = canGenerateScenes ? 
                'Generate scenes for this act' : 
                'Generate plot points first in Step 4 to enable scene generation';
            const generateButtonOnClick = canGenerateScenes ? 
                `generateScenesForElement('${structureKey}')` : 
                'showToast("Please generate plot points for this element first in Step 4.", "error")';

            groupElement.innerHTML = `
                <div class="scene-group-header">
                    <h3>${storyAct.name || structureKey.replace(/_/g, ' ').toUpperCase()}</h3>
                    <div class="scene-group-actions">
                        <button class="${generateButtonClass}" onclick="${generateButtonOnClick}" title="${generateButtonTitle}" ${canGenerateScenes ? '' : 'disabled'}>
                            🎬 Generate Scenes
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
                ${hasPlotPoints ? `
                    <div class="plot-points-reference">
                        <h4>Plot Points for this Act:</h4>
                        <ol>
                            ${plotPoints.map(point => `<li>${point}</li>`).join('')}
                        </ol>
                    </div>
                ` : `
                    <div class="plot-points-warning">
                        <p><strong>⚠️ No plot points found.</strong> Please generate plot points first in Step 4 for better scene coherence.</p>
                        <p><em>Scene generation will be disabled until plot points are created.</em></p>
                    </div>
                `}
                <div id="scenes-${structureKey}" class="scenes-container">
                    ${hasScenes ? '' : '<p class="no-scenes">No scenes generated yet. Individual scenes will appear here as you generate them.</p>'}
                </div>
            `;
            
            console.log(`Appending group element for ${structureKey} to container`);
            container.appendChild(groupElement);
            
            // Display existing scenes if any
            if (hasScenes) {
                console.log(`Displaying ${sceneCount} scenes for ${structureKey}`);
                displayScenesForElement(structureKey, sceneGroup);
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
        showLoading(`Generating plot points for all ${structureKeys.length} structural elements...`);
        
        // Generate plot points for each structural element sequentially
        for (const structureKey of structureKeys) {
            console.log(`Generating plot points for: ${structureKey}`);
            
            // Get the desired plot point count from the dropdown (or use default)
            const plotPointsCountSelect = document.getElementById(`plotPointsCount-${structureKey}`);
            const desiredSceneCount = plotPointsCountSelect ? parseInt(plotPointsCountSelect.value) : 4;
            
            const response = await fetch(`/api/generate-plot-points-for-act/${appState.projectPath}/${structureKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    desiredSceneCount: desiredSceneCount,
                    model: getSelectedModel()
                })
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
            } else {
                throw new Error(`Failed to generate plot points for ${structureKey}: ${data.error}`);
            }
        }
        
        hideLoading();
        showToast(`Successfully generated plot points for all ${structureKeys.length} structural elements!`, 'success');
        
        // Update the completion check
        checkPlotPointsCompletion();
        saveToLocalStorage();
        
    } catch (error) {
        console.error('Error generating all plot points:', error);
        showToast(`Error generating plot points: ${error.message}`, 'error');
        hideLoading();
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
                'Content-Type': 'application/json'
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
                'Content-Type': 'application/json'
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
                'Content-Type': 'application/json'
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
                'Content-Type': 'application/json'
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

// Approve scenes and go to dialogue generation
function approveScenes() {
    if (!appState.generatedScenes) {
        showToast('No scenes to approve.', 'error');
        return;
    }
    
    displayDialogueGeneration();
    goToStep(6); // Go to dialogue step (now step 6)
    showToast('Ready to generate dialogue!', 'success');
}

// Display dialogue generation interface
function displayDialogueGeneration() {
    const container = document.getElementById('dialogueContent');
    container.innerHTML = '';
    
    Object.entries(appState.generatedScenes).forEach(([structureKey, sceneGroup]) => {
        if (Array.isArray(sceneGroup)) {
            sceneGroup.forEach((scene, index) => {
                const sceneId = `${structureKey}-${index}`;
                
                // Check if dialogue already exists for this scene
                let dialogueContent = 'Click "Generate Dialogue" to create the screenplay for this scene.';
                let hasExistingDialogue = false;
                
                // First check the direct scene ID format
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
                
                const sceneTitle = `${scene.title || scene.name || 'Untitled Scene'} - Dialogue`;
                
                createEditableContentBlock({
                    id: `dialogue-${structureKey}-${index}`,
                    type: 'dialogue',
                    title: sceneTitle,
                    content: dialogueContent,
                    container: container,
                    metadata: { structureKey: structureKey, sceneIndex: index, sceneId: sceneId },
                    onSave: async (newContent, block) => {
                        // Save the edited dialogue content
                        await saveDialogueContent(structureKey, index, newContent);
                        
                        // Update the app state
                        if (!appState.generatedDialogues) {
                            appState.generatedDialogues = {};
                        }
                        appState.generatedDialogues[sceneId] = newContent;
                        
                        // Save to local storage
                        saveToLocalStorage();
                    }
                });
                
                // Add generation actions for this dialogue
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
    });
    
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
    
    console.log('Dialogue interface displayed with existing content restored');
}

// Save dialogue content function
async function saveDialogueContent(structureKey, sceneIndex, content) {
    if (!appState.projectPath) {
        throw new Error('No project loaded');
    }
    
    const response = await fetch(`/api/edit-content/dialogue/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
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
        
        const response = await fetch('/api/generate-dialogue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scene: scene,
                storyInput: appState.storyInput,
                context: `This scene is part of the ${structureKey.replace(/_/g, ' ')} section of the story.`,
                projectPath: appState.projectPath,
                model: getSelectedModel()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.generatedDialogues[sceneId] = data.dialogue;
            
            // Update the editable block if it exists
            const blockId = `dialogue-${structureKey}-${sceneIndex}`;
            if (window.editableBlocks && window.editableBlocks[blockId]) {
                window.editableBlocks[blockId].updateContent(data.dialogue);
            }
            
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
        showLoading(`Generating dialogue for ${allScenes.length} scenes...`);
        
        // Generate dialogue for each scene sequentially
        for (const sceneData of allScenes) {
            const { structureKey, sceneIndex, scene, sceneId } = sceneData;
            
            console.log(`Generating dialogue for scene: ${scene.title || 'Untitled'} (${sceneId})`);
            
            const response = await fetch('/api/generate-dialogue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scene: scene,
                    storyInput: appState.storyInput,
                    context: `This scene is part of the ${structureKey.replace(/_/g, ' ')} section of the story.`,
                    projectPath: appState.projectPath,
                    model: getSelectedModel()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log(`Dialogue generated for ${sceneId}:`, data.dialogue);
                
                // Store dialogue in app state
                appState.generatedDialogues[sceneId] = data.dialogue;
            } else {
                throw new Error(`Failed to generate dialogue for scene "${scene.title || 'Untitled'}": ${data.error}`);
            }
        }
        
        // Refresh the dialogue display after all dialogues are generated
        displayDialogueGeneration();
        
        // 🔥 Refresh credits after successful generation
        window.creditWidget.refreshAfterOperation();
        
        hideLoading();
        showToast(`Successfully generated dialogue for ${allScenes.length} scenes!`, 'success');
        
        saveToLocalStorage();
        
    } catch (error) {
        console.error('Error generating all dialogue:', error);
        showToast(`Error generating dialogue: ${error.message}`, 'error');
        hideLoading();
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
                'Content-Type': 'application/json'
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
    
    // Fixed approach: Use template structure ordering (same as server-side)
    if (appState.generatedScenes) {
        // Use template structure order, not alphabetical sorting
        let structureKeys = Object.keys(appState.generatedScenes);
        
        // If we have template data, use its order instead
        if (appState.templateData && appState.templateData.structure) {
            const templateKeys = Object.keys(appState.templateData.structure);
            // Filter to only include keys that have generated scenes
            structureKeys = templateKeys.filter(key => appState.generatedScenes[key]);
            console.log('Client-side using template structure order:', structureKeys);
        } else {
            console.log('Client-side fallback: using generated scenes order (no template available)');
        }
        
        structureKeys.forEach((structureKey) => {
            const sceneGroup = appState.generatedScenes[structureKey];
            if (sceneGroup && Array.isArray(sceneGroup)) {
                sceneGroup.forEach((scene, index) => {
                    const sceneId = `${structureKey}-${index}`;
                    totalScenes++;
                    
                    console.log(`Checking scene ${sceneId}, scene title: ${scene.title}`);
                    
                    // Check if dialogue exists for this scene (try multiple key formats)
                    let dialogueFound = false;
                    let dialogueContent = null;
                    
                    // Try position-based key first
                    if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                        dialogueContent = appState.generatedDialogues[sceneId];
                        dialogueFound = true;
                    }
                    // Try scene title as key
                    else if (appState.generatedDialogues && scene.title && appState.generatedDialogues[scene.title]) {
                        dialogueContent = appState.generatedDialogues[scene.title];
                        dialogueFound = true;
                    }
                    // Try normalized scene title
                    else if (appState.generatedDialogues && scene.title) {
                        const normalizedTitle = scene.title.replace(/\s+/g, '_');
                        if (appState.generatedDialogues[normalizedTitle]) {
                            dialogueContent = appState.generatedDialogues[normalizedTitle];
                            dialogueFound = true;
                        }
                    }
                    
                    if (dialogueFound) {
                        // Scene has dialogue - format it professionally
                        script += formatSceneForScreenplay(dialogueContent, sceneNumber);
                        totalGeneratedScenes++;
                    } else {
                        // Scene doesn't have dialogue yet - show professional placeholder
                        script += formatPlaceholderScene(scene, sceneNumber);
                    }
                    
                    sceneNumber++;
                });
            }
        });
    } else {
        // Final fallback: if no scene structure, just add generated dialogues
        console.log('No scene structure, using fallback dialogue method');
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
    const author = '[Author Name]';
    const date = new Date().toLocaleDateString();
    
    return `




                                    ${title.toUpperCase()}


                                      by

                                   ${author}




                                Based on a true story
                                    (if applicable)




                                     ${date}




                              Contact Information:
                              [Your Name]
                              [Your Address]
                              [Your Phone]
                              [Your Email]




                                   FIRST DRAFT`;
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
            formatted += `\n${line.toUpperCase()}\n\n`;
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
    
    formatted += `${sceneHeading}\n\n`;
    formatted += `${scene.description || 'Scene description not available.'}\n\n`;
    formatted += `                    [DIALOGUE NOT GENERATED]\n\n`;
    formatted += `          This scene requires dialogue generation\n`;
    formatted += `          to complete the screenplay.\n\n\n`;
    
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
            const scriptText = await response.text();
            downloadFile(scriptText, `${appState.storyInput.title || 'script'}.txt`, 'text/plain');
        }
        
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
        
        const response = await fetch('/api/save-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...appState,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.projectId = data.projectId;
            showToast(`Project saved! ID: ${data.projectId}`, 'success');
        } else {
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

// Navigation functions
// Force navigation to a step without validation (used for loaded projects)
async function forceGoToStep(stepNumber) {
    console.log(`Force navigating to step ${stepNumber} without validation`);
    await goToStepInternal(stepNumber, false);
}

// Regular navigation with validation
async function goToStep(stepNumber) {
    await goToStepInternal(stepNumber, true);
}

// Internal function that handles both validated and forced navigation
async function goToStepInternal(stepNumber, validateAccess = true) {
    console.log(`goToStepInternal: step=${stepNumber}, validate=${validateAccess}`);
    
    // If validation is enabled and we can't navigate to this step, don't proceed
    if (validateAccess && !canNavigateToStep(stepNumber)) {
        console.warn(`Cannot navigate to step ${stepNumber} - validation failed`);
        return;
    }
    
    console.log(`Proceeding to step ${stepNumber}`);
    
    // Hide all steps
    document.querySelectorAll('.workflow-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show target step
    document.getElementById(`step${stepNumber}`).classList.add('active');
    
    // Refresh content for specific steps when navigating to them
    if (stepNumber === 1) {
        // Step 1: Story Input - Update character, influence, and story concept displays
        console.log('Step 1 - Story Input');
        updateCharacterTags();
        updateInfluenceTags('director');
        updateInfluenceTags('screenwriter');
        updateInfluenceTags('film');
        updateStoryConceptDisplay();
    } else if (stepNumber === 3) {
        // Step 3: Acts Generation - Show template structure preview
        console.log('Step 3 - Acts Generation');
        await displayTemplateStructurePreview();
    } else if (stepNumber === 4) {
        // Step 4: Plot Points Generation
        console.log('Step 4 - Plot Points Generation');
        if (appState.generatedStructure) {
            await displayPlotPointsGeneration();
        }
    } else if (stepNumber === 5) {
        // Step 5: Scene Generation
        console.log('Step 5 - Scene Generation');
        
        // Update the totalScenes field with current value
        const totalScenesField = document.getElementById('totalScenes');
        if (totalScenesField && appState.storyInput) {
            totalScenesField.value = appState.storyInput.totalScenes || 70;
        }
        
        if (appState.storyInput) {
            const totalScenesElement = document.getElementById('totalScenesDisplay');
            if (totalScenesElement) {
                totalScenesElement.textContent = appState.storyInput.totalScenes || 70;
            }
        }
        
        if (appState.generatedStructure) {
            displayScenes(appState.generatedScenes || {});
        }
    } else if (stepNumber === 6 && appState.generatedScenes) {
        // Step 6: Dialogue Generation
        displayDialogueGeneration();
    } else if (stepNumber === 7) {
        // Step 7: Final Script - Auto-assemble script with whatever dialogue we have
        if (Object.keys(appState.generatedDialogues || {}).length > 0) {
            // Add a small delay to ensure DOM is fully rendered
            setTimeout(() => {
                assembleScript();
            }, 100);
        }
    }
    
    appState.currentStep = stepNumber;
    updateProgressBar();
    updateStepIndicators();
    
    // Update project header if project is loaded
    if (appState.storyInput) {
        showProjectHeader(appState.storyInput);
    }
    
    // Trigger auto-save on step transitions (but not initial load)
    if (validateAccess && autoSaveManager.hasProjectData()) {
        autoSaveManager.markDirty();
    }
    
    saveToLocalStorage();
}

// Check if navigation to a specific step is allowed
function canNavigateToStep(stepNumber) {
    let result;
    switch (stepNumber) {
        case 1:
            result = true; // Can always go to step 1
            break;
        case 2:
            result = appState.storyInput && appState.storyInput.title; // Need story input
            break;
        case 3:
            result = appState.selectedTemplate || appState.generatedStructure; // Need template selected OR structure already generated
            if (stepNumber === 3) {
                console.log('Step 3 validation:', {
                    selectedTemplate: appState.selectedTemplate,
                    hasStructure: !!appState.generatedStructure,
                    structureKeys: Object.keys(appState.generatedStructure || {}),
                    result: result
                });
            }
            break;
        case 4:
            result = appState.generatedStructure; // Need structure generated
            break;
        case 5:
            result = appState.plotPoints && Object.keys(appState.plotPoints).length > 0; // Need plot points generated
            break;
        case 6:
            result = appState.generatedScenes; // Need scenes generated
            break;
        case 7:
            result = Object.keys(appState.generatedDialogues || {}).length > 0; // Need at least some dialogue generated
            if (stepNumber === 7) {
                console.log('Step 7 validation:', {
                    dialogueCount: Object.keys(appState.generatedDialogues || {}).length,
                    dialogueKeys: Object.keys(appState.generatedDialogues || {}),
                    result: result
                });
            }
            break;
        default:
            result = false;
    }
    
    return result;
}

// Handle clicking on step indicators
function handleStepClick(stepNumber) {
    if (stepNumber === appState.currentStep) {
        return; // Already on this step
    }
    
    if (canNavigateToStep(stepNumber)) {
        goToStep(stepNumber);
        showToast(`Navigated to Step ${stepNumber}`, 'success');
    } else {
        // Show helpful message about what's needed
        const requirements = {
            2: "Please complete the story input first",
            3: "Please select a story structure template first", 
            4: "Please generate and approve the plot structure first",
            5: "Please generate plot points for structural elements first",
            6: "Please generate and approve scenes first",
            7: "Please generate dialogue for scenes first"
        };
        
        showToast(requirements[stepNumber] || "Cannot navigate to this step yet", 'error');
    }
}

function updateProgressBar() {
    const progressPercentage = (appState.currentStep / 7) * 100;
    elements.progressFill.style.width = `${progressPercentage}%`;
}

function updateStepIndicators() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed', 'disabled');
        
        if (stepNumber === appState.currentStep) {
            step.classList.add('active');
        } else if (stepNumber < appState.currentStep) {
            step.classList.add('completed');
        } else if (!canNavigateToStep(stepNumber)) {
            step.classList.add('disabled');
        }
        
        // Add click handler if not already added
        if (!step.hasAttribute('data-click-handler')) {
            step.setAttribute('data-click-handler', 'true');
            step.addEventListener('click', () => handleStepClick(stepNumber));
        }
    });
}

// Start over
function startOver() {
    if (confirm('Are you sure you want to start over? This will clear all progress.')) {
        localStorage.removeItem('filmScriptGenerator');
        location.reload();
    }
}

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
        
        const response = await fetch('/api/save-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...appState,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`Current project saved! (ID: ${data.projectId}) Starting new project...`, 'success');
            
            // Start fresh project after successful save
            setTimeout(() => {
                startFreshProject();
            }, 1000); // Give user time to see the success message
        } else {
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
    // Clear all app state
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
        influences: {
            directors: [],
            screenwriters: [],
            films: []
        },
        customPrompt: null,
        originalPrompt: null,
        isEditMode: false,
        plotPoints: {}
    });
    
    // Clear story concept
    appState.currentStoryConcept = null;
    updateStoryConceptDisplay();
    // Clear project characters
    appState.projectCharacters = [];
    updateCharacterTags();
    document.getElementById('totalScenes').value = '70';
    document.getElementById('tone').value = '';
    
    // Clear influence tags
    updateInfluenceTags('director');
    updateInfluenceTags('screenwriter');
    updateInfluenceTags('film');
    
    // Hide project header
    hideProjectHeader();
    
    // Clear any existing content displays
    clearAllContentContainers();
    
    // Go to step 1
    goToStep(1);
    
    // Clear localStorage
    localStorage.removeItem('filmScriptGenerator');
    
    showToast('Ready to create your new project!', 'success');
}

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

// Save to localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('filmScriptGenerator', JSON.stringify(appState));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
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
    appState.projectCharacters = projectData.projectCharacters || projectData.storyInput?.charactersData || [];
    appState.influences = projectData.influences || projectData.storyInput?.influences || { directors: [], screenwriters: [], films: [] };
    appState.storyInput = projectData.storyInput || {};
    // Temporary fallbacks for legacy localStorage data (can be removed after migration period)
    appState.selectedTemplate = projectData.selectedTemplate || projectData.template?.id;
    appState.templateData = projectData.templateData || projectData.template;
    appState.generatedStructure = projectData.generatedStructure || projectData.structure || {};
    appState.plotPoints = projectData.plotPoints || {};
    appState.generatedScenes = projectData.generatedScenes || projectData.scenes || {};
    appState.generatedDialogues = projectData.generatedDialogues || projectData.dialogue || {};
    appState.projectId = projectData.projectId || projectData.id;
    appState.projectPath = projectData.projectPath;
    
    // Update UI
    updateStoryConceptDisplay();
    updateCharacterTags();
    validateCharactersRequired();
    updateInfluenceTags('director');
    updateInfluenceTags('screenwriter');
    updateInfluenceTags('film');
    document.getElementById('tone').value = projectData.storyInput?.tone || '';
    
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
                
                // Update the UI
                const templateElements = document.querySelectorAll('.template-card');
                templateElements.forEach(element => {
                    const templateIdAttr = element.getAttribute('data-template-id');
                    if (templateIdAttr === projectData.selectedTemplate) {
                        element.classList.add('selected');
                        console.log('✅ Template UI restored:', projectData.selectedTemplate);
                    }
                });
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

    // Build all scenes array for the prompt
    const allScenes = [];
    Object.entries(appState.generatedScenes).forEach(([key, scenes]) => {
        if (Array.isArray(scenes)) {
            scenes.forEach((scene, index) => {
                allScenes.push({
                    title: scene.title || scene.name || 'Untitled Scene',
                    description: scene.description || '',
                    location: scene.location || '',
                    structureElement: appState.generatedStructure[key]?.name || key
                });
            });
        }
    });

    if (allScenes.length === 0) {
        showToast('No scenes found to generate plot points for.', 'error');
        return;
    }

    try {
        showLoading('Generating all plot points prompt preview...');
        
        const response = await fetch('/api/preview-plot-point-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                allScenes: allScenes
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
        
        // Get current username from app state
        const username = appState.user?.username || 'guest';
        
        const response = await fetch(`/api/project/${encodeURIComponent(projectPath)}?username=${encodeURIComponent(username)}`, {
            method: 'DELETE'
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
function displayScenesForElement(structureKey, sceneGroup) {
    const container = document.getElementById(`scenes-${structureKey}`);
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
            
            // Add regeneration actions for this scene
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'scene-actions';
            actionsDiv.style.marginTop = '10px';
            actionsDiv.style.marginBottom = '20px';
            actionsDiv.innerHTML = `
                <button class="btn btn-primary btn-sm" onclick="generateIndividualScene('${structureKey}', ${index})" title="Regenerate this specific scene">
                    🔄 Regenerate Scene
                </button>
                <button class="btn btn-outline btn-sm" onclick="previewScenePrompt('${structureKey}', ${index})" title="Preview the prompt used to generate this scene">
                    🔍 Scene Prompt
                </button>
            `;
            container.appendChild(actionsDiv);
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
            'Content-Type': 'application/json'
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
function displaySelectedTemplate(templateData) {
    const display = document.getElementById('selectedTemplateDisplay');
    const name = document.getElementById('selectedTemplateName');
    const description = document.getElementById('selectedTemplateDescription');
    const category = document.getElementById('selectedTemplateCategory');
    
    name.textContent = templateData.name;
    description.textContent = templateData.description;
    category.textContent = templateData.category ? templateData.category.replace('_', ' ').toUpperCase() : '';
    
    display.style.display = 'block';
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
        return;
    }
    
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
            
            actElement.innerHTML = `
                <div class="structure-element-header">
                    <h3><span class="act-progress">${actNumber}</span> ${actName}</h3>
                    <div class="structure-element-meta">
                        <span class="preview-status">Ready for generation</span>
                    </div>
                </div>
                <div class="structure-element-content">
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
                'Content-Type': 'application/json'
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

// Add character modal functions
function addCharacter() {
    console.log('AddCharacter: Function called');
    editingCharacterIndex = null;
    
    const titleElement = document.getElementById('characterModalTitle');
    const nameElement = document.getElementById('characterName');
    const descElement = document.getElementById('characterDescription');
    
    console.log('AddCharacter: Elements found:', {
        title: !!titleElement,
        name: !!nameElement,
        description: !!descElement
    });
    
    if (titleElement) titleElement.textContent = 'Add Character';
    if (nameElement) nameElement.value = '';
    if (descElement) descElement.value = '';
    
    console.log('AddCharacter: Calling showCharacterModal');
    showCharacterModal();
}

function editCharacter(index) {
    editingCharacterIndex = index;
    const character = appState.projectCharacters[index];
    document.getElementById('characterModalTitle').textContent = 'Edit Character';
    document.getElementById('characterName').value = character.name;
    document.getElementById('characterDescription').value = character.description;
    showCharacterModal();
}

function deleteCharacter(index) {
    if (confirm('Are you sure you want to delete this character?')) {
        appState.projectCharacters.splice(index, 1);
        updateCharacterTags();
        validateCharactersRequired();
    }
}

function showCharacterModal() {
    console.log('ShowCharacterModal: Function called');
    const modal = document.getElementById('addCharacterModal');
    console.log('ShowCharacterModal: Modal element found:', !!modal);
    
    if (modal) {
        modal.classList.add('show');
        console.log('ShowCharacterModal: Added show class, modal classes:', modal.className);
    } else {
        console.error('ShowCharacterModal: Modal element not found!');
    }
}

function hideCharacterModal() {
    document.getElementById('addCharacterModal').classList.remove('show');
}

function displayCharacters() {
    const container = document.getElementById('charactersList');
    const emptyState = document.getElementById('charactersEmpty');
    
    if (appState.projectCharacters.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    const charactersHtml = appState.projectCharacters.map((character, index) => `
        <div class="character-item">
            <div class="character-content">
                <div class="character-name">${character.name}</div>
                <div class="character-description">${character.description}</div>
            </div>
            <div class="character-actions">
                <button class="character-edit-btn" onclick="editCharacter(${index})">Edit</button>
                <button class="character-delete-btn" onclick="deleteCharacter(${index})">Delete</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <div class="characters-empty" id="charactersEmpty" style="display: none;">
            No characters added yet. Click "Add Character" to get started.
        </div>
        ${charactersHtml}
    `;
}

// Add character from library functionality
async function addCharacterFromLibrary() {
    try {
        // Load user's character library
        const response = await fetch('/api/user-libraries/guest/characters');
        const characterLibrary = await response.json();
        
        displayCharacterLibrary(characterLibrary);
        showCharacterLibraryModal();
    } catch (error) {
        console.error('Failed to load character library:', error);
        showToast('Failed to load character library', 'error');
    }
}

function displayCharacterLibrary(characters) {
    const container = document.getElementById('characterLibraryList');
    
    if (characters.length === 0) {
        container.innerHTML = '<div class="character-library-empty">No characters in your library yet. Create some in your <a href="profile.html">profile</a>.</div>';
        return;
    }
    
    const charactersHtml = characters.map(char => `
        <div class="character-library-item" onclick="selectCharacterFromLibrary('${char.entry_key}', '${char.entry_data.name}', '${char.entry_data.description}')">
            <div class="character-name">${char.entry_data.name}</div>
            <div class="character-description">${char.entry_data.description}</div>
        </div>
    `).join('');
    
    container.innerHTML = charactersHtml;
}

function selectCharacterFromLibrary(key, name, description) {
    // Add to project characters
    appState.projectCharacters.push({
        name: name,
        description: description,
        fromLibrary: true,
        libraryKey: key
    });
    
    updateCharacterTags();
    hideCharacterLibraryModal();
    validateCharactersRequired();
    
    // Mark as dirty to trigger auto-save
    appState.pendingChanges = true;
    if (autoSaveManager) {
        autoSaveManager.markDirty();
    }
    
    showToast(`Added "${name}" to your project`);
}

function showCharacterLibraryModal() {
    document.getElementById('characterLibraryModal').classList.add('show');
}

function hideCharacterLibraryModal() {
    document.getElementById('characterLibraryModal').classList.remove('show');
}

// Character form submission
document.getElementById('characterForm').onsubmit = function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('characterName').trim();
    const description = formData.get('characterDescription').trim();
    
    if (!name || !description) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    const character = { name, description };
    
    if (editingCharacterIndex !== null) {
        // Editing existing character
        appState.projectCharacters[editingCharacterIndex] = character;
        console.log(`🔍 CHARACTER DEBUG: Updated character at index ${editingCharacterIndex}:`, character);
        showToast('Character updated');
    } else {
        // Adding new character
        appState.projectCharacters.push(character);
        console.log(`🔍 CHARACTER DEBUG: Added new character:`, character);
        showToast('Character added');
        
        // Offer to save to library if authenticated
        if (appState.isAuthenticated) {
            checkAndOfferLibrarySave('character', name);
        }
    }
    
    console.log('  - Current projectCharacters:', appState.projectCharacters);
    
    // Mark as dirty to trigger auto-save
    appState.pendingChanges = true;
    if (autoSaveManager) {
        autoSaveManager.markDirty();
    }
    console.log('  - Marked as dirty for auto-save');
    
    updateCharacterTags();
    hideCharacterModal();
    validateCharactersRequired();
    e.target.reset();
};



// Characters are now optional - validation disabled
function validateCharactersRequired() {
    // Characters are now optional, so always enable the continue button
    const continueBtn = document.querySelector('#step1 .btn-primary');
    if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue to Act Selection';
    }
}

// Get characters as text for prompt generation (replaces old textarea value)
function getCharactersForPrompt() {
    return appState.projectCharacters.map(char => `${char.name}: ${char.description}`).join('\n\n');
}

// Modal click outside to close (for character modals)
document.addEventListener('click', function(e) {
    if (e.target.id === 'addCharacterModal') {
        hideCharacterModal();
    }
    if (e.target.id === 'characterLibraryModal') {
        hideCharacterLibraryModal();
    }
});

// Initialize character system when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateCharacterTags();
    validateCharactersRequired();
});

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

// Auto-Save Manager
const autoSaveManager = {
    saveTimeout: null,
    saveInterval: null,
    lastSaveState: null,
    
    init() {
        // Set up periodic auto-save check (less frequent to reduce server load)
        this.saveInterval = setInterval(() => {
            this.checkAndAutoSave();
        }, 60000); // Check every 60 seconds
        
        // Save on window unload
        window.addEventListener('beforeunload', (e) => {
            if (appState.pendingChanges && this.hasProjectData()) {
                this.saveImmediately();
                // Modern browsers ignore custom messages, but we try anyway
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
        
        console.log('🔄 Auto-save manager initialized');
    },
    
    hasProjectData() {
        // Only auto-save if we have meaningful project data AND user is authenticated
        return appState.isAuthenticated && 
               appState.apiKey && 
               appState.storyInput && 
               appState.storyInput.title && 
               appState.storyInput.title.trim();
    },
    
    markDirty() {
        appState.pendingChanges = true;
        this.scheduleAutoSave();
    },
    
    scheduleAutoSave() {
        if (!appState.autoSaveEnabled || appState.saveInProgress) return;
        
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        // Schedule save in 5 seconds (longer debounce to reduce server load)
        this.saveTimeout = setTimeout(() => {
            this.performAutoSave();
        }, 5000);
    },
    
    async performAutoSave() {
        if (!this.hasProjectData() || appState.saveInProgress) return;
        
        try {
            appState.saveInProgress = true;
            this.updateSaveStatus('Saving...');
            
            await this.saveProjectData();
            
            appState.pendingChanges = false;
            appState.lastSaveTime = new Date();
            this.updateSaveStatus('Saved', 'success');
            
            console.log('✅ Auto-save completed');
        } catch (error) {
            console.warn('⚠️ Auto-save failed (will retry later):', error.message);
            // Don't show error status for network issues - just fail silently
            if (error.message.includes('Failed to fetch') || error.message.includes('CONNECTION_RESET')) {
                this.updateSaveStatus(''); // Hide status
            } else {
                this.updateSaveStatus('Save failed', 'error');
            }
        } finally {
            appState.saveInProgress = false;
        }
    },
    
    async saveImmediately() {
        if (!this.hasProjectData()) return;
        
        try {
            appState.saveInProgress = true;
            await this.saveProjectData();
            appState.pendingChanges = false;
            appState.lastSaveTime = new Date();
        } catch (error) {
            console.error('❌ Immediate save failed:', error);
        } finally {
            appState.saveInProgress = false;
        }
    },
    
    async saveProjectData() {
        // Generate project path if not exists
        if (!appState.projectPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const titleSlug = appState.storyInput.title
                ? appState.storyInput.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)
                : 'untitled';
            appState.projectPath = `${titleSlug}_${timestamp}`;
        }
        
        // DEBUG: Log what we're about to save
        console.log('🔍 AUTO-SAVE DEBUG: Current appState before saving:');
        console.log('  - generatedStructure keys:', Object.keys(appState.generatedStructure || {}));
        console.log('  - structure keys (legacy):', Object.keys(appState.structure || {}));
        console.log('  - plotPoints keys:', Object.keys(appState.plotPoints || {}));
        console.log('  - generatedScenes keys:', Object.keys(appState.generatedScenes || {}));
        
        const projectData = {
            ...appState,
            username: appState.user?.username || 'guest', // Include current username
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        console.log('🔍 AUTO-SAVE DEBUG: projectData being sent to server:');
        console.log('  - projectData.generatedStructure keys:', Object.keys(projectData.generatedStructure || {}));
        console.log('  - projectData.structure keys (legacy):', Object.keys(projectData.structure || {}));
        console.log('  - projectData.plotPoints keys:', Object.keys(projectData.plotPoints || {}));
        
        // Save to both file system and database
        const response = await fetch('/api/auto-save-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appState.apiKey}`
            },
            body: JSON.stringify(projectData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save project');
        }
        
        const result = await response.json();
        
        // Update project info if returned
        if (result.projectPath) {
            appState.projectPath = result.projectPath;
        }
        if (result.projectId) {
            appState.projectId = result.projectId;
        }
        
        // Update localStorage
        this.saveToLocalStorage();
        
        return result;
    },
    
    checkAndAutoSave() {
        if (appState.pendingChanges && this.hasProjectData() && !appState.saveInProgress) {
            this.performAutoSave();
        }
    },
    
    updateSaveStatus(message, type = 'info') {
        const statusElement = document.getElementById('saveStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `save-status ${type}`;
            
            // Hide status after 3 seconds for non-error messages
            if (type !== 'error') {
                setTimeout(() => {
                    if (statusElement.textContent === message) {
                        statusElement.textContent = '';
                        statusElement.className = 'save-status';
                    }
                }, 3000);
            }
        }
    },
    
    saveToLocalStorage() {
        try {
            localStorage.setItem('filmScriptGenerator', JSON.stringify({
                ...appState,
                lastSaved: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    },
    
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('filmScriptGenerator');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Restore state
                Object.assign(appState, data);
                
                // Clear auto-save flags
                appState.saveInProgress = false;
                appState.pendingChanges = false;
                
                return true;
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
        return false;
    },
    
    destroy() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        if (this.saveInterval) clearInterval(this.saveInterval);
    }
};

// Shared Project Card Generator - Reuses the modal card format
function generateProjectCard(project, context = 'modal') {
    // Format progress information
    const progressInfo = project.progress || { step: 1, label: 'Story Concept', icon: '💡' };
    const progressBadge = `<span class="progress-badge" title="${progressInfo.icon} ${progressInfo.label}">${progressInfo.step}/7</span>`;
    
    // Different actions based on context
    const actions = context === 'profile' ? `
        <button class="load-project-btn" onclick="event.stopPropagation(); openProject('${project.path}')">
            📁 Open Project
        </button>
        <button class="delete-project-btn" onclick="event.stopPropagation(); deleteProject('${project.path}', '${project.title.replace(/'/g, "\\'")}')">
            🗑️ Delete
        </button>
    ` : `
        <button class="load-project-btn" onclick="loadProject('${project.path}')">
            📁 Load Project
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
                <strong>Created:</strong> ${new Date(project.createdAt).toLocaleDateString()}
            </div>
            <div class="project-logline">"${project.logline}"</div>
            <div class="project-actions">
                ${actions}
            </div>
        </div>
    `;
}