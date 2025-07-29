// src/routes/api/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../../models');
const cacheService = require('../../services/cacheService');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ───────────── Register ─────────────
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;


    console.log('Registering user:', username);
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    await cacheService.getCachedUser(newUser._id); // Prime the cache

    res.status(201).json({ message: 'User created successfully', userId: newUser._id });
  } catch (error) {
    next(error);
  }
});

// ───────────── Login ─────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await cacheService.getCachedUser(user._id); // Prime the cache

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        balance: user.balance
      }
    });
  } catch (error) {
    next(error);
  }
});

// ───────────── Auth middleware ─────────────
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    cacheService.getCachedUser(decoded.userId)
      .then(user => {
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        req.user = user;
        next();
      })
      .catch(err => {
        console.error('Auth error:', err);
        res.status(401).json({ error: 'Unauthorized' });
      });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  router,        // For app.use('/api', authRoutes)
  authenticate   // For require() in other routes like game.js
};
