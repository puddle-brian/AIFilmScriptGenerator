/**
 * Credit Widget - Self-contained credit system integration
 * 
 * Usage: Just include this file and call CreditWidget.init()
 * The widget handles all credit logic internally without affecting main app
 */

class CreditWidget {
  constructor() {
    this.apiKey = localStorage.getItem('apiKey') || '';
    this.balance = 0;
    this.isLoading = false;
    this.updateInterval = null;
  }

  // Initialize the widget - call this once in your main app
  static init(apiKey = null) {
    const widget = new CreditWidget();
    if (apiKey) {
      widget.setApiKey(apiKey);
    }
    widget.render();
    widget.startPeriodicUpdates();
    return widget;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    localStorage.setItem('apiKey', apiKey);
    this.fetchBalance();
  }

  // Main integration point: Check if user can afford an operation
  async canAfford(estimatedCost = 10) {
    if (!this.apiKey) return false;
    await this.fetchBalance();
    return this.balance >= estimatedCost;
  }

  // Main integration point: Show cost estimate before operation
  async showCostEstimate(prompt, operation = 'generation') {
    if (!this.apiKey) return true;

    try {
      const response = await fetch('/api/estimate-cost', {
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
    } catch (error) {
      console.warn('Credit estimate failed:', error);
      return true; // Don't block on estimate failure
    }
  }

  // Main integration point: Refresh balance after successful operation
  async refreshAfterOperation() {
    await this.fetchBalance();
    this.updateDisplay();
  }

  // Internal methods - main app doesn't need to know about these
  async fetchBalance() {
    if (!this.apiKey) return;

    try {
      const response = await fetch('/api/my-stats', {
        headers: { 'X-API-Key': this.apiKey }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.balance = data.user.credits_remaining || 0;
      }
    } catch (error) {
      console.warn('Failed to fetch credit balance:', error);
    }
  }

  render() {
    // Check if existing credits display is present (integrate with existing UI)
    const existingCreditsAmount = document.getElementById('creditsAmount');
    const existingCreditsBadge = document.getElementById('creditsBadge');
    
    if (existingCreditsAmount && existingCreditsBadge) {
      // Use existing credits display
      this.creditsAmountElement = existingCreditsAmount;
      this.creditsBadgeElement = existingCreditsBadge;
      console.log('🔗 Credit widget integrated with existing credits display');
    } else {
      // Fallback: create new widget if existing display not found
      if (document.getElementById('credit-widget')) return;

      const widget = document.createElement('div');
      widget.id = 'credit-widget';
      widget.innerHTML = `
        <div class="credit-badge" id="credit-badge">
          <span class="credit-icon">💳</span>
          <span class="credit-amount" id="credit-amount">--</span>
          <span class="credit-label">credits</span>
        </div>
      `;

      const header = document.querySelector('header') || document.querySelector('.header') || document.body;
      header.appendChild(widget);
      
      this.creditsAmountElement = document.getElementById('credit-amount');
      this.creditsBadgeElement = document.getElementById('credit-badge');
    }

    this.updateDisplay();
    this.attachEventListeners();
  }

  updateDisplay() {
    if (!this.creditsAmountElement || !this.creditsBadgeElement) return;

    this.creditsAmountElement.textContent = this.balance;
    
    // Update tooltip balance if it exists
    const tooltipBalance = document.getElementById('tooltipBalance');
    if (tooltipBalance) {
      tooltipBalance.textContent = this.balance;
    }
    
    // Color coding for existing badge
    this.creditsBadgeElement.className = this.creditsBadgeElement.className.replace(/\b(low|medium|high)\b/g, '');
    if (this.balance < 50) this.creditsBadgeElement.classList.add('low');
    else if (this.balance < 200) this.creditsBadgeElement.classList.add('medium');
    else this.creditsBadgeElement.classList.add('high');
  }

  attachEventListeners() {
    if (this.creditsBadgeElement) {
      this.creditsBadgeElement.addEventListener('click', () => this.showDetailModal());
    }
  }

  showDetailModal() {
    const modal = document.createElement('div');
    modal.className = 'credit-modal';
    modal.innerHTML = `
      <div class="credit-modal-content">
        <h3>Credit Balance</h3>
        <div class="credit-balance-large">${this.balance}</div>
        <p>Credits remaining</p>
        <div class="credit-actions">
          <button onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  showInsufficientCreditsModal(estimate) {
    const modal = document.createElement('div');
    modal.className = 'credit-modal';
    modal.innerHTML = `
      <div class="credit-modal-content">
        <h3>⚠️ Insufficient Credits</h3>
        <p>This operation requires <strong>${estimate.creditsRequired}</strong> credits</p>
        <p>You have <strong>${estimate.userCreditsRemaining}</strong> credits remaining</p>
        <div class="credit-actions">
          <button onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  startPeriodicUpdates() {
    // Update balance every 30 seconds
    this.updateInterval = setInterval(() => {
      this.fetchBalance().then(() => this.updateDisplay());
    }, 30000);
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    // Only remove if we created our own widget
    const widget = document.getElementById('credit-widget');
    if (widget) widget.remove();
  }
}

// Auto-detect API key from existing forms or localStorage
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.querySelector('input[name="apiKey"]') || 
                     document.querySelector('#apiKey') ||
                     document.querySelector('[data-api-key]');
  
  if (apiKeyInput && apiKeyInput.value) {
    window.creditWidget = CreditWidget.init(apiKeyInput.value);
  } else {
    window.creditWidget = CreditWidget.init();
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CreditWidget;
} 