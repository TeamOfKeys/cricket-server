// src/services/cacheService.js
const { User } = require('../models');

async function getCachedUser(userId) {
  return await User.findById(userId).lean(); // no Redis, just Mongo
}

async function invalidateUserCache(userId) {
  // caching disabled → no-op
  return;
}
module.exports = {
  getCachedUser,
  invalidateUserCache
};
