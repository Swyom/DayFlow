"""Build the launcher icon, splash logo and Snake artwork from the masters in source/.

Usage: python make_app_icons.py   (run from anywhere; writes into ../../assets)

Outputs
- assets/icon.png            1024 opaque, full-bleed square. iOS (and Expo's legacy
                             Android icon) apply their own rounded mask, so the art
                             must reach the edges with no transparent corners.
- assets/adaptive-icon.png   1024 foreground layer (108dp canvas). Launchers crop it to
                             a circle, squircle, rounded square or teardrop showing only
                             the central 72dp, so the emblem is kept inside the ~68dp
                             circle and the blue field is extended to all four edges.
- assets/splash-icon.png     1024 transparent, the logo with its own rounded shape.
- assets/brand/logo.png      512, same logo for the animated splash and auth screens.
- assets/icons3d/logo.png    160, same logo at list-icon size (Settings > About).
- assets/icons3d/snake.png   160px, small icon size used across the app.
- assets/games/snake.png     600px, Games hero (covers 3x density at 200dp).
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "source"
ASSETS = HERE.parent.parent / "assets"
SIZE = 1024


def box_blur(a: np.ndarray, r: int) -> np.ndarray:
    """Separable box blur of an (H, W, C) float array with edge clamping."""
    for axis in (0, 1):
        pad = [(0, 0)] * a.ndim
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
        n = a.shape[axis]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
        lo = np.take(c, np.arange(0, n), axis=axis)
        a = (hi - lo) / (2 * r + 1)
    return a


def extend_colors(rgba: Image.Image, known_alpha: int = 240, erode: int = 3) -> Image.Image:
    """Fill every non-opaque pixel by smoothly extending nearby opaque colours.

    Normalised convolution at growing radii: blur(colour * mask) / blur(mask). Small
    radii fill the antialiased rim, larger ones reach the canvas corners.
    """
    a = np.asarray(rgba.convert("RGBA")).astype(np.float64)
    known = (a[..., 3] >= known_alpha).astype(np.float64)
    if erode:  # drop the antialiased edge so it cannot tint the fill
        known = (box_blur(known[..., None], erode)[..., 0] > 0.999).astype(np.float64)
    rgb = a[..., :3]
    out = rgb * known[..., None]
    filled = known.copy()
    r = 2
    while filled.min() < 1 and r < max(a.shape[:2]):
        w = known[..., None]
        # 3 box passes ~ gaussian
        num = box_blur(box_blur(box_blur(rgb * w, r), r), r)
        den = box_blur(box_blur(box_blur(w, r), r), r)
        ok = (den[..., 0] > 1e-4) & (filled < 1)
        out[ok] = num[ok] / den[ok]
        filled[ok] = 1
        r *= 2
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def trim_square(im: Image.Image, alpha_floor: int = 12, margin: float = 0.0) -> Image.Image:
    """Crop to visible content and centre it on a transparent square canvas."""
    im = im.convert("RGBA")
    a = np.asarray(im).copy()
    a[a[..., 3] < alpha_floor] = 0  # strip near-invisible haze left by the generator
    im = Image.fromarray(a, "RGBA")
    box = im.getbbox()
    im = im.crop(box)
    side = round(max(im.size) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas


def opaque(im: Image.Image) -> Image.Image:
    """Force alpha to 255 (the generator caps it at 253)."""
    a = np.asarray(im.convert("RGBA")).copy()
    a[a[..., 3] >= 200, 3] = 255
    return Image.fromarray(a, "RGBA")


def build_app_icons() -> None:
    master = opaque(Image.open(SRC / "app-icon.webp"))
    tile = trim_square(master, alpha_floor=120)  # the rounded blue tile, centred
    side = tile.width

    # iOS / legacy: inset slightly so the tile's antialiased outline is cropped away,
    # then fill the rounded corners with the extended blue.
    inset = round(side * 0.012)
    ios = tile.crop((inset, inset, side - inset, side - inset))
    ios = extend_colors(ios).resize((SIZE, SIZE), Image.LANCZOS)
    ios.save(ASSETS / "icon.png", optimize=True)

    # Android adaptive foreground: tile at 0.645 of the 108dp canvas (~70dp), which puts
    # the emblem's far corners on a ~68dp circle, inside every launcher mask.
    scale = 0.645
    inner = round(SIZE * scale)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(tile.resize((inner, inner), Image.LANCZOS), ((SIZE - inner) // 2,) * 2)
    adaptive = extend_colors(canvas)
    adaptive.save(ASSETS / "adaptive-icon.png", optimize=True)

    # Splash + in-app logo: the tile with its own rounded shape on a transparent canvas.
    logo = trim_square(master, alpha_floor=12, margin=0.01)
    logo.resize((SIZE, SIZE), Image.LANCZOS).save(ASSETS / "splash-icon.png", optimize=True)
    (ASSETS / "brand").mkdir(exist_ok=True)
    logo.resize((512, 512), Image.LANCZOS).save(ASSETS / "brand" / "logo.png", optimize=True)
    logo.resize((160, 160), Image.LANCZOS).save(ASSETS / "icons3d" / "logo.png", optimize=True)


def build_snake() -> None:
    snake = trim_square(opaque(Image.open(SRC / "snake.webp")), alpha_floor=12, margin=0.02)
    (ASSETS / "games").mkdir(exist_ok=True)
    snake.resize((600, 600), Image.LANCZOS).save(ASSETS / "games" / "snake.png", optimize=True)
    snake.resize((160, 160), Image.LANCZOS).save(ASSETS / "icons3d" / "snake.png", optimize=True)


if __name__ == "__main__":
    build_app_icons()
    build_snake()
    print("icons written to", ASSETS)
