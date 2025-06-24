// src/config/websocket.js
const WebSocket = require('ws');
const logger = require('../utils/logger');
const performanceMetrics = require('../utils/performanceMetrics');

class WebSocketConfig {
  constructor() {
    this.options = {
      // Compression options
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 1, // Fast compression
          memLevel: 7
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024 // 10KB chunks
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024 // Only compress messages larger than 1KB
      },
      // Maximum message size (64KB)
      maxPayload: 65536,
      // Heartbeat interval (30 seconds)
      heartbeatInterval: 30000,
      // Client timeout (5 minutes)
      clientTimeout: 300000
    };
  }

  createServer(server) {
    const wss = new WebSocket.Server({
      server,
      ...this.options
    });

    // Set up error handling
    wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
      performanceMetrics.recordError(error);
    });

    // Log server status
    logger.info('WebSocket server created', {
      maxPayload: this.options.maxPayload,
      heartbeatInterval: this.options.heartbeatInterval
    });

    return wss;
  }

  configureClient(ws) {
    // Set up client properties
    ws.isAlive = true;
    ws.lastActivityTs = Date.now();
    ws.messageCount = 0;
    ws.lastMessageTime = Date.now();

    // Set up client error handling
    ws.on('error', (error) => {
      logger.error('WebSocket client error:', error, {
        clientId: ws.id
      });
      performanceMetrics.recordError(error);
    });

    // Set up ping handler
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivityTs = Date.now();
      const latency = Date.now() - ws.lastPingTs;
      performanceMetrics.recordWebsocketLatency(latency);
    });

    return ws;
  }

  startHeartbeat(wss) {
    const interval = setInterval(() => {
      let deadClients = 0;
      wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
          deadClients++;
          return ws.terminate();
        }

        if (Date.now() - ws.lastActivityTs > this.options.clientTimeout) {
          deadClients++;
          logger.info('Terminating inactive client', { clientId: ws.id });
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.lastPingTs = Date.now();
        ws.ping();
      });

      if (deadClients > 0) {
        logger.info(`Terminated ${deadClients} dead connections`);
      }

      performanceMetrics.recordMetric('activeConnections', wss.clients.size);
    }, this.options.heartbeatInterval);

    return interval;
  }

  handleUpgrade(wss) {
    return (request, socket, head) => {
      // You can add authentication here if needed
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    };
  }
}

module.exports = new WebSocketConfig();