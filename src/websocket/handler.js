// src/websocket/handler.js
const WebSocket = require('ws');
const performanceMetrics = require('../utils/performanceMetrics');
const playerService = require('../services/playerService');
const gameService = require('../services/gameService');
const broadcastService = require('../services/broadcastService');

class WebSocketHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({
      server,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 1,
          memLevel: 7
        },
        threshold: 1024
      },
      maxPayload: 65536
    });

    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  handleConnection(ws, req) {
    this.initializeConnection(ws);
    this.setupMessageHandling(ws);
    this.setupConnectionMonitoring(ws);
  }

  initializeConnection(ws) {
    broadcastService.addClient(ws);
    
    // Send initial game state
    const gameState = gameService.getGameState();
    ws.send(JSON.stringify({
      type: 'gameState',
      ...gameState
    }));
  }

  setupMessageHandling(ws) {
    // Rate limiting setup
    let messageCount = 0;
    let lastMessageTime = Date.now();
    
    ws.on('message', async (message) => {
      try {
        // Rate limiting check
        const now = Date.now();
        if (now - lastMessageTime < 1000) {
          messageCount++;
          if (messageCount > 10) {
            this.sendError(ws, 'Rate limit exceeded. Please slow down.');
            return;
          }
        } else {
          messageCount = 0;
          lastMessageTime = now;
        }

        // Update activity timestamp
        ws.lastActivityTs = now;

        // Process message
        const data = JSON.parse(message);
        await this.handleMessage(ws, data);
      } catch (error) {
        console.error('Error processing message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });
  }

  async handleMessage(ws, data) {
    switch (data.type) {
      case 'PLACE_BET':
        await this.handleBetRequest(ws, data);
        break;
        
      case 'CASHOUT':
        await this.handleCashoutRequest(ws, data);
        break;
        
      case 'SUBSCRIBE_GAMES':
        await this.handleGameSubscription(ws, data);
        break;
        
      case 'UNSUBSCRIBE_GAMES':
        await this.handleGameUnsubscription(ws, data);
        break;
        
      default:
        this.sendError(ws, 'Unknown command');
    }
  }

  async handleBetRequest(ws, data) {
    performanceMetrics.recordBet(data.amount);
    
    const result = await playerService.handlePlaceBet(
      data.userId,
      data.amount,
      data.autoCashoutAt,
      data.username
    );

    ws.send(JSON.stringify({
      type: 'BET_RESPONSE',
      success: result.success,
      message: result.message,
      data: result
    }));
  }

  async handleCashoutRequest(ws, data) {
    performanceMetrics.recordCashoutRequest();
    
    const result = await playerService.handleCashout(data.userId);

    ws.send(JSON.stringify({
      type: 'CASHOUT_RESPONSE',
      success: result.success,
      message: result.message,
      data: result
    }));
  }

  handleGameSubscription(ws, data) {
    ws.gameSubscription = true;
  }

  handleGameUnsubscription(ws, data) {
    ws.gameSubscription = false;
  }

  setupConnectionMonitoring(ws) {
    ws.isAlive = true;
    ws.lastActivityTs = Date.now();

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivityTs = Date.now();
      
      const latency = Date.now() - ws.lastPingTs;
      performanceMetrics.recordWebsocketLatency(latency);
    });

    ws.on('close', () => {
      broadcastService.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      performanceMetrics.recordError(error);
      broadcastService.removeClient(ws);
    });
  }

  sendError(ws, message) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      message
    }));
  }

  startPingInterval() {
    return setInterval(() => {
      let deadClients = 0;
      this.wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
          deadClients++;
          return ws.terminate();
        }
        
        if (Date.now() - ws.lastActivityTs > 300000) {
          deadClients++;
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.lastPingTs = Date.now();
        ws.ping();
      });
      
      if (deadClients > 0) {
        console.log(`Terminated ${deadClients} dead connections`);
      }
    }, 30000);
  }
}

module.exports = WebSocketHandler;