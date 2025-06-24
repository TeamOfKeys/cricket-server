// src/app.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// Import configurations
const mongoManager = require('./config/mongodb');
const redisManager = require('./config/redis');

// Import services
const gameService = require('./services/gameService');
const broadcastService = require('./services/broadcastService');
const playerService = require('./services/playerService');

// Import middleware
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const healthRoutes = require('./routes/health');
const { router: authRoutes } = require('./routes/api/auth');
const { router: adminRoutes } = require('./routes/api/admin');
const gameRoutes = require('./routes/api/game');
const userRoutes = require('./routes/api/user');

// Import utilities
const performanceMetrics = require('./utils/performanceMetrics');
const logger = require('./utils/logger');

const useCluster = process.env.NODE_ENV === 'production';

if (useCluster && cluster.isMaster) {
  logger.info(`Master process ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died with code: ${code} and signal: ${signal}`);
    logger.info('Starting a new worker');
    cluster.fork();
  });
} else {
  startServer();
}

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoManager.connect();

    const app = express();
    const server = http.createServer(app);

    // Basic middleware
    app.use(cors({
      origin: '*', // Allow all origins (for testing only)
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    // Performance monitoring middleware
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        performanceMetrics.recordApiLatency(req.path, duration);
      });
      next();
    });

    // Rate limiting
    app.use('/api', apiLimiter);

    // Health checks (no rate limiting)
    app.use('/health', healthRoutes);

    // API routes
    app.use('/api', authRoutes);
    app.use('/api', gameRoutes);
    app.use('/api', userRoutes);

    // Admin routes
    if (process.env.NODE_ENV === 'development') {
      app.use('/admin', express.static(path.join(__dirname, 'admin')));
    }

    // Error handling middleware
    app.use((err, req, res, next) => {
      performanceMetrics.recordError(err);
      logger.error('Unhandled error:', err);
      res.status(500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message
      });
    });

    // Final error handler
    app.use(errorHandler.handle);

    // WebSocket setup
    const wsServer = broadcastService.initialize(server);
    const pingInterval = broadcastService.startPingInterval();

    // Cleanup on server close
    server.on('close', () => {
      clearInterval(pingInterval);
      if (wsServer) {
        wsServer.close();
      }
    });

    // Initialize game state
    playerService.setGameState(gameService.getGameState());
    await gameService.initializeSeedChain();

    // Start memory management
    startMemoryManagement();

    // Start the server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Cricket Crash Game server running on http://localhost:${PORT}`);
      logger.info(`Worker ${process.pid} is ready to handle connections`);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function startMemoryManagement() {
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    performanceMetrics.recordMemoryUsage(memoryUsage);

    if (memoryUsage.heapUsed > 1024 * 1024 * 768) { // 768 MB
      logger.warn('High memory usage detected, cleaning up resources');
      gameService.cleanupStaleData();

      if (global.gc) {
        global.gc();
        performanceMetrics.recordGarbageCollection();
      }
    }
  }, 60000); // Check every minute
}

// Error handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  performanceMetrics.recordError(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  performanceMetrics.recordError(reason);
});

// Export for testing
module.exports = {
  startServer
};