// src/middleware/requestLogger.js
const logger = require('../utils/logger');
const performanceMetrics = require('../utils/performanceMetrics');

class RequestLogger {
  constructor() {
    this.sensitiveFields = ['password', 'token', 'authorization', 'apiKey'];
  }

  logRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // Add request ID to the request object
      req.requestId = requestId;

      // Log request
      this.logRequestDetails(req, requestId);

      // Log response
      this.setupResponseLogging(req, res, startTime, requestId);

      next();
    };
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logRequestDetails(req, requestId) {
    const logData = {
      requestId,
      method: req.method,
      url: req.url,
      params: req.params,
      query: this.sanitizeData(req.query),
      body: this.sanitizeData(req.body),
      headers: this.sanitizeHeaders(req.headers),
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    logger.info('Incoming request', logData);
  }

  setupResponseLogging(req, res, startTime, requestId) {
    const originalEnd = res.end;
    const chunks = [];

    // Override res.end to capture response body
    res.end = (...args) => {
      if (args[0]) {
        chunks.push(Buffer.from(args[0]));
      }

      const duration = Date.now() - startTime;
      const responseBody = Buffer.concat(chunks).toString('utf8');

      this.logResponseDetails(req, res, duration, responseBody, requestId);
      performanceMetrics.recordApiLatency(req.path, duration);

      originalEnd.apply(res, args);
    };
  }

  logResponseDetails(req, res, duration, body, requestId) {
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      parsedBody = body;
    }

    const logData = {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      responseSize: body.length,
      response: this.sanitizeData(parsedBody)
    };

    if (res.statusCode >= 400) {
      logger.error('Request error', null, logData);
    } else {
      logger.info('Request completed', logData);
    }
  }

  sanitizeData(data) {
    if (!data) return data;
    
    const sanitized = { ...data };
    for (const field of this.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token'
    ];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  // Middleware for tracking API usage
  apiUsageTracker() {
    const apiUsage = new Map();

    return (req, res, next) => {
      const endpoint = `${req.method} ${req.path}`;
      const current = apiUsage.get(endpoint) || 0;
      apiUsage.set(endpoint, current + 1);

      // Log API usage every hour
      if (current % 100 === 0) {
        performanceMetrics.recordMetric('apiUsage', {
          endpoint,
          count: current + 1
        });
      }

      next();
    };
  }

  // Error logging middleware
  errorLogger() {
    return (err, req, res, next) => {
      logger.error('Unhandled error', err, {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userId: req.user?.id
      });

      performanceMetrics.recordError(err);

      next(err);
    };
  }
}

module.exports = new RequestLogger();