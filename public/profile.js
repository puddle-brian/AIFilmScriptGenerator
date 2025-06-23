// Profile page functionality
let currentUser = null; // Will be set from authenticated user data
let currentUserId = null; // Will be set from authenticated user data
let currentLibraryType = '';
let editingEntry = null;
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
        userSelect.innerHTML = '';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            if (user.username === currentUser) {
                option.selected = true;
            }
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load users:', error);
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
        const username = formData.get('newUsername').trim();
        
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
    
    userModal.classList.add('active');
}

function closeUserModal() {
    document.getElementById('userCreationModal').classList.remove('active');
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
        try {
            const response = await fetch(`/api/user-libraries/${currentUser}/${type}`);
            const libraries = await response.json();
            displayLibraries(type, libraries);
        } catch (error) {
            console.error(`Failed to load ${type} libraries:`, error);
            displayLibraries(type, []);
        }
    }
}

function displayLibraries(type, libraries) {
    const container = document.getElementById(`${type}-library`);
    
    if (libraries.length === 0) {
        container.innerHTML = '<div class="library-empty">No custom entries yet</div>';
        return;
    }
    
    container.innerHTML = libraries.map(lib => `
        <div class="library-item">
            <div class="library-item-content">
                <div class="library-item-name">${lib.entry_data.name}</div>
                <div class="library-item-description">${lib.entry_data.description}</div>
            </div>
            <div class="library-item-actions">
                <button onclick="editLibraryEntry('${type}', '${lib.entry_key}', ${JSON.stringify(lib.entry_data)})" title="Edit">✏️</button>
                <button onclick="deleteLibraryEntry('${type}', '${lib.entry_key}')" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function addLibraryEntry(type) {
    currentLibraryType = type;
    editingEntry = null;
    
    const displayName = type === 'storyconcepts' ? 'Story Concept' : type.charAt(0).toUpperCase() + type.slice(1, -1);
    document.getElementById('modalTitle').textContent = `Add ${displayName} Entry`;
    document.getElementById('entryName').value = '';
    document.getElementById('entryDescription').value = '';
    
    document.getElementById('libraryEntryModal').classList.add('active');
}

function editLibraryEntry(type, key, data) {
    currentLibraryType = type;
    editingEntry = key;
    
    const displayName = type === 'storyconcepts' ? 'Story Concept' : type.charAt(0).toUpperCase() + type.slice(1, -1);
    document.getElementById('modalTitle').textContent = `Edit ${displayName} Entry`;
    document.getElementById('entryName').value = data.name;
    document.getElementById('entryDescription').value = data.description;
    
    document.getElementById('libraryEntryModal').classList.add('active');
}

async function deleteLibraryEntry(type, key) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
        const response = await fetch(`/api/user-libraries/${currentUser}/${type}/${key}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadUserLibraries();
        } else {
            alert('Failed to delete entry');
        }
    } catch (error) {
        console.error('Failed to delete entry:', error);
        alert('Failed to delete entry');
    }
}

function closeModal() {
    document.getElementById('libraryEntryModal').classList.remove('active');
}

// Helper function to generate a URL-safe key from name
function generateEntryKey(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and dashes
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .trim('-'); // Remove leading/trailing dashes
}

// Form submission for library entries
document.getElementById('libraryEntryForm').onsubmit = async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const entryName = formData.get('entryName').trim();
    const entryDescription = formData.get('entryDescription').trim();
    
    if (!entryName || !entryDescription) {
        alert('Please fill in all fields');
        return;
    }
    
    // Auto-generate key from name (or use existing key when editing)
    const entryKey = editingEntry || generateEntryKey(entryName);
    
    const entryData = {
        name: entryName,
        description: entryDescription
    };
    
    try {
        const method = editingEntry ? 'PUT' : 'POST';
        const response = await fetch(`/api/user-libraries/${currentUser}/${currentLibraryType}/${entryKey}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entryData)
        });
        
        if (response.ok) {
            await loadUserLibraries();
            closeModal();
            e.target.reset();
        } else {
            const error = await response.text();
            alert('Failed to save entry: ' + error);
        }
    } catch (error) {
        console.error('Failed to save entry:', error);
        alert('Failed to save entry');
    }
};

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