// tests/stress/run.js
const { exec } = require('child_process');
const setup = require('./setup');

async function runTests() {
  try {
    // Ensure directories exist
    setup();

    console.log('Running quick test...');
    await runCommand('npm run test:stress:quick');

    console.log('\nGenerating report...');
    await runCommand('npm run test:stress:report');
  } catch (error) {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  }
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = runTests;