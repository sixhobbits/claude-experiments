const express = require('express');
const path = require('path');
const SystemMetrics = require('./metrics');
const DataStore = require('./dataStore');
const { authMiddleware, authenticateUser, createUser, initializeDefaultAdmin } = require('./auth');

const app = express();
const port = process.env.PORT || 3000;
const metrics = new SystemMetrics();
const dataStore = new DataStore();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize default admin user
initializeDefaultAdmin();

app.listen(port, () => {
  console.log(`MicroMonitor running on http://localhost:${port}`);
  console.log('Dashboard available at http://localhost:' + port);
});