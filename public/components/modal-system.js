/**
 * Universal Modal System
 * Extracted from script.js - handles all modal creation and management
 */

class ModalSystem {
    constructor() {
        this.activeModals = new Map();
        this.modalCounter = 0;
    }

    /**
     * Create a universal modal with consistent styling and behavior
     */
    createModal({
        id = null,
        title = '',
        content = '',
        primaryButton = null,
        secondaryButton = { text: 'Cancel', action: null },
        size = 'medium', // small, medium, large
        closable = true,
        onShow = null,
        onHide = null,
        hasGenieSuggestions = false,
        genieSuggestionType = null
    }) {
        // Generate unique ID if not provided
        const modalId = id || `modal-${++this.modalCounter}`;
        
        // Remove existing modal with same ID
        this.hideModal(modalId);

        const modalHtml = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal-content modal-${size}">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        ${closable ? `<button class="modal-close" data-modal-id="${modalId}">&times;</button>` : ''}
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${this._createModalFooter(modalId, primaryButton, secondaryButton, hasGenieSuggestions)}
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        
        // Store modal reference
        this.activeModals.set(modalId, {
            element: modalElement,
            onHide: onHide,
            primaryButton: primaryButton,
            secondaryButton: secondaryButton,
            hasGenieSuggestions: hasGenieSuggestions,
            genieSuggestionType: genieSuggestionType
        });

        // Set up event listeners
        this._setupModalEventListeners(modalId, closable);

        // Show modal with animation
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });

        // Call onShow callback
        if (onShow) onShow(modalElement);

        return modalId;
    }

    /**
     * Create library save modal (specialized modal for saving to library)
     */
    createLibrarySaveModal({
        type,
        value = '',
        config,
        isNewEntry = false,
        onSave = null
    }) {
        const isEdit = window.editingLibraryEntry && !isNewEntry;
        
        const modalTitle = this._getLibraryModalTitle(type, isNewEntry, isEdit, config);
        const modalMessage = this._getLibraryModalMessage(type, value, isNewEntry, isEdit, config);
        const formContent = this._createLibraryForm(type, value, config);

        return this.createModal({
            id: 'universalLibrarySaveModal',
            title: modalTitle,
            content: `
                <p>${modalMessage}</p>
                ${formContent}
            `,
            primaryButton: {
                text: isNewEntry ? 'Add to Library' : isEdit ? 'Update' : 'Save to Library',
                action: () => {
                    const nameInput = document.getElementById('universalLibraryEntryName');
                    const descInput = document.getElementById('universalLibraryEntryDescription');
                    
                    if (onSave) {
                        onSave({
                            name: nameInput.value.trim(),
                            description: descInput ? descInput.value.trim() : '',
                            type: type,
                            isNewEntry: isNewEntry
                        });
                    }
                    
                    this.hideModal('universalLibrarySaveModal');
                }
            },
            // Add genie suggestions support
            hasGenieSuggestions: true,
            genieSuggestionType: type,
            onShow: (modalElement) => {
                // Focus on the name input and set up Enter key handling
                setTimeout(() => {
                    const nameInput = document.getElementById('universalLibraryEntryName');
                    if (nameInput) nameInput.focus();
                    this._setupFormKeyHandlers('universalLibrarySaveModal');
                    
                    // Initialize genie suggestions for this modal
                    this._initializeGenieSuggestions(modalElement, type);
                }, 100);
            }
        });
    }

    /**
     * Create confirmation modal
     */
    createConfirmationModal({
        title = 'Confirm Action',
        message = 'Are you sure?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        onConfirm = null,
        onCancel = null
    }) {
        return this.createModal({
            title: title,
            content: `<p>${message}</p>`,
            primaryButton: {
                text: confirmText,
                action: () => {
                    if (onConfirm) onConfirm();
                    this.hideModal();
                }
            },
            secondaryButton: {
                text: cancelText,
                action: () => {
                    if (onCancel) onCancel();
                    this.hideModal();
                }
            }
        });
    }

    /**
     * Hide modal by ID
     */
    hideModal(modalId = null) {
        if (modalId) {
            const modalData = this.activeModals.get(modalId);
            if (modalData) {
                this._hideModalElement(modalData.element, modalData.onHide);
                this.activeModals.delete(modalId);
            }
        } else {
            // Hide the most recently opened modal
            const lastModal = Array.from(this.activeModals.values()).pop();
            if (lastModal) {
                const modalId = lastModal.element.id;
                this._hideModalElement(lastModal.element, lastModal.onHide);
                this.activeModals.delete(modalId);
            }
        }
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        this.activeModals.forEach((modalData, modalId) => {
            this._hideModalElement(modalData.element, modalData.onHide);
        });
        this.activeModals.clear();
    }

    // Private helper methods
    _createModalFooter(modalId, primaryButton, secondaryButton, hasGenieSuggestions = false) {
        if (!primaryButton && !secondaryButton) return '';

        let footerContent = '<div class="modal-footer">';
        
        if (hasGenieSuggestions) {
            footerContent += '<div class="modal-footer-left"></div>';
            footerContent += '<div class="modal-footer-right">';
        }
        
        if (secondaryButton) {
            footerContent += `<button class="btn btn-secondary" data-modal-action="secondary" data-modal-id="${modalId}">${secondaryButton.text}</button>`;
        }
        
        if (primaryButton) {
            footerContent += `<button class="btn btn-primary" data-modal-action="primary" data-modal-id="${modalId}">${primaryButton.text}</button>`;
        }
        
        if (hasGenieSuggestions) {
            footerContent += '</div>';
        }
        
        footerContent += '</div>';
        return footerContent;
    }

    _setupModalEventListeners(modalId, closable) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;

        // Click outside to close
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement && closable) {
                this.hideModal(modalId);
            }
        });

        // Close button
        const closeBtn = modalElement.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal(modalId));
        }

        // Action buttons
        modalElement.addEventListener('click', (e) => {
            const modalData = this.activeModals.get(modalId);
            if (!modalData) return;

            if (e.target.dataset.modalAction === 'primary') {
                const primaryButton = modalData.primaryButton;
                if (primaryButton && primaryButton.action) {
                    primaryButton.action();
                }
            } else if (e.target.dataset.modalAction === 'secondary') {
                const secondaryButton = modalData.secondaryButton;
                if (secondaryButton && secondaryButton.action) {
                    secondaryButton.action();
                } else {
                    this.hideModal(modalId);
                }
            }
        });

        // ESC key to close
        if (closable) {
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hideModal(modalId);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }
    }

    _hideModalElement(modalElement, onHide) {
        if (!modalElement) return;

        modalElement.classList.remove('show');
        setTimeout(() => {
            if (modalElement.parentNode) {
                modalElement.remove();
            }
            if (onHide) onHide();
        }, 300);
    }

    _getLibraryModalTitle(type, isNewEntry, isEdit, config) {
        const typeLabels = {
            director: 'Directional Style',
            screenwriter: 'Prose Style',
            film: 'Essence',
            tone: 'Tone & Atmosphere'
        };

        const label = typeLabels[type] || config.displayName;
        
        if (isNewEntry) return `Add New ${label}`;
        if (isEdit) return `Edit ${label}`;
        return `Save ${label} to Library`;
    }

    _getLibraryModalMessage(type, value, isNewEntry, isEdit, config) {
        const typeLabels = {
            director: 'directional influence',
            screenwriter: 'prose influence',
            film: 'creative influence',
            tone: 'tone influence'
        };

        const singularLabel = typeLabels[type] || config.singular;
        const pluralLabel = {
            director: 'directional styles',
            screenwriter: 'prose styles',
            film: 'essences',
            tone: 'tones & atmosphere'
        }[type] || config.plural;

        if (isNewEntry) {
            return `Create a new ${singularLabel} for your library:`;
        } else if (isEdit) {
            return `Edit this ${singularLabel}:`;
        } else {
            return `Would you like to save "<strong>${value}</strong>" to your ${pluralLabel} library for future projects?`;
        }
    }

    _createLibraryForm(type, value, config) {
        const isComplexType = type === 'character' || type === 'storyconcept';
        
        // Create prompt context help text
        const promptHelpTexts = {
            director: 'This will appear in prompts as: "With direction reminiscent of <em>[what you enter]</em>, ..."',
            screenwriter: 'This will appear in prompts as: "with prose style that invokes <em>[what you enter]</em>, ..."',
            film: 'This will appear in prompts as: "channeling the essence of <em>[what you enter]</em>, ..."',
            character: 'Characters use both name and description in prompts for detailed character development.',
            tone: 'This tone will be used throughout your story generation.',
            storyconcept: 'This story description will be included in every AI prompt as your story develops, guiding all generated content.'
        };

        const promptHelpText = promptHelpTexts[type] || '';

        if (isComplexType) {
            return `
                <form id="universalLibrarySaveForm">
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
                </form>
            `;
        } else {
            const labels = {
                director: 'Direction reminiscent of...',
                screenwriter: 'Prose style that invokes...',
                film: 'Channeling the essence of...',
                tone: 'Tone and atmosphere inspired by...'
            };

            return `
                <form id="universalLibrarySaveForm">
                    <div class="form-group">
                        <label for="universalLibraryEntryName">${labels[type] || `${config.displayName} Influence`}</label>
                        <input type="text" id="universalLibraryEntryName" value="${value}" required 
                            placeholder="${config.placeholder}">
                        <small class="form-help">${promptHelpText}</small>
                    </div>
                </form>
            `;
        }
    }

    _setupFormKeyHandlers(modalId) {
        const nameInput = document.getElementById('universalLibraryEntryName');
        const descInput = document.getElementById('universalLibraryEntryDescription');
        
        const handleEnterKey = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const primaryBtn = document.querySelector(`[data-modal-id="${modalId}"][data-modal-action="primary"]`);
                if (primaryBtn) primaryBtn.click();
            }
        };
        
        if (nameInput) nameInput.addEventListener('keypress', handleEnterKey);
        if (descInput) descInput.addEventListener('keypress', handleEnterKey);
    }

    /**
     * Initialize genie suggestions for a modal
     */
    _initializeGenieSuggestions(modalElement, suggestionType) {
        // Check if genie suggestions system is available
        if (typeof window.genieSuggestions === 'undefined') {
            return;
        }

        const modalFooterLeft = modalElement.querySelector('.modal-footer-left');
        if (!modalFooterLeft) {
            return;
        }

        // Create genie button and icon
        const genieIcon = document.createElement('img');
        genieIcon.src = 'askthegenie_black.png';
        genieIcon.className = 'genie-icon-button';
        genieIcon.alt = 'Ask the Genie';

        const genieButton = document.createElement('button');
        genieButton.type = 'button';
        genieButton.className = 'btn btn-genie';
        genieButton.id = 'genieSuggestBtn';
        
        // Check if modal has existing content to determine button text
        const hasExistingContent = this._checkForExistingContent();
        genieButton.innerHTML = hasExistingContent ? 'Replace' : 'Genie Suggests';
        genieButton.onclick = () => {
            if (window.genieSuggestions && window.genieSuggestions.generateSuggestion) {
                window.genieSuggestions.generateSuggestion(suggestionType);
            }
        };

        // Add both to left container
        modalFooterLeft.appendChild(genieIcon);
        modalFooterLeft.appendChild(genieButton);
    }

    /**
     * Check if modal has existing content (for genie suggestions)
     */
    _checkForExistingContent() {
        const nameField = document.getElementById('universalLibraryEntryName');
        const descField = document.getElementById('universalLibraryEntryDescription');
        
        const hasName = nameField && nameField.value.trim().length > 0;
        const hasDesc = descField && descField.value.trim().length > 0;
        
        return hasName || hasDesc;
    }
}

// Export for global use
window.ModalSystem = ModalSystem;

// Create global instance
window.modalSystem = new ModalSystem();

// Backward compatibility functions
window.showUniversalLibrarySaveModal = (type, value, config, isNewEntry = false) => {
    return window.modalSystem.createLibrarySaveModal({
        type, value, config, isNewEntry,
        onSave: (data) => {
            // Call the original save function
            if (typeof saveToLibraryAndContinue === 'function') {
                // Temporarily store form data for backward compatibility
                window.tempModalFormData = data;
                saveToLibraryAndContinue(data.type, data.isNewEntry);
            }
        }
    });
};

window.hideUniversalLibrarySaveModal = () => {
    window.modalSystem.hideModal('universalLibrarySaveModal');
}; 