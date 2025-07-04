/**
 * 📚 Film Script Generator - Library Management Module
 * 
 * This module centralizes all library management functionality,
 * providing a clean interface for CRUD operations on user libraries,
 * modal management, and UI updates.
 */

class LibraryManager {
  constructor() {
    this.currentEditEntry = null;
    this.modalElement = null;
    
    // Library type configuration
    this.LIBRARY_TYPES = {
      director: {
        singular: 'director',
        plural: 'directors',
        displayName: 'Director',
        promptTemplate: 'With direction reminiscent of',
        placeholder: 'e.g., "Christopher Nolan", "classic film noir directors", "a cross between Kubrick and Wes Anderson"'
      },
      screenwriter: {
        singular: 'screenwriter', 
        plural: 'screenwriters',
        displayName: 'Screenwriter',
        promptTemplate: 'with prose style that invokes',
        placeholder: 'e.g., "Charlie Kaufman", "witty British comedy writers", "Shakespeare meets Tarantino"'
      },
      film: {
        singular: 'film',
        plural: 'films', 
        displayName: 'Film',
        promptTemplate: 'channeling the essence of',
        placeholder: 'e.g., "Inception", "moody 1970s thrillers", "a blend of Casablanca and Blade Runner"'
      },
      character: {
        singular: 'character',
        plural: 'characters',
        displayName: 'Character',
        promptTemplate: 'featuring character',
        placeholder: 'Describe this character\'s role, personality, and background...',
        hasDescription: true
      },
      tone: {
        singular: 'tone',
        plural: 'tones',
        displayName: 'Tone',
        promptTemplate: 'with tone and atmosphere',
        placeholder: 'e.g., "dark comedy", "melancholic and introspective", "fast-paced thriller"'
      },
      storyconcept: {
        singular: 'story concept',
        plural: 'storyconcepts',
        displayName: 'Story Concept',
        promptTemplate: 'based on story concept',
        placeholder: 'Write or paste your story idea here - be as brief or detailed as you like...',
        hasDescription: true
      }
    };
    
    console.log('📚 LibraryManager initialized');
  }
  
  /**
   * Get library type configuration
   */
  getLibraryConfig(type) {
    return this.LIBRARY_TYPES[type];
  }
  
  /**
   * Check if user is authenticated for library operations
   */
  isAuthenticated() {
    return window.appState?.isAuthenticated && window.appState?.apiKey;
  }
  
  /**
   * Get current user data
   */
  getCurrentUser() {
    return window.appState?.user;
  }
  
  /**
   * Initialize API client for library operations
   */
  ensureApiClient() {
    if (window.apiClient && this.isAuthenticated()) {
      window.apiClient.setApiKey(window.appState.apiKey);
      return window.apiClient;
    }
    return null;
  }
  
  // ===========================================
  // LIBRARY DATA OPERATIONS
  // ===========================================
  
  /**
   * Load user library entries for a specific type
   */
  async loadLibrary(type) {
    const config = this.getLibraryConfig(type);
    if (!config) {
      throw new Error(`Unknown library type: ${type}`);
    }
    
    const apiClient = this.ensureApiClient();
    if (!apiClient) {
      throw new Error('User not authenticated or API client not available');
    }
    
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No user data available');
    }
    
    try {
      const library = await apiClient.getUserLibrary(user.username, config.plural);
      console.log(`📖 Loaded ${library.length} ${type} entries for user: ${user.username}`);
      return library;
    } catch (error) {
      console.error(`❌ Failed to load ${type} library:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a value already exists in user's library
   */
  async checkExistsInLibrary(type, value) {
    if (!this.isAuthenticated()) {
      return false;
    }
    
    try {
      const library = await this.loadLibrary(type);
      return library.some(item => 
        item.entry_data.name === value || 
        item.entry_key === value
      );
    } catch (error) {
      console.warn('Could not check library existence:', error);
      return false;
    }
  }
  
  /**
   * Save a new entry to user's library
   */
  async saveLibraryEntry(type, data) {
    const config = this.getLibraryConfig(type);
    if (!config) {
      throw new Error(`Unknown library type: ${type}`);
    }
    
    const apiClient = this.ensureApiClient();
    if (!apiClient) {
      throw new Error('User not authenticated or API client not available');
    }
    
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No user data available');
    }
    
    // Generate safe entry key
    let entryKey = data.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Remove multiple hyphens
      .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
      
    // Truncate to fit database constraint
    if (entryKey.length > 47) {
      entryKey = entryKey.substring(0, 47) + '...';
    }
    
    try {
      await apiClient.createLibraryEntry(user.username, config.plural, entryKey, data);
      console.log(`✅ Saved "${data.name}" to ${type} library`);
      return entryKey;
    } catch (error) {
      console.error(`❌ Failed to save ${type} entry:`, error);
      throw error;
    }
  }
  
  /**
   * Update an existing library entry
   */
  async updateLibraryEntry(type, entryKey, data) {
    const config = this.getLibraryConfig(type);
    if (!config) {
      throw new Error(`Unknown library type: ${type}`);
    }
    
    const apiClient = this.ensureApiClient();
    if (!apiClient) {
      throw new Error('User not authenticated or API client not available');
    }
    
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No user data available');
    }
    
    try {
      await apiClient.updateLibraryEntry(user.username, config.plural, entryKey, data);
      console.log(`✅ Updated "${data.name}" in ${type} library`);
    } catch (error) {
      console.error(`❌ Failed to update ${type} entry:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a library entry
   */
  async deleteLibraryEntry(type, entryKey) {
    const config = this.getLibraryConfig(type);
    if (!config) {
      throw new Error(`Unknown library type: ${type}`);
    }
    
    const apiClient = this.ensureApiClient();
    if (!apiClient) {
      throw new Error('User not authenticated or API client not available');
    }
    
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No user data available');
    }
    
    try {
      await apiClient.deleteLibraryEntry(user.username, config.plural, entryKey);
      console.log(`✅ Deleted entry from ${type} library`);
    } catch (error) {
      console.error(`❌ Failed to delete ${type} entry:`, error);
      throw error;
    }
  }
  
  // ===========================================
  // MODAL MANAGEMENT
  // ===========================================
  
  /**
   * Show modal for saving/editing library entries
   */
  showLibraryModal(type, value = '', options = {}) {
    const {
      isNew = false,
      isEdit = false,
      editKey = null,
      editData = null
    } = options;
    
    const config = this.getLibraryConfig(type);
    if (!config) {
      console.error(`Unknown library type: ${type}`);
      return;
    }
    
    // Store edit context if editing
    if (isEdit) {
      this.currentEditEntry = {
        type,
        key: editKey,
        data: editData
      };
    } else {
      this.currentEditEntry = null;
    }
    
    // Generate modal title and message
    const modalTitle = this.getModalTitle(type, config, isNew, isEdit);
    const modalMessage = this.getModalMessage(type, config, value, isNew, isEdit);
    const promptHelpText = this.getPromptHelpText(type, config);
    
    const modalHtml = this.generateModalHtml(
      type, config, value, modalTitle, modalMessage, promptHelpText, isNew, isEdit
    );
    
    // Remove existing modal if present
    this.hideLibraryModal();
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modalElement = document.getElementById('libraryModal');
    this.modalElement.classList.add('show');
    
    // Set up modal event handlers
    this.setupModalEventHandlers(type, isNew);
    
    console.log(`📚 Showing ${isNew ? 'new' : isEdit ? 'edit' : 'save'} modal for ${type}`);
  }
  
  /**
   * Hide the library modal
   */
  hideLibraryModal() {
    if (this.modalElement) {
      this.modalElement.classList.remove('show');
      setTimeout(() => {
        if (this.modalElement) {
          this.modalElement.remove();
          this.modalElement = null;
        }
      }, 300);
    }
    this.currentEditEntry = null;
  }
  
  /**
   * Generate modal title based on context
   */
  getModalTitle(type, config, isNew, isEdit) {
    const displayNames = {
      director: 'Directional Style',
      screenwriter: 'Prose Style',
      film: 'Essence',
      tone: 'Tone & Atmosphere'
    };
    
    const displayName = displayNames[type] || config.displayName;
    
    if (isNew) return `Add New ${displayName}`;
    if (isEdit) return `Edit ${displayName}`;
    return `Save ${displayName} to Library`;
  }
  
  /**
   * Generate modal message based on context
   */
  getModalMessage(type, config, value, isNew, isEdit) {
    const typeNames = {
      director: 'directional influence',
      screenwriter: 'prose influence',
      film: 'creative influence',
      tone: 'tone influence'
    };
    
    const typeName = typeNames[type] || config.singular;
    
    if (isNew) {
      return `Create a new ${typeName} for your library:`;
    }
    
    if (isEdit) {
      return `Edit this ${typeName}:`;
    }
    
    const pluralNames = {
      director: 'directional styles',
      screenwriter: 'prose styles',
      film: 'essences',
      tone: 'tones & atmosphere'
    };
    
    const pluralName = pluralNames[type] || config.plural;
    
    return `Would you like to save "<strong>${value}</strong>" to your ${pluralName} library for future projects?`;
  }
  
  /**
   * Generate prompt help text for each type
   */
  getPromptHelpText(type, config) {
    if (config.promptTemplate) {
      return `This will appear in prompts as: "${config.promptTemplate} <em>[what you enter]</em>, ..."`;
    }
    
    switch (type) {
      case 'character':
        return 'Characters use both name and description in prompts for detailed character development.';
      case 'storyconcept':
        return 'This story description will be included in every AI prompt as your story develops, guiding all generated content.';
      default:
        return '';
    }
  }
  
  /**
   * Generate the complete modal HTML
   */
  generateModalHtml(type, config, value, modalTitle, modalMessage, promptHelpText, isNew, isEdit) {
    const isComplexType = config.hasDescription;
    
    return `
      <div class="modal library-modal" id="libraryModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${modalTitle}</h3>
            <button class="modal-close" onclick="window.libraryManager.hideLibraryModal()">&times;</button>
          </div>
          <div class="modal-body">
            <p>${modalMessage}</p>
            <form id="libraryForm">
              ${isComplexType ? this.generateComplexForm(type, config, value, promptHelpText) : 
                                this.generateSimpleForm(type, config, value, promptHelpText)}
            </form>
          </div>
          <div class="modal-footer">
            <div class="modal-footer-left"></div>
            <div class="modal-footer-right">
              <button class="btn btn-secondary" onclick="window.libraryManager.hideLibraryModal()">Cancel</button>
              <button class="btn btn-primary" onclick="window.libraryManager.saveLibraryEntryFromModal('${type}', ${isNew})">
                ${isNew ? 'Add to Library' : isEdit ? 'Update' : 'Save to Library'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Generate form for complex types (character, story concept)
   */
  generateComplexForm(type, config, value, promptHelpText) {
    return `
      <div class="form-group">
        <label for="libraryEntryName">${type === 'character' ? 'Character Name' : 'Story Title'}</label>
        <input type="text" id="libraryEntryName" value="${value}" required>
      </div>
      <div class="form-group">
        <label for="libraryEntryDescription">${type === 'character' ? 'Character Description' : 'Story Description'}</label>
        <textarea id="libraryEntryDescription" rows="3" 
          placeholder="${config.placeholder}"></textarea>
        ${type === 'storyconcept' ? `<small class="form-help">${promptHelpText}</small>` : ''}
      </div>
    `;
  }
  
  /**
   * Generate form for simple types (influences)
   */
  generateSimpleForm(type, config, value, promptHelpText) {
    const labels = {
      director: 'Direction reminiscent of...',
      screenwriter: 'Prose style that invokes...',
      film: 'Channeling the essence of...',
      tone: 'Tone and atmosphere inspired by...'
    };
    
    const label = labels[type] || `${config.displayName} Influence`;
    
    return `
      <div class="form-group">
        <label for="libraryEntryName">${label}</label>
        <input type="text" id="libraryEntryName" value="${value}" required 
          placeholder="${config.placeholder}">
        <small class="form-help">${promptHelpText}</small>
      </div>
    `;
  }
  
  /**
   * Set up modal event handlers
   */
  setupModalEventHandlers(type, isNew) {
    setTimeout(() => {
      const nameInput = document.getElementById('libraryEntryName');
      const descInput = document.getElementById('libraryEntryDescription');
      
      if (nameInput) {
        nameInput.focus();
        
        // Handle Enter key for form submission
        const handleEnterKey = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.saveLibraryEntryFromModal(type, isNew);
          }
        };
        
        nameInput.addEventListener('keypress', handleEnterKey);
        if (descInput) {
          descInput.addEventListener('keypress', handleEnterKey);
        }
      }
      
      // Initialize genie suggestions for this modal
      this.initializeGenieSuggestions(type);
    }, 100);
  }
  
  /**
   * Initialize genie suggestions for the library modal
   */
  initializeGenieSuggestions(suggestionType) {
    console.log('🧞 LibraryManager: Initializing genie suggestions for', suggestionType);
    
    // Check if genie suggestions system is available
    if (typeof window.genieSuggestions === 'undefined') {
      console.warn('🚨 LibraryManager: Genie suggestions system not available');
      return;
    }

    const modalFooterLeft = document.querySelector('#libraryModal .modal-footer-left');
    if (!modalFooterLeft) {
      console.warn('🚨 LibraryManager: Modal footer left container not found');
      return;
    }

    console.log('✅ LibraryManager: Modal footer left container found');

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
    const hasExistingContent = this.checkForExistingContent();
    genieButton.innerHTML = hasExistingContent ? 'Replace' : 'Genie Suggests';
    genieButton.onclick = () => {
      console.log('🧞 LibraryManager: Genie button clicked!');
      if (window.genieSuggestions && window.genieSuggestions.generateSuggestion) {
        window.genieSuggestions.generateSuggestion(suggestionType);
      }
    };

    // Add both to left container
    modalFooterLeft.appendChild(genieIcon);
    modalFooterLeft.appendChild(genieButton);
    
    console.log('✅ LibraryManager: Genie button and icon added to modal');
  }

  /**
   * Check if modal has existing content (for genie suggestions)
   */
  checkForExistingContent() {
    const nameField = document.getElementById('libraryEntryName');
    const descField = document.getElementById('libraryEntryDescription');
    
    const hasName = nameField && nameField.value.trim().length > 0;
    const hasDesc = descField && descField.value.trim().length > 0;
    
    return hasName || hasDesc;
  }
  
  /**
   * Save library entry from modal form
   */
  async saveLibraryEntryFromModal(type, isNew) {
    const nameInput = document.getElementById('libraryEntryName');
    const descInput = document.getElementById('libraryEntryDescription');
    
    if (!nameInput) {
      console.error('Name input not found');
      return;
    }
    
    const name = nameInput.value.trim();
    const description = descInput ? descInput.value.trim() : '';
    
    if (!name) {
      if (window.showToast) {
        window.showToast('Please provide a name', 'error');
      }
      return;
    }
    
    const config = this.getLibraryConfig(type);
    const entryData = config.hasDescription ? 
      { name, description: description || `${config.displayName}: ${name}` } :
      { name, description: `${config.displayName} influence: ${name}` };
    
    try {
      if (this.currentEditEntry) {
        // Update existing entry
        await this.updateLibraryEntry(type, this.currentEditEntry.key, entryData);
        if (window.showToast) {
          window.showToast(`"${name}" updated in your ${config.plural} library!`, 'success');
        }
      } else {
        // Create new entry
        await this.saveLibraryEntry(type, entryData);
        if (window.showToast) {
          window.showToast(`"${name}" saved to your ${config.plural} library!`, 'success');
        }
      }
      
      this.hideLibraryModal();
      
      // Trigger refresh of UI if needed
      this.notifyLibraryChange(type, entryData);
      
    } catch (error) {
      console.error('Failed to save library entry:', error);
      if (window.showToast) {
        window.showToast('Failed to save to library. Please try again.', 'error');
      }
    }
  }
  
  // ===========================================
  // UI INTEGRATION METHODS
  // ===========================================
  
  /**
   * Check and offer to save value to library
   */
  async checkAndOfferSave(type, value) {
    if (!this.isAuthenticated()) {
      console.log('User not authenticated, skipping library save offer');
      return;
    }
    
    const exists = await this.checkExistsInLibrary(type, value);
    if (!exists) {
      this.showLibraryModal(type, value);
    }
  }
  
  /**
   * Show modal for creating new library entry
   */
  showNewEntryModal(type) {
    this.showLibraryModal(type, '', { isNew: true });
  }
  
  /**
   * Show modal for editing existing library entry
   */
  showEditModal(type, entryKey, entryData) {
    this.showLibraryModal(type, entryData.name, {
      isEdit: true,
      editKey: entryKey,
      editData: entryData
    });
  }
  
  /**
   * Notify other parts of the app about library changes
   */
  notifyLibraryChange(type, entryData) {
    // Dispatch custom event for other components to listen to
    const event = new CustomEvent('libraryChange', {
      detail: { type, entryData }
    });
    window.dispatchEvent(event);
    
    console.log(`📚 Library change notification sent for ${type}:`, entryData.name);
  }
  
  /**
   * Get all library types configuration
   */
  getAllLibraryTypes() {
    return this.LIBRARY_TYPES;
  }
}

// Create and export singleton instance
const libraryManager = new LibraryManager();

// Export for use in other modules
window.libraryManager = libraryManager;

console.log('📚 LibraryManager module loaded successfully'); 