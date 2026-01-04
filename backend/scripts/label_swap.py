import cv2
import sys
import argparse
import numpy as np
import os

def overlay_transparent(background, overlay, x, y, w, h):
    """
    Overlays a transparent PNG onto a background image at position x,y with size w,h
    """
    bg_h, bg_w, bg_channels = background.shape
    
    if x >= bg_w or y >= bg_h:
        return background

    # Resize overlay to fit the bounding box
    overlay_resized = cv2.resize(overlay, (w, h))
    
    # Check for clipping
    if x + w > bg_w:
        w = bg_w - x
        overlay_resized = overlay_resized[:, :w]
    if y + h > bg_h:
        h = bg_h - y
        overlay_resized = overlay_resized[:h, :]
        
    if w <= 0 or h <= 0:
        return background

    # Extract alpha channel
    if overlay_resized.shape[2] < 4:
        # If no alpha, assume opaque
        overlay_rgb = overlay_resized
        mask = np.ones((h, w), dtype=np.float32)
    else:
        overlay_rgb = overlay_resized[:, :, :3]
        mask = overlay_resized[:, :, 3] / 255.0

    # Region of Interest on Background
    roi = background[y:y+h, x:x+w]
    
    # Blending
    for c in range(0, 3):
        roi[:, :, c] = (mask * overlay_rgb[:, :, c] + (1 - mask) * roi[:, :, c])
        
    background[y:y+h, x:x+w] = roi
    return background

def process_video(video_path, logo_path, roi, output_path):
    # Initialize Video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        sys.exit(1)

    # Video Info
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Initialize Output
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Load Logo
    logo = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)
    if logo is None:
        print(f"Error: Could not open logo {logo_path}")
        sys.exit(1)

    # Initialize Tracker
    # CSRT is accurate but slower. KCF is fast but less accurate. 
    # Let's try to check availability.
    tracker = None
    try:
        tracker = cv2.TrackerCSRT_create()
    except AttributeError:
        print("TrackerCSRT not found, trying KCF...")
        try:
            tracker = cv2.TrackerKCF_create()
        except:
            print("TrackerKCF not found, trying legacy init...")
            # Fallbacks for different opencv versions
            pass
            
    if tracker is None:
        print("Error: Could not initialize any tracker.")
        sys.exit(1)

    # Parse ROI (x, y, w, h)
    # ROI comes in as pixels based on the video resolution
    x, y, w, h = map(int, roi.split(','))
    bbox = (x, y, w, h)

    # Read first frame
    ret, frame = cap.read()
    if not ret:
        print("Error: Could not read first frame")
        sys.exit(1)

    # Initialize tracker with first frame and bounding box
    tracker.init(frame, bbox)
    
    # Process first frame (overlay logo)
    frame = overlay_transparent(frame, logo, int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3]))
    out.write(frame)

    frame_count = 1
    print(f"Processing: {width}x{height}, {total_frames} frames. ROI: {bbox}")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Update tracker
        success, bbox = tracker.update(frame)

        if success:
            # bbox is float, convert to int
            x, y, w, h = [int(v) for v in bbox]
            
            # Overlay Logo
            frame = overlay_transparent(frame, logo, x, y, w, h)
        else:
            # Tracking failure - stop overlaying or keep last pos? 
            # Usually better to stop overlaying if tracking is lost to avoid logo jumping
            pass

        out.write(frame)
        frame_count += 1
        
        if frame_count % 30 == 0:
            print(f"Progress: {frame_count}/{total_frames}")
            sys.stdout.flush()

    cap.release()
    out.release()
    print("Done")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path", help="Path to input video")
    parser.add_argument("logo_path", help="Path to logo image (PNG)")
    parser.add_argument("roi", help="ROI x,y,w,h (comma separated)")
    parser.add_argument("output_path", help="Path to output video")
    
    args = parser.parse_args()
    process_video(args.video_path, args.logo_path, args.roi, args.output_path)
