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
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadTemplates();
});

// Initialize application
function initializeApp() {
    updateProgressBar();
    updateStepIndicators();
    
    // Load from localStorage if available
    const savedState = localStorage.getItem('filmScriptGenerator');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            Object.assign(appState, parsed);
            if (appState.currentStep > 1) {
                goToStep(appState.currentStep);
            }
        } catch (e) {
            console.error('Error loading saved state:', e);
        }
    }
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

// Display generated scenes
function displayScenes(scenes) {
    const container = document.getElementById('scenesContent');
    container.innerHTML = '';
    
    Object.entries(scenes).forEach(([structureKey, sceneGroup]) => {
        if (Array.isArray(sceneGroup)) {
            const groupElement = document.createElement('div');
            groupElement.className = 'scene-group';
            groupElement.innerHTML = `<h3>${structureKey.replace(/_/g, ' ').toUpperCase()}</h3>`;
            
            sceneGroup.forEach((scene, index) => {
                const sceneElement = document.createElement('div');
                sceneElement.className = 'scene-item';
                sceneElement.innerHTML = `
                    <h4>
                        <span class="scene-number">Scene ${index + 1}</span>
                        ${scene.title || scene.name || 'Untitled Scene'}
                    </h4>
                    <div class="scene-meta">
                        <span><strong>Location:</strong> ${scene.location || 'Not specified'}</span>
                        <span><strong>Time:</strong> ${scene.time || 'Not specified'}</span>
                    </div>
                    <div class="scene-description">${scene.description || 'No description available'}</div>
                    ${scene.characters ? `
                        <div class="scene-characters">
                            ${scene.characters.map(char => `<span class="character-tag">${char}</span>`).join('')}
                        </div>
                    ` : ''}
                `;
                
                groupElement.appendChild(sceneElement);
            });
            
            container.appendChild(groupElement);
        }
    });
}

// Regenerate scenes
async function regenerateScenes() {
    await approveStructure();
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
                const sceneElement = document.createElement('div');
                sceneElement.className = 'dialogue-scene';
                sceneElement.innerHTML = `
                    <h4>
                        ${scene.title || scene.name || 'Untitled Scene'}
                        <button class="btn btn-primary btn-sm" onclick="generateDialogue('${structureKey}', ${index})">
                            Generate Dialogue
                        </button>
                    </h4>
                    <div id="dialogue-${structureKey}-${index}" class="script-content">
                        <em>Click "Generate Dialogue" to create the screenplay for this scene.</em>
                    </div>
                `;
                
                container.appendChild(sceneElement);
            });
        }
    });
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
    
    appState.currentStep = stepNumber;
    updateProgressBar();
    updateStepIndicators();
    saveToLocalStorage();
}

function updateProgressBar() {
    const progressPercentage = (appState.currentStep / 6) * 100;
    elements.progressFill.style.width = `${progressPercentage}%`;
}

function updateStepIndicators() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber === appState.currentStep) {
            step.classList.add('active');
        } else if (stepNumber < appState.currentStep) {
            step.classList.add('completed');
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
                <button class="load-project-btn" onclick="loadProject('${project.path}')">
                    Load This Project
                </button>
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
        
        // Populate all form fields with loaded data
        populateFormWithProject(projectData);
        
        // Hide modal
        hideLoadProjectModal();
        hideLoading();
        
        showToast(`Project "${projectData.storyInput.title}" loaded successfully!`, 'success');
        
    } catch (error) {
        console.error('Error loading project:', error);
        showToast(`Error loading project: ${error.message}`, 'error');
        hideLoading();
    }
}

function populateFormWithProject(projectData) {
    // Clear existing state
    appState.influences = { directors: [], screenwriters: [], films: [] };
    
    // Populate basic story info
    document.getElementById('title').value = projectData.storyInput.title || '';
    document.getElementById('logline').value = projectData.storyInput.logline || '';
    document.getElementById('characters').value = projectData.storyInput.characters || '';
    document.getElementById('totalScenes').value = projectData.storyInput.totalScenes || 70;
    document.getElementById('tone').value = projectData.storyInput.tone || '';
    
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
    if (projectData.structure) {
        targetStep = 3; // Go to structure review
        if (projectData.scenes) {
            targetStep = 4; // Go to scenes review
            appState.generatedScenes = projectData.scenes;
        }
    }
    
    // Navigate to appropriate step
    goToStep(targetStep);
    
    // If we have a structure, display it
    if (projectData.structure && targetStep >= 3) {
        displayStructure(projectData.structure);
    }
    
    // If we have scenes, display them
    if (projectData.scenes && targetStep >= 4) {
        displayScenes(projectData.scenes);
    }
    
    saveToLocalStorage();
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