#!/usr/bin/env python3
"""Play Store / App Store listeleme görsellerini üretir.

Mağaza kaydı, uygulama ikonundan ayrı olarak 512x512 bir "store icon" ve
Play için 1024x500 bir "feature graphic" ister. Bunlar da tamamen kendi
biçimlerimizden oluşuyor: lig/takım markası ya da oyuncu görseli yok.

Kullanım:
    python3 scripts/make-store-assets.py [BOLD_SANS_FONT.ttf]

Çıktılar `store/` altına yazılır; bu klasör uygulama paketine girmez,
yalnızca Play Console'a elle yüklenir.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (13, 17, 23, 255)
ACCENT = (213, 10, 10, 255)
TEXT = (230, 237, 243, 255)
DIM = (139, 148, 158, 255)

OUT = Path(__file__).resolve().parent.parent / "store"

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


def load(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if FONT_PATH:
        return ImageFont.truetype(FONT_PATH, size)
    return ImageFont.load_default()


def text_at(draw: ImageDraw.ImageDraw, xy, text: str, font, fill, anchor="lt") -> None:
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def bars(draw: ImageDraw.ImageDraw, x: float, baseline: float, unit: float,
         color=ACCENT) -> None:
    """Yükselen üç çubuk — ikondaki motifin aynısı."""
    w = unit * 0.22
    gap = unit * 0.14
    for i, h in enumerate([unit * 0.42, unit * 0.68, unit * 1.0]):
        draw.rounded_rectangle(
            [x, baseline - h, x + w, baseline],
            radius=w * 0.28,
            fill=color if i == 2 else (color[0], color[1], color[2], 190),
        )
        x += w + gap


def store_icon(size: int = 512) -> Image.Image:
    """Play listeleme ikonu: köşeler Google tarafından yuvarlanır, kare verilir."""
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    font = load(int(size * 0.42))
    box = draw.textbbox((0, 0), "SG", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    text_at(draw, (size / 2 - w / 2 - box[0], size * 0.42 - h / 2 - box[1]),
            "SG", font, TEXT)
    unit = size * 0.26
    total = 3 * (unit * 0.22) + 2 * (unit * 0.14)
    bars(draw, size / 2 - total / 2, size * 0.82, unit)
    return img.convert("RGB")


def feature_graphic(w: int = 1024, h: int = 500) -> Image.Image:
    """Play "feature graphic": solda marka, sağda çubuk motifi."""
    img = Image.new("RGBA", (w, h), BG)
    draw = ImageDraw.Draw(img)

    # sol kenarda vurgu şeridi
    draw.rectangle([0, 0, 12, h], fill=ACCENT)

    title = load(96)
    sub = load(34)
    text_at(draw, (72, h / 2 - 70), "StatGrade", title, TEXT)
    text_at(draw, (76, h / 2 + 40), "NFL & NCAA istatistik ve projeksiyon", sub, DIM)

    # sağda büyüyen çubuklar (dekoratif) — alt başlıkla çakışmayacak kadar sağda
    unit = 170.0
    total = 3 * (unit * 0.22) + 2 * (unit * 0.14)
    bars(draw, w - 90 - total, h * 0.74, unit)

    return img.convert("RGB")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    outputs = {
        "play-icon-512.png": store_icon(512),
        "play-feature-graphic-1024x500.png": feature_graphic(),
    }
    for name, img in outputs.items():
        img.save(OUT / name)
        print(f"yazıldı: store/{name} ({img.width}x{img.height})")
    print("\nEkran görüntülerini kendiniz almalısınız: en az 2 telefon görüntüsü,")
    print("1080x1920 (veya 9:16) PNG/JPG. Emülatörde veya cihazda çekin.")


if __name__ == "__main__":
    main()
