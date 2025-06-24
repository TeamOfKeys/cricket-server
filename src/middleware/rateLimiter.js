// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const createLimiter = (options = {}) => {
  const defaults = {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Default limit
    message: 'Too many requests, please try again later',
    skipSuccessfulRequests: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path.startsWith('/health')) {
        return true;
      }
      // Skip for load testing from localhost
      if (req.ip === '127.0.0.1' || req.ip === '::1') {
        return true;
      }
      return false;
    }
  };



  return rateLimit({
    ...defaults,
    ...options
  });
};

module.exports = {
  // General API limiter
  apiLimiter: createLimiter({
    windowMs: 60 * 1000,
    max: 2000 // Increased from 1000
  }),

  // Auth endpoints limiter
  authLimiter: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100
  }),

  // Game endpoints limiter
  gameLimiter: createLimiter({
    windowMs: 60 * 1000,
    max: 1500
  }),

  // WebSocket connection limiter
  wsLimiter: createLimiter({
    windowMs: 60 * 1000,
    max: 500
  }),
  betLimiter:rateLimit({ windowMs: 60_000, max: 5 })
};