# Skip youtube-dl-exec binary download (Uses system installed via pip instead)
export YOUTUBE_DL_SKIP_DOWNLOAD=true

echo "Python Version:"
python3 --version
echo "Pip Version:"
pip3 --version

npm install

echo "Installing Python Dependencies Locally..."
# Ensure pylibs directory exists
mkdir -p pylibs

# Install dependencies into pylibs to ensure they travel with the project
pip3 install -r requirements.txt --target ./pylibs --upgrade

echo "Verifying Installed Packages:"
pip3 list
# Verify import using PYTHONPATH pointing to local lib
export PYTHONPATH=$(pwd)/pylibs
python3 -c "import sys; print(sys.path); import cv2; print('✅ OpenCV imported successfully from pylibs')" || echo "❌ OpenCV import failed during build"
