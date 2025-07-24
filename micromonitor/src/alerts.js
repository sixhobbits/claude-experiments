const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class AlertManager {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.transporter = null;
    this.alertHistory = new Map();
    this.alertFile = path.join(__dirname, '../data/alerts.json');
  }

  async initialize() {
    try {
      const config = await this.dataStore.getConfig();
      if (config.email && config.email.enabled) {
        this.setupTransporter(config.email);
      }
      
      // Load alert history
      await this.loadAlertHistory();
    } catch (error) {
      console.error('Failed to initialize alert manager:', error);
    }
  }

  setupTransporter(emailConfig) {
    try {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure || false,
        auth: {
          user: emailConfig.smtp.user,
          pass: emailConfig.smtp.pass
        }
      });
      
      console.log('Email transporter configured successfully');
    } catch (error) {
      console.error('Failed to setup email transporter:', error);
      this.transporter = null;
    }
  }

  async loadAlertHistory() {
    try {
      const data = await fs.readFile(this.alertFile, 'utf8');
      const history = JSON.parse(data);
      this.alertHistory = new Map(Object.entries(history));
    } catch {
      // File doesn't exist yet, start with empty history
      this.alertHistory = new Map();
    }
  }

  async saveAlertHistory() {
    try {
      const history = Object.fromEntries(this.alertHistory);
      await fs.writeFile(this.alertFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save alert history:', error);
    }
  }

  async checkThresholds(metrics) {
    const config = await this.dataStore.getConfig();
    
    if (!config.alerting || !config.alerting.enabled) {
      return;
    }

    const alerts = [];
    const now = Date.now();
    const cooldownMs = (config.alerting.cooldown || 300) * 1000;

    // Check CPU thresholds
    const cpuUsage = metrics.cpu.usage;
    if (cpuUsage > config.thresholds.cpu.critical) {
      alerts.push({
        type: 'cpu',
        level: 'critical',
        value: cpuUsage,
        threshold: config.thresholds.cpu.critical,
        message: `CPU usage is critically high: ${cpuUsage.toFixed(1)}%`
      });
    } else if (cpuUsage > config.thresholds.cpu.warning) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        value: cpuUsage,
        threshold: config.thresholds.cpu.warning,
        message: `CPU usage is high: ${cpuUsage.toFixed(1)}%`
      });
    }

    // Check Memory thresholds
    const memoryUsage = metrics.memory.percentage || metrics.memory.usagePercent;
    if (memoryUsage > config.thresholds.memory.critical) {
      alerts.push({
        type: 'memory',
        level: 'critical',
        value: memoryUsage,
        threshold: config.thresholds.memory.critical,
        message: `Memory usage is critically high: ${memoryUsage.toFixed(1)}%`
      });
    } else if (memoryUsage > config.thresholds.memory.warning) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        value: memoryUsage,
        threshold: config.thresholds.memory.warning,
        message: `Memory usage is high: ${memoryUsage.toFixed(1)}%`
      });
    }

    // Check Disk thresholds
    const diskUsage = metrics.disk.percentage || metrics.disk.usagePercent;
    if (diskUsage > config.thresholds.disk.critical) {
      alerts.push({
        type: 'disk',
        level: 'critical',
        value: diskUsage,
        threshold: config.thresholds.disk.critical,
        message: `Disk usage is critically high: ${diskUsage.toFixed(1)}%`
      });
    } else if (diskUsage > config.thresholds.disk.warning) {
      alerts.push({
        type: 'disk',
        level: 'warning',
        value: diskUsage,
        threshold: config.thresholds.disk.warning,
        message: `Disk usage is high: ${diskUsage.toFixed(1)}%`
      });
    }

    // Process alerts with cooldown logic
    for (const alert of alerts) {
      const alertKey = `${alert.type}-${alert.level}`;
      const lastAlert = this.alertHistory.get(alertKey);
      
      if (!lastAlert || (now - lastAlert) > cooldownMs) {
        await this.sendAlert(alert, metrics);
        this.alertHistory.set(alertKey, now);
      }
    }

    // Save alert history
    await this.saveAlertHistory();
  }

  async sendAlert(alert, metrics) {
    const config = await this.dataStore.getConfig();
    
    // Log the alert
    console.log(`[ALERT] ${alert.level.toUpperCase()}: ${alert.message}`);
    
    // Send email if configured
    if (config.email && config.email.enabled && this.transporter) {
      try {
        const hostname = require('os').hostname();
        const timestamp = new Date().toISOString();
        
        const mailOptions = {
          from: config.email.from,
          to: config.email.to,
          subject: `[MicroMonitor] ${alert.level.toUpperCase()} Alert: ${alert.type}`,
          html: `
            <h2>MicroMonitor Alert</h2>
            <p><strong>Level:</strong> ${alert.level.toUpperCase()}</p>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Current Value:</strong> ${alert.value.toFixed(1)}%</p>
            <p><strong>Threshold:</strong> ${alert.threshold}%</p>
            <hr>
            <h3>Current System Metrics:</h3>
            <ul>
              <li>CPU Usage: ${metrics.cpu.usage.toFixed(1)}%</li>
              <li>Memory Usage: ${(metrics.memory.percentage || metrics.memory.usagePercent).toFixed(1)}%</li>
              <li>Disk Usage: ${(metrics.disk.percentage || metrics.disk.usagePercent).toFixed(1)}%</li>
              <li>Uptime: ${Math.floor(metrics.uptime / 3600)} hours</li>
            </ul>
            <hr>
            <p><small>Host: ${hostname} | Time: ${timestamp}</small></p>
          `
        };
        
        await this.transporter.sendMail(mailOptions);
        console.log(`Email alert sent for ${alert.type} ${alert.level}`);
      } catch (error) {
        console.error('Failed to send email alert:', error);
      }
    }
  }

  async getAlertHistory() {
    const history = [];
    for (const [key, timestamp] of this.alertHistory.entries()) {
      const [type, level] = key.split('-');
      history.push({
        type,
        level,
        lastAlert: new Date(timestamp).toISOString()
      });
    }
    return history;
  }

  async updateConfig(newConfig) {
    if (newConfig.email && newConfig.email.enabled) {
      this.setupTransporter(newConfig.email);
    } else {
      this.transporter = null;
    }
  }
}

module.exports = AlertManager;