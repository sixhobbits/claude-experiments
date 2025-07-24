#!/bin/bash
# Monitor growth metrics in real-time

while true; do
    clear
    echo "=== MicroMonitor Growth Metrics ==="
    echo "Time: $(date)"
    echo ""
    
    # Read analytics data
    if [ -f "/root/claude-experiments/micromonitor/data/analytics.json" ]; then
        UNIQUE_VISITORS=$(jq '.uniqueVisitors | length' /root/claude-experiments/micromonitor/data/analytics.json)
        TOTAL_VIEWS=$(jq '.totalVisitors' /root/claude-experiments/micromonitor/data/analytics.json)
        DEMO_LOGINS=$(jq '.conversions.demoLogins' /root/claude-experiments/micromonitor/data/analytics.json)
        FEEDBACK=$(jq '.conversions.feedbackSubmissions' /root/claude-experiments/micromonitor/data/analytics.json)
        
        echo "📊 Traffic Metrics:"
        echo "  Unique Visitors: $UNIQUE_VISITORS"
        echo "  Total Page Views: $TOTAL_VIEWS"
        echo ""
        
        echo "🎯 Conversions:"
        echo "  Demo Logins: $DEMO_LOGINS"
        echo "  Feedback Submissions: $FEEDBACK"
        echo ""
        
        echo "📈 Campaign Performance:"
        jq -r '.campaigns | to_entries[] | "  \(.key): \(.value.visitors) visitors, \(.value.conversions) conversions"' /root/claude-experiments/micromonitor/data/analytics.json
    else
        echo "No analytics data found yet."
    fi
    
    echo ""
    echo "Refreshing in 30 seconds... (Ctrl+C to exit)"
    sleep 30
done