"""Regenerate the geometric app icons with Pillow (development-only dependency)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'assets' / 'icons'
scale = 4
image = Image.new('RGB', (512 * scale, 512 * scale), '#10051c')
draw = ImageDraw.Draw(image)

def box(points):
    return tuple(int(n * scale) for n in points)

def arch(left, right, top, bottom, color, line=None, width=1):
    radius = (right - left) / 2
    center_y = top + radius
    draw.pieslice(box((left, top, right, top + radius * 2)), 180, 360, fill=color)
    draw.rectangle(box((left, center_y, right, bottom)), fill=color)
    if line:
        draw.arc(box((left, top, right, top + radius * 2)), 180, 360, fill=line, width=width * scale)
        draw.line([box((left, center_y)), box((left, bottom)), box((right, bottom)), box((right, center_y))], fill=line, width=width * scale)

arch(108, 404, 84, 402, '#2b153e', '#ffdc73', 6)
arch(122, 390, 98, 388, '#2b153e', '#785096', 2)
points = [(165,175),(230,175),(230,187),(212,187),(261,305),(306,187),(284,187),(284,175),(345,175),(345,187),(326,187),(261,348),(245,348),(175,187),(165,187)]
draw.polygon([box(point) for point in points], fill='#ffdc73')
draw.polygon([box(point) for point in [(256,116),(262,126),(256,136),(250,126)]], fill='#71e7b9')
for size in (180, 192, 512):
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'voodoo-{size}.png', optimize=True)
