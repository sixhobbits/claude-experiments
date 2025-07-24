const fs = require('fs').promises;
const path = require('path');

class DataStore {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.metricsFile = path.join(this.dataDir, 'metrics.json');
    this.configFile = path.join(this.dataDir, 'config.json');
    this.archiveDir = path.join(this.dataDir, 'archive');
    this.maxDataPoints = 720; // 1 hour of 5-second intervals
    this.retentionHours = 24; // Default 24 hours retention
    this.archiveEnabled = true;
    this.init();
    this.startCleanupSchedule();
  }
  
  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.archiveDir, { recursive: true });
      
      try {
        await fs.access(this.configFile);
      } catch {
        await this.saveConfig(this.getDefaultConfig());
      }
      
      // Load retention settings from config
      const config = await this.getConfig();
      if (config.retention) {
        this.retentionHours = config.retention.hours || 24;
        this.archiveEnabled = config.retention.archiveEnabled !== false;
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
      },
      retention: {
        hours: 24, // Keep metrics for 24 hours
        archiveEnabled: true, // Archive old data before deletion
        cleanupInterval: 3600000 // Run cleanup every hour
      },
      email: {
        enabled: false,
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          user: '',
          pass: ''
        },
        from: 'micromonitor@example.com',
        to: 'admin@example.com'
      },
      webhooks: []
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
    
    // Update retention settings if changed
    if (config.retention) {
      this.retentionHours = config.retention.hours || 24;
      this.archiveEnabled = config.retention.archiveEnabled !== false;
    }
  }
  
  startCleanupSchedule() {
    // Run cleanup every hour
    setInterval(() => {
      this.performCleanup();
    }, 3600000); // 1 hour
    
    // Run initial cleanup after 1 minute
    setTimeout(() => {
      this.performCleanup();
    }, 60000);
  }
  
  async performCleanup() {
    try {
      console.log(`[${new Date().toISOString()}] Starting data cleanup...`);
      
      const data = await fs.readFile(this.metricsFile, 'utf8');
      const metrics = JSON.parse(data);
      
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - this.retentionHours);
      
      const oldData = metrics.filter(m => new Date(m.timestamp) <= cutoff);
      const currentData = metrics.filter(m => new Date(m.timestamp) > cutoff);
      
      if (oldData.length > 0) {
        if (this.archiveEnabled) {
          await this.archiveOldData(oldData);
        }
        
        // Save only current data
        await fs.writeFile(this.metricsFile, JSON.stringify(currentData, null, 2));
        
        console.log(`[${new Date().toISOString()}] Cleanup complete: Removed ${oldData.length} old records, kept ${currentData.length} records`);
      } else {
        console.log(`[${new Date().toISOString()}] Cleanup complete: No old data to remove`);
      }
    } catch (error) {
      console.error('Failed to perform cleanup:', error);
    }
  }
  
  async archiveOldData(data) {
    try {
      const date = new Date();
      const filename = `metrics_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}.json`;
      const archivePath = path.join(this.archiveDir, filename);
      
      await fs.writeFile(archivePath, JSON.stringify(data, null, 2));
      console.log(`[${new Date().toISOString()}] Archived ${data.length} records to ${filename}`);
      
      // Clean up old archive files (older than 7 days)
      await this.cleanOldArchives();
    } catch (error) {
      console.error('Failed to archive data:', error);
    }
  }
  
  async cleanOldArchives() {
    try {
      const files = await fs.readdir(this.archiveDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      for (const file of files) {
        const filePath = path.join(this.archiveDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < sevenDaysAgo) {
          await fs.unlink(filePath);
          console.log(`[${new Date().toISOString()}] Deleted old archive: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to clean old archives:', error);
    }
  }
  
  async getRetentionStats() {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      const metrics = JSON.parse(data);
      
      if (metrics.length === 0) {
        return { totalRecords: 0, oldestRecord: null, newestRecord: null };
      }
      
      return {
        totalRecords: metrics.length,
        oldestRecord: metrics[0].timestamp,
        newestRecord: metrics[metrics.length - 1].timestamp,
        retentionHours: this.retentionHours,
        archiveEnabled: this.archiveEnabled
      };
    } catch {
      return { totalRecords: 0, oldestRecord: null, newestRecord: null };
    }
  }
}

module.exports = DataStore;