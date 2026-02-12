import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import downloadRoutes from './routes/download.js';
import downloadService from './services/downloadService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Rate limiting - Apply globally but exclude progress/file endpoints
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for progress and file endpoints
    skip: (req) => {
        return req.path.includes('/progress/') || req.path.includes('/file/');
    }
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/download', downloadRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Social Media Downloader API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            videoInfo: 'POST /api/download/info',
            download: 'POST /api/download/start',
            analytics: 'GET /api/download/analytics',
            platforms: 'GET /api/download/platforms'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Initialize services and start server
async function startServer() {
    try {
        console.log('🚀 Starting Social Media Downloader API...');

        // Initialize download service (downloads yt-dlp if needed)
        console.log('📦 Initializing download service...');
        await downloadService.initialize();

        // Start cleanup interval (every hour)
        setInterval(async () => {
            console.log('🧹 Running cleanup...');
            await downloadService.cleanupOldFiles(1);
        }, 60 * 60 * 1000);

        // Start server
        app.listen(PORT, () => {
            console.log('');
            console.log('✅ Server is running!');
            console.log(`📍 Port: ${PORT}`);
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
            console.log('');
            console.log('📊 Endpoints:');
            console.log(`   GET  /health - Health check`);
            console.log(`   POST /api/download/info - Get video info`);
            console.log(`   POST /api/download/start - Start download`);
            console.log(`   GET  /api/download/analytics - View analytics`);
            console.log(`   GET  /api/download/platforms - List platforms`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();

export default app;
