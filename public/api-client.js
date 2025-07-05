/**
 * 🌐 Film Script Generator - Centralized API Client
 * 
 * This module centralizes all API communication for the frontend,
 * providing consistent error handling, authentication, loading states,
 * and response parsing across the entire application.
 */

class APIClient {
  constructor() {
    this.baseURL = this.getBaseURL();
    this.apiKey = null;
    this.isLoading = false;
    this.requestCount = 0;
    
    // Configure default options
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    };
    
    console.log('🌐 API Client initialized with base URL:', this.baseURL);
  }
  
  /**
   * Determine the correct base URL for API calls
   */
  getBaseURL() {
    return window.location.hostname === 'localhost' ? 
      'http://localhost:3000' : '';
  }
  
  /**
   * Set the API key for authenticated requests
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    console.log('🔑 API key set:', apiKey ? '✅' : '❌');
  }
  
  /**
   * Get current API key
   */
  getApiKey() {
    return this.apiKey;
  }
  
  /**
   * Build headers for requests
   */
  buildHeaders(customHeaders = {}) {
    const headers = { ...this.defaultOptions.headers, ...customHeaders };
    
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    return headers;
  }
  
  /**
   * Handle loading state management
   */
  setLoadingState(isLoading) {
    this.isLoading = isLoading;
    this.requestCount += isLoading ? 1 : -1;
    
    // Update global loading indicator if present
    const loadingIndicator = document.querySelector('.global-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = this.requestCount > 0 ? 'block' : 'none';
    }
  }
  
  /**
   * Handle API errors consistently
   */
  handleError(error, endpoint, options = {}) {
    console.error(`❌ API Error [${endpoint}]:`, error);
    
    // Show user-friendly error message
    if (!options.silent) {
      const message = this.getErrorMessage(error);
      if (window.showToast) {
        window.showToast(message, 'error');
      }
    }
    
    // Track error for analytics
    this.trackError(error, endpoint);
    
    return error;
  }
  
  /**
   * Get user-friendly error message
   */
  getErrorMessage(error) {
    if (error.status === 401) {
      return 'Authentication required. Please check your API key.';
    } else if (error.status === 403) {
      return 'Access denied. Please check your permissions.';
    } else if (error.status === 409) {
      // For 409 Conflict errors, use the specific error message from the server
      return error.message || 'Item already exists.';
    } else if (error.status === 429) {
      return 'Too many requests. Please wait and try again.';
    } else if (error.status === 500) {
      return 'Server error. Please try again later.';
    } else if (error.name === 'NetworkError' || !error.status) {
      return 'Network error. Please check your connection.';
    }
    
    return error.message || 'An unexpected error occurred.';
  }
  
  /**
   * Track errors for monitoring
   */
  trackError(error, endpoint) {
    // Log to console for debugging
    console.warn('📊 API Error Tracked:', {
      endpoint,
      status: error.status,
      message: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Could integrate with analytics service here
  }
  
  /**
   * Make HTTP request with standardized handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestOptions = {
      ...this.defaultOptions,
      ...options,
      headers: this.buildHeaders(options.headers)
    };
    
    // Show loading state unless explicitly disabled
    if (!options.silent) {
      this.setLoadingState(true);
    }
    
    try {
      console.log(`🌐 API Request [${requestOptions.method || 'GET'}]: ${endpoint}`);
      
      const response = await fetch(url, requestOptions);
      
      // Handle response
      if (!response.ok) {
        // Try to parse error response as JSON to get detailed error message
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If parsing fails, use the original status text
          console.warn('Failed to parse error response as JSON:', parseError);
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      // Parse response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      console.log(`✅ API Success [${endpoint}]:`, data);
      return data;
      
    } catch (error) {
      throw this.handleError(error, endpoint, options);
    } finally {
      if (!options.silent) {
        this.setLoadingState(false);
      }
    }
  }
  
  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }
  
  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
  
  // ===========================================
  // DOMAIN-SPECIFIC API METHODS
  // ===========================================
  
  /**
   * Authentication & User Management
   */
  async getMyStats() {
    return this.get('/api/my-stats');
  }
  
  async getUsers() {
    return this.get('/api/users');
  }
  
  /**
   * Templates
   */
  async getTemplates() {
    return this.get('/api/templates');
  }
  
  async getTemplate(templateId) {
    return this.get(`/api/template/${templateId}`);
  }
  
  /**
   * User Libraries
   */
  async getUserLibrary(username, type) {
    return this.get(`/api/user-libraries/${username}/${type}`);
  }
  
  async createLibraryEntry(username, type, key, data) {
    return this.post(`/api/user-libraries/${username}/${type}/${key}`, data);
  }
  
  async updateLibraryEntry(username, type, key, data) {
    return this.put(`/api/user-libraries/${username}/${type}/${key}`, data);
  }
  
  async deleteLibraryEntry(username, type, key) {
    return this.delete(`/api/user-libraries/${username}/${type}/${key}`);
  }
  
  async populateStarterPack(username) {
    return this.post(`/api/user-libraries/${username}/populate-starter-pack`);
  }
  
  /**
   * Project Management
   */
  async listProjects(username) {
    return this.get(`/api/list-projects?username=${username}`);
  }
  
  async loadProject(projectPath, username) {
    return this.get(`/api/load-project/${encodeURIComponent(projectPath)}?username=${encodeURIComponent(username)}`);
  }
  
  async autoSaveProject(projectData) {
    return this.post('/api/auto-save-project', projectData);
  }
  
  async loadPlotPoints(projectPath, username = null) {
    const params = new URLSearchParams();
    if (username) {
      params.append('username', username);
    }
    const queryString = params.toString();
    const url = `/api/load-plot-points/${encodeURIComponent(projectPath)}${queryString ? '?' + queryString : ''}`;
    return this.get(url);
  }
  
  /**
   * Content Generation
   */
  async generateStructure(data) {
    return this.post('/api/generate-structure', data);
  }
  
  async generateCustomStructure(data) {
    return this.post('/api/generate-structure-custom', data);
  }
  
  async generatePlotPoints(projectPath, structureKey, data) {
    return this.post(`/api/generate-plot-points-for-act/${projectPath}/${structureKey}`, data);
  }
  
  async generateScenes(projectPath, structureKey, data) {
    return this.post(`/api/generate-all-scenes-for-act/${projectPath}/${structureKey}`, data);
  }
  
  async generateDialogue(data) {
    return this.post('/api/generate-dialogue', data);
  }
  
  async regenerateScenes(projectPath, data) {
    return this.post(`/api/regenerate-scenes-simple/${projectPath}`, data);
  }
  
  /**
   * Content Editing
   */
  async editContent(type, projectPath, key, data) {
    return this.post(`/api/edit-content/${type}/${projectPath}/${key}`, data);
  }
  
  async editDialogue(projectPath, structureKey, sceneIndex, data) {
    return this.post(`/api/edit-content/dialogue/${projectPath}/${structureKey}/${sceneIndex}`, data);
  }
  
  /**
   * Prompt Previews
   */
  async previewPrompt(data) {
    return this.post('/api/preview-prompt', data);
  }
  
  async previewDialoguePrompt(data) {
    return this.post('/api/preview-dialogue-prompt', data);
  }
  
  async previewScenePrompt(data) {
    return this.post('/api/preview-scene-prompt', data);
  }
  
  /**
   * Story Analysis
   */
  async analyzeStoryConcept(data) {
    return this.post('/api/analyze-story-concept', data);
  }
  
  async applySuggestions(data) {
    return this.post('/api/apply-suggestions', data);
  }
  
  /**
   * Cost Estimation
   */
  async estimateCost(data) {
    return this.post('/api/estimate-cost', data);
  }
  
  /**
   * Export
   */
  async exportProject(data) {
    return this.post('/api/export', data);
  }
  
  // ===========================================
  // HELPER METHODS
  // ===========================================
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.apiKey;
  }
  
  /**
   * Get current request count (for debugging)
   */
  getRequestCount() {
    return this.requestCount;
  }
  
  /**
   * Reset client state
   */
  reset() {
    this.apiKey = null;
    this.requestCount = 0;
    this.isLoading = false;
    console.log('🔄 API Client reset');
  }
}

// Create and export singleton instance
const apiClient = new APIClient();

// Auto-initialize API key from global state if available
if (typeof appState !== 'undefined' && appState.apiKey) {
  apiClient.setApiKey(appState.apiKey);
}

// Export for use in other modules
window.apiClient = apiClient;

console.log('🎯 API Client module loaded successfully'); 