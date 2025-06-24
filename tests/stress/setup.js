// tests/stress/setup.js
const fs = require('fs');
const path = require('path');

function ensureDirectoriesExist() {
  const reportsDir = path.join(__dirname, '..', '..', 'reports');
  const logsDir = path.join(__dirname, '..', '..', 'logs');

  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log('Created reports directory');
  }

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('Created logs directory');
  }
}

// Run if called directly
if (require.main === module) {
  ensureDirectoriesExist();
}

module.exports = ensureDirectoriesExist;