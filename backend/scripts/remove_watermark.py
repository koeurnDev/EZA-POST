import sys
import os

# 🕵️ DEBUG: Print Environment environment info
print(f"🐍 Python Executable: {sys.executable}")
print(f"🐍 Python Version: {sys.version}")
print(f"🐍 PYTHONPATH env var: {os.environ.get('PYTHONPATH', 'Not Set')}")
print(f"🐍 sys.path: {sys.path}")

try:
    import cv2
except ImportError:
    print("❌ FATAL: Could not import cv2. Check sys.path above.")
    # Try to append known likely paths if missing (Last ditch effort)
    try:
        site_packages = "/opt/render/.local/lib/python3.11/site-packages"
        if site_packages not in sys.path:
            print(f"⚠️ Attempting to manually append: {site_packages}")
            sys.path.append(site_packages)
            import cv2
            print("✅ Manual append worked!")
    except Exception as e:
        print(f"❌ Manual append failed: {e}")
        pass
    import cv2 # Re-raise normal error if still failing

import numpy as np

def remove_watermark(image_path, position="br"):
    try:
        # Load the image
        img = cv2.imread(image_path)
        if img is None:
            print(f"Error: Could not load image at {image_path}")
            sys.exit(1)

        height, width = img.shape[:2]

        # -------------------------------------------------------------
        # 1. DEFINE ROI BASED ON POSITION
        # -------------------------------------------------------------
        # Size of the corner box to scan
        roi_w, roi_h = 300, 300  # ⬆️ Increased from 200 to 300 to catch larger offsets
        
        if position == "br": # Bottom-Right
            start_x = width - roi_w
            start_y = height - roi_h
        elif position == "bl": # Bottom-Left
            start_x = 0
            start_y = height - roi_h
        elif position == "tr": # Top-Right
            start_x = width - roi_w
            start_y = 0
        elif position == "tl": # Top-Left
            start_x = 0
            start_y = 0
        else:
            # Default to Bottom-Right if invalid
            start_x = width - roi_w
            start_y = height - roi_h

        # Ensure bounds
        start_x = max(0, start_x)
        start_y = max(0, start_y)
        end_x = min(width, start_x + roi_w)
        end_y = min(height, start_y + roi_h)

        # -------------------------------------------------------------
        # 2. CREATE MASK
        # -------------------------------------------------------------
        mask = np.zeros((height, width), dtype=np.uint8)
        
        # Extract the ROI
        roi = img[start_y:end_y, start_x:end_x]
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Smart Detection: Threshold bright pixels
        # ⬇️ Lowered to 135 to catch very faint glow/edges
        _, threshold_mask = cv2.threshold(gray_roi, 135, 255, cv2.THRESH_BINARY)
        
        # Dilate to cover edges/glow
        # ⬆️ Increased iterations to 5 to "eat" more of the surrounding halo
        kernel = np.ones((3,3), np.uint8)
        dilated_mask = cv2.dilate(threshold_mask, kernel, iterations=5)
        
        # Check if we found anything substantial
        if cv2.countNonZero(dilated_mask) > 10:
            print(f"LOG: Detected watermark in {position}.")
            mask[start_y:end_y, start_x:end_x] = dilated_mask
        else:
            print(f"LOG: No specific watermark found in {position}. Using fallback blind removal.")
            # Fallback: Just mask the very corner edge
            blind_h, blind_w = 160, 160  # ⬆️ Increased slightly more
            
            if position == "br":
                mask[height-blind_h:height, width-blind_w:width] = 255
            elif position == "bl":
                mask[height-blind_h:height, 0:blind_w] = 255
            elif position == "tr":
                mask[0:blind_h, width-blind_w:width] = 255
            elif position == "tl":
                mask[0:blind_h, 0:blind_w] = 255

        # -------------------------------------------------------------
        # 3. INPAINTING
        # -------------------------------------------------------------
        # cv2.INPAINT_TELEA is often better for small detailed areas than NS
        result = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)

        # Generate output path
        directory, filename = os.path.split(image_path)
        name, ext = os.path.splitext(filename)
        output_filename = f"repaired-{name}{ext}"
        output_path = os.path.join(directory, output_filename)

        # Save the result
        cv2.imwrite(output_path, result)

        # Print success for backend to capture
        print(f"OUTPUT: {output_path}")
    
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python remove_watermark.py <image_path> [position]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    position = sys.argv[2] if len(sys.argv) > 2 else "br"
    
    remove_watermark(image_path, position)
