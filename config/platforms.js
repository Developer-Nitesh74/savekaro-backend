export const SUPPORTED_PLATFORMS = {
    youtube: {
        name: 'YouTube',
        domains: ['youtube.com', 'youtu.be', 'm.youtube.com'],
        icon: '▶️',
        qualities: {
            video: ['2160', '1440', '1080', '720', '480', '360'],
            audio: ['320', '256', '192', '128']
        },
        formats: {
            video: ['mp4', 'webm'],
            audio: ['mp3', 'm4a', 'opus']
        }
    },
    instagram: {
        name: 'Instagram',
        domains: ['instagram.com', 'www.instagram.com'],
        icon: '📷',
        qualities: {
            video: ['1080', '720', '480'],
            audio: ['128']
        },
        formats: {
            video: ['mp4'],
            audio: ['mp3']
        }
    },
    tiktok: {
        name: 'TikTok',
        domains: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
        icon: '🎵',
        qualities: {
            video: ['1080', '720'],
            audio: ['128']
        },
        formats: {
            video: ['mp4'],
            audio: ['mp3']
        }
    },
    twitter: {
        name: 'Twitter/X',
        domains: ['twitter.com', 'x.com', 'mobile.twitter.com'],
        icon: '🐦',
        qualities: {
            video: ['1080', '720', '480'],
            audio: ['128']
        },
        formats: {
            video: ['mp4'],
            audio: ['mp3']
        }
    },
    facebook: {
        name: 'Facebook',
        domains: ['facebook.com', 'fb.watch', 'm.facebook.com'],
        icon: '👥',
        qualities: {
            video: ['1080', '720', '480'],
            audio: ['128']
        },
        formats: {
            video: ['mp4'],
            audio: ['mp3']
        }
    },
    vimeo: {
        name: 'Vimeo',
        domains: ['vimeo.com'],
        icon: '🎬',
        qualities: {
            video: ['1080', '720', '480'],
            audio: ['128']
        },
        formats: {
            video: ['mp4'],
            audio: ['mp3']
        }
    },
    reddit: {
        name: 'Reddit',
        domains: ['reddit.com', 'v.redd.it'],
        icon: '🤖',
        qualities: {
            video: ['1080', '720', '480'],
            audio: ['128']
        },
        formats: {
            video: ['mp4'],
            audio: ['mp3']
        }
    }
};

export function detectPlatform(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase().replace('www.', '');

        for (const [key, platform] of Object.entries(SUPPORTED_PLATFORMS)) {
            if (platform.domains.some(domain => hostname.includes(domain.replace('www.', '')))) {
                return key;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

export function getPlatformInfo(platformKey) {
    return SUPPORTED_PLATFORMS[platformKey] || null;
}

export function isSupportedPlatform(url) {
    return detectPlatform(url) !== null;
}
