#!/bin/bash
# Setup hourly cron job for signup tracking

# Define the cron job
CRON_JOB="0 * * * * cd /root/claude-experiments && /usr/bin/python3 micromonitor/track_signups.py >> micromonitor/logs/tracking.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "track_signups.py"; then
    echo "Cron job for signup tracking already exists"
else
    # Add the cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Added hourly cron job for signup tracking"
fi

# Ensure log directory exists
mkdir -p /root/claude-experiments/micromonitor/logs

echo "Signup tracking cron setup complete!"
echo "The script will run every hour at :00"
echo "Logs will be saved to: micromonitor/logs/tracking.log"
echo "Tracking summaries will be saved to: SIGNUP_TRACKING.md"