const express = require('express');
const path = require('path');
const SystemMetrics = require('./metrics');
const DataStore = require('./dataStore');
const AlertManager = require('./alerts');
const ProcessMonitor = require('./processes');
const WebhookManager = require('../webhooks');
const { authMiddleware, authenticateUser, createUser, initializeDefaultAdmin } = require('./auth');
const { apiKeyMiddleware, createApiKey, listApiKeys, deleteApiKey } = require('./apiKeys');

const app = express();
const port = process.env.PORT || 3000;
const metrics = new SystemMetrics();
const dataStore = new DataStore();
const alertManager = new AlertManager(dataStore);
const processMonitor = new ProcessMonitor();
const webhookManager = new WebhookManager();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(apiKeyMiddleware());

let clients = [];

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authenticateUser(username, password);
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

// Initialize default admin user and alert manager
initializeDefaultAdmin();
alertManager.initialize();

app.listen(port, () => {
  console.log(`MicroMonitor running on http://localhost:${port}`);
  console.log('Dashboard available at http://localhost:' + port);
});