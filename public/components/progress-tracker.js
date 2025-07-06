/*
 * Progress Tracking System Component
 * Manages step navigation, progress bars, and step completion validation
 * 
 * Dependencies:
 * - appState (global app state)
 * - elements (global DOM elements)
 * - Auto-save system
 * - Various step-specific functions
 * 
 * Extracted from script.js for better modularity
 */

// =============================================================================
// PROGRESS BAR AND STEP INDICATORS
// =============================================================================

/**
 * Updates the main progress bar based on current step
 */
function updateProgressBar() {
    const progressPercentage = (appState.currentStep / 7) * 100;
    elements.progressFill.style.width = `${progressPercentage}%`;
}

/**
 * Updates step indicators with active, completed, and disabled states
 */
function updateStepIndicators() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed', 'fully-complete', 'disabled');
        
        let appliedClass = '';
        if (stepNumber === appState.currentStep) {
            step.classList.add('active');
            appliedClass = 'active';
        } else if (isStepFullyComplete(stepNumber)) {
            step.classList.add('fully-complete');
            appliedClass = 'fully-complete';
        } else if (canNavigateToStep(stepNumber)) {
            step.classList.add('completed');
            appliedClass = 'completed';
        } else {
            step.classList.add('disabled');
            appliedClass = 'disabled';
        }

        // Add click handler if not already added
        if (!step.hasAttribute('data-click-handler')) {
            step.setAttribute('data-click-handler', 'true');
            step.addEventListener('click', () => handleStepClick(stepNumber));
        }
    });
    
    // Update progress meters in step headers
    updateAllProgressMeters();
}

/**
 * Updates all progress meters in step headers
 */
function updateAllProgressMeters() {
    for (let stepNumber = 1; stepNumber <= 7; stepNumber++) {
        updateStepHeaderProgressMeter(stepNumber);
    }
    
    // Also update navigation buttons (but NOT step indicators to avoid infinite loop)
    updateUniversalNavigation();
    updateBreadcrumbNavigation();
}

/**
 * Updates individual progress meter for a specific step header
 */
function updateStepHeaderProgressMeter(stepNumber) {
    const progressMeter = document.querySelector(`h2 .progress-meter[data-step="${stepNumber}"]`);
    if (!progressMeter) {
        return;
    }
    
    // Calculate progress based on step completion
    let progress = 0;
    if (window.ProgressTracker) {
        progress = ProgressTracker.calculateStepProgress(stepNumber, appState);
    } else {
        if (isStepFullyComplete(stepNumber)) {
            progress = 100;
        }
    }
    // No partial progress - either 0% (not complete) or 100% (complete)
    
    const circle = progressMeter.querySelector('.progress-fill');
    const textElement = progressMeter.querySelector('.progress-text');
    
    if (circle && textElement) {
        // Check if we need to add/remove complete state
        const isComplete = progress >= 100;
        
        if (isComplete) {
            // Add complete state
            progressMeter.classList.add('complete');
            
            // Add checkmark if it doesn't exist
            if (!progressMeter.querySelector('.progress-checkmark')) {
                const checkmark = document.createElement('div');
                checkmark.className = 'progress-checkmark';
                checkmark.innerHTML = '✓';
                progressMeter.appendChild(checkmark);
            }
            
            // Add completed label if it doesn't exist
            if (!progressMeter.nextElementSibling || !progressMeter.nextElementSibling.classList.contains('progress-completed-label')) {
                const completedLabel = document.createElement('span');
                completedLabel.className = 'progress-completed-label';
                completedLabel.textContent = 'Completed';
                progressMeter.parentNode.insertBefore(completedLabel, progressMeter.nextSibling);
            }
        } else {
            // Remove complete state
            progressMeter.classList.remove('complete');
            
            // Remove checkmark if it exists
            const existingCheckmark = progressMeter.querySelector('.progress-checkmark');
            if (existingCheckmark) {
                existingCheckmark.remove();
            }
            
            // Remove completed label if it exists
            const existingLabel = progressMeter.nextElementSibling;
            if (existingLabel && existingLabel.classList.contains('progress-completed-label')) {
                existingLabel.remove();
            }
        }
        
        // Calculate stroke-dasharray for circular progress
        const circumference = 2 * Math.PI * 16; // radius = 16
        const progressLength = (progress / 100) * circumference;
        const remainingLength = circumference - progressLength;
        
        circle.style.strokeDasharray = `${progressLength} ${remainingLength}`;
        textElement.textContent = `${progress}%`;
    }
}

// =============================================================================
// STEP NAVIGATION AND VALIDATION
// =============================================================================

/**
 * Check if navigation to a specific step is allowed
 */
function canNavigateToStep(stepNumber) {
    let result;
    switch (stepNumber) {
        case 1:
            result = true; // Can always go to step 1
            break;
        case 2:
            // Need complete story input (title is sufficient, logline is optional)
            result = !!(appState.storyInput && 
                       appState.storyInput.title);
            break;
        case 3:
            // Need template selected (Step 2 complete)
            result = !!appState.selectedTemplate;
            if (stepNumber === 3) {
                console.log('Step 3 validation:', {
                    selectedTemplate: appState.selectedTemplate,
                    hasStructure: !!appState.generatedStructure,
                    structureKeys: Object.keys(appState.generatedStructure || {}),
                    result: result
                });
            }
            break;
        case 4:
            // Need structure with actual content generated
            result = !!(appState.generatedStructure && 
                       Object.keys(appState.generatedStructure).length > 0 &&
                       Object.keys(appState.generatedStructure).some(key => 
                           appState.generatedStructure[key] && 
                           appState.generatedStructure[key].description
                       ));
            break;
        case 5:
            result = !!(appState.plotPoints && Object.keys(appState.plotPoints).length > 0); // Need plot points generated
            break;
        case 6:
            // Need scenes actually generated (not just empty object)
            result = !!(appState.generatedScenes && 
                       Object.keys(appState.generatedScenes).some(key => 
                           appState.generatedScenes[key] && appState.generatedScenes[key].length > 0
                       ));
            break;
        case 7:
            // Need some dialogue generated for meaningful script export
            result = !!(appState.generatedDialogues && 
                       Object.keys(appState.generatedDialogues).length > 0);
            if (stepNumber === 7) {
                const sceneCount = Object.keys(appState.generatedScenes || {}).reduce((total, key) => 
                    total + (appState.generatedScenes[key]?.length || 0), 0);
                console.log('Step 7 validation:', {
                    hasScenes: !!appState.generatedScenes,
                    sceneCount: sceneCount,
                    hasExported: !!appState.hasExported,
                    result: result
                });
            }
            break;
        default:
            result = false;
    }
    
    return result;
}

/**
 * Check if a step is fully complete (has all necessary content)
 */
function isStepFullyComplete(stepNumber) {
    let result;
    switch (stepNumber) {
        case 1:
            // Story input is complete if it has a title (logline is optional)
            result = !!(appState.storyInput && 
                        appState.storyInput.title);
            break;
        case 2:
            // Template is fully complete if selected and structure is generated
            result = !!(appState.selectedTemplate && appState.generatedStructure);
            break;
        case 3:
            // Structure is fully complete if generated and all acts have content
            if (!appState.generatedStructure) {
                result = false;
            } else {
                const structureKeys = Object.keys(appState.generatedStructure);
                // Must have structure elements AND content for all of them
                result = structureKeys.length > 0 && structureKeys.every(key => 
                    appState.generatedStructure[key] && 
                    appState.generatedStructure[key].description
                );
            }
            
            // Debug logging for step 3 completion
            console.log('Step 3 (Structure) completion check:', {
                hasGeneratedStructure: !!appState.generatedStructure,
                structureKeys: appState.generatedStructure ? Object.keys(appState.generatedStructure) : [],
                structureData: appState.generatedStructure,
                selectedTemplate: appState.selectedTemplate,
                result: result
            });
            break;
        case 4:
            // Plot points fully complete if generated for all structure elements
            if (!appState.plotPoints || !appState.generatedStructure) {
                result = false;
            } else {
                const requiredElements = Object.keys(appState.generatedStructure);
                // Must have structure elements AND plot points for all of them
                result = requiredElements.length > 0 && requiredElements.every(key => 
                    appState.plotPoints[key] && appState.plotPoints[key].length > 0
                );
            }
            
            // Debug logging for step 4 completion
            console.log('Step 4 (Plot Points) completion check:', {
                hasPlotPoints: !!appState.plotPoints,
                hasGeneratedStructure: !!appState.generatedStructure,
                plotPointsKeys: appState.plotPoints ? Object.keys(appState.plotPoints) : [],
                structureKeys: appState.generatedStructure ? Object.keys(appState.generatedStructure) : [],
                plotPointsData: appState.plotPoints,
                result: result
            });
            break;
        case 5:
            // Scenes fully complete if generated for all structure elements
            if (!appState.generatedScenes || !appState.generatedStructure) {
                result = false;
            } else {
                const sceneKeys = Object.keys(appState.generatedStructure);
                // Must have structure elements AND scenes for all of them
                result = sceneKeys.length > 0 && sceneKeys.every(key => 
                    appState.generatedScenes[key] && appState.generatedScenes[key].length > 0
                );
            }
            
            // Debug logging for step 5 completion
            const sceneKeys = appState.generatedStructure ? Object.keys(appState.generatedStructure) : [];
            const totalScenesCount = sceneKeys.reduce((total, key) => 
                total + (appState.generatedScenes?.[key]?.length || 0), 0);
            console.log('Step 5 (Scenes) completion check:', {
                hasGeneratedScenes: !!appState.generatedScenes,
                hasGeneratedStructure: !!appState.generatedStructure,
                sceneKeys: sceneKeys,
                scenesData: appState.generatedScenes,
                totalScenes: totalScenesCount,
                targetScenes: appState.storyInput?.totalScenes,
                result: result
            });
            break;
        case 6:
            // Dialogue fully complete if generated for all scenes in ALL STRUCTURE ACTS
            if (!appState.generatedDialogues || !appState.generatedScenes || !appState.generatedStructure) {
                result = false;
                break;
            }
            
            // Check if there's actually any dialogue content
            const dialogueKeys = Object.keys(appState.generatedDialogues || {});
            if (dialogueKeys.length === 0) {
                result = false;
                break;
            }
            
            let allScenesHaveDialogue = true;
            let totalScenes = 0;
            let dialogueCount = 0;
            let allActsHaveScenes = true;
            
            // Check all structure acts, not just acts with scenes
            for (const structureKey of Object.keys(appState.generatedStructure)) {
                const scenes = appState.generatedScenes[structureKey] || [];
                
                // If this act has no scenes at all, the dialogue step is not complete
                if (scenes.length === 0) {
                    allActsHaveScenes = false;
                }
                
                totalScenes += scenes.length;
                for (let i = 0; i < scenes.length; i++) {
                    if (appState.generatedDialogues[`${structureKey}-${i}`]) {
                        dialogueCount++;
                    } else {
                        allScenesHaveDialogue = false;
                    }
                }
            }
            
            // Debug logging for step 6 completion
            console.log('Step 6 (Dialogue) completion check:', {
                hasGeneratedDialogues: !!appState.generatedDialogues,
                hasGeneratedScenes: !!appState.generatedScenes,
                hasGeneratedStructure: !!appState.generatedStructure,
                structureKeys: Object.keys(appState.generatedStructure),
                totalScenes,
                dialogueCount,
                dialogueKeys: dialogueKeys.length,
                allScenesHaveDialogue,
                allActsHaveScenes,
                completionPercentage: totalScenes > 0 ? Math.round((dialogueCount / totalScenes) * 100) : 0
            });
            
            // Only complete if all acts have scenes AND all scenes have dialogue
            result = allActsHaveScenes && allScenesHaveDialogue;
            break;
        case 7:
            // Export is complete only after actually exporting
            result = !!(appState.hasExported || false);
            break;
        default:
            result = false;
    }
    
    return result;
}

/**
 * Handle clicking on step indicators
 */
function handleStepClick(stepNumber) {
    if (stepNumber === appState.currentStep) {
        return; // Already on this step
    }
    
    if (canNavigateToStep(stepNumber)) {
        goToStep(stepNumber);
        showToast(`Navigated to Step ${stepNumber}`, 'success');
    } else {
        // Show helpful message about what's needed
        const requirements = {
            2: "Please complete the story input first",
            3: "Please select a story structure template first", 
            4: "Please generate and approve the plot structure first",
            5: "Please generate plot points for structural elements first",
            6: "Please generate and approve scenes first",
            7: "Please generate dialogue for scenes first"
        };
        
        showToast(requirements[stepNumber] || "Cannot navigate to this step yet", 'error');
    }
}

// =============================================================================
// NAVIGATION FUNCTIONS
// =============================================================================

/**
 * Force navigation to a step without validation (used for loaded projects)
 */
async function forceGoToStep(stepNumber) {
    console.log(`Force navigating to step ${stepNumber} without validation`);
    await goToStepInternal(stepNumber, false);
}

/**
 * Regular navigation with validation
 */
async function goToStep(stepNumber) {
    await goToStepInternal(stepNumber, true);
}

/**
 * Internal function that handles both validated and forced navigation
 */
async function goToStepInternal(stepNumber, validateAccess = true) {
    console.log(`goToStepInternal: step=${stepNumber}, validate=${validateAccess}`);
    
    // If validation is enabled and we can't navigate to this step, don't proceed
    if (validateAccess && !canNavigateToStep(stepNumber)) {
        console.warn(`Cannot navigate to step ${stepNumber} - validation failed`);
        return;
    }
    
    console.log(`Proceeding to step ${stepNumber}`);
    
    // Hide all steps
    document.querySelectorAll('.workflow-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show target step
    document.getElementById(`step${stepNumber}`).classList.add('active');
    
    // Refresh content for specific steps when navigating to them
    if (stepNumber === 1) {
        // Step 1: Story Input - Update character, influence, and story concept displays
        console.log('Step 1 - Story Input');
        
        // 🔧 LAZY LOADING: Populate dropdowns only when Step 1 is accessed
        if (!window.dropdownsLoaded) {
            console.log('⚡ Lazy loading dropdowns for Step 1...');
            try {
                await appInitializationManager.populateDropdowns();
                window.dropdownsLoaded = true;
                console.log('✅ Dropdowns lazy loaded successfully');
            } catch (error) {
                console.error('❌ Error lazy loading dropdowns:', error);
            }
        }
        
        updateCharacterTags();
        updateInfluenceTags('director');
        updateInfluenceTags('screenwriter');
        updateInfluenceTags('film');
        updateInfluenceTags('tone');
        updateStoryConceptDisplay();
    } else if (stepNumber === 2) {
        // Step 2: Template Selection - Show selected template or template options
        console.log('Step 2 - Template Selection');
        if (appState.selectedTemplate) {
            // Template already selected - show the selected template
            console.log('🔧 Template already selected, displaying:', appState.selectedTemplate);
            
            // Ensure templates are loaded first
            try {
                await loadTemplates();
                
                // Find the selected template data
                let selectedTemplateData = null;
                if (appState.availableTemplates) {
                    Object.values(appState.availableTemplates).forEach(category => {
                        if (category.templates) {
                            const found = category.templates.find(template => template.id === appState.selectedTemplate);
                            if (found) {
                                selectedTemplateData = found;
                            }
                        }
                    });
                }
                
                if (selectedTemplateData) {
                    // Use existing templateData if available (with user customizations), otherwise use fresh data
                    const templateDataToDisplay = appState.templateData || selectedTemplateData;
                    console.log('🔧 Displaying template:', templateDataToDisplay.name);
                    
                    // Mark the template as selected in the UI
                    const templateElements = document.querySelectorAll('.template-option');
                    templateElements.forEach(element => {
                        const templateIdAttr = element.getAttribute('data-template-id');
                        if (templateIdAttr === appState.selectedTemplate) {
                            element.classList.add('selected');
                        } else {
                            element.classList.remove('selected');
                        }
                    });
                    
                    // Display the selected template
                    displaySelectedTemplate(templateDataToDisplay);
                    collapseTemplateOptions();
                    updateTemplatePageForSelection();
                    
                    console.log('✅ Template display completed for step 2 navigation');
                } else {
                    console.warn('🚨 Selected template data not found, expanding options');
                    expandTemplateOptions();
                }
            } catch (error) {
                console.error('🚨 Error loading templates for step 2:', error);
                expandTemplateOptions();
            }
        } else {
            // No template selected - show template options
            expandTemplateOptions();
        }
    } else if (stepNumber === 3) {
        // Step 3: Acts Generation - Show template structure preview
        console.log('Step 3 - Acts Generation');
        await displayTemplateStructurePreview();
        updateActsGenerationButton(); // Update button to show Generate/Regenerate Acts
    } else if (stepNumber === 4) {
        // Step 4: Plot Points Generation
        console.log('Step 4 - Plot Points Generation');
        if (appState.generatedStructure) {
            await displayPlotPointsGeneration();
        }
        updateGenerateAllPlotPointsButton(); // Update button to show Generate/Regenerate
    } else if (stepNumber === 5) {
        // Step 5: Scene Generation
        console.log('Step 5 - Scene Generation');
        
        // Update the totalScenes field with current value
        const totalScenesField = document.getElementById('totalScenes');
        if (totalScenesField && appState.storyInput) {
            totalScenesField.value = appState.storyInput.totalScenes || 70;
        }
        
        if (appState.storyInput) {
            const totalScenesElement = document.getElementById('totalScenesDisplay');
            if (totalScenesElement) {
                totalScenesElement.textContent = appState.storyInput.totalScenes || 70;
            }
        }
        
        if (appState.generatedStructure) {
            displayScenes(appState.generatedScenes || {});
        }
        
        // Initialize compact screenplay calculator
        setTimeout(() => {
            initializeCompactCalculator();
            updateCompactEstimates();
        }, 100);
        
        updateGenerateAllScenesButton(); // Update button to show Generate/Regenerate
    } else if (stepNumber === 6 && appState.generatedScenes) {
        // Step 6: Dialogue Generation
        displayDialogueGeneration();
        // Initialize dialogue estimates with slight delay to ensure DOM is ready
        setTimeout(() => {
            initializeDialogueEstimates();
        }, 100);
        updateGenerateAllDialogueButton(); // Update button to show Generate/Regenerate
    } else if (stepNumber === 7) {
        // Step 7: Final Script - Auto-assemble script with whatever dialogue we have
        if (Object.keys(appState.generatedDialogues || {}).length > 0) {
            // Add a small delay to ensure DOM is fully rendered
            setTimeout(() => {
                assembleScript();
            }, 100);
        }
    }
    
    appState.currentStep = stepNumber;
    updateProgressBar();
    updateStepIndicators();
    
    // Update universal navigation buttons and breadcrumbs
    updateUniversalNavigation();
    updateBreadcrumbNavigation();
    
    // Update project header if project is loaded
    if (appState.storyInput) {
        showProjectHeader(appState.storyInput);
    }
    
    // Trigger auto-save on step transitions (but not initial load)
    if (validateAccess && autoSaveManager.hasProjectData()) {
        autoSaveManager.markDirty();
    }
    
    saveToLocalStorage();
}

/**
 * Universal navigation system - replaces approval-based navigation
 */
function updateUniversalNavigation() {
    const currentStep = appState.currentStep;
    
    // Get the current step's actions container
    const actionsContainer = document.querySelector(`#step${currentStep} .step-actions`);
    if (!actionsContainer) return;
    
    // Clear existing buttons
    actionsContainer.innerHTML = '';
    
    // Add Back button (if not on step 1)
    if (currentStep > 1) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-secondary';
        backBtn.textContent = 'Back';
        backBtn.onclick = () => goToStep(currentStep - 1);
        actionsContainer.appendChild(backBtn);
    }
    
    // Add Forward button (if next step is available) or special actions for final step
    const nextStep = currentStep + 1;
    if (nextStep <= 7 && canNavigateToStep(nextStep)) {
        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'btn btn-primary';
        forwardBtn.textContent = getForwardButtonText(currentStep, nextStep);
        forwardBtn.onclick = () => goToStep(nextStep);
        actionsContainer.appendChild(forwardBtn);
    } else if (currentStep === 7) {
        // Final step - add export and start over buttons
        if (Object.keys(appState.generatedDialogues || {}).length > 0) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn btn-success';
            exportBtn.textContent = 'Export Script';
            exportBtn.onclick = () => exportScript();
            actionsContainer.appendChild(exportBtn);
        }
        
        const startOverBtn = document.createElement('button');
        startOverBtn.className = 'btn btn-secondary';
        startOverBtn.textContent = 'Start New Script';
        startOverBtn.onclick = () => startOver();
        actionsContainer.appendChild(startOverBtn);
    }
}

/**
 * Get appropriate text for forward button based on current step
 */
function getForwardButtonText(currentStep, nextStep) {
    const stepNames = {
        1: 'Story Input',
        2: 'Template',
        3: 'Acts',
        4: 'Plot Points', 
        5: 'Scenes',
        6: 'Dialogue',
        7: 'Export'
    };
    
    return `Continue to ${stepNames[nextStep]}`;
}

/**
 * Update breadcrumb navigation to match step availability
 */
function updateBreadcrumbNavigation() {
    const currentStep = appState.currentStep;
    const breadcrumbContainer = document.querySelector(`#step${currentStep} .step-breadcrumb`);
    
    if (!breadcrumbContainer) return;
    
    // Clear existing breadcrumbs
    breadcrumbContainer.innerHTML = '';
    
    const stepNames = {
        1: 'Story Input',
        2: 'Template', 
        3: 'Acts',
        4: 'Plot Points',
        5: 'Scenes',
        6: 'Dialogue',
        7: 'Export'
    };
    
    // Build breadcrumb path showing ALL accessible steps (not just up to current)
    let hasAddedAnyStep = false;
    
    for (let step = 1; step <= 7; step++) {
        // Only show accessible steps or current step
        if (step === currentStep || canNavigateToStep(step)) {
            if (hasAddedAnyStep) {
                // Add separator
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '→';
                breadcrumbContainer.appendChild(separator);
            }
            
            if (step === currentStep) {
                // Current step - not clickable
                const current = document.createElement('span');
                current.className = 'breadcrumb-current';
                current.textContent = stepNames[step];
                breadcrumbContainer.appendChild(current);
            } else {
                // Accessible step - clickable
                const button = document.createElement('button');
                button.className = 'breadcrumb-btn';
                button.textContent = stepNames[step];
                button.onclick = () => goToStep(step);
                breadcrumbContainer.appendChild(button);
            }
            
            hasAddedAnyStep = true;
        }
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Start over function - clears all progress and reloads
 */
function startOver() {
    if (confirm('Are you sure you want to start over? This will clear all progress.')) {
        localStorage.removeItem('filmScriptGenerator');
        location.reload();
    }
}

// =============================================================================
// GLOBAL EXPORTS
// =============================================================================

// Export functions for use in main script
window.ProgressTracker = {
    // Progress tracking functions
    updateProgressBar,
    updateStepIndicators,
    updateAllProgressMeters,
    updateStepHeaderProgressMeter,
    
    // Navigation validation functions
    canNavigateToStep,
    isStepFullyComplete,
    handleStepClick,
    
    // Navigation functions
    goToStep,
    forceGoToStep,
    goToStepInternal,
    updateUniversalNavigation,
    updateBreadcrumbNavigation,
    getForwardButtonText,
    
    // Utility functions
    startOver
};

// Global function wrappers for backward compatibility
window.updateProgressBar = updateProgressBar;
window.updateStepIndicators = updateStepIndicators;
window.updateAllProgressMeters = updateAllProgressMeters;
window.updateStepHeaderProgressMeter = updateStepHeaderProgressMeter;
window.canNavigateToStep = canNavigateToStep;
window.isStepFullyComplete = isStepFullyComplete;
window.handleStepClick = handleStepClick;
window.goToStep = goToStep;
window.forceGoToStep = forceGoToStep;
window.goToStepInternal = goToStepInternal;
window.updateUniversalNavigation = updateUniversalNavigation;
window.updateBreadcrumbNavigation = updateBreadcrumbNavigation;
window.getForwardButtonText = getForwardButtonText;
window.startOver = startOver;

console.log('✅ Progress Tracker component loaded successfully');

// Progress Tracker component placeholder
console.log('Progress Tracker component loading...'); 