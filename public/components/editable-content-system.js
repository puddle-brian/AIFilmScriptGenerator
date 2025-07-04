/**
 * Editable Content System
 * Extracted from script.js - handles inline editing for different content types
 */

class EditableContentSystem {
    constructor() {
        this.blocks = new Map();
        this.blockCounter = 0;
        
        // Initialize global reference for backward compatibility
        if (!window.editableBlocks) {
            window.editableBlocks = {};
        }
    }

    /**
     * Create an editable content block
     */
    createBlock(options) {
        const block = new EditableContentBlock(options);
        this.blocks.set(block.id, block);
        return block;
    }

    /**
     * Get a block by ID
     */
    getBlock(id) {
        return this.blocks.get(id);
    }

    /**
     * Remove a block
     */
    removeBlock(id) {
        const block = this.blocks.get(id);
        if (block) {
            block.destroy();
            this.blocks.delete(id);
        }
    }

    /**
     * Remove all blocks
     */
    clearAll() {
        this.blocks.forEach(block => block.destroy());
        this.blocks.clear();
    }
}

/**
 * Editable Content Block - Individual block implementation
 */
class EditableContentBlock {
    constructor(options) {
        this.id = options.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.type = options.type; // 'acts', 'plot-points', 'scenes', 'dialogue'
        this.title = options.title;
        this.content = options.content;
        this.originalContent = options.content;
        this.container = options.container;
        this.onSave = options.onSave; // Callback function for saving
        this.onCancel = options.onCancel; // Optional callback for canceling
        this.metadata = options.metadata || {}; // Additional data like structureKey, index, etc.
        this.hideTitle = options.hideTitle || false; // Option to hide the title header
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
            ${!this.hideTitle ? `
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
            ` : `
                <div class="editable-content-header-minimal">
                    <div class="editable-content-actions">
                        <button class="edit-btn" onclick="editableBlocks['${this.id}'].startEdit()">
                            ✏️ Edit
                        </button>
                    </div>
                </div>
            `}
            <div class="editable-content-body${this.hideTitle ? ' compact' : ''}">
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
                ${!this.hideTitle ? `
                    <div class="editable-content-meta">
                        Last modified: ${new Date().toLocaleString()}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.container.appendChild(this.element);
        
        // Store reference for global access (backward compatibility)
        window.editableBlocks[this.id] = this;
    }
    
    formatContentForDisplay(content) {
        // Format content based on type
        switch (this.type) {
            case 'acts':
                return this.formatActsContent(content);
            case 'plot-points':
                // Extract act number from metadata if available
                const actNumber = this.metadata && this.metadata.actNumber ? this.metadata.actNumber : null;
                return this.formatPlotPointsContent(content, actNumber);
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
    
    formatPlotPointsContent(content, actNumber = null) {
        // If content is an array or JSON array string
        if (Array.isArray(content)) {
            return `
                <ol class="hierarchical-plot-points" ${actNumber ? `data-act-number="${actNumber}"` : ''}>
                    ${content.map((point, index) => {
                        const plotPointNumber = actNumber ? `${actNumber}.${index + 1}` : index + 1;
                        return `<li data-plot-number="${plotPointNumber}"><span class="plot-point-number">${plotPointNumber}</span> ${point}</li>`;
                    }).join('')}
                </ol>
            `;
        } else if (typeof content === 'string' && content.startsWith('[')) {
            try {
                const parsed = JSON.parse(content);
                return `
                    <ol class="hierarchical-plot-points" ${actNumber ? `data-act-number="${actNumber}"` : ''}>
                        ${parsed.map((point, index) => {
                            const plotPointNumber = actNumber ? `${actNumber}.${index + 1}` : index + 1;
                            return `<li data-plot-number="${plotPointNumber}"><span class="plot-point-number">${plotPointNumber}</span> ${point}</li>`;
                        }).join('')}
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

                const containerClass = this.hideTitle ? ' class="scene-content-compact"' : '';
                let html = `<div${containerClass}>`;
                if (!this.hideTitle) {
                    html += `<h3>${parsed.title || parsed.name || 'Untitled Scene'}</h3>`;
                }
                // Combine location and time on one line to save vertical space
                html += `<p><strong>${parsed.location || 'Not specified'}</strong> • <strong>${parsed.time_of_day || parsed.time || 'Not specified'}</strong></p>`;
                html += `<p><strong>Description:</strong> ${parsed.description || 'No description'}</p>`;
                html += `</div>`;
                return html;
            } catch (e) {
                return `<p>${content}</p>`;
            }
        }
        return `<p>${content}</p>`;
    }
    
    formatDialogueContent(content) {
        // Format dialogue content with proper screenplay formatting
        return `<pre class="screenplay-content dialogue-content">${content}</pre>`;
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

// Initialize the global system
const editableContentSystem = new EditableContentSystem();

// Global helper function for backward compatibility
function createEditableContentBlock(options) {
    return editableContentSystem.createBlock(options);
}

// Make available globally
window.EditableContentSystem = EditableContentSystem;
window.EditableContentBlock = EditableContentBlock;
window.editableContentSystem = editableContentSystem;
window.createEditableContentBlock = createEditableContentBlock; 