// tests/stress/websocket-test.js
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class WebSocketStressTest {
  constructor(options = {}) {
    this.options = {
      url: 'ws://localhost:3000',
      connections: 100,
      messageInterval: 100,
      testDuration: 60000,
      rampUpTime: 5000,
      ...options
    };

    this.metrics = {
      connections: {
        total: 0,
        active: 0,
        failed: 0
      },
      messages: {
        sent: 0,
        received: 0,
        failed: 0
      },
      latency: {
        values: [],
        min: Infinity,
        max: 0,
        avg: 0
      },
      errors: []
    };

    this.clients = new Map();
    this.isRunning = false;
  }

  async start() {
    console.log('Starting WebSocket stress test...');
    this.isRunning = true;
    this.startTime = Date.now();

    // Start metrics reporting
    this.reportingInterval = setInterval(() => {
      this.reportMetrics();
    }, 1000);

    // Start client creation with ramp-up
    const connectionsPerBatch = Math.ceil(this.options.connections * (1000 / this.options.rampUpTime));
    
    for (let i = 0; i < this.options.connections && this.isRunning; i += connectionsPerBatch) {
      await this.createClientBatch(Math.min(connectionsPerBatch, this.options.connections - i));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Set test end timeout
    setTimeout(() => {
      this.stop();
    }, this.options.testDuration);
  }

  async createClientBatch(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.createClient());
    }
    await Promise.all(promises);
  }

  async createClient() {
    const clientId = `client_${this.metrics.connections.total++}`;
    
    try {
      const ws = new WebSocket(this.options.url);
      
      ws.on('open', () => {
        this.metrics.connections.active++;
        this.clients.set(clientId, {
          ws,
          lastPing: 0,
          messageCount: 0
        });

        // Start sending messages
        this.startMessageInterval(clientId);
      });

      ws.on('message', (data) => {
        this.metrics.messages.received++;
        this.handleMessage(clientId, data);
      });

      ws.on('close', () => {
        this.metrics.connections.active--;
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        this.metrics.errors.push({
          time: Date.now(),
          clientId,
          error: error.message
        });
      });

    } catch (error) {
      this.metrics.connections.failed++;
      this.metrics.errors.push({
        time: Date.now(),
        clientId,
        error: error.message
      });
    }
  }

  startMessageInterval(clientId) {
    const interval = setInterval(() => {
      if (!this.isRunning || !this.clients.has(clientId)) {
        clearInterval(interval);
        return;
      }

      this.sendMessage(clientId);
    }, this.options.messageInterval);
  }

  sendMessage(clientId) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      const message = {
        type: 'PLACE_BET',
        userId: clientId,
        amount: Math.floor(Math.random() * 90) + 10,
        autoCashoutAt: (Math.random() * 3.5 + 1.5).toFixed(2)
      };

      client.lastPing = performance.now();
      client.ws.send(JSON.stringify(message));
      this.metrics.messages.sent++;
    } catch (error) {
      this.metrics.messages.failed++;
      this.metrics.errors.push({
        time: Date.now(),
        clientId,
        error: error.message
      });
    }
  }

  handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const latency = performance.now() - client.lastPing;
      this.updateLatencyMetrics(latency);
    } catch (error) {
      this.metrics.errors.push({
        time: Date.now(),
        clientId,
        error: error.message
      });
    }
  }

  updateLatencyMetrics(latency) {
    this.metrics.latency.values.push(latency);
    this.metrics.latency.min = Math.min(this.metrics.latency.min, latency);
    this.metrics.latency.max = Math.max(this.metrics.latency.max, latency);
    
    // Keep only last 1000 latency values
    if (this.metrics.latency.values.length > 1000) {
      this.metrics.latency.values.shift();
    }

    // Update average
    this.metrics.latency.avg = this.metrics.latency.values.reduce((a, b) => a + b, 0) / 
                              this.metrics.latency.values.length;
  }

  reportMetrics() {
    const runtime = (Date.now() - this.startTime) / 1000;
    
    console.clear();
    console.log('=== WebSocket Stress Test Metrics ===');
    console.log(`Runtime: ${runtime.toFixed(0)}s`);
    console.log('\nConnections:');
    console.log(`- Active: ${this.metrics.connections.active}`);
    console.log(`- Total: ${this.metrics.connections.total}`);
    console.log(`- Failed: ${this.metrics.connections.failed}`);
    
    console.log('\nMessages:');
    console.log(`- Sent: ${this.metrics.messages.sent}`);
    console.log(`- Received: ${this.metrics.messages.received}`);
    console.log(`- Failed: ${this.metrics.messages.failed}`);
    
    console.log('\nLatency (ms):');
    console.log(`- Min: ${this.metrics.latency.min.toFixed(2)}`);
    console.log(`- Max: ${this.metrics.latency.max.toFixed(2)}`);
    console.log(`- Avg: ${this.metrics.latency.avg.toFixed(2)}`);
    
    console.log('\nRecent Errors:');
    this.metrics.errors.slice(-5).forEach(error => {
      console.log(`- ${new Date(error.time).toISOString()}: ${error.error}`);
    });
  }

  stop() {
    console.log('\nStopping test...');
    this.isRunning = false;
    clearInterval(this.reportingInterval);

    // Close all connections
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    }

    // Final report
    this.generateFinalReport();
  }

  generateFinalReport() {
    const runtime = (Date.now() - this.startTime) / 1000;
    const report = {
      testDuration: runtime,
      connections: this.metrics.connections,
      messages: this.metrics.messages,
      latency: {
        min: this.metrics.latency.min,
        max: this.metrics.latency.max,
        avg: this.metrics.latency.avg
      },
      messageRate: {
        sent: this.metrics.messages.sent / runtime,
        received: this.metrics.messages.received / runtime
      },
      errorRate: this.metrics.errors.length / runtime
    };

    console.log('\n=== Final Test Report ===');
    console.log(JSON.stringify(report, null, 2));
  }
}

// Run if called directly
if (require.main === module) {
  const test = new WebSocketStressTest({
    connections: 1000,
    testDuration: 60000 // 1 minute
  });
  
  test.start().catch(console.error);
}

module.exports = WebSocketStressTest;