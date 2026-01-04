
import sys
import os
from rembg import remove
from PIL import Image

def remove_background(image_path):
    try:
        # Load the image
        input_image = Image.open(image_path)
        
        # Remove background
        output_image = remove(input_image)

        # Generate output path
        directory, filename = os.path.split(image_path)
        name, ext = os.path.splitext(filename)
        output_filename = f"nobg-{name}.png" # Force PNG for transparency
        output_path = os.path.join(directory, output_filename)

        # Save the result
        output_image.save(output_path)

        # Print success for backend to capture
        print(f"OUTPUT: {output_path}")
    
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python remove_bg.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    remove_background(image_path)
