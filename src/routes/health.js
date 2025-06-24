// src/routes/health.js
const express = require('express');
const router = express.Router();
const performanceMetrics = require('../utils/performanceMetrics');
const mongoose = require('mongoose');

router.get('/', (req, res) => {
  const metrics = performanceMetrics.getMetrics();
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    metrics: {
      connections: metrics.current.connections,
      latency: {
        api: metrics.current.latency.api.getAverage(),
        websocket: metrics.current.latency.websocket.getAverage(),
        gameLoop: metrics.current.latency.gameLoop.getAverage()
      },
      gameplay: {
        betsProcessed: metrics.current.gameplay.betsProcessed,
        cashoutsProcessed: metrics.current.gameplay.cashoutsProcessed,
        gamesPlayed: metrics.current.gameplay.gamesPlayed
      },
      errors: {
        count: metrics.current.errors.count,
        recent: metrics.current.errors.recent.slice(0, 5) // Last 5 errors
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    }
  });
});

router.get('/readiness', (req, res) => {
  // Check critical services
  const checks = {
    mongodb: mongoose.connection.readyState === 1,
    server: true
  };

  const isHealthy = Object.values(checks).every(Boolean);

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    timestamp: Date.now(),
    checks
  });
});

router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

module.exports = router;