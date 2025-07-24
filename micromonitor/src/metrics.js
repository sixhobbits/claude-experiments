const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class SystemMetrics {
  async getCPUUsage() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return {
      usage: usage,
      loadAverage: {
        '1m': loadAvg[0],
        '5m': loadAvg[1],
        '15m': loadAvg[2]
      },
      cores: cpus.length
    };
  }
  
  async getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percentage: Math.round((usedMem / totalMem) * 100)
    };
  }
  
  async getDiskUsage() {
    try {
      const { stdout } = await execAsync('df -B1 /');
      const lines = stdout.trim().split('\n');
      const data = lines[1].split(/\s+/);
      
      return {
        total: parseInt(data[1]),
        used: parseInt(data[2]),
        available: parseInt(data[3]),
        percentage: parseInt(data[4])
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        available: 0,
        percentage: 0,
        error: error.message
      };
    }
  }
  
  async getNetworkStats() {
    try {
      const netStats = {};
      const interfaces = os.networkInterfaces();
      
      for (const [name, nets] of Object.entries(interfaces)) {
        if (name === 'lo') continue;
        
        const rxPath = `/sys/class/net/${name}/statistics/rx_bytes`;
        const txPath = `/sys/class/net/${name}/statistics/tx_bytes`;
        
        try {
          const rxBytes = await fs.readFile(rxPath, 'utf8');
          const txBytes = await fs.readFile(txPath, 'utf8');
          
          netStats[name] = {
            rx: parseInt(rxBytes.trim()),
            tx: parseInt(txBytes.trim())
          };
        } catch (err) {
          netStats[name] = { rx: 0, tx: 0 };
        }
      }
      
      return netStats;
    } catch (error) {
      return { error: error.message };
    }
  }
  
  getUptime() {
    return {
      seconds: os.uptime(),
      formatted: this.formatUptime(os.uptime())
    };
  }
  
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }
  
  async getAllMetrics() {
    const [cpu, memory, disk, network, uptime] = await Promise.all([
      this.getCPUUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.getNetworkStats(),
      Promise.resolve(this.getUptime())
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      cpu,
      memory,
      disk,
      network,
      uptime
    };
  }
}

module.exports = SystemMetrics;