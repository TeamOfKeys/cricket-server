// src/tests/stress/helper.js
const WebSocket = require('ws');

class StressTestHelper {
  constructor() {
    this.connections = new Map();
    this.metrics = {
      successfulConnections: 0,
      failedConnections: 0,
      messages: {
        sent: 0,
        received: 0,
        failed: 0
      },
      latencies: []
    };
  }

  async createConnection(id) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket('ws://localhost:3000');
        
        ws.on('open', () => {
          this.connections.set(id, ws);
          this.metrics.successfulConnections++;
          resolve(ws);
        });

        ws.on('error', (error) => {
          this.metrics.failedConnections++;
          reject(error);
        });

        ws.on('message', (data) => {
          this.metrics.messages.received++;
          try {
            const message = JSON.parse(data);
            if (message.type === 'BET_RESPONSE' || message.type === 'CASHOUT_RESPONSE') {
              this.recordLatency(message.latency);
            }
          } catch (e) {
            console.error('Message parse error:', e);
          }
        });

        // Add ping/pong for connection health check
        ws.on('pong', () => {
          const connection = this.connections.get(id);
          if (connection) {
            connection.isAlive = true;
          }
        });

      } catch (error) {
        this.metrics.failedConnections++;
        reject(error);
      }
    });
  }

  async sendMessage(id, message) {
    try {
      const ws = this.connections.get(id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        this.metrics.messages.sent++;
        return true;
      }
      return false;
    } catch (error) {
      this.metrics.messages.failed++;
      return false;
    }
  }

  recordLatency(latency) {
    this.metrics.latencies.push(latency);
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift();
    }
  }

  getMetrics() {
    const latencies = this.metrics.latencies;
    return {
      ...this.metrics,
      latencyStats: latencies.length > 0 ? {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        p95: this.calculatePercentile(latencies, 95),
        p99: this.calculatePercentile(latencies, 99)
      } : null,
      activeConnections: this.connections.size
    };
  }

  calculatePercentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * p / 100;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  }

  cleanup() {
    for (const [id, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.connections.clear();
  }
}

module.exports = new StressTestHelper();