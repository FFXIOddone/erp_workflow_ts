/**
 * Form Validation Utilities
 * Lightweight validation helpers compatible with Zod schemas
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {Record<string, string>} errors
 */

/**
 * @typedef {Object} FieldValidation
 * @property {boolean} required
 * @property {number} [minLength]
 * @property {number} [maxLength]
 * @property {RegExp} [pattern]
 * @property {string} [patternMessage]
 * @property {function} [custom]
 */

/**
 * Common validation patterns
 */
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s-()]{10,}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s-_]+$/,
  storeCode: /^[A-Z0-9]{3,10}$/i,
  version: /^\d+\.\d+(\.\d+)?$/,
};

/**
 * Create a validation schema
 * @param {Record<string, FieldValidation>} fields
 * @returns {function(Record<string, any>): ValidationResult}
 */
export function createSchema(fields) {
  return (data) => {
    /** @type {Record<string, string>} */
    const errors = {};

    for (const [fieldName, rules] of Object.entries(fields)) {
      const value = data[fieldName];
      const error = validateField(value, rules, fieldName);
      if (error) {
        errors[fieldName] = error;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  };
}

/**
 * Validate a single field
 * @param {any} value
 * @param {FieldValidation} rules
 * @param {string} fieldName
 * @returns {string|null}
 */
export function validateField(value, rules, fieldName) {
  const displayName = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  // Required check
  if (rules.required) {
    if (value === undefined || value === null || value === '') {
      return `${displayName} is required`;
    }
  }

  // Skip further validation if empty and not required
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const strValue = String(value);

  // Min length
  if (rules.minLength !== undefined && strValue.length < rules.minLength) {
    return `${displayName} must be at least ${rules.minLength} characters`;
  }

  // Max length
  if (rules.maxLength !== undefined && strValue.length > rules.maxLength) {
    return `${displayName} must be no more than ${rules.maxLength} characters`;
  }

  // Pattern
  if (rules.pattern && !rules.pattern.test(strValue)) {
    return rules.patternMessage || `${displayName} format is invalid`;
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * Pre-built validators for common use cases
 */
export const validators = {
  required: { required: true },
  
  email: {
    required: true,
    pattern: patterns.email,
    patternMessage: 'Please enter a valid email address'
  },
  
  brandName: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: patterns.noSpecialChars,
    patternMessage: 'Brand name can only contain letters, numbers, spaces, hyphens, and underscores'
  },
  
  storeCode: {
    required: true,
    pattern: patterns.storeCode,
    patternMessage: 'Store code must be 3-10 alphanumeric characters'
  },
  
  signType: {
    required: true,
    minLength: 1,
    maxLength: 100
  },
  
  signVersion: {
    required: false,
    maxLength: 100
  }
};

/**
 * Create a form state manager
 * @template T
 * @param {T} initialValues
 * @param {function(T): ValidationResult} schema
 */
export function createForm(initialValues, schema) {
  /** @type {T} */
  let values = { ...initialValues };
  /** @type {Record<string, string>} */
  let errors = {};
  /** @type {Record<string, boolean>} */
  let touched = {};
  let isSubmitting = false;

  return {
    get values() { return values; },
    get errors() { return errors; },
    get touched() { return touched; },
    get isSubmitting() { return isSubmitting; },
    get isValid() { return Object.keys(errors).length === 0; },

    /**
     * @param {keyof T} field
     * @param {any} value
     */
    setValue(field, value) {
      // @ts-ignore
      values[field] = value;
      touched[/** @type {string} */ (field)] = true;
      this.validate();
    },

    /**
     * @param {Partial<T>} newValues
     */
    setValues(newValues) {
      values = { ...values, ...newValues };
      this.validate();
    },

    validate() {
      const result = schema(values);
      errors = result.errors;
      return result.valid;
    },

    reset() {
      values = { ...initialValues };
      errors = {};
      touched = {};
      isSubmitting = false;
    },

    /**
     * @param {function(T): Promise<void>} onSubmit
     */
    async handleSubmit(onSubmit) {
      // Mark all fields as touched
      Object.keys(/** @type {object} */ (values)).forEach(key => {
        touched[key] = true;
      });

      if (!this.validate()) {
        return false;
      }

      isSubmitting = true;
      try {
        await onSubmit(values);
        return true;
      } finally {
        isSubmitting = false;
      }
    }
  };
}
