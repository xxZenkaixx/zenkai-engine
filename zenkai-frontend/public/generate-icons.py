from PIL import Image, ImageDraw, ImageFont, ImageFilter
import glob, os, json

print("Run this script from /public folder")

BG   = (10, 10, 10)   # #0a0a0a
FG   = (200, 255, 0)  # #c8ff00
TEXT = '全快'

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def resolve_font():
    candidates = [
        # MS Mincho via any Office app (thin serif — preferred)
        *sorted(glob.glob('/Applications/Microsoft *.app/Contents/Resources/Fonts/msmincho.ttc')),
        # Hiragino Mincho (thin serif, system)
        *sorted(glob.glob('/System/Library/Fonts/ヒラギノ明朝*W3*.otf')),
        *sorted(glob.glob('/Library/Fonts/ヒラギノ明朝*W3*.otf')),
        '/System/Library/Fonts/ヒラギノ明朝 ProN W3.otf',
        '/Library/Fonts/HiraginoMincho-W3.otf',
        # STHeiti (sans fallback, still renders CJK)
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
    ]
    for path in candidates:
        if os.path.exists(path):
            print(f'[font] {path}')
            return path
    print('[font] WARNING: no CJK font found — icons will show tofu squares')
    return None

FONT_PATH = resolve_font()

def make_icon(size):
    font_size = int(size * 0.36)
    font = ImageFont.truetype(FONT_PATH, font_size) if FONT_PATH else ImageFont.load_default()

    # Center text
    probe = Image.new('L', (size * 3, size * 3), 0)
    bbox  = ImageDraw.Draw(probe).textbbox((0, 0), TEXT, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1]

    # Kanji alpha mask
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).text((x, y), TEXT, font=font, fill=255)

    # Outer dark aura — ominous bleed behind strokes
    aura   = mask.filter(ImageFilter.GaussianBlur(radius=size * 0.045))
    canvas = Image.new('RGB', (size, size), BG)
    canvas.paste(Image.new('RGB', (size, size), (8, 18, 0)), mask=aura)

    # Lime kanji
    # Maskable safe zone: keep content within central ~80% (10% inset each side)
    ImageDraw.Draw(canvas).text((x, y), TEXT, font=font, fill=FG)

    # Inner shadow — dark bevel clipped inside each stroke
    offset_y  = max(1, int(size * 0.007))
    inner_src = Image.new('L', (size, size), 0)
    ImageDraw.Draw(inner_src).text((x, y + offset_y), TEXT, font=font, fill=255)
    inner_blur   = inner_src.filter(ImageFilter.GaussianBlur(radius=max(1.0, size * 0.014)))
    inner_shadow = Image.new('L', (size, size), 0)
    inner_shadow.paste(inner_blur, mask=mask)
    canvas.paste(Image.new('RGB', (size, size), (0, 0, 0)), mask=inner_shadow)

    return canvas

manifest_icons = [
    {'src': 'favicon.ico', 'sizes': '64x64 32x32 24x24 16x16', 'type': 'image/x-icon'},
]

# favicon.ico — 64x64
try:
    fav = make_icon(64)
    fav.save(os.path.join(OUT_DIR, 'favicon.ico'), format='ICO', sizes=[(64, 64)])
    print('[ok] favicon.ico (64×64)')
except Exception as e:
    print(f'[error] favicon.ico: {e}')

SIZES = [
    (192,  'logo192.png',          'any maskable'),
    (512,  'logo512.png',          'any maskable'),
    (180,  'apple-touch-icon.png', None),
    (1024, 'logo1024.png',         'any maskable'),
]

for size, name, purpose in SIZES:
    out_path = os.path.join(OUT_DIR, name)
    try:
        make_icon(size).save(out_path, 'PNG', optimize=True, compress_level=9)
        print(f'[ok] {name} ({size}×{size})')
        if purpose:
            manifest_icons.append({
                'src': name,
                'type': 'image/png',
                'sizes': f'{size}x{size}',
                'purpose': purpose,
            })
    except Exception as e:
        print(f'[error] {name}: {e}')

print('\n--- paste into manifest.json "icons" array ---')
print(json.dumps(manifest_icons, indent=2))
