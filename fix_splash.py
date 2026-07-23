from PIL import Image

img_path = 'C:/Projects/FinScholarApp/assets/images/splash-icon-new.png'
img = Image.open(img_path).convert('RGB')

# The background color we found
bg_color = (4, 21, 48)

# Android splash screen requires a square icon. The user's image is 576x1024.
# Let's make a 2048x2048 square canvas to ensure the content is safely in the center inner circle.
canvas_size = 2048
canvas = Image.new('RGB', (canvas_size, canvas_size), bg_color)

# Calculate paste position to center the original image
x_offset = (canvas_size - img.width) // 2
y_offset = (canvas_size - img.height) // 2

# Paste the original image into the center
canvas.paste(img, (x_offset, y_offset))

# Save the new square, padded image
canvas.save(img_path)
print('Fixed image padding and shape successfully!')
