// Admin Panel JavaScript
// Handles all admin functionality including user management, system monitoring, and testing utilities

// Admin state management
const adminState = {
    apiKey: null,
    user: null,
    systemStatus: {
        database: 'unknown',
        api: 'unknown',
        totalUsers: 0,
        activeProjects: 0
    },
    analytics: {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        errorRate: 0,
        topEndpoints: []
    }
};

// Charts module instance (separate from main admin logic)
let adminCharts = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
});

async function initializeAdminPanel() {
    console.log('🔧 Initializing Admin Panel');
    
    // Check authentication
    if (!checkAdminAuth()) {
        window.location.href = 'login.html?redirect=admin.html';
        return;
    }
    
    // Update UI with user info
    updateAdminUserInfo();
    
    // Load initial data
    await Promise.all([
        checkSystemStatus(),
        loadSystemMetrics(),
        loadAnalytics('24h'),
        loadTopUsersByCost() // Automatically load top 10 users by cost
    ]);
    
    // Initialize charts module (separate from main admin logic)
    if (typeof AdminCharts !== 'undefined') {
        adminCharts = new AdminCharts();
        await adminCharts.init(adminState.apiKey);
    }
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('✅ Admin Panel initialized');
}

function checkAdminAuth() {
    const apiKey = localStorage.getItem('apiKey');
    const userData = localStorage.getItem('userData');
    
    if (!apiKey || !userData) {
        return false;
    }
    
    try {
        const user = JSON.parse(userData);
        if (!user.is_admin) {
            showAdminToast('Access denied. Admin privileges required.', 'error');
            return false;
        }
        
        adminState.apiKey = apiKey;
        adminState.user = user;
        return true;
    } catch (error) {
        console.error('Error checking admin auth:', error);
        return false;
    }
}

function updateAdminUserInfo() {
    const adminUsername = document.getElementById('adminUsername');
    if (adminUsername && adminState.user) {
        adminUsername.textContent = adminState.user.username;
    }
}

// System Status Functions
async function checkSystemStatus() {
    try {
        updateSystemStatusIndicator('checking');
        
        // Test database connection
        const dbResponse = await fetch('/api/admin/system-status', {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (dbResponse.ok) {
            const data = await dbResponse.json();
            adminState.systemStatus = data;
            updateSystemMetrics(data);
            updateSystemStatusIndicator('online');
        } else {
            updateSystemStatusIndicator('offline');
        }
    } catch (error) {
        console.error('Error checking system status:', error);
        updateSystemStatusIndicator('offline');
    }
}

function updateSystemStatusIndicator(status) {
    const statusDot = document.querySelector('#systemStatus .status-dot');
    const statusText = document.querySelector('#systemStatus .status-text');
    
    if (statusDot && statusText) {
        statusDot.className = 'status-dot';
        
        switch (status) {
            case 'online':
                statusDot.classList.add('online');
                statusText.textContent = 'System Online';
                break;
            case 'offline':
                statusDot.classList.add('offline');
                statusText.textContent = 'System Offline';
                break;
            case 'checking':
            default:
                statusText.textContent = 'Checking...';
                break;
        }
    }
}

function updateSystemMetrics(data) {
    const elements = {
        dbStatus: document.getElementById('dbStatus'),
        apiStatus: document.getElementById('apiStatus'),
        totalUsers: document.getElementById('totalUsers'),
        activeProjects: document.getElementById('activeProjects')
    };
    
    if (elements.dbStatus) elements.dbStatus.textContent = data.database || '✅ Connected';
    if (elements.apiStatus) elements.apiStatus.textContent = data.api || '✅ Active';
    if (elements.totalUsers) elements.totalUsers.textContent = data.totalUsers || '—';
    if (elements.activeProjects) elements.activeProjects.textContent = data.activeProjects || '—';
}

async function loadSystemMetrics() {
    try {
        const response = await fetch('/api/admin/metrics', {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const metrics = await response.json();
            updateSystemMetrics(metrics);
        }
    } catch (error) {
        console.error('Error loading system metrics:', error);
    }
}

// User Management Functions
async function searchUsers() {
    const searchInput = document.getElementById('userSearch');
    const username = searchInput.value.trim();
    const resultsContainer = document.getElementById('userResults');
    
    if (!username) {
        resultsContainer.innerHTML = '<div class="loading-message">Enter a username to search</div>';
        return;
    }
    
    resultsContainer.innerHTML = '<div class="loading-message">Searching...</div>';
    
    try {
        const response = await fetch(`/api/admin/usage-stats/${username}`, {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const userData = await response.json();
            displayUserResults(userData);
        } else if (response.status === 404) {
            resultsContainer.innerHTML = '<div class="loading-message">User not found</div>';
        } else {
            throw new Error('Failed to fetch user data');
        }
    } catch (error) {
        console.error('Error searching users:', error);
        resultsContainer.innerHTML = '<div class="loading-message text-error">Error loading user data</div>';
    }
}

function displayUserResults(userData) {
    const resultsContainer = document.getElementById('userResults');
    
    const html = `
        <div class="user-result-card">
            <div class="user-result-header">
                <div>
                    <div class="user-result-name">${userData.user.username}</div>
                    <div class="user-result-email">${userData.user.email || 'No email'}</div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-sm btn-secondary" onclick="grantUserCredits('${userData.user.username}')">Grant Credits</button>
                </div>
            </div>
            <div class="user-result-meta">
                <div class="user-meta-item">
                    <div class="user-meta-label">Credits Remaining</div>
                    <div class="user-meta-value">${userData.user.credits_remaining}</div>
                </div>
                <div class="user-meta-item">
                    <div class="user-meta-label">Total Requests</div>
                    <div class="user-meta-value">${userData.usage.total_requests || 0}</div>
                </div>
                <div class="user-meta-item">
                    <div class="user-meta-label">Tokens Used</div>
                    <div class="user-meta-value">${(parseInt(userData.usage.total_tokens) || 0).toLocaleString()}</div>
                </div>
                <div class="user-meta-item">
                    <div class="user-meta-label">Total Cost</div>
                    <div class="user-meta-value">$${(parseFloat(userData.usage.total_cost) || 0).toFixed(4)}</div>
                </div>
                <div class="user-meta-item">
                    <div class="user-meta-label">Member Since</div>
                    <div class="user-meta-value">${new Date(userData.user.created_at).toLocaleDateString()}</div>
                </div>
            </div>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
}

async function loadTopUsersByCost() {
    const resultsContainer = document.getElementById('userResults');
    resultsContainer.innerHTML = '<div class="loading-message">Loading top users by cost...</div>';
    
    try {
        const response = await fetch('/api/admin/users?limit=10&sort=total_cost&order=DESC', {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayTopUsersResults(data);
        } else {
            throw new Error('Failed to fetch top users');
        }
    } catch (error) {
        console.error('Error loading top users by cost:', error);
        resultsContainer.innerHTML = '<div class="loading-message text-error">Error loading top users</div>';
    }
}

async function loadAllUsers() {
    const resultsContainer = document.getElementById('userResults');
    resultsContainer.innerHTML = '<div class="loading-message">Loading all users...</div>';
    
    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayAllUsersResults(data);
        } else {
            throw new Error('Failed to fetch users');
        }
    } catch (error) {
        console.error('Error loading all users:', error);
        resultsContainer.innerHTML = '<div class="loading-message text-error">Error loading users</div>';
    }
}

function displayTopUsersResults(data) {
    const resultsContainer = document.getElementById('userResults');
    const { users } = data;
    
    if (users.length === 0) {
        resultsContainer.innerHTML = '<div class="loading-message">No users found</div>';
        return;
    }
    
    let html = `
        <div class="all-users-header">
            <h4>🏆 Top 10 Users by Cost</h4>
            <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="userTableSearch" placeholder="Search users..." class="search-input compact-search">
                <button class="btn btn-sm btn-outline" onclick="loadAllUsers()" title="View All Users">View All</button>
            </div>
        </div>
        <div class="users-table-container">
            <table class="users-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>User</th>
                        <th>Credits</th>
                        <th>Projects</th>
                        <th>Tokens</th>
                        <th>Cost</th>
                        <th>Requests</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    users.forEach((user, index) => {
        const joinedDate = new Date(user.created_at).toLocaleDateString();
        const emailDisplay = user.email || 'No email';
        const rank = index + 1;
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        
        html += `
            <tr class="user-row" data-user-id="${user.id}" data-username="${user.username}" data-email="${emailDisplay}">
                <td style="text-align: center; font-weight: bold; color: #6366f1;">${rankEmoji}</td>
                <td class="user-cell">
                    <div class="user-info-compact">
                        <div class="username-compact">
                            ${user.username}
                            ${user.is_admin ? '<span class="admin-badge-mini">👑</span>' : ''}
                        </div>
                        <div class="user-email-compact">${emailDisplay}</div>
                    </div>
                </td>
                <td class="credits-cell">
                    <span class="remaining">${user.credits_remaining || 0}</span>
                    <span class="total">/ ${user.total_credits_purchased || 0}</span>
                </td>
                <td class="projects-cell">${user.project_count || 0}</td>
                <td class="tokens-cell">${(parseInt(user.total_tokens) || 0).toLocaleString()}</td>
                <td class="cost-cell">$${(parseFloat(user.total_cost) || 0).toFixed(2)}</td>
                <td class="requests-cell">${parseInt(user.total_requests) || 0}</td>
                <td class="actions-cell">
                    <button class="btn-mini btn-expand" onclick="toggleUserDetails(${user.id})" title="View Details">
                        <span class="expand-icon">▼</span>
                    </button>
                    <button class="btn-mini btn-credits" onclick="grantUserCredits('${user.username}')" title="Grant Credits">💰</button>
                    <button class="btn-mini btn-danger" onclick="confirmDeleteUser(${user.id}, '${user.username}')" title="Remove User">🗑️</button>
                </td>
            </tr>
            <tr class="user-details-row" id="details-${user.id}" style="display: none;">
                <td colspan="8">
                    <div class="user-details-expanded">
                        <div class="details-grid">
                            <div class="detail-item">
                                <span class="detail-label">Full Email:</span>
                                <span class="detail-value">${emailDisplay}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Email Status:</span>
                                <span class="detail-value ${user.email_verified ? 'text-success' : 'text-warning'}">
                                    ${user.email_verified ? 'Verified' : 'Unverified'}
                                </span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Role:</span>
                                <span class="detail-value ${user.is_admin ? 'admin-role' : ''}">${user.is_admin ? '👑 ADMIN' : 'User'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Member Since:</span>
                                <span class="detail-value">${joinedDate}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Total Credits Purchased:</span>
                                <span class="detail-value">${user.total_credits_purchased || 0}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Precise Cost:</span>
                                <span class="detail-value">$${(parseFloat(user.total_cost) || 0).toFixed(4)}</span>
                            </div>
                        </div>
                        <div class="expanded-actions">
                            <button class="btn btn-sm btn-outline" onclick="viewUserStats('${user.username}')">View Full Stats</button>
                            <button class="btn btn-sm btn-outline" onclick="grantUserCredits('${user.username}')">Grant Credits</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    
    resultsContainer.innerHTML = html;
    
    // Setup search functionality
    setupUserTableSearch();
}

function displayAllUsersResults(data) {
    const resultsContainer = document.getElementById('userResults');
    const { users, pagination } = data;
    
    if (users.length === 0) {
        resultsContainer.innerHTML = '<div class="loading-message">No users found</div>';
        return;
    }
    
    let html = `
        <div class="all-users-header">
            <h4>All Users (${pagination.total} total)</h4>
            <input type="text" id="userTableSearch" placeholder="Search users..." class="search-input compact-search">
        </div>
        <div class="users-table-container">
            <table class="users-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Credits</th>
                        <th>Projects</th>
                        <th>Tokens</th>
                        <th>Cost</th>
                        <th>Requests</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    users.forEach(user => {
        const joinedDate = new Date(user.created_at).toLocaleDateString();
        const emailDisplay = user.email || 'No email';
        
        html += `
            <tr class="user-row" data-user-id="${user.id}" data-username="${user.username}" data-email="${emailDisplay}">
                <td class="user-cell">
                    <div class="user-info-compact">
                        <div class="username-compact">
                            ${user.username}
                            ${user.is_admin ? '<span class="admin-badge-mini">👑</span>' : ''}
                        </div>
                        <div class="user-email-compact">${emailDisplay}</div>
                    </div>
                </td>
                <td class="credits-cell">
                    <span class="remaining">${user.credits_remaining || 0}</span>
                    <span class="total">/ ${user.total_credits_purchased || 0}</span>
                </td>
                <td class="projects-cell">${user.project_count || 0}</td>
                <td class="tokens-cell">${(parseInt(user.total_tokens) || 0).toLocaleString()}</td>
                <td class="cost-cell">$${(parseFloat(user.total_cost) || 0).toFixed(2)}</td>
                <td class="requests-cell">${parseInt(user.total_requests) || 0}</td>
                <td class="actions-cell">
                    <button class="btn-mini btn-expand" onclick="toggleUserDetails(${user.id})" title="View Details">
                        <span class="expand-icon">▼</span>
                    </button>
                    <button class="btn-mini btn-credits" onclick="grantUserCredits('${user.username}')" title="Grant Credits">💰</button>
                    <button class="btn-mini btn-danger" onclick="confirmDeleteUser(${user.id}, '${user.username}')" title="Remove User">🗑️</button>
                </td>
            </tr>
            <tr class="user-details-row" id="details-${user.id}" style="display: none;">
                <td colspan="7">
                    <div class="user-details-expanded">
                        <div class="details-grid">
                            <div class="detail-item">
                                <span class="detail-label">Full Email:</span>
                                <span class="detail-value">${emailDisplay}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Email Status:</span>
                                <span class="detail-value ${user.email_verified ? 'text-success' : 'text-warning'}">
                                    ${user.email_verified ? 'Verified' : 'Unverified'}
                                </span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Role:</span>
                                <span class="detail-value ${user.is_admin ? 'admin-role' : ''}">${user.is_admin ? '👑 ADMIN' : 'User'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Member Since:</span>
                                <span class="detail-value">${joinedDate}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Total Credits Purchased:</span>
                                <span class="detail-value">${user.total_credits_purchased || 0}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Precise Cost:</span>
                                <span class="detail-value">$${(parseFloat(user.total_cost) || 0).toFixed(4)}</span>
                            </div>
                        </div>
                        <div class="expanded-actions">
                            <button class="btn btn-sm btn-outline" onclick="viewUserStats('${user.username}')">View Full Stats</button>
                            <button class="btn btn-sm btn-outline" onclick="grantUserCredits('${user.username}')">Grant Credits</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    
    // Add pagination if there are more users
    if (pagination.hasMore) {
        html += `
            <div class="pagination-info">
                Showing ${users.length} of ${pagination.total} users
                <button class="btn btn-sm btn-outline" onclick="loadMoreUsers(${pagination.offset + pagination.limit})">
                    Load More
                </button>
            </div>
        `;
    }
    
    resultsContainer.innerHTML = html;
    
    // Setup search functionality
    setupUserTableSearch();
}

function viewUserStats(username) {
    // Switch to individual user search
    const searchInput = document.getElementById('userSearch');
    searchInput.value = username;
    searchUsers();
}

function confirmDeleteUser(userId, username) {
    const isConfirmed = confirm(
        `⚠️ DELETE USER WARNING ⚠️\n\n` +
        `Are you absolutely sure you want to DELETE user "${username}"?\n\n` +
        `This action will:\n` +
        `• Permanently delete their account\n` +
        `• Remove all their projects and data\n` +
        `• Cannot be undone\n\n` +
        `Type "DELETE" below to confirm deletion:`
    );
    
    if (isConfirmed) {
        const confirmText = prompt(
            `To confirm deletion of user "${username}", type DELETE (in capitals):`
        );
        
        if (confirmText === 'DELETE') {
            deleteUser(userId, username);
        } else {
            showAdminToast('User deletion cancelled - confirmation text did not match', 'warning');
        }
    }
}

async function deleteUser(userId, username) {
    try {
        const response = await fetch(`/api/admin/user/${userId}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const data = await response.json();
            showAdminToast(`User "${username}" has been deleted successfully`, 'success');
            
            // Remove the user card from the display
            const userCard = document.querySelector(`[data-user-id="${userId}"]`);
            if (userCard) {
                userCard.remove();
            }
            
            // Refresh the user list to update counts
            loadAllUsers();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAdminToast(`Error deleting user: ${error.message}`, 'error');
    }
}

function refreshUserStats() {
    const searchInput = document.getElementById('userSearch');
    if (searchInput.value.trim()) {
        searchUsers();
    }
}

// New compact table functions
function toggleUserDetails(userId) {
    const detailsRow = document.getElementById(`details-${userId}`);
    const expandIcon = document.querySelector(`[onclick="toggleUserDetails(${userId})"] .expand-icon`);
    
    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        expandIcon.textContent = '▲';
    } else {
        detailsRow.style.display = 'none';
        expandIcon.textContent = '▼';
    }
}

function setupUserTableSearch() {
    const searchInput = document.getElementById('userTableSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const userRows = document.querySelectorAll('.user-row');
        
        userRows.forEach(row => {
            const username = row.dataset.username.toLowerCase();
            const email = row.dataset.email.toLowerCase();
            const detailsRow = document.getElementById(`details-${row.dataset.userId}`);
            
            if (username.includes(searchTerm) || email.includes(searchTerm)) {
                row.style.display = '';
                // Hide details row when searching to avoid confusion
                if (detailsRow) {
                    detailsRow.style.display = 'none';
                    const expandIcon = row.querySelector('.expand-icon');
                    if (expandIcon) expandIcon.textContent = '▼';
                }
            } else {
                row.style.display = 'none';
                if (detailsRow) detailsRow.style.display = 'none';
            }
        });
    });
}

// Modal Functions
function showCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    modal.style.display = 'flex';
    
    // Focus on first input and set up Enter key handling
    setTimeout(() => {
        const firstInput = document.getElementById('newUsername');
        firstInput.focus();
        firstInput.select(); // Select any existing text
    }, 100);
}

function hideCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    modal.style.display = 'none';
    
    // Clear form
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('initialCredits').value = '500';
}

function showGrantCreditsModal() {
    const modal = document.getElementById('grantCreditsModal');
    modal.style.display = 'flex';
    
    // Pre-fill username if we have one from search
    const searchInput = document.getElementById('userSearch');
    const creditUsername = document.getElementById('creditUsername');
    if (searchInput.value.trim()) {
        creditUsername.value = searchInput.value.trim();
    }
    
    // Focus on appropriate input and set up Enter key handling
    setTimeout(() => {
        if (creditUsername.value.trim()) {
            // If username is pre-filled, focus on credit amount
            const creditAmountInput = document.getElementById('creditAmount');
            creditAmountInput.focus();
        } else {
            // Otherwise focus on username field
            creditUsername.focus();
        }
    }, 100);
}

function hideGrantCreditsModal() {
    const modal = document.getElementById('grantCreditsModal');
    modal.style.display = 'none';
    
    // Clear form
    document.getElementById('creditUsername').value = '';
    document.getElementById('creditAmount').value = '';
    document.getElementById('creditNotes').value = '';
}

function grantUserCredits(username) {
    const creditUsername = document.getElementById('creditUsername');
    creditUsername.value = username;
    showGrantCreditsModal();
}

// User Management Actions
async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const initialCredits = parseInt(document.getElementById('initialCredits').value) || 0;
    
    if (!username) {
        showAdminToast('Please enter a username', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': adminState.apiKey
            },
            body: JSON.stringify({ username, email, initialCredits })
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminToast(`User ${username} created successfully`, 'success');
            hideCreateUserModal();
            
            // Show API key to admin
            showAdminToast(`API Key: ${result.user.api_key}`, 'warning');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showAdminToast(`Error creating user: ${error.message}`, 'error');
    }
}

async function grantCredits() {
    const username = document.getElementById('creditUsername').value.trim();
    const credits = parseInt(document.getElementById('creditAmount').value);
    const notes = document.getElementById('creditNotes').value.trim();
    
    if (!username || !credits) {
        showAdminToast('Please enter username and credit amount', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/grant-credits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': adminState.apiKey
            },
            body: JSON.stringify({ username, credits, notes })
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminToast(result.message, 'success');
            hideGrantCreditsModal();
            
            // Refresh user search if showing this user
            const searchInput = document.getElementById('userSearch');
            if (searchInput.value.trim() === username) {
                searchUsers();
            }
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error granting credits:', error);
        showAdminToast(`Error granting credits: ${error.message}`, 'error');
    }
}

// Analytics Functions
async function loadAnalytics(timeframe = '24h') {
    const analyticsLoading = document.getElementById('analyticsLoading');
    const analyticsContent = document.getElementById('analyticsContent');
    
    analyticsLoading.style.display = 'flex';
    analyticsContent.style.display = 'none';
    
    try {
        const response = await fetch(`/api/admin/analytics?timeframe=${timeframe}`, {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const analytics = await response.json();
            adminState.analytics = analytics;
            updateAnalyticsDisplay(analytics);
        } else {
            throw new Error('Failed to load analytics');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        showAdminToast('Error loading analytics', 'error');
    } finally {
        analyticsLoading.style.display = 'none';
        analyticsContent.style.display = 'block';
    }
}

function updateAnalyticsDisplay(analytics) {
    // Update metrics
    const elements = {
        totalRequests: document.getElementById('totalRequests'),
        totalTokens: document.getElementById('totalTokens'),
        totalCost: document.getElementById('totalCost'),
        errorRate: document.getElementById('errorRate')
    };
    
    if (elements.totalRequests) elements.totalRequests.textContent = analytics.totalRequests?.toLocaleString() || '0';
    if (elements.totalTokens) elements.totalTokens.textContent = analytics.totalTokens?.toLocaleString() || '0';
    if (elements.totalCost) elements.totalCost.textContent = `$${(analytics.totalCost || 0).toFixed(2)}`;
    if (elements.errorRate) elements.errorRate.textContent = `${(analytics.errorRate || 0).toFixed(1)}%`;
    
    // Update top endpoints
    updateTopEndpoints(analytics.topEndpoints || []);
}

function updateTopEndpoints(endpoints) {
    const container = document.getElementById('topEndpoints');
    
    if (endpoints.length === 0) {
        container.innerHTML = '<div class="loading-message">No endpoint data available</div>';
        return;
    }
    
    const html = endpoints.map(endpoint => `
        <div class="endpoint-item">
            <div class="endpoint-name">${endpoint.endpoint}</div>
            <div class="endpoint-stats">
                <span>${endpoint.requests} requests</span>
                <span>${endpoint.tokens} tokens</span>
                <span>$${endpoint.cost.toFixed(3)} cost</span>
                <span>${endpoint.successRate}% success</span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function refreshAnalytics() {
    const timeframe = document.getElementById('analyticsTimeframe').value;
    loadAnalytics(timeframe);
    
    // Update charts with new timeframe (if charts are enabled)
    if (adminCharts && adminCharts.initialized) {
        adminCharts.updateTimeframe(timeframe);
    }
}

// Testing Functions
async function testDatabaseConnection() {
    showAdminToast('Testing database connection...', 'warning');
    
    try {
        const response = await fetch('/api/admin/test-database', {
            method: 'POST',
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminToast(`Database test: ${result.message}`, 'success');
        } else {
            throw new Error('Database test failed');
        }
    } catch (error) {
        console.error('Database test error:', error);
        showAdminToast('Database test failed', 'error');
    }
}

async function testAnthropicAPI() {
    showAdminToast('Testing Anthropic API...', 'warning');
    
    try {
        const response = await fetch('/api/admin/test-anthropic', {
            method: 'POST',
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminToast(`API test: ${result.message}`, 'success');
        } else {
            throw new Error('API test failed');
        }
    } catch (error) {
        console.error('API test error:', error);
        showAdminToast('API test failed', 'error');
    }
}

async function generateTestProject() {
    showAdminToast('Generating test project...', 'warning');
    
    try {
        const response = await fetch('/api/admin/generate-test-project', {
            method: 'POST',
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminToast(`Test project created: ${result.projectPath}`, 'success');
        } else {
            throw new Error('Test project generation failed');
        }
    } catch (error) {
        console.error('Test project error:', error);
        showAdminToast('Test project generation failed', 'error');
    }
}

async function clearSystemCache() {
    if (!confirm('Are you sure you want to clear the system cache?')) {
        return;
    }
    
    showAdminToast('Clearing system cache...', 'warning');
    
    try {
        const response = await fetch('/api/admin/clear-cache', {
            method: 'POST',
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            showAdminToast('System cache cleared', 'success');
        } else {
            throw new Error('Cache clear failed');
        }
    } catch (error) {
        console.error('Cache clear error:', error);
        showAdminToast('Failed to clear cache', 'error');
    }
}

async function exportSystemLogs() {
    showAdminToast('Exporting system logs...', 'warning');
    
    try {
        const response = await fetch('/api/admin/export-logs', {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showAdminToast('System logs exported', 'success');
        } else {
            throw new Error('Log export failed');
        }
    } catch (error) {
        console.error('Log export error:', error);
        showAdminToast('Failed to export logs', 'error');
    }
}

async function runHealthCheck() {
    showAdminToast('Running health check...', 'warning');
    
    try {
        const response = await fetch('/api/admin/health-check', {
            method: 'POST',
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const result = await response.json();
            showAdminToast(`Health check: ${result.status}`, result.healthy ? 'success' : 'error');
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        console.error('Health check error:', error);
        showAdminToast('Health check failed', 'error');
    }
}

async function testStripeWebhook() {
    console.log('💳 Testing Stripe webhook...');
    showAdminToast('Testing Stripe webhook...', 'warning');
    
    try {
        // Create a test webhook payload (simulating a successful checkout)
        const testPayload = {
            id: 'evt_test_' + Date.now(),
            object: 'event',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_test_' + Date.now(),
                    object: 'checkout_session',
                    payment_status: 'paid',
                    metadata: {
                        userId: adminState.user.id.toString(),
                        username: adminState.user.username,
                        credits: '100',
                        packageName: 'Admin Test Package'
                    }
                }
            },
            created: Math.floor(Date.now() / 1000)
        };
        
        const response = await fetch('/api/stripe-webhook-debug', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'stripe-signature': 'test_signature_from_admin'
            },
            body: JSON.stringify(testPayload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminToast('✅ Webhook endpoint is reachable!', 'success');
            console.log('Webhook test result:', result);
            
            // Show detailed results in console
            console.log('🔍 Webhook Test Details:');
            console.log('   - Endpoint Status:', response.status, response.statusText);
            console.log('   - Event Type:', testPayload.type);
            console.log('   - Test User:', adminState.user.username);
            console.log('   - Test Credits:', '100');
            console.log('   - Response:', result);
            
        } else {
            showAdminToast(`❌ Webhook failed: ${result.error || 'Unknown error'}`, 'error');
            console.error('Webhook test failed:', result);
            
            // Show debugging info
            console.log('🔍 Webhook Debug Info:');
            console.log('   - Response Status:', response.status);
            console.log('   - Response Text:', response.statusText);
            console.log('   - Error Details:', result);
        }
        
    } catch (error) {
        console.error('❌ Webhook test error:', error);
        showAdminToast('❌ Webhook test failed: ' + error.message, 'error');
    }
}

async function debugStripeEnvironment() {
    console.log('🔍 Debugging Stripe environment variables...');
    showAdminToast('Checking Stripe environment...', 'warning');
    
    try {
        const response = await fetch('/api/debug-env', {
            headers: { 'X-API-Key': adminState.apiKey }
        });
        
        if (response.ok) {
            const envInfo = await response.json();
            showAdminToast('📊 Environment info logged to console', 'success');
            
            console.log('🔍 STRIPE ENVIRONMENT DEBUG:');
            console.log('=====================================');
            console.log('NODE_ENV:', envInfo.NODE_ENV);
            console.log('VERCEL:', envInfo.VERCEL);
            console.log('');
            console.log('STRIPE_SECRET_KEY:');
            console.log('  - Exists:', envInfo.STRIPE_SECRET_KEY_EXISTS);
            console.log('  - Length:', envInfo.STRIPE_SECRET_KEY_LENGTH);
            console.log('  - Prefix:', envInfo.STRIPE_SECRET_KEY_PREFIX);
            console.log('');
            console.log('STRIPE_PUBLISHABLE_KEY:');
            console.log('  - Exists:', envInfo.STRIPE_PUBLISHABLE_KEY_EXISTS);
            console.log('  - Length:', envInfo.STRIPE_PUBLISHABLE_KEY_LENGTH);
            console.log('  - Prefix:', envInfo.STRIPE_PUBLISHABLE_KEY_PREFIX);
            console.log('');
            console.log('STRIPE_WEBHOOK_SECRET:');
            console.log('  - Exists:', envInfo.STRIPE_WEBHOOK_SECRET_EXISTS);
            console.log('  - Length:', envInfo.STRIPE_WEBHOOK_SECRET_LENGTH);
            console.log('  - Prefix:', envInfo.STRIPE_WEBHOOK_SECRET_PREFIX);
            console.log('');
            console.log('All Stripe env vars:', envInfo.ALL_STRIPE_ENV_VARS);
            console.log('=====================================');
            
            // Check for common issues
            const issues = [];
            if (!envInfo.STRIPE_WEBHOOK_SECRET_EXISTS) {
                issues.push('❌ STRIPE_WEBHOOK_SECRET is missing');
            } else if (envInfo.STRIPE_WEBHOOK_SECRET_LENGTH < 30) {
                issues.push('⚠️ STRIPE_WEBHOOK_SECRET seems too short');
            }
            
            if (!envInfo.STRIPE_SECRET_KEY_EXISTS) {
                issues.push('❌ STRIPE_SECRET_KEY is missing');
            } else if (!envInfo.STRIPE_SECRET_KEY_PREFIX.startsWith('sk_')) {
                issues.push('⚠️ STRIPE_SECRET_KEY should start with sk_');
            }
            
            if (issues.length > 0) {
                console.log('🚨 POTENTIAL ISSUES FOUND:');
                issues.forEach(issue => console.log(issue));
            } else {
                console.log('✅ No obvious environment variable issues found');
            }
            
        } else {
            throw new Error('Failed to fetch environment info');
        }
        
    } catch (error) {
        console.error('Environment debug error:', error);
        showAdminToast('❌ Environment debug failed: ' + error.message, 'error');
    }
}

async function testAddCredits() {
    console.log('➕ Testing manual credit addition...');
    showAdminToast('Testing credit addition...', 'warning');
    
    try {
        const response = await fetch('/api/debug/add-credits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': adminState.apiKey
            },
            body: JSON.stringify({
                credits: 100,
                reason: 'Admin panel test - webhook debugging'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminToast(`✅ ${result.creditsAdded} credits added! New balance: ${result.newBalance}`, 'success');
            console.log('Credit addition result:', result);
            
            // This will test if the unified credit system picks up the change
            console.log('🔄 Testing if unified credit system detects the change...');
            
        } else {
            showAdminToast(`❌ Credit addition failed: ${result.error}`, 'error');
            console.error('Credit addition failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Credit addition error:', error);
        showAdminToast('❌ Credit addition failed: ' + error.message, 'error');
    }
}

async function createTestUser() {
    const testBtn = event.target;
    const originalText = testBtn.innerHTML;
    
    try {
        testBtn.innerHTML = '<span class="test-icon">⏳</span><span class="test-label">Creating...</span>';
        testBtn.disabled = true;
        
        // Backup admin session to prevent interference
        const adminBackup = {
            apiKey: localStorage.getItem('apiKey'),
            userData: localStorage.getItem('userData')
        };
        
        // Generate random test user data
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const testUser = {
            username: `test_user_${timestamp}_${randomSuffix}`,
            email: `test_${timestamp}_${randomSuffix}@example.com`,
            password: 'TestPassword123!',
            emailUpdates: false
        };
        
        console.log('🧪 Creating test user:', testUser.username);
        
        // Create the test user
        const response = await fetch('/api/v2/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Test-Request': 'true',  // Mark as isolated test
                'X-Admin-Test': 'createTestUser'
            },
            body: JSON.stringify(testUser)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Test user created successfully:', result);
            
            // Check if API key was returned (for auto-login)
            const autoLoginStatus = result.apiKey ? '✅ Auto-login ready' : '❌ No API key - requires manual login';
            
            // Show detailed results
            showAdminToast(`✅ Test User Created: ${testUser.username}`, 'success');
            
            // Display detailed information
            const details = `
                <div style="text-align: left; font-family: monospace; font-size: 12px;">
                    <strong>Test User Details:</strong><br>
                    Username: ${testUser.username}<br>
                    Email: ${testUser.email}<br>
                    Password: ${testUser.password}<br>
                    Credits: ${result.user?.credits_remaining || 'N/A'}<br>
                    Auto-login: ${autoLoginStatus}<br>
                    <br>
                    <button onclick="navigator.clipboard.writeText('${JSON.stringify(testUser, null, 2)}')" 
                            style="padding: 4px 8px; font-size: 11px;">Copy User Data</button>
                    <button onclick="testUserLogin('${testUser.username}', '${testUser.password}')" 
                            style="padding: 4px 8px; font-size: 11px; margin-left: 4px;">Test Login</button>
                    <button onclick="quickTestAsUser('${testUser.username}', '${testUser.password}')" 
                            style="padding: 4px 8px; font-size: 11px; margin-left: 4px; background: #007bff; color: white;">Quick Test</button>
                </div>
            `;
            
            // Create a custom toast with more details
            setTimeout(() => {
                const toast = document.createElement('div');
                toast.className = 'admin-toast success';
                toast.innerHTML = details;
                toast.style.maxWidth = '500px';
                toast.style.left = '20px';
                toast.style.right = 'auto';
                toast.style.position = 'fixed';
                toast.style.top = '20px';
                toast.style.zIndex = '10000';
                toast.style.backgroundColor = '#d4edda';
                toast.style.border = '1px solid #c3e6cb';
                toast.style.borderRadius = '8px';
                toast.style.padding = '12px';
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 15000);
            }, 100);
            
        } else {
            showAdminToast(`❌ Test User Creation Failed: ${result.error}`, 'error');
            console.error('❌ Test user creation failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Test user creation error:', error);
        showAdminToast(`❌ Test User Creation Error: ${error.message}`, 'error');
    } finally {
        // Restore admin session to prevent interference
        if (adminBackup && adminBackup.apiKey && adminBackup.userData) {
            localStorage.setItem('apiKey', adminBackup.apiKey);
            localStorage.setItem('userData', adminBackup.userData);
            
            // Verify session restoration
            setTimeout(() => verifyAdminSession(), 100);
        }
        
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
    }
}

async function testNewUserFlow() {
    const testBtn = event.target;
    const originalText = testBtn.innerHTML;
    
    try {
        testBtn.innerHTML = '<span class="test-icon">⏳</span><span class="test-label">Testing Flow...</span>';
        testBtn.disabled = true;
        
        console.log('🧪 Testing complete new user flow...');
        
        // CRITICAL: Backup current admin session to protect it
        const adminBackup = {
            apiKey: localStorage.getItem('apiKey'),
            userData: localStorage.getItem('userData'),
            currentUser: adminState.user ? adminState.user.username : null
        };
        console.log('🔒 Admin session backed up:', adminBackup.currentUser);
        
        // Step 1: Create test user
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const testUser = {
            username: `newuser_${timestamp}_${randomSuffix}`,
            email: `newuser_${timestamp}_${randomSuffix}@example.com`,
            password: 'NewUserTest123!',
            emailUpdates: false
        };
        
        const flowResults = {
            registration: null,
            starterPack: null,
            libraryPopulation: null,
            autoLogin: null
        };
        
        // Test registration
        console.log('📝 Step 1: Testing registration...');
        const regResponse = await fetch('/api/v2/auth/register', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Test-Request': 'true',  // Mark as isolated test request
                'X-Admin-Test': adminBackup.currentUser || 'admin'
            },
            body: JSON.stringify(testUser)
        });
        
        const regResult = await regResponse.json();
        flowResults.registration = { success: regResponse.ok, data: regResult };
        
        if (regResponse.ok) {
            console.log('✅ Registration successful');
            
            // Check auto-login capability
            flowResults.autoLogin = { 
                apiKeyProvided: !!regResult.apiKey,
                userDataComplete: !!(regResult.user && regResult.user.username)
            };
            
            // Step 2: Check if user libraries were populated
            if (regResult.apiKey) {
                console.log('📚 Step 2: Checking library population...');
                
                // Wait a moment for starter pack to populate
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Fix: Use username, not user ID for the endpoint
                // ISOLATED: Use test user's API key explicitly to avoid session interference
                const libraryCheck = await fetch(`/api/user-libraries/${regResult.user.username}/directors`, {
                    headers: { 
                        'X-API-Key': regResult.apiKey,
                        'X-Test-Request': 'true'  // Mark as test request
                    }
                });
                
                if (libraryCheck.ok) {
                    const libraries = await libraryCheck.json();
                    flowResults.libraryPopulation = { 
                        success: true, 
                        directorCount: libraries.length,
                        populated: libraries.length > 0
                    };
                } else {
                    const errorText = await libraryCheck.text();
                    flowResults.libraryPopulation = { 
                        success: false, 
                        error: `HTTP ${libraryCheck.status}: ${errorText}` 
                    };
                }
            }
            
            // Step 3: Test login flow
            console.log('🔐 Step 3: Testing manual login...');
            const loginResponse = await fetch('/api/v2/auth/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Test-Request': 'true',  // Mark as isolated test request
                    'X-Admin-Test': adminBackup.currentUser || 'admin'
                },
                body: JSON.stringify({
                    email: testUser.email,    // Fix: Use email, not username
                    password: testUser.password
                })
            });
            
            const loginResult = await loginResponse.json();
            flowResults.manualLogin = { success: loginResponse.ok, data: loginResult };
        }
        
        // Display comprehensive results
        const resultsHtml = `
            <div style="text-align: left; font-family: monospace; font-size: 11px; max-height: 400px; overflow-y: auto;">
                <strong>🧪 New User Flow Test Results</strong><br>
                <strong>User:</strong> ${testUser.username}<br>
                <strong>Email:</strong> ${testUser.email}<br><br>
                
                <strong>1. Registration:</strong> ${flowResults.registration?.success ? '✅ SUCCESS' : '❌ FAILED'}<br>
                ${flowResults.registration?.success ? 
                    `   Credits: ${flowResults.registration.data.user?.credits_remaining || 'N/A'}<br>` : 
                    `   Error: ${flowResults.registration?.data?.error || 'Unknown error'}<br>`}
                
                <strong>2. Auto-Login Capability:</strong><br>
                   API Key Provided: ${flowResults.autoLogin?.apiKeyProvided ? '✅ YES' : '❌ NO'}<br>
                   User Data Complete: ${flowResults.autoLogin?.userDataComplete ? '✅ YES' : '❌ NO'}<br>
                
                <strong>3. Library Population:</strong> ${flowResults.libraryPopulation?.success ? '✅ SUCCESS' : '❌ FAILED'}<br>
                ${flowResults.libraryPopulation?.success ? 
                    `   Directors Populated: ${flowResults.libraryPopulation.populated ? '✅ YES' : '❌ NO'} (${flowResults.libraryPopulation.directorCount})<br>` :
                    `   Error: ${flowResults.libraryPopulation?.error || 'N/A'}<br>`}
                
                <strong>4. Manual Login:</strong> ${flowResults.manualLogin?.success ? '✅ SUCCESS' : '❌ FAILED'}<br>
                
                <br><strong>Issues Found:</strong><br>
                ${!flowResults.autoLogin?.apiKeyProvided ? '• Auto-login may fail (no API key)<br>' : ''}
                ${!flowResults.libraryPopulation?.populated ? '• Libraries not populated<br>' : ''}
                ${!flowResults.manualLogin?.success ? '• Manual login failed<br>' : ''}
                ${flowResults.autoLogin?.apiKeyProvided && flowResults.libraryPopulation?.populated && flowResults.manualLogin?.success ? '• No issues detected!<br>' : ''}
                
                <br>
                <button onclick="navigator.clipboard.writeText('${JSON.stringify(flowResults, null, 2)}')" 
                        style="padding: 4px 8px; font-size: 10px;">Copy Full Results</button>
                <button onclick="openTestUserTab('${testUser.username}', '${testUser.password}')" 
                        style="padding: 4px 8px; font-size: 10px; margin-left: 4px;">Open As New User</button>
                <button onclick="quickTestAsUser('${testUser.username}', '${testUser.password}')" 
                        style="padding: 4px 8px; font-size: 10px; margin-left: 4px; background: #007bff; color: white;">Quick Test</button>
            </div>
        `;
        
        setTimeout(() => {
            const toast = document.createElement('div');
            toast.className = 'admin-toast success';
            toast.innerHTML = resultsHtml;
            toast.style.maxWidth = '600px';
            toast.style.left = '20px';
            toast.style.right = 'auto';  
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.zIndex = '10000';
            toast.style.backgroundColor = '#d4edda';
            toast.style.border = '1px solid #c3e6cb';
            toast.style.borderRadius = '8px';
            toast.style.padding = '12px';
            toast.style.maxHeight = '500px';
            document.body.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 20000);
        }, 100);
        
        console.log('🏁 New user flow test completed:', flowResults);
        
    } catch (error) {
        console.error('❌ New user flow test error:', error);
        showAdminToast(`❌ New User Flow Test Error: ${error.message}`, 'error');
    } finally {
        // CRITICAL: Restore admin session to prevent interference
        if (typeof adminBackup !== 'undefined' && adminBackup.apiKey && adminBackup.userData) {
            console.log('🔒 Restoring admin session for:', adminBackup.currentUser);
            localStorage.setItem('apiKey', adminBackup.apiKey);
            localStorage.setItem('userData', adminBackup.userData);
            
            // Verify the session is actually restored
            const restoredUser = JSON.parse(adminBackup.userData);
            if (restoredUser && restoredUser.username !== adminState.user?.username) {
                console.log('🔄 Admin session restored, updating state...');
                adminState.user = restoredUser;
                adminState.apiKey = adminBackup.apiKey;
            }
            
            // Double-check the session is working
            setTimeout(() => verifyAdminSession(), 100);
        } else {
            console.warn('⚠️ Could not restore admin session - backup missing');
            showAdminToast('⚠️ Admin session may be affected. Use "Restore Admin Session" if needed.', 'warning');
        }
        
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
    }
}

// Helper function to test login for a specific user
async function testUserLogin(username, password) {
    try {
        // Note: We need to construct the email from username for testing
        // In real scenarios, users would use their actual email
        const email = username.includes('@') ? username : `${username}@example.com`;
        
        const response = await fetch('/api/v2/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email,    // Use email, not username
                password: password 
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAdminToast(`✅ Login test successful for ${username}`, 'success');
            console.log('✅ Login test passed:', result);
        } else {
            showAdminToast(`❌ Login test failed for ${username}: ${result.error}`, 'error');
            console.error('❌ Login test failed:', result);
        }
    } catch (error) {
        showAdminToast(`❌ Login test error: ${error.message}`, 'error');
        console.error('❌ Login test error:', error);
    }
}

// Helper function to open login page with test user credentials  
function openTestUserTab(username, password) {
    // Create a clean session by opening in incognito-like mode with session clearing
    const loginUrl = `login.html?test_user=${encodeURIComponent(username)}&test_pass=${encodeURIComponent(password)}&clear_session=true`;
    
    // Option 1: Open in new window and instruct user to clear session
    const newWindow = window.open(loginUrl, '_blank', 'width=1200,height=800');
    
    // Show instructions to the user
    setTimeout(() => {
        const instructions = `
            <div style="text-align: left; font-family: monospace; font-size: 12px;">
                <strong>🧪 Test User Session Instructions</strong><br><br>
                <strong>New window opened!</strong> To test as the new user:<br><br>
                <strong>Option 1 (Recommended):</strong><br>
                • Use incognito/private browsing mode<br>
                • Copy this URL and paste in incognito window:<br>
                <input type="text" value="${window.location.origin}/${loginUrl}" 
                       style="width: 100%; font-size: 10px; padding: 4px; margin: 4px 0;"
                       onclick="this.select()" readonly><br>
                
                <strong>Option 2 (Quick test):</strong><br>
                • In the new window, open DevTools (F12)<br>
                • Go to Application → Storage → Clear storage<br>
                • Click "Clear site data"<br>
                • Refresh the page<br><br>
                
                <strong>Test User Credentials:</strong><br>
                Email: ${username.includes('@') ? username : username + '@example.com'}<br>
                Password: ${password}<br><br>
                
                <button onclick="navigator.clipboard.writeText('${username.includes('@') ? username : username + '@example.com'}')" 
                        style="padding: 4px 8px; font-size: 10px;">Copy Email</button>
                <button onclick="navigator.clipboard.writeText('${password}')" 
                        style="padding: 4px 8px; font-size: 10px; margin-left: 4px;">Copy Password</button>
            </div>
        `;
        
        const toast = document.createElement('div');
        toast.className = 'admin-toast success';
        toast.innerHTML = instructions;
        toast.style.maxWidth = '600px';
        toast.style.left = '20px';
        toast.style.right = 'auto';
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.zIndex = '10000';
        toast.style.backgroundColor = '#e6f3ff';
        toast.style.border = '1px solid #b3d9ff';
        toast.style.borderRadius = '8px';
        toast.style.padding = '12px';
        toast.style.maxHeight = '400px';
        document.body.appendChild(toast);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'position: absolute; top: 8px; right: 12px; background: none; border: none; font-size: 18px; cursor: pointer;';
        closeBtn.onclick = () => toast.remove();
        toast.appendChild(closeBtn);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 30000);
         }, 100);
}

// Helper function for quick testing - logs out current user and logs in as test user
async function quickTestAsUser(username, password) {
    try {
        const email = username.includes('@') ? username : `${username}@example.com`;
        
        showAdminToast('🔄 Switching to test user...', 'warning');
        console.log('🧪 Quick Test: Starting user switch to:', username);
        
        // Step 1: Clear current session completely
        console.log('🧪 Quick Test: Clearing current session...');
        localStorage.clear();
        sessionStorage.clear();
        
        // Also clear any other possible auth storage
        localStorage.removeItem('apiKey');
        localStorage.removeItem('userData');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userSession');
        
        // Step 2: Login as test user
        console.log('🧪 Quick Test: Attempting login as:', email);
        const response = await fetch('/api/v2/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email,
                password: password 
            })
        });
        
        const result = await response.json();
        console.log('🧪 Quick Test: Login response:', response.ok, result);
        
        if (response.ok && result.apiKey && result.user) {
            // Step 3: Store new session data
            console.log('🧪 Quick Test: Storing new session for:', result.user.username);
            localStorage.setItem('apiKey', result.apiKey);
            localStorage.setItem('userData', JSON.stringify(result.user));
            
            showAdminToast(`✅ Successfully logged in as: ${result.user.username}`, 'success');
            
            // Step 4: Force a complete page reload to ensure clean state
            console.log('🧪 Quick Test: Redirecting to main app...');
            setTimeout(() => {
                // Use location.replace to ensure no back button issues
                window.location.replace('index.html?test_mode=true&user=' + encodeURIComponent(result.user.username));
            }, 1000);
            
        } else {
            console.error('🧪 Quick Test: Login failed:', result);
            showAdminToast(`❌ Failed to login as test user: ${result.error || 'Unknown error'}`, 'error');
            
            // Restore original session if available
            const originalApiKey = prompt('Quick test failed. Enter your admin API key to restore session (or cancel to stay logged out):');
            if (originalApiKey) {
                localStorage.setItem('apiKey', originalApiKey);
                location.reload();
            }
        }
        
    } catch (error) {
        console.error('🧪 Quick Test error:', error);
        showAdminToast(`❌ Quick test error: ${error.message}`, 'error');
        
        // Offer to restore session
        setTimeout(() => {
            if (confirm('Quick test failed. Would you like to reload the admin page to restore your session?')) {
                location.reload();
            }
        }, 2000);
         }
}

// Helper function to restore admin session when testing gets mixed up
async function restoreAdminSession() {
    try {
        showAdminToast('🔄 Restoring admin session...', 'warning');
        
        // Clear any mixed state
        localStorage.clear();
        sessionStorage.clear();
        
        // Ask for admin credentials
        const email = prompt('Enter your admin email:');
        if (!email) return;
        
        const password = prompt('Enter your admin password:');
        if (!password) return;
        
        console.log('🔄 Attempting admin session restore for:', email);
        
        const response = await fetch('/api/v2/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email,
                password: password 
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.user && result.user.is_admin) {
            localStorage.setItem('apiKey', result.apiKey);
            localStorage.setItem('userData', JSON.stringify(result.user));
            
            showAdminToast(`✅ Admin session restored for: ${result.user.username}`, 'success');
            
            setTimeout(() => {
                location.reload();
            }, 1000);
            
        } else if (response.ok && result.user && !result.user.is_admin) {
            showAdminToast('❌ Account found but not an admin account', 'error');
        } else {
            showAdminToast(`❌ Login failed: ${result.error || 'Invalid credentials'}`, 'error');
        }
        
    } catch (error) {
        console.error('Admin session restore error:', error);
        showAdminToast(`❌ Restore error: ${error.message}`, 'error');
    }
}

async function testStarterPackSystem() {
    const testBtn = event.target;
    const originalText = testBtn.innerHTML;
    
    try {
        testBtn.innerHTML = '<span class="test-icon">⏳</span><span class="test-label">Testing...</span>';
        testBtn.disabled = true;
        
        console.log('📚 Testing starter pack system...');
        
        // Step 1: Test if we can create a user and manually populate starter pack
        const timestamp = Date.now();
        const testUser = {
            username: `startertest_${timestamp}`,
            email: `startertest_${timestamp}@example.com`,
            password: 'StarterTest123!',
            emailUpdates: false
        };
        
        console.log('📝 Creating test user for starter pack test...');
        const regResponse = await fetch('/api/v2/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const regResult = await regResponse.json();
        
        if (!regResponse.ok) {
            showAdminToast(`❌ Failed to create test user: ${regResult.error}`, 'error');
            return;
        }
        
        const username = regResult.user.username;
        const apiKey = regResult.apiKey;
        
        console.log('✅ Test user created, now testing starter pack manually...');
        
        // Step 2: Manually trigger starter pack population
        const populateResponse = await fetch(`/api/user-libraries/${username}/populate-starter-pack`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': apiKey 
            },
            body: JSON.stringify({})
        });
        
        const populateResult = populateResponse.ok ? await populateResponse.json() : await populateResponse.text();
        
        // Step 3: Check each library type
        const libraryTypes = ['directors', 'screenwriters', 'films', 'tones', 'characters'];
        const libraryResults = {};
        
        for (const type of libraryTypes) {
            try {
                console.log(`📖 Checking ${type} library...`);
                const response = await fetch(`/api/user-libraries/${username}/${type}`, {
                    headers: { 'X-API-Key': apiKey }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    libraryResults[type] = { 
                        success: true, 
                        count: data.length,
                        sampleEntries: data.slice(0, 3).map(entry => entry.entry_key || entry.entry_data?.name)
                    };
                } else {
                    const errorText = await response.text();
                    libraryResults[type] = { 
                        success: false, 
                        error: `HTTP ${response.status}: ${errorText}` 
                    };
                }
            } catch (error) {
                libraryResults[type] = { 
                    success: false, 
                    error: error.message 
                };
            }
        }
        
        // Display results
        const resultsHtml = `
            <div style="text-align: left; font-family: monospace; font-size: 11px; max-height: 400px; overflow-y: auto;">
                <strong>📚 Starter Pack System Test Results</strong><br>
                <strong>Test User:</strong> ${username}<br><br>
                
                <strong>Manual Population:</strong> ${populateResponse.ok ? '✅ SUCCESS' : '❌ FAILED'}<br>
                ${!populateResponse.ok ? `Error: ${populateResult}<br>` : ''}
                <br>
                
                <strong>Library Population Results:</strong><br>
                ${libraryTypes.map(type => {
                    const result = libraryResults[type];
                    const status = result.success ? '✅' : '❌';
                    const details = result.success ? 
                        `${result.count} entries (${result.sampleEntries.join(', ')})` :
                        `Error: ${result.error}`;
                    return `${status} ${type}: ${details}`;
                }).join('<br>')}<br>
                <br>
                
                <strong>Summary:</strong><br>
                • Total libraries tested: ${libraryTypes.length}<br>
                • Successful: ${Object.values(libraryResults).filter(r => r.success).length}<br>
                • Failed: ${Object.values(libraryResults).filter(r => !r.success).length}<br>
                • Overall status: ${Object.values(libraryResults).every(r => r.success) ? '✅ ALL WORKING' : '❌ SOME ISSUES'}<br>
                <br>
                
                <button onclick="navigator.clipboard.writeText('${JSON.stringify(libraryResults, null, 2)}')" 
                        style="padding: 4px 8px; font-size: 10px;">Copy Full Results</button>
                <button onclick="openTestUserTab('${username}', '${testUser.password}')" 
                        style="padding: 4px 8px; font-size: 10px; margin-left: 4px;">Open As User</button>
                <button onclick="quickTestAsUser('${username}', '${testUser.password}')" 
                        style="padding: 4px 8px; font-size: 10px; margin-left: 4px; background: #007bff; color: white;">Quick Test</button>
            </div>
        `;
        
        setTimeout(() => {
            const toast = document.createElement('div');
            toast.className = 'admin-toast success';
            toast.innerHTML = resultsHtml;
            toast.style.maxWidth = '650px';
            toast.style.left = '20px';
            toast.style.right = 'auto';
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.zIndex = '10000';
            toast.style.backgroundColor = '#d4edda';
            toast.style.border = '1px solid #c3e6cb';
            toast.style.borderRadius = '8px';
            toast.style.padding = '12px';
            toast.style.maxHeight = '500px';
            document.body.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 25000);
        }, 100);
        
        console.log('📚 Starter pack test completed:', libraryResults);
        
    } catch (error) {
        console.error('❌ Starter pack test error:', error);
        showAdminToast(`❌ Starter Pack Test Error: ${error.message}`, 'error');
    } finally {
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
    }
}

// Quick Action Functions
async function viewErrorLogs() {
    showAdminToast('Feature coming soon', 'warning');
}

async function backupDatabase() {
    if (!confirm('Are you sure you want to create a database backup?')) {
        return;
    }
    
    showAdminToast('Creating database backup...', 'warning');
    showAdminToast('Feature coming soon', 'warning');
}

async function maintenanceMode() {
    showAdminToast('Feature coming soon', 'warning');
}

async function broadcastMessage() {
    showAdminToast('Feature coming soon', 'warning');
}

// Toast Notification System
function showAdminToast(message, type = 'success') {
    const toast = document.getElementById('adminToast');
    const messageSpan = document.getElementById('toastMessage');
    
    if (!toast || !messageSpan) return;
    
    // Set message and type
    messageSpan.textContent = message;
    toast.className = `toast ${type}`;
    
    // Show toast
    toast.classList.add('show');
    
    // Auto-hide after 5 seconds (except for warnings which might contain important info)
    if (type !== 'warning') {
        setTimeout(() => {
            hideAdminToast();
        }, 5000);
    }
}

function hideAdminToast() {
    const toast = document.getElementById('adminToast');
    if (toast) {
        toast.classList.remove('show');
    }
}

// Event Listeners
function setupEventListeners() {
    // Analytics timeframe change
    const timeframeSelect = document.getElementById('analyticsTimeframe');
    if (timeframeSelect) {
        timeframeSelect.addEventListener('change', refreshAnalytics);
    }
    
    // Search on Enter key
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchUsers();
            }
        });
    }
    
    // Modal Enter key handling for Create User Modal
    const createUserInputs = ['newUsername', 'newUserEmail', 'initialCredits'];
    createUserInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    createUser();
                }
            });
        }
    });
    
    // Modal Enter key handling for Grant Credits Modal
    const grantCreditsInputs = ['creditUsername', 'creditAmount', 'creditNotes'];
    grantCreditsInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    grantCredits();
                }
            });
        }
    });
    
    // Modal click outside to close
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

// Helper function to verify admin session is still intact
function verifyAdminSession() {
    const apiKey = localStorage.getItem('apiKey');
    const userData = localStorage.getItem('userData');
    
    if (!apiKey || !userData) {
        console.warn('⚠️ Admin session missing after test');
        showAdminToast('⚠️ Admin session lost. Please refresh page.', 'warning');
        return false;
    }
    
    try {
        const user = JSON.parse(userData);
        if (!user.is_admin) {
            console.warn('⚠️ Non-admin session detected after test');
            showAdminToast('⚠️ Non-admin user detected. Use "Restore Admin Session".', 'error');
            return false;
        }
        
        console.log('✅ Admin session verified:', user.username);
        return true;
    } catch (error) {
        console.error('❌ Error verifying admin session:', error);
        showAdminToast('❌ Session verification failed. Please refresh page.', 'error');
        return false;
    }
}

// Auto-refresh system status every 30 seconds
setInterval(() => {
    if (document.visibilityState === 'visible') {
        checkSystemStatus();
        // Also verify admin session periodically
        verifyAdminSession();
    }
}, 30000); 