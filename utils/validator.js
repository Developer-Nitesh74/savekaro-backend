import { body, validationResult } from 'express-validator';
import { isSupportedPlatform, detectPlatform, getPlatformInfo } from '../config/platforms.js';

export const validateDownloadRequest = [
    body('url')
        .trim()
        .notEmpty()
        .withMessage('URL is required')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format')
        .custom((url) => {
            if (!isSupportedPlatform(url)) {
                throw new Error('Unsupported platform. Please use YouTube, Instagram, TikTok, Twitter, Facebook, Vimeo, or Reddit.');
            }
            return true;
        }),

    body('format')
        .optional()
        .isIn(['video', 'audio'])
        .withMessage('Format must be either "video" or "audio"'),

    body('quality')
        .optional()
        .isString()
        .withMessage('Quality must be a string'),
];

export const validateInfoRequest = [
    body('url')
        .trim()
        .notEmpty()
        .withMessage('URL is required')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format')
        .custom((url) => {
            if (!isSupportedPlatform(url)) {
                throw new Error('Unsupported platform');
            }
            return true;
        }),
];

export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }

    next();
}

export function sanitizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove tracking parameters
        const cleanParams = new URLSearchParams();

        // Keep only essential parameters
        const essentialParams = ['v', 'list', 'index', 'p', 'reel', 'video'];
        for (const [key, value] of urlObj.searchParams.entries()) {
            if (essentialParams.includes(key)) {
                cleanParams.set(key, value);
            }
        }

        urlObj.search = cleanParams.toString();
        return urlObj.toString();
    } catch (error) {
        return url;
    }
}

export function validateQuality(url, format, quality) {
    const platform = detectPlatform(url);
    if (!platform) return false;

    const platformInfo = getPlatformInfo(platform);
    if (!platformInfo) return false;

    const availableQualities = platformInfo.qualities[format] || [];
    return availableQualities.includes(quality);
}
