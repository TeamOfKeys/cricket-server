// src/services/gameService.js
const { Game } = require('../models');
const { genSeed, hash, genCrash } = require('../utils/cryptoUtils');
const broadcastService = require('./broadcastService');
const logger = require('../utils/logger');

class GameService {
  constructor() {
    this.gameState = {
      status: 'waiting',
      phase: 'BETTING',
      multiplier: 1.00,
      crashPoint: null,
      startTime: null,
      roundId: Date.now().toString(),
      serverSeedHash: null,
      nextServerSeedHash: null,
      players: new Map(),
      nextGameCountdown: 10,
      lastCrashPoints: []
    };

    this.currentServerSeed = null;
    this.nextServerSeed = null;
    this.gameInterval = null;
    this.nextRoundTimeout = null;
    this.isGameRunning = false;

    // Bind methods
    this.startGameRound = this.startGameRound.bind(this);
    this.updateGameLoop = this.updateGameLoop.bind(this);
    this.endGameRound = this.endGameRound.bind(this);
    this.prepareNextRound = this.prepareNextRound.bind(this);
  }

  getGameState() {
    return this.gameState;
  }

  async initializeSeedChain() {
    try {
      if (this.isGameRunning) {
        logger.info('Game already in progress, not initializing');
        return;
      }

      this._clearTimeouts();
      logger.info('Initializing seed chain...');

      await this._initializeFromLastGame();
      await this._updateGameState();
      this._scheduleNextRound();
    } catch (err) {
      logger.error('Seed chain initialization error:', err);
      this.isGameRunning = false;
    }
  }

  async _initializeFromLastGame() {
    const lastGame = await Game.findOne().sort({ timestamp: -1 });
    
    if (lastGame && !lastGame.revealed) {
      this.currentServerSeed = lastGame.serverSeed;
      this.gameState.roundId = lastGame.roundId;
      this.nextServerSeed = genSeed();
      logger.info(`Continuing chain from round ${this.gameState.roundId}`);
    } else {
      await this._initializeNewGame();
    }

    await this._fetchRecentCrashPoints();
  }

  async _initializeNewGame() {
    this.currentServerSeed = genSeed();
    this.nextServerSeed = genSeed();
    this.gameState.roundId = Date.now().toString();

    const initialGame = new Game({
      roundId: this.gameState.roundId,
      serverSeedHash: hash(this.currentServerSeed),
      serverSeed: this.currentServerSeed,
      rtp: 0.97,
      revealed: false
    });

    await initialGame.save();
    logger.info('New seed chain initialized');
  }

  async _fetchRecentCrashPoints() {
    const recentGames = await Game.find({ revealed: true })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('crashPoint');
      
    this.gameState.lastCrashPoints = recentGames.map(g => g.crashPoint);
  }

  async _updateGameState() {
    this.gameState.status = 'waiting';
    this.gameState.phase = 'BETTING';
    this.gameState.serverSeedHash = hash(this.currentServerSeed);
    this.gameState.nextServerSeedHash = hash(this.nextServerSeed);
    this.gameState.multiplier = 1.00;
    this.gameState.players.clear();

    broadcastService.broadcastGameState(this.gameState);
  }

  _scheduleNextRound() {
    const bettingDuration = process.env.BETTING_PHASE_DURATION
      ? parseInt(process.env.BETTING_PHASE_DURATION)
      : 10000;

    this.nextRoundTimeout = setTimeout(this.startGameRound, bettingDuration);
  }

  _clearTimeouts() {
    if (this.nextRoundTimeout) {
      clearTimeout(this.nextRoundTimeout);
      this.nextRoundTimeout = null;
    }
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
  }

  async startGameRound() {
    try {
      this.isGameRunning = true;

      // if (this.gameState.players.size === 0) {
      //   logger.info('No bets placed, restarting betting phase');
      //   this.isGameRunning = false;
      //   await this.prepareNextRound();
      //   return;
      // }

      const game = await Game.findOne({ roundId: this.gameState.roundId });
      if (!game) {
        logger.error('Game not found for round:', this.gameState.roundId);
        this.isGameRunning = false;
        await this.prepareNextRound();
        return;
      }

      const crashPoint = genCrash(this.currentServerSeed, this.gameState.roundId, game.rtp);
      this._updateGameStateForRound(crashPoint);
      this.updateGameLoop();
    } catch (err) {
      logger.error('Error starting game:', err);
      this.isGameRunning = false;
      clearInterval(this.gameInterval);
      await this.prepareNextRound();
    }
  }

  _updateGameStateForRound(crashPoint) {
    this.gameState.crashPoint = crashPoint;
    this.gameState.status = 'running';
    this.gameState.phase = 'RUNNING';
    this.gameState.multiplier = 1.00;
    this.gameState.startTime = Date.now();
    
    logger.info(`Game running with crash point: ${crashPoint}`);
    broadcastService.broadcastGameState(this.gameState);
  }

  updateGameLoop() {
    const SPEED_MULTIPLIER = parseFloat(process.env.GAME_SPEED_MULTIPLIER || '1');
    const TARGET_FPS = 20 * SPEED_MULTIPLIER;
    const FRAME_MS = 1000 / TARGET_FPS;
    
    let lastUpdate = Date.now();
    let frameCount = 0;

    this.gameInterval = setInterval(() => {
      try {
        if (this.gameState.status !== 'running') {
          clearInterval(this.gameInterval);
          return;
        }

        const now = Date.now();
        const elapsed = (now - lastUpdate) / 1000;
        lastUpdate = now;

        this.gameState.multiplier = parseFloat(
          (this.gameState.multiplier * (1 + 0.005 * elapsed * 60)).toFixed(2)
        );

        if (frameCount % 2 === 0) {
          broadcastService.broadcastGameState(this.gameState);
        }

        if (this.gameState.multiplier >= this.gameState.crashPoint) {
          this.endGameRound();
        }

        frameCount++;
      } catch (err) {
        logger.error('Game loop error:', err);
      }
    }, FRAME_MS);
  }

  async endGameRound() {
    clearInterval(this.gameInterval);
    
    try {
      this.gameState.status = 'crashed';
      this.gameState.phase = 'COMPLETED';
      this.gameState.multiplier = this.gameState.crashPoint;
      broadcastService.broadcastGameState(this.gameState);

      await this._saveGameResults();
      this._updateCrashPoints();
      
      logger.info('Game completed, preparing for next round in 5 seconds');
      this.nextRoundTimeout = setTimeout(this.prepareNextRound, 5000);
    } catch (err) {
      logger.error('Error ending game:', err);
      this.isGameRunning = false;
      this.nextRoundTimeout = setTimeout(this.prepareNextRound, 5000);
    }
  }

  async _saveGameResults() {
    const game = await Game.findOne({ roundId: this.gameState.roundId });
    if (game) {
      game.crashPoint = this.gameState.crashPoint;
      game.revealed = true;
      await game.save();
      logger.info(`Game results saved for round ${this.gameState.roundId}`);
    }
  }

  _updateCrashPoints() {
    this.gameState.lastCrashPoints.unshift(this.gameState.crashPoint);
    if (this.gameState.lastCrashPoints.length > 10) {
      this.gameState.lastCrashPoints.pop();
    }
  }

  async prepareNextRound() {
    try {
      logger.info('Preparing next round...');
      
      this._rotateSeedChain();
      await this._createNewGameRecord();
      this._resetGameState();
      
      broadcastService.broadcastGameState(this.gameState);
      this._startCountdown();
    } catch (err) {
      logger.error('Error preparing next round:', err);
      this.isGameRunning = false;
      this.nextRoundTimeout = setTimeout(this.prepareNextRound, 5000);
    }
  }

  _rotateSeedChain() {
    this.currentServerSeed = this.nextServerSeed;
    this.nextServerSeed = genSeed();
    this.gameState.roundId = Date.now().toString();
  }

  async _createNewGameRecord() {
    const newGame = new Game({
      roundId: this.gameState.roundId,
      serverSeedHash: hash(this.currentServerSeed),
      serverSeed: this.currentServerSeed,
      rtp: 0.97,
      revealed: false
    });
    
    await newGame.save();
  }

  _resetGameState() {
    this.gameState.status = 'waiting';
    this.gameState.phase = 'BETTING';
    this.gameState.serverSeedHash = hash(this.currentServerSeed);
    this.gameState.nextServerSeedHash = hash(this.nextServerSeed);
    this.gameState.multiplier = 1.00;
    this.gameState.players.clear();
    this.gameState.crashPoint = null;
    this.gameState.nextGameCountdown = 10;
    
    this.isGameRunning = false;
  }

  _startCountdown() {
    const countdownInterval = setInterval(() => {
      this.gameState.nextGameCountdown -= 1;
      broadcastService.broadcastGameState(this.gameState);
      
      if (this.gameState.nextGameCountdown <= 0) {
        clearInterval(countdownInterval);
        this.startGameRound().catch(err => {
          logger.error('Error starting game round:', err);
          this.isGameRunning = false;
        });
      }
    }, 1000);
  }

    async verifyGame(game) {
        try {
            const { genCrash, hash } = require('../utils/cryptoUtils');
            
            const calculatedHash = hash(game.serverSeed);
            const calculatedCrashPoint = genCrash(game.serverSeed, game.roundId, game.rtp);

            return {
            roundId: game.roundId,
            serverSeed: game.serverSeed,
            serverSeedHash: game.serverSeedHash,
            hashVerified: calculatedHash === game.serverSeedHash,
            storedCrashPoint: game.crashPoint,
            calculatedCrashPoint,
            crashPointVerified: Math.abs(calculatedCrashPoint - game.crashPoint) < 0.001,
            rtp: game.rtp,
            timestamp: game.timestamp
            };
        } catch (error) {
            logger.error('Error verifying game:', error);
            return null;
        }
    }

    isGameRunning() {
        return this.gameState.status === 'running';
    }

    async setRTP(rtp) {
        try {
            const game = await Game.findOne({ roundId: this.gameState.roundId });
            if (!game) {
            return { success: false, message: 'No active game found' };
            }

            game.rtp = rtp;
            await game.save();

            return { success: true, rtp };
        } catch (error) {
            logger.error('Error setting RTP:', error);
            return { success: false, message: 'Failed to update RTP' };
        }
    }
}


module.exports = new GameService();