const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class WebhookManager {
    constructor() {
        this.webhooks = [];
        this.webhookHistoryFile = path.join(__dirname, 'data', 'webhook_history.json');
        this.maxHistoryEntries = 100;
        this.loadWebhooks();
        this.loadHistory();
    }

    async loadWebhooks() {
        try {
            const configPath = path.join(__dirname, 'data', 'config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            this.webhooks = config.webhooks || [];
        } catch (error) {
            console.error('Error loading webhooks:', error);
            this.webhooks = [];
        }
    }

    async loadHistory() {
        try {
            const historyData = await fs.readFile(this.webhookHistoryFile, 'utf8');
            this.history = JSON.parse(historyData);
        } catch (error) {
            this.history = [];
        }
    }

    async saveHistory() {
        try {
            // Keep only the most recent entries
            if (this.history.length > this.maxHistoryEntries) {
                this.history = this.history.slice(-this.maxHistoryEntries);
            }
            await fs.writeFile(this.webhookHistoryFile, JSON.stringify(this.history, null, 2));
        } catch (error) {
            console.error('Error saving webhook history:', error);
        }
    }

    async sendWebhook(webhook, event, data) {
        const payload = {
            timestamp: new Date().toISOString(),
            event: event,
            source: 'MicroMonitor',
            data: data
        };

        const historyEntry = {
            timestamp: payload.timestamp,
            url: webhook.url,
            name: webhook.name,
            event: event,
            status: null,
            response: null,
            error: null
        };

        try {
            const response = await axios.post(webhook.url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    ...webhook.headers
                },
                timeout: 10000 // 10 second timeout
            });

            historyEntry.status = response.status;
            historyEntry.response = response.statusText;
            console.log(`Webhook sent successfully to ${webhook.name}: ${response.status}`);
            
            return { success: true, status: response.status };
        } catch (error) {
            historyEntry.status = error.response?.status || 0;
            historyEntry.error = error.message;
            console.error(`Webhook failed for ${webhook.name}:`, error.message);
            
            return { success: false, error: error.message };
        } finally {
            this.history.push(historyEntry);
            await this.saveHistory();
        }
    }

    async triggerWebhooks(event, data) {
        await this.loadWebhooks(); // Reload webhooks to get latest config
        
        const activeWebhooks = this.webhooks.filter(w => w.enabled && w.events.includes(event));
        
        if (activeWebhooks.length === 0) {
            return;
        }

        console.log(`Triggering ${activeWebhooks.length} webhooks for event: ${event}`);
        
        const results = await Promise.allSettled(
            activeWebhooks.map(webhook => this.sendWebhook(webhook, event, data))
        );

        return results;
    }

    async getHistory(limit = 50) {
        await this.loadHistory();
        return this.history.slice(-limit).reverse();
    }

    async testWebhook(webhook) {
        const testData = {
            test: true,
            message: 'This is a test webhook from MicroMonitor'
        };
        
        return await this.sendWebhook(webhook, 'test', testData);
    }
}

module.exports = WebhookManager;