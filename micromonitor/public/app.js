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

// Initial fetch
fetchMetrics();
fetchRetentionStats();

// Refresh retention stats every minute
setInterval(fetchRetentionStats, 60000);