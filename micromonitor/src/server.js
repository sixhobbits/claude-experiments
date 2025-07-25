const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const SystemMetrics = require('./metrics');
const DataStore = require('./dataStore');
const AlertManager = require('./alerts');
const ProcessMonitor = require('./processes');
const WebhookManager = require('../webhooks');
const { authMiddleware, authenticateUser, createUser, initializeDefaultAdmin } = require('./auth');
const { apiKeyMiddleware, createApiKey, listApiKeys, deleteApiKey } = require('./apiKeys');
const AnalyticsAPI = require('../analytics/analytics_api');
const feedbackManager = require('./feedback');
const analytics = require('../analytics');

const app = express();
const port = process.env.PORT || 3000;
const metrics = new SystemMetrics();
const dataStore = new DataStore();
const alertManager = new AlertManager(dataStore);
const processMonitor = new ProcessMonitor();
const webhookManager = new WebhookManager();
const analyticsAPI = new AnalyticsAPI();

app.use(express.json());
app.use(apiKeyMiddleware());

// Serve landing page at root
app.get('/', (req, res) => {
  try {
    analytics.trackPageView(req, 'landing');
  } catch (error) {
    console.error('Analytics error:', error);
  }
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// Serve static files except the root index.html
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// Dashboard route (authentication is handled by the frontend)
app.get('/dashboard', (req, res) => {
  try {
    analytics.trackPageView(req, 'dashboard');
  } catch (error) {
    console.error('Analytics error:', error);
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

let clients = [];

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authenticateUser(username, password);
    // Track demo login conversions
    if (username === 'demo') {
      const campaign = req.query.ref || 'direct';
      analytics.trackConversion('demoLogins', campaign);
    }
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/register', authMiddleware('admin'), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const result = await createUser(username, password, role);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// API Key management endpoints
app.get('/api/keys', authMiddleware('admin'), async (req, res) => {
  try {
    const keys = await listApiKeys();
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/keys', authMiddleware('admin'), async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const result = await createApiKey(name, permissions);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/keys/:keyId', authMiddleware('admin'), async (req, res) => {
  try {
    await deleteApiKey(req.params.keyId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/metrics', authMiddleware(), async (req, res) => {
  try {
    const data = await metrics.getAllMetrics();
    await dataStore.saveMetrics(data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/history', authMiddleware(), async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const history = await dataStore.getHistory(hours);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/export/csv', authMiddleware(), async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const history = await dataStore.getHistory(hours);
    
    // Create CSV headers
    const headers = ['Timestamp', 'CPU %', 'Memory %', 'Disk %', 'Uptime (hours)'];
    const rows = [headers.join(',')];
    
    // Add data rows
    history.forEach(entry => {
      const row = [
        new Date(entry.timestamp).toISOString(),
        entry.cpu.usage.toFixed(2),
        entry.memory.usagePercent.toFixed(2),
        entry.disk.usagePercent.toFixed(2),
        (entry.uptime / 3600).toFixed(2)
      ];
      rows.push(row.join(','));
    });
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=micromonitor-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(rows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/export/pdf', authMiddleware(), async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const history = await dataStore.getHistory(hours);
    const config = await dataStore.getConfig();
    
    // Generate HTML content for PDF
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; font-weight: bold; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metric-value { font-weight: bold; color: #2c5aa0; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>MicroMonitor System Metrics Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <p>Time Range: Last ${hours} hours</p>
      
      <div class="summary">
        <h2>Summary Statistics</h2>
        <p>Total Data Points: <span class="metric-value">${history.length}</span></p>
        <p>Average CPU Usage: <span class="metric-value">${(history.reduce((sum, entry) => sum + entry.cpu.usage, 0) / history.length).toFixed(2)}%</span></p>
        <p>Average Memory Usage: <span class="metric-value">${(history.reduce((sum, entry) => sum + entry.memory.usagePercent, 0) / history.length).toFixed(2)}%</span></p>
        <p>Average Disk Usage: <span class="metric-value">${(history.reduce((sum, entry) => sum + entry.disk.usagePercent, 0) / history.length).toFixed(2)}%</span></p>
      </div>
      
      <h2>Alert Thresholds</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th>Threshold</th>
          <th>Email Alerts</th>
        </tr>
        <tr>
          <td>CPU Usage</td>
          <td>${config.alertThresholds?.cpu || 80}%</td>
          <td>${config.emailConfig?.enabled ? 'Enabled' : 'Disabled'}</td>
        </tr>
        <tr>
          <td>Memory Usage</td>
          <td>${config.alertThresholds?.memory || 85}%</td>
          <td>${config.emailConfig?.enabled ? 'Enabled' : 'Disabled'}</td>
        </tr>
        <tr>
          <td>Disk Usage</td>
          <td>${config.alertThresholds?.disk || 90}%</td>
          <td>${config.emailConfig?.enabled ? 'Enabled' : 'Disabled'}</td>
        </tr>
      </table>
      
      <h2>Detailed Metrics History</h2>
      <table>
        <tr>
          <th>Timestamp</th>
          <th>CPU %</th>
          <th>Memory %</th>
          <th>Disk %</th>
          <th>Uptime (hours)</th>
        </tr>
        ${history.slice(0, 100).map(entry => `
        <tr>
          <td>${new Date(entry.timestamp).toLocaleString()}</td>
          <td>${entry.cpu.usage.toFixed(2)}</td>
          <td>${entry.memory.usagePercent.toFixed(2)}</td>
          <td>${entry.disk.usagePercent.toFixed(2)}</td>
          <td>${(entry.uptime / 3600).toFixed(2)}</td>
        </tr>
        `).join('')}
      </table>
      ${history.length > 100 ? '<p><em>Showing first 100 entries of ' + history.length + ' total</em></p>' : ''}
      
      <div class="footer">
        <p>MicroMonitor - Lightweight Server Monitoring</p>
      </div>
    </body>
    </html>
    `;
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    await browser.close();
    
    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=micromonitor-report-${new Date().toISOString().split('T')[0]}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  
  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

async function broadcastMetrics() {
  const data = await metrics.getAllMetrics();
  await dataStore.saveMetrics(data);
  
  // Check alerts
  await alertManager.checkThresholds(data);
  
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

setInterval(broadcastMetrics, 5000);

app.get('/api/config', authMiddleware(), async (req, res) => {
  try {
    const config = await dataStore.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', authMiddleware('admin'), async (req, res) => {
  try {
    await dataStore.saveConfig(req.body);
    await alertManager.updateConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/retention/stats', authMiddleware(), async (req, res) => {
  try {
    const stats = await dataStore.getRetentionStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alerts/history', authMiddleware(), async (req, res) => {
  try {
    const history = await alertManager.getAlertHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process monitoring endpoints
app.get('/api/processes', authMiddleware(), async (req, res) => {
  try {
    const processStats = await processMonitor.getProcessStats();
    res.json(processStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/processes/:name', authMiddleware(), async (req, res) => {
  try {
    const processInfo = await processMonitor.getSpecificProcess(req.params.name);
    res.json(processInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/processes/check', authMiddleware(), async (req, res) => {
  try {
    const { processes } = req.body;
    const results = await processMonitor.checkCriticalProcesses(processes || []);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoints
app.get('/api/webhooks/history', authMiddleware(), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await webhookManager.getHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/test', authMiddleware('admin'), async (req, res) => {
  try {
    const webhook = req.body;
    const result = await webhookManager.testWebhook(webhook);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Feedback endpoints
app.post('/api/feedback', async (req, res) => {
  try {
    const feedbackData = {
      ...req.body,
      userAgent: req.headers['user-agent']
    };
    const result = await feedbackManager.submitFeedback(feedbackData);
    // Track feedback conversion
    const campaign = req.query.ref || 'direct';
    analytics.trackConversion('feedbackSubmissions', campaign);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/feedback', authMiddleware('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const feedback = await feedbackManager.getFeedback(limit);
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/feedback/stats', authMiddleware('admin'), async (req, res) => {
  try {
    const stats = await feedbackManager.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics summary endpoint
app.get('/api/analytics/summary', authMiddleware('admin'), (req, res) => {
  try {
    const summary = analytics.getAnalyticsSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public status page endpoints
app.get('/status/:statusId', (req, res) => {
  analytics.trackPageView(req, 'public-status');
  res.sendFile(path.join(__dirname, '../public/status.html'));
});

app.get('/api/public/status/:statusId', async (req, res) => {
  try {
    const statusId = req.params.statusId;
    const statusConfig = await dataStore.getStatusPageConfig(statusId);
    
    if (!statusConfig || !statusConfig.isPublic) {
      return res.status(404).json({ error: 'Status page not found' });
    }
    
    // Get current metrics and calculate uptime
    const currentMetrics = await metrics.getAllMetrics();
    const history = await dataStore.getHistory(24); // Last 24 hours
    
    // Calculate uptime percentage (system has been up if we have data)
    const uptimePercentage = history.length > 0 ? (history.length / 288 * 100).toFixed(2) : 100; // 288 = 24h * 12 (5min intervals)
    
    // Determine current status
    const status = currentMetrics.cpu.usage > 90 || currentMetrics.memory.usagePercent > 95 ? 
      'degraded' : 'operational';
    
    const publicData = {
      name: statusConfig.name,
      description: statusConfig.description,
      status: status,
      uptime: uptimePercentage,
      lastUpdated: new Date().toISOString(),
      metrics: {
        cpu: currentMetrics.cpu.usage.toFixed(2),
        memory: currentMetrics.memory.usagePercent.toFixed(2),
        disk: currentMetrics.disk.usagePercent.toFixed(2)
      },
      shareUrl: `https://claude.dwyer.co.za/status/${statusId}`
    };
    
    res.json(publicData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status page management endpoints
app.get('/api/status-pages', authMiddleware(), async (req, res) => {
  try {
    const statusPages = await dataStore.getUserStatusPages(req.user.id);
    res.json(statusPages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/status-pages', authMiddleware(), async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const statusId = await dataStore.createStatusPage({
      name,
      description,
      isPublic,
      userId: req.user.id,
      createdAt: new Date().toISOString()
    });
    
    // Track status page creation
    analytics.trackConversion('statusPageCreated', 'organic');
    
    res.json({ 
      statusId, 
      publicUrl: `https://claude.dwyer.co.za/status/${statusId}` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/status-pages/:statusId', authMiddleware(), async (req, res) => {
  try {
    await dataStore.deleteStatusPage(req.params.statusId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Badge generation endpoint
app.get('/api/badge/:statusId', async (req, res) => {
  try {
    const statusId = req.params.statusId;
    // Track badge views for viral growth analytics
    analytics.trackPageView(req, 'badge-view');
    
    const statusConfig = await dataStore.getStatusPageConfig(statusId);
    
    if (!statusConfig || !statusConfig.isPublic) {
      // Return a default badge for invalid status pages
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(generateBadgeSVG('Service', 'Not Found', '#999'));
    }
    
    // Get current metrics to determine status
    const currentMetrics = await metrics.getAllMetrics();
    const status = currentMetrics.cpu.usage > 90 || currentMetrics.memory.usagePercent > 95 ? 
      'degraded' : 'operational';
    
    const statusText = status === 'operational' ? 'Operational' : 'Degraded';
    const statusColor = status === 'operational' ? '#4CAF50' : '#FF9800';
    
    // Generate SVG badge
    const svg = generateBadgeSVG(statusConfig.name, statusText, statusColor);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(svg);
  } catch (error) {
    console.error('Badge generation error:', error);
    res.status(500).send(generateBadgeSVG('Error', 'Service Error', '#f44336'));
  }
});

function generateBadgeSVG(label, status, color) {
  const labelWidth = label.length * 6 + 10;
  const statusWidth = status.length * 6 + 10;
  const totalWidth = labelWidth + statusWidth;
  
  return `<svg width="${totalWidth}" height="20" xmlns="http://www.w3.org/2000/svg">
    <linearGradient id="gradient">
      <stop offset="0%" stop-color="#555"/>
      <stop offset="100%" stop-color="#555"/>
    </linearGradient>
    <rect width="${labelWidth}" height="20" fill="url(#gradient)"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="${color}"/>
    <text x="${labelWidth/2}" y="14" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif" font-size="11">${label}</text>
    <text x="${labelWidth + statusWidth/2}" y="14" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif" font-size="11">${status}</text>
  </svg>`;
}

// Public monitoring API endpoint for integrations
app.get('/api/v1/status', async (req, res) => {
  try {
    // Track API usage
    analytics.trackPageView(req, 'api-status');
    
    const currentMetrics = await metrics.getAllMetrics();
    const history = await dataStore.getHistory(1); // Last hour
    
    // Calculate basic statistics
    const avgCpu = history.length > 0 ? 
      history.reduce((sum, m) => sum + m.cpu.usage, 0) / history.length : 
      currentMetrics.cpu.usage;
    
    const avgMemory = history.length > 0 ?
      history.reduce((sum, m) => sum + m.memory.usagePercent, 0) / history.length :
      currentMetrics.memory.usagePercent;
    
    // Determine overall status
    const status = currentMetrics.cpu.usage > 90 || currentMetrics.memory.usagePercent > 95 ? 
      'warning' : 'healthy';
    
    const publicStatus = {
      status: status,
      timestamp: new Date().toISOString(),
      current: {
        cpu: {
          usage: currentMetrics.cpu.usage.toFixed(2),
          load: currentMetrics.cpu.loadAverage
        },
        memory: {
          usage: currentMetrics.memory.usagePercent.toFixed(2),
          available: currentMetrics.memory.available,
          total: currentMetrics.memory.total
        },
        disk: {
          usage: currentMetrics.disk.usagePercent.toFixed(2),
          available: currentMetrics.disk.available,
          total: currentMetrics.disk.total
        },
        uptime: currentMetrics.uptime
      },
      averages: {
        cpu: avgCpu.toFixed(2),
        memory: avgMemory.toFixed(2)
      },
      links: {
        documentation: 'https://claude.dwyer.co.za/api-docs',
        status_page: 'https://claude.dwyer.co.za/status/demo'
      }
    };
    
    res.json(publicStatus);
  } catch (error) {
    console.error('Public API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple health check endpoint (no analytics tracking for monitoring)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Public health check endpoint
app.get('/api/v1/health', (req, res) => {
  analytics.trackPageView(req, 'api-health');
  res.json({
    status: 'ok',
    service: 'MicroMonitor',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Setup analytics routes
analyticsAPI.setupRoutes(app, authMiddleware);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error(err.stack);
  // Log to file for later analysis
  const fs = require('fs');
  const errorLog = `[${new Date().toISOString()}] Uncaught Exception: ${err.message}\n${err.stack}\n\n`;
  fs.appendFileSync(path.join(__dirname, '../error.log'), errorLog);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to file for later analysis
  const fs = require('fs');
  const errorLog = `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n\n`;
  fs.appendFileSync(path.join(__dirname, '../error.log'), errorLog);
});

// Initialize default admin user and alert manager
initializeDefaultAdmin();
alertManager.initialize();

app.listen(port, () => {
  console.log(`MicroMonitor running on http://localhost:${port}`);
  console.log('Dashboard available at http://localhost:' + port);
});