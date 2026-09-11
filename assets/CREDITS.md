# Solar Time v0.08 — image sources and licenses

## Already embedded in this package

**Earth:** NASA Blue Marble Next Generation. Visualization by Reto Stöckli and Robert Simmon / NASA Earth Observatory. Converted from the Basemap-distributed `bmng.jpg` and resampled to 4096×2048 WebP in v0.06. Earth bytes are unchanged in v0.07. This is not live weather.

https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation-5935/

**Fallback maps, clouds, relief and sky:** artistic procedural material assets authored for Solar Time. These are not scientific mosaics or an accurate star catalogue. In v0.07 the diffuse low-frequency component of the existing 360-degree sky is attenuated by 62%; small star details remain. Original fallbacks remain visible until an optional public replacement is received.

No original third-party photograph or font file from a reference screenshot is redistributed here. The user-provided Saturn view is a visual reference, not a spherical texture copied from an unknown license source.

## Optional replacement maps fetched by the application

These maps are **not pre-downloaded in the distributed source package**. Their exact approved URLs and immutable mirror versions are in `src/materials.js`. Once received in a user's browser, the app can cache them and embed them into an exported standalone HTML.

### Solar System Scope / INOVE

Textures courtesy of Solar System Scope, developed by INOVE.

Source and attribution: https://www.solarsystemscope.com/textures/
License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/

Maps used: Saturn, Neptune, Venus atmosphere, Jupiter, Mars, Mercury, Uranus; Moon only as a fallback if the NASA source fails. The source pack uses NASA imagery/elevation, artist-adjusted colors, and fictional terrain in unmapped gaps. It is not a set of current, perfectly calibrated scientific observations.

Changes made after receipt: image decoding, maximum-width reduction to 4096 while retaining 2:1 projection, WebP re-encoding at quality 0.95. Native 2048 maps remain 2048. Existing unrelated synthetic relief maps are removed from the corresponding material. Actual received source URL, credit and dimensions are recorded in the exported app.

Published mirror locations (not authors of the original textures):
- `Whitebee7/solarsystem` at commit `235e72c02e825e0c8d0792ec0aa6be43e1a14f68`, under `textures/`, served by jsDelivr. Its LICENSE-textures.md separately attributes these maps to Solar System Scope under CC BY 4.0.
- `Shriisoot/Planets-texture` at commit `9c2aedaeb89f35814401873f22ce78bb02421dea`: `4k_venus_atmosphere.jpg`, served by jsDelivr.

The mirrors do not change the source pack's attribution requirement. No Pluto map from these repositories is used.

### NASA Scientific Visualization Studio — Moon

NASA's Scientific Visualization Studio / LRO / LROC. Visualization by Ernie Wright (USRA). Scientist: Noah Petro (NASA/GSFC). The global color mosaic comes from Lunar Reconnaissance Orbiter camera data assembled by the instrument teams.

Source: https://svs.gsfc.nasa.gov/4720/
Image: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg

2025 color-map version, 2048×1024 JPEG. The source describes these maps as optimized for aesthetics rather than scientific use. After receipt, Solar Time re-encodes to WebP without increasing its native dimensions. The NASA attribution is used only when this NASA image supplied the material; a Solar System Scope fallback carries Solar System Scope attribution instead.

## Exclusions and validation limits

The downloaded-map catalogue does not replace the existing Earth, Sun or Pluto assets. The Saturn ring is separately rendered rather than taken from a photograph of the whole planet. No live photographs were downloaded inside this restricted build environment. Network/decoder tests use explicitly synthetic test fixtures, excluded from the released app, and do not establish live source reachability.

## v0.08 sky seam correction

The artistic sky alone was rebaked from periodic 3D fields. Diffuse haze stays attenuated by 62%, galaxies use uncropped radial support, and the poles collapse smoothly. The map is stored losslessly to preserve its edge samples. No planetary asset or third-party photo was changed. Regeneration owner: `tools/bake_sky.py`.
