import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sanitize from 'sanitize-filename';
import { detectPlatform, getPlatformInfo } from '../config/platforms.js';
import analyticsService from './analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TEMP_DIR = process.env.TEMP_DIR || './temp';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 524288000; // 500MB default

class DownloadService {
    constructor() {
        this.ytdlpPath = null;
        this.initialized = false;
        this.progressMap = new Map(); // Store progress for each download
        this.activeProcesses = new Map(); // Store active child processes for cancellation
    }

    getYtdlpPath() {
        // Check for local binary first (for Render deployment)
        const localBinary = path.join(PROJECT_ROOT, 'yt-dlp');
        return localBinary;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Create temp directory if it doesn't exist
            await fs.mkdir(TEMP_DIR, { recursive: true });

            const ytdlpPath = this.getYtdlpPath();

            // Check if yt-dlp binary exists and is executable
            await new Promise((resolve, reject) => {
                const proc = spawn(ytdlpPath, ['--version']);
                let version = '';
                proc.stdout.on('data', (data) => { version += data.toString(); });
                proc.on('close', (code) => {
                    if (code === 0) {
                        console.log(`📦 yt-dlp version: ${version.trim()}`);
                        resolve();
                    } else {
                        reject(new Error('yt-dlp binary not found or not executable'));
                    }
                });
                proc.on('error', () => reject(new Error('yt-dlp binary not found at: ' + ytdlpPath)));
            });

            this.initialized = true;
            console.log('✅ Download service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize download service:', error);
            console.error('Make sure yt-dlp binary exists in project root');
            throw error;
        }
    }

    async getVideoInfo(url) {
        if (!this.initialized) await this.initialize();

        try {
            const platform = detectPlatform(url);
            const platformInfo = getPlatformInfo(platform);

            // Get video metadata using yt-dlp with spawn
            const ytdlpPath = this.getYtdlpPath();
            const metadata = await new Promise((resolve, reject) => {
                const process = spawn(ytdlpPath, ['--dump-json', '--no-warnings', url]);

                let stdout = '';
                let stderr = '';

                process.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                process.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                process.on('close', (code) => {
                    if (code === 0) {
                        try {
                            resolve(JSON.parse(stdout));
                        } catch (e) {
                            reject(new Error(`Failed to parse JSON: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
                    }
                });

                process.on('error', (error) => {
                    reject(error);
                });
            });

            // Extract relevant information
            const info = {
                success: true,
                platform: platform,
                platformName: platformInfo?.name || 'Unknown',
                title: metadata.title || 'Untitled',
                thumbnail: metadata.thumbnail || metadata.thumbnails?.[0]?.url || null,
                duration: metadata.duration || 0,
                uploader: metadata.uploader || metadata.channel || 'Unknown',
                uploadDate: metadata.upload_date || null,
                viewCount: metadata.view_count || 0,
                description: metadata.description?.substring(0, 200) || '',
                availableFormats: {
                    video: platformInfo?.formats.video || ['mp4'],
                    audio: platformInfo?.formats.audio || ['mp3']
                },
                availableQualities: {
                    video: this.extractAvailableQualities(metadata.formats, 'video'),
                    audio: this.extractAvailableQualities(metadata.formats, 'audio')
                }
            };

            return info;
        } catch (error) {
            console.error('Error getting video info:', error);
            await analyticsService.trackError();
            throw new Error(`Failed to fetch video information: ${error.message}`);
        }
    }

    extractAvailableQualities(formats, type) {
        if (!formats || !Array.isArray(formats)) return [];

        const qualities = new Set();

        formats.forEach(format => {
            if (type === 'video' && format.height) {
                qualities.add(format.height.toString());
            } else if (type === 'audio' && format.abr) {
                qualities.add(Math.round(format.abr).toString());
            }
        });

        return Array.from(qualities).sort((a, b) => parseInt(b) - parseInt(a));
    }

    async downloadMedia(url, format = 'video', quality = '1080', downloadId = null) {
        if (!this.initialized) await this.initialize();

        // Generate download ID for progress tracking if not provided
        if (!downloadId) {
            downloadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.progressMap.set(downloadId, { progress: 0, status: 'starting' });
        }

        try {
            const platform = detectPlatform(url);
            const videoInfo = await this.getVideoInfo(url);

            // Generate safe filename - remove all special characters and emojis
            let safeTitle = sanitize(videoInfo.title.substring(0, 50));
            // Remove emojis and Unicode characters - only keep alphanumeric, spaces, hyphens, underscores
            safeTitle = safeTitle.replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII
            safeTitle = safeTitle.replace(/[&<>:"\/\\|?*]/g, ''); // Remove special chars
            safeTitle = safeTitle.replace(/\s+/g, '_'); // Replace spaces with underscores
            safeTitle = safeTitle.replace(/_+/g, '_'); // Replace multiple underscores with single
            safeTitle = safeTitle.replace(/^_|_$/g, ''); // Remove leading/trailing underscores

            // Fallback if title becomes empty
            if (!safeTitle || safeTitle.length === 0) {
                safeTitle = 'download';
            }

            const timestamp = Date.now();
            const absoluteTempDir = path.resolve(TEMP_DIR);

            let filename, outputPath;
            if (format === 'audio') {
                // For audio, let yt-dlp add extension via template
                const baseFilename = `${safeTitle}_${timestamp}`;
                outputPath = path.join(absoluteTempDir, `${baseFilename}.%(ext)s`);
                filename = baseFilename; // Will find actual file after download
            } else {
                // For video, use mp4 extension
                filename = `${safeTitle}_${timestamp}.mp4`;
                outputPath = path.join(absoluteTempDir, filename);
            }

            // Build yt-dlp command arguments as array (no quoting needed with spawn)
            const options = this.buildDownloadOptions(format, quality, outputPath);
            const ytdlpPath = this.getYtdlpPath();
            const args = [url, ...options];

            console.log(`📥 Starting download: ${videoInfo.title}`);
            console.log(`   Platform: ${videoInfo.platformName}`);
            console.log(`   Format: ${format}, Quality: ${quality}`);
            console.log(`   Output: ${outputPath}`);
            console.log(`   DownloadId: ${downloadId}`);

            // Initialize progress immediately so polling can start
            this.progressMap.set(downloadId, { progress: 0, status: 'starting', downloadId });

            // Execute download using spawn (handles paths with spaces properly)
            await new Promise((resolve, reject) => {
                const process = spawn(ytdlpPath, args);

                // Store active process
                this.activeProcesses.set(downloadId, { process, outputPath });

                let stderr = '';

                // Parse stdout for progress
                process.stdout.on('data', (data) => {
                    const output = data.toString();
                    // Look for download progress pattern: [download]  45.2% of 10.5MiB
                    const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
                    if (progressMatch) {
                        const progress = parseFloat(progressMatch[1]);
                        this.progressMap.set(downloadId, { progress, status: 'downloading', downloadId });
                        console.log(`📊 Progress: ${progress}%`);
                    }
                });

                process.stderr.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;

                    // Also parse stderr for progress (yt-dlp outputs to stderr)
                    const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
                    if (progressMatch) {
                        const progress = parseFloat(progressMatch[1]);
                        this.progressMap.set(downloadId, { progress, status: 'downloading', downloadId });
                        console.log(`📊 Progress: ${progress}%`);
                    }
                });

                process.on('close', (code) => {
                    this.activeProcesses.delete(downloadId);
                    if (code === 0) {
                        this.progressMap.set(downloadId, { progress: 100, status: 'completed', downloadId });
                        resolve();
                    } else {
                        // Check if it was manually cancelled
                        const progress = this.progressMap.get(downloadId);
                        if (progress && progress.status === 'cancelled') {
                            reject(new Error('Download cancelled'));
                        } else {
                            this.progressMap.set(downloadId, { progress: 0, status: 'error', downloadId });
                            reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
                        }
                    }
                });

                process.on('error', (error) => {
                    this.activeProcesses.delete(downloadId);
                    reject(error);
                });
            });

            // For audio, find the actual downloaded file with extension
            if (format === 'audio') {
                const files = await fs.readdir(absoluteTempDir);
                const baseFilename = `${safeTitle}_${timestamp}`;
                const downloadedFile = files.find(f => f.startsWith(baseFilename));
                if (!downloadedFile) {
                    throw new Error('Downloaded audio file not found');
                }
                filename = downloadedFile;
                outputPath = path.join(absoluteTempDir, filename);
            }

            // Check file size
            const stats = await fs.stat(outputPath);
            if (stats.size > MAX_FILE_SIZE) {
                await fs.unlink(outputPath);
                throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
            }

            // Track analytics
            await analyticsService.trackDownload(platform, format, quality);

            console.log(`✅ Download completed: ${filename}`);

            return {
                success: true,
                downloadId: downloadId,
                filename: filename,
                filepath: outputPath,
                filesize: stats.size,
                title: videoInfo.title,
                platform: videoInfo.platformName
            };
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }

    // Start download asynchronously and return downloadId immediately
    async startAsyncDownload(url, format = 'video', quality = '1080') {
        const downloadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize progress
        this.progressMap.set(downloadId, {
            progress: 0,
            status: 'starting',
            downloadId,
            filepath: null,
            filename: null
        });

        // Start download in background (don't await)
        this.downloadMedia(url, format, quality, downloadId).then(result => {
            // Update progress map with completed file info
            this.progressMap.set(downloadId, {
                progress: 100,
                status: 'completed',
                downloadId,
                filepath: result.filepath,
                filename: result.filename,
                filesize: result.filesize
            });
        }).catch(error => {
            this.progressMap.set(downloadId, {
                progress: 0,
                status: 'error',
                downloadId,
                error: error.message
            });
        });

        // Return downloadId immediately
        return { downloadId };
    }

    getProgress(downloadId) {
        return this.progressMap.get(downloadId) || { progress: 0, status: 'not_found' };
    }

    clearProgress(downloadId) {
        this.progressMap.delete(downloadId);
        this.activeProcesses.delete(downloadId);
    }

    async cancelDownload(downloadId) {
        // Update status first
        const progress = this.progressMap.get(downloadId);
        if (progress) {
            this.progressMap.set(downloadId, { ...progress, status: 'cancelled' });
        } else {
            this.progressMap.set(downloadId, { progress: 0, status: 'cancelled', downloadId });
        }

        // Kill active process if exists
        const active = this.activeProcesses.get(downloadId);
        if (active) {
            console.log(`🛑 Cancelling download ${downloadId}`);
            try {
                active.process.kill(); // Send SIGTERM

                // Active process will be removed in 'close' event handler

                // Attempt cleanup of partial file
                if (active.outputPath) {
                    // Slight delay to allow file handle release
                    setTimeout(() => this.cleanup(active.outputPath), 500);
                }
            } catch (err) {
                console.error('Error killing process:', err);
            }
            return true;
        }
        return false;
    }

    buildDownloadOptions(format, quality, outputPath) {
        // Don't quote here - quoting is handled in command builder
        const options = ['-o', outputPath];

        if (format === 'audio') {
            // Download audio-only format directly (no ffmpeg needed)
            // Use bestaudio format which is already in audio format
            options.push(
                '-f', 'bestaudio/best'
            );
        } else {
            // Video download - use simple best format
            const formatString = this.buildFormatString(quality);
            options.push(
                '-f', formatString
            );
        }

        // Common options
        options.push(
            '--no-playlist', // Download single video only
            '--no-warnings',
            '--no-check-certificate'
        );

        return options;
    }

    buildFormatString(quality) {
        // Use simpler format strings that don't require ffmpeg merging
        // This downloads pre-merged formats which are more compatible
        const height = parseInt(quality);

        if (height >= 2160) {
            return 'best[height<=2160]/best';
        } else if (height >= 1440) {
            return 'best[height<=1440]/best';
        } else if (height >= 1080) {
            return 'best[height<=1080]/best';
        } else if (height >= 720) {
            return 'best[height<=720]/best';
        } else if (height >= 480) {
            return 'best[height<=480]/best';
        } else {
            return 'best[height<=360]/best';
        }
    }

    mapAudioQuality(quality) {
        const kbps = parseInt(quality);
        if (kbps >= 320) return '0'; // Best
        if (kbps >= 256) return '2';
        if (kbps >= 192) return '3';
        if (kbps >= 128) return '5';
        return '7'; // Lower quality
    }

    async cleanup(filepath) {
        try {
            await fs.unlink(filepath);
            console.log(`🗑️  Cleaned up: ${path.basename(filepath)}`);
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async cleanupOldFiles(maxAgeHours = 1) {
        try {
            const files = await fs.readdir(TEMP_DIR);
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000;

            for (const file of files) {
                const filepath = path.join(TEMP_DIR, file);
                const stats = await fs.stat(filepath);

                if (now - stats.mtimeMs > maxAge) {
                    await this.cleanup(filepath);
                }
            }
        } catch (error) {
            console.error('Cleanup old files error:', error);
        }
    }
}

export default new DownloadService();
