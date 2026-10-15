"""Shift purple hues (250-310 deg) in PNG icons to blue (205 deg), keeping shading.

Usage: python depurple.py <dir>   (rewrites *.png in place, reports remaining purple share)
"""
import colorsys
import glob
import sys

from PIL import Image

LO, HI = 250 / 360, 310 / 360
TARGET = 205 / 360


def remap(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if LO <= hh <= HI and s > 0.08:
                # Blend toward the target based on distance into the band so edges stay smooth.
                nr, ng, nb = colorsys.hsv_to_rgb(TARGET, s, v)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return im


def purple_share(im: Image.Image) -> float:
    n = p = 0
    for r, g, b, a in im.convert("RGBA").get_flattened_data():
        if a < 128:
            continue
        n += 1
        hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if LO <= hh <= HI and s > 0.25 and v > 0.2:
            p += 1
    return p / max(n, 1)


def main(folder: str) -> None:
    for f in sorted(glob.glob(f"{folder}/*.png")):
        im = Image.open(f)
        before = purple_share(im)
        if before == 0:
            continue
        out = remap(im)
        out.save(f, "PNG", optimize=True)
        print(f"{f.split('/')[-1]:18s} {before*100:5.1f}% -> {purple_share(out)*100:4.1f}%")


if __name__ == "__main__":
    main(sys.argv[1])
