// src/routes/index.js
const express = require('express');
const router = express.Router();
const requestLogger = require('../middleware/requestLogger');
const rateLimiter = require('../middleware/rateLimiter');
const errorHandler = require('../middleware/errorHandler');

// Import route modules
const authRoutes = require('./api/auth');
const gameRoutes = require('./api/game');
const userRoutes = require('./api/user');
const adminRoutes = require('./api/admin');

class Routes {
  constructor() {
    this.router = router;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Request logging
    this.router.use(requestLogger.logRequest());
    this.router.use(requestLogger.apiUsageTracker());

    // Apply rate limiting to all API routes
    this.router.use('/api', rateLimiter.apiLimiter);
  }

  setupRoutes() {
    // Health check endpoint
    this.router.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.router.use('/api/auth', authRoutes);
    this.router.use('/api/game', gameRoutes);
    this.router.use('/api/user', userRoutes);
    this.router.use('/api/admin', adminRoutes);

    // API documentation
    if (process.env.NODE_ENV === 'development') {
      this.setupApiDocs();
    }

    // Handle 404 for API routes
    this.router.use('/api/*', (req, res) => {
      res.status(404).json({ error: 'API endpoint not found' });
    });

    // Serve static files for admin dashboard
    if (process.env.NODE_ENV === 'development') {
      this.router.use('/admin', express.static('admin'));
    }

    // Handle all other routes (SPA fallback)
    this.router.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  setupErrorHandling() {
    // Log errors
    this.router.use(requestLogger.errorLogger());

    // Handle errors
    this.router.use(errorHandler.handle);
  }

  setupApiDocs() {
    const swaggerUi = require('swagger-ui-express');
    const swaggerDocument = require('../docs/swagger.json');

    this.router.use('/api-docs', swaggerUi.serve);
    this.router.get('/api-docs', swaggerUi.setup(swaggerDocument));
  }

  getRouter() {
    return this.router;
  }
}

// Export a singleton instance
module.exports = new Routes().getRouter();