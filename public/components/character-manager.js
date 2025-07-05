/**
 * Character Manager Component
 * 
 * Handles all character-related functionality including:
 * - Character CRUD operations (Add, Edit, Delete)
 * - Character display and tag management
 * - Character library integration
 * - Modal management for character forms
 * - Character validation and prompt formatting
 */

class CharacterManager {
    constructor() {
        this.editingCharacterIndex = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFormHandlers();
        this.setupModalHandlers();
        
        // Initialize character display on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateCharacterTags();
                this.validateCharactersRequired();
            });
        } else {
            this.updateCharacterTags();
            this.validateCharactersRequired();
        }
    }

    setupEventListeners() {
        // No specific event listeners needed - functions are called directly
    }

    setupFormHandlers() {
        // Character form submission handler
        document.addEventListener('DOMContentLoaded', () => {
            const characterForm = document.getElementById('characterForm');
            if (characterForm) {
                characterForm.onsubmit = async (e) => {
                    e.preventDefault();
                    
                    const formData = new FormData(e.target);
                    const name = formData.get('characterName').trim();
                    const description = formData.get('characterDescription').trim();
                    
                    if (!name || !description) {
                        showToast('Please fill in all fields', 'error');
                        return;
                    }
                    
                    const character = { name, description };
                    
                    if (this.editingCharacterIndex !== null) {
                        // Editing existing character
                        appState.projectCharacters[this.editingCharacterIndex] = character;
                        console.log(`🔍 CHARACTER DEBUG: Updated character at index ${this.editingCharacterIndex}:`, character);
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
                    
                    // Save immediately to prevent data loss on navigation
                    appState.pendingChanges = true;
                    if (autoSaveManager) {
                        try {
                            await autoSaveManager.saveImmediately();
                            appState.pendingChanges = false; // Clear pending changes flag
                            console.log('  - Character changes saved immediately');
                        } catch (error) {
                            console.error('  - Failed to save character changes:', error);
                            autoSaveManager.markDirty(); // Fallback to delayed save
                        }
                    }
                    
                    this.updateCharacterTags();
                    this.hideCharacterModal();
                    this.validateCharactersRequired();
                    e.target.reset();
                };
            }
        });
    }

    setupModalHandlers() {
        // Modal click outside to close (for character modals)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'addCharacterModal') {
                this.hideCharacterModal();
            }
            if (e.target.id === 'characterLibraryModal') {
                this.hideCharacterLibraryModal();
            }
        });
    }

    // ===== CRUD OPERATIONS =====

    addCharacter() {
        console.log('AddCharacter: Function called');
        this.editingCharacterIndex = null;
        
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
        this.showCharacterModal();
    }

    editCharacter(index) {
        this.editingCharacterIndex = index;
        const character = appState.projectCharacters[index];
        document.getElementById('characterModalTitle').textContent = 'Edit Character';
        document.getElementById('characterName').value = character.name;
        document.getElementById('characterDescription').value = character.description;
        this.showCharacterModal();
    }

    deleteCharacter(index) {
        if (confirm('Are you sure you want to delete this character?')) {
            appState.projectCharacters.splice(index, 1);
            this.updateCharacterTags();
            this.validateCharactersRequired();
        }
    }

    async removeCharacter(index) {
        if (index >= 0 && index < appState.projectCharacters.length) {
            appState.projectCharacters.splice(index, 1);
            this.updateCharacterTags();
            this.validateCharactersRequired();
            saveToLocalStorage();
            
            // Save immediately to prevent data loss on navigation
            appState.pendingChanges = true;
            if (autoSaveManager) {
                try {
                    await autoSaveManager.saveImmediately();
                    appState.pendingChanges = false; // Clear pending changes flag
                    console.log('Character removed and saved immediately');
                } catch (error) {
                    console.error('Failed to save after character removal:', error);
                    autoSaveManager.markDirty(); // Fallback to delayed save
                }
            }
        }
    }

    // ===== DISPLAY FUNCTIONS =====

    displayCharacters() {
        const container = document.getElementById('charactersList');
        const emptyState = document.getElementById('charactersEmpty');
        
        // Check if elements exist (they might not if we're not on the character management step)
        if (!container || !emptyState) {
            console.log('📋 displayCharacters: DOM elements not found, skipping display update');
            return;
        }
        
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
                    <button class="character-edit-btn" onclick="characterManager.editCharacter(${index})">Edit</button>
                    <button class="character-delete-btn" onclick="characterManager.deleteCharacter(${index})">Delete</button>
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

    updateCharacterTags() {
        const container = document.getElementById('characterTags');
        if (!container) return; // Handle case where element doesn't exist
        
        container.innerHTML = '';
        
        appState.projectCharacters.forEach((character, index) => {
            const tag = document.createElement('div');
            tag.className = 'influence-tag clickable-tag';
            tag.innerHTML = `
                <span onclick="characterManager.editCharacterEntry(${index});" style="cursor: pointer; flex: 1;">${character.name}</span>
                <button type="button" class="remove-tag" onclick="removeCharacter(${index})" title="Remove character">×</button>
            `;
            container.appendChild(tag);
        });
        
        // Update autogenerate button visibility when characters change
        if (typeof updateAutoGenerateButtonVisibility === 'function') {
            updateAutoGenerateButtonVisibility();
        }
    }

    // ===== MODAL MANAGEMENT =====

    showCharacterModal() {
        console.log('ShowCharacterModal: Function called');
        const modal = document.getElementById('addCharacterModal');
        console.log('ShowCharacterModal: Modal element found:', !!modal);
        
        if (modal) {
            modal.classList.add('show');
            console.log('ShowCharacterModal: Added show class, modal classes:', modal.className);
            
            // Focus on the first input field
            setTimeout(() => {
                const nameInput = document.getElementById('characterName');
                if (nameInput) {
                    nameInput.focus();
                    nameInput.select(); // Select any existing text
                }
            }, 100);
        } else {
            console.error('ShowCharacterModal: Modal element not found!');
        }
    }

    hideCharacterModal() {
        document.getElementById('addCharacterModal').classList.remove('show');
    }

    showCharacterLibraryModal() {
        document.getElementById('characterLibraryModal').classList.add('show');
    }

    hideCharacterLibraryModal() {
        document.getElementById('characterLibraryModal').classList.remove('show');
    }

    // ===== LIBRARY INTEGRATION =====

    async addCharacterFromLibrary() {
        try {
            // Load user's character library
            const response = await fetch('/api/user-libraries/guest/characters');
            const characterLibrary = await response.json();
            
            this.displayCharacterLibrary(characterLibrary);
            this.showCharacterLibraryModal();
        } catch (error) {
            console.error('Failed to load character library:', error);
            showToast('Failed to load character library', 'error');
        }
    }

    displayCharacterLibrary(characters) {
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

    async selectCharacterFromLibrary(key, name, description) {
        // Add to project characters
        appState.projectCharacters.push({
            name: name,
            description: description,
            fromLibrary: true,
            libraryKey: key
        });
        
        this.updateCharacterTags();
        this.hideCharacterLibraryModal();
        this.validateCharactersRequired();
        
        // Save immediately to prevent data loss on navigation
        appState.pendingChanges = true;
        if (autoSaveManager) {
            try {
                await autoSaveManager.saveImmediately();
                appState.pendingChanges = false; // Clear pending changes flag
                console.log('Library character added and saved immediately');
            } catch (error) {
                console.error('Failed to save after adding library character:', error);
                autoSaveManager.markDirty(); // Fallback to delayed save
            }
        }
        
        showToast(`Added "${name}" to your project`);
    }

    async editCharacterEntry(characterIndex) {
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
        
        // Find the entry data - try multiple strategies to handle name changes
        let entryData = null;
        
        // Strategy 1: Exact name match (handles most cases)
        console.log(`🔍 CHARACTER STRATEGY 1: Looking for exact name match for "${character.name}" in ${characterEntries.length} entries`);
        
        entryData = characterEntries.find(entry => {
            const entryName = typeof entry === 'string' ? entry : 
                             (entry.entry_data && entry.entry_data.name ? entry.entry_data.name : 
                             (entry.name ? entry.name : 'unknown'));
            
            console.log(`🔍 Checking character entry: "${entryName}" against "${character.name}"`);
            
            if (typeof entry === 'string') {
                const match = entry === character.name;
                if (match) console.log(`✅ Character string match found: "${entry}"`);
                return match;
            } else if (entry.entry_data && entry.entry_data.name) {
                const match = entry.entry_data.name === character.name;
                if (match) console.log(`✅ Character entry data name match found: "${entry.entry_data.name}"`);
                return match;
            } else if (entry.name) {
                const match = entry.name === character.name;
                if (match) console.log(`✅ Character entry name match found: "${entry.name}"`);
                return match;
            }
            return false;
        });
        
        if (entryData) {
            console.log(`✅ CHARACTER STRATEGY 1 SUCCESS: Found exact match`, {
                type: typeof entryData,
                name: typeof entryData === 'string' ? entryData : (entryData.entry_data?.name || entryData.name),
                key: entryData.entry_key || entryData.key || 'no-key'
            });
        } else {
            console.log(`❌ CHARACTER STRATEGY 1 FAILED: No exact name match found for "${character.name}"`);
        }
        
        // Strategy 2: If not found, try to find by generated key match  
        if (!entryData) {
            const searchKey = character.name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '');
                
            console.log(`🔍 CHARACTER FALLBACK SEARCH: Looking for key "${searchKey}" in ${characterEntries.length} entries`);
            console.log(`📋 Available character entries:`, characterEntries.map(e => ({
                name: e.entry_data?.name || e.name || (typeof e === 'string' ? e : 'unknown'),
                key: e.entry_key || e.key || 'no-key'
            })));
            
            entryData = characterEntries.find(entry => {
                const entryKey = entry.entry_key || entry.key || '';
                const entryName = entry.entry_data?.name || entry.name || (typeof entry === 'string' ? entry : '');
                
                console.log(`🔍 Checking character entry: name="${entryName}", key="${entryKey}" against search="${searchKey}"`);
                
                // Direct key match
                if (entry.entry_key === searchKey || entry.key === searchKey) {
                    console.log(`✅ Direct character key match found!`);
                    return true;
                }
                
                // Check if search key starts with entry key
                if (entryKey && searchKey.startsWith(entryKey + '-')) {
                    console.log(`✅ Character search key starts with entry key: "${searchKey}" starts with "${entryKey}"`);
                    return true;
                }
                
                // Check if entry key starts with search key
                if (entryKey && entryKey.startsWith(searchKey + '-')) {
                    console.log(`✅ Character entry key starts with search key: "${entryKey}" starts with "${searchKey}"`);
                    return true;
                }
                
                // Try removing edit suffixes and comparing base names
                const baseSearchKey = searchKey.replace(/-edit\d*$/g, '');
                const baseEntryKey = entryKey.replace(/-edit\d*$/g, '');  
                if (baseSearchKey && baseEntryKey && baseSearchKey === baseEntryKey) {
                    console.log(`✅ Character base key match: "${baseSearchKey}" matches "${baseEntryKey}"`);
                    return true;
                }
                
                return false;
            });
            
            if (entryData) {
                console.log(`✅ Found character by fallback search:`, {
                    name: entryData.entry_data?.name || entryData.name || 'string-entry',
                    key: entryData.entry_key || entryData.key || 'no-key'
                });
            } else {
                console.log(`❌ No character entry found for "${searchKey}"`);
            }
        }
        
        if (entryData) {
            // Extract the actual data based on the structure found
            let actualData, actualKey;
            
            if (typeof entryData === 'string') {
                // Simple string entry - we need to derive the original key
                actualData = { name: entryData, description: character.description || '' };
                
                // For string entries, we need to find the original base name and key
                // Strip edit suffixes to get the original base name
                const originalName = entryData.replace(/\s*\(edit\d*\)\s*/g, '');
                actualKey = originalName.toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                    .replace(/\s+/g, '-')         // Replace spaces with hyphens
                    .replace(/-+/g, '-')          // Remove multiple hyphens
                    .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
                    
                console.log(`🔧 CHARACTER STRING ENTRY KEY DERIVATION: "${entryData}" -> original: "${originalName}" -> key: "${actualKey}"`);
            } else if (entryData.entry_data && entryData.entry_data.name) {
                actualData = entryData.entry_data;
                actualKey = entryData.entry_key;
            } else if (entryData.name) {
                actualData = { name: entryData.name, description: entryData.description || '' };
                actualKey = entryData.entry_key || entryData.key;
            } else {
                actualData = { name: character.name, description: character.description || '' };
                // Strip edit suffixes to get original key for fallback case too
                const originalName = character.name.replace(/\s*\(edit\d*\)\s*/g, '');
                actualKey = originalName.toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                    .replace(/\s+/g, '-')         // Replace spaces with hyphens
                    .replace(/-+/g, '-')          // Remove multiple hyphens
                    .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
                    
                console.log(`🔧 CHARACTER FALLBACK KEY DERIVATION: "${character.name}" -> original: "${originalName}" -> key: "${actualKey}"`);
            }
            
            // Store editing state for the universal modal
            window.editingLibraryEntry = {
                type: 'characters',
                key: actualKey,
                data: actualData,
                originalName: actualData.name, // Store original name for reference
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
                originalName: character.name, // Store original name for reference
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

    // ===== VALIDATION & UTILITY =====

    validateCharactersRequired() {
        // Characters are now optional, so always enable the continue button
        // Target only navigation buttons, not our AI feedback button
        const continueBtn = document.querySelector('#step1 .step-actions .btn-primary');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue to Act Selection';
        }
    }

    getCharactersForPrompt() {
        return appState.projectCharacters.map(char => {
            // Skip descriptions that are just "Main character: [name]" - show name only
            if (char.description && !char.description.startsWith('Main character:')) {
                return `${char.name} (${char.description})`;
            }
            return char.name;
        }).join(', ');
    }
}

// Create global instance
const characterManager = new CharacterManager();

// ===== LEGACY COMPATIBILITY FUNCTIONS =====
// These functions maintain backward compatibility for existing onclick handlers

function addCharacter() {
    characterManager.addCharacter();
}

function editCharacter(index) {
    characterManager.editCharacter(index);
}

function deleteCharacter(index) {
    characterManager.deleteCharacter(index);
}

async function removeCharacter(index) {
    await characterManager.removeCharacter(index);
}

function displayCharacters() {
    characterManager.displayCharacters();
}

function updateCharacterTags() {
    characterManager.updateCharacterTags();
}

function showCharacterModal() {
    characterManager.showCharacterModal();
}

function hideCharacterModal() {
    characterManager.hideCharacterModal();
}

function showCharacterLibraryModal() {
    characterManager.showCharacterLibraryModal();
}

function hideCharacterLibraryModal() {
    characterManager.hideCharacterLibraryModal();
}

function addCharacterFromLibrary() {
    characterManager.addCharacterFromLibrary();
}

function displayCharacterLibrary(characters) {
    characterManager.displayCharacterLibrary(characters);
}

async function selectCharacterFromLibrary(key, name, description) {
    await characterManager.selectCharacterFromLibrary(key, name, description);
}

function editCharacterEntry(characterIndex) {
    characterManager.editCharacterEntry(characterIndex);
}

function validateCharactersRequired() {
    characterManager.validateCharactersRequired();
}

function getCharactersForPrompt() {
    return characterManager.getCharactersForPrompt();
}

// Make global for debugging
window.characterManager = characterManager; 