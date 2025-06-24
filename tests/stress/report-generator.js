// tests/stress/report-generator.js
const fs = require('fs').promises;
const path = require('path');
const Table = require('cli-table3');

class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports');
  }

  async generateReport(testResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        requestsPerSecond: 0
      },
      endpoints: {},
      errors: []
    };

    // Process test results
    testResults.forEach(result => {
      report.summary.totalRequests += result.metrics.requestsTotal || 0;
      report.summary.successfulRequests += result.metrics.success || 0;
      report.summary.failedRequests += result.metrics.errors || 0;

      if (result.metrics.latencyMean) {
        report.summary.avgResponseTime = (report.summary.avgResponseTime + result.metrics.latencyMean) / 2;
      }

      if (result.metrics.latencyP95) {
        report.summary.p95ResponseTime = Math.max(report.summary.p95ResponseTime, result.metrics.latencyP95);
      }

      if (result.metrics.rps) {
        report.summary.requestsPerSecond += result.metrics.rps;
      }

      // Track endpoint specific metrics
      if (result.endpoint) {
        report.endpoints[result.endpoint] = {
          requests: result.metrics.requestsTotal,
          successRate: (result.metrics.success / result.metrics.requestsTotal * 100).toFixed(2) + '%',
          avgLatency: result.metrics.latencyMean,
          p95Latency: result.metrics.latencyP95
        };
      }

      // Track errors
      if (result.errors && result.errors.length > 0) {
        report.errors.push(...result.errors);
      }
    });

    // Generate report file
    const reportFile = path.join(this.reportsDir, `stress-test-report-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    // Print summary to console
    this.printSummary(report);

    return reportFile;
  }

  printSummary(report) {
    console.log('\n=== Stress Test Report ===\n');

    // Summary Table
    const summaryTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 20]
    });

    summaryTable.push(
      ['Total Requests', report.summary.totalRequests],
      ['Successful Requests', report.summary.successfulRequests],
      ['Failed Requests', report.summary.failedRequests],
      ['Avg Response Time (ms)', report.summary.avgResponseTime.toFixed(2)],
      ['P95 Response Time (ms)', report.summary.p95ResponseTime.toFixed(2)],
      ['Requests/Second', report.summary.requestsPerSecond.toFixed(2)]
    );

    console.log(summaryTable.toString());

    // Endpoints Table
    if (Object.keys(report.endpoints).length > 0) {
      console.log('\nEndpoint Performance:\n');

      const endpointTable = new Table({
        head: ['Endpoint', 'Requests', 'Success Rate', 'Avg Latency', 'P95 Latency'],
        colWidths: [30, 15, 15, 15, 15]
      });

      Object.entries(report.endpoints).forEach(([endpoint, metrics]) => {
        endpointTable.push([
          endpoint,
          metrics.requests,
          metrics.successRate,
          `${metrics.avgLatency.toFixed(2)}ms`,
          `${metrics.p95Latency.toFixed(2)}ms`
        ]);
      });

      console.log(endpointTable.toString());
    }

    // Errors Summary
    if (report.errors.length > 0) {
      console.log('\nErrors:\n');
      const errorTable = new Table({
        head: ['Error', 'Count'],
        colWidths: [40, 10]
      });

      const errorCounts = report.errors.reduce((acc, error) => {
        acc[error.message] = (acc[error.message] || 0) + 1;
        return acc;
      }, {});

      Object.entries(errorCounts).forEach(([error, count]) => {
        errorTable.push([error, count]);
      });

      console.log(errorTable.toString());
    }
  }
}

module.exports = new ReportGenerator();