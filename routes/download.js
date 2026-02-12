import express from 'express';
import downloadService from '../services/downloadService.js';
import analyticsService from '../services/analyticsService.js';
import {
    validateDownloadRequest,
    validateInfoRequest,
    handleValidationErrors,
    sanitizeUrl
} from '../utils/validator.js';
import fs from 'fs';

const router = express.Router();

// Get video/audio information
router.post('/info', validateInfoRequest, handleValidationErrors, async (req, res) => {
    try {
        const { url } = req.body;
        const sanitizedUrl = sanitizeUrl(url);

        console.log(`📋 Fetching info for: ${sanitizedUrl}`);

        const info = await downloadService.getVideoInfo(sanitizedUrl);

        res.json(info);
    } catch (error) {
        console.error('Info endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch video information'
        });
    }
});

// Start download
router.post('/start', validateDownloadRequest, handleValidationErrors, async (req, res) => {
    try {
        const { url, format = 'video', quality = '1080' } = req.body;
        const sanitizedUrl = sanitizeUrl(url);

        console.log(`🚀 Download request: ${sanitizedUrl}`);

        // Download the media
        const result = await downloadService.downloadMedia(sanitizedUrl, format, quality);

        // Set headers for file download
        res.setHeader('Content-Type', format === 'video' ? 'video/mp4' : 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', result.filesize);
        res.setHeader('X-File-Title', encodeURIComponent(result.title));
        res.setHeader('X-Platform', result.platform);
        res.setHeader('X-Download-Id', result.downloadId);

        // Stream the file
        const fileStream = fs.createReadStream(result.filepath);

        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to stream file'
                });
            }
        });

        fileStream.on('end', async () => {
            // Auto-delete file after streaming if enabled
            if (process.env.AUTO_DELETE_FILES === 'true') {
                await downloadService.cleanup(result.filepath);
            }
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('Download endpoint error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || 'Download failed'
            });
        }
    }
});

// Get analytics stats (optional admin endpoint)
router.get('/analytics', async (req, res) => {
    try {
        const stats = await analyticsService.getStats();
        const recentStats = await analyticsService.getRecentStats(7);

        res.json({
            success: true,
            stats: stats,
            recentActivity: recentStats
        });
    } catch (error) {
        console.error('Analytics endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics'
        });
    }
});

// Start async download (returns downloadId immediately)
router.post('/start-async', validateDownloadRequest, handleValidationErrors, async (req, res) => {
    try {
        const { url, format = 'video', quality = '1080' } = req.body;
        const sanitizedUrl = sanitizeUrl(url);

        console.log(`🚀 Async download request: ${sanitizedUrl}`);

        // Start download asynchronously
        const result = await downloadService.startAsyncDownload(sanitizedUrl, format, quality);

        res.json({
            success: true,
            downloadId: result.downloadId,
            message: 'Download started'
        });
    } catch (error) {
        console.error('Async download start error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start download'
        });
    }
});

// Get download progress
router.get('/progress/:downloadId', (req, res) => {
    try {
        const { downloadId } = req.params;
        const progress = downloadService.getProgress(downloadId);
        console.log(`📊 Progress request for ${downloadId}:`, progress);
        res.json(progress);
    } catch (error) {
        console.error('Progress endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get progress'
        });
    }
});

// Cancel download
router.post('/cancel', async (req, res) => {
    try {
        const { downloadId } = req.body;
        if (!downloadId) {
            return res.status(400).json({ success: false, error: 'Download ID required' });
        }

        await downloadService.cancelDownload(downloadId);

        res.json({
            success: true,
            message: 'Download cancelled'
        });
    } catch (error) {
        console.error('Cancel error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get completed download file
router.get('/file/:downloadId', async (req, res) => {
    try {
        const { downloadId } = req.params;
        const progress = downloadService.getProgress(downloadId);

        if (!progress || progress.status !== 'completed') {
            return res.status(404).json({
                success: false,
                error: 'File not ready or not found'
            });
        }

        const { filepath, filename, filesize } = progress;

        // Stream the file
        res.setHeader('Content-Type', filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', filesize);

        const fileStream = fs.createReadStream(filepath);
        fileStream.pipe(res);

        fileStream.on('end', async () => {
            // Clean up after download
            downloadService.clearProgress(downloadId);
            if (process.env.AUTO_DELETE_FILES === 'true') {
                await downloadService.cleanup(filepath);
            }
        });

        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Failed to stream file'
                });
            }
        });
    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to download file'
        });
    }
});

// Get supported platforms
router.get('/platforms', async (req, res) => {
    const { SUPPORTED_PLATFORMS } = await import('../config/platforms.js');

    const platforms = Object.entries(SUPPORTED_PLATFORMS).map(([key, value]) => ({
        id: key,
        name: value.name,
        icon: value.icon,
        domains: value.domains
    }));

    res.json({
        success: true,
        platforms: platforms
    });
});

export default router;
