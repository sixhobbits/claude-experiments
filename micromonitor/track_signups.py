#!/usr/bin/env python3
"""
Signup Tracking Script
Monitors analytics.json for signup attempts and generates hourly summaries
"""

import json
import os
from datetime import datetime, timedelta
from collections import defaultdict
import time

# File paths
ANALYTICS_FILE = "/root/claude-experiments/micromonitor/data/analytics.json"
TRACKING_FILE = "/root/claude-experiments/SIGNUP_TRACKING.md"
LAST_CHECK_FILE = "/root/claude-experiments/micromonitor/data/.last_signup_check"

def load_analytics():
    """Load current analytics data"""
    try:
        with open(ANALYTICS_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading analytics: {e}")
        return None

def get_last_check_time():
    """Get the last time we checked for updates"""
    if os.path.exists(LAST_CHECK_FILE):
        try:
            with open(LAST_CHECK_FILE, 'r') as f:
                return datetime.fromisoformat(f.read().strip())
        except:
            pass
    return datetime.now() - timedelta(hours=1)

def save_last_check_time():
    """Save the current time as the last check time"""
    os.makedirs(os.path.dirname(LAST_CHECK_FILE), exist_ok=True)
    with open(LAST_CHECK_FILE, 'w') as f:
        f.write(datetime.now().isoformat())

def format_hourly_summary(analytics_data, hour_str):
    """Format the analytics data into an hourly summary"""
    summary = []
    summary.append(f"## {hour_str}")
    summary.append("")
    
    # Visitor stats
    total_visitors = analytics_data.get('totalVisitors', 0)
    unique_count = len(analytics_data.get('uniqueVisitors', []))
    summary.append(f"**Visitor Stats:**")
    summary.append(f"- Total Visitors: {total_visitors}")
    summary.append(f"- Unique IPs: {unique_count}")
    summary.append("")
    
    # Page views
    page_views = analytics_data.get('pageViews', {})
    if page_views:
        summary.append(f"**Page Views:**")
        for page, count in sorted(page_views.items(), key=lambda x: x[1], reverse=True):
            summary.append(f"- {page}: {count}")
        summary.append("")
    
    # Conversions
    conversions = analytics_data.get('conversions', {})
    demo_logins = conversions.get('demoLogins', 0)
    signup_attempts = conversions.get('signupAttempts', 0)
    feedback = conversions.get('feedbackSubmissions', 0)
    
    summary.append(f"**Conversions:**")
    summary.append(f"- Demo Logins: {demo_logins}")
    summary.append(f"- Signup Attempts: {signup_attempts} {'⚠️ NEW!' if signup_attempts > 0 else ''}")
    summary.append(f"- Feedback Submissions: {feedback}")
    summary.append("")
    
    # Campaign performance
    campaigns = analytics_data.get('campaigns', {})
    if campaigns:
        summary.append(f"**Campaign Performance:**")
        for campaign, data in sorted(campaigns.items()):
            visitors = data.get('visitors', 0)
            conversions = data.get('conversions', 0)
            if visitors > 0:
                conversion_rate = (conversions / visitors) * 100
                summary.append(f"- {campaign}: {visitors} visitors, {conversions} conversions ({conversion_rate:.1f}%)")
        summary.append("")
    
    # Highlight if any signup attempts
    if signup_attempts > 0:
        summary.append(f"**🎉 SIGNUP ATTEMPTS DETECTED! Count: {signup_attempts}**")
        summary.append("")
    
    summary.append("---")
    summary.append("")
    
    return "\n".join(summary)

def update_tracking_file(new_content):
    """Update the tracking file with new content"""
    # Read existing content if file exists
    existing_content = ""
    if os.path.exists(TRACKING_FILE):
        try:
            with open(TRACKING_FILE, 'r') as f:
                existing_content = f.read()
        except:
            pass
    
    # If file doesn't exist or is empty, add header
    if not existing_content:
        header = [
            "# Signup Tracking Report",
            "",
            "This file tracks hourly summaries of visitor activity and signup attempts for the MicroMonitor demo.",
            "",
            "---",
            "",
        ]
        existing_content = "\n".join(header)
    
    # Append new content
    with open(TRACKING_FILE, 'w') as f:
        f.write(existing_content + new_content)

def main():
    """Main tracking function"""
    print("Starting signup tracking...")
    
    # Get current analytics
    analytics = load_analytics()
    if not analytics:
        print("Failed to load analytics data")
        return
    
    # Get current hour
    now = datetime.now()
    hour_str = now.strftime("%Y-%m-%d %H:00")
    
    # Generate summary
    summary = format_hourly_summary(analytics, hour_str)
    
    # Update tracking file
    update_tracking_file(summary)
    
    # Save last check time
    save_last_check_time()
    
    print(f"Tracking update completed for {hour_str}")
    
    # Print key metrics
    conversions = analytics.get('conversions', {})
    print(f"Current stats:")
    print(f"  - Total visitors: {analytics.get('totalVisitors', 0)}")
    print(f"  - Demo logins: {conversions.get('demoLogins', 0)}")
    print(f"  - Signup attempts: {conversions.get('signupAttempts', 0)}")

if __name__ == "__main__":
    main()