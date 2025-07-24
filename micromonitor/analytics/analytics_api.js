const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AnalyticsAPI {
  constructor() {
    this.analyticsDir = path.join(__dirname);
    this.dataDir = path.join(this.analyticsDir, 'data');
    this.pythonScript = path.join(this.analyticsDir, 'analytics_tracker.py');
  }

  async runAnalytics() {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScript]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Analytics script failed: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async getLatestReport() {
    try {
      const reportPath = path.join(this.dataDir, 'daily_report.md');
      const report = await fs.readFile(reportPath, 'utf8');
      return report;
    } catch (error) {
      throw new Error('No analytics report available');
    }
  }

  async getAnalyticsHistory() {
    try {
      const historyPath = path.join(this.dataDir, 'analytics_history.json');
      const data = await fs.readFile(historyPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  async getAnalyticsForDate(date) {
    const history = await this.getAnalyticsHistory();
    return history[date] || null;
  }

  setupRoutes(app, authMiddleware) {
    // Get latest analytics report
    app.get('/api/analytics/report', authMiddleware(), async (req, res) => {
      try {
        const report = await this.getLatestReport();
        res.type('text/markdown').send(report);
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    });

    // Get analytics history
    app.get('/api/analytics/history', authMiddleware(), async (req, res) => {
      try {
        const history = await this.getAnalyticsHistory();
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get analytics for specific date
    app.get('/api/analytics/date/:date', authMiddleware(), async (req, res) => {
      try {
        const analytics = await this.getAnalyticsForDate(req.params.date);
        if (analytics) {
          res.json(analytics);
        } else {
          res.status(404).json({ error: 'No analytics data for this date' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Run analytics manually (admin only)
    app.post('/api/analytics/run', authMiddleware('admin'), async (req, res) => {
      try {
        const output = await this.runAnalytics();
        const report = await this.getLatestReport();
        res.json({ 
          success: true, 
          message: 'Analytics generated successfully',
          output: output,
          report: report
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get current day summary
    app.get('/api/analytics/summary', authMiddleware(), async (req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const history = await this.getAnalyticsHistory();
        const todayData = history[today];
        
        if (todayData && todayData.length > 0) {
          const latest = todayData[todayData.length - 1];
          res.json({
            date: today,
            visitors: latest.visitors.unique_count,
            apiCalls: latest.api_usage.total_calls,
            loginAttempts: latest.login_attempts.total,
            demoActivity: latest.login_attempts.demo_account
          });
        } else {
          res.json({
            date: today,
            visitors: 0,
            apiCalls: 0,
            loginAttempts: 0,
            demoActivity: 0
          });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}

module.exports = AnalyticsAPI;