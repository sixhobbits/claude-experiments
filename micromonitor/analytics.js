const fs = require('fs');
const path = require('path');

const ANALYTICS_FILE = path.join(__dirname, 'data', 'analytics.json');

// Initialize analytics file if it doesn't exist
function initAnalytics() {
    if (!fs.existsSync(ANALYTICS_FILE)) {
        const initialData = {
            startTime: new Date().toISOString(),
            totalVisitors: 0,
            uniqueVisitors: new Set(),
            pageViews: {},
            referrers: {},
            userAgents: {},
            campaigns: {
                hackernews: { visitors: 0, conversions: 0 },
                reddit: { visitors: 0, conversions: 0 },
                twitter: { visitors: 0, conversions: 0 },
                linkedin: { visitors: 0, conversions: 0 },
                direct: { visitors: 0, conversions: 0 }
            },
            conversions: {
                demoLogins: 0,
                signupAttempts: 0,
                feedbackSubmissions: 0
            },
            lastUpdated: new Date().toISOString()
        };
        saveAnalytics(initialData);
    }
}

// Load analytics data
function loadAnalytics() {
    try {
        const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
        const analytics = JSON.parse(data);
        // Convert uniqueVisitors array back to Set
        analytics.uniqueVisitors = new Set(analytics.uniqueVisitors || []);
        return analytics;
    } catch (error) {
        initAnalytics();
        return loadAnalytics();
    }
}

// Save analytics data
function saveAnalytics(analytics) {
    const dataToSave = {
        ...analytics,
        uniqueVisitors: Array.from(analytics.uniqueVisitors || []),
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(dataToSave, null, 2));
}

// Track page view
function trackPageView(req, page) {
    const analytics = loadAnalytics();
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const referrer = req.headers['referer'] || 'direct';
    
    // Track unique visitor
    analytics.uniqueVisitors.add(ip);
    analytics.totalVisitors++;
    
    // Track page views
    analytics.pageViews[page] = (analytics.pageViews[page] || 0) + 1;
    
    // Track referrer
    const campaign = detectCampaign(referrer, req.query);
    if (campaign) {
        analytics.campaigns[campaign].visitors++;
    }
    
    // Track user agent
    const browserType = detectBrowser(userAgent);
    analytics.userAgents[browserType] = (analytics.userAgents[browserType] || 0) + 1;
    
    saveAnalytics(analytics);
}

// Detect campaign source
function detectCampaign(referrer, query) {
    if (query.ref) return query.ref;
    if (referrer.includes('news.ycombinator.com')) return 'hackernews';
    if (referrer.includes('reddit.com')) return 'reddit';
    if (referrer.includes('twitter.com') || referrer.includes('x.com')) return 'twitter';
    if (referrer.includes('linkedin.com')) return 'linkedin';
    if (referrer === 'direct' || !referrer) return 'direct';
    return 'other';
}

// Detect browser type
function detectBrowser(userAgent) {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
}

// Track conversion event
function trackConversion(type, campaign = 'direct') {
    const analytics = loadAnalytics();
    
    if (analytics.conversions[type] !== undefined) {
        analytics.conversions[type]++;
    }
    
    if (analytics.campaigns[campaign]) {
        analytics.campaigns[campaign].conversions++;
    }
    
    saveAnalytics(analytics);
}

// Get analytics summary
function getAnalyticsSummary() {
    const analytics = loadAnalytics();
    return {
        uniqueVisitors: analytics.uniqueVisitors.size,
        totalPageViews: Object.values(analytics.pageViews).reduce((a, b) => a + b, 0),
        topPages: Object.entries(analytics.pageViews)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5),
        campaigns: analytics.campaigns,
        conversions: analytics.conversions,
        lastUpdated: analytics.lastUpdated
    };
}

// Initialize on module load
initAnalytics();

module.exports = {
    trackPageView,
    trackConversion,
    getAnalyticsSummary
};