import cv2
import easyocr
import sys
import argparse
import os
import numpy as np

def process_video(input_path, output_path, sensitivity=0.5):
    # Initialize EasyOCR
    reader = easyocr.Reader(['en'], gpu=True) # Try GPU, fallback to CPU automatically

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {input_path}")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Use a faster, smaller resolution for detection to speed it up
    detect_width = 640
    detect_scale = detect_width / width
    detect_height = int(height * detect_scale)

    # Output Video Writer
    # We write to a temp file first, then the node service will start this script
    # actually, let's just write to the output path.
    # Note: cv2 VideoWriter doesn't handle audio. We'll need ffmpeg to merge it later if we want audio.
    # For now, let's just output the video. The Service will parse the output or we handle audio merging with ffmpeg subprocess here?
    # Better to keep it simple: Python does video -> video (silent). Node does audio merge.
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_count = 0
    current_boxes = []
    
    # Process every Nth frame for detection, verify in others
    detection_interval = 5 
    
    print(f"Processing video: {width}x{height} @ {fps}fps, {total_frames} frames")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Detection logic
        if frame_count % detection_interval == 0:
            # Resize for faster detection
            small_frame = cv2.resize(frame, (detect_width, detect_height))
            
            # EasyOCR detection
            results = reader.readtext(small_frame)
            
            new_boxes = []
            for (bbox, text, prob) in results:
                if prob > sensitivity:
                    # distinct boxes: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
                    # We need x_min, y_min, x_max, y_max
                    (tl, tr, br, bl) = bbox
                    x_min = min(tl[0], bl[0])
                    x_max = max(tr[0], br[0])
                    y_min = min(tl[1], tr[1])
                    y_max = max(bl[1], br[1])

                    # Scale back to original size
                    x_min = int(x_min / detect_scale)
                    x_max = int(x_max / detect_scale)
                    y_min = int(y_min / detect_scale)
                    y_max = int(y_max / detect_scale)
                    
                    # Add padding
                    pad = 10
                    x_min = max(0, x_min - pad)
                    y_min = max(0, y_min - pad)
                    x_max = min(width, x_max + pad)
                    y_max = min(height, y_max + pad)

                    new_boxes.append((x_min, y_min, x_max, y_max))
            
            current_boxes = new_boxes

        # Apply Blur
        for (x1, y1, x2, y2) in current_boxes:
            # Extract ROI
            roi = frame[y1:y2, x1:x2]
            if roi.size == 0: continue
            
            # Blur
            frame[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (51, 51), 0)

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
    parser.add_argument("input", help="Input video path")
    parser.add_argument("output", help="Output video path")
    parser.add_argument("--sensitivity", type=float, default=0.4, help="Detection sensitivity")
    
    args = parser.parse_args()
    process_video(args.input, args.output, args.sensitivity)
