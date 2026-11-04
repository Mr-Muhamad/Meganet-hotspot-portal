/**
 * Tests for Hotspot.rateLimiter module
 */

const rateLimiter = require('../../src/js/modules/rate-limiter.js');

describe('Hotspot.rateLimiter', () => {
  beforeEach(() => {
    // Reset rate limiter before each test
    rateLimiter.clearAll();
  });

  describe('check', () => {
    test('allows first attempt', () => {
      var status = rateLimiter.check('testuser');
      expect(status.blocked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });

    test('tracks attempts', () => {
      rateLimiter.recordAttempt('testuser');
      rateLimiter.recordAttempt('testuser');

      var status = rateLimiter.check('testuser');
      expect(status.blocked).toBe(false);
      expect(status.attemptsRemaining).toBe(3);
    });

    test('blocks after max attempts', () => {
      for (var i = 0; i < 5; i++) {
        rateLimiter.recordAttempt('testuser');
      }

      var status = rateLimiter.check('testuser');
      expect(status.blocked).toBe(true);
      expect(status.remainingTime).toBeGreaterThan(0);
    });

    test('separates different keys', () => {
      for (var i = 0; i < 5; i++) {
        rateLimiter.recordAttempt('user1');
      }

      var status1 = rateLimiter.check('user1');
      var status2 = rateLimiter.check('user2');

      expect(status1.blocked).toBe(true);
      expect(status2.blocked).toBe(false);
    });
  });

  describe('recordAttempt', () => {
    test('records attempt', () => {
      rateLimiter.recordAttempt('testuser');
      var status = rateLimiter.check('testuser');
      expect(status.attemptsRemaining).toBe(4);
    });

    test('increments attempts', () => {
      rateLimiter.recordAttempt('testuser');
      rateLimiter.recordAttempt('testuser');
      rateLimiter.recordAttempt('testuser');

      var status = rateLimiter.check('testuser');
      expect(status.attemptsRemaining).toBe(2);
    });
  });

  describe('reset', () => {
    test('resets attempts for key', () => {
      for (var i = 0; i < 5; i++) {
        rateLimiter.recordAttempt('testuser');
      }

      rateLimiter.reset('testuser');

      var status = rateLimiter.check('testuser');
      expect(status.blocked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });

    test('does not affect other keys', () => {
      rateLimiter.recordAttempt('user1');
      rateLimiter.recordAttempt('user2');

      rateLimiter.reset('user1');

      var status2 = rateLimiter.check('user2');
      expect(status2.attemptsRemaining).toBe(4);
    });
  });

  describe('clearAll', () => {
    test('clears all attempts', () => {
      rateLimiter.recordAttempt('user1');
      rateLimiter.recordAttempt('user2');
      rateLimiter.recordAttempt('user3');

      rateLimiter.clearAll();

      expect(rateLimiter.check('user1').attemptsRemaining).toBe(5);
      expect(rateLimiter.check('user2').attemptsRemaining).toBe(5);
      expect(rateLimiter.check('user3').attemptsRemaining).toBe(5);
    });
  });

  describe('formatBlockTime', () => {
    test('formats seconds', () => {
      expect(rateLimiter.formatBlockTime(30000)).toBe('30 seconds');
    });

    test('formats single second', () => {
      expect(rateLimiter.formatBlockTime(1000)).toBe('1 second');
    });

    test('formats minutes', () => {
      expect(rateLimiter.formatBlockTime(120000)).toBe('2 minutes');
    });

    test('formats minutes and seconds', () => {
      expect(rateLimiter.formatBlockTime(90000)).toBe('1 minute and 30 seconds');
    });

    test('handles zero', () => {
      expect(rateLimiter.formatBlockTime(0)).toBe('0 seconds');
    });
  });

  describe('getStatusMessage', () => {
    test('returns empty for no attempts', () => {
      expect(rateLimiter.getStatusMessage('testuser')).toBe('');
    });

    test('returns remaining attempts message', () => {
      rateLimiter.recordAttempt('testuser');
      var message = rateLimiter.getStatusMessage('testuser');
      expect(message).toContain('remaining');
    });

    test('returns block message when blocked', () => {
      for (var i = 0; i < 5; i++) {
        rateLimiter.recordAttempt('testuser');
      }

      var message = rateLimiter.getStatusMessage('testuser');
      expect(message).toContain('Too many attempts');
    });
  });
});