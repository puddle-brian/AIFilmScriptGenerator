/**
 * App State Manager Component
 * Extracted from script.js for modular architecture
 * Handles app state persistence, auto-save, and localStorage operations
 */

// Local Storage Manager
class LocalStorageManager {
    constructor() {
        this.storageKey = 'filmScriptGenerator';
    }

    // Save current app state to localStorage
    save() {
        try {
            if (!window.appState) {
                console.warn('No appState available for localStorage save');
                return;
            }

            localStorage.setItem(this.storageKey, JSON.stringify({
                ...window.appState,
                lastSaved: new Date().toISOString()
            }));
            
            // Update progress meters when state changes
            if (typeof updateAllProgressMeters === 'function') {
                updateAllProgressMeters();
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    // Load app state from localStorage
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                // Remove the lastSaved timestamp before returning
                delete data.lastSaved;
                return data;
            }
            return null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    // Clear localStorage
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }

    // Check if localStorage has data
    hasData() {
        try {
            return localStorage.getItem(this.storageKey) !== null;
        } catch (error) {
            return false;
        }
    }
}

// Auto-Save Manager
class AutoSaveManager {
    constructor() {
        this.saveTimeout = null;
        this.saveInterval = null;
        this.lastSaveState = null;
        this.localStorageManager = new LocalStorageManager();
    }

    init() {
        // Set up periodic auto-save check (less frequent to reduce server load)
        this.saveInterval = setInterval(() => {
            this.checkAndAutoSave();
        }, 60000); // Check every 60 seconds
        
        // Save on window unload
        window.addEventListener('beforeunload', (e) => {
            if (window.appState && window.appState.pendingChanges && this.hasProjectData()) {
                // Try to save immediately without showing warning
                this.saveImmediately();
                // Don't show the "leave site" warning since we have auto-save
                // The system will save automatically
            }
        });
        
        console.log('🔄 Auto-save manager initialized');
    }

    hasProjectData() {
        // Only auto-save if we have meaningful project data AND user is authenticated
        return window.appState && 
               window.appState.isAuthenticated && 
               window.appState.apiKey && 
               window.appState.storyInput && 
               window.appState.storyInput.title && 
               window.appState.storyInput.title.trim();
    }

    markDirty() {
        if (window.appState) {
            window.appState.pendingChanges = true;
        }
        this.scheduleAutoSave();
    }

    scheduleAutoSave() {
        if (!window.appState || !window.appState.autoSaveEnabled || window.appState.saveInProgress) return;
        
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        // Schedule save in 5 seconds (longer debounce to reduce server load)
        this.saveTimeout = setTimeout(() => {
            this.performAutoSave();
        }, 5000);
    }

    async performAutoSave() {
        if (!this.hasProjectData() || (window.appState && window.appState.saveInProgress)) return;
        
        try {
            if (window.appState) {
                window.appState.saveInProgress = true;
            }
            this.updateSaveStatus('Saving...');
            
            await this.saveProjectData();
            
            if (window.appState) {
                window.appState.pendingChanges = false;
                window.appState.lastSaveTime = new Date();
            }
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
            if (window.appState) {
                window.appState.saveInProgress = false;
            }
        }
    }

    async saveImmediately() {
        if (!this.hasProjectData()) return;
        
        try {
            if (window.appState) {
                window.appState.saveInProgress = true;
            }
            await this.saveProjectData();
            if (window.appState) {
                window.appState.pendingChanges = false;
                window.appState.lastSaveTime = new Date();
            }
        } catch (error) {
            console.error('❌ Immediate save failed:', error);
        } finally {
            if (window.appState) {
                window.appState.saveInProgress = false;
            }
        }
    }

    async saveProjectData() {
        if (!window.appState) {
            throw new Error('No appState available');
        }

        // Generate project path if not exists
        if (!window.appState.projectPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const titleSlug = window.appState.storyInput.title
                ? window.appState.storyInput.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)
                : 'untitled';
            window.appState.projectPath = `${titleSlug}_${timestamp}`;
        }
        
        // 🔧 SYNC FIX: Ensure storyInput stays synchronized with appState
        if (window.appState.storyInput && window.appState.influences) {
            window.appState.storyInput.influences = window.appState.influences;
            if (typeof buildInfluencePrompt === 'function') {
                window.appState.storyInput.influencePrompt = buildInfluencePrompt();
            }
            console.log('🔄 AUTO-SAVE: Synchronized influences to storyInput:', window.appState.influences);
        }
        
        // 🔧 CRITICAL FIX: Always ensure formatted character strings before saving
        // This prevents character objects from corrupting the storyInput.characters field
        if (window.appState.projectCharacters && window.appState.projectCharacters.length > 0 && window.appState.storyInput) {
            if (typeof getCharactersForPrompt === 'function') {
                window.appState.storyInput.characters = getCharactersForPrompt();
                console.log('🔧 AUTO-SAVE: Ensured character format:', window.appState.storyInput.characters);
            }
        }
        
        // DEBUG: Log what we're about to save
        console.log('🔍 AUTO-SAVE DEBUG: Current appState before saving:');
        console.log('  - generatedStructure keys:', Object.keys(window.appState.generatedStructure || {}));
        console.log('  - structure keys (legacy):', Object.keys(window.appState.structure || {}));
        console.log('  - plotPoints keys:', Object.keys(window.appState.plotPoints || {}));
        console.log('  - generatedScenes keys:', Object.keys(window.appState.generatedScenes || {}));
        console.log('  - 🎭 templateData:', window.appState.templateData ? {
            id: window.appState.templateData.id,
            name: window.appState.templateData.name,
            hasStructure: !!window.appState.templateData.structure,
            structureKeys: window.appState.templateData.structure ? Object.keys(window.appState.templateData.structure) : [],
            hasOriginalOrder: !!window.appState.templateData.originalOrder
        } : 'null');
        console.log('  - 🎬 influences sync:', {
            appStateInfluences: window.appState.influences,
            storyInputInfluences: window.appState.storyInput?.influences,
            areEqual: JSON.stringify(window.appState.influences) === JSON.stringify(window.appState.storyInput?.influences)
        });
        
        const projectData = {
            ...window.appState,
            username: window.appState.user?.username || 'guest', // Include current username
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
                'X-API-Key': window.appState.apiKey
            },
            body: JSON.stringify(projectData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            
            // Check for specific bug detection error
            if (error.action === 'reload_required') {
                console.error('🚨 Auto-save bug detected:', error);
                this.updateSaveStatus(`⚠️ ${error.message}`, 'error');
                
                // Show user-friendly notification
                if (typeof showToast === 'function') {
                    showToast('Auto-save failed due to a technical issue. Please reload the page to continue.', 'error');
                }
                
                // Ask user if they want to reload automatically
                setTimeout(() => {
                    if (confirm('There was an issue with auto-save. Would you like to reload the page to fix this? (Your progress should be preserved)')) {
                        window.location.reload();
                    }
                }, 2000);
                
                return { error: error.message };
            }
            
            throw new Error(error.error || 'Failed to save project');
        }
        
        const result = await response.json();
        
        // Update project info if returned
        if (result.projectPath && window.appState) {
            window.appState.projectPath = result.projectPath;
        }
        if (result.projectId && window.appState) {
            window.appState.projectId = result.projectId;
        }
        
        // Update localStorage
        this.localStorageManager.save();
        
        return result;
    }

    checkAndAutoSave() {
        if (window.appState && window.appState.pendingChanges && this.hasProjectData() && !window.appState.saveInProgress) {
            this.performAutoSave();
        }
    }

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
    }

    loadFromLocalStorage() {
        return this.localStorageManager.load();
    }

    destroy() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
    }
}

// App State Manager (Main Controller)
class AppStateManager {
    constructor() {
        this.autoSaveManager = new AutoSaveManager();
        this.localStorageManager = new LocalStorageManager();
    }

    init() {
        this.autoSaveManager.init();
        console.log('✅ AppStateManager initialized');
    }

    // Mark state as dirty (needs saving)
    markDirty() {
        this.autoSaveManager.markDirty();
    }

    // Save immediately
    async saveImmediately() {
        return await this.autoSaveManager.saveImmediately();
    }

    // Save to localStorage only
    saveToLocalStorage() {
        this.localStorageManager.save();
    }

    // Load from localStorage
    loadFromLocalStorage() {
        return this.localStorageManager.load();
    }

    // Clear localStorage
    clearLocalStorage() {
        this.localStorageManager.clear();
    }

    // Check if has project data
    hasProjectData() {
        return this.autoSaveManager.hasProjectData();
    }

    // Destroy manager
    destroy() {
        this.autoSaveManager.destroy();
    }
}

// Create global instances
const appStateManagerInstance = new AppStateManager();

// Export for global access (backward compatibility)
window.appStateManagerInstance = appStateManagerInstance;
window.autoSaveManager = appStateManagerInstance.autoSaveManager;

// Global functions for backward compatibility
window.saveToLocalStorage = function() {
    appStateManagerInstance.saveToLocalStorage();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        appStateManagerInstance.init();
    });
} else {
    appStateManagerInstance.init();
}

console.log('🔧 AppStateManager component loaded'); 