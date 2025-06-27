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

// Auto-refresh system status every 30 seconds
setInterval(() => {
    if (document.visibilityState === 'visible') {
        checkSystemStatus();
    }
}, 30000); 