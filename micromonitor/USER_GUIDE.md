# MicroMonitor User Guide

## Overview
MicroMonitor is a lightweight server monitoring tool designed for VPS and small server deployments. It provides real-time system metrics, alerts, and comprehensive monitoring capabilities with minimal resource usage.

## Features
- Real-time CPU, Memory, and Disk usage monitoring
- Process-level monitoring and tracking
- Email and webhook alerts for threshold breaches
- Data retention with automatic cleanup
- API key authentication for programmatic access
- Export capabilities (CSV and PDF reports)
- Role-based access control (Admin/Viewer)

## Getting Started

### Default Login
- **URL**: http://your-server-ip/
- **Username**: admin
- **Password**: micromonitor123

**Important**: Change the default password immediately after first login.

### Dashboard Overview
The main dashboard displays:
1. **System Metrics**: Live CPU, Memory, and Disk usage with historical charts
2. **Process Monitoring**: Top processes by CPU and memory usage
3. **Alert Status**: Current alert configuration and recent alerts
4. **Data Management**: Retention settings and export options

## Configuration

### Alert Configuration
1. Click "Configure Alerts" in the Alert Status section
2. Set thresholds for:
   - CPU Usage (Warning/Critical %)
   - Memory Usage (Warning/Critical %)
   - Disk Usage (Warning/Critical %)
3. Configure email settings:
   - SMTP server details
   - From/To email addresses
   - Enable/disable email alerts

### Webhook Configuration
1. Click "Configure" in the Webhooks section
2. Add webhook URLs that will receive JSON payloads when alerts trigger
3. Test webhooks using the "Test" button
4. View webhook history to troubleshoot issues

### API Keys
1. Navigate to API Keys section (Admin only)
2. Click "Create API Key"
3. Set permissions:
   - **Read**: View metrics only
   - **Write**: Modify configurations
   - **All**: Full access
4. Copy the generated key immediately (shown only once)
5. Use the key in API requests with header: `X-API-Key: your-key`

## Data Export

### CSV Export
1. Select time range (1 hour to 7 days)
2. Click "Export to CSV"
3. File downloads automatically with timestamp

### PDF Export
1. Click "Export to PDF"
2. Comprehensive report includes:
   - Summary statistics
   - Alert configurations
   - Recent metrics history

## API Endpoints

### Authentication
All endpoints require either JWT token (from login) or API key.

### Available Endpoints
- `GET /api/metrics` - Current system metrics
- `GET /api/metrics/history` - Historical metrics data
- `GET /api/processes` - Current process information
- `GET /api/alerts/history` - Alert history
- `GET /api/config` - Current configuration
- `POST /api/config` - Update configuration (Admin only)
- `GET /api/metrics/export/csv?range=1h` - Export CSV data
- `GET /api/metrics/export/pdf` - Export PDF report

### Example API Usage
```bash
# Get current metrics
curl -H "X-API-Key: mk_your-key-here" http://your-server/api/metrics

# Export last 24 hours as CSV
curl -H "X-API-Key: mk_your-key-here" http://your-server/api/metrics/export/csv?range=24h -o metrics.csv
```

## Troubleshooting

### Cannot Login
- Ensure you're using the correct username/password
- Check if the service is running: `systemctl status micromonitor`
- Review logs: `journalctl -u micromonitor -f`

### No Metrics Displayed
- Verify the metrics collector is running
- Check browser console for errors
- Ensure authentication is working

### Alerts Not Sending
- Verify SMTP settings are correct
- Check email credentials
- Review alert history for error messages
- Ensure thresholds are properly configured

### High Resource Usage
- Adjust metric collection interval in configuration
- Reduce data retention period
- Disable unused features (webhooks, process monitoring)

## Security Best Practices
1. Change default admin password immediately
2. Use HTTPS in production (configure SSL)
3. Limit API key permissions to minimum required
4. Regularly review user accounts and API keys
5. Keep retention period reasonable to limit disk usage

## System Requirements
- **OS**: Linux (Ubuntu, Debian, CentOS)
- **Node.js**: v14 or higher
- **Memory**: 256MB minimum
- **Disk**: 1GB free space
- **Network**: Outbound SMTP access for email alerts

## Support
For issues or feature requests, check the system logs and ERRORS.md file for troubleshooting information.