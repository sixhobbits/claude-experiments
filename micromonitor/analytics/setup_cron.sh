#!/bin/bash
# Setup cron job for MicroMonitor Analytics

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Add cron job to run analytics every hour
echo "Setting up cron job for MicroMonitor Analytics..."

# Create a cron entry
CRON_CMD="${SCRIPT_DIR}/run_analytics.sh"
CRON_JOB="0 * * * * ${CRON_CMD}"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -F "$CRON_CMD") || {
    # Add the cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added: Analytics will run every hour"
}

# Also run analytics at 2 AM daily for daily summary
DAILY_CRON_JOB="0 2 * * * ${CRON_CMD}"
(crontab -l 2>/dev/null | grep -F "0 2 * * *" | grep -F "$CRON_CMD") || {
    (crontab -l 2>/dev/null; echo "$DAILY_CRON_JOB") | crontab -
    echo "Daily cron job added: Analytics will run at 2 AM daily"
}

echo "Cron setup complete!"
echo ""
echo "Current crontab entries for MicroMonitor:"
crontab -l | grep "${SCRIPT_DIR}"