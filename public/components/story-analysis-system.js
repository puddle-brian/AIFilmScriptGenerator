/**
 * Story Analysis System Component
 * Handles story concept analysis, scoring, display, improvements, and template recommendations
 * 
 * Dependencies:
 * - appState (global application state)
 * - showToast (toast notification system)
 * - showLoading/hideLoading (loading indicators)
 * - saveToLocalStorage (local storage management)
 * - buildInfluencePrompt (influence system)
 * - getCharactersForPrompt (character system)
 * - findTemplateIdByName (template system)
 * - updateInfluenceTags (tag system)
 * - updateStoryConceptDisplay (display system)
 * - updateAutoGenerateButtonVisibility (button system)
 * - displayCharacters (character display)
 * - updateCharacterTags (character tags)
 * - loadTemplates, selectTemplate, updateTemplatePageForSelection (template system)
 * - goToStep (navigation system)
 * - autoSaveManager (auto-save system)
 * 
 * @version 1.0.0
 */

// ===== STORY ANALYSIS SYSTEM =====

// NEW: AI Story Analysis Functions
async function analyzeStoryConcept() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    // Validation - need at least a story concept
    if (!appState.currentStoryConcept || !appState.currentStoryConcept.title) {
        showToast('Please create a story concept first before getting a story critique', 'error');
        return;
    }
    
    // Show loading state
    analyzeBtn.classList.add('analyze-btn-loading');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'The Genie is analyzing your story...';
    
    // Add loading animation to the icon
    const genieIcon = document.querySelector('.genie-icon-large');
    if (genieIcon) {
        genieIcon.style.animation = 'spin 1.5s linear infinite';
    }
    
    try {
        // Build the full story input with influence prompt
        const influencePrompt = buildInfluencePrompt();
        const charactersForPrompt = getCharactersForPrompt();
        
        const storyInput = {
            title: appState.currentStoryConcept.title,
            logline: appState.currentStoryConcept.logline || '',
            characters: charactersForPrompt,
            influencePrompt: influencePrompt,
            influences: appState.influences
        };
        
        const requestData = {
            storyInput: storyInput,
            projectPath: appState.projectPath
        };
        
        console.log('🔍 Sending story analysis request:', requestData);
        
        const response = await fetch('/api/analyze-story-concept', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Analysis failed');
        }
        
        const data = await response.json();
        console.log('📊 Analysis response:', data);
        
        // Store the analysis globally for apply suggestions
        window.lastAnalysis = data.analysis;
        
        displayStoryAnalysis(data.analysis, data.promptAnalyzed);
        showToast('Story critique complete! Click "View Analyzed Prompt" to see exactly what was reviewed.', 'success');
        
    } catch (error) {
        console.error('Error analyzing story concept:', error);
        showToast('Failed to analyze story concept: ' + error.message, 'error');
    } finally {
        // Reset button state
        analyzeBtn.classList.remove('analyze-btn-loading');
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Story Critique by The Genie';
        
        // Remove loading animation from the icon
        const genieIcon = document.querySelector('.genie-icon-large');
        if (genieIcon) {
            genieIcon.style.animation = '';
        }
    }
}

function displayStoryAnalysis(analysis, promptAnalyzed = null) {
    const resultsContainer = document.getElementById('storyAnalysisResults');
    const contentContainer = document.getElementById('analysisContent');
    
    // Store the analyzed prompt for modal display
    window.lastAnalyzedPrompt = promptAnalyzed;
    
    // Build the analysis display HTML
    const overallScoreClass = getScoreClass(analysis.overallScore);
    const readinessClass = analysis.readinessForGeneration.toLowerCase();
    
    contentContainer.innerHTML = `
        <div class="analysis-overall-score">
            <div class="score-circle ${overallScoreClass}">${analysis.overallScore}/10</div>
            <div class="readiness-badge ${readinessClass}">${analysis.readinessForGeneration} Readiness</div>
        </div>
        
        ${analysis.genieCommentary ? `
        <div class="genie-commentary">
            <div class="genie-commentary-header">
                <img src="/askthegenie_black.png" alt="The Genie" class="genie-icon-medium">
                <h4>The Genie Speaks</h4>
            </div>
            <div class="genie-commentary-text">${analysis.genieCommentary}</div>
        </div>
        ` : ''}
        
        ${analysis.dealbreakers && analysis.dealbreakers.length > 0 ? `
        <div class="analysis-dealbreakers">
            <h4>🚨 Critical Issues</h4>
            <ul>
                ${analysis.dealbreakers.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${analysis.strengths && analysis.strengths.length > 0 ? `
        <div class="analysis-strengths">
            <h4>✅ Unique Strengths</h4>
            <ul>
                ${analysis.strengths.map(strength => `<li>${strength}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div class="analysis-section">
            <div class="analysis-section-header">
                <h4>📖 Story Concept</h4>
                <div class="analysis-score">
                    <div class="score-bar">
                        <div class="score-fill ${getScoreClass(analysis.storyConceptAnalysis.originality)}" 
                             style="width: ${analysis.storyConceptAnalysis.originality * 10}%"></div>
                    </div>
                    <span class="score-number">${analysis.storyConceptAnalysis.originality}/10</span>
                </div>
            </div>
            <div class="analysis-feedback">${analysis.storyConceptAnalysis.feedback}</div>
        </div>
        
        <div class="analysis-section">
            <div class="analysis-section-header">
                <h4>👥 Characters</h4>
                <div class="analysis-score">
                    <div class="score-bar">
                        <div class="score-fill ${getScoreClass(analysis.characterAnalysis.distinctiveness)}" 
                             style="width: ${analysis.characterAnalysis.distinctiveness * 10}%"></div>
                    </div>
                    <span class="score-number">${analysis.characterAnalysis.distinctiveness}/10</span>
                </div>
            </div>
            <div class="analysis-feedback">${analysis.characterAnalysis.feedback}</div>
        </div>
        
        <div class="analysis-section">
            <div class="analysis-section-header">
                <h4>🎨 Creative Influences</h4>
                <div class="analysis-score">
                    <div class="score-bar">
                        <div class="score-fill ${getScoreClass(analysis.influenceAnalysis.coherence)}" 
                             style="width: ${analysis.influenceAnalysis.coherence * 10}%"></div>
                    </div>
                    <span class="score-number">${analysis.influenceAnalysis.coherence}/10</span>
                </div>
            </div>
            <div class="analysis-feedback">${analysis.influenceAnalysis.feedback}</div>
        </div>
        
        <div class="analysis-section">
            <div class="analysis-section-header">
                <h4>🎭 Tone & Atmosphere</h4>
                <div class="analysis-score">
                    <div class="score-bar">
                        <div class="score-fill ${getScoreClass(analysis.toneAnalysis.execution)}" 
                             style="width: ${analysis.toneAnalysis.execution * 10}%"></div>
                    </div>
                    <span class="score-number">${analysis.toneAnalysis.execution}/10</span>
                </div>
            </div>
            <div class="analysis-feedback">${analysis.toneAnalysis.feedback}</div>
        </div>
        
        <div class="analysis-section">
            <div class="analysis-section-header">
                <h4>🏆 Award Potential</h4>
                <div class="analysis-score">
                    <div class="score-bar">
                        <div class="score-fill ${getScoreClass(analysis.exceptionalPotential.score)}" 
                             style="width: ${analysis.exceptionalPotential.score * 10}%"></div>
                    </div>
                    <span class="score-number">${analysis.exceptionalPotential.score}/10</span>
                </div>
            </div>
            <div class="analysis-feedback">${analysis.exceptionalPotential.feedback}</div>
        </div>
        
        ${analysis.criticalWeaknesses && analysis.criticalWeaknesses.length > 0 ? `
        <div class="analysis-section">
            <h4>⚠️ Critical Weaknesses</h4>
            <ul>
                ${analysis.criticalWeaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${analysis.templateRecommendation ? `
        <div class="analysis-section">
            <div class="analysis-section-header">
                <h4>📋 Template Recommendation</h4>
                <div class="analysis-score">
                    <div class="score-bar">
                        <div class="score-fill ${getScoreClass(analysis.templateRecommendation.confidence)}" 
                             style="width: ${analysis.templateRecommendation.confidence * 10}%"></div>
                    </div>
                    <span class="score-number">${analysis.templateRecommendation.confidence}/10</span>
                </div>
            </div>
            <div class="recommended-template-name">${analysis.templateRecommendation.recommendedTemplate}</div>
            <div class="analysis-feedback">${analysis.templateRecommendation.reasoning}</div>
            ${analysis.templateRecommendation.alternativeOptions && analysis.templateRecommendation.alternativeOptions.length > 0 ? `
            <div class="template-alternatives">
                <h5>Alternative Templates:</h5>
                <ul>
                    ${analysis.templateRecommendation.alternativeOptions.map(alt => `<li>${alt}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            <button class="btn btn-primary" onclick="applyRecommendedTemplate('${analysis.templateRecommendation.recommendedTemplate}')">
                Apply Recommended Template
            </button>
        </div>
        ` : ''}
        
        <div class="analysis-actions">
            <button id="applySuggestionsBtn" class="btn btn-secondary" onclick="applySuggestions()">Apply the Genie's Wisdom</button>
            <button class="btn btn-outline" onclick="hideStoryAnalysis()">Close Analysis</button>
        </div>
    `;
    
    // Show the results
    resultsContainer.style.display = 'block';
    
    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Apply recommended template from AI feedback
async function applyRecommendedTemplate(templateName) {
    try {
        // Find the template ID by name
        const templateId = findTemplateIdByName(templateName);
        
        if (!templateId) {
            showToast(`Template "${templateName}" not found`, 'error');
            return;
        }
        
        // Load and select the template
        await loadTemplates();
        selectTemplate(templateId);
        
        // Update the UI and project state
        updateTemplatePageForSelection();
        
        // Auto-save the change
        if (window.autoSaveManager) {
            window.autoSaveManager.markDirty();
        }
        
        // Show success message
        showToast(`Applied recommended template: ${templateName}`, 'success');
        
        // Directly navigate to Step 2 to review the selected template
        await goToStep(2);
        
    } catch (error) {
        console.error('Error applying recommended template:', error);
        showToast('Failed to apply recommended template', 'error');
    }
}

function getScoreClass(score) {
    if (score >= 8) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
}

function hideStoryAnalysis() {
    const resultsContainer = document.getElementById('storyAnalysisResults');
    resultsContainer.style.display = 'none';
}

// Analyzed Prompt Modal Functions
function showAnalyzedPromptModal() {
    const modal = document.getElementById('analyzedPromptModal');
    const promptText = document.getElementById('analyzedPromptText');
    const templateInfo = document.getElementById('templateInfo');
    const templateDetails = document.getElementById('templateDetails');
    
    if (window.lastAnalyzedPrompt) {
        promptText.textContent = window.lastAnalyzedPrompt;
        modal.style.display = 'block';
        
        // Show template info if available
        if (window.lastAnalyzedTemplate) {
            templateInfo.style.display = 'block';
            templateDetails.innerHTML = `
                <p><strong>Template:</strong> ${window.lastAnalyzedTemplate.name}</p>
                <p><strong>Description:</strong> ${window.lastAnalyzedTemplate.description}</p>
                <p><strong>Category:</strong> ${window.lastAnalyzedTemplate.category}</p>
            `;
        } else {
            templateInfo.style.display = 'none';
        }
    } else {
        showToast('No analyzed prompt available', 'error');
    }
}

function hideAnalyzedPromptModal() {
    const modal = document.getElementById('analyzedPromptModal');
    modal.style.display = 'none';
}

function copyAnalyzedPrompt() {
    const promptText = document.getElementById('analyzedPromptText');
    if (promptText.textContent) {
        navigator.clipboard.writeText(promptText.textContent).then(() => {
            showToast('Prompt copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy prompt:', err);
            showToast('Failed to copy prompt', 'error');
        });
    }
}

// Apply AI Suggestions Functions
async function applySuggestions() {
    const btn = document.getElementById('applySuggestionsBtn');
    
    if (!window.lastAnalysis || !appState.storyInput) {
        showToast('Missing analysis data or story input', 'error');
        return;
    }

    try {
        // Update button state
        btn.disabled = true;
        btn.textContent = 'Genie at Work...';
        btn.classList.add('loading');

        // Call the backend API
        const response = await fetch('/api/apply-suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': appState.apiKey
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                analysisResult: window.lastAnalysis
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success) {
            // Store the improvements for the preview modal
            window.lastImprovements = result.improvements;
            window.originalStory = result.originalStory;
            
            // Show the preview modal
            showImprovementPreviewModal(result.improvements, result.originalStory);
            
            showToast('Story improvements generated successfully!', 'success');
        } else {
            throw new Error(result.error || 'Failed to apply suggestions');
        }

    } catch (error) {
        console.error('Error applying suggestions:', error);
        showToast('Failed to apply suggestions: ' + error.message, 'error');
    } finally {
        // Reset button state
        btn.disabled = false;
        btn.textContent = 'Apply the Genie\'s Wisdom';
        btn.classList.remove('loading');
    }
}

function showImprovementPreviewModal(improvements, originalStory) {
    const modal = document.getElementById('improvementPreviewModal');
    const content = document.getElementById('improvementPreviewContent');
    
    content.innerHTML = `
        <div class="improvement-comparison">
            <div class="comparison-header">
                <h3>📝 Story Improvements Preview</h3>
                <p>Review the AI's suggested changes before applying them to your story.</p>
            </div>
            
            <div class="improvement-section">
                <h4>📚 Title</h4>
                <div class="comparison-box">
                    <div class="before-after">
                        <div class="before">
                            <label>Current:</label>
                            <div class="content">${originalStory.title}</div>
                        </div>
                        <div class="after">
                            <label>Improved:</label>
                            <div class="content">${improvements.improvedTitle}</div>
                        </div>
                    </div>
                    <div class="change-controls">
                        <label>
                            <input type="checkbox" checked data-field="title">
                            Apply this change
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="improvement-section">
                <h4>📖 Logline</h4>
                <div class="comparison-box">
                    <div class="before-after">
                        <div class="before">
                            <label>Current:</label>
                            <div class="content">${originalStory.logline}</div>
                        </div>
                        <div class="after">
                            <label>Improved:</label>
                            <div class="content">${improvements.improvedLogline}</div>
                        </div>
                    </div>
                    <div class="change-controls">
                        <label>
                            <input type="checkbox" checked data-field="logline">
                            Apply this change
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="improvement-section">
                <h4>👥 Characters</h4>
                <div class="comparison-box">
                    <div class="before-after">
                        <div class="before">
                            <label>Current:</label>
                            <div class="content">${originalStory.characters || 'No characters specified'}</div>
                        </div>
                        <div class="after">
                            <label>Improved:</label>
                            <div class="content">${improvements.improvedCharacters}</div>
                        </div>
                    </div>
                    <div class="change-controls">
                        <label>
                            <input type="checkbox" checked data-field="characters">
                            Apply this change
                        </label>
                    </div>
                </div>
            </div>
            
            ${improvements.improvedInfluences ? `
            <div class="improvement-section">
                <h4>🎨 Improved Influences</h4>
                <div class="comparison-box">
                    <div class="improvement-content">
                        ${improvements.improvedInfluences.directors && improvements.improvedInfluences.directors.length > 0 ? `
                        <div class="influence-group">
                            <label>Directors:</label>
                            <ul>${improvements.improvedInfluences.directors.map(dir => `<li>${dir}</li>`).join('')}</ul>
                        </div>
                        ` : ''}
                        ${improvements.improvedInfluences.screenwriters && improvements.improvedInfluences.screenwriters.length > 0 ? `
                        <div class="influence-group">
                            <label>Screenwriters:</label>
                            <ul>${improvements.improvedInfluences.screenwriters.map(sw => `<li>${sw}</li>`).join('')}</ul>
                        </div>
                        ` : ''}
                        ${improvements.improvedInfluences.films && improvements.improvedInfluences.films.length > 0 ? `
                        <div class="influence-group">
                            <label>Films:</label>
                            <ul>${improvements.improvedInfluences.films.map(film => `<li>${film}</li>`).join('')}</ul>
                        </div>
                        ` : ''}
                    </div>
                    <div class="change-controls">
                        <label>
                            <input type="checkbox" checked data-field="improvedInfluences">
                            Apply these improved influences
                        </label>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${improvements.suggestedNewCharacters && improvements.suggestedNewCharacters.length > 0 ? `
            <div class="improvement-section">
                <h4>👤 New Character Suggestions</h4>
                <div class="comparison-box">
                    <div class="improvement-content">
                        ${improvements.suggestedNewCharacters.map(char => `
                        <div class="new-character">
                            <strong>${char.name}</strong>: ${char.description}
                        </div>
                        `).join('')}
                    </div>
                    <div class="change-controls">
                        <label>
                            <input type="checkbox" checked data-field="suggestedNewCharacters">
                            Add these new characters
                        </label>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${improvements.suggestedNewInfluences ? `
            <div class="improvement-section">
                <h4>🎬 New Influence Suggestions</h4>
                <div class="comparison-box">
                    <div class="improvement-content">
                        ${improvements.suggestedNewInfluences.directors && improvements.suggestedNewInfluences.directors.length > 0 ? `
                        <div class="influence-group">
                            <label>New Directors:</label>
                            <ul>${improvements.suggestedNewInfluences.directors.map(dir => `<li>${dir}</li>`).join('')}</ul>
                        </div>
                        ` : ''}
                        ${improvements.suggestedNewInfluences.screenwriters && improvements.suggestedNewInfluences.screenwriters.length > 0 ? `
                        <div class="influence-group">
                            <label>New Screenwriters:</label>
                            <ul>${improvements.suggestedNewInfluences.screenwriters.map(sw => `<li>${sw}</li>`).join('')}</ul>
                        </div>
                        ` : ''}
                        ${improvements.suggestedNewInfluences.films && improvements.suggestedNewInfluences.films.length > 0 ? `
                        <div class="influence-group">
                            <label>New Films:</label>
                            <ul>${improvements.suggestedNewInfluences.films.map(film => `<li>${film}</li>`).join('')}</ul>
                        </div>
                        ` : ''}
                    </div>
                    <div class="change-controls">
                        <label>
                            <input type="checkbox" checked data-field="suggestedNewInfluences">
                            Add these new influences
                        </label>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="improvement-actions">
                <button class="btn btn-primary" onclick="applySelectedImprovements()">Apply Selected Changes</button>
                <button class="btn btn-outline" onclick="hideImprovementPreviewModal()">Cancel</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function hideImprovementPreviewModal() {
    const modal = document.getElementById('improvementPreviewModal');
    modal.style.display = 'none';
}

function applySelectedImprovements() {
    if (!window.lastImprovements || !window.originalStory) {
        showToast('Missing improvement data', 'error');
        return;
    }

    const checkboxes = document.querySelectorAll('#improvementPreviewContent input[type="checkbox"]');
    const improvements = window.lastImprovements;
    
    // Apply only selected improvements
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const field = checkbox.dataset.field;
            
            switch(field) {
                case 'title':
                    if (improvements.improvedTitle !== window.originalStory.title) {
                        // Update the current story concept
                        if (appState.currentStoryConcept) {
                            appState.currentStoryConcept.title = improvements.improvedTitle;
                        }
                        // Update story input
                        if (appState.storyInput) {
                            appState.storyInput.title = improvements.improvedTitle;
                        }
                    }
                    break;
                case 'logline':
                    if (improvements.improvedLogline !== window.originalStory.logline) {
                        // Update the current story concept
                        if (appState.currentStoryConcept) {
                            appState.currentStoryConcept.logline = improvements.improvedLogline;
                        }
                        // Update story input
                        if (appState.storyInput) {
                            appState.storyInput.logline = improvements.improvedLogline;
                        }
                    }
                    break;
                case 'characters':
                    if (improvements.improvedCharacters !== (window.originalStory.characters || '')) {
                        // Update characters in the appropriate format
                        if (appState.storyInput) {
                            appState.storyInput.characters = improvements.improvedCharacters;
                        }
                        
                        // Update the influence prompt and display
                        buildInfluencePrompt();
                    }
                    break;
                case 'improvedInfluences':
                    if (improvements.improvedInfluences) {
                        // Replace existing influences with improved versions
                        if (!appState.influences) appState.influences = {};
                        
                        if (improvements.improvedInfluences.directors) {
                            appState.influences.directors = improvements.improvedInfluences.directors;
                        }
                        if (improvements.improvedInfluences.screenwriters) {
                            appState.influences.screenwriters = improvements.improvedInfluences.screenwriters;
                        }
                        if (improvements.improvedInfluences.films) {
                            appState.influences.films = improvements.improvedInfluences.films;
                        }
                        
                        // Update story input and influence prompt
                        if (appState.storyInput) {
                            appState.storyInput.influences = appState.influences;
                            appState.storyInput.influencePrompt = buildInfluencePrompt();
                        }
                        
                        // Update UI displays
                        updateInfluenceTags('director');
                        updateInfluenceTags('screenwriter');
                        updateInfluenceTags('film');
                    }
                    break;
                case 'suggestedNewCharacters':
                    if (improvements.suggestedNewCharacters && improvements.suggestedNewCharacters.length > 0) {
                        // Add new characters to the character list
                        if (!appState.projectCharacters) appState.projectCharacters = [];
                        
                        improvements.suggestedNewCharacters.forEach(char => {
                            appState.projectCharacters.push({
                                name: char.name,
                                description: char.description
                            });
                        });
                        
                        // Update displays
                        displayCharacters();
                        updateCharacterTags();
                        
                        // Update story input
                        if (appState.storyInput) {
                            appState.storyInput.characters = getCharactersForPrompt();
                        }
                    }
                    break;
                case 'suggestedNewInfluences':
                    if (improvements.suggestedNewInfluences) {
                        // Add new influences to existing lists
                        if (!appState.influences) appState.influences = {};
                        
                        if (improvements.suggestedNewInfluences.directors) {
                            if (!appState.influences.directors) appState.influences.directors = [];
                            appState.influences.directors.push(...improvements.suggestedNewInfluences.directors);
                        }
                        if (improvements.suggestedNewInfluences.screenwriters) {
                            if (!appState.influences.screenwriters) appState.influences.screenwriters = [];
                            appState.influences.screenwriters.push(...improvements.suggestedNewInfluences.screenwriters);
                        }
                        if (improvements.suggestedNewInfluences.films) {
                            if (!appState.influences.films) appState.influences.films = [];
                            appState.influences.films.push(...improvements.suggestedNewInfluences.films);
                        }
                        
                        // Update story input and influence prompt
                        if (appState.storyInput) {
                            appState.storyInput.influences = appState.influences;
                            appState.storyInput.influencePrompt = buildInfluencePrompt();
                        }
                        
                        // Update UI displays
                        updateInfluenceTags('director');
                        updateInfluenceTags('screenwriter');
                        updateInfluenceTags('film');
                    }
                    break;
            }
        }
    });

    // Hide the modal
    hideImprovementPreviewModal();
    
    // Update displays
    updateStoryConceptDisplay();
    updateAutoGenerateButtonVisibility();
    
    // Show success message
    showToast('Story improvements applied successfully!', 'success');
    
    // Auto-save if available
    if (window.autoSaveManager) {
        window.autoSaveManager.markDirty();
    }
}

// ===== GLOBAL WRAPPER FUNCTIONS FOR BACKWARD COMPATIBILITY =====

// Make all functions globally accessible
window.analyzeStoryConcept = analyzeStoryConcept;
window.displayStoryAnalysis = displayStoryAnalysis;
window.applyRecommendedTemplate = applyRecommendedTemplate;
window.getScoreClass = getScoreClass;
window.hideStoryAnalysis = hideStoryAnalysis;
window.showAnalyzedPromptModal = showAnalyzedPromptModal;
window.hideAnalyzedPromptModal = hideAnalyzedPromptModal;
window.copyAnalyzedPrompt = copyAnalyzedPrompt;
window.applySuggestions = applySuggestions;
window.showImprovementPreviewModal = showImprovementPreviewModal;
window.hideImprovementPreviewModal = hideImprovementPreviewModal;
window.applySelectedImprovements = applySelectedImprovements;

console.log('✅ Story Analysis System component loaded successfully'); 