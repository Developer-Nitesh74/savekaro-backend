#!/usr/bin/env bash
# Render Build Script - Installs dependencies + yt-dlp binary

echo "📦 Installing npm dependencies..."
npm install

echo "⬇️ Downloading yt-dlp binary..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp

echo "🔧 Making yt-dlp executable..."
chmod +x ./yt-dlp

echo "✅ Build complete! yt-dlp is ready."
