"""Generate OpenClaw logo assets from a single source image.

Reads the source dragon image, removes the white background (border flood-fill
so internal whites such as teeth are preserved), then writes every existing
platform asset in place (same file names, same sizes).

Alpha rules:
  * Alpha-capable targets -> transparent PNG/SVG (as the user requested).
  * Opaque-mandatory targets (iOS App Icon, Android legacy launcher, macOS)
    are flattened onto the app theme color #0a0a0a, because those formats
    reject transparency / need contrast against the red art.
"""

from __future__ import annotations

import base64
import io
import os
import struct
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(r"C:\Users\15910\Downloads\logo (2).png")
THEME_BG = (10, 10, 10, 255)  # #0a0a0a
WHITE = (255, 255, 255, 255)


def build_transparent() -> Image.Image:
    im = Image.open(SOURCE).convert("RGBA")
    w, h = im.size
    # Flood-fill near-white background from the four corners, so whites that
    # are enclosed by the art (teeth, highlights) survive.
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(im, seed, (0, 0, 0, 0), thresh=28)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2), im)
    return canvas


def scaled_nested(base: Image.Image, canvas_px: int, inner_ratio: float) -> Image.Image:
    """Return a transparent canvas with the art scaled to inner_ratio."""
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    inner = max(1, int(round(canvas_px * inner_ratio)))
    art = base.resize((inner, inner), Image.LANCZOS)
    off = (canvas_px - inner) // 2
    canvas.paste(art, (off, off), art)
    return canvas


def flatten(base: Image.Image, size: int, bg=THEME_BG) -> Image.Image:
    art = base.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg)
    canvas.paste(art, (0, 0), art)
    return canvas.convert("RGB")


def write(path: Path, im: Image.Image, fmt: str = "PNG") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, fmt, optimize=True)
    print(f"  {path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]} {im.mode}")


def png_data_uri(base: Image.Image, size: int) -> str:
    buf = io.BytesIO()
    base.resize((size, size), Image.LANCZOS).save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def write_ico(base: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    base.resize((256, 256), Image.LANCZOS).save(
        path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)]
    )
    print(f"  {path.relative_to(ROOT)}  (ico)")


def write_icns(base: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    chunks = [
        (b"ic07", 128), (b"ic08", 256), (b"ic09", 512), (b"ic10", 1024),
        (b"ic11", 32), (b"ic12", 64), (b"ic13", 256), (b"ic14", 512),
    ]
    body = bytearray()
    for code, size in chunks:
        art = base.resize((size, size), Image.LANCZOS)
        canvas = Image.new("RGBA", (size, size), THEME_BG)
        canvas.paste(art, (0, 0), art)
        buf = io.BytesIO()
        canvas.convert("RGB").save(buf, "PNG")
        data = buf.getvalue()
        body += code + struct.pack(">I", len(data) + 8) + data
    path.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + bytes(body))
    print(f"  {path.relative_to(ROOT)}  (icns)")


def svg_with(base: Image.Image, size: int = 256) -> str:
    uri = png_data_uri(base, size)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {size} {size}" width="{size}" height="{size}">'
        f'<image width="{size}" height="{size}" href="{uri}"/></svg>\n'
    )


def main() -> None:
    base = build_transparent()
    print(f"master transparent art: {base.size[0]}x{base.size[1]}")

    # --- Web Control UI (transparent) ---
    web = ROOT / "ui" / "public"
    write(web / "favicon-32.png", base.resize((32, 32), Image.LANCZOS))
    write(web / "apple-touch-icon.png", flatten(base, 180))
    write_ico(base, web / "favicon.ico")
    (web / "favicon.svg").write_text(svg_with(base, 128), encoding="utf-8")
    print(f"  {(web / 'favicon.svg').relative_to(ROOT)}  (svg)")

    # --- Docs (transparent) ---
    docs = ROOT / "docs" / "assets"
    write(docs / "openclaw-logo-text.png", base.resize((1000, 1000), Image.LANCZOS))
    write(docs / "openclaw-logo-text-dark.png", base.resize((1000, 1000), Image.LANCZOS))
    (docs / "openclaw-logo-text.svg").write_text(svg_with(base, 256), encoding="utf-8")
    (docs / "openclaw-logo-text-dark.svg").write_text(svg_with(base, 256), encoding="utf-8")
    (docs / "pixel-dragon.svg").write_text(svg_with(base, 192), encoding="utf-8")
    print(f"  {(docs / 'pixel-dragon.svg').relative_to(ROOT)}  (svg)")

    # --- macOS (opaque) ---
    mac = ROOT / "apps" / "macos"
    write(mac / "Icon.icon" / "Assets" / "openclaw-mac.png", flatten(base, 1024))
    write_icns(base, mac / "Sources" / "OpenClaw" / "Resources" / "OpenClaw.icns")

    # --- iOS AppIcon (opaque, exact filenames from Contents.json) ---
    ios = ROOT / "apps" / "ios" / "Sources" / "Assets.xcassets"
    appicon = ios / "AppIcon.appiconset"
    for size in (20, 29, 40, 48, 55, 57, 58, 60, 66, 76, 80, 87, 88, 92, 100,
                 102, 108, 114, 120, 152, 167, 172, 180, 196, 216, 234, 258, 1024):
        write(appicon / f"{size}.png", flatten(base, size))
    write(ios / "OpenClawIcon.imageset" / "openclaw-icon.png", base.resize((180, 180), Image.LANCZOS))

    # --- watchOS ---
    watch = ROOT / "apps" / "ios" / "WatchApp" / "Assets.xcassets"
    for name, size in {
        "watch-notification-38@2x.png": 48, "watch-notification-42@2x.png": 55,
        "watch-companion-29@2x.png": 58, "watch-companion-29@3x.png": 87,
        "watch-app-38@2x.png": 80, "watch-app-40@2x.png": 88, "watch-app-41@2x.png": 92,
        "watch-app-44@2x.png": 100, "watch-app-45@2x.png": 102,
        "watch-quicklook-38@2x.png": 172, "watch-quicklook-42@2x.png": 196,
        "watch-quicklook-44@2x.png": 216, "watch-quicklook-45@2x.png": 234,
        "watch-marketing-1024.png": 1024,
    }.items():
        write(watch / "AppIcon.appiconset" / name, flatten(base, size))
    write(watch / "OpenClawIcon.imageset" / "openclaw-icon.png", base.resize((180, 180), Image.LANCZOS))

    # --- Android (legacy opaque + adaptive foreground transparent) ---
    res = ROOT / "apps" / "android" / "app" / "src" / "main" / "res"
    for bucket, legacy, fg in (
        ("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
        ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432),
    ):
        write(res / f"mipmap-{bucket}" / "ic_launcher.png", flatten(base, legacy))
        write(res / f"mipmap-{bucket}" / "ic_launcher_foreground.png",
              scaled_nested(base, fg, 0.72))

    # Android vector logo -> bitmap logo (adaptive foreground art)
    drawable = res / "drawable"
    old_xml = drawable / "openclaw_logo.xml"
    if old_xml.exists():
        old_xml.unlink()
    write(drawable / "openclaw_logo.png", scaled_nested(base, 512, 0.86))

    # Adaptive icon background colour -> theme dark (red art on red bg = clash)
    (res / "values" / "colors.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#0A0A0A</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )
    print(f"  {(res / 'values' / 'colors.xml').relative_to(ROOT)}  (xml)")

    print("done")


if __name__ == "__main__":
    raise SystemExit(main())
