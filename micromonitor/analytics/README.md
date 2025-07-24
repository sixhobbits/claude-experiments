# MicroMonitor Analytics System

## Overview
The MicroMonitor Analytics System provides comprehensive tracking and reporting for your monitoring dashboard. It tracks visitor activity, API usage, login attempts, and demo account activity.

## Features

- **Daily Visitor Tracking**: Counts unique visitors by IP address
- **API Usage Analytics**: Tracks all API endpoint calls and usage patterns  
- **Login Monitoring**: Records authentication attempts including demo account usage
- **Historical Data**: Maintains historical analytics data for trend analysis
- **Automated Reports**: Generates markdown reports with key metrics
- **Web Dashboard**: Interactive analytics dashboard with charts and graphs

## Components

### 1. Analytics Tracker (`analytics_tracker.py`)
Main Python script that:
- Parses nginx access logs
- Analyzes user database
- Generates analytics data
- Creates markdown reports
- Stores historical data

### 2. Analytics API (`analytics_api.js`)
Node.js module that provides REST endpoints:
- `/api/analytics/report` - Get latest markdown report
- `/api/analytics/history` - Get historical analytics data
- `/api/analytics/date/:date` - Get analytics for specific date
- `/api/analytics/summary` - Get current day summary
- `/api/analytics/run` - Manually trigger analytics generation (admin only)

### 3. Web Dashboard (`/analytics.html`)
Interactive dashboard featuring:
- Real-time metrics display
- 7-day trend charts
- Full report viewer
- Historical data browser
- Manual analytics trigger

## Installation

The analytics system is already integrated into MicroMonitor. To set up automated analytics:

```bash
# Make scripts executable
chmod +x analytics/run_analytics.sh
chmod +x analytics/setup_cron.sh

# Set up cron jobs (runs hourly)
./analytics/setup_cron.sh
```

## Manual Usage

### Generate Analytics Report
```bash
cd /root/claude-experiments/micromonitor/analytics
python3 analytics_tracker.py
```

### View Analytics Dashboard
Navigate to: `http://your-server/analytics.html`

## Data Storage

- **Analytics History**: `analytics/data/analytics_history.json`
- **Latest Report**: `analytics/data/daily_report.md`
- **Archived Reports**: `analytics/data/report_YYYYMMDD_HHMMSS.md`

## Metrics Tracked

1. **Visitor Metrics**
   - Unique visitor count (by IP)
   - Total requests
   - Page views by URL
   - User agent statistics

2. **API Metrics**
   - Total API calls
   - Calls per endpoint
   - Top 10 most used endpoints

3. **Authentication Metrics**
   - Total login attempts
   - Demo account activity
   - New user registrations

4. **System Metrics**
   - HTTP status code distribution
   - User account statistics
   - Daily trends

## Cron Schedule

- **Hourly**: General analytics update
- **Daily at 2 AM**: Comprehensive daily report

## Requirements

- Python 3.x
- Access to nginx logs (`/var/log/nginx/access.log`)
- MicroMonitor server running
- Node.js for API integration

## Troubleshooting

### No data appearing
- Check nginx log permissions
- Verify Python script can read log files
- Ensure analytics directory has write permissions

### Missing metrics
- Confirm nginx is logging to expected location
- Check log format matches parser regex
- Verify date filtering is working correctly

### API errors
- Ensure analytics module is loaded in server.js
- Check authentication middleware is properly configured
- Verify file paths are correct

## Security Notes

- Analytics data is protected by MicroMonitor authentication
- Only admins can manually trigger analytics generation
- Historical data is stored locally, not transmitted externally
- IP addresses are collected but can be anonymized if needed