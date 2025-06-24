// src/utils/logger.js
const winston = require('winston');
const path = require('path');

class Logger {
  constructor() {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    );

    // Create logger instance
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'cricket-crash' },
      transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      ]
    });

    // If we're not in production, log to the console as well
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.logger.info(message, { ...meta, timestamp: new Date() });
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, timestamp: new Date() });
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   * @param {Object} meta - Additional metadata
   */
  error(message, error = null, meta = {}) {
    this.logger.error(message, {
      ...meta,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null,
      timestamp: new Date()
    });
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, timestamp: new Date() });
  }

  /**
   * Log game events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  gameEvent(event, data = {}) {
    this.logger.info(`Game Event: ${event}`, {
      type: 'game_event',
      event,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Log player actions
   * @param {string} action - Action type
   * @param {string} userId - User ID
   * @param {Object} data - Action data
   */
  playerAction(action, userId, data = {}) {
    this.logger.info(`Player Action: ${action}`, {
      type: 'player_action',
      action,
      userId,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Log system metrics
   * @param {string} metric - Metric name
   * @param {*} value - Metric value
   * @param {Object} meta - Additional metadata
   */
  metric(metric, value, meta = {}) {
    this.logger.info(`Metric: ${metric}`, {
      type: 'metric',
      metric,
      value,
      ...meta,
      timestamp: new Date()
    });
  }

  /**
   * Log security events
   * @param {string} event - Security event type
   * @param {Object} data - Event data
   */
  security(event, data = {}) {
    this.logger.warn(`Security Event: ${event}`, {
      type: 'security_event',
      event,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Stream logs for real-time monitoring
   * @param {Function} callback - Callback function for log events
   */
  stream(callback) {
    this.logger.on('data', (log) => {
      callback(log);
    });
  }
}

module.exports = new Logger();