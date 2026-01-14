#!/bin/bash
# Skip youtube-dl-exec binary download (Uses system installed via pip instead)
export YOUTUBE_DL_SKIP_DOWNLOAD=true

echo "Python Version:"
python3 --version
echo "Pip Version:"
pip3 --version

# Standard Render Build Script
# 1. Install Node dependencies (Triggers prisma generate via postinstall)
npm install

# 2. Debug: Check if Prisma Client was generated
echo "Checking for Prisma Client..."
ls -R node_modules/.prisma || echo "Prisma Client NOT FOUND in node_modules/.prisma"

# 3. Install Python dependencies
pip3 install -r requirements.txt
