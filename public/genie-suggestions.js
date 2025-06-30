/**
 * Genie Suggestions System
 * 
 * Unified AI suggestion system for prompt components
 * Integrates with existing universal modal system
 */

class GenieSuggestions {
    constructor() {
        this.isLoading = false;
        this.lastSuggestion = null;
        this.suggestionTypes = {
            'director': {
                promptTemplate: 'Given this story concept and current influences, suggest a director whose style would enhance this narrative',
                outputFormat: 'directional influence',
                placeholder: 'e.g., "Christopher Nolan\'s layered storytelling and practical effects"'
            },
            'screenwriter': {
                promptTemplate: 'Given this story concept and current influences, suggest a screenwriter whose prose style would enhance this narrative',
                outputFormat: 'prose style influence',
                placeholder: 'e.g., "Aaron Sorkin\'s rapid-fire dialogue and character depth"'
            },
            'film': {
                promptTemplate: 'Given this story concept and current influences, suggest a film whose essence would enhance this narrative',
                outputFormat: 'creative essence influence',
                placeholder: 'e.g., "Blade Runner\'s neo-noir atmosphere and existential themes"'
            },
            'tone': {
                promptTemplate: 'Given this story concept and current influences, suggest a tone that would enhance this narrative',
                outputFormat: 'tone and atmosphere',
                placeholder: 'e.g., "Dark comedy with underlying melancholy"'
            },
            'character': {
                promptTemplate: 'Given this story concept and current influences, suggest a character that would enhance this narrative',
                outputFormat: 'character suggestion',
                placeholder: 'Complex character with clear motivations',
                isComplex: true
            },
            'storyconcept': {
                promptTemplate: 'Create an original, compelling story concept that avoids overused tropes like memory manipulation, time travel, or dystopian futures. Explore fresh themes across different genres - thriller, drama, comedy, horror, action, romance, mystery, or hybrid genres. Focus on unique human conflicts, relationships, or situations. Respond with ONLY a title and logline in this exact format:\n\nTitle: [Your Story Title]\nLogline: [One sentence premise describing the story]',
                outputFormat: 'story concept with title and logline',
                placeholder: 'Compelling story premise',
                isComplex: true
            }
        };
    }

    /**
     * Add Genie Suggests button to existing modal
     */
    injectGenieButton(modalId, suggestionType) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const modalFooter = modal.querySelector('.modal-footer');
        if (!modalFooter) return;

        // Check if Genie button already exists
        if (modal.querySelector('.btn-genie')) return;

        const config = this.suggestionTypes[suggestionType];
        if (!config) return;

        // Create left side container for Genie button if it doesn't exist
        let leftContainer = modalFooter.querySelector('.modal-footer-left');
        if (!leftContainer) {
            leftContainer = document.createElement('div');
            leftContainer.className = 'modal-footer-left';
            
            // Create right side container for existing buttons
            const rightContainer = document.createElement('div');
            rightContainer.className = 'modal-footer-right';
            
            // Move existing buttons to right container
            const existingButtons = Array.from(modalFooter.children);
            existingButtons.forEach(button => {
                rightContainer.appendChild(button);
            });
            
            // Add containers to footer
            modalFooter.appendChild(leftContainer);
            modalFooter.appendChild(rightContainer);
        }

        // Create Genie button
        const genieButton = document.createElement('button');
        genieButton.type = 'button';
        genieButton.className = 'btn btn-genie';
        genieButton.id = 'genieSuggestBtn';
        
        // Check if modal has existing content to determine button text
        const hasExistingContent = this.checkForExistingContent();
        genieButton.innerHTML = hasExistingContent ? 'Replace' : 'Genie Suggests';
        genieButton.onclick = () => this.generateSuggestion(suggestionType);

        // Create Genie icon
        const genieIcon = document.createElement('img');
        genieIcon.src = 'askthegenie_black.png';
        genieIcon.className = 'genie-icon-button';
        genieIcon.alt = 'Ask the Genie';

        // Add both to left container
        leftContainer.appendChild(genieIcon);
        leftContainer.appendChild(genieButton);
    }

    /**
     * Generate AI suggestion based on current story context
     */
    async generateSuggestion(suggestionType) {
        if (this.isLoading) return;

        const config = this.suggestionTypes[suggestionType];
        if (!config) {
            console.error('Unknown suggestion type:', suggestionType);
            return;
        }

        // Check if there's existing content and warn user
        const hasExistingContent = this.checkForExistingContent();
        if (hasExistingContent) {
            const confirmed = confirm('This will replace your current entry. Are you sure you want to continue?');
            if (!confirmed) {
                return;
            }
        }

        try {
            this.isLoading = true;
            this.updateLoadingState(true);

            // Build context from current story state
            const context = this.buildStoryContext();
            
            // Create prompt with variation
            const prompt = this.buildSuggestionPrompt(suggestionType, context);

            const response = await fetch('/api/genie-suggestion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    suggestionType,
                    prompt,
                    context,
                    temperature: suggestionType === 'storyconcept' ? 1.0 : 0.8 // Higher temperature for story concepts to ensure more variation
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.lastSuggestion = {
                    type: suggestionType,
                    ...data.suggestion
                };
                this.displaySuggestion(data.suggestion, suggestionType);
            } else {
                throw new Error(data.error || 'Failed to generate suggestion');
            }

        } catch (error) {
            console.error('Error generating suggestion:', error);
            showToast('Error generating suggestion. Please try again.', 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState(false);
        }
    }

    /**
     * Build story context from current app state
     */
    buildStoryContext() {
        const context = {
            storyTitle: '',
            storyLogline: '',
            characters: [],
            influences: {
                directors: [],
                screenwriters: [],
                films: [],
                tones: []
            },
            template: null
        };

        // Get story concept
        if (appState.currentStoryConcept) {
            context.storyTitle = appState.currentStoryConcept.title || '';
            context.storyLogline = appState.currentStoryConcept.logline || '';
        }

        // Get characters
        if (appState.projectCharacters) {
            context.characters = appState.projectCharacters.map(char => ({
                name: char.name,
                description: char.description
            }));
        }

        // Get current influences
        if (appState.influences) {
            context.influences = { ...appState.influences };
        }

        // Get template if selected
        if (appState.templateData) {
            context.template = {
                name: appState.templateData.name,
                description: appState.templateData.description
            };
        }

        return context;
    }

    /**
     * Build suggestion prompt with context and variation
     */
    buildSuggestionPrompt(suggestionType, context) {
        const config = this.suggestionTypes[suggestionType];
        
        // Story concepts need special handling - use direct prompt without extra context
        if (suggestionType === 'storyconcept') {
            let contextSummary = '';
            
            // Only add context if there are actual influences to work with
            const hasInfluences = Object.keys(context.influences).some(type => 
                context.influences[type].length > 0
            );
            
            if (hasInfluences) {
                Object.keys(context.influences).forEach(influenceType => {
                    if (context.influences[influenceType].length > 0) {
                        contextSummary += `${influenceType}: ${context.influences[influenceType].join(', ')}\n`;
                    }
                });
                
                return `${config.promptTemplate}

Consider these creative influences:
${contextSummary}

Create a fresh, original story concept that could work well with these influences. Do not explain or provide commentary - just the title and logline as requested.`;
            } else {
                // No influences - create an original concept with variety
                const genres = ['thriller', 'drama', 'dark comedy', 'horror', 'action', 'romance', 'mystery', 'family drama', 'crime', 'adventure', 'psychological drama', 'satire'];
                const settings = ['small town', 'big city', 'workplace', 'family', 'school', 'remote location', 'online world', 'sports', 'art world', 'business', 'medical', 'legal'];
                const conflicts = ['moral dilemma', 'family secret', 'professional rivalry', 'forbidden relationship', 'identity crisis', 'survival situation', 'corruption scandal', 'personal vendetta', 'unlikely partnership', 'coming-of-age', 'second chance', 'fish-out-of-water'];
                
                return `${config.promptTemplate}

Create a completely original story that avoids clichéd sci-fi concepts. Instead, focus on realistic human drama with compelling characters and situations. Consider genres like ${genres.join(', ')} and settings like ${settings.join(', ')}. Explore conflicts such as ${conflicts.join(', ')}.

Be creative and grounded. Avoid: memory manipulation, time travel, dystopian futures, chosen ones, or supernatural elements. Focus on real human experiences and relationships.

Do not explain or provide commentary - just the title and logline as requested.`;
            }
        }
        
        // Handle other suggestion types normally
        let contextSummary = '';
        
        // Build context summary
        if (context.storyTitle && context.storyLogline) {
            contextSummary += `Story: "${context.storyTitle}" - ${context.storyLogline}\n`;
        }
        
        if (context.characters.length > 0) {
            contextSummary += `Characters: ${context.characters.map(c => `${c.name} (${c.description})`).join(', ')}\n`;
        }
        
        if (context.template) {
            contextSummary += `Structure: ${context.template.name}\n`;
        }
        
        // Add current influences
        Object.keys(context.influences).forEach(influenceType => {
            if (context.influences[influenceType].length > 0) {
                contextSummary += `${influenceType}: ${context.influences[influenceType].join(', ')}\n`;
            }
        });

        const prompt = `${config.promptTemplate}.

Current Story Context:
${contextSummary}

Please suggest a ${config.outputFormat} that would complement and enhance this story concept. ${suggestionType === 'character' ? 'Provide both a name and description.' : 'Provide a single compelling suggestion.'}

Be creative and consider what would add depth, contrast, or enhancement to the existing elements. Avoid duplicating existing influences.`;

        return prompt;
    }

    /**
     * Display suggestion in modal
     */
    displaySuggestion(suggestion, suggestionType) {
        const config = this.suggestionTypes[suggestionType];
        const modal = document.getElementById('universalLibrarySaveModal');
        if (!modal) return;

        // Update form fields with suggestion
        if (config.isComplex) {
            // For character/story concept - fill both name and description
            const nameField = document.getElementById('universalLibraryEntryName');
            const descField = document.getElementById('universalLibraryEntryDescription');
            
            if (nameField) nameField.value = suggestion.name || suggestion.title || '';
            if (descField) descField.value = suggestion.description || suggestion.logline || '';
        } else {
            // For simple types - fill name field
            const nameField = document.getElementById('universalLibraryEntryName');
            if (nameField) nameField.value = suggestion.content || '';
        }

        // Update Genie button text
        const genieBtn = document.getElementById('genieSuggestBtn');
        if (genieBtn) {
            genieBtn.innerHTML = 'Replace';
        }

        // Highlight the fields briefly
        this.highlightFields();
    }



    /**
     * Update loading state
     */
    updateLoadingState(isLoading) {
        const btn = document.getElementById('genieSuggestBtn');
        if (!btn) return;

        if (isLoading) {
            btn.innerHTML = 'Genie is thinking...';
            btn.disabled = true;
        } else {
            // Restore appropriate text after thinking
            const currentText = btn.innerHTML;
            if (currentText.includes('thinking')) {
                // Keep "Replace" if we've already made a suggestion
                if (currentText.includes('thinking') && this.lastSuggestion) {
                    btn.innerHTML = 'Replace';
                } else {
                    // Check if there's existing content to determine text
                    const hasExistingContent = this.checkForExistingContent();
                    btn.innerHTML = hasExistingContent ? 'Replace' : 'Genie Suggests';
                }
            }
            btn.disabled = false;
        }
    }

    /**
     * Check if modal has existing content
     */
    checkForExistingContent() {
        const nameField = document.getElementById('universalLibraryEntryName');
        const descField = document.getElementById('universalLibraryEntryDescription');
        
        const hasName = nameField && nameField.value.trim().length > 0;
        const hasDesc = descField && descField.value.trim().length > 0;
        
        return hasName || hasDesc;
    }

    /**
     * Highlight form fields briefly
     */
    highlightFields() {
        const fields = document.querySelectorAll('#universalLibraryEntryName, #universalLibraryEntryDescription');
        fields.forEach(field => {
            field.classList.add('genie-highlight');
            setTimeout(() => {
                field.classList.remove('genie-highlight');
            }, 1000);
        });
    }
}

// Global instance
const genieSuggestions = new GenieSuggestions();

// Auto-inject Genie button when modals are shown
function initializeGenieSystem() {
    // Check if the function exists
    if (typeof window.showUniversalLibrarySaveModal === 'function') {
        // Store the original function
        const originalShowModal = window.showUniversalLibrarySaveModal;
        
        // Override with Genie injection
        window.showUniversalLibrarySaveModal = function(type, value, config, isNewEntry = false) {
            // Call original function
            originalShowModal.call(this, type, value, config, isNewEntry);
            
            // Inject Genie button after modal is created
            setTimeout(() => {
                genieSuggestions.injectGenieButton('universalLibrarySaveModal', type);
            }, 100);
        };
    } else {
        // Retry if function not found yet
        setTimeout(initializeGenieSystem, 1000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGenieSystem);
} else {
    initializeGenieSystem();
} 