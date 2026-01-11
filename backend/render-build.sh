# Skip youtube-dl-exec binary download (Uses system installed via pip instead)
export YOUTUBE_DL_SKIP_DOWNLOAD=true

echo "Python Version:"
python3 --version
echo "Pip Version:"
pip3 --version

# Standard Render Build Script
# 1. Install Node dependencies
npm install

# 2. Install Python dependencies (Global/System install for Render)
pip3 install -r requirements.txt
