// src/utils/cryptoUtils.js
const crypto = require('crypto');

class CryptoUtils {
  /**
   * Generate a random server seed
   * @returns {string} - Random 32-byte hex string
   */
  genSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a server seed
   * @param {string} seed - Server seed to hash
   * @returns {string} - SHA256 hash of the seed
   */
  hash(seed) {
    return crypto
      .createHash('sha256')
      .update(seed)
      .digest('hex');
  }

  /**
   * Generate a crash point using HmacSHA256
   * @param {string} serverSeed - Server seed
   * @param {string} roundId - Round ID
   * @param {number} rtp - Return to player percentage (0.97 = 97%)
   * @returns {number} - Crash point multiplier
   */
  genCrash(serverSeed, roundId, rtp = 0.97) {
    try {
      // Generate game hash using HMAC-SHA256
      const hmac = crypto.createHmac('sha256', serverSeed);
      hmac.update(roundId);
      const hash = hmac.digest('hex');

      // Convert first 8 characters of hash to a number between 0 and 1
      const n = parseInt(hash.slice(0, 8), 16);
      const x = n / Math.pow(2, 32);

      // Calculate crash point using the house edge formula
      // We use 0.99 as the base multiplier to ensure minimum house edge
      const houseEdge = 1 - rtp;
      const baseMultiplier = 0.99;
      const crashPoint = Math.max(
        baseMultiplier,
        Math.floor(
          (1 / (1 - x + houseEdge)) * 100
        ) / 100
      );

      return crashPoint;
    } catch (err) {
      console.error('Error generating crash point:', err);
      return 1.00; // Safe fallback
    }
  }

  /**
   * Verify a game result
   * @param {string} serverSeed - Server seed
   * @param {string} roundId - Round ID
   * @param {number} crashPoint - Recorded crash point
   * @param {number} rtp - Return to player percentage
   * @returns {boolean} - Whether the game result is valid
   */
  verifyGame(serverSeed, roundId, crashPoint, rtp) {
    try {
      const calculatedCrashPoint = this.genCrash(serverSeed, roundId, rtp);
      // Allow for small floating point differences
      return Math.abs(calculatedCrashPoint - crashPoint) < 0.001;
    } catch (err) {
      console.error('Error verifying game:', err);
      return false;
    }
  }

  /**
   * Generate a proof of fairness
   * @param {string} serverSeed - Server seed
   * @param {string} roundId - Round ID
   * @param {number} crashPoint - Crash point
   * @param {number} rtp - Return to player percentage
   * @returns {Object} - Fairness proof
   */
  generateProof(serverSeed, roundId, crashPoint, rtp) {
    return {
      serverSeed,
      serverSeedHash: this.hash(serverSeed),
      roundId,
      crashPoint,
      rtp,
      verificationScript: `
        // JavaScript verification code
        function verifyGame(serverSeed, roundId, crashPoint, rtp) {
          const crypto = require('crypto');
          const hmac = crypto.createHmac('sha256', serverSeed);
          hmac.update(roundId);
          const hash = hmac.digest('hex');
          
          const n = parseInt(hash.slice(0, 8), 16);
          const x = n / Math.pow(2, 32);
          
          const houseEdge = 1 - rtp;
          const baseMultiplier = 0.99;
          const calculatedCrashPoint = Math.max(
            baseMultiplier,
            Math.floor((1 / (1 - x + houseEdge)) * 100) / 100
          );
          
          return Math.abs(calculatedCrashPoint - crashPoint) < 0.001;
        }
      `
    };
  }

  /**
   * Calculate effective RTP based on auto-cashout settings
   * @param {number} targetRtp - Target RTP (e.g., 0.97)
   * @param {number} autoCashoutAt - Auto-cashout multiplier
   * @returns {number} - Effective RTP
   */
  calculateEffectiveRTP(targetRtp, autoCashoutAt) {
    if (!autoCashoutAt || autoCashoutAt <= 1) {
      return targetRtp;
    }

    // Calculate probability of reaching the auto-cashout multiplier
    const probability = 1 / autoCashoutAt;
    
    // Calculate expected value
    const ev = probability * autoCashoutAt;
    
    // Apply house edge
    return ev * targetRtp;
  }

  /**
   * Generate a random nonce
   * @returns {string} - Random 16-byte hex string
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }
}

module.exports = new CryptoUtils();