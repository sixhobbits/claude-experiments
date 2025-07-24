# MicroMonitor Deployment Guide

## Current Deployment Status
- **Status**: ✅ Deployed and Running
- **URL**: http://49.12.1.106/
- **Server**: Ubuntu VPS with nginx reverse proxy
- **Service**: Systemd service (micromonitor.service)

## Technical Stack
- **Backend**: Node.js + Express.js
- **Frontend**: Vanilla JavaScript with Chart.js
- **Monitoring**: System metrics via Node.js os module
- **Storage**: JSON file-based data persistence
- **Web Server**: nginx (reverse proxy to Node.js app on port 3000)

## Features Implemented
1. Real-time system metrics monitoring
   - CPU usage and load average
   - Memory usage (percentage and values)
   - Disk usage statistics
   - System uptime
   - Network statistics

2. Dashboard UI
   - Live updating metric cards
   - Real-time charts for CPU and Memory history
   - Server-Sent Events for live updates
   - Responsive design

3. API Endpoints
   - GET /api/metrics - Current system metrics
   - GET /api/metrics/history - Historical data
   - GET /api/events - SSE endpoint for real-time updates
   - GET/POST /api/config - Configuration management

## Deployment Commands
```bash
# Service management
systemctl status micromonitor
systemctl restart micromonitor
systemctl stop micromonitor

# View logs
journalctl -u micromonitor -f

# nginx management
systemctl restart nginx
nginx -t  # Test configuration
```

## File Locations
- Application: `/root/claude-experiments/micromonitor/`
- Service file: `/etc/systemd/system/micromonitor.service`
- nginx config: `/etc/nginx/sites-available/micromonitor`
- Data storage: `/root/claude-experiments/micromonitor/data/`

## Next Steps
1. Add SSL certificate for HTTPS
2. Configure custom domain
3. Implement authentication
4. Add email alerts for thresholds
5. Create mobile-responsive improvements