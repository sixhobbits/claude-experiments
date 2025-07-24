const fs = require('fs').promises;
const path = require('path');

class DataStore {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.metricsFile = path.join(this.dataDir, 'metrics.json');
    this.configFile = path.join(this.dataDir, 'config.json');
    this.maxDataPoints = 720; // 1 hour of 5-second intervals
    this.init();
  }
  
  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      try {
        await fs.access(this.configFile);
      } catch {
        await this.saveConfig(this.getDefaultConfig());
      }
    } catch (error) {
      console.error('Failed to initialize data store:', error);
    }
  }
  
  getDefaultConfig() {
    return {
      thresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 80, critical: 95 },
        disk: { warning: 80, critical: 90 }
      },
      alerting: {
        enabled: true,
        cooldown: 300 // 5 minutes
      }
    };
  }
  
  async saveMetrics(metrics) {
    try {
      let data = [];
      
      try {
        const existing = await fs.readFile(this.metricsFile, 'utf8');
        data = JSON.parse(existing);
      } catch {
        // File doesn't exist yet
      }
      
      data.push(metrics);
      
      if (data.length > this.maxDataPoints) {
        data = data.slice(-this.maxDataPoints);
      }
      
      await fs.writeFile(this.metricsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }
  
  async getHistory(hours = 24) {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      const metrics = JSON.parse(data);
      
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hours);
      
      return metrics.filter(m => new Date(m.timestamp) > cutoff);
    } catch {
      return [];
    }
  }
  
  async getConfig() {
    try {
      const data = await fs.readFile(this.configFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return this.getDefaultConfig();
    }
  }
  
  async saveConfig(config) {
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
  }
}

module.exports = DataStore;