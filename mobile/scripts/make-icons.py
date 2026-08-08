#!/usr/bin/env python3
"""Uygulama ikonlarını üretir.

Neden elle çizim? Mağazaya çıkan pakette lig/takım markası ya da üçüncü
taraf görsel bulunmasın diye: ikon tamamen kendi biçimlerimizden oluşuyor —
koyu zemin, "SG" monogramı ve yükselen üç çubuk (istatistik motifi).

Kullanım:
    python3 scripts/make-icons.py [BOLD_SANS_FONT.ttf]

Font yalnızca harfleri piksele dökmek için kullanılır; font dosyası
depoya kopyalanmaz. Font verilmezse monogram elle çizilen bloklarla
üretilir (daha kaba ama bağımsız).
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (13, 17, 23, 255)        # --bg
ACCENT = (213, 10, 10, 255)   # --accent
TEXT = (230, 237, 243, 255)   # --text
DIM = (139, 148, 158, 255)    # --text-dim

ASSETS = Path(__file__).resolve().parent.parent / "assets"

FONT_CANDIDATES = [
    "/mnt/skills/examples/canvas-design/canvas-fonts/WorkSans-Bold.ttf",
    "/mnt/skills/examples/canvas-design/canvas-fonts/Outfit-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def find_font() -> str | None:
    if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
        return sys.argv[1]
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return path
    return None


FONT_PATH = find_font()


def bars(draw: ImageDraw.ImageDraw, size: int, cx: float, cy: float,
         scale: float, color=ACCENT) -> None:
    """Yükselen üç çubuk — istatistik motifi."""
    unit = size * scale
    widths = unit * 0.22
    gap = unit * 0.14
    heights = [unit * 0.42, unit * 0.68, unit * 1.0]
    total = 3 * widths + 2 * gap
    x = cx - total / 2
    for i, h in enumerate(heights):
        top = cy - h
        draw.rounded_rectangle(
            [x, top, x + widths, cy],
            radius=widths * 0.28,
            fill=color if i == 2 else (color[0], color[1], color[2], 190),
        )
        x += widths + gap


def monogram(draw: ImageDraw.ImageDraw, size: int, cy: float,
             scale: float, color=TEXT) -> None:
    text = "SG"
    if FONT_PATH:
        font = ImageFont.truetype(FONT_PATH, int(size * scale))
        box = draw.textbbox((0, 0), text, font=font)
        w, h = box[2] - box[0], box[3] - box[1]
        draw.text((size / 2 - w / 2 - box[0], cy - h / 2 - box[1]),
                  text, font=font, fill=color)
    else:
        # Font yoksa: monogram yerine sade bir blok işareti
        w = size * scale * 0.9
        draw.rounded_rectangle(
            [size / 2 - w / 2, cy - w * 0.18, size / 2 + w / 2, cy + w * 0.18],
            radius=w * 0.08, fill=color)


def make_icon(size: int, *, background: bool, padding: float = 0.0,
              mono: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if background:
        draw.rounded_rectangle([0, 0, size - 1, size - 1],
                               radius=size * 0.22, fill=BG)

    inner = size * (1 - 2 * padding)
    text_color = (255, 255, 255, 255) if mono else TEXT
    bar_color = (255, 255, 255, 255) if mono else ACCENT

    monogram(draw, size, size * 0.42, (inner / size) * 0.42, text_color)
    bars(draw, size, size / 2, size * 0.82, (inner / size) * 0.26, bar_color)
    return img


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    outputs = {
        "icon.png": make_icon(1024, background=True),
        # Android adaptive: içerik güvenli alanda kalsın diye fazladan boşluk
        "android-icon-foreground.png": make_icon(1024, background=False, padding=0.22),
        "android-icon-monochrome.png": make_icon(1024, background=False,
                                                 padding=0.22, mono=True),
        "splash-icon.png": make_icon(512, background=False, padding=0.10),
        "favicon.png": make_icon(96, background=True),
    }
    for name, img in outputs.items():
        img.save(ASSETS / name)
        print(f"yazıldı: assets/{name} ({img.width}x{img.height})")

    # Artık kullanılmayan şablon dosyası
    legacy = ASSETS / "android-icon-background.png"
    if legacy.exists():
        legacy.unlink()
        print("silindi: assets/android-icon-background.png")


if __name__ == "__main__":
    main()
