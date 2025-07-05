/**
 * Template Manager Component
 * Extracted from script.js for modular architecture
 * Handles template loading, selection, display, and chronological ordering
 */

// Template Manager Class
class TemplateManager {
    constructor() {
        this.initialized = false;
        this.availableTemplates = null;
        this.loadedTemplates = null;
    }

    init() {
        if (this.initialized) return;
        
        console.log('🔧 TemplateManager initialized');
        this.initialized = true;
    }

    // Find template ID by its display name
    findTemplateIdByName(templateName) {
        if (!templateName || !window.appState?.availableTemplates) {
            return null;
        }
        
        // Search through all categories to find the template
        for (const category of Object.values(window.appState.availableTemplates)) {
            if (category.templates) {
                const template = category.templates.find(t => t.name === templateName);
                if (template) {
                    return template.id;
                }
            }
        }
        
        return null; // Template not found
    }

    // Load available templates
    async loadTemplates() {
        try {
            if (typeof showLoading === 'function') {
                showLoading('Loading templates...');
            }
            
            const response = await fetch('/api/templates');
            const groupedTemplates = await response.json();
            
            if (window.appState) {
                window.appState.availableTemplates = groupedTemplates;
            }
            this.availableTemplates = groupedTemplates;
            window.loadedTemplates = groupedTemplates;
            
            this.displayTemplates(groupedTemplates);
            
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            if (typeof showToast === 'function') {
                showToast('Error loading templates. Please refresh the page.', 'error');
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
        }
    }

    // Display template options in groups
    displayTemplates(groupedTemplates) {
        const container = document.getElementById('templateOptions');
        if (!container) {
            console.warn('Template container not found');
            return;
        }

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
                
                templateElement.addEventListener('click', () => this.selectTemplate(template.id));
                templatesGrid.appendChild(templateElement);
            });
            
            categorySection.appendChild(categoryHeader);
            categorySection.appendChild(templatesGrid);
            container.appendChild(categorySection);
        });
    }

    // Select template
    selectTemplate(templateId) {
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
        const selectedElement = document.querySelector(`[data-template-id="${templateId}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        if (window.appState) {
            window.appState.selectedTemplate = templateId;
            
            // Reset plot points to use template default
            window.appState.totalPlotPoints = null;
            window.appState.manuallySetPlotPoints = {};
            window.appState.currentActPlotPoints = {};
        }
        
        // Find and display the selected template immediately
        let selectedTemplateData = null;
        if (window.appState?.availableTemplates) {
            Object.values(window.appState.availableTemplates).forEach(category => {
                if (category.templates) {
                    const found = category.templates.find(template => template.id === templateId);
                    if (found) {
                        selectedTemplateData = found;
                    }
                }
            });
        }
        
        if (selectedTemplateData) {
            this.displaySelectedTemplate(selectedTemplateData);
            
            // Collapse template options and update UI
            setTimeout(() => {
                this.collapseTemplateOptions();
                this.updateTemplatePageForSelection();
                
                // Update navigation and progress after template selection
                if (typeof updateStepIndicators === 'function') updateStepIndicators();
                if (typeof updateUniversalNavigation === 'function') updateUniversalNavigation();
                if (typeof updateBreadcrumbNavigation === 'function') updateBreadcrumbNavigation();
                if (typeof updateAllProgressMeters === 'function') updateAllProgressMeters();
            }, 200);
        }
        
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }
    }

    // Collapse template options after selection
    collapseTemplateOptions() {
        const templateOptions = document.getElementById('templateOptions');
        if (templateOptions) {
            templateOptions.classList.add('template-options-collapsed');
            templateOptions.classList.remove('template-options-expanded');
        }
    }

    // Expand template options for browsing
    expandTemplateOptions() {
        const templateOptions = document.getElementById('templateOptions');
        if (templateOptions) {
            templateOptions.classList.add('template-options-expanded');
            templateOptions.classList.remove('template-options-collapsed');
        }
    }

    // Update page UI for selected state
    updateTemplatePageForSelection() {
        const stepDescription = document.getElementById('templateStepDescription');
        if (stepDescription) {
            stepDescription.textContent = 'Selected template:';
        }
        
        // Scroll to show the selected template
        const selectedDisplay = document.getElementById('selectedTemplateDisplay');
        if (selectedDisplay) {
            selectedDisplay.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // Change template function (expand options again)
    changeTemplate() {
        const stepDescription = document.getElementById('templateStepDescription');
        if (stepDescription) {
            stepDescription.textContent = 'Select a story structure template that best fits your narrative:';
        }
        
        // Hide selected template display
        const selectedDisplay = document.getElementById('selectedTemplateDisplay');
        if (selectedDisplay) {
            selectedDisplay.style.display = 'none';
        }
        
        // Clear selection
        document.querySelectorAll('.template-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Clear app state
        if (window.appState) {
            window.appState.selectedTemplate = null;
        }
        
        // Expand template options
        this.expandTemplateOptions();
        
        // Scroll to template options
        const templateOptions = document.getElementById('templateOptions');
        if (templateOptions) {
            templateOptions.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
        
        // Update navigation after template deselection
        if (typeof updateStepIndicators === 'function') updateStepIndicators();
        if (typeof updateUniversalNavigation === 'function') updateUniversalNavigation();
        if (typeof updateBreadcrumbNavigation === 'function') updateBreadcrumbNavigation();
        if (typeof updateAllProgressMeters === 'function') updateAllProgressMeters();
        
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }
    }

    // Display selected template
    displaySelectedTemplate(templateData) {
        console.log('🔍 DEBUG: displaySelectedTemplate called with:', {
            templateName: templateData.name,
            templateId: templateData.id,
            hasStructure: !!templateData.structure,
            structureKeys: templateData.structure ? Object.keys(templateData.structure) : []
        });
        
        if (window.appState?.templateData) {
            console.log('🔍 DEBUG: Current appState.templateData before display:', {
                id: window.appState.templateData.id,
                name: window.appState.templateData.name,
                hasStructure: !!window.appState.templateData.structure,
                structureKeys: window.appState.templateData.structure ? Object.keys(window.appState.templateData.structure) : []
            });
        }
        
        // 🔧 GUARD: Don't overwrite existing customized template data during restoration
        if (window.appState?.templateData && window.appState.templateData.structure && 
            window.appState.templateData.id === templateData.id &&
            Object.keys(window.appState.templateData.structure).length > 0) {
            console.log('🔧 GUARD: Preventing displaySelectedTemplate from overwriting existing customized data');
            console.log('🔧 GUARD: Existing structure keys:', Object.keys(window.appState.templateData.structure));
            
            // Just update the UI display without calling loadTemplateStructureForActCards
            const display = document.getElementById('selectedTemplateDisplay');
            const name = document.getElementById('selectedTemplateName');
            const description = document.getElementById('selectedTemplateDescription');
            const category = document.getElementById('selectedTemplateCategory');
            
            if (display && name && description && category) {
                name.textContent = window.appState.templateData.name;
                description.textContent = window.appState.templateData.description;
                category.textContent = window.appState.templateData.category ? window.appState.templateData.category.replace('_', ' ').toUpperCase() : '';
                display.style.display = 'block';
            }
            return; // Exit early to prevent overwriting
        }
        
        const display = document.getElementById('selectedTemplateDisplay');
        const name = document.getElementById('selectedTemplateName');
        const description = document.getElementById('selectedTemplateDescription');
        const category = document.getElementById('selectedTemplateCategory');
        
        // Update the existing elements (keeping the original HTML structure intact)
        if (name) name.textContent = templateData.name;
        if (description) description.textContent = templateData.description;
        if (category) category.textContent = templateData.category ? templateData.category.replace('_', ' ').toUpperCase() : '';
        
        if (display) display.style.display = 'block';
        
        // Load and display act cards for enhanced template selection
        if (typeof loadTemplateStructureForActCards === 'function') {
            loadTemplateStructureForActCards(templateData);
        }
    }

    // Get acts in correct chronological order based on template (matches server-side logic)
    getChronologicalActOrder(templateData, structureKeys) {
        // Define the correct chronological order for common templates (same as server)
        const templateOrders = {
            'three-act': ['setup', 'confrontation_first_half', 'midpoint', 'confrontation_second_half', 'crisis', 'climax', 'resolution'],
            'save-the-cat': ['opening_image', 'setup', 'theme_stated', 'catalyst', 'debate', 'break_into_two', 'b_story', 'fun_and_games', 'midpoint', 'bad_guys_close_in', 'all_is_lost', 'dark_night_of_soul', 'break_into_three', 'finale', 'final_image'],
            'hero-journey': ['ordinary_world', 'call_to_adventure', 'refusal_of_call', 'meeting_mentor', 'crossing_threshold', 'tests_allies_enemies', 'approach_inmost_cave', 'ordeal', 'reward', 'road_back', 'resurrection', 'return_with_elixir'],
            'booker-quest': ['call_to_quest', 'preparation', 'journey_begins', 'trials_and_tests', 'approach_goal', 'final_ordeal', 'goal_achieved'],
            'booker-overcoming-monster': ['anticipation_stage', 'dream_stage', 'frustration_stage', 'nightmare_stage', 'final_triumph'],
            'booker-rags-to-riches': ['humble_origins', 'call_to_adventure', 'getting_out', 'initial_success', 'first_crisis', 'final_crisis', 'final_triumph'],
            'booker-voyage-return': ['ordinary_world', 'call_to_adventure', 'strange_world', 'initial_fascination', 'growing_threat', 'escape_and_return'],
            'booker-comedy': ['initial_situation', 'complication', 'development', 'crisis', 'resolution'],
            'booker-tragedy': ['anticipation_stage', 'dream_stage', 'frustration_stage', 'nightmare_stage', 'destruction'],
            'booker-rebirth': ['initial_state', 'call_to_life', 'resistance', 'crisis', 'final_awakening']
        };
        
        // Get template name from templateData
        const templateName = templateData?.name?.toLowerCase().replace(/[^a-z-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown';
        
        // Try to match template name to known orders
        let chronologicalOrder = null;
        for (const [key, order] of Object.entries(templateOrders)) {
            if (templateName.includes(key) || key.includes(templateName)) {
                chronologicalOrder = order;
                break;
            }
        }
        
        // If we have a known order, filter it to only include acts that exist in the structure
        if (chronologicalOrder) {
            const existingActs = chronologicalOrder.filter(actKey => structureKeys.includes(actKey));
            if (existingActs.length > 0) {
                console.log(`🔧 Frontend: Using chronological order for template "${templateName}": ${existingActs.join(' → ')}`);
                return existingActs;
            }
        }
        
        // Fallback: use provided order but warn about potential ordering issues
        console.log(`⚠️  Frontend: Using fallback order for template "${templateName}": ${structureKeys.join(' → ')}`);
        return structureKeys;
    }

    // Get template data from already loaded templates
    async getTemplateDataFromExistingTemplates(templateId) {
        // Check if we have templates loaded
        if (!window.loadedTemplates) {
            console.log('Templates not loaded yet, loading...');
            await this.loadTemplates();
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

    // Create simple template preview
    async createSimpleTemplatePreview() {
        const structureContainer = document.getElementById('structureContent');
        if (!structureContainer) {
            console.log('Structure container not found for simple preview');
            return;
        }
        
        structureContainer.innerHTML = `
            <div class="template-preview-placeholder">
                <h3>📋 Template Structure Preview</h3>
                <p>Template structure will be displayed here once selected.</p>
                <div class="placeholder-content">
                    <span class="placeholder-icon">🎬</span>
                    <span class="placeholder-text">Select a template to see its structure</span>
                </div>
            </div>
        `;
    }

    // Display template structure preview
    async displayTemplateStructurePreview() {
        if (!window.appState?.selectedTemplate) {
            console.log('No template selected for structure preview');
            return;
        }
        
        // Check if we already have generated structure - if so, display it instead of preview
        if (window.appState.generatedStructure && Object.keys(window.appState.generatedStructure).length > 0) {
            console.log('Generated structure already exists, displaying actual structure');
            if (typeof displayStructure === 'function') {
                displayStructure(window.appState.generatedStructure, window.appState.lastUsedPrompt, window.appState.lastUsedSystemMessage);
            }
            if (typeof updateActsGenerationButton === 'function') {
                updateActsGenerationButton(); // Update button to show "Regenerate Acts"
            }
            return;
        }

        // 🔧 FIX: Check for existing templateData with user edits FIRST
        if (window.appState.templateData && window.appState.templateData.structure) {
            console.log('Using existing template data with user edits:', window.appState.templateData.name);
            
            // Use the EXISTING structure container - unified approach!
            const structureContainer = document.getElementById('structureContent');
            if (!structureContainer) {
                console.log('Structure container not found');
                return;
            }
            
            // Create preview using the modified template data (with user edits)
            this.createFullTemplatePreview(window.appState.templateData, structureContainer);
            return;
        }
        
        // Fallback: If no edited template data exists, load fresh template data
        try {
            // Get template data from existing templates (no server call needed)
            const templateData = await this.getTemplateDataFromExistingTemplates(window.appState.selectedTemplate);
            if (!templateData) {
                console.log('Template data not found, creating simple preview');
                // Create a simple preview without full template data
                this.createSimpleTemplatePreview();
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
                            ${act.userDirections && act.userDirections.trim() ? `
                            <div class="creative-directions">
                                <strong>✨ Your Creative Directions:</strong> ${act.userDirections}
                            </div>
                            ` : ''}
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
            if (window.appState) {
                window.appState.templateData = templateData;
            }
            
        } catch (error) {
            console.error('Error loading template structure preview:', error);
            if (typeof showToast === 'function') {
                showToast('Could not load template structure preview', 'error');
            }
        }
    }

    // Create full template preview
    createFullTemplatePreview(templateData, structureContainer) {
        if (!templateData || !structureContainer) {
            console.warn('Invalid parameters for createFullTemplatePreview');
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
        
        // Create preview structure
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
                        ${act.userDirections && act.userDirections.trim() ? `
                        <div class="creative-directions">
                            <strong>✨ Your Creative Directions:</strong> ${act.userDirections}
                        </div>
                        ` : ''}
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
    }
}

// Create global instance
const templateManagerInstance = new TemplateManager();

// Export for global access (backward compatibility)
window.templateManagerInstance = templateManagerInstance;

// Global functions for backward compatibility
window.loadTemplates = function() {
    return templateManagerInstance.loadTemplates();
};

window.selectTemplate = function(templateId) {
    return templateManagerInstance.selectTemplate(templateId);
};

window.changeTemplate = function() {
    return templateManagerInstance.changeTemplate();
};

window.displaySelectedTemplate = function(templateData) {
    return templateManagerInstance.displaySelectedTemplate(templateData);
};

window.getChronologicalActOrder = function(templateData, structureKeys) {
    return templateManagerInstance.getChronologicalActOrder(templateData, structureKeys);
};

window.findTemplateIdByName = function(templateName) {
    return templateManagerInstance.findTemplateIdByName(templateName);
};

window.displayTemplateStructurePreview = function() {
    return templateManagerInstance.displayTemplateStructurePreview();
};

window.getTemplateDataFromExistingTemplates = function(templateId) {
    return templateManagerInstance.getTemplateDataFromExistingTemplates(templateId);
};

window.createSimpleTemplatePreview = function() {
    return templateManagerInstance.createSimpleTemplatePreview();
};

window.createFullTemplatePreview = function(templateData, structureContainer) {
    return templateManagerInstance.createFullTemplatePreview(templateData, structureContainer);
};

window.collapseTemplateOptions = function() {
    return templateManagerInstance.collapseTemplateOptions();
};

window.expandTemplateOptions = function() {
    return templateManagerInstance.expandTemplateOptions();
};

window.updateTemplatePageForSelection = function() {
    return templateManagerInstance.updateTemplatePageForSelection();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        templateManagerInstance.init();
    });
} else {
    templateManagerInstance.init();
}

console.log('🔧 TemplateManager component loaded'); 