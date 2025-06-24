// tests/stress/run-tests.js
const { exec } = require('child_process');
const path = require('path');
const reportGenerator = require('./report-generator');

async function runTests() {
  const tests = [
    {
      name: 'Quick Health Check',
      command: 'npm run test:stress:quick',
      endpoint: '/health/liveness'
    },
    {
      name: 'API Load Test',
      command: 'npm run test:stress',
      endpoints: ['/api/game/history', '/api/user/:id', '/api/transactions/:userId']
    },
    {
      name: 'WebSocket Test',
      command: 'npm run test:stress:ws'
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\nRunning ${test.name}...`);
    try {
      const output = await runCommand(test.command);
      const result = parseTestOutput(output, test);
      results.push(result);
      console.log(`✓ ${test.name} completed`);
    } catch (error) {
      console.error(`✗ ${test.name} failed:`, error.message);
      results.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }
  }

  // Generate report
  await reportGenerator.generateReport(results);
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function parseTestOutput(output, test) {
  const result = {
    name: test.name,
    success: true,
    endpoint: test.endpoint,
    metrics: {
      requestsTotal: 0,
      success: 0,
      errors: 0,
      latencyMean: 0,
      latencyP95: 0,
      rps: 0
    },
    errors: []
  };

  const lines = output.split('\n');
  
  for (const line of lines) {
    // Parse metrics
    if (line.includes('http.requests:')) {
      result.metrics.requestsTotal = parseInt(line.split(':')[1].trim());
    }
    if (line.includes('vusers.completed:')) {
      result.metrics.success = parseInt(line.split(':')[1].trim());
    }
    if (line.includes('vusers.failed:')) {
      result.metrics.errors = parseInt(line.split(':')[1].trim());
    }
    if (line.includes('http.response_time.mean:')) {
      result.metrics.latencyMean = parseFloat(line.split(':')[1].trim());
    }
    if (line.includes('http.response_time.p95:')) {
      result.metrics.latencyP95 = parseFloat(line.split(':')[1].trim());
    }
    if (line.includes('http.request_rate:')) {
      result.metrics.rps = parseFloat(line.split(':')[1].trim());
    }
    
    // Parse errors
    if (line.includes('Error:')) {
      result.errors.push({
        message: line.split('Error:')[1].trim()
      });
    }
  }

  return result;
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };