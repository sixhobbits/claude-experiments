#!/usr/bin/env python3
"""
Quick signup check script - shows current conversion stats
"""

import json
from datetime import datetime

# File paths
ANALYTICS_FILE = "/root/claude-experiments/micromonitor/data/analytics.json"

def load_analytics():
    """Load current analytics data"""
    try:
        with open(ANALYTICS_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading analytics: {e}")
        return None

def main():
    """Display current signup stats"""
    analytics = load_analytics()
    if not analytics:
        return
    
    print("\n" + "="*50)
    print(f"SIGNUP TRACKING REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*50 + "\n")
    
    # Basic stats
    total_visitors = analytics.get('totalVisitors', 0)
    unique_count = len(analytics.get('uniqueVisitors', []))
    
    print("VISITOR STATS:")
    print(f"  Total Visitors: {total_visitors}")
    print(f"  Unique IPs: {unique_count}")
    print()
    
    # Conversions
    conversions = analytics.get('conversions', {})
    demo_logins = conversions.get('demoLogins', 0)
    signup_attempts = conversions.get('signupAttempts', 0)
    feedback = conversions.get('feedbackSubmissions', 0)
    
    print("CONVERSION METRICS:")
    print(f"  Demo Logins: {demo_logins}")
    print(f"  Signup Attempts: {signup_attempts}")
    print(f"  Feedback Submissions: {feedback}")
    print()
    
    # Conversion rates
    if total_visitors > 0:
        demo_rate = (demo_logins / total_visitors) * 100
        signup_rate = (signup_attempts / total_visitors) * 100
        
        print("CONVERSION RATES:")
        print(f"  Demo Login Rate: {demo_rate:.2f}%")
        print(f"  Signup Attempt Rate: {signup_rate:.2f}%")
        print()
    
    # Campaign breakdown
    campaigns = analytics.get('campaigns', {})
    print("CAMPAIGN PERFORMANCE:")
    for campaign, data in sorted(campaigns.items()):
        visitors = data.get('visitors', 0)
        conversions = data.get('conversions', 0)
        if visitors > 0:
            rate = (conversions / visitors) * 100
            print(f"  {campaign}: {visitors} visitors, {conversions} conversions ({rate:.1f}%)")
    print()
    
    # Alert if signup attempts detected
    if signup_attempts > 0:
        print("🎉 " + "!"*40)
        print(f"🎉 SIGNUP ATTEMPTS DETECTED: {signup_attempts}")
        print("🎉 " + "!"*40)
        print()
    
    # Last update
    last_updated = analytics.get('lastUpdated', 'Unknown')
    print(f"Last Updated: {last_updated}")
    print("="*50 + "\n")

if __name__ == "__main__":
    main()