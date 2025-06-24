const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['bet', 'cashout', 'deposit'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  multiplier: { 
    type: Number 
  },
  gameId: { 
    type: String 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);