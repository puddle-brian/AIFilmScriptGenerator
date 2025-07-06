/**
 * Authentication Manager Component
 * Extracted from script.js for modular architecture
 * Handles user authentication, login/logout, and UI state management
 */

// Authentication Manager Class
class AuthManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        this.checkAuthStatus();
        this.updateUI();
        
        // Ensure unified credit system is initialized after auth check
        if (window.appState && window.appState.isAuthenticated && window.appState.apiKey && window.UnifiedCreditSystem) {
            setTimeout(() => {
                console.log('🔄 Initializing unified credit system after auth check');
                window.UnifiedCreditSystem.init(window.appState.apiKey);
            }, 100);
        }
        
        this.initialized = true;
        console.log('✅ AuthManager initialized');
    }
    
    checkAuthStatus() {
        const apiKey = localStorage.getItem('apiKey');
        const userData = localStorage.getItem('userData');
        
        if (apiKey && userData) {
            try {
                const newUser = JSON.parse(userData);
                
                // Check if user has changed
                const userChanged = window.appState && window.appState.user && window.appState.user.username !== newUser.username;
                
                if (window.appState) {
                    window.appState.apiKey = apiKey;
                    window.appState.user = newUser;
                    window.appState.isAuthenticated = true;
                }
                
                // If user changed, reset app state to prevent data mixing
                if (userChanged) {
                    console.log(`User changed from ${window.appState.user.username} to ${newUser.username}, resetting app state`);
                    this.resetAppState();
                }
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                this.clearAuth();
            }
        }
    }
    
    updateUI() {
        const guestActions = document.getElementById('guestActions');
        const userControls = document.getElementById('userControls');
        const userName = document.getElementById('userName');
        const profileUsername = document.getElementById('profileUsername');
        const adminAccess = document.getElementById('adminAccess');
        
        if (window.appState && window.appState.isAuthenticated && window.appState.user) {
            // Show authenticated user UI
            if (guestActions) guestActions.style.display = 'none';
            if (userControls) userControls.style.display = 'flex';
            if (userName) {
                userName.textContent = window.appState.user.username;
            }
            if (profileUsername) {
                profileUsername.textContent = window.appState.user.username;
            }
            
            // Show admin button for admin users
            if (adminAccess) {
                adminAccess.style.display = window.appState.user.is_admin ? 'flex' : 'none';
            }
            
            // Initialize/refresh unified credit system if available
            if (window.unifiedCredits && typeof window.unifiedCredits.fetchBalance === 'function') {
                window.unifiedCredits.fetchBalance();
            } else if (window.UnifiedCreditSystem && window.appState.apiKey) {
                // Re-initialize unified credit system with API key if not already initialized
                console.log('🔄 Re-initializing unified credit system with API key');
                window.UnifiedCreditSystem.init(window.appState.apiKey);
            }
        } else {
            // Show guest UI
            if (guestActions) guestActions.style.display = 'flex';
            if (userControls) userControls.style.display = 'none';
            if (adminAccess) adminAccess.style.display = 'none';
            
            // Show registration prompt for key actions
            this.showRegistrationPrompts();
        }
    }
    
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
    }
    
    showRegistrationModal() {
        const modalHtml = `
            <div class="modal-overlay" id="registrationPromptModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🚀 Ready to Generate Your Script?</h3>
                        <button class="modal-close" onclick="window.authManagerInstance.hideRegistrationModal()">&times;</button>
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
                        <button class="btn btn-secondary" onclick="window.authManagerInstance.hideRegistrationModal()">Maybe Later</button>
                        <a href="register.html" class="btn btn-primary">Create Free Account</a>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    hideRegistrationModal() {
        const modal = document.getElementById('registrationPromptModal');
        if (modal) modal.remove();
    }
    
    clearAuth() {
        // 🔧 PRESERVE USER PREFERENCES before clearing localStorage
        let preservedPreferences = {};
        if (window.appState && window.appState.selectedModel) {
            preservedPreferences.selectedModel = window.appState.selectedModel;
        }
        
        localStorage.removeItem('apiKey');
        localStorage.removeItem('userData');
        localStorage.removeItem('filmScriptGenerator'); // Clear app state when auth changes
        
        // 🔧 SAVE PRESERVED PREFERENCES back to localStorage
        if (preservedPreferences.selectedModel) {
            try {
                localStorage.setItem('filmScriptGenerator', JSON.stringify({
                    selectedModel: preservedPreferences.selectedModel
                }));
                console.log('💾 Preserved model selection during logout:', preservedPreferences.selectedModel);
            } catch (error) {
                console.error('Error saving preserved preferences:', error);
            }
        }
        
        if (window.appState) {
            window.appState.isAuthenticated = false;
            window.appState.user = null;
            window.appState.apiKey = null;
            
            // 🔧 RESTORE USER PREFERENCES after clearing auth
            Object.assign(window.appState, preservedPreferences);
        }
        
        // Reset app state to defaults when user changes
        this.resetAppState();
        this.updateUI();
    }
    
    resetAppState() {
        // Reset all user-specific state when switching users
        if (window.appState) {
            // 🔧 PRESERVE USER PREFERENCES during auth reset
            const preservedPreferences = {
                selectedModel: window.appState.selectedModel // Keep model selection across login/logout
            };
            
            Object.assign(window.appState, {
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
                    films: [],
                    tones: []
                },
                projectCharacters: [],
                currentStoryConcept: null,
                customPrompt: null,
                originalPrompt: null,
                isEditMode: false,
                plotPoints: {},
                globalCreativeDirections: {
                    plotPoints: "",
                    scenes: "",
                    dialogue: ""
                },
                // 🔧 RESTORE USER PREFERENCES after reset
                ...preservedPreferences
            });
        }
        
        // Update UI elements
        if (typeof updateCharacterTags === 'function') updateCharacterTags();
        if (typeof updateInfluenceTags === 'function') {
            updateInfluenceTags('director');
            updateInfluenceTags('screenwriter');
            updateInfluenceTags('film');
            updateInfluenceTags('tone');
        }
        if (typeof updateStoryConceptDisplay === 'function') updateStoryConceptDisplay();
        
        // 🔧 UPDATE MODEL SELECTOR UI after auth reset
        if (typeof setupModelSelector === 'function') {
            setTimeout(() => {
                setupModelSelector();
                if (typeof initializeGlobalModelSelector === 'function') {
                    initializeGlobalModelSelector();
                }
            }, 100);
        }
    }

    // Logout functionality
    logout() {
        this.clearAuth();
        window.location.href = 'login.html';
    }
}

// Profile Dropdown Manager
class ProfileDropdownManager {
    constructor() {
        this.isOpen = false;
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
        this.handleEscapeKey = this.handleEscapeKey.bind(this);
    }

    toggle() {
        const dropdown = document.getElementById('profileDropdown');
        if (!dropdown) return;
        
        const isOpen = dropdown.classList.contains('open');
        
        if (isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        const dropdown = document.getElementById('profileDropdown');
        if (!dropdown) return;
        
        dropdown.classList.add('open');
        this.isOpen = true;
        
        // Close dropdown when clicking outside or pressing escape
        document.addEventListener('click', this.handleOutsideClick);
        document.addEventListener('keydown', this.handleEscapeKey);
    }

    close() {
        const dropdown = document.getElementById('profileDropdown');
        if (!dropdown) return;
        
        dropdown.classList.remove('open');
        this.isOpen = false;
        
        // Remove event listeners
        document.removeEventListener('click', this.handleOutsideClick);
        document.removeEventListener('keydown', this.handleEscapeKey);
    }

    handleOutsideClick(event) {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown && !dropdown.contains(event.target)) {
            this.close();
        }
    }

    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            this.close();
        }
    }
}

// Create global instances
const authManagerInstance = new AuthManager();
const profileDropdownManager = new ProfileDropdownManager();

// Export for global access (backward compatibility)
window.authManagerInstance = authManagerInstance;
window.profileDropdownManager = profileDropdownManager;

// Global functions for backward compatibility
window.logout = function() {
    authManagerInstance.logout();
};

window.toggleProfileDropdown = function() {
    profileDropdownManager.toggle();
};

window.openProfileDropdown = function() {
    profileDropdownManager.open();
};

window.closeProfileDropdown = function() {
    profileDropdownManager.close();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        authManagerInstance.init();
    });
} else {
    authManagerInstance.init();
}

console.log('🔧 AuthManager component loaded'); 