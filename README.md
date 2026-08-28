# 🚀 YouTube Shorts Downloader - Deployment Guide

This project is a high-performance web application designed to download YouTube Shorts and standard videos in 1080p Full HD MP4 or 320kbps MP3 Audio.

---

## 📁 Project Structure

```
BAIXAR VIDEOS YOUTUBE/
├── public/
│   ├── index.html       # Web Interface (100% English, Dark Neon UI)
│   ├── style.css        # Responsive CSS Design System
│   └── app.js           # Client-side download logic & AJAX API calls
├── server.js            # Node.js Express server + Streaming Engine
├── Dockerfile           # Production Docker setup (Node.js + Python3 + yt-dlp)
├── render.yaml          # Render.com auto-deployment config
├── package.json         # Dependencies & scripts
├── .env.example         # Environment template
└── .gitignore           # Git ignore list
```

---

## 🌐 How to Deploy (Deployment Options)

### Option 1: Render.com (Recommended - Free & Easy)
1. Push this project folder to your **GitHub** / **GitLab** repository.
2. Go to [Render.com](https://render.com) and create a free account.
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Render will automatically detect the `Dockerfile` (or `render.yaml`). Select **Docker** environment.
6. Click **Deploy Web Service**. Render will build the container with Python, `yt-dlp`, and Node.js automatically!

---

### Option 2: Railway.app / Koyeb / Fly.io (Docker Host)
1. Push project code to GitHub.
2. Connect repository on **Railway.app** or **Koyeb**.
3. Select **Docker** deployment.
4. Set environment variable `PORT=3000`.
5. Deploy!

---

### Option 3: VPS Host (Ubuntu / Debian / Hostinger VPS)
If deploying to a VPS via SSH:

```bash
# 1. Install Docker & Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose

# 2. Clone/Upload project directory to server
cd /var/www/youtube-shorts-downloader

# 3. Build & Run Docker Container
docker build -t youtube-shorts-downloader .
docker run -d -p 80:3000 --name shorts-downloader --restart always youtube-shorts-downloader
```

---

## 💻 Local Testing & Development

To run the application locally:

```bash
# 1. Install Node.js dependencies
npm install

# 2. Make sure Python & yt-dlp are installed locally
py -m pip install yt-dlp

# 3. Start local development server
npm start
```

Access at `http://localhost:3000`.
