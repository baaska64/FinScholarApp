import imageio
from rembg import remove
from PIL import Image
import os
import io

input_path = "assets/videos/finanimated.mp4"
output_path = "assets/images/finanimated.gif"

print(f"Reading video from {input_path}...")
reader = imageio.get_reader(input_path)
fps = reader.get_meta_data()['fps']

processed_frames = []

for i, frame in enumerate(reader):
    print(f"Processing frame {i}...")
    
    # Convert numpy array to PIL Image
    pil_img = Image.fromarray(frame)
    
    # Apply background removal
    output_img = remove(pil_img)
    
    # Add to our list
    processed_frames.append(output_img)

print(f"Saving transparent GIF to {output_path}...")

standard_duration = int(1000 / fps)
durations = [standard_duration] * len(processed_frames)
durations[-1] = 3000

processed_frames[0].save(
    output_path,
    save_all=True,
    append_images=processed_frames[1:],
    duration=durations,
    loop=0,
    disposal=2 # Clear background before drawing next frame
)

print("Done!")
