const fs = require('fs').promises;
const path = require('path');

const FEEDBACK_FILE = path.join(__dirname, '../data/feedback/feedback.json');

class FeedbackManager {
    async loadFeedback() {
        try {
            const data = await fs.readFile(FEEDBACK_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading feedback:', error);
            return [];
        }
    }

    async saveFeedback(feedbackData) {
        try {
            const feedback = await this.loadFeedback();
            feedback.push(feedbackData);
            await fs.writeFile(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving feedback:', error);
            return false;
        }
    }

    async submitFeedback(data) {
        const feedback = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            email: data.email || '',
            type: data.type || 'other',
            message: data.message || '',
            url: data.url || '',
            userAgent: data.userAgent || '',
            createdAt: new Date().toISOString()
        };

        const success = await this.saveFeedback(feedback);
        return { success, feedback };
    }

    async getFeedback(limit = 50) {
        const feedback = await this.loadFeedback();
        return feedback.slice(-limit).reverse();
    }

    async getFeedbackStats() {
        const feedback = await this.loadFeedback();
        const stats = {
            total: feedback.length,
            byType: {
                bug: 0,
                feature: 0,
                other: 0
            },
            last24Hours: 0,
            last7Days: 0
        };

        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        feedback.forEach(item => {
            if (item.type in stats.byType) {
                stats.byType[item.type]++;
            }
            
            const itemTime = new Date(item.timestamp).getTime();
            if (itemTime > oneDayAgo) {
                stats.last24Hours++;
            }
            if (itemTime > sevenDaysAgo) {
                stats.last7Days++;
            }
        });

        return stats;
    }
}

module.exports = new FeedbackManager();