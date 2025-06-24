// src/config/redis.js
const Redis = require('ioredis');

const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  enableReadyCheck: false,
};

class RedisManager {
  constructor() {
    this.useRedis = process.env.USE_REDIS === 'true';
    this.memoryCache = new Map();
    
    if (this.useRedis) {
      this.initRedisClients();
    } else {
      this.initMemoryCache();
    }
  }

  initRedisClients() {
    this.redisCache = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);
    
    if (process.env.NODE_ENV === 'production') {
      this.redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);
      this.redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);
      
      this.redisSub.subscribe('game-state-updates');
    }
  }

  initMemoryCache() {
    this.redisCache = {
      async get(key) {
        const item = this.memoryCache.get(key);
        if (!item) return null;
        if (item.expiry && Date.now() > item.expiry) {
          this.memoryCache.delete(key);
          return null;
        }
        return item.value;
      },
      async set(key, value, ex, seconds) {
        const expiry = seconds ? Date.now() + (seconds * 1000) : null;
        this.memoryCache.set(key, { value, expiry });
      },
      async del(key) {
        this.memoryCache.delete(key);
      }
    };

    this.redisPub = { async publish() {} };
    this.redisSub = { async subscribe() {} };
  }

  getClients() {
    return {
      cache: this.redisCache,
      pub: this.redisPub,
      sub: this.redisSub
    };
  }
}

module.exports = new RedisManager();