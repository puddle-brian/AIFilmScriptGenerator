/**
 * Form Components System
 * Extracted from script.js - handles form creation, validation, and submission
 */

class FormComponents {
    constructor() {
        this.validators = new Map();
        this.submitHandlers = new Map();
    }

    /**
     * Create a form with validation and submission handling
     */
    createForm({
        id,
        fields = [],
        submitButton = { text: 'Submit', class: 'btn-primary' },
        onSubmit = null,
        onValidate = null,
        autoFocus = true
    }) {
        const formHtml = `
            <form id="${id}" class="form-component">
                ${fields.map(field => this._createField(field)).join('')}
                <div class="form-actions">
                    <button type="submit" class="btn ${submitButton.class}">${submitButton.text}</button>
                </div>
            </form>
        `;

        // Store handlers
        if (onSubmit) this.submitHandlers.set(id, onSubmit);
        if (onValidate) this.validators.set(id, onValidate);

        return formHtml;
    }

    /**
     * Create library entry form (specialized for library entries)
     */
    createLibraryForm({
        type,
        value = '',
        config,
        isComplex = false
    }) {
        const fields = [];

        if (isComplex) {
            // Complex forms have name + description (characters, story concepts)
            fields.push({
                type: 'text',
                id: 'universalLibraryEntryName',
                label: type === 'character' ? 'Character Name' : 'Story Title',
                value: value,
                required: true
            });

            fields.push({
                type: 'textarea',
                id: 'universalLibraryEntryDescription',
                label: type === 'character' ? 'Character Description' : 'Story Description',
                placeholder: config.placeholder,
                rows: 3,
                helpText: type === 'storyconcept' ? 'This story description will be included in every AI prompt as your story develops, guiding all generated content.' : ''
            });
        } else {
            // Simple forms have single field (influences)
            const labels = {
                director: 'Direction reminiscent of...',
                screenwriter: 'Prose style that invokes...',
                film: 'Channeling the essence of...',
                tone: 'Tone and atmosphere inspired by...'
            };

            const helpTexts = {
                director: 'This will appear in prompts as: "With direction reminiscent of <em>[what you enter]</em>, ..."',
                screenwriter: 'This will appear in prompts as: "with prose style that invokes <em>[what you enter]</em>, ..."',
                film: 'This will appear in prompts as: "channeling the essence of <em>[what you enter]</em>, ..."',
                tone: 'This tone will be used throughout your story generation.'
            };

            fields.push({
                type: 'text',
                id: 'universalLibraryEntryName',
                label: labels[type] || `${config.displayName} Influence`,
                value: value,
                placeholder: config.placeholder,
                required: true,
                helpText: helpTexts[type] || ''
            });
        }

        return this.createForm({
            id: 'universalLibrarySaveForm',
            fields: fields,
            submitButton: { text: 'Save', class: 'btn-primary' }
        });
    }

    /**
     * Setup form validation and submission
     */
    setupForm(formId, options = {}) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Setup validation
        if (this.validators.has(formId) || options.onValidate) {
            this._setupValidation(form, options.onValidate || this.validators.get(formId));
        }

        // Setup submission
        if (this.submitHandlers.has(formId) || options.onSubmit) {
            this._setupSubmission(form, options.onSubmit || this.submitHandlers.get(formId));
        }

        // Setup auto-focus
        if (options.autoFocus !== false) {
            this._setupAutoFocus(form);
        }

        // Setup keyboard shortcuts
        this._setupKeyboardShortcuts(form);
    }

    /**
     * Validate a form
     */
    validateForm(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;

        const validator = this.validators.get(formId);
        
        // Clear previous errors
        this._clearErrors(form);

        // Basic HTML5 validation
        if (!form.checkValidity()) {
            this._showHtml5Errors(form);
            return false;
        }

        // Custom validation
        if (validator) {
            const customErrors = validator(this.getFormData(formId));
            if (customErrors && customErrors.length > 0) {
                this._showCustomErrors(form, customErrors);
                return false;
            }
        }

        return true;
    }

    /**
     * Get form data as object
     */
    getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};

        // Handle regular form fields
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Handle fields with specific IDs (for backward compatibility)
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.id) {
                data[input.id] = input.value;
            }
        });

        return data;
    }

    /**
     * Set form data
     */
    setFormData(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;

        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"], #${key}`);
            if (field) {
                field.value = data[key];
            }
        });
    }

    /**
     * Show loading state on form
     */
    setFormLoading(formId, loading = true) {
        const form = document.getElementById(formId);
        if (!form) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input, textarea, select');

        if (loading) {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalText = submitBtn.textContent;
                submitBtn.textContent = 'Processing...';
            }
            inputs.forEach(input => input.disabled = true);
            form.classList.add('form-loading');
        } else {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || submitBtn.textContent;
            }
            inputs.forEach(input => input.disabled = false);
            form.classList.remove('form-loading');
        }
    }

    // Private helper methods
    _createField(field) {
        const {
            type = 'text',
            id,
            name = id,
            label,
            value = '',
            placeholder = '',
            required = false,
            rows = 3,
            options = [],
            helpText = '',
            class: fieldClass = ''
        } = field;

        let fieldHtml = '';

        switch (type) {
            case 'text':
            case 'email':
            case 'password':
                fieldHtml = `
                    <input type="${type}" 
                           id="${id}" 
                           name="${name}" 
                           value="${value}" 
                           placeholder="${placeholder}"
                           class="form-control ${fieldClass}"
                           ${required ? 'required' : ''}>
                `;
                break;

            case 'textarea':
                fieldHtml = `
                    <textarea id="${id}" 
                              name="${name}" 
                              placeholder="${placeholder}"
                              class="form-control ${fieldClass}"
                              rows="${rows}"
                              ${required ? 'required' : ''}>${value}</textarea>
                `;
                break;

            case 'select':
                fieldHtml = `
                    <select id="${id}" 
                            name="${name}" 
                            class="form-control ${fieldClass}"
                            ${required ? 'required' : ''}>
                        ${placeholder ? `<option value="">${placeholder}</option>` : ''}
                        ${options.map(option => `
                            <option value="${option.value}" ${option.value === value ? 'selected' : ''}>
                                ${option.label}
                            </option>
                        `).join('')}
                    </select>
                `;
                break;

            case 'checkbox':
                fieldHtml = `
                    <label class="checkbox-field">
                        <input type="checkbox" 
                               id="${id}" 
                               name="${name}" 
                               value="${value}"
                               class="${fieldClass}"
                               ${field.checked ? 'checked' : ''}>
                        <span class="checkbox-label">${label}</span>
                    </label>
                `;
                return `
                    <div class="form-group form-group-checkbox">
                        ${fieldHtml}
                        ${helpText ? `<small class="form-help">${helpText}</small>` : ''}
                    </div>
                `;
        }

        return `
            <div class="form-group">
                ${label && type !== 'checkbox' ? `<label for="${id}">${label}</label>` : ''}
                ${fieldHtml}
                ${helpText ? `<small class="form-help">${helpText}</small>` : ''}
            </div>
        `;
    }

    _setupValidation(form, validator) {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this._clearFieldError(input);
                
                // Basic validation
                if (input.required && !input.value.trim()) {
                    this._showFieldError(input, 'This field is required');
                    return;
                }

                // Custom validation
                if (validator) {
                    const data = this.getFormData(form.id);
                    const errors = validator(data);
                    const fieldError = errors?.find(error => error.field === input.name || error.field === input.id);
                    if (fieldError) {
                        this._showFieldError(input, fieldError.message);
                    }
                }
            });
        });
    }

    _setupSubmission(form, submitHandler) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.validateForm(form.id)) {
                return;
            }

            this.setFormLoading(form.id, true);
            
            try {
                const data = this.getFormData(form.id);
                await submitHandler(data, form);
            } catch (error) {
                console.error('Form submission error:', error);
                this._showSubmissionError(form, error.message || 'An error occurred while submitting the form');
            } finally {
                this.setFormLoading(form.id, false);
            }
        });
    }

    _setupAutoFocus(form) {
        setTimeout(() => {
            const firstInput = form.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    _setupKeyboardShortcuts(form) {
        form.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to submit
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }

            // Escape to reset/cancel
            if (e.key === 'Escape') {
                form.reset();
            }
        });
    }

    _clearErrors(form) {
        const errors = form.querySelectorAll('.field-error, .form-error');
        errors.forEach(error => error.remove());
        
        const invalidFields = form.querySelectorAll('.field-invalid');
        invalidFields.forEach(field => field.classList.remove('field-invalid'));
    }

    _clearFieldError(field) {
        const error = field.parentNode.querySelector('.field-error');
        if (error) error.remove();
        field.classList.remove('field-invalid');
    }

    _showFieldError(field, message) {
        this._clearFieldError(field);
        
        const error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = message;
        
        field.classList.add('field-invalid');
        field.parentNode.appendChild(error);
    }

    _showHtml5Errors(form) {
        const invalidFields = form.querySelectorAll(':invalid');
        invalidFields.forEach(field => {
            this._showFieldError(field, field.validationMessage);
        });
    }

    _showCustomErrors(form, errors) {
        errors.forEach(error => {
            const field = form.querySelector(`[name="${error.field}"], #${error.field}`);
            if (field) {
                this._showFieldError(field, error.message);
            } else {
                // Show general form error
                this._showSubmissionError(form, error.message);
            }
        });
    }

    _showSubmissionError(form, message) {
        const existingError = form.querySelector('.form-error');
        if (existingError) existingError.remove();

        const error = document.createElement('div');
        error.className = 'form-error';
        error.textContent = message;
        
        form.insertBefore(error, form.firstChild);
    }
}

// Export for global use
window.FormComponents = FormComponents;

// Create global instance
window.formComponents = new FormComponents(); 