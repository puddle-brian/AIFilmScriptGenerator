/* =================================
   AUTHENTICATION JAVASCRIPT
   ================================= */

// Authentication State
let authState = {
    isAuthenticated: false,
    user: null,
    apiKey: null
};

/**
 * Initialize Authentication System
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
});

function initializeAuth() {
    console.log('Initializing Authentication System...');
    
    // Check for existing session
    checkExistingSession();
    
    // Set up form handlers
    setupFormHandlers();
    
    // Handle URL parameters (for password reset, etc.)
    handleUrlParameters();
}

/**
 * Check for existing authentication session
 */
function checkExistingSession() {
    const apiKey = localStorage.getItem('apiKey');
    const userData = localStorage.getItem('userData');
    
    if (apiKey && userData) {
        try {
            authState.apiKey = apiKey;
            authState.user = JSON.parse(userData);
            authState.isAuthenticated = true;
            
            // If user is already authenticated and on auth pages, redirect to main app
            if (window.location.pathname.includes('login.html') || 
                window.location.pathname.includes('register.html')) {
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Error parsing stored user data:', error);
            clearAuthSession();
        }
    }
}

/**
 * Set up form event handlers
 */
function setupFormHandlers() {
    // Registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
        
        // Real-time password confirmation validation
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        if (password && confirmPassword) {
            confirmPassword.addEventListener('input', validatePasswordMatch);
        }
        
        // Username validation
        const username = document.getElementById('username');
        if (username) {
            username.addEventListener('input', validateUsername);
        }
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Forgot password form
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
}

/**
 * Handle URL parameters for special actions
 */
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle password reset token
    const resetToken = urlParams.get('reset');
    if (resetToken) {
        // Show password reset form (if implemented)
        console.log('Password reset token detected:', resetToken);
    }
    
    // Handle email verification
    const verifyToken = urlParams.get('verify');
    if (verifyToken) {
        verifyEmail(verifyToken);
    }
    
    // Handle test user credentials (for admin testing)
    const testUser = urlParams.get('test_user');
    const testPass = urlParams.get('test_pass');
    const clearSession = urlParams.get('clear_session');
    
    // Clear session if requested (for testing)
    if (clearSession === 'true') {
        console.log('🧪 Clearing session for test user...');
        localStorage.removeItem('apiKey');
        localStorage.removeItem('userData');
        // Clear any other stored data
        sessionStorage.clear();
    }
    
    if (testUser && testPass && window.location.pathname.includes('login.html')) {
        // Auto-fill login form with test credentials
        setTimeout(() => {
            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');
            
            if (usernameField && passwordField) {
                // Convert username to email format if needed (since login expects email)
                const emailValue = testUser.includes('@') ? testUser : `${testUser}@example.com`;
                usernameField.value = emailValue;
                passwordField.value = testPass;
                
                // Add visual indicator this is a test account
                const form = document.getElementById('loginForm');
                if (form) {
                    const testIndicator = document.createElement('div');
                    testIndicator.style.cssText = `
                        background: #fff3cd; 
                        border: 1px solid #ffeaa7; 
                        color: #856404; 
                        padding: 8px 12px; 
                        border-radius: 6px; 
                        margin-bottom: 15px; 
                        font-size: 14px;
                        text-align: center;
                    `;
                    testIndicator.innerHTML = `
                        🧪 <strong>Test Account Mode</strong><br>
                        Credentials auto-filled for testing. Click login to proceed.
                    `;
                    form.insertBefore(testIndicator, form.firstChild);
                }
                
                console.log('🧪 Test credentials auto-filled for:', testUser);
            }
        }, 100);
    }
    
    // Handle registration success redirect
    const registered = urlParams.get('registered');
    if (registered === 'true' && window.location.pathname.includes('login.html')) {
        setTimeout(() => {
            const form = document.getElementById('loginForm');
            if (form) {
                const welcomeMsg = document.createElement('div');
                welcomeMsg.style.cssText = `
                    background: #d4edda; 
                    border: 1px solid #c3e6cb; 
                    color: #155724; 
                    padding: 8px 12px; 
                    border-radius: 6px; 
                    margin-bottom: 15px; 
                    font-size: 14px;
                    text-align: center;
                `;
                welcomeMsg.innerHTML = `
                    ✅ <strong>Registration Successful!</strong><br>
                    Please log in with your new account credentials.
                `;
                form.insertBefore(welcomeMsg, form.firstChild);
            }
        }, 100);
    }
}

/**
 * Registration Handler
 */
async function handleRegistration(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('registerBtn');
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    // Clear previous messages
    hideMessage(errorDiv);
    hideMessage(successDiv);
    
    // Validate form
    if (!validateRegistrationForm(formData)) {
        return;
    }
    
    // Show loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch('/api/v2/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: formData.get('username').trim(),
                email: formData.get('email').trim(),
                password: formData.get('password'),
                emailUpdates: formData.get('emailUpdates') === 'on'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Registration successful
            showMessage(successDiv, 'Account created successfully! Logging you in...');
            
            // Store user data and API key for automatic login
            if (result.apiKey) {
                authState.isAuthenticated = true;
                authState.user = result.user;
                authState.apiKey = result.apiKey;
                
                localStorage.setItem('apiKey', result.apiKey);
                localStorage.setItem('userData', JSON.stringify(result.user));
                
                // Redirect to main app after short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // Fallback: redirect to login if no API key
                setTimeout(() => {
                    window.location.href = 'login.html?registered=true';
                }, 1500);
            }
            
        } else {
            // Registration failed
            showMessage(errorDiv, result.error || 'Registration failed. Please try again.');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showMessage(errorDiv, 'Network error. Please check your connection and try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Login Handler
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    
    // Clear previous messages
    hideMessage(errorDiv);
    
    // Show loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch('/api/v2/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: formData.get('email').trim(),
                password: formData.get('password'),
                rememberMe: formData.get('rememberMe') === 'on'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Login successful
            authState.isAuthenticated = true;
            authState.user = result.user;
            authState.apiKey = result.apiKey;
            
            // Store session data
            localStorage.setItem('apiKey', result.apiKey);
            localStorage.setItem('userData', JSON.stringify(result.user));
            
            if (formData.get('rememberMe') === 'on') {
                localStorage.setItem('rememberMe', 'true');
            }
            
            // Redirect to main application
            window.location.href = 'index.html';
            
        } else {
            // Login failed
            showMessage(errorDiv, result.error || 'Invalid email or password.');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage(errorDiv, 'Network error. Please check your connection and try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Forgot Password Handler
 */
async function handleForgotPassword(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('resetBtn');
    const errorDiv = document.getElementById('resetError');
    const successDiv = document.getElementById('resetSuccess');
    
    // Clear previous messages
    hideMessage(errorDiv);
    hideMessage(successDiv);
    
    // Show loading state
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: formData.get('email').trim()
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(successDiv, 'Password reset instructions have been sent to your email.');
            form.reset();
        } else {
            showMessage(errorDiv, result.error || 'Failed to send reset email.');
        }
        
    } catch (error) {
        console.error('Forgot password error:', error);
        showMessage(errorDiv, 'Network error. Please try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Form Validation Functions
 */
function validateRegistrationForm(formData) {
    const username = formData.get('username').trim();
    const email = formData.get('email').trim();
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const agreeToTerms = formData.get('agreeToTerms');
    
    // Username validation
    if (username.length < 3 || username.length > 30) {
        showMessage(document.getElementById('registerError'), 'Username must be 3-30 characters long.');
        return false;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        showMessage(document.getElementById('registerError'), 'Username can only contain letters, numbers, underscore, and hyphen.');
        return false;
    }
    
    // Email validation
    if (!isValidEmail(email)) {
        showMessage(document.getElementById('registerError'), 'Please enter a valid email address.');
        return false;
    }
    
    // Password validation
    if (password.length < 8) {
        showMessage(document.getElementById('registerError'), 'Password must be at least 8 characters long.');
        return false;
    }
    
    if (password !== confirmPassword) {
        showMessage(document.getElementById('registerError'), 'Passwords do not match.');
        return false;
    }
    
    // Terms agreement
    if (!agreeToTerms) {
        showMessage(document.getElementById('registerError'), 'You must agree to the Terms of Service.');
        return false;
    }
    
    return true;
}

function validatePasswordMatch() {
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (password && confirmPassword) {
        if (password.value && confirmPassword.value) {
            if (password.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.setCustomValidity('');
            }
        }
    }
}

function validateUsername() {
    const username = document.getElementById('username');
    if (username) {
        const value = username.value.trim();
        if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
            username.setCustomValidity('Username can only contain letters, numbers, underscore, and hyphen');
        } else {
            username.setCustomValidity('');
        }
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * UI Helper Functions
 */
function setButtonLoading(button, loading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (loading) {
        button.disabled = true;
        button.classList.add('btn-loading');
        if (btnText) btnText.style.opacity = '0';
        if (btnLoading) btnLoading.style.display = 'flex';
    } else {
        button.disabled = false;
        button.classList.remove('btn-loading');
        if (btnText) btnText.style.opacity = '1';
        if (btnLoading) btnLoading.style.display = 'none';
    }
}

function showMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
}

function hideMessage(element) {
    if (!element) return;
    element.style.display = 'none';
}

/**
 * Authentication Utilities
 */
function clearAuthSession() {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('userData');
    localStorage.removeItem('rememberMe');
    authState.isAuthenticated = false;
    authState.user = null;
    authState.apiKey = null;
}

function logout() {
    clearAuthSession();
    window.location.href = 'login.html';
}

/**
 * Modal Functions for Login Page
 */
function showForgotPassword() {
    const loginCard = document.querySelector('.auth-card:not(#forgotPasswordCard)');
    const forgotCard = document.getElementById('forgotPasswordCard');
    
    if (loginCard && forgotCard) {
        loginCard.style.display = 'none';
        forgotCard.style.display = 'block';
    }
}

function showLogin() {
    const loginCard = document.querySelector('.auth-card:not(#forgotPasswordCard)');
    const forgotCard = document.getElementById('forgotPasswordCard');
    
    if (loginCard && forgotCard) {
        forgotCard.style.display = 'none';
        loginCard.style.display = 'block';
    }
}

/**
 * Email Verification
 */
async function verifyEmail(token) {
    try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const result = await response.json();
        
        if (response.ok) {
            alert('Email verified successfully! You can now sign in.');
            window.location.href = 'login.html';
        } else {
            alert('Email verification failed: ' + (result.error || 'Invalid token'));
        }
    } catch (error) {
        console.error('Email verification error:', error);
        alert('Email verification failed. Please try again.');
    }
}

/**
 * Export functions for global access
 */
window.authUtils = {
    logout,
    clearAuthSession,
    isAuthenticated: () => authState.isAuthenticated,
    getUser: () => authState.user,
    getApiKey: () => authState.apiKey
}; 