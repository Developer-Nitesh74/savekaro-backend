import { spawn } from 'child_process';
import fs from 'fs';

const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// We will fetch the latest post from NASA's profile to simulate a single video/reel
const args = ['-m', 'yt_dlp', '--dump-json', '--no-warnings', '--playlist-end', '1', url];

console.log('Running yt-dlp with args:', args.join(' '));

const process = spawn('python', args);

let stdout = '';
let stderr = '';

process.stdout.on('data', (data) => {
    stdout += data.toString();
});

process.stderr.on('data', (data) => {
    stderr += data.toString();
    fs.appendFileSync('error.log', data.toString());
});

process.on('close', (code) => {
    if (code === 0) {
        try {
            const metadata = JSON.parse(stdout);
            console.log('Success!');
            console.log('Thumbnail:', metadata.thumbnail);
            console.log('Thumbnails array:', metadata.thumbnails);
            // console.log('Full Metadata:', JSON.stringify(metadata, null, 2));
        } catch (e) {
            console.error('Failed to parse JSON:', e.message);
            console.log('Raw output:', stdout);
        }
    } else {
        console.error(`yt-dlp exited with code ${code}`);
        console.error('Stderr:', stderr);
    }
});
