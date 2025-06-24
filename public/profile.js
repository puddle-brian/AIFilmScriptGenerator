// Profile page functionality
let currentUser = 'guest';
let currentUserId = null; // Will be set from authenticated user data
let isCurrentUserAdmin = false;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    await initializeProfilePage();
});

async function initializeProfilePage() {
    // Check if user is authenticated and get their info
    const apiKey = localStorage.getItem('apiKey');
    const userData = localStorage.getItem('userData');
    
    if (apiKey && userData) {
        try {
            const user = JSON.parse(userData);
            currentUser = user.username;
            currentUserId = user.id;
            isCurrentUserAdmin = user.is_admin || false;
            
            // Update UI based on admin status
            if (isCurrentUserAdmin) {
                document.getElementById('adminUserSelector').style.display = 'block';
                document.getElementById('regularUserInfo').style.display = 'none';
                await loadUsers();
            } else {
                document.getElementById('adminUserSelector').style.display = 'none';
                document.getElementById('regularUserInfo').style.display = 'block';
                document.getElementById('currentUserDisplay').textContent = `Welcome, ${user.username}`;
            }
            
        } catch (error) {
            console.error('Error parsing user data:', error);
            // Redirect to login if user data is corrupted
            window.location.href = 'login.html';
            return;
        }
    } else {
        // Not authenticated, redirect to login
        window.location.href = 'login.html';
        return;
    }
    
    await loadUserData();
}

// User Management (Admin only)
async function loadUsers() {
    // Only load user list for admin users
    if (!isCurrentUserAdmin) {
        return;
    }
    
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const userSelect = document.getElementById('currentUser');
        userSelect.innerHTML = '<option value="guest">Guest</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            userSelect.appendChild(option);
        });
        
        userSelect.value = currentUser;
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function switchUser() {
    // Only allow admin users to switch users
    if (!isCurrentUserAdmin) {
        console.warn('Non-admin user attempted to switch users');
        return;
    }
    
    const userSelect = document.getElementById('currentUser');
    currentUser = userSelect.value;
    
    // Also update userId if we need it
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const user = users.find(u => u.username === currentUser);
        if (user) {
            currentUserId = user.id;
        }
    } catch (error) {
        console.error('Failed to get user ID:', error);
    }
    
    await loadUserData();
}

async function createNewUser() {
    // Only allow admin users to create new users
    if (!isCurrentUserAdmin) {
        console.warn('Non-admin user attempted to create new user');
        return;
    }
    
    const userModal = document.getElementById('userCreationModal');
    const form = document.getElementById('userCreationForm');
    
    form.onsubmit = async function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const username = formData.get('newUserName').trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            
            if (response.ok) {
                await loadUsers();
                currentUser = username;
                document.getElementById('currentUser').value = username;
                await loadUserData();
                closeUserModal();
                form.reset();
            } else {
                const error = await response.text();
                alert('Failed to create user: ' + error);
            }
        } catch (error) {
            console.error('Failed to create user:', error);
            alert('Failed to create user');
        }
    };
    
    userModal.classList.add('show');
}

function closeUserModal() {
    const modal = document.getElementById('userCreationModal');
    modal.classList.remove('show');
    document.getElementById('userCreationForm').reset();
}

// Load all user data
async function loadUserData() {
    await loadUserLibraries();
    await loadUserProjects();
}

// Library Management
async function loadUserLibraries() {
    const libraryTypes = ['directors', 'storyconcepts', 'characters', 'screenwriters', 'films', 'tones'];
    
    for (const type of libraryTypes) {
        await loadLibrary(type);
    }
}

async function loadLibrary(type) {
    try {
        const response = await fetch(`/api/user-libraries/${currentUser}/${type}`);
        const libraries = await response.json();
        
        displayLibraries(type, libraries);
    } catch (error) {
        console.error(`Error loading ${type} library:`, error);
        displayLibraries(type, []);
    }
}

function displayLibraries(type, libraries) {
    const container = document.getElementById(`${type}-library`);
    if (!container) {
        console.warn(`Container not found for ${type}-library`);
        return;
    }
    
    if (libraries.length === 0) {
        container.innerHTML = '<div class="library-empty">No entries yet. Click "Add New" to get started!</div>';
        return;
    }
    
    // Create influence tags (step 1 badge pattern)
    container.innerHTML = libraries.map(lib => `
        <div class="influence-tag clickable-tag" onclick="editLibraryEntry('${type}', '${lib.entry_key}', ${JSON.stringify(lib.entry_data).replace(/"/g, '&quot;')})">
            <span>${lib.entry_data.name}</span>
            <button class="remove-tag" onclick="event.stopPropagation(); deleteLibraryEntry('${type}', '${lib.entry_key}')" title="Remove">&times;</button>
        </div>
    `).join('');
}

function addLibraryEntry(type) {
    // This function is deprecated - use addFromDropdownOrNew instead
    addFromDropdownOrNew(type.replace(/s$/, '')); // Remove 's' from plural
}

function editLibraryEntry(type, entryKey, entryData) {
    // Use the universal modal system for editing
    const config = getLibraryTypeConfig(type.replace(/s$/, '')); // Remove 's' from plural
    if (!config) {
        console.warn(`Unknown library type: ${type}`);
        return;
    }
    
    // Store editing state
    window.editingLibraryEntry = {
        type: type,
        key: entryKey,
        data: entryData
    };
    
    // Show universal modal with pre-filled data
    showUniversalLibrarySaveModal(type.replace(/s$/, ''), entryData.name || '', config, false);
    
    // Pre-fill the description field if it exists
    setTimeout(() => {
        const descField = document.getElementById('universalLibraryEntryDescription');
        if (descField && entryData.description) {
            descField.value = entryData.description;
        }
    }, 100);
}

function getTypeDisplayName(type) {
    const displayNames = {
        'directors': 'Director',
        'screenwriters': 'Screenwriter', 
        'films': 'Film',
        'tones': 'Tone',
        'storyconcepts': 'Story Concept',
        'characters': 'Character'
    };
    return displayNames[type] || type;
}

async function deleteLibraryEntry(type, key) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
        const response = await fetch(`/api/user-libraries/${currentUser}/${type}/${key}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadLibrary(type);
            showToast('Library entry deleted successfully!', 'success');
        } else {
            alert('Failed to delete entry');
        }
    } catch (error) {
        console.error('Failed to delete entry:', error);
        alert('Failed to delete entry');
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
    
    // Clear editing state
    window.editingLibraryEntry = null;
}

function closeUserModal() {
    const modal = document.getElementById('userCreationModal');
    modal.classList.remove('show');
    document.getElementById('userCreationForm').reset();
}

// Helper function to generate a URL-safe key from name
function generateEntryKey(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and dashes
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .trim('-'); // Remove leading/trailing dashes
}

// Old form handler removed - now using universal modal system

// Project Management
async function loadUserProjects() {
    try {
        const response = await fetch(`/api/user-projects/${currentUser}`);
        const projects = await response.json();
        displayProjects(projects);
    } catch (error) {
        console.error('Failed to load projects:', error);
        displayProjects([]);
    }
}

function displayProjects(projects) {
    const container = document.getElementById('projects-grid');
    
    if (projects.length === 0) {
        container.innerHTML = '<div class="projects-empty">No projects yet. Create your first screenplay!</div>';
        return;
    }
    
    container.innerHTML = projects.map(project => {
        const thumbnail = getProjectThumbnail(project.thumbnail_data);
        const progressText = getProgressText(project.thumbnail_data);
        const dateText = new Date(project.created_at).toLocaleDateString();
        
        // Get the clean title from thumbnail_data or project_context
        let projectTitle = project.project_name; // fallback
        try {
            if (project.thumbnail_data && project.thumbnail_data.title) {
                projectTitle = project.thumbnail_data.title;
            } else if (project.project_context) {
                const context = typeof project.project_context === 'string' 
                    ? JSON.parse(project.project_context) 
                    : project.project_context;
                if (context.storyInput && context.storyInput.title) {
                    projectTitle = context.storyInput.title;
                }
            }
        } catch (error) {
            console.log('Could not parse project data for title:', error);
        }
        
        // Get project description/logline
        let projectLogline = '';
        try {
            if (project.project_context) {
                const context = typeof project.project_context === 'string' 
                    ? JSON.parse(project.project_context) 
                    : project.project_context;
                if (context.storyInput && context.storyInput.logline) {
                    projectLogline = context.storyInput.logline;
                    // Truncate if too long (allow more text since we removed thumbnail)
                    if (projectLogline.length > 200) {
                        projectLogline = projectLogline.substring(0, 200) + '...';
                    }
                }
            }
        } catch (error) {
            console.log('Could not parse project logline:', error);
        }
        
        return `
            <div class="project-card">
                <div class="project-content">
                    <h3>${projectTitle}</h3>
                    ${projectLogline ? `<p class="project-logline">${projectLogline}</p>` : ''}
                    <p class="project-progress">${progressText}</p>
                    <span class="project-date">${dateText}</span>
                </div>
                <div class="project-actions">
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openProject('${project.project_name}')">
                        Open Project
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); deleteProject('${project.project_name}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getProjectThumbnail(thumbnailData) {
    if (!thumbnailData) return '📝';
    
    const genre = thumbnailData.genre?.toLowerCase() || '';
    const tone = thumbnailData.tone?.toLowerCase() || '';
    
    // Return appropriate emoji based on genre/tone
    if (genre.includes('horror') || tone.includes('horror')) return '🎭';
    if (genre.includes('comedy') || tone.includes('comedy')) return '😄';
    if (genre.includes('romance') || tone.includes('romance')) return '💖';
    if (genre.includes('action') || tone.includes('action')) return '💥';
    if (genre.includes('drama') || tone.includes('drama')) return '🎭';
    if (genre.includes('sci-fi') || tone.includes('sci-fi')) return '🚀';
    if (genre.includes('fantasy') || tone.includes('fantasy')) return '🧙';
    if (genre.includes('thriller') || tone.includes('thriller')) return '🔍';
    
    return '📽️';
}

function getProgressText(thumbnailData) {
    if (!thumbnailData) return 'Project started';
    
    const step = thumbnailData.currentStep || 1;
    const structure = thumbnailData.structure || 'Unknown';
    
    const steps = [
        'Story Input',
        'Template Selection', 
        'Acts Generated',
        'Plot Points',
        'Scenes',
        'Dialogue',
        'Export Ready'
    ];
    
    return `${structure} • Step ${step}/7: ${steps[step - 1] || 'In Progress'}`;
}

function openProject(projectName) {
    // Navigate back to main app with project loaded
    const projectPath = encodeURIComponent(projectName);
    window.location.href = `index.html?project=${projectPath}`;
}

async function deleteProject(projectName) {
    if (!confirm(`Are you sure you want to delete this project? This cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${currentUserId}/projects`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ project_name: projectName })
        });
        
        if (response.ok) {
            showNotification('Project deleted successfully');
            loadUserProjects(); // Refresh the projects list
        } else {
            const error = await response.text();
            throw new Error(error);
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        showNotification('Error deleting project: ' + error.message, 'error');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#ff4444' : '#4CAF50'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modal click outside to close
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Credits Widget Functions
function toggleCreditsDetail() {
    const panel = document.getElementById('creditsDetailPanel');
    const toggle = document.getElementById('creditsToggle');
    
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        toggle.textContent = 'Hide ▲';
        
        // Load credits data when panel opens
        if (typeof loadCreditsData === 'function') {
            loadCreditsData();
        }
    } else {
        panel.style.display = 'none';
        toggle.textContent = 'Manage ▼';
    }
}

function updateHeaderCredits() {
    // Update header credits display
    if (typeof getUserCredits === 'function') {
        getUserCredits().then(credits => {
            const headerAmount = document.getElementById('headerCreditsAmount');
            if (headerAmount) {
                headerAmount.textContent = credits || '--';
            }
        }).catch(error => {
            console.error('Error updating header credits:', error);
        });
    }
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Click outside modal to close
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        closeModal();
        closeUserModal();
    }
});

// Profile-specific versions of functions from main app
// Library entry creation functions
function addFromDropdownOrNew(type) {
    // For profile page, always open modal to create new entry
    addNewToLibrary(type);
}

function addNewToLibrary(type) {
    console.log('Profile: Adding new library entry for', type);
    
    const config = getLibraryTypeConfig(type);
    if (!config) {
        console.warn(`Unknown library type: ${type}`);
        return;
    }
    
    showUniversalLibrarySaveModal(type, '', config, true);
}

function getLibraryTypeConfig(type) {
    const configs = {
        'director': {
            displayName: 'Director',
            singular: 'director',
            plural: 'directors',
            placeholder: 'e.g. Christopher Nolan, Greta Gerwig, Denis Villeneuve'
        },
        'screenwriter': {
            displayName: 'Screenwriter',
            singular: 'screenwriter',
            plural: 'screenwriters',
            placeholder: 'e.g. Aaron Sorkin, Charlie Kaufman, Diablo Cody'
        },
        'film': {
            displayName: 'Film',
            singular: 'film',
            plural: 'films',
            placeholder: 'e.g. Pulp Fiction, Citizen Kane, The Godfather'
        },
        'tone': {
            displayName: 'Tone',
            singular: 'tone',
            plural: 'tones',
            placeholder: 'e.g. dark comedy, psychological thriller, romantic drama'
        },
        'storyconcept': {
            displayName: 'Story Concept',
            singular: 'story concept',
            plural: 'story concepts',
            placeholder: 'Brief description of your story idea...'
        },
        'character': {
            displayName: 'Character',
            singular: 'character',
            plural: 'characters',
            placeholder: 'Describe the character\'s role, personality, background...'
        }
    };
    
    return configs[type];
}

function showUniversalLibrarySaveModal(type, value, config, isNewEntry = false) {
    console.log('Profile: Showing universal library modal for', type);
    
    const modalTitle = isNewEntry ? `Add New ${config.displayName}` : `Save ${config.displayName} to Library`;
    const modalMessage = isNewEntry ? 
        `Create a new ${config.singular} for your library:` :
        `Would you like to save "<strong>${value}</strong>" to your ${config.plural} library for future projects?`;
    
    // Create prompt context help text based on type
    let promptHelpText = '';
    if (type === 'director') {
        promptHelpText = `This will appear in prompts as: "In the directorial style of <em>[what you enter]</em>, ..."`;
    } else if (type === 'screenwriter') {
        promptHelpText = `This will appear in prompts as: "with screenplay influences from <em>[what you enter]</em>, ..."`;
    } else if (type === 'film') {
        promptHelpText = `This will appear in prompts as: "drawing inspiration from films like <em>[what you enter]</em>, ..."`;
    } else if (type === 'character') {
        promptHelpText = `Characters use both name and description in prompts for detailed character development.`;
    } else if (type === 'tone') {
        promptHelpText = `This tone will be used throughout your story generation.`;
    } else if (type === 'storyconcept') {
        promptHelpText = `This story description will be included in every AI prompt as your story develops, guiding all generated content.`;
    }
    
    const isComplexType = type === 'character' || type === 'storyconcept';
    
    const modalHtml = `
        <div class="modal universal-library-modal" id="universalLibrarySaveModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${modalTitle}</h3>
                    <button class="modal-close" onclick="hideUniversalLibrarySaveModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${modalMessage}</p>
                    <form id="universalLibrarySaveForm">
                        ${isComplexType ? `
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
                        ` : `
                            <div class="form-group">
                                <label for="universalLibraryEntryName">${config.displayName} Influence</label>
                                <input type="text" id="universalLibraryEntryName" value="${value}" required 
                                    placeholder="${config.placeholder}">
                                <small class="form-help">${promptHelpText}</small>
                            </div>
                        `}
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideUniversalLibrarySaveModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveToLibraryAndContinue('${type}', ${isNewEntry})">
                        ${isNewEntry ? 'Add to Library' : 'Save to Library'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('universalLibrarySaveModal');
    if (existingModal) existingModal.remove();
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('universalLibrarySaveModal').classList.add('show');
    
    // Focus on the name input
    setTimeout(() => {
        document.getElementById('universalLibraryEntryName').focus();
    }, 100);
}

function hideUniversalLibrarySaveModal() {
    const modal = document.getElementById('universalLibrarySaveModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

async function saveToLibraryAndContinue(type, isNewEntry = false) {
    const nameField = document.getElementById('universalLibraryEntryName');
    const descriptionField = document.getElementById('universalLibraryEntryDescription');
    
    if (!nameField || !nameField.value.trim()) {
        showToast('Please enter a name', 'error');
        return;
    }
    
    const name = nameField.value.trim();
    const description = descriptionField ? descriptionField.value.trim() : '';
    
    try {
        const entryData = type === 'character' || type === 'storyconcept' ? 
            { name, description } : 
            { name };
        
        // Check if we're editing an existing entry
        const isEditing = window.editingLibraryEntry;
        let url, method;
        
        if (isEditing) {
            // Editing existing entry
            method = 'PUT';
            url = `/api/user-libraries/${currentUser}/${isEditing.type}/${isEditing.key}`;
        } else {
            // Creating new entry
            method = 'POST';
            url = `/api/user-libraries/${currentUser}/${type}`;
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('apiKey')}`
            },
            body: JSON.stringify(isEditing ? entryData : { entry_data: entryData })
        });
        
        if (response.ok) {
            const action = isEditing ? 'updated' : 'added';
            showToast(`${name} ${action} in your ${type} library!`, 'success');
            hideUniversalLibrarySaveModal();
            
            // Clear editing state
            if (isEditing) {
                window.editingLibraryEntry = null;
            }
            
            // Refresh the library display
            const libraryType = isEditing ? isEditing.type : (type + 's');
            await loadLibrary(libraryType);
        } else {
            const error = await response.text();
            showToast(`Error saving to library: ${error}`, 'error');
        }
    } catch (error) {
        console.error('Error saving to library:', error);
        showToast('Error saving to library', 'error');
    }
}

// Character-specific functions
function addCharacter() {
    console.log('Profile: Adding new character');
    addNewToLibrary('character');
}

// Toast styling
const toastStyles = `
.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: 400px;
}

.toast.show {
    opacity: 1;
    transform: translateX(0);
}

.toast.success {
    background: #4CAF50;
}

.toast.error {
    background: #f44336;
}

.toast.warning {
    background: #ff9800;
}

.toast-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.toast-close {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    margin-left: 10px;
    padding: 0;
    opacity: 0.7;
}

.toast-close:hover {
    opacity: 1;
}
`;

// Add toast styles to page
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = toastStyles;
    document.head.appendChild(style);
} 