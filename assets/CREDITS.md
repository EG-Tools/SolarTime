# Solar Time v0.25 — image sources and licenses

## Already embedded in this package

**Earth:** NASA Blue Marble Next Generation. Visualization by Reto Stöckli and Robert Simmon / NASA Earth Observatory. Converted from the Basemap-distributed `bmng.jpg` and resampled to 4096×2048 WebP in v0.06. Earth bytes are unchanged in v0.07. This is not live weather.

https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation-5935/

**Pluto:** NASA/JHUAPL/SwRI, New Horizons Ralph/MVIC global color mosaic. The 5926×2963 source was resized to 4096×2048 WebP. The source's unobserved black southern wedge is filled only for continuous spherical display by softly extending nearby measured color; it must not be treated as measured southern terrain. The old synthetic Pluto relief layer is not packed with this photograph.

https://science.nasa.gov/resource/pluto-global-color-map/

**Uranus:** NASA/Caltech Voyager 2 image from 1986-01-24. Because this is a disk photograph rather than a global map, Solar Time samples its well-exposed inner atmosphere into a seamless 2048×1024 map and repeats the nearly featureless observed hemisphere on the unseen side. No fictional storms are added.

https://science.nasa.gov/asset/webb/uranus-voyager-2/

**Europa:** USGS / NASA-JPL-Caltech Voyager image mosaic supplied as NASA's Europa 3D-model texture preview. The grayscale albedo mosaic is resized to 2048×1024 and given a restrained ice-and-rust tint; geography is not procedurally added.

https://science.nasa.gov/3d-resources/jupiter-europa/

**Fallback maps, clouds, relief and sky:** artistic procedural material assets authored for Solar Time. These are not scientific mosaics or an accurate star catalogue. In v0.07 the diffuse low-frequency component of the existing 360-degree sky is attenuated by 62%; small star details remain. Original fallbacks remain visible until an optional public replacement is received.

No font file or third-party stock Saturn photograph from a reference screenshot is redistributed here. The user-provided Saturn view is a visual reference, not a spherical texture copied from an unknown license source.

## Optional replacement maps fetched by the application

These maps are **not pre-downloaded in the distributed source package**. Their exact approved URLs and immutable mirror versions are in `src/materials.js`. Once received in a user's browser, the app can cache them and embed them into an exported standalone HTML.

### Solar System Scope / INOVE

Textures courtesy of Solar System Scope, developed by INOVE.

Source and attribution: https://www.solarsystemscope.com/textures/
License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/

Maps used: Saturn, Neptune, Venus atmosphere, Jupiter, Mars and Mercury; Moon only as a fallback if the NASA source fails. Uranus is excluded from this replacement catalogue because the embedded NASA/Caltech Voyager 2 material is authoritative for v0.25. The source pack uses NASA imagery/elevation, artist-adjusted colors, and fictional terrain in unmapped gaps. It is not a set of current, perfectly calibrated scientific observations.

Changes made after receipt: image decoding, maximum-width reduction to 4096 while retaining 2:1 projection, WebP re-encoding at quality 0.95. Native 2048 maps remain 2048. Existing unrelated synthetic relief maps are removed from the corresponding material. Actual received source URL, credit and dimensions are recorded in the exported app.

Published mirror locations (not authors of the original textures):
- `Whitebee7/solarsystem` at commit `235e72c02e825e0c8d0792ec0aa6be43e1a14f68`, under `textures/`, served by jsDelivr. Its LICENSE-textures.md separately attributes these maps to Solar System Scope under CC BY 4.0.
- `Shriisoot/Planets-texture` at commit `9c2aedaeb89f35814401873f22ce78bb02421dea`: `4k_venus_atmosphere.jpg`, served by jsDelivr.

The mirrors do not change the source pack's attribution requirement. No Pluto or Europa map from these repositories is used.

### NASA Scientific Visualization Studio — Moon

NASA's Scientific Visualization Studio / LRO / LROC. Visualization by Ernie Wright (USRA). Scientist: Noah Petro (NASA/GSFC). The global color mosaic comes from Lunar Reconnaissance Orbiter camera data assembled by the instrument teams.

Source: https://svs.gsfc.nasa.gov/4720/
Image: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg

2025 color-map version, 2048×1024 JPEG. The source describes these maps as optimized for aesthetics rather than scientific use. After receipt, Solar Time re-encodes to WebP without increasing its native dimensions. The NASA attribution is used only when this NASA image supplied the material; a Solar System Scope fallback carries Solar System Scope attribution instead.

## Orbit reference for the displayed satellites

Moon relative to Earth (DE441) and Europa relative to Jupiter (`jup365_merged`) were queried from NASA/JPL Horizons at 2026-09-13 00:00 TDB. Solar Time retains the resulting orbital plane and phase, then uses fixed two-decimal eccentricities (Moon 0.05, Europa 0.01) and mean sidereal periods. Positions are calculated directly from the selected simulation timestamp. Long-term perturbations, tidal recession and metre-scale annual distance changes are intentionally excluded.

https://ssd.jpl.nasa.gov/horizons/

## Exclusions and validation limits

The downloaded-map catalogue does not replace the existing Earth, Sun, Pluto, Uranus or Europa assets. The Saturn ring is separately rendered rather than taken from a photograph of the whole planet. Network/decoder tests use explicitly synthetic test fixtures, excluded from the released app, and do not establish live source reachability.

## v0.08 sky seam correction

The artistic sky alone was rebaked from periodic 3D fields. Diffuse haze stays attenuated by 62%, galaxies use uncropped radial support, and the poles collapse smoothly. The map is stored losslessly to preserve its edge samples. No planetary asset or third-party photo was changed. Regeneration owner: `tools/bake_sky.py`.

## v0.11 reference-style background

The project owner supplied the original AI-generated Solar System illustration and asked to match the circled space-background areas. Two small regions from the original **unannotated** image were isolated as masked sky references: `assets/sky/dust-reference.webp` and `assets/sky/galaxy-reference.webp`. They contain no names, planet disks, orbit lines or drawn annotation circles. They are the user's supplied artwork, not NASA observation products or images downloaded from a third-party stock site.

These fragments are feathered into a lossless 4096×2048 artistic panorama using spherical tangent-plane projection alongside procedural stars and a dusty stellar band. Every fragment is fully transparent at its crop boundary. The panorama is not a measured all-sky atlas. Individual planetary textures and their existing attribution are unchanged.
