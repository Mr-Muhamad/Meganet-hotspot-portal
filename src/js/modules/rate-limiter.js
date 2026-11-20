/**
 * Rate Limiter Module - Prevent brute force attacks
 * @module Hotspot.rateLimiter
 */
var rateLimiter = {
  config: {
    maxAttempts: 5,
    windowMs: 60000, // 1 minute
    blockDurationMs: 300000 // 5 minutes
  },

  attempts: {},

  loadAttempts: function() {
    try {
      if (typeof localStorage !== 'undefined') {
        var data = localStorage.getItem('hotspot_rate_attempts');
        if (data) {
          this.attempts = JSON.parse(data);
        }
      }
    } catch (err) {
      console.error('Load attempts error:', err);
    }
  },

  saveAttempts: function() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hotspot_rate_attempts', JSON.stringify(this.attempts));
      }
    } catch (err) {
      console.error('Save attempts error:', err);
    }
  },

  /**
   * Check if action is rate limited
   * @param {string} key - Rate limit key (e.g., username or IP)
   * @param {number} [maxAttemptsOverride] - Optional per-key max attempt ceiling
   * @returns {object} Rate limit status
   */
  check: function(key, maxAttemptsOverride) {
    this.loadAttempts();
    var now = Date.now();
    var entry = this.attempts[key];
    var maxAttempts = (typeof maxAttemptsOverride === 'number' && maxAttemptsOverride > 0)
      ? maxAttemptsOverride
      : this.config.maxAttempts;

    if (!entry) {
      return {
        blocked: false,
        attempts: 0,
        attemptsRemaining: maxAttempts,
        remainingTime: 0,
        warning: false
      };
    }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        blocked: true,
        attempts: entry.timestamps ? entry.timestamps.length : maxAttempts,
        remainingTime: entry.blockedUntil - now,
        attemptsRemaining: 0,
        warning: false
      };
    }

    // Clean up old attempts outside the window (expired blocks reset old timestamps)
    var sourceTimestamps = (!entry.blockedUntil && Array.isArray(entry.timestamps)) ? entry.timestamps : [];
    var recentAttempts = sourceTimestamps.filter(function(timestamp) {
      return now - timestamp < this.config.windowMs;
    }.bind(this));

    if (recentAttempts.length === 0) {
      delete this.attempts[key];
      this.saveAttempts();
      return {
        blocked: false,
        attempts: 0,
        attemptsRemaining: maxAttempts,
        remainingTime: 0,
        warning: false
      };
    }

    this.attempts[key] = {
      timestamps: recentAttempts,
      blockedUntil: null
    };

    // Check if max attempts exceeded
    if (recentAttempts.length >= maxAttempts) {
      this.attempts[key].blockedUntil = now + this.config.blockDurationMs;
      this.saveAttempts();
      return {
        blocked: true,
        attempts: recentAttempts.length,
        remainingTime: this.config.blockDurationMs,
        attemptsRemaining: 0,
        warning: false
      };
    }

    this.saveAttempts();
    var remaining = maxAttempts - recentAttempts.length;
    return {
      blocked: false,
      attempts: recentAttempts.length,
      attemptsRemaining: remaining,
      remainingTime: 0,
      warning: recentAttempts.length > 0 && remaining <= 2
    };
  },

  /**
   * Record an attempt
   * @param {string} key - Rate limit key
   */
  recordAttempt: function(key) {
    this.loadAttempts();
    var now = Date.now();

    if (!this.attempts[key]) {
      this.attempts[key] = {
        timestamps: [],
        blockedUntil: null
      };
    }

    this.attempts[key].timestamps.push(now);
    this.saveAttempts();
  },

  /**
   * Reset attempts for a key
   * @param {string} key - Rate limit key
   */
  reset: function(key) {
    this.loadAttempts();
    delete this.attempts[key];
    this.saveAttempts();
  },

  /**
   * Clear all attempts
   */
  clearAll: function() {
    this.attempts = {};
    this.saveAttempts();
  },

  /**
   * Get remaining block time in human readable format
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted time
   */
  formatBlockTime: function(ms) {
    if (ms <= 0) return '0 seconds';

    var seconds = Math.ceil(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;

    if (minutes > 0) {
      return minutes + ' minute' + (minutes > 1 ? 's' : '') + 
             (seconds > 0 ? ' and ' + seconds + ' second' + (seconds > 1 ? 's' : '') : '');
    }

    return seconds + ' second' + (seconds > 1 ? 's' : '');
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = rateLimiter;
}