"""Prepare credited NASA image maps used by Solar Time v0.25."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def save_webp(image: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=94, method=6)


def require_equirectangular(image: Image.Image, label: str) -> None:
    """Reject web previews that would be squashed into the planet UV layout."""
    if image.width != image.height * 2:
        raise ValueError(
            f"{label} must be a 2:1 equirectangular map, got "
            f"{image.width}x{image.height}"
        )


def finish_equirectangular(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Use the same longitude and pole convention as existing spherical maps."""
    image = image.resize(size, Image.Resampling.LANCZOS)
    pixels = np.asarray(image, dtype=np.float32).copy()
    # Every longitude meets at a pole. Converging only the last few texel rows
    # prevents a fan-shaped pinch without moving mid-latitude landmarks.
    pole_rows = max(2, min(24, size[1] // 64))
    for top in (True, False):
        for i in range(pole_rows):
            y = i if top else pixels.shape[0] - 1 - i
            weight = ((pole_rows - i) / pole_rows) ** 2
            mean = pixels[y].mean(axis=0, keepdims=True)
            pixels[y] = pixels[y] * (1 - weight) + mean * weight
    # Existing planet assets and the runtime both join the antimeridian. Match
    # the endpoint pixels here as well so no raw map can introduce a hard tear.
    edge = (pixels[:, 0] + pixels[:, -1]) * 0.5
    pixels[:, 0] = edge
    pixels[:, -1] = edge
    return Image.fromarray(np.uint8(np.clip(pixels, 0, 255)))


def prepare_pluto(source: Path, target: Path) -> None:
    source_image = Image.open(source).convert("RGB")
    require_equirectangular(source_image, "Pluto")
    image = np.asarray(source_image, dtype=np.float32)
    # New Horizons did not image the far-southern cap at comparable resolution.
    # Fill only the map's pure-black no-data wedge by reflecting the nearest
    # observed southern latitudes. This prevents a black cap on the sphere while
    # preserving every measured pixel above the coverage boundary.
    valid = image.max(axis=2) > 12
    height, width = valid.shape
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
            else:
                image[y, x] = replacement
    # The missing cap must not inherit one long radial streak per source column.
    # Resize first, then use a broad longitude-periodic blur only inside the
    # reconstructed area. This keeps observed terrain intact and turns the
    # unmeasured cap into a low-frequency continuation instead of a pinwheel.
    filled = Image.fromarray(np.uint8(np.clip(image, 0, 255))).resize((4096, 2048), Image.Resampling.LANCZOS)
    pad = 360
    wrapped = Image.new("RGB", (filled.width + pad * 2, filled.height))
    wrapped.paste(filled.crop((filled.width - pad, 0, filled.width, filled.height)), (0, 0))
    wrapped.paste(filled, (pad, 0))
    wrapped.paste(filled.crop((0, 0, pad, filled.height)), (pad + filled.width, 0))
    smooth = wrapped.filter(ImageFilter.GaussianBlur(105)).crop((pad, 0, pad + filled.width, filled.height))
    filled_pixels = np.asarray(filled, dtype=np.float32)
    smooth_pixels = np.asarray(smooth, dtype=np.float32)
    # The source coverage edge varies from about 29°S to 55°S. A latitude-only
    # confidence fade avoids exposing that irregular footprint as vertical
    # wedges while preserving every observed pixel north of 25°S.
    latitude = np.linspace(90, -90, filled.height, dtype=np.float32)
    south = np.clip((-latitude - 25) / (62 - 25), 0, 1)
    south = (south * south * (3 - 2 * south))[:, None, None]
    # Deeper into the unknown cap, longitude has no defensible photo content.
    # Reuse only the zero-mean detail from Solar Time's existing continuous
    # spherical relief so the fill has texture without stretching observations.
    row_mean = smooth_pixels.mean(axis=1, keepdims=True)
    relief_path = target.parent / "pluto-relief.webp"
    relief = Image.open(relief_path).convert("RGB").resize(filled.size, Image.Resampling.LANCZOS)
    relief_pixels = np.asarray(relief, dtype=np.float32)
    relief_detail = relief_pixels - relief_pixels.mean(axis=1, keepdims=True)
    synthetic_cap = np.clip(row_mean + relief_detail * 1.15, 0, 255)
    replacement = smooth_pixels * (1 - south) + synthetic_cap * south
    reconstructed_pixels = filled_pixels * (1 - south) + replacement * south
    reconstructed = Image.fromarray(np.uint8(np.clip(reconstructed_pixels, 0, 255)))
    out = finish_equirectangular(reconstructed, (4096, 2048))
    save_webp(out, target)


def prepare_europa(source: Path, target: Path) -> None:
    source_image = Image.open(source).convert("L")
    require_equirectangular(source_image, "Europa")
    image = source_image.resize((2048, 1024), Image.Resampling.LANCZOS)
    luminance = np.asarray(image, dtype=np.float32) / 255
    luminance = np.clip((luminance - 0.08) / 0.92, 0, 1) ** 0.92
    # The USGS/NASA preview is an albedo mosaic. Apply a restrained ice-and-rust
    # palette without painting new geography into the measured lineaments.
    dark = np.array([67, 45, 32], dtype=np.float32)
    light = np.array([242, 230, 198], dtype=np.float32)
    rgb = dark + luminance[..., None] * (light - dark)
    save_webp(finish_equirectangular(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))), (2048, 1024)), target)


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
    out = finish_equirectangular(Image.fromarray(np.uint8(np.clip(rgb, 0, 255))), (2048, 1024))
    save_webp(out, target)


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
