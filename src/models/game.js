const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  roundId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  serverSeedHash: { 
    type: String, 
    required: true 
  },
  serverSeed: { 
    type: String 
  },
  crashPoint: { 
    type: Number 
  },
  rtp: { 
    type: Number, 
    default: 0.97 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  revealed: { 
    type: Boolean, 
    default: false 
  }
});

module.exports = mongoose.model('Game', GameSchema);