from PIL import Image, ImageDraw, ImageFont
import os

# Load dolphin image
dolphin_path = "C:/Projects/FinScholarApp/assets/images/splash-icon.png"
if not os.path.exists(dolphin_path):
    dolphin_path = "C:/Projects/FinScholarApp/assets/images/studying.png"
    
dolphin = Image.open(dolphin_path).convert("RGBA")

# Resize dolphin
dolphin.thumbnail((600, 600), Image.LANCZOS)

# Create a transparent background image, 1000x1000
splash = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
draw = ImageDraw.Draw(splash)

# Paste dolphin in the center, shifted up slightly
d_w, d_h = dolphin.size
x_offset = (1000 - d_w) // 2
y_offset = (1000 - d_h) // 2 - 80
splash.paste(dolphin, (x_offset, y_offset), dolphin)

# Add text "FinScholar"
try:
    # Use Segoe UI Bold on Windows
    font = ImageFont.truetype("segoeuib.ttf", 100)
except Exception as e:
    try:
        font = ImageFont.truetype("arialbd.ttf", 100)
    except:
        font = ImageFont.load_default()

text = "FinScholar"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

text_x = (1000 - text_w) // 2
text_y = y_offset + d_h + 40

draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

splash.save("C:/Projects/FinScholarApp/assets/images/splash-icon-new.png")
print("Splash created successfully!")
