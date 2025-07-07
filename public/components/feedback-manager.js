/**
 * Feedback Manager Component
 * Handles user feedback submission with simple modal interface
 * Follows the modular architecture pattern
 */

// Feedback Manager Class
class FeedbackManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        this.createFeedbackButton();
        this.setupEventListeners();
        
        this.initialized = true;
        console.log('✅ FeedbackManager initialized');
    }
    
    createFeedbackButton() {
        // Create feedback button if it doesn't exist
        const existingButton = document.getElementById('feedbackButton');
        if (existingButton) return;
        
        const buttonHtml = `
            <button id="feedbackButton" class="feedback-button" title="Send Feedback">
                💬 Feedback
            </button>
        `;
        
        // Add button to the page (append to body or nav)
        const nav = document.querySelector('nav') || document.querySelector('.top-nav');
        if (nav) {
            nav.insertAdjacentHTML('beforeend', buttonHtml);
        } else {
            document.body.insertAdjacentHTML('beforeend', buttonHtml);
        }
        
        // Add CSS for the feedback button
        this.addFeedbackButtonStyles();
    }
    
    addFeedbackButtonStyles() {
        const existingStyles = document.getElementById('feedbackButtonStyles');
        if (existingStyles) return;
        
        const styles = `
            <style id="feedbackButtonStyles">
                .feedback-button {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 50px;
                    padding: 12px 20px;
                    font-size: 14px;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0,123,255,0.3);
                    z-index: 1000;
                    transition: all 0.3s ease;
                }
                
                .feedback-button:hover {
                    background: #0056b3;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,123,255,0.4);
                }
                
                .feedback-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1001;
                }
                
                .feedback-modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 600px;
                    min-width: 500px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    position: relative;
                }
                
                .feedback-modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 8px 8px 0 0;
                    padding: 1.5rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .feedback-modal-header h3 {
                    color: white;
                    font-weight: 600;
                    margin: 0;
                    font-size: 1.25rem;
                }
                
                .feedback-modal-close {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    opacity: 0.9;
                    font-weight: 500;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    width: 36px;
                    height: 36px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: all 0.2s;
                }
                
                .feedback-modal-close:hover {
                    background: #ef4444;
                    border-color: #ef4444;
                    color: white;
                    opacity: 1;
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
                }
                
                .feedback-modal-body {
                    padding: 2rem;
                }
                
                .feedback-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                
                .feedback-form .form-group {
                    margin-bottom: 0;
                }
                
                .feedback-form label {
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: 0.5rem;
                    display: block;
                    font-size: 0.95rem;
                }
                
                .feedback-form select,
                .feedback-form textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.95rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    font-family: inherit;
                }
                
                .feedback-form select:focus,
                .feedback-form textarea:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                
                .feedback-form textarea {
                    resize: vertical;
                    min-height: 140px;
                    line-height: 1.5;
                }
                
                .feedback-form small {
                    color: #6b7280;
                    font-size: 0.875rem;
                    margin-top: 0.25rem;
                    display: block;
                }
                
                .feedback-modal-footer {
                    padding: 1.5rem 2rem;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    border-radius: 0 0 8px 8px;
                }
                
                .feedback-form-actions {
                    display: flex;
                    gap: 0.75rem;
                }
                
                .feedback-form-actions button {
                    padding: 0.625rem 1.25rem;
                    font-weight: 500;
                    border-radius: 6px;
                    transition: all 0.2s;
                    cursor: pointer;
                    font-size: 0.95rem;
                }
                
                .feedback-cancel {
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 1px solid #d1d5db;
                }
                
                .feedback-cancel:hover {
                    background: #e5e7eb;
                    color: #374151;
                }
                
                .feedback-submit {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                }
                
                .feedback-submit:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                }
                
                .feedback-submit:disabled {
                    background: #d1d5db;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                /* Mobile responsiveness */
                @media (max-width: 768px) {
                    .feedback-modal-content {
                        min-width: auto;
                        margin: 1rem;
                        max-height: 90vh;
                    }
                    
                    .feedback-modal-header,
                    .feedback-modal-body,
                    .feedback-modal-footer {
                        padding: 1rem;
                    }
                    
                    .feedback-form {
                        gap: 1rem;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    setupEventListeners() {
        // Listen for feedback button clicks
        document.addEventListener('click', (e) => {
            if (e.target.id === 'feedbackButton') {
                this.showFeedbackModal();
            }
        });
        
        // Listen for ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideFeedbackModal();
            }
        });
    }
    
    showFeedbackModal() {
        // Allow feedback from both authenticated and guest users
        // Guest users will be handled with fallback authentication
        console.log('🎯 Opening feedback modal for:', window.appState?.user?.username || 'guest user');
        
        const modalHtml = `
            <div class="feedback-modal" id="feedbackModal">
                <div class="feedback-modal-content">
                    <div class="feedback-modal-header">
                        <h3>💬 Send us your feedback</h3>
                        <button class="feedback-modal-close" onclick="window.feedbackManagerInstance.hideFeedbackModal()">&times;</button>
                    </div>
                    <div class="feedback-modal-body">
                        <form class="feedback-form" id="feedbackForm">
                            <div class="form-group">
                                <label for="feedbackCategory">What type of feedback is this?</label>
                                <select id="feedbackCategory" name="category" required>
                                    <option value="general" selected>💬 General Feedback</option>
                                    <option value="bug">🐛 Bug Report</option>
                                    <option value="feature">💡 Feature Request</option>
                                    <option value="other">💭 Other</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="feedbackMessage">Tell us what you think:</label>
                                <textarea 
                                    id="feedbackMessage" 
                                    name="message" 
                                    placeholder="Describe your feedback, suggestion, or issue..."
                                    maxlength="1000"
                                    required
                                ></textarea>
                                <small>1000 characters maximum</small>
                            </div>
                        </form>
                    </div>
                    <div class="feedback-modal-footer">
                        <div class="feedback-form-actions">
                            <button type="button" class="feedback-cancel" onclick="window.feedbackManagerInstance.hideFeedbackModal()">
                                Cancel
                            </button>
                            <button type="submit" class="feedback-submit" form="feedbackForm">
                                Send Feedback
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Setup form submission
        const form = document.getElementById('feedbackForm');
        form.addEventListener('submit', (e) => this.handleFeedbackSubmit(e));
        
        // Focus on category dropdown
        document.getElementById('feedbackCategory').focus();
    }
    
    hideFeedbackModal() {
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.remove();
        }
    }
    
    async handleFeedbackSubmit(event) {
        event.preventDefault();
        
        const submitButton = document.querySelector('.feedback-submit');
        const originalText = submitButton.textContent;
        
        try {
            // Disable submit button
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            
            const formData = new FormData(event.target);
            const feedbackData = {
                category: formData.get('category'),
                message: formData.get('message'),
                pageUrl: window.location.href
            };
            
            const response = await fetch('/api/feedback/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': window.appState.apiKey
                },
                body: JSON.stringify(feedbackData)
            });
            
            // Handle specific timeout errors
            if (response.status === 504) {
                throw new Error('🔄 Request timed out - services are starting up. Please try again in a few moments.');
            }
            
            if (response.status === 503) {
                throw new Error('🔄 Services starting up, please wait a moment and try again...');
            }
            
            // Try to parse as JSON, but handle HTML error pages
            let result;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    // Not JSON - probably HTML error page
                    const text = await response.text();
                    throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
                }
            } catch (parseError) {
                if (parseError.message.includes('Server returned')) {
                    throw parseError; // Re-throw our custom error
                }
                // JSON parsing failed - likely HTML error page
                throw new Error(`Server error (${response.status}): Unable to parse response`);
            }
            
            // Handle server errors with specific messages
            if (!response.ok) {
                let errorMessage = 'Failed to submit feedback';
                
                if (response.status === 400 && result.error) {
                    errorMessage = result.error; // Show validation errors
                } else if (result.error) {
                    errorMessage = result.error;
                }
                
                throw new Error(errorMessage);
            }
            
            // Handle API errors that returned 200 but contain errors
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Show success message
            this.showSuccessMessage();
            
            // Close modal after short delay
            setTimeout(() => {
                this.hideFeedbackModal();
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting feedback:', error);
            
            // Show specific error message from server or generic fallback
            const errorMessage = error.message || 'Failed to submit feedback. Please try again.';
            alert(errorMessage);
            
            // Re-enable submit button
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }
    
    showSuccessMessage() {
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            const content = modal.querySelector('.feedback-modal-content');
            content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                    <h3>Thank you for your feedback!</h3>
                    <p>We appreciate you taking the time to help us improve.</p>
                    <p style="color: #666; font-size: 14px;">This window will close automatically.</p>
                </div>
            `;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.feedbackManagerInstance = new FeedbackManager();
    window.feedbackManagerInstance.init();
});

// Export for use in other modules
window.FeedbackManager = FeedbackManager; 