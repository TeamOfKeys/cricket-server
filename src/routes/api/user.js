const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { Transaction } = require('../../models');
const cacheService = require('../../services/cacheService');

router.get('/profile', auth.authenticate, async (req, res, next) => {
  try {
    const user = await cacheService.getCachedUser(req.user._id);
    res.json({
      id: user._id,
      username: user.username,
      balance: user.balance
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', auth.authenticate, async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(20);
    
    await cacheService.cacheTransactions(req.user._id, transactions);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

router.post('/deposit', auth.authenticate, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid deposit amount' });
    }

    // In a real application, you would integrate with a payment processor here
    const result = await playerService.handleDeposit(req.user._id, amount);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;