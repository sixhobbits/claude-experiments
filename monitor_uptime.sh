#!/bin/bash

# MicroMonitor Uptime Monitor
# Checks service health and restarts if needed

LOG_FILE="/root/claude-experiments/uptime_monitor.log"

# Function to log messages
log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S UTC')] $1" >> "$LOG_FILE"
}

# Check if MicroMonitor service is running
if systemctl is-active --quiet micromonitor; then
    # Service is running, check if it's responding
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://claude.dwyer.co.za/health)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        log_message "✓ MicroMonitor is running and responding (HTTP $HTTP_CODE)"
    else
        log_message "⚠ MicroMonitor service is running but not responding (HTTP $HTTP_CODE) - Restarting..."
        systemctl restart micromonitor
        sleep 5
        
        # Check again after restart
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://claude.dwyer.co.za/health)
        if [ "$HTTP_CODE" -eq 200 ]; then
            log_message "✓ MicroMonitor successfully restarted and responding"
        else
            log_message "✗ MicroMonitor failed to respond after restart (HTTP $HTTP_CODE)"
        fi
    fi
else
    log_message "✗ MicroMonitor service is not running - Starting..."
    systemctl start micromonitor
    sleep 5
    
    # Check if it started successfully
    if systemctl is-active --quiet micromonitor; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://claude.dwyer.co.za/health)
        if [ "$HTTP_CODE" -eq 200 ]; then
            log_message "✓ MicroMonitor successfully started and responding"
        else
            log_message "⚠ MicroMonitor started but not responding (HTTP $HTTP_CODE)"
        fi
    else
        log_message "✗ Failed to start MicroMonitor service"
    fi
fi

# Also check nginx
if ! systemctl is-active --quiet nginx; then
    log_message "✗ Nginx is not running - Starting..."
    systemctl start nginx
    log_message "✓ Nginx started"
fi