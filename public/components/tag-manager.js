/**
 * Tag Manager Component
 * Extracted from script.js - handles tag display, editing, and management
 */

class TagManager {
    constructor() {
        this.tagContainers = new Map();
        this.tagCallbacks = new Map();
    }

    /**
     * Initialize a tag container
     */
    initContainer(containerId, options = {}) {
        const {
            type = 'default',
            editable = true,
            onAdd = null,
            onEdit = null,
            onRemove = null,
            onCreate = null,
            maxTags = null,
            placeholder = 'Add new tag...'
        } = options;

        this.tagContainers.set(containerId, {
            type,
            editable,
            maxTags,
            placeholder,
            tags: []
        });

        this.tagCallbacks.set(containerId, {
            onAdd,
            onEdit,
            onRemove,
            onCreate
        });

        this._setupContainer(containerId);
    }

    /**
     * Update tags in a container
     */
    updateTags(containerId, tags) {
        const container = this.tagContainers.get(containerId);
        if (!container) return;

        container.tags = Array.isArray(tags) ? tags : [];
        this._renderTags(containerId);
    }

    /**
     * Add a tag to a container
     */
    addTag(containerId, tag) {
        const container = this.tagContainers.get(containerId);
        const callbacks = this.tagCallbacks.get(containerId);
        
        if (!container) return false;

        // Check max tags limit
        if (container.maxTags && container.tags.length >= container.maxTags) {
            this._showError(containerId, `Maximum ${container.maxTags} tags allowed`);
            return false;
        }

        // Check for duplicates
        const normalizedTag = typeof tag === 'string' ? tag.trim() : tag.name || tag.title;
        const exists = container.tags.some(existingTag => {
            const existing = typeof existingTag === 'string' ? existingTag : existingTag.name || existingTag.title;
            return existing.toLowerCase() === normalizedTag.toLowerCase();
        });

        if (exists) {
            this._showError(containerId, 'Tag already exists');
            return false;
        }

        // Add tag
        container.tags.push(tag);
        this._renderTags(containerId);

        // Trigger callback
        if (callbacks.onAdd) {
            callbacks.onAdd(tag, container.tags);
        }

        return true;
    }

    /**
     * Remove a tag from a container
     */
    removeTag(containerId, index) {
        const container = this.tagContainers.get(containerId);
        const callbacks = this.tagCallbacks.get(containerId);
        
        if (!container || index < 0 || index >= container.tags.length) return false;

        const removedTag = container.tags.splice(index, 1)[0];
        this._renderTags(containerId);

        // Trigger callback
        if (callbacks.onRemove) {
            callbacks.onRemove(removedTag, index, container.tags);
        }

        return true;
    }

    /**
     * Edit a tag in a container
     */
    editTag(containerId, index, newTag) {
        const container = this.tagContainers.get(containerId);
        const callbacks = this.tagCallbacks.get(containerId);
        
        if (!container || index < 0 || index >= container.tags.length) return false;

        const oldTag = container.tags[index];
        container.tags[index] = newTag;
        this._renderTags(containerId);

        // Trigger callback
        if (callbacks.onEdit) {
            callbacks.onEdit(newTag, oldTag, index, container.tags);
        }

        return true;
    }

    /**
     * Get tags from a container
     */
    getTags(containerId) {
        const container = this.tagContainers.get(containerId);
        return container ? [...container.tags] : [];
    }

    /**
     * Clear all tags from a container
     */
    clearTags(containerId) {
        const container = this.tagContainers.get(containerId);
        if (!container) return;

        container.tags = [];
        this._renderTags(containerId);
    }

    /**
     * Create influence tags (specialized for influences)
     */
    createInfluenceTags(containerId, influences, type) {
        this.initContainer(containerId, {
            type: 'influence',
            editable: true,
            onEdit: (tag, oldTag, index) => {
                // Call global edit function for backward compatibility
                if (typeof editInfluenceEntry === 'function') {
                    editInfluenceEntry(type, tag);
                }
            },
            onRemove: (tag, index) => {
                // Call global remove function for backward compatibility
                if (typeof removeInfluence === 'function') {
                    removeInfluence(type, tag);
                }
            }
        });

        this.updateTags(containerId, influences);
    }

    /**
     * Create character tags (specialized for characters)
     */
    createCharacterTags(containerId, characters) {
        this.initContainer(containerId, {
            type: 'character',
            editable: true,
            onEdit: (character, oldCharacter, index) => {
                // Call global edit function for backward compatibility
                if (typeof editCharacterEntry === 'function') {
                    editCharacterEntry(index);
                }
            },
            onRemove: (character, index) => {
                // Call global remove function for backward compatibility
                if (typeof removeCharacter === 'function') {
                    removeCharacter(index);
                }
            }
        });

        this.updateTags(containerId, characters);
    }

    // Private helper methods
    _setupContainer(containerId) {
        const element = document.getElementById(containerId);
        if (!element) return;

        element.classList.add('tag-container');
        
        // Add input for new tags if editable
        const container = this.tagContainers.get(containerId);
        if (container.editable) {
            this._addTagInput(containerId);
        }
    }

    _renderTags(containerId) {
        const element = document.getElementById(containerId);
        const container = this.tagContainers.get(containerId);
        
        if (!element || !container) return;

        // Clear existing tags
        const existingTags = element.querySelectorAll('.tag-item');
        existingTags.forEach(tag => tag.remove());

        // Render tags
        container.tags.forEach((tag, index) => {
            const tagElement = this._createTagElement(containerId, tag, index);
            element.appendChild(tagElement);
        });

        // Re-add input if editable
        if (container.editable) {
            this._addTagInput(containerId);
        }
    }

    _createTagElement(containerId, tag, index) {
        const container = this.tagContainers.get(containerId);
        const tagDiv = document.createElement('div');
        tagDiv.className = 'tag-item influence-tag clickable-tag';

        // Handle different tag types
        let displayText = '';
        let tagValue = tag;

        if (typeof tag === 'string') {
            displayText = tag;
        } else if (tag.name) {
            displayText = tag.name;
            tagValue = tag.name;
        } else if (tag.title) {
            displayText = tag.title;
            tagValue = tag.title;
        }

        tagDiv.innerHTML = `
            <span class="tag-content" onclick="tagManager._handleTagClick('${containerId}', ${index})" style="cursor: pointer; flex: 1;">
                ${displayText}
            </span>
            ${container.editable ? `
                <button type="button" class="remove-tag" onclick="tagManager.removeTag('${containerId}', ${index})" title="Remove tag">×</button>
            ` : ''}
        `;

        return tagDiv;
    }

    _addTagInput(containerId) {
        const element = document.getElementById(containerId);
        const container = this.tagContainers.get(containerId);
        
        if (!element || !container) return;

        // Check if input already exists
        if (element.querySelector('.tag-input')) return;

        const inputDiv = document.createElement('div');
        inputDiv.className = 'tag-input';
        inputDiv.innerHTML = `
            <input type="text" 
                   placeholder="${container.placeholder}" 
                   onkeypress="tagManager._handleInputKeypress(event, '${containerId}')"
                   onblur="tagManager._handleInputBlur(event, '${containerId}')">
            <button type="button" onclick="tagManager._addFromInput('${containerId}')" title="Add tag">+</button>
        `;

        element.appendChild(inputDiv);
    }

    _handleTagClick(containerId, index) {
        const callbacks = this.tagCallbacks.get(containerId);
        if (callbacks.onEdit) {
            const container = this.tagContainers.get(containerId);
            const tag = container.tags[index];
            callbacks.onEdit(tag, tag, index, container.tags);
        }
    }

    _handleInputKeypress(event, containerId) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this._addFromInput(containerId);
        }
    }

    _handleInputBlur(event, containerId) {
        // Optional: Add tag on blur
        // this._addFromInput(containerId);
    }

    _addFromInput(containerId) {
        const element = document.getElementById(containerId);
        const input = element.querySelector('.tag-input input');
        
        if (!input || !input.value.trim()) return;

        const value = input.value.trim();
        const callbacks = this.tagCallbacks.get(containerId);

        // Call onCreate callback if available, otherwise add directly
        if (callbacks.onCreate) {
            callbacks.onCreate(value);
        } else {
            this.addTag(containerId, value);
        }

        input.value = '';
    }

    _showError(containerId, message) {
        const element = document.getElementById(containerId);
        if (!element) return;

        // Remove existing error
        const existingError = element.querySelector('.tag-error');
        if (existingError) existingError.remove();

        // Show new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'tag-error';
        errorDiv.textContent = message;
        element.appendChild(errorDiv);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 3000);
    }
}

// Export for global use
window.TagManager = TagManager;

// Create global instance
window.tagManager = new TagManager();

// Backward compatibility functions
window.updateInfluenceTags = (type) => {
    const container = document.getElementById(`${type}Tags`);
    if (!container) return;

    // Ensure influences object and specific array exist
    if (!appState.influences) {
        appState.influences = {};
    }
    
    const pluralType = type + 's';
    if (!appState.influences[pluralType]) {
        appState.influences[pluralType] = [];
    }

    window.tagManager.createInfluenceTags(`${type}Tags`, appState.influences[pluralType], type);
    
    // Update autogenerate button visibility when influences change
    if (typeof updateAutoGenerateButtonVisibility === 'function') {
        updateAutoGenerateButtonVisibility();
    }
};

window.updateCharacterTags = () => {
    const container = document.getElementById('characterTags');
    if (!container) return;

    window.tagManager.createCharacterTags('characterTags', appState.projectCharacters || []);
    
    // Update autogenerate button visibility when characters change
    if (typeof updateAutoGenerateButtonVisibility === 'function') {
        updateAutoGenerateButtonVisibility();
    }
}; 