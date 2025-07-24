#!/usr/bin/env python3
"""
MicroMonitor Analytics Tracker
Tracks daily visitor counts, login attempts, API usage, and demo account activity
"""

import json
import re
import os
import datetime
import gzip
from collections import defaultdict, Counter
from pathlib import Path
import subprocess

class MicroMonitorAnalytics:
    def __init__(self):
        self.analytics_dir = Path(__file__).parent
        self.data_dir = self.analytics_dir / "data"
        self.data_dir.mkdir(exist_ok=True)
        
        self.micromonitor_dir = self.analytics_dir.parent
        self.users_file = self.micromonitor_dir / "data" / "users.json"
        
        # Analytics data file
        self.analytics_file = self.data_dir / "analytics_history.json"
        self.daily_report_file = self.data_dir / "daily_report.md"
        
        # Load historical data
        self.historical_data = self.load_historical_data()
        
    def load_historical_data(self):
        """Load historical analytics data"""
        if self.analytics_file.exists():
            with open(self.analytics_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_historical_data(self):
        """Save historical analytics data"""
        with open(self.analytics_file, 'w') as f:
            json.dump(self.historical_data, f, indent=2, default=str)
    
    def parse_nginx_logs(self, date=None):
        """Parse nginx access logs for the specified date"""
        if date is None:
            date = datetime.date.today()
        
        log_data = {
            'visitors': set(),
            'requests': [],
            'api_calls': defaultdict(int),
            'login_attempts': 0,
            'demo_activity': 0,
            'page_views': defaultdict(int),
            'status_codes': Counter(),
            'user_agents': Counter()
        }
        
        # Check today's log
        access_log = "/var/log/nginx/access.log"
        if os.path.exists(access_log):
            self._parse_log_file(access_log, date, log_data)
        
        # Check rotated logs for the date
        for i in range(1, 12):
            if i == 1:
                log_file = f"/var/log/nginx/access.log.{i}"
            else:
                log_file = f"/var/log/nginx/access.log.{i}.gz"
            
            if os.path.exists(log_file):
                # Check if this log contains our date
                if self._log_contains_date(log_file, date):
                    self._parse_log_file(log_file, date, log_data)
        
        return log_data
    
    def _log_contains_date(self, log_file, target_date):
        """Check if a log file contains entries for the target date"""
        date_pattern = target_date.strftime("%d/%b/%Y")
        
        if log_file.endswith('.gz'):
            with gzip.open(log_file, 'rt') as f:
                for line in f:
                    if date_pattern in line:
                        return True
        else:
            with open(log_file, 'r') as f:
                for line in f:
                    if date_pattern in line:
                        return True
        return False
    
    def _parse_log_file(self, log_file, target_date, log_data):
        """Parse a single log file for analytics data"""
        # Nginx log format: IP - - [timestamp] "METHOD PATH HTTP/1.1" status size "referer" "user-agent"
        log_pattern = re.compile(
            r'(\d+\.\d+\.\d+\.\d+) - - \[([^\]]+)\] "(\w+) ([^\s]+) [^"]+" (\d+) \d+ "[^"]*" "([^"]*)"'
        )
        
        date_str = target_date.strftime("%d/%b/%Y")
        
        if log_file.endswith('.gz'):
            file_handle = gzip.open(log_file, 'rt')
        else:
            file_handle = open(log_file, 'r')
        
        try:
            for line in file_handle:
                if date_str not in line:
                    continue
                
                match = log_pattern.match(line)
                if match:
                    ip, timestamp, method, path, status_code, user_agent = match.groups()
                    
                    # Track unique visitors by IP
                    log_data['visitors'].add(ip)
                    
                    # Track status codes
                    log_data['status_codes'][status_code] += 1
                    
                    # Track user agents
                    log_data['user_agents'][user_agent] += 1
                    
                    # Track API calls
                    if path.startswith('/api/'):
                        api_endpoint = path.split('?')[0]  # Remove query params
                        log_data['api_calls'][api_endpoint] += 1
                        
                        # Track login attempts
                        if path == '/api/auth/login':
                            log_data['login_attempts'] += 1
                            
                            # Check if it's demo account
                            if 'demo' in line.lower():
                                log_data['demo_activity'] += 1
                    
                    # Track page views
                    elif path.endswith('.html') or path == '/':
                        log_data['page_views'][path] += 1
                    
                    # Store request details
                    log_data['requests'].append({
                        'ip': ip,
                        'timestamp': timestamp,
                        'method': method,
                        'path': path,
                        'status': status_code,
                        'user_agent': user_agent
                    })
        finally:
            file_handle.close()
    
    def analyze_user_activity(self, date=None):
        """Analyze user database for activity"""
        if date is None:
            date = datetime.date.today()
        
        user_stats = {
            'total_users': 0,
            'admin_users': 0,
            'viewer_users': 0,
            'demo_exists': False,
            'new_users_today': 0
        }
        
        if self.users_file.exists():
            with open(self.users_file, 'r') as f:
                users = json.load(f)
                
            user_stats['total_users'] = len(users)
            
            for username, user_data in users.items():
                if user_data.get('role') == 'admin':
                    user_stats['admin_users'] += 1
                elif user_data.get('role') == 'viewer':
                    user_stats['viewer_users'] += 1
                
                if username == 'demo':
                    user_stats['demo_exists'] = True
                
                # Check if user was created today
                created_at = user_data.get('createdAt', '')
                if created_at and date.isoformat() in created_at:
                    user_stats['new_users_today'] += 1
        
        return user_stats
    
    def get_api_key_usage(self):
        """Analyze API key usage from logs"""
        # This would require parsing logs for API key headers
        # For now, we'll track general API usage
        return {
            'api_keys_used': 0,  # Would need to parse X-API-Key headers
            'authenticated_requests': 0,
            'unauthenticated_requests': 0
        }
    
    def generate_analytics(self, date=None):
        """Generate complete analytics for the specified date"""
        if date is None:
            date = datetime.date.today()
        
        print(f"Generating analytics for {date}")
        
        # Parse nginx logs
        log_data = self.parse_nginx_logs(date)
        
        # Analyze user activity
        user_stats = self.analyze_user_activity(date)
        
        # Compile analytics
        analytics = {
            'date': date.isoformat(),
            'timestamp': datetime.datetime.now().isoformat(),
            'visitors': {
                'unique_count': len(log_data['visitors']),
                'unique_ips': list(log_data['visitors']),
                'total_requests': len(log_data['requests'])
            },
            'login_attempts': {
                'total': log_data['login_attempts'],
                'demo_account': log_data['demo_activity']
            },
            'api_usage': {
                'endpoints': dict(log_data['api_calls']),
                'total_calls': sum(log_data['api_calls'].values()),
                'top_endpoints': dict(Counter(log_data['api_calls']).most_common(10))
            },
            'page_views': dict(log_data['page_views']),
            'status_codes': dict(log_data['status_codes']),
            'user_stats': user_stats,
            'top_user_agents': dict(log_data['user_agents'].most_common(5))
        }
        
        # Store in historical data
        date_key = date.isoformat()
        if date_key not in self.historical_data:
            self.historical_data[date_key] = []
        self.historical_data[date_key].append(analytics)
        
        # Save historical data
        self.save_historical_data()
        
        return analytics
    
    def generate_trend_analysis(self, days=7):
        """Generate trend analysis for the past N days"""
        trends = {
            'daily_visitors': {},
            'daily_api_calls': {},
            'daily_logins': {},
            'daily_demo_activity': {}
        }
        
        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=days-1)
        
        current_date = start_date
        while current_date <= end_date:
            date_key = current_date.isoformat()
            
            if date_key in self.historical_data and self.historical_data[date_key]:
                # Get the latest analytics for this date
                latest = self.historical_data[date_key][-1]
                
                trends['daily_visitors'][date_key] = latest['visitors']['unique_count']
                trends['daily_api_calls'][date_key] = latest['api_usage']['total_calls']
                trends['daily_logins'][date_key] = latest['login_attempts']['total']
                trends['daily_demo_activity'][date_key] = latest['login_attempts']['demo_account']
            else:
                # No data for this date
                trends['daily_visitors'][date_key] = 0
                trends['daily_api_calls'][date_key] = 0
                trends['daily_logins'][date_key] = 0
                trends['daily_demo_activity'][date_key] = 0
            
            current_date += datetime.timedelta(days=1)
        
        return trends
    
    def generate_markdown_report(self, analytics, trends=None):
        """Generate a markdown report from analytics data"""
        report = []
        
        # Header
        report.append("# MicroMonitor Analytics Report")
        report.append(f"\n**Generated:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Report Date:** {analytics['date']}\n")
        
        # Executive Summary
        report.append("## Executive Summary")
        report.append(f"- **Unique Visitors:** {analytics['visitors']['unique_count']}")
        report.append(f"- **Total Requests:** {analytics['visitors']['total_requests']}")
        report.append(f"- **API Calls:** {analytics['api_usage']['total_calls']}")
        report.append(f"- **Login Attempts:** {analytics['login_attempts']['total']}")
        report.append(f"- **Demo Account Activity:** {analytics['login_attempts']['demo_account']}\n")
        
        # Visitor Analytics
        report.append("## Visitor Analytics")
        report.append(f"### Unique Visitors: {analytics['visitors']['unique_count']}")
        if analytics['visitors']['unique_count'] > 0:
            report.append("\n**Sample IPs (first 10):**")
            for ip in list(analytics['visitors']['unique_ips'])[:10]:
                report.append(f"- {ip}")
        report.append("")
        
        # API Usage
        report.append("## API Usage")
        report.append(f"### Total API Calls: {analytics['api_usage']['total_calls']}")
        if analytics['api_usage']['top_endpoints']:
            report.append("\n**Top Endpoints:**")
            for endpoint, count in analytics['api_usage']['top_endpoints'].items():
                report.append(f"- `{endpoint}`: {count} calls")
        report.append("")
        
        # Page Views
        if analytics['page_views']:
            report.append("## Page Views")
            for page, count in sorted(analytics['page_views'].items(), key=lambda x: x[1], reverse=True):
                report.append(f"- `{page}`: {count} views")
            report.append("")
        
        # Status Codes
        if analytics['status_codes']:
            report.append("## HTTP Status Codes")
            for status, count in sorted(analytics['status_codes'].items()):
                report.append(f"- `{status}`: {count} responses")
            report.append("")
        
        # User Statistics
        report.append("## User Statistics")
        user_stats = analytics['user_stats']
        report.append(f"- **Total Users:** {user_stats['total_users']}")
        report.append(f"- **Admin Users:** {user_stats['admin_users']}")
        report.append(f"- **Viewer Users:** {user_stats['viewer_users']}")
        report.append(f"- **Demo Account Exists:** {'Yes' if user_stats['demo_exists'] else 'No'}")
        report.append(f"- **New Users Today:** {user_stats['new_users_today']}\n")
        
        # User Agents
        if analytics['top_user_agents']:
            report.append("## Top User Agents")
            for ua, count in analytics['top_user_agents'].items():
                ua_short = ua[:80] + "..." if len(ua) > 80 else ua
                report.append(f"- {ua_short}: {count}")
            report.append("")
        
        # Trends (if provided)
        if trends:
            report.append("## 7-Day Trends")
            
            # Visitor trend
            report.append("\n### Daily Unique Visitors")
            for date, count in trends['daily_visitors'].items():
                report.append(f"- {date}: {count}")
            
            # API call trend
            report.append("\n### Daily API Calls")
            for date, count in trends['daily_api_calls'].items():
                report.append(f"- {date}: {count}")
            
            # Login trend
            report.append("\n### Daily Login Attempts")
            for date, count in trends['daily_logins'].items():
                report.append(f"- {date}: {count}")
            
            # Demo activity trend
            report.append("\n### Daily Demo Account Activity")
            for date, count in trends['daily_demo_activity'].items():
                report.append(f"- {date}: {count}")
            report.append("")
        
        # Footer
        report.append("\n---")
        report.append("*This report was automatically generated by MicroMonitor Analytics*")
        
        return "\n".join(report)
    
    def run_daily_analytics(self):
        """Run daily analytics and generate report"""
        # Generate analytics for today
        analytics = self.generate_analytics()
        
        # Generate trend analysis
        trends = self.generate_trend_analysis()
        
        # Generate markdown report
        report = self.generate_markdown_report(analytics, trends)
        
        # Save report
        with open(self.daily_report_file, 'w') as f:
            f.write(report)
        
        print(f"Analytics report saved to: {self.daily_report_file}")
        
        # Also save a timestamped copy
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        archived_report = self.data_dir / f"report_{timestamp}.md"
        with open(archived_report, 'w') as f:
            f.write(report)
        
        return analytics, report


if __name__ == "__main__":
    # Run analytics
    analyzer = MicroMonitorAnalytics()
    analytics, report = analyzer.run_daily_analytics()
    
    # Print summary
    print("\n=== Analytics Summary ===")
    print(f"Unique Visitors: {analytics['visitors']['unique_count']}")
    print(f"Total API Calls: {analytics['api_usage']['total_calls']}")
    print(f"Login Attempts: {analytics['login_attempts']['total']}")
    print(f"Demo Account Activity: {analytics['login_attempts']['demo_account']}")
    
    print(f"\nFull report available at: {analyzer.daily_report_file}")