/**
 * UI Manager Component
 * Extracted from script.js for modular architecture
 * Handles loading states, toast notifications, modal management, and navigation
 */

// UI Manager Class
class UIManager {
    constructor() {
        this.initialized = false;
        this.elements = null;
    }

    init() {
        if (this.initialized) return;
        
        // Initialize DOM elements
        this.elements = {
            progressFill: document.getElementById('progressFill'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage')
        };
        
        console.log('🔧 UIManager initialized');
        this.initialized = true;
    }

    // ==================== LOADING FUNCTIONS ====================
    
    showLoading(message = 'Loading...') {
        if (!this.elements) this.init();
        this.elements.loadingText.textContent = message;
        this.elements.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        if (!this.elements) this.init();
        this.elements.loadingOverlay.classList.remove('active');
    }

    // ==================== TOAST NOTIFICATION FUNCTIONS ====================
    
    showToast(message, type = 'success') {
        if (!this.elements) this.init();
        this.elements.toastMessage.textContent = message;
        this.elements.toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }

    hideToast() {
        if (!this.elements) this.init();
        this.elements.toast.classList.remove('show');
    }

    // ==================== MODAL MANAGEMENT FUNCTIONS ====================
    
    showPromptPreviewModal() {
        document.getElementById('promptPreviewModal').classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hidePromptPreviewModal() {
        document.getElementById('promptPreviewModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showScenePromptModal() {
        const modal = document.getElementById('scenePromptModal');
        const prompt = window.appState.currentScenePrompt;
        
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

    hideScenePromptModal() {
        document.getElementById('scenePromptModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showPlotPointPromptModal() {
        const modal = document.getElementById('plotPointPromptModal');
        const prompt = window.appState.currentPlotPointsPrompt || window.appState.currentPlotPrompt;
        
        console.log('showPlotPointPromptModal called');
        console.log('appState.currentPlotPointsPrompt:', window.appState.currentPlotPointsPrompt);
        console.log('appState.currentPlotPrompt:', window.appState.currentPlotPrompt);
        console.log('Using prompt:', prompt);
        
        if (!prompt) {
            this.showToast('No prompt data available.', 'error');
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

    hidePlotPointPromptModal() {
        document.getElementById('plotPointPromptModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showIndividualPlotPointPromptModal() {
        const modal = document.getElementById('individualPlotPointPromptModal');
        const prompt = window.appState.currentIndividualPlotPointPrompt;
        
        if (!prompt) {
            this.showToast('No prompt data available.', 'error');
            return;
        }
        
        // Populate modal content
        document.getElementById('individualPlotPointPromptSystemMessage').textContent = prompt.systemMessage;
        document.getElementById('individualPlotPointPromptUserPrompt').textContent = prompt.userPrompt;
        
        // Update modal title
        const modalTitle = document.querySelector('#individualPlotPointPromptModal .modal-header h3');
        const plotPointNumber = prompt.plotPointIndex + 1;
        const actName = prompt.structureElement.name;
        modalTitle.textContent = `Plot Point ${plotPointNumber} Regeneration Prompt - ${actName}`;
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideIndividualPlotPointPromptModal() {
        document.getElementById('individualPlotPointPromptModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showDialoguePromptModal() {
        const modal = document.getElementById('dialoguePromptModal');
        const prompt = window.appState.currentDialoguePrompt;
        
        if (!prompt) {
            this.showToast('No prompt data available.', 'error');
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
                previewNoteElement.style.cssText = 'background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; padding: 10px; margin-bottom: 15px; font-size: 0.9rem; color: #1565c0;';
                
                const modalBody = document.querySelector('#dialoguePromptModal .modal-body');
                modalBody.insertBefore(previewNoteElement, modalBody.firstChild);
            }
            previewNoteElement.textContent = `ℹ️ ${prompt.previewNote}`;
            previewNoteElement.style.display = 'block';
        } else {
            // This is for individual dialogue prompt
            if (prompt.isElementGeneration) {
                modalTitle.textContent = `Dialogue Generation Prompt - ${prompt.structureElement.name}`;
            } else {
                modalTitle.textContent = `Dialogue Generation Prompt - ${prompt.structureElement.name} (Scene ${prompt.sceneIndex + 1})`;
            }
            
            // Hide preview note if it exists
            const previewNoteElement = document.getElementById('dialoguePromptPreviewNote');
            if (previewNoteElement) {
                previewNoteElement.style.display = 'none';
            }
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideDialoguePromptModal() {
        document.getElementById('dialoguePromptModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    // ==================== CREATIVE DIRECTION MODALS ====================
    
    showActsCreativeDirectionModal(actKey) {
        const modal = document.getElementById('actsCreativeDirectionModal');
        const actData = window.appState.generatedStructure?.[actKey] || window.appState.templateData?.structure?.[actKey];
        
        if (!actData) {
            this.showToast('Act data not found.', 'error');
            return;
        }
        
        // Store the act key for saving
        window.appState.currentEditingActKey = actKey;
        
        // Populate modal content
        document.getElementById('actsCreativeDirectionTitle').textContent = actData.name || actKey;
        document.getElementById('actsCreativeDirectionInput').value = actData.userDirections || '';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideActsCreativeDirectionModal() {
        document.getElementById('actsCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
        window.appState.currentEditingActKey = null;
    }

    showScenesCreativeDirectionModal(actKey, plotPointIndex) {
        const modal = document.getElementById('scenesCreativeDirectionModal');
        const actData = window.appState.generatedStructure?.[actKey] || window.appState.templateData?.structure?.[actKey];
        
        if (!actData) {
            this.showToast('Act data not found.', 'error');
            return;
        }
        
        // Store the act key and plot point index for saving
        window.appState.currentEditingActKey = actKey;
        window.appState.currentEditingPlotPointIndex = plotPointIndex;
        
        // Get current creative direction
        const currentDirection = actData.plotPointsCreativeDirections?.[plotPointIndex] || '';
        
        // Populate modal content
        document.getElementById('scenesCreativeDirectionTitle').textContent = `${actData.name || actKey} - Plot Point ${plotPointIndex + 1}`;
        document.getElementById('scenesCreativeDirectionInput').value = currentDirection;
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideScenesCreativeDirectionModal() {
        document.getElementById('scenesCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
        window.appState.currentEditingActKey = null;
        window.appState.currentEditingPlotPointIndex = null;
    }

    showPlotPointsCreativeDirectionModal(actKey) {
        const modal = document.getElementById('plotPointsCreativeDirectionModal');
        const actData = window.appState.generatedStructure?.[actKey] || window.appState.templateData?.structure?.[actKey];
        
        if (!actData) {
            this.showToast('Act data not found.', 'error');
            return;
        }
        
        // Store the act key for saving
        window.appState.currentEditingActKey = actKey;
        
        // Populate modal content
        document.getElementById('plotPointsCreativeDirectionTitle').textContent = actData.name || actKey;
        document.getElementById('plotPointsCreativeDirectionInput').value = actData.plotPointsCreativeDirection || '';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hidePlotPointsCreativeDirectionModal() {
        document.getElementById('plotPointsCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
        window.appState.currentEditingActKey = null;
    }

    showActDetailsModal(act) {
        const modal = document.getElementById('actDetailsModal');
        
        // Store the act data for saving
        window.appState.currentEditingAct = act;
        
        // Populate modal content
        document.getElementById('actDetailsTitle').value = act.name || '';
        document.getElementById('actDetailsDescription').value = act.description || '';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideActDetailsModal() {
        document.getElementById('actDetailsModal').classList.remove('show');
        document.body.style.overflow = 'auto';
        window.appState.currentEditingAct = null;
    }

    showDialogueCreativeDirectionModal(actKey, sceneIndex) {
        const modal = document.getElementById('dialogueCreativeDirectionModal');
        const actData = window.appState.generatedStructure?.[actKey] || window.appState.templateData?.structure?.[actKey];
        
        if (!actData) {
            this.showToast('Act data not found.', 'error');
            return;
        }
        
        // Store the act key and scene index for saving
        window.appState.currentEditingActKey = actKey;
        window.appState.currentEditingSceneIndex = sceneIndex;
        
        // Get current creative direction
        const currentDirection = actData.dialogueCreativeDirections?.[sceneIndex] || '';
        
        // Populate modal content
        document.getElementById('dialogueCreativeDirectionTitle').textContent = `${actData.name || actKey} - Scene ${sceneIndex + 1}`;
        document.getElementById('dialogueCreativeDirectionInput').value = currentDirection;
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideDialogueCreativeDirectionModal() {
        document.getElementById('dialogueCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
        window.appState.currentEditingActKey = null;
        window.appState.currentEditingSceneIndex = null;
    }

    // ==================== GLOBAL CREATIVE DIRECTION MODALS ====================
    
    showGlobalPlotPointsCreativeDirectionModal() {
        const modal = document.getElementById('globalPlotPointsCreativeDirectionModal');
        
        // Populate modal content
        document.getElementById('globalPlotPointsCreativeDirectionInput').value = window.appState.globalPlotPointsCreativeDirection || '';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideGlobalPlotPointsCreativeDirectionModal() {
        document.getElementById('globalPlotPointsCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showGlobalScenesCreativeDirectionModal() {
        const modal = document.getElementById('globalScenesCreativeDirectionModal');
        
        // Populate modal content
        document.getElementById('globalScenesCreativeDirectionInput').value = window.appState.globalScenesCreativeDirection || '';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideGlobalScenesCreativeDirectionModal() {
        document.getElementById('globalScenesCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    showGlobalDialogueCreativeDirectionModal() {
        const modal = document.getElementById('globalDialogueCreativeDirectionModal');
        
        // Populate modal content
        document.getElementById('globalDialogueCreativeDirectionInput').value = window.appState.globalDialogueCreativeDirection || '';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideGlobalDialogueCreativeDirectionModal() {
        document.getElementById('globalDialogueCreativeDirectionModal').classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    // ==================== NAVIGATION FUNCTIONS ====================
    
    goToNextStep() {
        if (!window.appState.selectedTemplate) {
            this.showToast('Please select a template first.', 'error');
            return;
        }
        
        // Navigate to Acts page
        if (typeof goToStep === 'function') {
            goToStep(3);
        }
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }
    }

    // ==================== PROJECT HEADER FUNCTIONS ====================
    
    showProjectHeader(projectData) {
        const indicator = document.getElementById('currentProjectIndicator');
        const projectNameEl = document.getElementById('currentProjectName');
        
        if (projectData && indicator && projectNameEl) {
            projectNameEl.textContent = projectData.title || 'Untitled Project';
            indicator.style.display = 'flex';
        }
    }

    hideProjectHeader() {
        const indicator = document.getElementById('currentProjectIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// Create global instance
const uiManager = new UIManager();
window.uiManagerInstance = uiManager;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        uiManager.init();
        // Make elements object globally available for backward compatibility
        window.elements = uiManager.elements;
    });
} else {
    uiManager.init();
    // Make elements object globally available for backward compatibility
    window.elements = uiManager.elements;
}

// ==================== LEGACY WRAPPER FUNCTIONS ====================

// Loading functions
function showLoading(message = 'Loading...') {
    return uiManager.showLoading(message);
}

function hideLoading() {
    return uiManager.hideLoading();
}

// Toast notification functions
function showToast(message, type = 'success') {
    return uiManager.showToast(message, type);
}

function hideToast() {
    return uiManager.hideToast();
}

// Modal management functions
function showPromptPreviewModal() {
    return uiManager.showPromptPreviewModal();
}

function hidePromptPreviewModal() {
    return uiManager.hidePromptPreviewModal();
}

function showScenePromptModal() {
    return uiManager.showScenePromptModal();
}

function hideScenePromptModal() {
    return uiManager.hideScenePromptModal();
}

function showPlotPointPromptModal() {
    return uiManager.showPlotPointPromptModal();
}

function hidePlotPointPromptModal() {
    return uiManager.hidePlotPointPromptModal();
}

function showIndividualPlotPointPromptModal() {
    return uiManager.showIndividualPlotPointPromptModal();
}

function hideIndividualPlotPointPromptModal() {
    return uiManager.hideIndividualPlotPointPromptModal();
}

function showDialoguePromptModal() {
    return uiManager.showDialoguePromptModal();
}

function hideDialoguePromptModal() {
    return uiManager.hideDialoguePromptModal();
}

// Creative direction modals
function showActsCreativeDirectionModal(actKey) {
    return uiManager.showActsCreativeDirectionModal(actKey);
}

function hideActsCreativeDirectionModal() {
    return uiManager.hideActsCreativeDirectionModal();
}

function showScenesCreativeDirectionModal(actKey, plotPointIndex) {
    return uiManager.showScenesCreativeDirectionModal(actKey, plotPointIndex);
}

function hideScenesCreativeDirectionModal() {
    return uiManager.hideScenesCreativeDirectionModal();
}

function showPlotPointsCreativeDirectionModal(actKey) {
    return uiManager.showPlotPointsCreativeDirectionModal(actKey);
}

function hidePlotPointsCreativeDirectionModal() {
    return uiManager.hidePlotPointsCreativeDirectionModal();
}

function showActDetailsModal(act) {
    return uiManager.showActDetailsModal(act);
}

function hideActDetailsModal() {
    return uiManager.hideActDetailsModal();
}

function showDialogueCreativeDirectionModal(actKey, sceneIndex) {
    return uiManager.showDialogueCreativeDirectionModal(actKey, sceneIndex);
}

function hideDialogueCreativeDirectionModal() {
    return uiManager.hideDialogueCreativeDirectionModal();
}

// Global creative direction modals
function showGlobalPlotPointsCreativeDirectionModal() {
    return uiManager.showGlobalPlotPointsCreativeDirectionModal();
}

function hideGlobalPlotPointsCreativeDirectionModal() {
    return uiManager.hideGlobalPlotPointsCreativeDirectionModal();
}

function showGlobalScenesCreativeDirectionModal() {
    return uiManager.showGlobalScenesCreativeDirectionModal();
}

function hideGlobalScenesCreativeDirectionModal() {
    return uiManager.hideGlobalScenesCreativeDirectionModal();
}

function showGlobalDialogueCreativeDirectionModal() {
    return uiManager.showGlobalDialogueCreativeDirectionModal();
}

function hideGlobalDialogueCreativeDirectionModal() {
    return uiManager.hideGlobalDialogueCreativeDirectionModal();
}

// Navigation functions
function goToNextStep() {
    return uiManager.goToNextStep();
}

// Project header functions
function showProjectHeader(projectData) {
    return uiManager.showProjectHeader(projectData);
}

function hideProjectHeader() {
    return uiManager.hideProjectHeader();
}

console.log('🎯 UI Manager loaded with 33 functions'); 