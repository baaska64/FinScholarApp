from PIL import Image

input_path = "assets/images/finanimated.gif"

print("Reading existing GIF...")
img = Image.open(input_path)

frames = []
try:
    while True:
        frames.append(img.copy())
        img.seek(img.tell() + 1)
except EOFError:
    pass

print(f"Extracted {len(frames)} frames.")

# Create durations list: standard for all except last, which gets 3000ms (3 seconds)
standard_duration = img.info.get('duration', 33)
durations = [standard_duration] * len(frames)
durations[-1] = 3000

print(f"Setting last frame duration to 3000ms. Standard is {standard_duration}ms.")

print("Saving with 3-second pause...")
frames[0].save(
    input_path,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    disposal=2
)
print("Done!")
