// src/utils/validator.js
class Validator {
  /**
   * Validate bet parameters
   * @param {Object} params - Bet parameters
   * @returns {Object} - Validation result
   */
  validateBet(params) {
    const errors = [];

    if (!params.userId) {
      errors.push('User ID is required');
    }

    if (!params.amount) {
      errors.push('Bet amount is required');
    } else if (typeof params.amount !== 'number') {
      errors.push('Bet amount must be a number');
    } else if (params.amount <= 0) {
      errors.push('Bet amount must be greater than 0');
    }

    if (params.autoCashoutAt) {
      if (typeof params.autoCashoutAt !== 'number') {
        errors.push('Auto-cashout multiplier must be a number');
      } else if (params.autoCashoutAt <= 1) {
        errors.push('Auto-cashout multiplier must be greater than 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user registration parameters
   * @param {Object} params - Registration parameters
   * @returns {Object} - Validation result
   */
  validateRegistration(params) {
    const errors = [];

    if (!params.username) {
      errors.push('Username is required');
    } else {
      if (params.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }
      if (params.username.length > 20) {
        errors.push('Username must be at most 20 characters long');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(params.username)) {
        errors.push('Username can only contain letters, numbers, and underscores');
      }
    }

    if (!params.password) {
      errors.push('Password is required');
    } else {
      if (params.password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      if (!/[A-Z]/.test(params.password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(params.password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(params.password)) {
        errors.push('Password must contain at least one number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate deposit parameters
   * @param {Object} params - Deposit parameters
   * @returns {Object} - Validation result
   */
  validateDeposit(params) {
    const errors = [];

    if (!params.amount) {
      errors.push('Deposit amount is required');
    } else if (typeof params.amount !== 'number') {
      errors.push('Deposit amount must be a number');
    } else if (params.amount <= 0) {
      errors.push('Deposit amount must be greater than 0');
    }

    if (params.amount > 1000000) {
      errors.push('Deposit amount exceeds maximum limit');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate game configuration
   * @param {Object} config - Game configuration
   * @returns {Object} - Validation result
   */
  validateGameConfig(config) {
    const errors = [];

    if (typeof config.rtp !== 'number') {
      errors.push('RTP must be a number');
    } else if (config.rtp < 0.8 || config.rtp > 0.99) {
      errors.push('RTP must be between 0.8 and 0.99');
    }

    if (config.bettingPhaseDuration) {
      if (typeof config.bettingPhaseDuration !== 'number') {
        errors.push('Betting phase duration must be a number');
      } else if (config.bettingPhaseDuration < 5000 || config.bettingPhaseDuration > 30000) {
        errors.push('Betting phase duration must be between 5 and 30 seconds');
      }
    }

    if (config.speedMultiplier) {
      if (typeof config.speedMultiplier !== 'number') {
        errors.push('Speed multiplier must be a number');
      } else if (config.speedMultiplier < 0.5 || config.speedMultiplier > 2) {
        errors.push('Speed multiplier must be between 0.5 and 2');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize user input
   * @param {string} input - User input
   * @returns {string} - Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate MongoDB ObjectId
   * @param {string} id - ID to validate
   * @returns {boolean} - Whether the ID is valid
   */
  isValidObjectId(id) {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
}

module.exports = new Validator();