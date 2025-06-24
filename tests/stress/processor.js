// tests/stress/processor.js
function generateUsername(context, events, done) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  context.vars.username = `test_${timestamp}_${random}`;
  return done();
}

function generateBet(context, events, done) {
  context.vars.betAmount = Math.floor(Math.random() * 90) + 10;
  context.vars.autoCashout = (Math.random() * 3.5 + 1.5).toFixed(2);
  return done();
}

module.exports = {
  generateUsername,
  generateBet
};