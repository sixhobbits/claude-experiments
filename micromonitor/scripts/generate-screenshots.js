const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateScreenshots() {
    console.log('Starting screenshot generation...');
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, '../public/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // First, login
        console.log('Logging in...');
        await page.goto('http://localhost:3000/login.html');
        await page.type('#username', 'admin');
        await page.type('#password', 'micromonitor123');
        await page.click('#submitBtn');
        
        // Wait for redirect to dashboard
        await page.waitForNavigation();
        await page.waitForTimeout(3000); // Wait for metrics to load
        
        // Take dashboard screenshot
        console.log('Taking dashboard screenshot...');
        await page.screenshot({
            path: path.join(screenshotsDir, 'dashboard.png'),
            fullPage: false
        });
        
        // Take analytics screenshot
        console.log('Taking analytics screenshot...');
        await page.goto('http://localhost:3000/analytics.html');
        await page.waitForTimeout(2000);
        await page.screenshot({
            path: path.join(screenshotsDir, 'analytics.png'),
            fullPage: false
        });
        
        // Open alert configuration modal and take screenshot
        console.log('Taking alert configuration screenshot...');
        await page.goto('http://localhost:3000/dashboard');
        await page.waitForTimeout(2000);
        await page.click('#configure-alerts-btn');
        await page.waitForTimeout(500);
        await page.screenshot({
            path: path.join(screenshotsDir, 'alerts.png'),
            fullPage: false
        });
        
        console.log('Screenshots generated successfully!');
    } catch (error) {
        console.error('Error generating screenshots:', error);
    } finally {
        await browser.close();
    }
}

// Check if server is running
const http = require('http');
http.get('http://localhost:3000', (res) => {
    generateScreenshots().then(() => process.exit(0)).catch(() => process.exit(1));
}).on('error', () => {
    console.error('MicroMonitor server is not running. Please start it first.');
    process.exit(1);
});