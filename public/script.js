// Global state management
const appState = {
    currentStep: 1,
    storyInput: {},
    selectedTemplate: null,
    templateData: null,
    generatedStructure: null,
    generatedScenes: null,
    generatedDialogues: {},
    projectId: null,
    availableTemplates: [],
    influences: {
        directors: [],
        screenwriters: [],
        films: []
    }
};

// DOM Elements
const elements = {
    progressFill: document.getElementById('progressFill'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// Influence Management Functions
function addInfluence(type) {
    const selectElement = document.getElementById(`${type}Select`);
    const customInput = document.getElementById(`custom${type.charAt(0).toUpperCase() + type.slice(1)}`);
    
    let value = '';
    if (selectElement.value) {
        value = selectElement.value;
        selectElement.value = '';
    } else if (customInput.value.trim()) {
        value = customInput.value.trim();
        customInput.value = '';
    }
    
    if (value && !appState.influences[type + 's'].includes(value)) {
        appState.influences[type + 's'].push(value);
        updateInfluenceTags(type);
        saveToLocalStorage();
    }
}

function removeInfluence(type, value) {
    const index = appState.influences[type + 's'].indexOf(value);
    if (index > -1) {
        appState.influences[type + 's'].splice(index, 1);
        updateInfluenceTags(type);
        saveToLocalStorage();
    }
}

function updateInfluenceTags(type) {
    const container = document.getElementById(`${type}Tags`);
    container.innerHTML = '';
    
    appState.influences[type + 's'].forEach(influence => {
        const tag = document.createElement('div');
        tag.className = 'influence-tag';
        tag.innerHTML = `
            <span>${influence}</span>
            <button type="button" class="remove-tag" onclick="removeInfluence('${type}', '${influence.replace(/'/g, "\\'")}')">×</button>
        `;
        container.appendChild(tag);
    });
}

function buildInfluencePrompt() {
    let prompt = '';
    
    if (appState.influences.directors.length > 0) {
        prompt += `In the directorial style of ${appState.influences.directors.join(', ')}, `;
    }
    
    if (appState.influences.screenwriters.length > 0) {
        prompt += `with screenplay influences from ${appState.influences.screenwriters.join(', ')}, `;
    }
    
    if (appState.influences.films.length > 0) {
        prompt += `drawing inspiration from films like ${appState.influences.films.join(', ')}, `;
    }
    
    return prompt;
}

// Auto-generation for debugging
function autoGenerate() {
    // Mad libs style logline generation
    const protagonists = [
        "a reclusive artist", "an aging professor", "a young immigrant", "a former dancer", 
        "a night shift worker", "a small-town librarian", "a retired diplomat", "a street musician",
        "a documentary filmmaker", "an insomniac translator", "a funeral director", "a lighthouse keeper"
    ];
    
    const situations = [
        "discovers a hidden room in their apartment", "receives mysterious letters from a stranger",
        "witnesses a crime that may not have happened", "inherits a peculiar family heirloom",
        "becomes obsessed with a neighbor's routine", "finds old film reels in their basement",
        "starts hearing voices from the past", "encounters their doppelganger",
        "begins losing memories of their childhood", "discovers they're being followed",
        "finds a diary that predicts the future", "becomes convinced time is moving backward"
    ];
    
    const consequences = [
        "questioning the nature of reality", "confronting buried family secrets",
        "unraveling a decades-old mystery", "facing their deepest fears",
        "discovering they're not who they thought they were", "realizing nothing is as it seems",
        "confronting the ghosts of their past", "questioning their own sanity",
        "uncovering a conspiracy that involves them", "learning the truth about their identity"
    ];
    
    const protagonist = protagonists[Math.floor(Math.random() * protagonists.length)];
    const situation = situations[Math.floor(Math.random() * situations.length)];
    const consequence = consequences[Math.floor(Math.random() * consequences.length)];
    
    const logline = `${protagonist.charAt(0).toUpperCase() + protagonist.slice(1)} ${situation}, leading to ${consequence}.`;
    
    // Random character combinations
    const characterTypes = [
        "An introspective protagonist struggling with isolation and memory",
        "A mysterious neighbor who may or may not exist",
        "An elderly relative harboring family secrets",
        "A younger character representing lost innocence",
        "A figure from the past who haunts the present",
        "An authority figure who cannot be trusted",
        "A lover or former lover who embodies desire and loss",
        "A child who sees things adults cannot"
    ];
    
    const shuffledCharacters = [...characterTypes].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 2);
    const characters = shuffledCharacters.join("; ");
    
    // Random title generation
    const titleWords1 = ["The", "A", "Last", "First", "Hidden", "Lost", "Silent", "Broken", "Empty", "Distant"];
    const titleWords2 = ["Room", "Mirror", "Letter", "Dance", "Memory", "Portrait", "Garden", "Window", "Shadow", "Dream"];
    const title = `${titleWords1[Math.floor(Math.random() * titleWords1.length)]} ${titleWords2[Math.floor(Math.random() * titleWords2.length)]}`;
    
    // Random influences
    const allDirectors = [
        "Ingmar Bergman", "Akira Kurosawa", "Federico Fellini", "Jean-Luc Godard", "Andrei Tarkovsky",
        "Luis Buñuel", "Michelangelo Antonioni", "François Truffaut", "Vittorio De Sica", "Yasujirō Ozu",
        "Robert Bresson", "Krzysztof Kieślowski", "Agnès Varda", "Chantal Akerman", "Wong Kar-wai",
        "Abbas Kiarostami", "Béla Tarr", "Apichatpong Weerasethakul"
    ];
    
    const allScreenwriters = [
        "Cesare Zavattini (Bicycle Thieves, Umberto D)", "Suso Cecchi d'Amico (Rocco and His Brothers, 8½)",
        "Jean-Claude Carrière (Belle de Jour, The Discreet Charm)", "Tonino Guerra (L'Avventura, Amarcord)",
        "Krzysztof Piesiewicz (Dekalog, Three Colors)", "Marguerite Duras (Hiroshima Mon Amour, India Song)",
        "Alain Robbe-Grillet (Last Year at Marienbad)", "Paul Schrader (Taxi Driver, Raging Bull)",
        "Charlie Kaufman (Being John Malkovich, Synecdoche)", "Céline Sciamma (Portrait of a Lady on Fire)"
    ];
    
    const allFilms = [
        "8½ (1963)", "Persona (1966)", "Bicycle Thieves (1948)", "Breathless (1960)", "Rashomon (1950)",
        "L'Avventura (1960)", "The 400 Blows (1959)", "Tokyo Story (1953)", "Stalker (1979)", "Vertigo (1958)",
        "Mulholland Drive (2001)", "In the Mood for Love (2000)", "Jeanne Dielman (1975)", "The Mirror (1975)",
        "Cléo from 5 to 7 (1962)", "Taste of Cherry (1997)", "Sátántangó (1994)", "Tropical Malady (2004)"
    ];
    
    const tones = [
        "Contemplative/Meditative", "Psychological Intensity", "Existential Angst", "Poetic Realism",
        "Surreal/Dreamlike", "Social Commentary", "Intimate/Chamber", "Experimental/Avant-garde",
        "Melancholic Beauty", "Philosophical Inquiry"
    ];
    
    // Clear existing influences
    appState.influences = { directors: [], screenwriters: [], films: [] };
    
    // Add random influences (1-3 of each type)
    const randomDirectors = [...allDirectors].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomScreenwriters = [...allScreenwriters].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomFilms = [...allFilms].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    
    appState.influences.directors = randomDirectors;
    appState.influences.screenwriters = randomScreenwriters;
    appState.influences.films = randomFilms;
    
    // Populate form fields
    document.getElementById('title').value = title;
    document.getElementById('logline').value = logline;
    document.getElementById('characters').value = characters;
    document.getElementById('totalScenes').value = Math.floor(Math.random() * 50) + 40; // 40-90 scenes
    document.getElementById('tone').value = tones[Math.floor(Math.random() * tones.length)];
    
    // Update influence tags
    updateInfluenceTags('director');
    updateInfluenceTags('screenwriter');
    updateInfluenceTags('film');
    
    console.log('Auto-generated story concept:', {
        title,
        logline,
        characters,
        influences: appState.influences
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
    setupEventListeners();
    loadTemplates();
});

// Initialize application
async function initializeApp() {
    updateProgressBar();
    updateStepIndicators();
    
    // Load from localStorage if available
    const savedState = localStorage.getItem('filmScriptGenerator');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            Object.assign(appState, parsed);
            
            // If we have a loaded project path, restore the full project
            if (appState.projectPath && appState.isLoadedProject) {
                console.log('Restoring loaded project from localStorage:', appState.projectPath);
                try {
                    await restoreLoadedProject();
                } catch (error) {
                    console.error('Error restoring loaded project:', error);
                    // Clear the invalid project state
                    appState.projectPath = null;
                    appState.isLoadedProject = false;
                    saveToLocalStorage();
                }
            } else if (appState.currentStep > 1) {
                goToStep(appState.currentStep);
            }
        } catch (e) {
            console.error('Error loading saved state:', e);
        }
    }
}

// Restore a loaded project from localStorage on page reload
async function restoreLoadedProject() {
    if (!appState.projectPath) {
        throw new Error('No project path to restore');
    }
    
    console.log('Restoring project:', appState.projectPath);
    const response = await fetch(`/api/load-project/${encodeURIComponent(appState.projectPath)}`);
    
    if (!response.ok) {
        throw new Error(`Failed to restore project: ${response.status} ${response.statusText}`);
    }
    
    const projectData = await response.json();
    console.log('Project data restored:', projectData);
    
    // Populate the form with the restored project data
    await populateFormWithProject(projectData, false, true); // Don't show toast on restore, isRestore = true
}

// Setup event listeners
function setupEventListeners() {
    // Story form submission
    document.getElementById('storyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleStorySubmission();
    });
    
    // Auto-save on form changes
    const formInputs = document.querySelectorAll('#storyForm input, #storyForm select, #storyForm textarea');
    formInputs.forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
    });
}

// Handle story form submission
function handleStorySubmission() {
    const form = document.getElementById('storyForm');
    const formData = new FormData(form);
    
    appState.storyInput = {
        title: formData.get('title'),
        logline: formData.get('logline'),
        characters: formData.get('characters'),
        tone: formData.get('tone'),
        totalScenes: parseInt(formData.get('totalScenes')) || 70,
        influences: appState.influences,
        influencePrompt: buildInfluencePrompt()
    };
    
    saveToLocalStorage();
    goToStep(2);
}

// Load available templates
async function loadTemplates() {
    try {
        showLoading('Loading templates...');
        const response = await fetch('/api/templates');
        const templates = await response.json();
        
        appState.availableTemplates = templates;
        displayTemplates(templates);
        hideLoading();
    } catch (error) {
        console.error('Error loading templates:', error);
        showToast('Error loading templates. Please refresh the page.', 'error');
        hideLoading();
    }
}

// Display template options
function displayTemplates(templates) {
    const container = document.getElementById('templateOptions');
    container.innerHTML = '';
    
    templates.forEach(template => {
        const templateElement = document.createElement('div');
        templateElement.className = 'template-option';
        templateElement.dataset.templateId = template.id;
        templateElement.innerHTML = `
            <h3>${template.name}</h3>
            <p>${template.description}</p>
        `;
        
        templateElement.addEventListener('click', () => selectTemplate(template.id));
        container.appendChild(templateElement);
    });
}

// Select template
function selectTemplate(templateId) {
    // Remove previous selection
    document.querySelectorAll('.template-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to clicked template
    document.querySelector(`[data-template-id="${templateId}"]`).classList.add('selected');
    
    appState.selectedTemplate = templateId;
    document.getElementById('selectTemplateBtn').disabled = false;
    saveToLocalStorage();
}

// Generate structure
async function generateStructure() {
    if (!appState.selectedTemplate || !appState.storyInput) {
        showToast('Please complete the previous steps first.', 'error');
        return;
    }
    
    try {
        showLoading('Generating plot structure...');
        
        const response = await fetch('/api/generate-structure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                storyInput: appState.storyInput,
                template: appState.selectedTemplate
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.generatedStructure = data.structure;
            appState.templateData = data.template;
            appState.projectId = data.projectId;
            appState.projectPath = data.projectPath;
            displayStructure(data.structure);
            goToStep(3);
            showToast('Plot structure generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate structure');
        }
        
        hideLoading();
        saveToLocalStorage();
    } catch (error) {
        console.error('Error generating structure:', error);
        showToast('Error generating structure. Please try again.', 'error');
        hideLoading();
    }
}

// Display generated structure
function displayStructure(structure) {
    const container = document.getElementById('structureContent');
    container.innerHTML = '';
    
    Object.entries(structure).forEach(([key, element]) => {
        if (typeof element === 'object' && element.name) {
            const structureElement = document.createElement('div');
            structureElement.className = 'structure-element';
            structureElement.innerHTML = `
                <h3>${element.name || key}</h3>
                <p>${element.description || 'No description available'}</p>
                ${element.elements ? `
                    <div class="elements">
                        ${element.elements.map(el => `<span class="element-tag">${el}</span>`).join('')}
                    </div>
                ` : ''}
            `;
            container.appendChild(structureElement);
        }
    });
}

// Regenerate structure
async function regenerateStructure() {
    await generateStructure();
}

// Approve structure and generate scenes
async function approveStructure() {
    if (!appState.generatedStructure) {
        showToast('No structure to approve.', 'error');
        return;
    }
    
    try {
        showLoading('Generating scenes...');
        
        // Use the simple scenes generation endpoint instead of the AI-powered one
        const response = await fetch(`/api/regenerate-scenes-simple/${appState.projectPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Convert the simple scenes format to the format expected by displayScenes
            const convertedScenes = {};
            Object.entries(data.scenes).forEach(([key, value]) => {
                convertedScenes[key] = value.scenes; // Extract the scenes array from the nested structure
            });
            
            appState.generatedScenes = convertedScenes;
            displayScenes(convertedScenes);
            goToStep(4);
            showToast('Scenes generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate scenes');
        }
        
        hideLoading();
        saveToLocalStorage();
    } catch (error) {
        console.error('Error generating scenes:', error);
        showToast('Error generating scenes. Please try again.', 'error');
        hideLoading();
    }
}

// Display generated scenes with individual generation buttons
function displayScenes(scenes) {
    console.log('displayScenes called with:', scenes);
    console.log('appState.generatedStructure:', appState.generatedStructure);
    
    const container = document.getElementById('scenesContent');
    if (!container) {
        console.error('scenesContent container not found!');
        return;
    }
    console.log('Found scenesContent container, clearing it');
    container.innerHTML = '';
    
    // If we have a structure, show each structural element with generate buttons
    if (appState.generatedStructure) {
        console.log('Creating scene groups for structure elements...');
        Object.entries(appState.generatedStructure).forEach(([structureKey, structureElement]) => {
            console.log(`Processing structure element: ${structureKey}`, structureElement);
            
            const groupElement = document.createElement('div');
            groupElement.className = 'scene-group';
            
            const hasScenes = scenes[structureKey] && Array.isArray(scenes[structureKey]);
            const sceneCount = hasScenes ? scenes[structureKey].length : 0;
            
            console.log(`${structureKey}: hasScenes=${hasScenes}, sceneCount=${sceneCount}`);
            
            groupElement.innerHTML = `
                <div class="scene-group-header">
                    <h3>${structureElement.name || structureKey.replace(/_/g, ' ').toUpperCase()}</h3>
                </div>
                <div class="structure-description">
                    <p><strong>Description:</strong> ${structureElement.description}</p>
                    ${structureElement.character_development ? `<p><strong>Character Development:</strong> ${structureElement.character_development}</p>` : ''}
                </div>
                <div id="scenes-${structureKey}" class="scenes-container">
                    ${hasScenes ? '' : '<p class="no-scenes">No scenes generated yet. Individual scenes will appear here as you generate them.</p>'}
                </div>
            `;
            
            console.log(`Appending group element for ${structureKey} to container`);
            container.appendChild(groupElement);
            
            // Display existing scenes if any
            if (hasScenes) {
                console.log(`Displaying ${sceneCount} scenes for ${structureKey}`);
                displayScenesForElement(structureKey, scenes[structureKey]);
            }
        });
        console.log('Finished creating all scene groups');
    } else {
        console.log('No structure available - showing fallback message');
        container.innerHTML = '<p>No structure available. Please generate a structure first.</p>';
    }
}

// Display scenes for a specific structural element
function displayScenesForElement(structureKey, sceneGroup) {
    const container = document.getElementById(`scenes-${structureKey}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (Array.isArray(sceneGroup)) {
        sceneGroup.forEach((scene, index) => {
            const sceneElement = document.createElement('div');
            sceneElement.className = 'scene-item';
            sceneElement.innerHTML = `
                <h4>
                    <span class="scene-number">Scene ${index + 1}</span>
                    ${scene.title || scene.name || 'Untitled Scene'}
                    <div class="scene-actions">
                        <button class="btn btn-primary btn-sm generate-scene-btn" onclick="generateIndividualScene('${structureKey}', ${index})" title="Regenerate this specific scene">
                            🔄 Regenerate Scene
                        </button>
                        <button class="btn btn-secondary btn-sm generate-plot-btn" onclick="generatePlotPoint('${structureKey}', ${index})" title="Generate plot point for this scene">
                            📋 ${scene.plot_point ? 'Regenerate Plot Point' : 'Generate Plot Point'}
                        </button>
                    </div>
                </h4>
                <div class="scene-meta">
                    <span><strong>Location:</strong> ${scene.location || 'Not specified'}</span>
                    <span><strong>Time:</strong> ${scene.time_of_day || scene.time || 'Not specified'}</span>
                </div>
                <div class="scene-description">${scene.description || 'No description available'}</div>
                ${scene.plot_point ? `
                    <div class="scene-plot-point">
                        <strong>Plot Point:</strong> ${scene.plot_point}
                    </div>
                ` : `
                    <div class="scene-plot-point-placeholder">
                        <em>No plot point generated yet. Click "Generate Plot Point" to create a causal connection for this scene.</em>
                    </div>
                `}
            `;
            
            container.appendChild(sceneElement);
        });
    }
}



// Generate plot points for all scenes with causal connections
async function generateAllPlotPoints() {
    console.log('generateAllPlotPoints() called!');
    console.log('appState.generatedScenes:', appState.generatedScenes);
    console.log('appState.projectPath:', appState.projectPath);
    
    if (!appState.generatedScenes || !appState.projectPath) {
        showToast('No scenes available to generate plot points for.', 'error');
        return;
    }
    
    try {
        showLoading('Generating connected plot points for all scenes...');
        
        const response = await fetch(`/api/generate-plot-points/${appState.projectPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Plot points response:', data);
            console.log('data.plotPoints structure:', data.plotPoints);
            console.log('data.plotPoints keys:', Object.keys(data.plotPoints || {}));
            console.log('Current scenes structure:', appState.generatedScenes);
            console.log('Type of data.plotPoints:', typeof data.plotPoints);
            
            // Update all scenes with their plot points
            Object.entries(data.plotPoints || {}).forEach(([structureKey, plotPoints]) => {
                console.log(`Processing ${structureKey}:`, plotPoints);
                console.log(`Is plotPoints an array?`, Array.isArray(plotPoints));
                console.log(`appState.generatedScenes[${structureKey}] exists?`, !!appState.generatedScenes[structureKey]);
                
                if (appState.generatedScenes[structureKey] && Array.isArray(plotPoints)) {
                    plotPoints.forEach((plotPoint, index) => {
                        if (appState.generatedScenes[structureKey][index]) {
                            console.log(`Setting plot point for ${structureKey}[${index}]:`, plotPoint);
                            appState.generatedScenes[structureKey][index].plot_point = plotPoint;
                        } else {
                            console.log(`Scene not found: ${structureKey}[${index}]`);
                        }
                    });
                } else {
                    console.log(`Structure key ${structureKey} not found or plotPoints not array:`, plotPoints);
                }
            });
            
            // Refresh the display
            displayScenes(appState.generatedScenes);
            
            showToast('Plot points generated successfully with causal connections!', 'success');
            saveToLocalStorage();
        } else {
            throw new Error(data.error || 'Failed to generate plot points');
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error generating plot points:', error);
        showToast('Error generating plot points. Please try again.', 'error');
        hideLoading();
    }
}

// Generate a plot point for a specific scene
async function generatePlotPoint(structureKey, sceneIndex) {
    if (!appState.projectPath) {
        showToast('No project loaded. Please create or load a project first.', 'error');
        return;
    }
    
    try {
        showLoading(`Generating plot point for Scene ${sceneIndex + 1}...`);
        
        const response = await fetch(`/api/generate-plot-point/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Individual plot point response:', data);
            console.log(`Looking for scene ${structureKey}[${sceneIndex}]:`, appState.generatedScenes[structureKey]?.[sceneIndex]);
            
            // Update the specific scene with its plot point
            if (appState.generatedScenes[structureKey] && appState.generatedScenes[structureKey][sceneIndex]) {
                console.log(`Setting individual plot point:`, data.plotPoint);
                appState.generatedScenes[structureKey][sceneIndex].plot_point = data.plotPoint;
                console.log('Scene after update:', appState.generatedScenes[structureKey][sceneIndex]);
            } else {
                console.log(`Scene not found for individual plot point: ${structureKey}[${sceneIndex}]`);
            }
            
            // Refresh the display for this structural element
            displayScenesForElement(structureKey, appState.generatedScenes[structureKey]);
            
            showToast(`Plot point generated for Scene ${sceneIndex + 1}!`, 'success');
            saveToLocalStorage();
        } else {
            throw new Error(data.error || 'Failed to generate plot point');
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error generating plot point:', error);
        showToast('Error generating plot point. Please try again.', 'error');
        hideLoading();
    }
}

// Generate a single scene for a specific structural element and scene index
async function generateIndividualScene(structureKey, sceneIndex) {
    if (!appState.projectPath) {
        showToast('No project loaded. Please create or load a project first.', 'error');
        return;
    }
    
    try {
        showLoading(`Regenerating Scene ${sceneIndex + 1}...`);
        
        const response = await fetch(`/api/generate-individual-scene/${appState.projectPath}/${structureKey}/${sceneIndex}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update the specific scene in the app state
            if (!appState.generatedScenes) {
                appState.generatedScenes = {};
            }
            if (!appState.generatedScenes[structureKey]) {
                appState.generatedScenes[structureKey] = [];
            }
            
            // Replace the specific scene
            appState.generatedScenes[structureKey][sceneIndex] = data.scene;
            
            // Refresh the display for this structural element
            displayScenesForElement(structureKey, appState.generatedScenes[structureKey]);
            
            showToast(`Scene ${sceneIndex + 1} regenerated successfully!`, 'success');
            saveToLocalStorage();
        } else {
            throw new Error(data.error || 'Failed to generate scene');
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error generating individual scene:', error);
        showToast('Error regenerating scene. Please try again.', 'error');
        hideLoading();
    }
}

// Simple scene distribution (kept for compatibility)
async function regenerateScenes(method = 'simple') {
    if (!appState.generatedStructure || !appState.projectPath) {
        showToast('No structure or project to regenerate scenes for.', 'error');
        return;
    }
    
    try {
        showLoading('Generating simple scene distribution...');
        
        const response = await fetch(`/api/regenerate-scenes-simple/${appState.projectPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Convert the scenes format to the format expected by displayScenes
            const convertedScenes = {};
            Object.entries(data.scenes).forEach(([key, value]) => {
                convertedScenes[key] = value.scenes; // Extract the scenes array from the nested structure
            });
            
            appState.generatedScenes = convertedScenes;
            displayScenes(convertedScenes);
            
            // Count total scenes for display
            const totalScenes = Object.values(convertedScenes).reduce((total, scenes) => total + scenes.length, 0);
            showToast(`Simple scenes generated successfully! (${totalScenes} scenes)`, 'success');
        } else {
            throw new Error(data.error || 'Failed to regenerate scenes');
        }
        
        hideLoading();
        saveToLocalStorage();
    } catch (error) {
        console.error('Error regenerating scenes:', error);
        showToast('Error regenerating scenes. Please try again.', 'error');
        hideLoading();
    }
}

// Approve scenes and go to dialogue generation
function approveScenes() {
    if (!appState.generatedScenes) {
        showToast('No scenes to approve.', 'error');
        return;
    }
    
    displayDialogueGeneration();
    goToStep(5);
    showToast('Ready to generate dialogue!', 'success');
}

// Display dialogue generation interface
function displayDialogueGeneration() {
    const container = document.getElementById('dialogueContent');
    container.innerHTML = '';
    
    Object.entries(appState.generatedScenes).forEach(([structureKey, sceneGroup]) => {
        if (Array.isArray(sceneGroup)) {
            sceneGroup.forEach((scene, index) => {
                const sceneId = `${structureKey}-${index}`;
                const elementId = `dialogue-${structureKey}-${index}`;
                
                // Check if dialogue already exists for this scene
                let dialogueContent = '<em>Click "Generate Dialogue" to create the screenplay for this scene.</em>';
                let hasExistingDialogue = false;
                
                // First check the direct scene ID format
                if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                    dialogueContent = appState.generatedDialogues[sceneId];
                    hasExistingDialogue = true;
                } else if (appState.generatedDialogues) {
                    // Also check for dialogue matching by scene title (for loaded projects)
                    const sceneTitle = scene.title || scene.name || '';
                    const normalizedSceneTitle = sceneTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    
                    Object.entries(appState.generatedDialogues).forEach(([dialogueKey, dialogue]) => {
                        const normalizedDialogueKey = dialogueKey.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        if (normalizedSceneTitle === normalizedDialogueKey) {
                            dialogueContent = dialogue;
                            hasExistingDialogue = true;
                        }
                    });
                }
                
                const sceneElement = document.createElement('div');
                sceneElement.className = 'dialogue-scene';
                sceneElement.innerHTML = `
                    <h4>
                        ${scene.title || scene.name || 'Untitled Scene'}
                        <button class="btn btn-primary btn-sm" onclick="generateDialogue('${structureKey}', ${index})">
                            ${hasExistingDialogue ? 'Regenerate Dialogue' : 'Generate Dialogue'}
                        </button>
                    </h4>
                    <div id="${elementId}" class="script-content">
                        ${hasExistingDialogue ? dialogueContent : dialogueContent}
                    </div>
                `;
                
                container.appendChild(sceneElement);
            });
        }
    });
    
    console.log('Dialogue interface displayed with existing content restored');
}

// Generate dialogue for a specific scene
async function generateDialogue(structureKey, sceneIndex) {
    const scene = appState.generatedScenes[structureKey][sceneIndex];
    const sceneId = `${structureKey}-${sceneIndex}`;
    
    try {
        showLoading('Generating dialogue...');
        
        const response = await fetch('/api/generate-dialogue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scene: scene,
                storyInput: appState.storyInput,
                context: `This scene is part of the ${structureKey.replace(/_/g, ' ')} section of the story.`,
                projectPath: appState.projectPath
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.generatedDialogues[sceneId] = data.dialogue;
            document.getElementById(`dialogue-${sceneId}`).textContent = data.dialogue;
            showToast('Dialogue generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate dialogue');
        }
        
        hideLoading();
        saveToLocalStorage();
    } catch (error) {
        console.error('Error generating dialogue:', error);
        showToast('Error generating dialogue. Please try again.', 'error');
        hideLoading();
    }
}

// Finalize script
function finalizeScript() {
    if (Object.keys(appState.generatedDialogues).length === 0) {
        showToast('Please generate dialogue for at least one scene.', 'error');
        return;
    }
    
    assembleScript();
    goToStep(6);
    showToast('Script completed!', 'success');
}

// Assemble final script
function assembleScript() {
    let script = `${appState.storyInput.title}\n`;
    script += `Written by: [Author Name]\n\n`;
    script += `LOGLINE: ${appState.storyInput.logline}\n\n`;
    script += `TONE: ${appState.storyInput.tone}\n\n`;
    script += `CHARACTERS: ${appState.storyInput.characters}\n\n`;
    script += `FADE IN:\n\n`;
    
    // Add all dialogue scenes
    Object.values(appState.generatedDialogues).forEach(dialogue => {
        script += dialogue + '\n\n';
    });
    
    script += `FADE OUT.\n\nTHE END`;
    
    // Display script preview
    document.getElementById('scriptPreview').textContent = script;
    
    // Update statistics
    const totalScenes = Object.keys(appState.generatedDialogues).length;
    const estimatedPages = Math.ceil(script.length / 250); // Rough estimate
    
    document.getElementById('totalScenes').textContent = totalScenes;
    document.getElementById('estimatedPages').textContent = estimatedPages;
    
    saveToLocalStorage();
}

// Export script
async function exportScript(format = 'text') {
    if (!appState.storyInput || Object.keys(appState.generatedDialogues).length === 0) {
        showToast('No script to export.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectData: appState,
                format: format,
                projectPath: appState.projectPath
            })
        });
        
        if (format === 'json') {
            const data = await response.json();
            downloadFile(JSON.stringify(data, null, 2), `${appState.storyInput.title || 'script'}.json`, 'application/json');
        } else {
            const scriptText = await response.text();
            downloadFile(scriptText, `${appState.storyInput.title || 'script'}.txt`, 'text/plain');
        }
        
        showToast('Script exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting script:', error);
        showToast('Error exporting script. Please try again.', 'error');
    }
}

// Save project
async function saveProject() {
    try {
        showLoading('Saving project...');
        
        const response = await fetch('/api/save-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...appState,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            appState.projectId = data.projectId;
            showToast(`Project saved! ID: ${data.projectId}`, 'success');
        } else {
            throw new Error(data.error || 'Failed to save project');
        }
        
        hideLoading();
        saveToLocalStorage();
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Error saving project. Please try again.', 'error');
        hideLoading();
    }
}

// Utility function to download files
function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Navigation functions
function goToStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.workflow-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show target step
    document.getElementById(`step${stepNumber}`).classList.add('active');
    
    // Refresh content for specific steps when navigating to them
    if (stepNumber === 4) {
        // Update total scenes display
        if (appState.storyInput) {
            const totalScenesElement = document.getElementById('totalScenesDisplay');
            if (totalScenesElement) {
                totalScenesElement.textContent = appState.storyInput.totalScenes || 70;
            }
        }
        
        // Display the scene generation interface
        console.log('Step 4 - appState.generatedScenes:', appState.generatedScenes);
        console.log('Step 4 - appState.generatedStructure:', appState.generatedStructure);
        
        if (appState.generatedStructure) {
            // Always show the new interface when going to Step 4
            displayScenes(appState.generatedScenes || {});
        }
    } else if (stepNumber === 5 && appState.generatedScenes) {
        // Refresh dialogue interface to restore existing dialogue content
        displayDialogueGeneration();
    }
    
    appState.currentStep = stepNumber;
    updateProgressBar();
    updateStepIndicators();
    saveToLocalStorage();
}

// Check if navigation to a specific step is allowed
function canNavigateToStep(stepNumber) {
    switch (stepNumber) {
        case 1:
            return true; // Can always go to step 1
        case 2:
            return appState.storyInput && appState.storyInput.title; // Need story input
        case 3:
            return appState.selectedTemplate; // Need template selected
        case 4:
            return appState.generatedStructure; // Need structure generated
        case 5:
            return appState.generatedScenes; // Need scenes generated
        case 6:
            return Object.keys(appState.generatedDialogues || {}).length > 0; // Need dialogue generated
        default:
            return false;
    }
}

// Handle clicking on step indicators
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
            5: "Please generate and approve scenes first",
            6: "Please generate dialogue for scenes first"
        };
        
        showToast(requirements[stepNumber] || "Cannot navigate to this step yet", 'error');
    }
}

function updateProgressBar() {
    const progressPercentage = (appState.currentStep / 6) * 100;
    elements.progressFill.style.width = `${progressPercentage}%`;
}

function updateStepIndicators() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed', 'disabled');
        
        if (stepNumber === appState.currentStep) {
            step.classList.add('active');
        } else if (stepNumber < appState.currentStep) {
            step.classList.add('completed');
        } else if (!canNavigateToStep(stepNumber)) {
            step.classList.add('disabled');
        }
        
        // Add click handler if not already added
        if (!step.hasAttribute('data-click-handler')) {
            step.setAttribute('data-click-handler', 'true');
            step.addEventListener('click', () => handleStepClick(stepNumber));
        }
    });
}

// Start over
function startOver() {
    if (confirm('Are you sure you want to start over? This will clear all progress.')) {
        localStorage.removeItem('filmScriptGenerator');
        location.reload();
    }
}

// Loading functions
function showLoading(message = 'Loading...') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

// Toast notification functions
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    elements.toast.classList.remove('show');
}

// Save to localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('filmScriptGenerator', JSON.stringify(appState));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// Load Project Modal Functions
async function showLoadProjectModal() {
    const modal = document.getElementById('loadProjectModal');
    const projectsList = document.getElementById('projectsList');
    
    modal.classList.add('show');
    projectsList.innerHTML = '<p>Loading projects...</p>';
    
    try {
        const response = await fetch('/api/list-projects');
        const projects = await response.json();
        
        if (projects.length === 0) {
            projectsList.innerHTML = '<p style="text-align: center; color: #718096;">No previous projects found.</p>';
            return;
        }
        
        projectsList.innerHTML = '';
        
        projects.forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.className = 'project-item';
            projectDiv.innerHTML = `
                <h4>${project.title}</h4>
                <div class="project-meta">
                    <strong>Created:</strong> ${new Date(project.createdAt).toLocaleDateString()}<br>
                    <strong>Tone:</strong> ${project.tone || 'Not specified'}<br>
                    <strong>Scenes:</strong> ${project.totalScenes || 'Not specified'}
                </div>
                <div class="project-logline">"${project.logline}"</div>
                <div class="project-actions">
                    <button class="load-project-btn" onclick="loadProject('${project.path}')">
                        📁 Load Project
                    </button>
                    <button class="delete-project-btn" onclick="deleteProject('${project.path}', '${project.title.replace(/'/g, "\\'")}')">
                        🗑️ Delete
                    </button>
                </div>
            `;
            projectsList.appendChild(projectDiv);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        projectsList.innerHTML = '<p style="color: red; text-align: center;">Error loading projects. Please try again.</p>';
    }
}

function hideLoadProjectModal() {
    document.getElementById('loadProjectModal').classList.remove('show');
}

async function loadProject(projectPath) {
    try {
        showLoading('Loading project...');
        
        console.log('Loading project:', projectPath);
        const response = await fetch(`/api/load-project/${encodeURIComponent(projectPath)}`);
        console.log('Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            // Handle HTTP errors properly
            let errorMessage = 'Failed to load project';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (parseError) {
                // If response isn't JSON, use status text
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const projectData = await response.json();
        console.log('Project data loaded:', projectData);
        
        try {
            // Populate all form fields with loaded data
            console.log('About to call populateFormWithProject...');
            console.log('Project data being passed:', projectData);
            await populateFormWithProject(projectData);
            console.log('populateFormWithProject completed successfully');
        } catch (error) {
            console.error('Error in populateFormWithProject:', error);
            console.error('Error stack:', error.stack);
            showToast(`Error loading project: ${error.message}`, 'error');
        }
        
        // Hide modal
        hideLoadProjectModal();
        hideLoading();
        
    } catch (error) {
        console.error('Error loading project:', error);
        showToast(`Error loading project: ${error.message}`, 'error');
        hideLoading();
    }
}

async function populateFormWithProject(projectData, showToastMessage = true, isRestore = false) {
    console.log('=== START populateFormWithProject ===');
    console.log('Populating form with project data:', projectData);
    console.log('Is restore operation:', isRestore);
    
    // Clear existing state
    console.log('Clearing existing state...');
    appState.influences = { directors: [], screenwriters: [], films: [] };
    
    // Populate basic story info
    console.log('Populating basic story info...');
    console.log('Title element:', document.getElementById('title'));
    console.log('Setting title to:', projectData.storyInput.title);
    document.getElementById('title').value = projectData.storyInput.title || '';
    document.getElementById('logline').value = projectData.storyInput.logline || '';
    document.getElementById('characters').value = projectData.storyInput.characters || '';
    document.getElementById('totalScenes').value = projectData.storyInput.totalScenes || 70;
    document.getElementById('tone').value = projectData.storyInput.tone || '';
    console.log('Basic story info populated');
    
    // Populate influences if they exist
    if (projectData.storyInput.influences) {
        appState.influences = {
            directors: projectData.storyInput.influences.directors || [],
            screenwriters: projectData.storyInput.influences.screenwriters || [],
            films: projectData.storyInput.influences.films || []
        };
        
        // Update influence tags
        updateInfluenceTags('director');
        updateInfluenceTags('screenwriter');
        updateInfluenceTags('film');
    }
    
    // Update app state with loaded data
    appState.storyInput = projectData.storyInput;
    appState.selectedTemplate = projectData.template ? projectData.template.name : null;
    appState.templateData = projectData.template;
    appState.generatedStructure = projectData.structure;
    appState.projectId = projectData.projectId;
    appState.projectPath = projectData.projectPath;
    
    // Determine which step to show based on available data
    let targetStep = 1;
    let maxAvailableStep = 1;
    
    if (projectData.structure) {
        maxAvailableStep = 3; // Structure available
        if (projectData.scenes) {
            maxAvailableStep = 4; // Scenes available
            console.log('Raw scenes data:', projectData.scenes);
            // Convert scenes format for app state
            const scenesForState = {};
            Object.entries(projectData.scenes).forEach(([key, value]) => {
                console.log(`Processing scene group ${key}:`, value);
                if (value.scenes && Array.isArray(value.scenes)) {
                    // New format: {key: {scenes: [...]}}
                    scenesForState[key] = value.scenes;
                    console.log(`Converted ${key} to array of ${value.scenes.length} scenes`);
                } else if (Array.isArray(value)) {
                    // Old format: {key: [...]}
                    scenesForState[key] = value;
                    console.log(`${key} already in array format with ${value.length} scenes`);
                }
            });
            appState.generatedScenes = scenesForState;
            console.log('Final scenes for app state:', scenesForState);
            
            if (projectData.dialogue && Object.keys(projectData.dialogue).length > 0) {
                maxAvailableStep = 5; // Dialogue available
                console.log('Dialogue data:', projectData.dialogue);
                appState.generatedDialogues = projectData.dialogue;
            }
        }
    }
    
    // Determine target step based on whether this is a restore operation
    if (isRestore && appState.currentStep && appState.currentStep <= maxAvailableStep) {
        // If restoring and current step is valid, stay on current step
        targetStep = appState.currentStep;
        console.log(`Restore: staying on current step ${targetStep} (max available: ${maxAvailableStep})`);
    } else {
        // If initial load or current step is invalid, go to highest available step
        targetStep = maxAvailableStep;
        console.log(`Initial load: going to highest available step ${targetStep}`);
    }
    
    // Make sure templates are loaded first
    if (targetStep >= 2) {
        try {
            console.log('Loading templates...');
            await loadTemplates();
            console.log('Templates loaded successfully');
            
            // Select the template if we have one
            if (projectData.template && projectData.template.name) {
                console.log('Selecting template:', projectData.template.name);
                // Find and select the template
                const templateElements = document.querySelectorAll('.template-card');
                console.log('Found template elements:', templateElements.length);
                templateElements.forEach(element => {
                    const templateName = element.querySelector('h3').textContent;
                    if (templateName === projectData.template.name) {
                        element.classList.add('selected');
                        appState.selectedTemplate = templateName;
                        appState.templateData = projectData.template;
                        console.log('Template selected:', templateName);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            // Continue anyway, just log the error
        }
    }
    
    // Navigate to appropriate step
    console.log('Navigating to step:', targetStep);
    goToStep(targetStep);
    console.log('Navigation completed');
    
    // If we have a structure, display it
    if (projectData.structure && targetStep >= 3) {
        console.log('Displaying structure:', projectData.structure);
        displayStructure(projectData.structure);
        console.log('Structure display completed');
    }
    
    // If we have scenes, display them
    if (projectData.scenes && targetStep >= 4) {
        console.log('Displaying scenes:', projectData.scenes);
        // Convert scenes format if needed
        const scenesToDisplay = {};
        Object.entries(projectData.scenes).forEach(([key, value]) => {
            if (value.scenes && Array.isArray(value.scenes)) {
                // New format: {key: {scenes: [...]}}
                scenesToDisplay[key] = value.scenes;
            } else if (Array.isArray(value)) {
                // Old format: {key: [...]}
                scenesToDisplay[key] = value;
            }
        });
        console.log('Scenes to display:', scenesToDisplay);
        displayScenes(scenesToDisplay);
        console.log('Scenes display completed');
    }
    
    // If we have dialogue and we're going to step 5, display dialogue generation interface
    if (targetStep >= 5) {
        console.log('Displaying dialogue generation interface');
        displayDialogueGeneration();
        console.log('Dialogue generation interface displayed');
        
        // If we have existing dialogue, populate it
        if (projectData.dialogue && Object.keys(projectData.dialogue).length > 0) {
            console.log('Populating existing dialogue');
            console.log('Available dialogue keys:', Object.keys(projectData.dialogue));
            console.log('Current scenes in app state:', Object.keys(appState.generatedScenes));
            
            // Check immediately what elements are available
            console.log('Available dialogue elements (immediate):', Array.from(document.querySelectorAll('[id^="dialogue-"]')).map(el => el.id));
            
            // Wait a moment for the dialogue interface to be fully rendered
            setTimeout(() => {
                console.log('=== TIMEOUT EXECUTED ===');
                console.log('Available dialogue elements after timeout:', Array.from(document.querySelectorAll('[id^="dialogue-"]')).map(el => el.id));
                
                Object.entries(projectData.dialogue).forEach(([sceneId, dialogue]) => {
                    console.log(`Processing dialogue: ${sceneId}`);
                    
                    // The dialogue ID format is like "The_Empty_Studio" but we need to find the matching scene
                    // Look through all generated scenes to find the matching one
                    let found = false;
                    Object.entries(appState.generatedScenes).forEach(([structureKey, scenes]) => {
                        scenes.forEach((scene, index) => {
                            const expectedElementId = `dialogue-${structureKey}-${index}`;
                            const dialogueElement = document.getElementById(expectedElementId);
                            
                            // Check if this scene matches the dialogue (by title or name)
                            // Normalize both titles by removing all non-alphanumeric characters and converting to lowercase
                            const rawSceneTitle = scene.title || scene.name || '';
                            const sceneTitle = rawSceneTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                            const dialogueTitle = sceneId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                            
                            console.log(`Comparing scene "${rawSceneTitle}" -> "${sceneTitle}" with dialogue "${sceneId}" -> "${dialogueTitle}" for element ${expectedElementId}`);
                            
                            if (sceneTitle === dialogueTitle || sceneTitle.includes(dialogueTitle) || dialogueTitle.includes(sceneTitle)) {
                                if (dialogueElement) {
                                    dialogueElement.textContent = dialogue;
                                    console.log(`✅ Populated dialogue for scene: ${structureKey}-${index} (${sceneId})`);
                                    found = true;
                                } else {
                                    console.log(`❌ Element ${expectedElementId} not found`);
                                }
                            }
                        });
                    });
                    
                    if (!found) {
                        console.log(`❌ Could not match dialogue "${sceneId}" to any scene`);
                    }
                });
            }, 100);
        }
    }
    
    // Mark this as a loaded project so it can be restored on page reload
    appState.isLoadedProject = true;
    
    console.log('Saving to localStorage...');
    saveToLocalStorage();
    console.log('=== END populateFormWithProject ===');
    
    // Show success message if requested
    if (showToastMessage) {
        showToast(`Project "${projectData.storyInput.title}" loaded successfully!`, 'success');
    }
}

async function deleteProject(projectPath, projectTitle) {
    // Show confirmation dialog
    const confirmMessage = `Are you sure you want to delete the project "${projectTitle}"?\n\nThis will permanently delete all files including:\n• Story structure\n• Generated scenes\n• Dialogue\n• Exported scripts\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        showLoading('Deleting project...');
        
        const response = await fetch(`/api/project/${encodeURIComponent(projectPath)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to delete project';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (parseError) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        hideLoading();
        showToast(`Project "${projectTitle}" deleted successfully!`, 'success');
        
        // Refresh the projects list
        showLoadProjectModal();
        
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast(`Error deleting project: ${error.message}`, 'error');
        hideLoading();
    }
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showToast('An unexpected error occurred. Please try again.', 'error');
});

// API error handling
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showToast('Network error. Please check your connection.', 'error');
});

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('loadProjectModal');
    if (e.target === modal) {
        hideLoadProjectModal();
    }
}); 