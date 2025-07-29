const mongoose = require('mongoose');
const { User, Bet, Transaction } = require('../models');
const cacheService = require('./cacheService');
const broadcastService = require('./broadcastService');


class PlayerService {
    constructor() {
        this.gameState = null;
    }

    setGameState(gameState) {
        this.gameState = gameState;
    }

    // ADD THIS METHOD for handling deposits
    async handleDeposit(userId, amount) {
        try {
            console.log(` Processing deposit for user ${userId}, amount: ${amount}`);
            
            // Validate parameters
            if (!userId || !amount || amount <= 0) {
                return { success: false, message: 'Invalid deposit parameters' };
            }

            // Find the user
            const user = await User.findById(userId);
            if (!user) {
                return { success: false, message: 'User not found' };
            }

            console.log(` User found: ${user.username}, current balance: ${user.balance}`);

            // Calculate new balance
            const currentBalance = user.balance || 0;
            const newBalance = currentBalance + parseFloat(amount);

            // Update user balance
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { balance: newBalance },
                { new: true }
            );

            if (!updatedUser) {
                return { success: false, message: 'Failed to update user balance' };
            }

            // Create transaction record
            await Transaction.create({
                userId: userId,
                type: 'deposit',
                amount: parseFloat(amount),
                gameId: null, // No game associated with deposits
                createdAt: new Date()
            });

            console.log(`Deposit successful: ${user.username} balance updated from ${currentBalance} to ${newBalance}`);

            // Invalidate user cache if available
            if (cacheService.invalidateUserCache) {
                await cacheService.invalidateUserCache(userId);
            }

            return {
                success: true,
                message: `Successfully deposited $${amount}`,
                balance: newBalance,
                user: {
                    id: updatedUser._id,
                    username: updatedUser.username,
                    balance: newBalance
                }
            };

        } catch (error) {
            console.error(' Deposit error:', error);
            return { success: false, message: 'Server error processing deposit' };
        }
    }

    async handlePlaceBet(userId, amount, autoCashoutAt, username) {
        try {
            if (!this._validateBetParams(userId.toString(), amount)) {
                return { success: false, message: 'Invalid bet parameters' };
            }

            if (!this._isValidGameStateForBetting()) {
                return { success: false, message: 'Betting is only allowed during the betting phase' };
            }

            if (this.gameState.players.has(userId.toString())) {
                console.warn(`Duplicate bet attempt for user ${userId}`);
                return { success: false, message: 'You already have a bet in this round' };
            }

            return await this._processBet(userId, amount, autoCashoutAt, username);
        } catch (err) {
            console.error('Error placing bet:', err);
            return { success: false, message: 'Server error processing bet' };
        }
    }

    async handleCashout(userId) {
        try {
            if (!this._validateCashoutParams(userId)) {
                return { success: false, message: 'Invalid cashout parameters' };
             }

            return await this._processCashout(userId);
        } catch (err) {
            console.error('Error processing cashout:', err);
            return { success: false, message: 'Server error processing cashout' };
        }
    }

    async _processBet(userId, amount, autoCashoutAt, username) {
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };


        if (user.balance < amount) return { success: false, message: 'Insufficient balance' };

        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!updatedUser) return { success: false, message: 'Balance update failed' };

        await Promise.all([
            Bet.create({
                roundId: this.gameState.roundId,
                userId: userId,
                amount: amount
            }),
            Transaction.create({
                userId: userId,
                type: 'bet',
                amount: amount,
                gameId: this.gameState.roundId
            })
        ]);

        this.gameState.players.set(userId.toString(), {
            username: username || user.username,
            betAmount: amount,
            autoCashoutAt: autoCashoutAt || null,
            hasCashedOut: false,
            cashoutMultiplier: null,
            _lastActivityTs: Date.now()
        });

        if (cacheService.invalidateUserCache) {
            await cacheService.invalidateUserCache(userId);
        }

        broadcastService.broadcastGameState(this.gameState);

        return {
            success: true,
            message: 'Bet placed successfully',
            roundId: this.gameState.roundId,
            amount: amount,
            balance: updatedUser.balance
        };
    }

    async _processCashout(userId) {
        const player = this.gameState.players.get(userId.toString());
        const cashoutMultiplier = this.gameState.multiplier;
        const winnings = player.betAmount * cashoutMultiplier;

        const updatedUser = await User.findOneAndUpdate(
            { _id: userId },
            { $inc: { balance: winnings } },
            { new: true }
        );

        if (!updatedUser) return { success: false, message: 'User balance update failed' };

        await Promise.all([
            Bet.findOneAndUpdate(
                { roundId: this.gameState.roundId, userId: userId },
                {
                    cashoutMultiplier: cashoutMultiplier,
                    hasCashedOut: true
                }
            ),
            new Transaction({
                userId: userId,
                type: 'cashout',
                amount: winnings,
                multiplier: cashoutMultiplier,
                gameId: this.gameState.roundId
            }).save()
        ]);

        player.hasCashedOut = true;
        player.cashoutMultiplier = cashoutMultiplier;
        player._lastActivityTs = Date.now();
        this.gameState.players.set(userId.toString(), player);


        broadcastService.broadcastGameState(this.gameState);

        return {
            success: true,
            message: 'Cashout successful',
            multiplier: cashoutMultiplier,
            winnings: winnings,
            balance: updatedUser.balance
        };
    }

    _validateBetParams(userId, amount) {
        return userId && amount > 0;
    }

    _validateCashoutParams(userId) {
        console.log('[Cashout] Checking eligibility for', userId);
        console.log('↪ gameState.status:', this.gameState.status);
        console.log('↪ gameState.phase:', this.gameState.phase);
        console.log('↪ players:', Array.from(this.gameState.players.keys()));
        const player = this.gameState.players.get(userId.toString());
        if (!userId?.toString) return false;  
        if (this.gameState.status !== 'running' || this.gameState.phase !== 'RUNNING') return false;
        if (!player) {
            console.log('❌ Player not found in current round');
            return false;
        }
        if (player.hasCashedOut) return false;
        return true;
    }


    _isValidGameStateForBetting() {
        return this.gameState.status === 'waiting' && this.gameState.phase === 'BETTING';
    }
}

module.exports = new PlayerService();