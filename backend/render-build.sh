# Skip youtube-dl-exec binary download (Uses system installed via pip instead)
export YOUTUBE_DL_SKIP_DOWNLOAD=true

echo "Python Version:"
python3 --version
echo "Pip Version:"
pip3 --version

npm install

echo "Installing Python Dependencies..."
pip3 install --upgrade pip
pip3 install -r requirements.txt --user

# 🔍 Find where modules were installed
SITE_PACKAGES=$(python3 -m site --user-site)
echo "📦 Python User Site Packages: $SITE_PACKAGES"

# 🚀 Add to PYTHONPATH for runtime
export PYTHONPATH=$SITE_PACKAGES:$PYTHONPATH

echo "Verifying Installed Packages:"
pip3 list
python3 -c "import sys; sys.path.append('$SITE_PACKAGES'); import cv2; print('OpenCV imported successfully via build script')" || echo "❌ OpenCV import failed during build"
