// src/utils/performanceMetrics.js
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      connections: {
        current: 0,
        peak: 0,
        total: 0,
        disconnects: 0
      },
      latency: {
        api: new MovingAverage(100),
        websocket: new MovingAverage(100),
        broadcast: new MovingAverage(100),
        gameLoop: new MovingAverage(100)
      },
      gameplay: {
        betsProcessed: 0,
        cashoutsProcessed: 0,
        gamesPlayed: 0,
        averageBetAmount: new MovingAverage(100),
        averageMultiplier: new MovingAverage(100)
      },
      memory: {
        usage: [],
        lastGC: null
      },
      errors: {
        count: 0,
        recent: []
      }
    };

    // Keep hourly snapshots for 24 hours
    this.hourlySnapshots = [];
    this._startHourlySnapshots();
  }

  // Connection metrics
  recordConnection() {
    this.metrics.connections.current++;
    this.metrics.connections.total++;
    this.metrics.connections.peak = Math.max(
      this.metrics.connections.peak,
      this.metrics.connections.current
    );
  }

  recordDisconnection() {
    this.metrics.connections.current--;
    this.metrics.connections.disconnects++;
  }

  // Latency metrics
  recordApiLatency(path, duration) {
    this.metrics.latency.api.add({
      path,
      duration,
      timestamp: Date.now()
    });
  }

  recordWebsocketLatency(duration) {
    this.metrics.latency.websocket.add(duration);
  }

  recordBroadcastLatency(duration, clientCount) {
    this.metrics.latency.broadcast.add({
      duration,
      clientCount,
      timestamp: Date.now()
    });
  }

  recordLoopLatency(duration) {
    this.metrics.latency.gameLoop.add(duration);
  }

  // Gameplay metrics
  recordBet(amount) {
    this.metrics.gameplay.betsProcessed++;
    this.metrics.gameplay.averageBetAmount.add(amount);
  }

  recordCashout(multiplier) {
    this.metrics.gameplay.cashoutsProcessed++;
    this.metrics.gameplay.averageMultiplier.add(multiplier);
  }

  recordGameCompleted() {
    this.metrics.gameplay.gamesPlayed++;
  }

  // Memory metrics
  recordMemoryUsage(memoryUsage) {
    const usage = {
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss
    };

    this.metrics.memory.usage.push(usage);
    
    // Keep only last hour of memory metrics
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.memory.usage = this.metrics.memory.usage.filter(
      m => m.timestamp > oneHourAgo
    );
  }

  recordGarbageCollection() {
    this.metrics.memory.lastGC = Date.now();
  }

  // Error tracking
  recordError(error) {
    this.metrics.errors.count++;
    this.metrics.errors.recent.unshift({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack
    });

    // Keep only last 100 errors
    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent.pop();
    }
  }

  // Get metrics
  getMetrics() {
    return {
      current: this.metrics,
      hourly: this.hourlySnapshots
    };
  }

  // Get specific metric
  getMetric(category, name) {
    if (this.metrics[category] && this.metrics[category][name]) {
      return this.metrics[category][name];
    }
    return null;
  }

  // Internal method for hourly snapshots
  _startHourlySnapshots() {
    setInterval(() => {
      const snapshot = {
        timestamp: Date.now(),
        connections: { ...this.metrics.connections },
        gameplay: {
          betsProcessed: this.metrics.gameplay.betsProcessed,
          cashoutsProcessed: this.metrics.gameplay.cashoutsProcessed,
          gamesPlayed: this.metrics.gameplay.gamesPlayed,
          averageBetAmount: this.metrics.gameplay.averageBetAmount.getAverage(),
          averageMultiplier: this.metrics.gameplay.averageMultiplier.getAverage()
        },
        latency: {
          api: this.metrics.latency.api.getAverage(),
          websocket: this.metrics.latency.websocket.getAverage(),
          broadcast: this.metrics.latency.broadcast.getAverage(),
          gameLoop: this.metrics.latency.gameLoop.getAverage()
        }
      };

      this.hourlySnapshots.unshift(snapshot);
      
      // Keep 24 hours of snapshots
      if (this.hourlySnapshots.length > 24) {
        this.hourlySnapshots.pop();
      }
    }, 3600000); // Every hour
  }
}

// Helper class for calculating moving averages
class MovingAverage {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  add(value) {
    this.values.unshift(value);
    if (this.values.length > this.size) {
      this.values.pop();
    }
  }

  getAverage() {
    if (this.values.length === 0) return 0;
    
    if (typeof this.values[0] === 'object') {
      // For complex metrics, return the latest value
      return this.values[0];
    }
    
    const sum = this.values.reduce((a, b) => a + b, 0);
    return sum / this.values.length;
  }

  getValues() {
    return this.values;
  }
}

module.exports = new PerformanceMetrics();