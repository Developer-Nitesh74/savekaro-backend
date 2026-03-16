<<<<<<< HEAD
# Social Media Downloader - Backend API

Backend server for the social media downloader application. Supports downloading videos and audio from YouTube, Instagram, TikTok, Twitter, Facebook, Vimeo, and Reddit.

## Features

- 🎥 Multi-platform support (YouTube, Instagram, TikTok, Twitter, Facebook, Vimeo, Reddit)
- 🎵 Video and audio downloads
- 📊 Analytics tracking
- 🔒 Rate limiting and security
- 🗑️ Automatic file cleanup
- ⚡ Fast and efficient using yt-dlp

## Installation

### Prerequisites

- Node.js 16+ and npm
- Python 3.7+ (required by yt-dlp)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   - `PORT` - Server port (default: 5000)
   - `FRONTEND_URL` - Frontend URL for CORS
   - `RATE_LIMIT_MAX_REQUESTS` - Max requests per minute (default: 10)
   - `MAX_FILE_SIZE` - Maximum download size in bytes (default: 500MB)
   - `AUTO_DELETE_FILES` - Auto-delete files after serving (default: true)

3. **Start the server:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

The server will automatically download the yt-dlp binary on first run.

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### Get Video Information
```
POST /api/download/info
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

Response:
```json
{
  "success": true,
  "platform": "youtube",
  "platformName": "YouTube",
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": 212,
  "uploader": "Channel Name",
  "availableFormats": {
    "video": ["mp4", "webm"],
    "audio": ["mp3", "m4a"]
  },
  "availableQualities": {
    "video": ["1080", "720", "480"],
    "audio": ["320", "256", "128"]
  }
}
```

### Download Media
```
POST /api/download/start
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "format": "video",
  "quality": "1080"
}
```

Returns the file as a download stream.

### Get Analytics
```
GET /api/download/analytics
```

Returns download statistics:
```json
{
  "success": true,
  "stats": {
    "totalDownloads": 1234,
    "platformStats": {
      "youtube": 800,
      "instagram": 234,
      "tiktok": 200
    },
    "formatStats": {
      "video": 1000,
      "audio": 234
    },
    "successRate": "98.5%"
  },
  "recentActivity": [...]
}
```

### Get Supported Platforms
```
GET /api/download/platforms
```

Returns list of supported platforms.

## Supported Platforms

| Platform | Video | Audio | Max Quality |
|----------|-------|-------|-------------|
| YouTube | ✅ | ✅ | 4K (2160p) |
| Instagram | ✅ | ✅ | 1080p |
| TikTok | ✅ | ✅ | 1080p |
| Twitter/X | ✅ | ✅ | 1080p |
| Facebook | ✅ | ✅ | 1080p |
| Vimeo | ✅ | ✅ | 1080p |
| Reddit | ✅ | ✅ | 1080p |

## Configuration

### Rate Limiting

Default: 10 requests per minute per IP address.

Configure in `.env`:
```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

### File Size Limit

Default: 500MB (524,288,000 bytes)

Configure in `.env`:
```
MAX_FILE_SIZE=524288000
```

### Auto-Cleanup

Files are automatically deleted after serving to save disk space.

Configure in `.env`:
```
AUTO_DELETE_FILES=true
```

Old files (>1 hour) are cleaned up every hour automatically.

## Project Structure

```
backend/
├── config/
│   └── platforms.js       # Platform configurations
├── routes/
│   └── download.js        # API routes
├── services/
│   ├── downloadService.js # Download logic
│   └── analyticsService.js # Analytics tracking
├── utils/
│   └── validator.js       # Input validation
├── server.js              # Main server file
├── package.json
└── .env
```

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common errors:
- `400` - Invalid request (bad URL, unsupported platform)
- `429` - Rate limit exceeded
- `500` - Server error (download failed, service unavailable)

## Security

- **Helmet.js** - Security headers
- **CORS** - Configured for frontend origin only
- **Rate Limiting** - Prevents abuse
- **Input Validation** - Sanitizes and validates all inputs
- **File Size Limits** - Prevents excessive downloads

## Troubleshooting

### yt-dlp not found
The server automatically downloads yt-dlp on first run. If this fails, manually install:
```bash
npm install -g yt-dlp
```

### Python not found
yt-dlp requires Python 3.7+. Install from [python.org](https://www.python.org/).

### Download fails
- Check if the URL is valid and publicly accessible
- Verify the platform is supported
- Check server logs for detailed error messages

### Rate limit issues
Adjust rate limiting in `.env` if needed for your use case.

## License

MIT
=======
# backend
savekaro backend
>>>>>>> 39f07ef6d013cfa001e4ecb7f790470d2d15b309
