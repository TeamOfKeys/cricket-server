// src/routes/api/game.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth'); 
const { betLimiter } = require('../../middleware/rateLimiter');
const playerService = require('../../services/playerService');
const gameService = require('../../services/gameService');
const { Game } = require('../../models');
const logger = require('../../utils/logger');

router.post('/bet', authenticate, betLimiter, async (req, res, next) => {
    console.log('🛠️ /api/bet request body:', req.body);
console.log('🛠️ req.user:', req.user);
  try {
    const { amount, autoCashoutAt } = req.body;
    const result = await playerService.handlePlaceBet(
      req.user._id,
      amount,
      autoCashoutAt,
      req.user.username
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/cashout', authenticate, async (req, res, next) => {
  try {
    const result = await playerService.handleCashout(req.user._id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await Game.find({ revealed: true })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('roundId serverSeedHash crashPoint rtp timestamp');
    
    res.json(history);
  } catch (error) {
    logger.error('Error fetching game history:', error);
    next(error);
  }
});

router.get('/verify/:roundId', async (req, res, next) => {
  try {
    const { roundId } = req.params;
    const game = await Game.findOne({ roundId });
    
    if (!game || !game.revealed) {
      return res.status(404).json({ error: 'Game not found or not completed yet' });
    }

    const verification = await gameService.verifyGame(game);
    if (!verification) {
      return res.status(404).json({ error: 'Could not verify game' });
    }
    
    res.json(verification);
  } catch (error) {
    logger.error('Error verifying game:', error);
    next(error);
  }
});

router.post('/admin/set-rtp', authenticate, async (req, res, next) => {
  try {
    const { rtp } = req.body;
    
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (gameService.isGameRunning()) {
      return res.status(400).json({ error: 'Cannot change RTP during a game' });
    }

    if (rtp < 0.8 || rtp > 0.99) {
      return res.status(400).json({ error: 'RTP must be between 0.8 and 0.99' });
    }

    const result = await gameService.setRTP(rtp);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    logger.error('Error setting RTP:', error);
    next(error);
  }
});

module.exports = router;