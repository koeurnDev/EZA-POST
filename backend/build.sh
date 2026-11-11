#!/bin/bash
# Skip youtube-dl-exec binary download (Uses system installed via pip instead)
export YOUTUBE_DL_SKIP_DOWNLOAD=true
YT_DLP_VERSION="2026.08.19"
YT_DLP_SHA256="1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"

echo "Python Version:"
python3 --version
echo "Pip Version:"
pip3 --version

# Build the legacy Node.js backend and its Python tooling.
# 1. Install Node dependencies (Triggers prisma generate via postinstall)
npm install

# 2. Sync Database Schema
echo "Synchronizing database schema..."
npx prisma db push --accept-data-loss

# 3. Debug: Check if Prisma Client was generated
echo "Checking for Prisma Client..."
ls -R node_modules/.prisma || echo "Prisma Client NOT FOUND in node_modules/.prisma"

# 3. Install Python dependencies
pip3 install -r requirements.txt

# 4. Ensure yt-dlp binary is available (for production)
echo "Downloading yt-dlp binary..."
mkdir -p bin
curl --fail --location --silent --show-error \
  "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
  -o bin/yt-dlp
echo "${YT_DLP_SHA256}  bin/yt-dlp" | sha256sum --check --status
chmod a+rx bin/yt-dlp
ACTUAL_YT_DLP_VERSION="$(./bin/yt-dlp --version)"
if [ "${ACTUAL_YT_DLP_VERSION}" != "${YT_DLP_VERSION}" ]; then
  echo "Expected yt-dlp ${YT_DLP_VERSION}, got ${ACTUAL_YT_DLP_VERSION}" >&2
  exit 1
fi
echo "Verified yt-dlp ${ACTUAL_YT_DLP_VERSION} at $(pwd)/bin/yt-dlp"
