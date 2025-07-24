#!/bin/bash
# MicroMonitor Analytics Runner
# Run this script via cron to generate periodic analytics

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_FILE="${SCRIPT_DIR}/analytics.log"

echo "[$(date)] Starting analytics run" >> "$LOG_FILE"

# Run the Python analytics script
cd "$SCRIPT_DIR"
python3 analytics_tracker.py >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "[$(date)] Analytics completed successfully" >> "$LOG_FILE"
else
    echo "[$(date)] Analytics failed with error" >> "$LOG_FILE"
fi

echo "---" >> "$LOG_FILE"