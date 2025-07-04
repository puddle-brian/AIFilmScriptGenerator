/**
 * Unified Credit System - Single Source of Truth
 * 
 * This replaces the fragmented credit widget system with a unified approach
 * that prevents flashing and ensures consistent display across all pages.
 */

class UnifiedCreditSystem {
  constructor() {
    this.apiKey = localStorage.getItem('apiKey') || '';
    this.balance = null; // null means not loaded yet
    this.isLoading = false;
    this.updateInterval = null;
    this.elements = new Map(); // Track all credit display elements
    this.hasInitialized = false;
  }

  // Single initialization method
  static init(apiKey = null) {
    if (window.unifiedCredits) {
      // Already initialized, just update API key if provided
      if (apiKey) {
        window.unifiedCredits.setApiKey(apiKey);
      }
      return window.unifiedCredits;
    }

    window.unifiedCredits = new UnifiedCreditSystem();
    if (apiKey) {
      window.unifiedCredits.setApiKey(apiKey);
    }
    
    window.unifiedCredits.initialize();
    return window.unifiedCredits;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    localStorage.setItem('apiKey', apiKey);
    this.fetchBalance();
  }

  async initialize() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    console.log('🎯 Initializing Unified Credit System');
    
    // Find and register all credit display elements
    this.registerElements();
    
    // Set initial loading state
    this.showLoadingState();
    
    // Fetch balance if we have an API key
    if (this.apiKey) {
      await this.fetchBalance();
    } else {
      this.showUnauthenticatedState();
    }
    
    // Start periodic updates
    this.startPeriodicUpdates();
    
    console.log('✅ Unified Credit System initialized');
  }

  registerElements() {
    // Main page elements
    const mainAmount = document.getElementById('creditsAmount');
    const mainBadge = document.getElementById('creditsBadge');
    const tooltipBalance = document.getElementById('tooltipBalance');
    
    // Buy credits page elements
    const buyCreditsBalance = document.getElementById('currentBalanceAmount');
    const buyCreditsContainer = document.getElementById('currentBalance');
    const dashboardBalance = document.getElementById('dashboardBalance');
    
    if (mainAmount) {
      this.elements.set('mainAmount', mainAmount);
    }
    if (mainBadge) {
      this.elements.set('mainBadge', mainBadge);
    }
    if (tooltipBalance) {
      this.elements.set('tooltipBalance', tooltipBalance);
    }
    if (buyCreditsBalance) {
      this.elements.set('buyCreditsBalance', buyCreditsBalance);
    }
    if (buyCreditsContainer) {
      this.elements.set('buyCreditsContainer', buyCreditsContainer);
    }
    if (dashboardBalance) {
      this.elements.set('dashboardBalance', dashboardBalance);
    }

    console.log(`📋 Registered ${this.elements.size} credit display elements`);
  }

  showLoadingState() {
    // Show loading state immediately to prevent flashing
    this.elements.forEach((element, key) => {
      if (key === 'mainAmount' || key === 'tooltipBalance' || key === 'buyCreditsBalance' || key === 'dashboardBalance') {
        element.textContent = '--';
      }
      if (key === 'mainBadge') {
        element.className = 'credits-badge loading';
      }
      if (key === 'buyCreditsContainer') {
        element.style.display = 'none'; // Hide until loaded
      }
    });
  }

  showUnauthenticatedState() {
    this.elements.forEach((element, key) => {
      if (key === 'mainAmount' || key === 'tooltipBalance' || key === 'buyCreditsBalance' || key === 'dashboardBalance') {
        element.textContent = '--';
      }
      if (key === 'mainBadge') {
        element.className = 'credits-badge unauthenticated';
      }
      if (key === 'buyCreditsContainer') {
        element.style.display = 'none';
      }
    });
  }

  async fetchBalance() {
    if (!this.apiKey || this.isLoading) return;

    this.isLoading = true;
    
    try {
      // 🌐 Use centralized API client with consistent error handling
      if (window.apiClient) {
        window.apiClient.setApiKey(this.apiKey);
        const data = await window.apiClient.getMyStats();
        
        const newBalance = data.user.credits_remaining || 0;
        
        console.log(`💰 Fetched balance: ${newBalance} (previous: ${this.balance})`);
        
        // Only update if balance actually changed to prevent unnecessary re-renders
        if (this.balance !== newBalance) {
          console.log(`🔄 Balance changed from ${this.balance} to ${newBalance}, updating displays`);
          this.balance = newBalance;
          this.updateAllDisplays();
        } else {
          console.log(`⏹️ Balance unchanged at ${this.balance}, skipping update`);
        }
      } else {
        // Fallback to direct fetch if API client not available
        const baseUrl = window.location.hostname === 'localhost' ? 
          'https://screenplaygenie.com' : '';
        
        const response = await fetch(`${baseUrl}/api/my-stats`, {
          headers: { 'X-API-Key': this.apiKey }
        });
        
        if (response.ok) {
          const data = await response.json();
          const newBalance = data.user.credits_remaining || 0;
          
          console.log(`💰 Fetched balance: ${newBalance} (previous: ${this.balance})`);
          
          if (this.balance !== newBalance) {
            console.log(`🔄 Balance changed from ${this.balance} to ${newBalance}, updating displays`);
            this.balance = newBalance;
            this.updateAllDisplays();
          } else {
            console.log(`⏹️ Balance unchanged at ${this.balance}, skipping update`);
          }
        } else {
          console.warn('Failed to fetch credits:', response.status);
          this.showErrorState();
        }
      }
    } catch (error) {
      console.warn('Credit fetch error:', error);
      this.showErrorState();
    } finally {
      this.isLoading = false;
    }
  }

  updateAllDisplays() {
    if (this.balance === null) return;

    console.log(`💳 Updating all credit displays: ${this.balance} credits`);

    this.elements.forEach((element, key) => {
      if (key === 'mainAmount' || key === 'tooltipBalance') {
        element.textContent = this.balance;
      }
      
      if (key === 'buyCreditsBalance' || key === 'dashboardBalance') {
        element.textContent = this.balance;
      }
      
      if (key === 'buyCreditsContainer') {
        element.style.display = 'block';
      }
      
      if (key === 'mainBadge') {
        // Update badge styling based on balance
        element.className = `credits-badge ${this.getCreditLevel()}`;
      }
    });

    // Update buy credits button visibility
    this.updateBuyCreditsButton();
    
    // Update tooltip action
    this.updateTooltipAction();
  }

  getCreditLevel() {
    if (this.balance === 0) return 'critical';
    if (this.balance < 50) return 'low';
    if (this.balance < 200) return 'medium';
    return 'high';
  }

  updateBuyCreditsButton() {
    const buyCreditsButton = document.getElementById('buyCreditsButton');
    if (buyCreditsButton) {
      if (this.balance < 100) {
        buyCreditsButton.classList.add('show-low-credits');
      } else {
        buyCreditsButton.classList.remove('show-low-credits');
      }
    }
  }

  updateTooltipAction() {
    const tooltipAction = document.querySelector('.tooltip-action a');
    if (tooltipAction) {
      // Always link to buy-credits page for better UX
      tooltipAction.textContent = '💳 Manage Credits →';
      tooltipAction.href = 'buy-credits.html';
    }
  }

  showErrorState() {
    this.elements.forEach((element, key) => {
      if (key === 'mainAmount' || key === 'tooltipBalance' || key === 'buyCreditsBalance' || key === 'dashboardBalance') {
        element.textContent = '--';
      }
      if (key === 'mainBadge') {
        element.className = 'credits-badge error';
      }
      if (key === 'buyCreditsContainer') {
        element.style.display = 'none';
      }
    });
  }

  // API for other parts of the app
  async canAfford(estimatedCost = 10) {
    if (!this.apiKey) return false;
    if (this.balance === null) await this.fetchBalance();
    return this.balance >= estimatedCost;
  }

  async showCostEstimate(prompt, operation = 'generation') {
    if (!this.apiKey) return true;

    try {
      // 🌐 Use centralized API client with consistent error handling
      if (window.apiClient) {
        window.apiClient.setApiKey(this.apiKey);
        const estimate = await window.apiClient.estimateCost({
          prompt: prompt,
          model: 'claude-3-5-sonnet-20241022'
        });
        
        if (!estimate.sufficient) {
          this.showInsufficientCreditsModal(estimate);
          return false;
        }

        return true;
      } else {
        // Fallback to direct fetch if API client not available
        const baseUrl = window.location.hostname === 'localhost' ? 
          'https://screenplaygenie.com' : '';
        
        const response = await fetch(`${baseUrl}/api/estimate-cost`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey
          },
          body: JSON.stringify({
            prompt: prompt,
            model: 'claude-3-5-sonnet-20241022'
          })
        });

        const estimate = await response.json();
        
        if (!estimate.sufficient) {
          this.showInsufficientCreditsModal(estimate);
          return false;
        }

        return true;
      }
    } catch (error) {
      console.warn('Credit estimate failed:', error);
      return true; // Don't block on estimate failure
    }
  }

  async refreshAfterOperation() {
    await this.fetchBalance();
  }

  showInsufficientCreditsModal(estimate) {
    const modal = document.createElement('div');
    modal.className = 'credit-modal';
    modal.innerHTML = `
      <div class="credit-modal-content">
        <h3>⚠️ Insufficient Credits</h3>
        <div class="insufficient-credits-info">
          <div class="credit-requirement">
            <p>This operation requires <strong>${estimate.creditsRequired}</strong> credits</p>
            <p>You have <strong>${estimate.userCreditsRemaining}</strong> credits remaining</p>
            <p class="shortage">You need <strong>${estimate.creditsRequired - estimate.userCreditsRemaining}</strong> more credits</p>
          </div>
        </div>
        <div class="credit-actions">
          <button class="buy-credits-btn" onclick="window.location.href='buy-credits.html'">Buy Credits</button>
          <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  startPeriodicUpdates() {
    // Update balance every 30 seconds
    this.updateInterval = setInterval(() => {
      if (this.apiKey) {
        this.fetchBalance();
      }
    }, 30000);
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.elements.clear();
    this.hasInitialized = false;
  }
}

// Global initialization
window.UnifiedCreditSystem = UnifiedCreditSystem;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const apiKey = localStorage.getItem('apiKey');
  const instance = UnifiedCreditSystem.init(apiKey);
  
  // Create global creditWidget instance that script.js expects
  window.creditWidget = instance;
});

// Backward compatibility - expose methods that other code might expect
window.CreditWidget = {
  init: (apiKey) => {
    const instance = UnifiedCreditSystem.init(apiKey);
    // Also set the global creditWidget instance
    window.creditWidget = instance;
    return instance;
  },
  // Add other methods as needed for backward compatibility
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedCreditSystem;
} 