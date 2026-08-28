const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to sanitize filenames
function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'youtube_video';
}

// Helper to format duration in seconds to MM:SS or HH:MM:SS
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const secNum = parseInt(seconds, 10);
  const hours = Math.floor(secNum / 3600);
  const minutes = Math.floor((secNum - hours * 3600) / 60);
  const secs = secNum % 60;

  const mStr = minutes.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

// Validate YouTube URL
function isValidYouTubeUrl(url) {
  if (!url) return false;
  const regex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+$/i;
  return regex.test(url);
}

// Helper to get yt-dlp command dynamically
function getInfoCmd(safeUrl) {
  if (process.env.YTDLP_CMD) {
    return `${process.env.YTDLP_CMD} -j --no-warnings --no-playlist "${safeUrl}"`;
  }
  if (process.platform === 'win32') {
    return `py -m yt_dlp -j --no-warnings --no-playlist "${safeUrl}"`;
  }
  return `yt-dlp -j --no-warnings --no-playlist "${safeUrl}"`;
}

// Helper to get spawn parameters for streaming
function getSpawnConfig() {
  if (process.env.YTDLP_CMD) {
    const parts = process.env.YTDLP_CMD.split(' ');
    return { bin: parts[0], prefixArgs: parts.slice(1) };
  }
  if (process.platform === 'win32') {
    return { bin: 'py', prefixArgs: ['-m', 'yt_dlp'] };
  }
  return { bin: 'yt-dlp', prefixArgs: [] };
}

// POST /api/info - Get video/short metadata and available qualities
app.post('/api/info', (req, res) => {
  const { url } = req.body;

  if (!url || !isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid YouTube or YouTube Shorts URL.' });
  }

  // Escape quotes in URL for command safety
  const safeUrl = url.replace(/"/g, '\\"');
  const cmd = getInfoCmd(safeUrl);

  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error('yt-dlp error:', stderr || error.message);
      return res.status(500).json({
        error: 'Failed to extract video information. Please check the URL and try again.'
      });
    }

    try {
      const info = JSON.parse(stdout);

      // Determine highest available resolution
      const height = info.height || 720;
      const isShort = url.toLowerCase().includes('/shorts/') || (info.duration && info.duration <= 60 && info.aspect_ratio < 1);

      // Standard quality options
      const videoFormats = [
        { quality: '1080p', label: '1080p Full HD (MP4)', ext: 'mp4', type: 'video', height: 1080 },
        { quality: '720p', label: '720p HD (MP4)', ext: 'mp4', type: 'video', height: 720 },
        { quality: '480p', label: '480p SD (MP4)', ext: 'mp4', type: 'video', height: 480 },
        { quality: '360p', label: '360p (MP4)', ext: 'mp4', type: 'video', height: 360 }
      ].filter(f => f.height <= Math.max(height, 1080));

      const audioFormats = [
        { quality: 'mp3-320', label: 'MP3 Audio (High 320kbps)', ext: 'mp3', type: 'audio', bitrate: 320 },
        { quality: 'mp3-128', label: 'MP3 Audio (Standard 128kbps)', ext: 'mp3', type: 'audio', bitrate: 128 }
      ];

      // Best thumbnail
      let thumbnail = `https://img.youtube.com/vi/${info.id}/maxresdefault.jpg`;
      if (info.thumbnail) {
        thumbnail = info.thumbnail;
      }

      res.json({
        id: info.id,
        title: info.title || 'YouTube Video',
        author: info.uploader || info.channel || 'YouTube Creator',
        duration: formatDuration(info.duration),
        durationSeconds: info.duration,
        thumbnail: `/api/thumbnail?url=${encodeURIComponent(thumbnail)}`,
        isShort: isShort,
        videoFormats: videoFormats.length > 0 ? videoFormats : [
          { quality: '720p', label: '720p HD (MP4)', ext: 'mp4', type: 'video', height: 720 }
        ],
        audioFormats: audioFormats
      });

    } catch (parseError) {
      console.error('Parse error:', parseError);
      res.status(500).json({ error: 'Failed to process video data.' });
    }
  });
});

// GET /api/thumbnail - Proxy thumbnail image to avoid CORS / referer restrictions
app.get('/api/thumbnail', (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('URL required');
  }

  const client = imageUrl.startsWith('https') ? https : http;
  client.get(imageUrl, (response) => {
    if (response.statusCode >= 400) {
      // Fallback to standard thumbnail
      return res.redirect('https://img.youtube.com/vi/default/mqdefault.jpg');
    }
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.pipe(res);
  }).on('error', () => {
    res.status(500).send('Thumbnail fetch error');
  });
});

// GET /api/download - Stream video/audio file download
app.get('/api/download', (req, res) => {
  const { url, type, quality, title } = req.query;

  if (!url || !isValidYouTubeUrl(url)) {
    return res.status(400).send('Invalid YouTube URL');
  }

  const safeTitle = sanitizeFilename(title || 'video');
  const safeUrl = url.replace(/"/g, '\\"');

  const { bin, prefixArgs } = getSpawnConfig();
  let args = [...prefixArgs];
  let fileExt = 'mp4';
  let contentType = 'video/mp4';

  if (type === 'audio') {
    fileExt = 'mp3';
    contentType = 'audio/mpeg';
    args.push('-f', 'bestaudio', '-o', '-', safeUrl);
  } else {
    // Video format matching height
    let targetHeight = 720;
    if (quality === '1080p') targetHeight = 1080;
    if (quality === '480p') targetHeight = 480;
    if (quality === '360p') targetHeight = 360;

    fileExt = 'mp4';
    contentType = 'video/mp4';
    args.push('-f', `best[height<=${targetHeight}][ext=mp4]/bestvideo[height<=${targetHeight}]+bestaudio/best`, '-o', '-', safeUrl);
  }

  const fileName = `${safeTitle}.${fileExt}`;
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=${encodeURIComponent(fileName)}`);

  const pyProcess = spawn(bin, args);

  pyProcess.stdout.pipe(res);

  pyProcess.stderr.on('data', (data) => {
    // Log warnings if needed
  });

  pyProcess.on('error', (err) => {
    console.error('Download spawn error:', err);
    if (!res.headersSent) {
      res.status(500).send('Download failed');
    }
  });

  req.on('close', () => {
    pyProcess.kill();
  });
});

app.listen(PORT, () => {
  console.log(`YouTube Shorts Downloader server running on http://localhost:${PORT}`);
});
