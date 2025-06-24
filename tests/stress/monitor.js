// tests/stress/monitor.js
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

class SystemMonitor {
  constructor() {
    this.metrics = {
      cpu: [],
      memory: [],
      network: [],
      eventLoop: [],
      process: []
    };

    this.startTime = Date.now();
    this.logFile = `stress_test_${this.startTime}.log`;
  }

  start() {
    // Monitor every second
    this.interval = setInterval(() => {
      this.collectMetrics();
      this.logMetrics();
    }, 1000);

    // Save detailed metrics every minute
    this.detailedInterval = setInterval(() => {
      this.saveDetailedMetrics();
    }, 60000);
  }

  stop() {
    clearInterval(this.interval);
    clearInterval(this.detailedInterval);
    this.saveReport();
  }

  collectMetrics() {
    // CPU Usage
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();
    
    // Memory Usage
    const memory = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    // Event Loop Lag
    const start = Date.now();
    setTimeout(() => {
      const lag = Date.now() - start;
      this.metrics.eventLoop.push({
        timestamp: Date.now(),
        lag
      });
    }, 0);

    // Process Metrics
    const processMetrics = {
      uptime: process.uptime(),
      pid: process.pid,
      heap: memory.heapUsed,
      external: memory.external,
      workers: this.getWorkerCount()
    };

    // Save metrics
    this.metrics.cpu.push({
      timestamp: Date.now(),
      system: cpus.map(cpu => this.calculateCPUUsage(cpu)),
      process: this.calculateProcessCPUUsage(cpuUsage)
    });

    this.metrics.memory.push({
      timestamp: Date.now(),
      system: systemMemory,
      process: memory
    });

    this.metrics.process.push({
      timestamp: Date.now(),
      ...processMetrics
    });
  }

  calculateCPUUsage(cpu) {
    const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
    const idle = cpu.times.idle;
    return ((total - idle) / total) * 100;
  }

  calculateProcessCPUUsage(cpuUsage) {
    return (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  }

  getWorkerCount() {
    try {
      const ps = execSync('ps aux | grep node | grep -v grep | wc -l');
      return parseInt(ps.toString());
    } catch (error) {
      return -1;
    }
  }

  logMetrics() {
    const current = {
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1],
      memory: this.metrics.memory[this.metrics.memory.length - 1],
      process: this.metrics.process[this.metrics.process.length - 1]
    };

    console.clear();
    console.log('=== System Monitoring ===');
    console.log('CPU Usage:');
    console.log(`  System: ${current.cpu.system.reduce((a, b) => a + b, 0) / current.cpu.system.length}%`);
    console.log(`  Process: ${current.cpu.process.toFixed(2)}%`);
    console.log('\nMemory Usage:');
    console.log(`  System: ${(current.memory.system.used / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Process: ${(current.memory.process.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log('\nProcess Info:');
    console.log(`  Workers: ${current.process.workers}`);
    console.log(`  Uptime: ${current.process.uptime.toFixed(2)}s`);

    if (this.metrics.eventLoop.length > 0) {
      const recentLag = this.metrics.eventLoop[this.metrics.eventLoop.length - 1].lag;
      console.log(`\nEvent Loop Lag: ${recentLag}ms`);
    }
  }

  saveDetailedMetrics() {
    const metrics = {
      timestamp: Date.now(),
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1],
      memory: this.metrics.memory[this.metrics.memory.length - 1],
      eventLoop: this.metrics.eventLoop[this.metrics.eventLoop.length - 1],
      process: this.metrics.process[this.metrics.process.length - 1]
    };

    fs.appendFileSync(this.logFile, JSON.stringify(metrics) + '\n');
  }

  saveReport() {
    const report = {
      duration: Date.now() - this.startTime,
      averages: {
        cpu: {
          system: this.calculateAverage(this.metrics.cpu.map(m => 
            m.system.reduce((a, b) => a + b, 0) / m.system.length
          )),
          process: this.calculateAverage(this.metrics.cpu.map(m => m.process))
        },
        memory: {
          system: this.calculateAverage(this.metrics.memory.map(m => m.system.used)),
          process: this.calculateAverage(this.metrics.memory.map(m => m.process.heapUsed))
        },
        eventLoop: {
          lag: this.calculateAverage(this.metrics.eventLoop.map(m => m.lag))
        }
      },
      peaks: {
        cpu: {
          system: Math.max(...this.metrics.cpu.map(m => 
            Math.max(...m.system)
          )),
          process: Math.max(...this.metrics.cpu.map(m => m.process))
        },
        memory: {
          system: Math.max(...this.metrics.memory.map(m => m.system.used)),
          process: Math.max(...this.metrics.memory.map(m => m.process.heapUsed))
        },
        eventLoop: {
          lag: Math.max(...this.metrics.eventLoop.map(m => m.lag))
        }
      }
    };

    fs.writeFileSync(`stress_test_report_${this.startTime}.json`, JSON.stringify(report, null, 2));
  }

  calculateAverage(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

module.exports = new SystemMonitor();