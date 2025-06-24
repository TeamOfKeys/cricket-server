// src/models/index.js
const User = require('./user');
const Game = require('./game');
const Bet = require('./bet');
const Transaction = require('./transaction');

module.exports = {
  User,
  Game,
  Bet,
  Transaction
};