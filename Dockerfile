# Use official Node.js runtime as base image
FROM node:20-alpine

# Install Python3, pip, ffmpeg and dependencies required by yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl

# Install yt-dlp via pip
RUN python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV YTDLP_CMD=yt-dlp

# Start application
CMD ["npm", "start"]
