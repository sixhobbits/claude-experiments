// Check authentication
const authToken = localStorage.getItem('authToken');
if (!authToken) {
    window.location.href = '/login.html';
}

// Display current user
const currentUser = localStorage.getItem('username');
const userRole = localStorage.getItem('userRole');
document.getElementById('current-user').textContent = `${currentUser} (${userRole})`;

// Add auth headers to all requests
const authHeaders = {
    'Authorization': `Bearer ${authToken}`
};

// Show feedback prompt for demo users after 30 seconds
if (currentUser === 'demo' && !localStorage.getItem('feedbackPromptShown')) {
    setTimeout(() => {
        if (confirm('How is your experience with MicroMonitor so far? Would you like to share quick feedback?')) {
            window.open('/feedback.html', '_blank');
        }
        localStorage.setItem('feedbackPromptShown', 'true');
    }, 30000); // 30 seconds
}

// Initialize charts
const cpuChartCtx = document.getElementById('cpu-chart').getContext('2d');
const memoryChartCtx = document.getElementById('memory-chart').getContext('2d');

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            beginAtZero: true,
            max: 100
        }
    },
    plugins: {
        legend: {
            display: false
        }
    }
};

const cpuChart = new Chart(cpuChartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            data: [],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4
        }]
    },
    options: chartOptions
});

const memoryChart = new Chart(memoryChartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            data: [],
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            tension: 0.4
        }]
    },
    options: chartOptions
});

// Update metrics
function updateMetrics(data) {
    document.getElementById('cpu-usage').textContent = data.cpu.usage.toFixed(1);
    document.getElementById('memory-usage').textContent = data.memory.percentage.toFixed(1);
    document.getElementById('disk-usage').textContent = data.disk.percentage.toFixed(1);
    document.getElementById('uptime').textContent = (data.uptime.seconds / 86400).toFixed(1);
    
    const now = new Date();
    document.getElementById('last-update').textContent = now.toLocaleTimeString();
    
    // Update charts
    const timeLabel = now.toLocaleTimeString();
    
    // CPU Chart
    cpuChart.data.labels.push(timeLabel);
    cpuChart.data.datasets[0].data.push(data.cpu.usage);
    if (cpuChart.data.labels.length > 20) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }
    cpuChart.update('none');
    
    // Memory Chart
    memoryChart.data.labels.push(timeLabel);
    memoryChart.data.datasets[0].data.push(data.memory.percentage);
    if (memoryChart.data.labels.length > 20) {
        memoryChart.data.labels.shift();
        memoryChart.data.datasets[0].data.shift();
    }
    memoryChart.update('none');
}

// Fetch initial data
async function fetchMetrics() {
    try {
        const response = await fetch('/api/metrics', {
            headers: authHeaders
        });
        
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        updateMetrics(data);
    } catch (error) {
        console.error('Failed to fetch metrics:', error);
    }
}

// Set up EventSource for real-time updates
const eventSource = new EventSource('/api/events');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateMetrics(data);
};

eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
};

// Fetch retention statistics
async function fetchRetentionStats() {
    try {
        const response = await fetch('/api/retention/stats', {
            headers: authHeaders
        });
        
        if (!response.ok) {
            console.error('Failed to fetch retention stats');
            return;
        }
        
        const stats = await response.json();
        updateRetentionStats(stats);
    } catch (error) {
        console.error('Failed to fetch retention stats:', error);
    }
}

function updateRetentionStats(stats) {
    document.getElementById('total-records').textContent = stats.totalRecords || '0';
    document.getElementById('retention-hours').textContent = stats.retentionHours || '24';
    document.getElementById('archive-status').textContent = stats.archiveEnabled ? 'Enabled' : 'Disabled';
    
    if (stats.oldestRecord) {
        const oldestDate = new Date(stats.oldestRecord);
        const age = Date.now() - oldestDate.getTime();
        const ageHours = Math.floor(age / (1000 * 60 * 60));
        const ageMinutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
        document.getElementById('oldest-record').textContent = `${ageHours}h ${ageMinutes}m ago`;
    } else {
        document.getElementById('oldest-record').textContent = 'N/A';
    }
}

// Add logout functionality
document.getElementById('logout-btn').onclick = () => {
    localStorage.clear();
    window.location.href = '/login.html';
};

// Alert Configuration
let currentConfig = null;

async function fetchConfig() {
    try {
        const response = await fetch('/api/config', {
            headers: authHeaders
        });
        
        if (!response.ok) {
            console.error('Failed to fetch config');
            return;
        }
        
        currentConfig = await response.json();
        updateAlertStatus();
    } catch (error) {
        console.error('Failed to fetch config:', error);
    }
}

function updateAlertStatus() {
    if (!currentConfig) return;
    
    document.getElementById('alert-status').textContent = currentConfig.alerting.enabled ? 'Enabled' : 'Disabled';
    document.getElementById('email-status').textContent = currentConfig.email.enabled ? 'Enabled' : 'Disabled';
}

async function fetchAlertHistory() {
    try {
        const response = await fetch('/api/alerts/history', {
            headers: authHeaders
        });
        
        if (!response.ok) {
            console.error('Failed to fetch alert history');
            return;
        }
        
        const history = await response.json();
        updateAlertHistory(history);
    } catch (error) {
        console.error('Failed to fetch alert history:', error);
    }
}

function updateAlertHistory(history) {
    const listElement = document.getElementById('alert-history-list');
    
    if (history.length === 0) {
        listElement.innerHTML = '<p class="no-alerts">No recent alerts</p>';
        return;
    }
    
    listElement.innerHTML = history.map(alert => {
        const date = new Date(alert.lastAlert);
        const timeAgo = getTimeAgo(date);
        return `<div class="alert-item ${alert.level}">
            <strong>${alert.level.toUpperCase()}</strong>: ${alert.type} - ${timeAgo}
        </div>`;
    }).join('');
}

function getTimeAgo(date) {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

// Modal functionality
const modal = document.getElementById('config-modal');
const configBtn = document.getElementById('configure-alerts-btn');
const saveBtn = document.getElementById('save-config-btn');
const cancelBtn = document.getElementById('cancel-config-btn');

configBtn.onclick = () => {
    if (!currentConfig) return;
    
    // Populate form with current values
    document.getElementById('cpu-warning').value = currentConfig.thresholds.cpu.warning;
    document.getElementById('cpu-critical').value = currentConfig.thresholds.cpu.critical;
    document.getElementById('memory-warning').value = currentConfig.thresholds.memory.warning;
    document.getElementById('memory-critical').value = currentConfig.thresholds.memory.critical;
    document.getElementById('disk-warning').value = currentConfig.thresholds.disk.warning;
    document.getElementById('disk-critical').value = currentConfig.thresholds.disk.critical;
    
    document.getElementById('email-enabled').checked = currentConfig.email.enabled;
    document.getElementById('smtp-host').value = currentConfig.email.smtp.host;
    document.getElementById('smtp-port').value = currentConfig.email.smtp.port;
    document.getElementById('smtp-user').value = currentConfig.email.smtp.user;
    document.getElementById('smtp-pass').value = currentConfig.email.smtp.pass;
    document.getElementById('email-from').value = currentConfig.email.from;
    document.getElementById('email-to').value = currentConfig.email.to;
    
    modal.style.display = 'flex';
};

cancelBtn.onclick = () => {
    modal.style.display = 'none';
};

saveBtn.onclick = async () => {
    const newConfig = {
        ...currentConfig,
        thresholds: {
            cpu: {
                warning: parseInt(document.getElementById('cpu-warning').value),
                critical: parseInt(document.getElementById('cpu-critical').value)
            },
            memory: {
                warning: parseInt(document.getElementById('memory-warning').value),
                critical: parseInt(document.getElementById('memory-critical').value)
            },
            disk: {
                warning: parseInt(document.getElementById('disk-warning').value),
                critical: parseInt(document.getElementById('disk-critical').value)
            }
        },
        email: {
            enabled: document.getElementById('email-enabled').checked,
            smtp: {
                host: document.getElementById('smtp-host').value,
                port: parseInt(document.getElementById('smtp-port').value),
                secure: false,
                user: document.getElementById('smtp-user').value,
                pass: document.getElementById('smtp-pass').value
            },
            from: document.getElementById('email-from').value,
            to: document.getElementById('email-to').value
        }
    };
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newConfig)
        });
        
        if (response.ok) {
            currentConfig = newConfig;
            updateAlertStatus();
            modal.style.display = 'none';
            alert('Configuration saved successfully');
        } else {
            alert('Failed to save configuration');
        }
    } catch (error) {
        console.error('Failed to save config:', error);
        alert('Failed to save configuration');
    }
};

// Close modal when clicking outside
modal.onclick = (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
};

// Process monitoring functionality
async function fetchProcesses() {
    try {
        const response = await fetch('/api/processes', {
            headers: authHeaders
        });
        
        if (response.ok) {
            const data = await response.json();
            updateProcessDisplay(data);
        }
    } catch (error) {
        console.error('Failed to fetch processes:', error);
    }
}

function updateProcessDisplay(data) {
    // Update process counts
    document.getElementById('total-processes').textContent = data.totalProcesses || 0;
    document.getElementById('running-processes').textContent = data.processCounts['Running'] || 0;
    document.getElementById('sleeping-processes').textContent = data.processCounts['Sleeping'] || 0;
    
    // Update CPU processes table
    const cpuTableBody = document.querySelector('#cpu-processes-table tbody');
    cpuTableBody.innerHTML = '';
    
    if (data.topProcessesByCpu && data.topProcessesByCpu.length > 0) {
        data.topProcessesByCpu.forEach(proc => {
            const row = cpuTableBody.insertRow();
            row.innerHTML = `
                <td>${proc.pid}</td>
                <td title="${proc.command}">${proc.command.substring(0, 30)}${proc.command.length > 30 ? '...' : ''}</td>
                <td>${proc.cpu.toFixed(1)}%</td>
                <td>${proc.memory.toFixed(1)}%</td>
                <td>${proc.user}</td>
            `;
        });
    } else {
        cpuTableBody.innerHTML = '<tr><td colspan="5">No process data available</td></tr>';
    }
    
    // Update Memory processes table
    const memTableBody = document.querySelector('#memory-processes-table tbody');
    memTableBody.innerHTML = '';
    
    if (data.topProcessesByMemory && data.topProcessesByMemory.length > 0) {
        data.topProcessesByMemory.forEach(proc => {
            const row = memTableBody.insertRow();
            row.innerHTML = `
                <td>${proc.pid}</td>
                <td title="${proc.command}">${proc.command.substring(0, 30)}${proc.command.length > 30 ? '...' : ''}</td>
                <td>${proc.memory.toFixed(1)}%</td>
                <td>${proc.cpu.toFixed(1)}%</td>
                <td>${proc.user}</td>
            `;
        });
    } else {
        memTableBody.innerHTML = '<tr><td colspan="5">No process data available</td></tr>';
    }
}

// Process refresh button
document.getElementById('refresh-processes').onclick = () => {
    fetchProcesses();
};

// Webhook functionality
let currentWebhooks = [];
let editingWebhookIndex = -1;

async function fetchWebhookHistory() {
    try {
        const response = await fetchWithAuth('/api/webhooks/history');
        const history = await response.json();
        updateWebhookHistory(history);
    } catch (error) {
        console.error('Failed to fetch webhook history:', error);
    }
}

function updateWebhookHistory(history) {
    const historyList = document.getElementById('webhook-history-list');
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="no-webhooks">No recent webhook activity</p>';
        return;
    }
    
    historyList.innerHTML = history.map(item => {
        const statusClass = item.status >= 200 && item.status < 300 ? 'webhook-status-success' : 'webhook-status-failed';
        const statusText = item.error || item.response || 'Sent';
        return `
            <div class="webhook-item">
                <strong>${item.name}</strong> - ${item.event}
                <span class="${statusClass}">${statusText}</span>
                <small>${new Date(item.timestamp).toLocaleString()}</small>
            </div>
        `;
    }).join('');
}

function updateWebhookList() {
    const webhooksList = document.getElementById('configured-webhooks');
    
    if (currentWebhooks.length === 0) {
        webhooksList.innerHTML = '<p>No webhooks configured</p>';
        return;
    }
    
    webhooksList.innerHTML = currentWebhooks.map((webhook, index) => `
        <div class="webhook-list-item">
            <div>
                <strong>${webhook.name}</strong>
                <small>${webhook.enabled ? 'Enabled' : 'Disabled'}</small>
            </div>
            <div>
                <button onclick="editWebhook(${index})" class="edit-btn">Edit</button>
                <button onclick="deleteWebhook(${index})" class="delete-btn">Delete</button>
            </div>
        </div>
    `).join('');
}

window.editWebhook = function(index) {
    editingWebhookIndex = index;
    const webhook = currentWebhooks[index];
    
    document.getElementById('webhook-name').value = webhook.name;
    document.getElementById('webhook-url').value = webhook.url;
    document.getElementById('webhook-enabled').checked = webhook.enabled;
    
    // Set events checkboxes
    const eventCheckboxes = document.querySelectorAll('.webhook-events input[type="checkbox"]');
    eventCheckboxes.forEach(cb => {
        cb.checked = webhook.events.includes(cb.value);
    });
    
    document.getElementById('webhook-editor').style.display = 'block';
};

window.deleteWebhook = function(index) {
    if (confirm('Are you sure you want to delete this webhook?')) {
        currentWebhooks.splice(index, 1);
        updateWebhookList();
    }
};

// Webhook modal controls
document.getElementById('configure-webhooks-btn').onclick = async () => {
    await fetchConfig();
    currentWebhooks = currentConfig.webhooks || [];
    updateWebhookList();
    document.getElementById('webhook-modal').style.display = 'block';
};

document.getElementById('close-webhook-modal').onclick = async () => {
    // Save webhooks to config
    currentConfig.webhooks = currentWebhooks;
    
    await fetchWithAuth('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
    });
    
    document.getElementById('webhook-modal').style.display = 'none';
    document.getElementById('webhook-editor').style.display = 'none';
};

document.getElementById('add-webhook-btn').onclick = () => {
    editingWebhookIndex = -1;
    document.getElementById('webhook-name').value = '';
    document.getElementById('webhook-url').value = '';
    document.getElementById('webhook-enabled').checked = true;
    document.querySelectorAll('.webhook-events input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.value === 'alert';
    });
    document.getElementById('webhook-editor').style.display = 'block';
};

document.getElementById('save-webhook-btn').onclick = () => {
    const name = document.getElementById('webhook-name').value;
    const url = document.getElementById('webhook-url').value;
    const enabled = document.getElementById('webhook-enabled').checked;
    
    const events = [];
    document.querySelectorAll('.webhook-events input[type="checkbox"]:checked').forEach(cb => {
        events.push(cb.value);
    });
    
    if (!name || !url || events.length === 0) {
        alert('Please fill in all required fields');
        return;
    }
    
    const webhook = {
        name,
        url,
        enabled,
        events,
        headers: {}
    };
    
    if (editingWebhookIndex === -1) {
        currentWebhooks.push(webhook);
    } else {
        currentWebhooks[editingWebhookIndex] = webhook;
    }
    
    updateWebhookList();
    document.getElementById('webhook-editor').style.display = 'none';
};

document.getElementById('test-webhook-btn').onclick = async () => {
    const webhook = {
        name: document.getElementById('webhook-name').value,
        url: document.getElementById('webhook-url').value,
        headers: {}
    };
    
    if (!webhook.url) {
        alert('Please enter a webhook URL');
        return;
    }
    
    try {
        const response = await fetchWithAuth('/api/webhooks/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhook)
        });
        
        const result = await response.json();
        alert(result.success ? 'Webhook test successful!' : `Webhook test failed: ${result.error}`);
    } catch (error) {
        alert('Failed to test webhook: ' + error.message);
    }
};

document.getElementById('cancel-webhook-btn').onclick = () => {
    document.getElementById('webhook-editor').style.display = 'none';
};

// Initial fetch
fetchMetrics();
fetchRetentionStats();
fetchConfig();
fetchAlertHistory();
fetchProcesses();
fetchWebhookHistory();

// Refresh retention stats every minute
setInterval(fetchRetentionStats, 60000);

// Refresh alert history every 30 seconds
setInterval(fetchAlertHistory, 30000);

// Refresh webhook history every 30 seconds
setInterval(fetchWebhookHistory, 30000);

// Refresh processes every 30 seconds
setInterval(fetchProcesses, 30000);

// API Key Management
let currentApiKeys = [];

async function fetchApiKeys() {
    try {
        const response = await fetch('/api/keys', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                // User doesn't have admin access
                document.getElementById('manage-api-keys-btn').style.display = 'none';
                return;
            }
            throw new Error('Failed to fetch API keys');
        }
        
        currentApiKeys = await response.json();
        updateApiKeysList();
    } catch (error) {
        console.error('Error fetching API keys:', error);
    }
}

function updateApiKeysList() {
    const listElement = document.getElementById('api-keys-list');
    
    if (currentApiKeys.length === 0) {
        listElement.innerHTML = '<p style="color: #666;">No API keys created yet.</p>';
        return;
    }
    
    listElement.innerHTML = currentApiKeys.map(key => `
        <div class="api-key-item">
            <div class="api-key-info">
                <div class="api-key-name">${key.name}</div>
                <div class="api-key-meta">
                    Permissions: ${key.permissions.join(', ')} | 
                    Created: ${new Date(key.createdAt).toLocaleString()} | 
                    Used: ${key.usageCount} times
                    ${key.lastUsed ? ` | Last: ${new Date(key.lastUsed).toLocaleString()}` : ''}
                </div>
            </div>
            <button class="delete-btn" onclick="deleteApiKey('${key.id}')">Delete</button>
        </div>
    `).join('');
}

window.deleteApiKey = async function(keyId) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/keys/${keyId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete API key');
        }
        
        await fetchApiKeys();
    } catch (error) {
        console.error('Error deleting API key:', error);
        alert('Failed to delete API key');
    }
}

document.getElementById('manage-api-keys-btn').onclick = async () => {
    await fetchApiKeys();
    document.getElementById('api-keys-modal').style.display = 'block';
    document.getElementById('api-key-creator').style.display = 'none';
    document.getElementById('api-key-display').style.display = 'none';
};

document.getElementById('close-api-keys-modal').onclick = () => {
    document.getElementById('api-keys-modal').style.display = 'none';
};

document.getElementById('create-api-key-btn').onclick = () => {
    document.getElementById('api-key-creator').style.display = 'block';
    document.getElementById('api-key-display').style.display = 'none';
    document.getElementById('api-key-name').value = '';
    document.querySelectorAll('.api-key-permissions input').forEach(cb => cb.checked = cb.value === 'read');
};

document.getElementById('cancel-api-key-btn').onclick = () => {
    document.getElementById('api-key-creator').style.display = 'none';
};

document.getElementById('generate-api-key-btn').onclick = async () => {
    const name = document.getElementById('api-key-name').value.trim();
    if (!name) {
        alert('Please enter a name for the API key');
        return;
    }
    
    const permissions = [];
    document.querySelectorAll('.api-key-permissions input:checked').forEach(cb => {
        permissions.push(cb.value);
    });
    
    if (permissions.length === 0) {
        alert('Please select at least one permission');
        return;
    }
    
    // If 'all' is selected, use only that
    const finalPermissions = permissions.includes('all') ? ['all'] : permissions;
    
    try {
        const response = await fetch('/api/keys', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, permissions: finalPermissions })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create API key');
        }
        
        const result = await response.json();
        document.getElementById('generated-api-key').textContent = result.key;
        document.getElementById('api-key-creator').style.display = 'none';
        document.getElementById('api-key-display').style.display = 'block';
        
        await fetchApiKeys();
    } catch (error) {
        console.error('Error creating API key:', error);
        alert('Failed to create API key');
    }
};

document.getElementById('copy-api-key-btn').onclick = () => {
    const keyText = document.getElementById('generated-api-key').textContent;
    navigator.clipboard.writeText(keyText).then(() => {
        const btn = document.getElementById('copy-api-key-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
};

document.getElementById('done-api-key-btn').onclick = () => {
    document.getElementById('api-key-display').style.display = 'none';
};

// Check if user has admin access on load
fetchApiKeys();

// CSV Export functionality
document.getElementById('export-csv-btn').onclick = async () => {
    const hours = document.getElementById('export-hours').value;
    
    try {
        const response = await fetch(`/api/metrics/export/csv?hours=${hours}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to export data');
        }
        
        // Get the filename from the Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        const filenameMatch = disposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `micromonitor-export-${new Date().toISOString().split('T')[0]}.csv`;
        
        // Create a blob from the response
        const blob = await response.blob();
        
        // Create a download link and click it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data');
    }
};

// PDF Export functionality
document.getElementById('export-pdf-btn').onclick = async () => {
    const hours = document.getElementById('export-hours').value;
    
    try {
        const response = await fetch(`/api/metrics/export/pdf?hours=${hours}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to export PDF');
        }
        
        // Get the filename from the Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        const filenameMatch = disposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `micromonitor-report-${new Date().toISOString().split('T')[0]}.pdf`;
        
        // Create a blob from the response
        const blob = await response.blob();
        
        // Create a download link and click it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Failed to export PDF report');
    }
};

// Feedback functionality
const feedbackButton = document.getElementById('feedback-button');
const feedbackModal = document.getElementById('feedback-modal');
const feedbackClose = document.getElementById('feedback-close');
const feedbackForm = document.getElementById('feedback-form');
const feedbackResult = document.getElementById('feedback-result');
const typeButtons = document.querySelectorAll('.type-button');

let selectedType = 'other';

// Show/hide modal
feedbackButton.addEventListener('click', () => {
    feedbackModal.classList.add('show');
});

feedbackClose.addEventListener('click', () => {
    feedbackModal.classList.remove('show');
    feedbackResult.innerHTML = '';
});

feedbackModal.addEventListener('click', (e) => {
    if (e.target === feedbackModal) {
        feedbackModal.classList.remove('show');
        feedbackResult.innerHTML = '';
    }
});

// Handle type selection
typeButtons.forEach(button => {
    button.addEventListener('click', () => {
        typeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        selectedType = button.dataset.type;
    });
});

// Handle form submission
feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('feedback-email').value;
    const message = document.getElementById('feedback-message').value;
    
    if (!message.trim()) {
        feedbackResult.innerHTML = '<div class="feedback-error">Please enter your feedback.</div>';
        return;
    }
    
    const submitButton = feedbackForm.querySelector('.feedback-submit');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                email,
                type: selectedType,
                message,
                url: window.location.href
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            feedbackResult.innerHTML = '<div class="feedback-success">Thank you for your feedback! We appreciate your input.</div>';
            feedbackForm.reset();
            
            setTimeout(() => {
                feedbackModal.classList.remove('show');
                feedbackResult.innerHTML = '';
            }, 3000);
        } else {
            feedbackResult.innerHTML = '<div class="feedback-error">Failed to send feedback. Please try again.</div>';
        }
    } catch (error) {
        feedbackResult.innerHTML = '<div class="feedback-error">An error occurred. Please try again later.</div>';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Feedback';
    }
});

// Status Pages functionality
let statusPages = [];

async function fetchStatusPages() {
    try {
        const response = await fetch('/api/status-pages', {
            headers: authHeaders
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch status pages');
        }
        
        statusPages = await response.json();
        displayStatusPages();
    } catch (error) {
        console.error('Error fetching status pages:', error);
    }
}

function displayStatusPages() {
    const statusPagesList = document.getElementById('status-pages-list');
    
    if (statusPages.length === 0) {
        statusPagesList.innerHTML = '<p>No status pages created yet.</p>';
        return;
    }
    
    statusPagesList.innerHTML = statusPages.map(page => `
        <div class="status-page-item">
            <div class="status-page-info">
                <strong>${page.name}</strong>
                <p>${page.description}</p>
                <p class="status-page-url">
                    <a href="/status/${page.id}" target="_blank">https://claude.dwyer.co.za/status/${page.id}</a>
                    <button onclick="copyStatusPageUrl('${page.id}')" class="copy-btn">Copy</button>
                </p>
            </div>
            <div class="status-page-actions">
                <span class="status-badge ${page.isPublic ? 'public' : 'private'}">${page.isPublic ? 'Public' : 'Private'}</span>
                <button onclick="deleteStatusPage('${page.id}')" class="delete-btn">Delete</button>
            </div>
        </div>
    `).join('');
}

function copyStatusPageUrl(statusId) {
    const url = `https://claude.dwyer.co.za/status/${statusId}`;
    navigator.clipboard.writeText(url);
    event.target.textContent = 'Copied!';
    setTimeout(() => {
        event.target.textContent = 'Copy';
    }, 2000);
}

async function deleteStatusPage(statusId) {
    if (!confirm('Are you sure you want to delete this status page?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/status-pages/${statusId}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete status page');
        }
        
        await fetchStatusPages();
    } catch (error) {
        console.error('Error deleting status page:', error);
        alert('Failed to delete status page');
    }
}

// Status pages modal handlers
document.getElementById('manage-status-pages-btn').onclick = async () => {
    await fetchStatusPages();
    document.getElementById('status-pages-modal').style.display = 'block';
};

document.getElementById('close-status-pages-modal').onclick = () => {
    document.getElementById('status-pages-modal').style.display = 'none';
};

// Status page form submission
document.getElementById('status-page-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('status-page-name').value.trim();
    const description = document.getElementById('status-page-description').value.trim();
    const isPublic = document.getElementById('status-page-public').checked;
    
    try {
        const response = await fetch('/api/status-pages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ name, description, isPublic })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create status page');
        }
        
        const result = await response.json();
        
        // Show success message with URL
        alert(`Status page created successfully!\n\nPublic URL: ${result.publicUrl}`);
        
        // Reset form and refresh list
        document.getElementById('status-page-form').reset();
        await fetchStatusPages();
        
    } catch (error) {
        console.error('Error creating status page:', error);
        alert('Failed to create status page');
    }
};