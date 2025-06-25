/* =================================
   CREDIT SYSTEM JAVASCRIPT
   ================================= */

// Credit System State
let currentCredits = 0;
let usageHistory = [];
let creditModelPricing = {};
let isLoadingCredits = false;

// API Configuration
const CREDIT_ENDPOINTS = {
    myStats: '/api/my-stats',
    modelPricing: '/api/model-pricing',
    estimateCost: '/api/estimate-cost'
};

/**
 * Initialize Credit System
 */
function initializeCreditSystem() {
    console.log('Initializing Credit System...');
    
    // Load initial data
    loadCreditData();
    
    // Set up refresh intervals
    setupRefreshIntervals();
    
    // Set up event listeners
    setupEventListeners();
}

/**
 * Load Credit Data from API
 */
async function loadCreditData() {
    if (isLoadingCredits) return;
    
    isLoadingCredits = true;
    
    try {
        // Check if user is authenticated
        const apiKey = localStorage.getItem('apiKey');
        
        // Always load model pricing (public endpoint)
        const pricingResponse = await fetch(CREDIT_ENDPOINTS.modelPricing);
        
        if (pricingResponse.ok) {
            const pricingData = await pricingResponse.json();
            creditModelPricing = pricingData;
            updateModelPricingDisplay(pricingData);
        } else {
            console.warn('Failed to load model pricing:', await pricingResponse.text());
        }
        
        // Only load user stats if user is authenticated
        if (apiKey) {
            try {
                const statsResponse = await fetchWithAuth(CREDIT_ENDPOINTS.myStats);
                
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    updateCreditDisplay(statsData);
                    updateUsageHistory(statsData.recentUsage || []);
                } else {
                    console.warn('Failed to load user stats:', await statsResponse.text());
                    showOfflineMode();
                }
            } catch (error) {
                console.error('Error loading user stats:', error);
                showOfflineMode();
            }
        } else {
            // User not authenticated - show guest mode
            showGuestMode();
        }
        
    } catch (error) {
        console.error('Error loading credit data:', error);
        showOfflineMode();
    } finally {
        isLoadingCredits = false;
    }
}

/**
 * Update Credit Display Elements
 */
function updateCreditDisplay(data) {
    currentCredits = data.credits || 0;
    
    // Update header badge
    updateHeaderBadge(currentCredits, data);
    
    // Update profile dashboard
    updateProfileDashboard(data);
    
    // Check for low balance warnings
    checkLowBalanceWarning(currentCredits);
}

/**
 * Update Header Credit Badge
 */
function updateHeaderBadge(credits, data) {
    const creditsAmount = document.getElementById('creditsAmount');
    const creditsBadge = document.getElementById('creditsBadge');
    const tooltipBalance = document.getElementById('tooltipBalance');
    const tooltipUsage = document.getElementById('tooltipUsage');
    
    if (!creditsAmount) return;
    
    // Update amount
    creditsAmount.textContent = formatCredits(credits);
    
    // Update badge color based on balance
    creditsBadge.className = 'credits-badge ' + getCreditStatusClass(credits);
    
    // Update tooltip
    if (tooltipBalance) tooltipBalance.textContent = formatCredits(credits);
    if (tooltipUsage && data.weeklyUsage) {
        tooltipUsage.textContent = formatCredits(data.weeklyUsage) + ' used';
    }
}

/**
 * Update Profile Dashboard
 */
function updateProfileDashboard(data) {
    // Main balance
    const balanceNumber = document.getElementById('balanceNumber');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const estimatedGenerations = document.getElementById('estimatedGenerations');
    
    if (balanceNumber) {
        balanceNumber.textContent = formatCredits(data.credits);
        balanceNumber.classList.add('fade-in');
    }
    
    if (statusDot && statusText) {
        const status = getCreditStatus(data.credits);
        statusDot.className = 'status-dot ' + status.class;
        statusText.textContent = status.text;
    }
    
    if (estimatedGenerations) {
        const avgCost = 30; // Average cost per generation
        const estimates = Math.floor(data.credits / avgCost);
        estimatedGenerations.textContent = estimates;
    }
    
    // Stats cards
    updateStatsCards(data);
}

/**
 * Update Stats Cards
 */
function updateStatsCards(data) {
    const thisWeekUsage = document.getElementById('thisWeekUsage');
    const totalRequests = document.getElementById('totalRequests');
    const avgCostPerRequest = document.getElementById('avgCostPerRequest');
    
    if (thisWeekUsage) {
        thisWeekUsage.textContent = formatCredits(data.weeklyUsage || 0);
        thisWeekUsage.classList.add('slide-up');
    }
    
    if (totalRequests) {
        totalRequests.textContent = data.totalRequests || 0;
        totalRequests.classList.add('slide-up');
    }
    
    if (avgCostPerRequest && data.totalRequests > 0) {
        const avg = Math.round(data.totalCreditsUsed / data.totalRequests);
        avgCostPerRequest.textContent = formatCredits(avg);
        avgCostPerRequest.classList.add('slide-up');
    }
}

/**
 * Update Usage History
 */
function updateUsageHistory(usage) {
    const usageList = document.getElementById('usageList');
    if (!usageList) return;
    
    usageHistory = usage;
    
    if (usage.length === 0) {
        usageList.innerHTML = '<div class="usage-loading">No usage history yet</div>';
        return;
    }
    
    usageList.innerHTML = usage.slice(0, 10).map(item => `
        <div class="usage-item slide-up">
            <div class="usage-info">
                <div class="usage-endpoint">${item.endpoint || 'Unknown'}</div>
                <div class="usage-details">
                    ${formatDate(item.timestamp)} • 
                    ${item.input_tokens || 0} in, ${item.output_tokens || 0} out • 
                    ${item.model || 'Unknown Model'}
                </div>
            </div>
            <div class="usage-cost">${formatCredits(item.total_cost)}</div>
        </div>
    `).join('');
}

/**
 * Update Model Pricing Display
 */
function updateModelPricingDisplay(pricingData) {
    const pricingCards = document.getElementById('pricingCards');
    if (!pricingCards) return;
    
    // Handle both object format and array format from server
    let models;
    if (pricingData.pricing && Array.isArray(pricingData.pricing)) {
        // Server response format
        models = pricingData.pricing;
    } else if (Array.isArray(pricingData)) {
        // Array format
        models = pricingData;
    } else {
        // Object format
        models = Object.entries(pricingData).map(([model, data]) => ({
            model,
            ...data
        }));
    }
    
    pricingCards.innerHTML = models.map(model => `
        <div class="pricing-card ${model.model.includes('sonnet') ? 'recommended' : ''}">
            <div class="pricing-model">${model.model}</div>
            <div class="pricing-description">${model.description || 'AI language model'}</div>
            <div class="pricing-cost">
                Input: ${formatCredits(model.inputCostPer1K || model.input_credits_per_1k || 0)}/1K tokens<br>
                Output: ${formatCredits(model.outputCostPer1K || model.output_credits_per_1k || 0)}/1K tokens
            </div>
        </div>
    `).join('');
}

/**
 * Check and Display Low Balance Warning
 */
function checkLowBalanceWarning(credits) {
    const warningThreshold = 100; // 100 credits
    const existingWarning = document.querySelector('.low-credits-warning');
    
    if (credits < warningThreshold && !existingWarning) {
        showLowCreditsWarning(credits);
    } else if (credits >= warningThreshold && existingWarning) {
        existingWarning.remove();
    }
}

/**
 * Show Low Credits Warning
 */
function showLowCreditsWarning(credits) {
    const profileContainer = document.querySelector('.profile-container');
    const creditsDashboard = document.querySelector('.credits-dashboard');
    
    if (!profileContainer) return;
    
    const warning = document.createElement('div');
    warning.className = 'low-credits-warning fade-in';
    warning.innerHTML = `
        <div class="warning-icon">⚠️</div>
        <div class="warning-content">
            <div class="warning-title">Low Credit Balance</div>
            <div class="warning-message">
                You have ${formatCredits(credits)} remaining. 
                Add credits to continue generating content.
            </div>
        </div>
        <div class="warning-action">
            <button class="btn btn-primary btn-sm" onclick="addCredits()">Add Credits</button>
        </div>
    `;
    
    if (creditsDashboard) {
        creditsDashboard.parentNode.insertBefore(warning, creditsDashboard);
    } else {
        profileContainer.insertBefore(warning, profileContainer.firstChild);
    }
}

/**
 * Show Guest Mode
 */
function showGuestMode() {
    const creditsAmount = document.getElementById('creditsAmount');
    const balanceNumber = document.getElementById('balanceNumber');
    
    if (creditsAmount) creditsAmount.textContent = '0';
    if (balanceNumber) balanceNumber.textContent = '0';
    
    console.log('Credit system in guest mode - user not authenticated');
}

/**
 * Show Offline Mode
 */
function showOfflineMode() {
    const creditsAmount = document.getElementById('creditsAmount');
    const balanceNumber = document.getElementById('balanceNumber');
    
    if (creditsAmount) creditsAmount.textContent = '?';
    if (balanceNumber) balanceNumber.textContent = '?';
    
    console.log('Credit system in offline mode - API not available');
}

/**
 * Utility Functions
 */
function formatCredits(amount) {
    if (amount === null || amount === undefined) return '--';
    return Math.round(amount * 100) / 100;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getCreditStatus(credits) {
    if (credits < 50) return { class: 'low', text: 'Low' };
    if (credits < 200) return { class: 'medium', text: 'Medium' };
    return { class: 'high', text: 'Good' };
}

function getCreditStatusClass(credits) {
    if (credits < 50) return 'low';
    if (credits < 200) return 'medium';
    return 'high';
}

/**
 * Fetch with Authentication
 */
async function fetchWithAuth(url, options = {}) {
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
        throw new Error('No API key found');
    }
    
    return fetch(url, {
        ...options,
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
}

/**
 * Setup Refresh Intervals
 */
function setupRefreshIntervals() {
    // Refresh credit data every 30 seconds
    setInterval(loadCreditData, 30000);
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Refresh button if it exists
    const refreshBtn = document.getElementById('refreshCredits');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCreditData);
    }
}

/**
 * User Action Handlers
 */
function addCredits() {
    alert('Credit purchasing not yet implemented. Contact admin for credits.');
}

function viewUsageHistory() {
    // Scroll to usage section if on profile page
    const usageSection = document.getElementById('usageBreakdown');
    if (usageSection) {
        usageSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Pre-Purchase Cost Estimation
 */
async function estimateActionCost(action, parameters = {}) {
    try {
        const response = await fetch(CREDIT_ENDPOINTS.estimateCost, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action,
                parameters
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.estimatedCost;
        }
    } catch (error) {
        console.error('Error estimating cost:', error);
    }
    
    // Return default estimates
    const defaultCosts = {
        'generate-structure': 30,
        'generate-plot-points': 20,
        'generate-scenes': 15,
        'generate-dialogue': 25
    };
    
    return defaultCosts[action] || 20;
}

/**
 * Show Cost Confirmation Dialog
 */
function showCostConfirmation(action, estimatedCost, callback) {
    const confirmed = confirm(
        `This action will cost approximately ${formatCredits(estimatedCost)} credits.\n\n` +
        `Your current balance: ${formatCredits(currentCredits)} credits\n\n` +
        `Continue?`
    );
    
    if (confirmed) {
        callback();
    }
}

/**
 * Initialize on Page Load
 */
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on a page with credit elements
    if (document.getElementById('creditsAmount') || document.getElementById('creditsDashboard')) {
        initializeCreditSystem();
    }
});

// Export for use in other scripts
window.CreditSystem = {
    loadCreditData,
    estimateActionCost,
    showCostConfirmation,
    formatCredits,
    currentCredits: () => currentCredits
}; 