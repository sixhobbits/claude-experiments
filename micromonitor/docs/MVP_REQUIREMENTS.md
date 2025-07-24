# MicroMonitor MVP Requirements

## Core Features

### 1. System Metrics Collection
- **CPU Usage**: Current percentage, 1/5/15 minute load averages
- **Memory**: Used/Free/Total RAM, swap usage
- **Disk**: Used/Free space per partition
- **Network**: Bytes in/out per interface
- **Uptime**: System uptime

### 2. Web Dashboard
- **Real-time Display**: Updates every 5 seconds
- **Charts**: Line graphs for CPU/Memory over time (last hour)
- **Status Indicators**: Green/Yellow/Red for thresholds
- **Responsive Design**: Works on mobile

### 3. Data Storage
- **JSON Files**: Store last 24 hours of data
- **Rotation**: Automatic cleanup of old data
- **Efficiency**: Aggregate data points to save space

### 4. Alerts
- **Thresholds**: Configurable limits for each metric
- **Visual Alerts**: Dashboard warnings
- **Log Alerts**: Write to alert log file

## Technical Requirements

### Backend
- Node.js server with Express
- System metrics via Node.js os module and child processes
- Server-sent events for real-time updates
- JSON file storage (no database)

### Frontend
- Vanilla JavaScript (no framework)
- Chart.js for visualizations
- CSS Grid/Flexbox for layout
- No build process needed

### Performance Goals
- Server uses < 50MB RAM
- < 1% CPU usage during normal operation
- Dashboard loads in < 1 second
- Works on 512MB VPS

## MVP Timeline
1. Basic server with metrics collection (Day 1)
2. Simple dashboard with real-time data (Day 2)
3. Charts and historical data (Day 3)
4. Alerts and thresholds (Day 4)
5. Testing and optimization (Day 5)