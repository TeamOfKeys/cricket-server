// src/services/broadcastService.js
const WebSocket = require('ws');
const performanceMetrics = require('../utils/performanceMetrics');
const logger = require('../utils/logger');

class BroadcastService {
  constructor() {
    this.clients = new Set();
    this.wss = null;
  }

  initialize(server) {
    // Create WebSocket server with optimization options
    this.wss = new WebSocket.Server({ 
      server,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 1,
          memLevel: 7
        },
        threshold: 1024
      },
      maxPayload: 65536 // 64KB
    });
    this.wss.on('connection', (ws) => {
        console.log('[WS] ✅ Client connected');
    });
    this.setupWebSocketHandlers();
    return this.wss;
  }

  

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      this.handleNewConnection(ws);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
      performanceMetrics.recordError(error);
    });
  }

  handleNewConnection(ws) {
    // Add client to the set
    this.clients.add(ws);
    ws.isAlive = true;
    ws.lastActivityTs = Date.now();
    
    logger.info(`Client connected. Total connections: ${this.clients.size}`);
    performanceMetrics.recordConnection();

    // Set up message handler
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(ws, data);
      } catch (error) {
        logger.error('Error processing message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Set up ping handler
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivityTs = Date.now();
      const latency = Date.now() - ws.lastPingTs;
      performanceMetrics.recordWebsocketLatency(latency);
    });

    // Set up close handler
    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info(`Client disconnected. Total connections: ${this.clients.size}`);
      performanceMetrics.recordDisconnection();
    });

    // Set up error handler
    ws.on('error', (error) => {
      logger.error('WebSocket client error:', error);
      performanceMetrics.recordError(error);
      this.clients.delete(ws);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'welcome',
      message: 'Welcome to Cricket Crash Game!'
    });
  }

  async handleMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  broadcastGameState(gameState) {
    const startTime = Date.now();
    
    try {
      const stateToSend = {
        type: 'gameState',
        status: gameState.status,
        phase: gameState.phase,
        multiplier: gameState.multiplier,
        roundId: gameState.roundId,
        players: Array.from(gameState.players.entries()).map(([id, data]) => ({
          id,
          username: data.username,
          betAmount: data.betAmount,
          hasCashedOut: data.hasCashedOut,
          cashoutMultiplier: data.cashoutMultiplier
        })),
        nextGameCountdown: gameState.nextGameCountdown,
        lastCrashPoints: gameState.lastCrashPoints
      };

      this.broadcast(stateToSend);
    } catch (err) {
      logger.error('Broadcast error:', err);
      performanceMetrics.recordError(err);
    }

    performanceMetrics.recordBroadcastLatency(Date.now() - startTime, this.clients.size);
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    const clientsArray = Array.from(this.clients);
    
    if (clientsArray.length < 1000) {
      // For small numbers of clients, simple iteration
      clientsArray.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    } else {
      // For large numbers, process in batches
      const BATCH_SIZE = 500;
      const batches = Math.ceil(clientsArray.length / BATCH_SIZE);
      
      for (let batch = 0; batch < batches; batch++) {
        const start = batch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, clientsArray.length);
        
        setTimeout(() => {
          for (let i = start; i < end; i++) {
            const client = clientsArray[i];
            if (client && client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          }
        }, batch * 5); // 5ms between batches
      }
    }
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  sendError(ws, message) {
    this.sendToClient(ws, {
      type: 'ERROR',
      message
    });
  }

  startPingInterval() {
    return setInterval(() => {
      let deadClients = 0;
      this.clients.forEach(ws => {
        if (ws.isAlive === false) {
          deadClients++;
          return ws.terminate();
        }
        
        if (Date.now() - ws.lastActivityTs > 300000) { // 5 minutes
          deadClients++;
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.lastPingTs = Date.now();
        ws.ping();
      });
      
      if (deadClients > 0) {
        logger.info(`Terminated ${deadClients} dead connections`);
      }
    }, 30000); // Check every 30 seconds
  }

  getConnectedClients() {
    return this.clients.size;
  }
}

module.exports = new BroadcastService();