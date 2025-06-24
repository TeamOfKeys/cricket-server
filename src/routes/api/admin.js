// src/routes/api/admin.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { Game, User, Transaction } = require('../../models');
const performanceMetrics = require('../../utils/performanceMetrics');
const validator = require('../../utils/validator');
const logger = require('../../utils/logger');

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  try {
    await auth.authenticate(req, res, () => {});
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Get system metrics
router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const metrics = performanceMetrics.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get server status
router.get('/status', adminAuth, async (req, res) => {
  try {
    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: Date.now()
    };
    res.json(status);
  } catch (error) {
    logger.error('Error fetching server status:', error);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

// Update game configuration
router.post('/config', adminAuth, async (req, res) => {
  try {
    const validation = validator.validateGameConfig(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ errors: validation.errors });
    }

    // Update game configuration
    const { rtp, bettingPhaseDuration, speedMultiplier } = req.body;
    
    // Store in database or cache as needed
    // For now, we'll just log it
    logger.info('Game configuration updated', {
      rtp,
      bettingPhaseDuration,
      speedMultiplier,
      updatedBy: req.user.id
    });

    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    logger.error('Error updating game configuration:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get recent games
router.get('/games', adminAuth, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const games = await Game.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .select('-serverSeed'); // Don't expose server seed

    const total = await Game.countDocuments();

    res.json({
      games,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get user statistics
router.get('/users/stats', adminAuth, async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            {
              $match: {
                lastActive: { 
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
                }
              }
            },
            { $count: 'count' }
          ],
          balances: [
            {
              $group: {
                _id: null,
                total: { $sum: '$balance' },
                avg: { $avg: '$balance' }
              }
            }
          ]
        }
      }
    ]);

    res.json(stats[0]);
  } catch (error) {
    logger.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get transaction statistics
router.get('/transactions/stats', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const stats = await Transaction.aggregate([
      {
        $match: {
          timestamp: dateFilter
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching transaction statistics:', error);
    res.status(500).json({ error: 'Failed to fetch transaction statistics' });
  }
});

// Server-Sent Events for real-time monitoring
router.get('/events', adminAuth, (req, res) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  res.writeHead(200, headers);

  const clientId = Date.now();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial data
  sendEvent({
    type: 'connected',
    clientId,
    timestamp: Date.now()
  });

  // Set up interval to send metrics
  const interval = setInterval(() => {
    const metrics = {
      type: 'metrics',
      timestamp: Date.now(),
      data: performanceMetrics.getMetrics()
    };
    sendEvent(metrics);
  }, 1000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(interval);
    logger.info('Admin SSE connection closed', { clientId });
  });
});

module.exports = router;