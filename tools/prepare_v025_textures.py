"""Prepare credited NASA image maps used by Solar Time v0.25."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def save_webp(image: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=94, method=6)


def prepare_pluto(source: Path, target: Path) -> None:
    image = np.asarray(Image.open(source).convert("RGB"), dtype=np.float32)
    # New Horizons did not image the far-southern cap at comparable resolution.
    # Fill only the map's pure-black no-data wedge by reflecting the nearest
    # observed southern latitudes. This prevents a black cap on the sphere while
    # preserving every measured pixel above the coverage boundary.
    valid = image.max(axis=2) > 12
    height, width = valid.shape
    blend_mask = np.zeros((height, width), dtype=np.float32)
    for x in range(width):
        rows = np.flatnonzero(valid[:, x])
        if not len(rows):
            continue
        edge = int(rows[-1])
        if edge >= height - 1:
            continue
        feather = min(620, max(64, edge // 3))
        start = edge - feather
        for y in range(start, height):
            distance = y - start
            reflected = max(0, start - int(distance * 0.38))
            replacement = image[reflected, x]
            if y <= edge:
                t = (y - start) / max(1, edge - start)
                t = t * t * (3 - 2 * t)
                image[y, x] = image[y, x] * (1 - t) + replacement * t
                blend_mask[y, x] = t
            else:
                image[y, x] = replacement
                blend_mask[y, x] = 1
    # Slightly soften only the reconstructed cap so column-wise coverage edges
    # from the source mosaic cannot show up as a latitude seam.
    smooth = np.asarray(Image.fromarray(np.uint8(np.clip(image, 0, 255))).filter(ImageFilter.GaussianBlur(12)), dtype=np.float32)
    weight = (blend_mask * 0.82)[..., None]
    image = image * (1 - weight) + smooth * weight
    out = Image.fromarray(np.uint8(np.clip(image, 0, 255))).resize((4096, 2048), Image.Resampling.LANCZOS)
    pixels = np.asarray(out, dtype=np.float32).copy()
    # Longitude is undefined at each pole; gently converge the last few rows to
    # their row mean so the equirectangular wrap cannot form a pinched seam.
    for top in (True, False):
        for i in range(24):
            y = i if top else pixels.shape[0] - 1 - i
            weight = ((24 - i) / 24) ** 2
            mean = pixels[y].mean(axis=0, keepdims=True)
            pixels[y] = pixels[y] * (1 - weight) + mean * weight
    save_webp(Image.fromarray(np.uint8(np.clip(pixels, 0, 255))), target)


def prepare_europa(source: Path, target: Path) -> None:
    image = Image.open(source).convert("L").resize((2048, 1024), Image.Resampling.LANCZOS)
    luminance = np.asarray(image, dtype=np.float32) / 255
    luminance = np.clip((luminance - 0.08) / 0.92, 0, 1) ** 0.92
    # The USGS/NASA preview is an albedo mosaic. Apply a restrained ice-and-rust
    # palette without painting new geography into the measured lineaments.
    dark = np.array([67, 45, 32], dtype=np.float32)
    light = np.array([242, 230, 198], dtype=np.float32)
    rgb = dark + luminance[..., None] * (light - dark)
    save_webp(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))), target)


def bilinear(source: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    height, width, _ = source.shape
    x = np.clip(x, 0, width - 1.001)
    y = np.clip(y, 0, height - 1.001)
    x0, y0 = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    x1, y1 = np.minimum(x0 + 1, width - 1), np.minimum(y0 + 1, height - 1)
    wx, wy = (x - x0)[..., None], (y - y0)[..., None]
    return ((source[y0, x0] * (1 - wx) + source[y0, x1] * wx) * (1 - wy)
            + (source[y1, x0] * (1 - wx) + source[y1, x1] * wx) * wy)


def prepare_uranus(source: Path, target: Path) -> None:
    original = Image.open(source).convert("RGB")
    array = np.asarray(original, dtype=np.float32)
    mask = array.max(axis=2) > 18
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise ValueError("Uranus disk was not found")
    left, right, top, bottom = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (left + right) / 2, (top + bottom) / 2
    radius = min(right - left, bottom - top) / 2
    softened = np.asarray(original.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32)
    out_width, out_height = 2048, 1024
    longitude = np.linspace(-np.pi, np.pi, out_width, endpoint=False)[None, :]
    latitude = np.linspace(np.pi / 2, -np.pi / 2, out_height)[:, None]
    # Sample the well-exposed inner disk, avoiding baked limb darkness. The
    # sin(longitude) mapping repeats the nearly featureless observed hemisphere
    # seamlessly around the unobserved side instead of inventing cloud systems.
    sample_x = cx + 0.55 * radius * np.cos(latitude) * np.sin(longitude)
    sample_y = cy - 0.78 * radius * np.sin(latitude) + np.zeros_like(longitude)
    rgb = bilinear(softened, sample_x, sample_y)
    save_webp(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))), target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pluto", type=Path, required=True)
    parser.add_argument("--uranus", type=Path, required=True)
    parser.add_argument("--europa", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    args = parser.parse_args()
    prepare_pluto(args.pluto, args.assets / "pluto.webp")
    prepare_uranus(args.uranus, args.assets / "uranus.webp")
    prepare_europa(args.europa, args.assets / "europa.webp")


if __name__ == "__main__":
    main()
