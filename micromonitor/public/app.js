// Check authentication
const authToken = localStorage.getItem('authToken');
if (!authToken) {
    window.location.href = '/login.html';
}

// Add auth headers to all requests
const authHeaders = {
    'Authorization': `Bearer ${authToken}`
};

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
    document.getElementById('memory-usage').textContent = data.memory.usagePercent.toFixed(1);
    document.getElementById('disk-usage').textContent = data.disk.usagePercent.toFixed(1);
    document.getElementById('uptime').textContent = (data.uptime / 86400).toFixed(1);
    
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
    memoryChart.data.datasets[0].data.push(data.memory.usagePercent);
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

// Initial fetch
fetchMetrics();
fetchRetentionStats();
fetchConfig();
fetchAlertHistory();

// Refresh retention stats every minute
setInterval(fetchRetentionStats, 60000);

// Refresh alert history every 30 seconds
setInterval(fetchAlertHistory, 30000);