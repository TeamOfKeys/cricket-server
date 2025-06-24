// tests/stress/generate-report.js
const fs = require('fs');
const path = require('path');

function generateReport() {
  const reportsDir = path.join(__dirname, '..', '..', 'reports');
  const results = [];

  // Read all JSON files in reports directory
  fs.readdirSync(reportsDir)
    .filter(file => file.endsWith('.json'))
    .forEach(file => {
      try {
        const content = fs.readFileSync(path.join(reportsDir, file), 'utf8');
        const data = JSON.parse(content);
        results.push({ file, data });
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    });

  // Generate summary
  console.log('\n=== Stress Test Results ===\n');
  
  results.forEach(({ file, data }) => {
    console.log(`\nResults from ${file}:`);
    
    if (data.aggregate) {
      const stats = data.aggregate;
      
      console.log('Request Statistics:');
      console.log(`- Total Requests: ${stats.counts?.requests || 0}`);
      console.log(`- Response Codes:`, stats.codes || {});
      
      if (stats.latency) {
        console.log('\nLatency (ms):');
        console.log(`- Min: ${stats.latency.min || 0}`);
        console.log(`- Max: ${stats.latency.max || 0}`);
        console.log(`- Median: ${stats.latency.median || 0}`);
        console.log(`- p95: ${stats.latency.p95 || 0}`);
        console.log(`- p99: ${stats.latency.p99 || 0}`);
      }

      if (stats.rps) {
        console.log('\nThroughput:');
        console.log(`- Mean RPS: ${stats.rps.mean || 0}`);
        console.log(`- Count: ${stats.rps.count || 0}`);
      }
    }

    if (data.errors && data.errors.length > 0) {
      console.log('\nErrors:');
      data.errors.forEach(error => {
        console.log(`- ${error.message}`);
      });
    }
    
    console.log('\n---');
  });
}

// Run if called directly
if (require.main === module) {
  generateReport();
}

module.exports = generateReport;