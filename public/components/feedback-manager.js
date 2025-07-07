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
                    padding: 30px;
                    border-radius: 10px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                }
                
                .feedback-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .feedback-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                }
                
                .feedback-form {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .feedback-form label {
                    font-weight: 500;
                    color: #333;
                }
                
                .feedback-form select,
                .feedback-form textarea {
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 14px;
                }
                
                .feedback-form textarea {
                    resize: vertical;
                    min-height: 120px;
                }
                
                .feedback-form-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                .feedback-form-actions button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .feedback-cancel {
                    background: #f8f9fa;
                    color: #666;
                }
                
                .feedback-submit {
                    background: #007bff;
                    color: white;
                }
                
                .feedback-submit:hover {
                    background: #0056b3;
                }
                
                .feedback-submit:disabled {
                    background: #ccc;
                    cursor: not-allowed;
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
        // Check if user is authenticated
        if (!window.appState || !window.appState.isAuthenticated) {
            alert('Please log in to submit feedback.');
            return;
        }
        
        const modalHtml = `
            <div class="feedback-modal" id="feedbackModal">
                <div class="feedback-modal-content">
                    <div class="feedback-modal-header">
                        <h3>💬 Send us your feedback</h3>
                        <button class="feedback-modal-close" onclick="window.feedbackManagerInstance.hideFeedbackModal()">&times;</button>
                    </div>
                    <form class="feedback-form" id="feedbackForm">
                        <div>
                            <label for="feedbackCategory">What type of feedback is this?</label>
                            <select id="feedbackCategory" name="category" required>
                                <option value="">Select a category</option>
                                <option value="bug">🐛 Bug Report</option>
                                <option value="feature">💡 Feature Request</option>
                                <option value="other">💭 Other</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="feedbackMessage">Tell us what you think:</label>
                            <textarea 
                                id="feedbackMessage" 
                                name="message" 
                                placeholder="Describe your feedback, suggestion, or issue..."
                                maxlength="1000"
                                required
                            ></textarea>
                            <small style="color: #666;">1000 characters maximum</small>
                        </div>
                        
                        <div class="feedback-form-actions">
                            <button type="button" class="feedback-cancel" onclick="window.feedbackManagerInstance.hideFeedbackModal()">
                                Cancel
                            </button>
                            <button type="submit" class="feedback-submit">
                                Send Feedback
                            </button>
                        </div>
                    </form>
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
            
            const result = await response.json();
            
            // Handle server errors with specific messages
            if (!response.ok) {
                let errorMessage = 'Failed to submit feedback';
                
                if (response.status === 503 || response.status === 504) {
                    errorMessage = '🔄 Services starting up, please wait a moment and try again...';
                } else if (response.status === 400 && result.error) {
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