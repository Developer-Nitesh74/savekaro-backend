import fs from 'fs/promises';
import path from 'path';

const ANALYTICS_FILE = './analytics.json';

class AnalyticsService {
    constructor() {
        this.data = {
            totalDownloads: 0,
            platformStats: {},
            formatStats: { video: 0, audio: 0 },
            qualityStats: {},
            dailyStats: {},
            errors: 0
        };
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const fileContent = await fs.readFile(ANALYTICS_FILE, 'utf-8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            // File doesn't exist or is invalid, use default data
            await this.save();
        }

        this.initialized = true;
    }

    async save() {
        try {
            await fs.writeFile(ANALYTICS_FILE, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Failed to save analytics:', error);
        }
    }

    async trackDownload(platform, format, quality) {
        if (!this.initialized) await this.initialize();

        // Increment total downloads
        this.data.totalDownloads++;

        // Track platform
        if (!this.data.platformStats[platform]) {
            this.data.platformStats[platform] = 0;
        }
        this.data.platformStats[platform]++;

        // Track format
        this.data.formatStats[format]++;

        // Track quality
        if (!this.data.qualityStats[quality]) {
            this.data.qualityStats[quality] = 0;
        }
        this.data.qualityStats[quality]++;

        // Track daily stats
        const today = new Date().toISOString().split('T')[0];
        if (!this.data.dailyStats[today]) {
            this.data.dailyStats[today] = 0;
        }
        this.data.dailyStats[today]++;

        await this.save();
    }

    async trackError() {
        if (!this.initialized) await this.initialize();

        this.data.errors++;
        await this.save();
    }

    async getStats() {
        if (!this.initialized) await this.initialize();

        return {
            ...this.data,
            successRate: this.data.totalDownloads > 0
                ? ((this.data.totalDownloads / (this.data.totalDownloads + this.data.errors)) * 100).toFixed(2) + '%'
                : '100%'
        };
    }

    async getRecentStats(days = 7) {
        if (!this.initialized) await this.initialize();

        const recentDates = [];
        const today = new Date();

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            recentDates.push({
                date: dateStr,
                downloads: this.data.dailyStats[dateStr] || 0
            });
        }

        return recentDates.reverse();
    }
}

export default new AnalyticsService();
