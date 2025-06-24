// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const cacheService = require('../services/cacheService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
        console.error('Auth error (cache):', err);
        res.status(401).json({ error: 'Unauthorized' });
      });
  } catch (err) {
    console.error('Auth error (JWT):', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  authenticate
};
