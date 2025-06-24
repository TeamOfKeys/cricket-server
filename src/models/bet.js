const mongoose = require('mongoose');

const BetSchema = new mongoose.Schema({
  roundId: { 
    type: String, 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  cashoutMultiplier: { 
    type: Number, 
    default: null 
  },
  hasCashedOut: { 
    type: Boolean, 
    default: false 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Bet', BetSchema);