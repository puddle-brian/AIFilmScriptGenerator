/**
 * Library Manager Component
 * Handles all library management functionality for the Film Script Generator
 */

class LibraryManager {
    constructor() {
        this.LIBRARY_TYPES = {
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
    }

    // Core library functions
    addInfluence(type) {
        const selectElement = document.getElementById(`${type}Select`);
        
        let value = '';
        if (selectElement && selectElement.value) {
            value = selectElement.value;
            selectElement.value = '';
        }
        
        if (value && !appState.influences[type + 's'].includes(value)) {
            appState.influences[type + 's'].push(value);
            this.updateInfluenceTags(type);
            saveToLocalStorage();
            
            // Mark as dirty to trigger auto-save
            appState.pendingChanges = true;
            if (autoSaveManager) {
                autoSaveManager.markDirty();
            }
            
            this.checkAndOfferLibrarySave(type, value);
        }
    }

    removeInfluence(type, value) {
        if (!appState.influences) appState.influences = {};
        
        const pluralType = type + 's';
        if (!appState.influences[pluralType]) appState.influences[pluralType] = [];
        
        const index = appState.influences[pluralType].indexOf(value);
        if (index > -1) {
            appState.influences[pluralType].splice(index, 1);
            this.updateInfluenceTags(type);
            saveToLocalStorage();
            
            appState.pendingChanges = true;
            if (autoSaveManager) {
                autoSaveManager.markDirty();
            }
        }
    }

    updateInfluenceTags(type) {
        const container = document.getElementById(`${type}Tags`);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!appState.influences) appState.influences = {};
        const pluralType = type + 's';
        if (!appState.influences[pluralType]) appState.influences[pluralType] = [];
        
        appState.influences[pluralType].forEach(influence => {
            const tag = document.createElement('div');
            tag.className = 'influence-tag clickable-tag';
            tag.innerHTML = `
                <span onclick="editInfluenceEntry('${type}', '${influence.replace(/'/g, "\\'")}');" style="cursor: pointer; flex: 1;">${influence}</span>
                <button type="button" class="remove-tag" onclick="removeInfluence('${type}', '${influence.replace(/'/g, "\\'")}')">×</button>
            `;
            container.appendChild(tag);
        });
        
        updateAutoGenerateButtonVisibility();
    }

    async checkAndOfferLibrarySave(type, value) {
        if (!appState.isAuthenticated) return;
        
        const config = this.LIBRARY_TYPES[type];
        if (!config) return;
        
        try {
            let userLibrary = [];
            if (window.apiClient) {
                window.apiClient.setApiKey(appState.apiKey);
                userLibrary = await window.apiClient.getUserLibrary(appState.user.username, config.plural);
            }
            
            const exists = userLibrary.some(item => 
                item.entry_data.name === value || item.entry_key === value
            );
            
            if (!exists) {
                this.showUniversalLibrarySaveModal(type, value, config);
            }
        } catch (error) {
            this.showUniversalLibrarySaveModal(type, value, config);
        }
    }

    async loadUserLibraries() {
        if (!appState.isAuthenticated) {
            return { directors: [], screenwriters: [], films: [], tones: [], characters: [], storyconcepts: [] };
        }
        
        try {
            const libraryTypes = ['directors', 'screenwriters', 'films', 'tones', 'characters', 'storyconcepts'];
            const userLibraries = { directors: [], screenwriters: [], films: [], tones: [], characters: [], storyconcepts: [] };
            
            for (const type of libraryTypes) {
                try {
                    const response = await fetch(`/api/user-libraries/${appState.user.username}/${type}`);
                    if (response.ok) {
                        const libraries = await response.json();
                        if (type === 'characters' || type === 'storyconcepts') {
                            // For characters and story concepts, preserve both entry_data and entry_key
                            userLibraries[type] = libraries.map(lib => ({
                                ...lib.entry_data,
                                entry_key: lib.entry_key
                            }));
                        } else {
                            // For influences, preserve both name and entry_key for editing
                            userLibraries[type] = libraries.map(lib => ({
                                name: lib.entry_data.name,
                                entry_key: lib.entry_key
                            }));
                        }
                    }
                } catch (error) {
                    // Continue with empty array
                }
            }
            
            return userLibraries;
        } catch (error) {
            return { directors: [], screenwriters: [], films: [], tones: [], characters: [], storyconcepts: [] };
        }
    }

    buildInfluencePrompt() {
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

    // Modal functions
    showUniversalLibrarySaveModal(type, value, config, isNewEntry = false) {
        const isEdit = window.editingLibraryEntry && !isNewEntry;
        const modalTitle = isNewEntry ? `Add New ${config.displayName}` : 
                          isEdit ? `Edit ${config.displayName}` : 
                          `Save ${config.displayName} to Library`;
        
        const modalMessage = isNewEntry ? 
            `Create a new ${config.singular} for your library:` : 
            `Would you like to save "<strong>${value}</strong>" to your ${config.plural} library?`;
        
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
                                    <textarea id="universalLibraryEntryDescription" rows="3" placeholder="${config.placeholder}"></textarea>
                                </div>
                            ` : `
                                <div class="form-group">
                                    <label for="universalLibraryEntryName">${config.displayName} Influence</label>
                                    <input type="text" id="universalLibraryEntryName" value="${value}" required placeholder="${config.placeholder}">
                                </div>
                            `}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <div class="modal-footer-left">
                            <!-- Genie button will be injected here -->
                        </div>
                        <div class="modal-footer-right">
                            <button class="btn btn-secondary" onclick="hideUniversalLibrarySaveModal()">Cancel</button>
                            <button class="btn btn-primary" onclick="saveToLibraryAndContinue('${type}', ${isNewEntry})">
                                ${isNewEntry ? 'Add to Library' : isEdit ? 'Update' : 'Save to Library'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('universalLibrarySaveModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('universalLibrarySaveModal').classList.add('show');
        
        setTimeout(() => {
            document.getElementById('universalLibraryEntryName').focus();
        }, 100);
    }

    hideUniversalLibrarySaveModal() {
        const modal = document.getElementById('universalLibrarySaveModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // Save function
    async saveToLibraryAndContinue(type, isNewEntry = false) {
        const name = document.getElementById('universalLibraryEntryName').value.trim();
        const descriptionElement = document.getElementById('universalLibraryEntryDescription');
        const description = descriptionElement ? descriptionElement.value.trim() : '';
        const config = this.LIBRARY_TYPES[type];
        
        if (!name) {
            showToast('Please provide a name', 'error');
            return;
        }
        
        if (!appState.user?.username) {
            showToast('User not authenticated', 'error');
            return;
        }
        
        try {
            const isEditing = window.editingLibraryEntry;
            let url, method;
            
            if (isEditing && !isEditing.isNewCharacterEntry) {
                method = 'PUT';
                url = `/api/user-libraries/${appState.user.username}/${isEditing.type}/${encodeURIComponent(isEditing.key)}`;
            } else {
                method = 'POST';
                let entryKey = name.toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-+|-+$/g, '');
                    
                if (entryKey.length > 47) {
                    entryKey = entryKey.substring(0, 47) + '...';
                }
                
                url = `/api/user-libraries/${appState.user.username}/${config.plural}/${entryKey}`;
            }
            
            const entryData = (type === 'character' || type === 'storyconcept') ? {
                name, 
                description: description || (type === 'character' ? `Main character: ${name}` : `Story concept: ${name}`)
            } : {
                name,
                description: `${config.displayName} influence: ${name}`
            };
            
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify(entryData)
            });
            
            if (response.ok) {
                const action = (isEditing && !isEditing.isNewCharacterEntry) ? 'updated' : 'saved';
                showToast(`"${name}" ${action} in your ${config.plural} library!`, 'success');
                
                // Handle different types of entries
                if (isNewEntry) {
                    if (type === 'character') {
                        const character = {
                            name: name,
                            description: description || `Main character: ${name}`,
                            fromLibrary: true
                        };
                        appState.projectCharacters.push(character);
                        updateCharacterTags();
                    } else if (type === 'storyconcept') {
                        appState.currentStoryConcept = {
                            title: name,
                            logline: description || '',
                            fromLibrary: true
                        };
                        updateStoryConceptDisplay();
                        initializeNewProjectFromStoryConcept(name, description || '');
                    } else {
                        if (!appState.influences[config.plural].includes(name)) {
                            appState.influences[config.plural].push(name);
                            this.updateInfluenceTags(type);
                        }
                    }
                    
                    saveToLocalStorage();
                    appState.pendingChanges = true;
                    if (autoSaveManager) {
                        autoSaveManager.markDirty();
                    }
                } else if (isEditing && !isEditing.isNewCharacterEntry) {
                    // Handle editing existing entries
                    if (type === 'character') {
                        // Update the character in appState.projectCharacters to reflect the new name
                        const oldName = isEditing.originalName;
                        if (oldName && oldName !== name) {
                            appState.projectCharacters.forEach(character => {
                                if (character.name === oldName) {
                                    character.name = name;
                                    character.description = description || character.description;
                                }
                            });
                        }
                        // Update character tags to reflect name changes
                        updateCharacterTags();
                    } else if (type === 'storyconcept') {
                        // Update the story concept in appState.currentStoryConcept to reflect changes
                        if (appState.currentStoryConcept) {
                            appState.currentStoryConcept.title = name;
                            appState.currentStoryConcept.logline = description || appState.currentStoryConcept.logline;
                        }
                        // Update story concept display
                        updateStoryConceptDisplay();
                    } else {
                        // Handle influence editing - update the name in appState.influences
                        const oldName = isEditing.originalName;
                        if (oldName && oldName !== name) {
                            const pluralType = config.plural;
                            if (appState.influences && appState.influences[pluralType]) {
                                const index = appState.influences[pluralType].indexOf(oldName);
                                if (index > -1) {
                                    appState.influences[pluralType][index] = name;
                                    this.updateInfluenceTags(type);
                                }
                            }
                        }
                    }
                    
                    saveToLocalStorage();
                    appState.pendingChanges = true;
                    if (autoSaveManager) {
                        autoSaveManager.markDirty();
                    }
                }
                
                await populateDropdowns();
            } else if (response.status === 409) {
                // Handle duplicate entry conflict
                const errorData = await response.json();
                const displayName = type === 'character' ? 'Character' : 
                                  type === 'storyconcept' ? 'Story concept' : 
                                  config.displayName;
                showToast(`${displayName} "${name}" already exists in your library. Please choose a different name or update the existing entry.`, 'error');
                return; // Don't close the modal - let user try again
            } else {
                // Handle other error responses
                let errorMessage = 'Failed to save to library';
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Could not parse error response
                }
                showToast(errorMessage, 'error');
            }
        } catch (error) {
            // Handle network errors or other exceptions
            if (error.response && error.response.status === 409) {
                const displayName = type === 'character' ? 'Character' : 
                                  type === 'storyconcept' ? 'Story concept' : 
                                  config.displayName;
                showToast(`${displayName} "${name}" already exists in your library. Please choose a different name or update the existing entry.`, 'error');
                return; // Don't close the modal - let user try again
            } else {
                showToast('Error saving to library', 'error');
            }
        }
        
        if (window.editingLibraryEntry) {
            window.editingLibraryEntry = null;
        }
        
        this.hideUniversalLibrarySaveModal();
    }

    // 🧞 GENIE INTEGRATION NOTE
    // Genie suggestions are now handled by the centralized genie-suggestions.js system
    // No local genie integration needed in this component
}

// Create global instance
const libraryManager = new LibraryManager();
window.libraryManagerInstance = libraryManager;

// Legacy wrapper functions for backward compatibility
function addInfluence(type) {
    return libraryManager.addInfluence(type);
}

function removeInfluence(type, value) {
    return libraryManager.removeInfluence(type, value);
}

function updateInfluenceTags(type) {
    return libraryManager.updateInfluenceTags(type);
}

async function checkAndOfferLibrarySave(type, value) {
    return libraryManager.checkAndOfferLibrarySave(type, value);
}

async function loadUserLibraries() {
    return libraryManager.loadUserLibraries();
}

function buildInfluencePrompt() {
    return libraryManager.buildInfluencePrompt();
}

function showUniversalLibrarySaveModal(type, value, config, isNewEntry = false) {
    return libraryManager.showUniversalLibrarySaveModal(type, value, config, isNewEntry);
}

function hideUniversalLibrarySaveModal() {
    return libraryManager.hideUniversalLibrarySaveModal();
}

async function saveToLibraryAndContinue(type, isNewEntry = false) {
    return libraryManager.saveToLibraryAndContinue(type, isNewEntry);
}

console.log('✅ Library Manager component loaded successfully'); 