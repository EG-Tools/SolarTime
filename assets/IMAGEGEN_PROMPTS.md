# Solar Time v0.25 ImageGen prompts

The final `assets/pluto.webp` and `assets/sun.webp` maps were created with the built-in OpenAI ImageGen tool, then normalized by `tools/prepare_v025_textures.py` to 4096×2048 WebP maps with closed left/right seams and stabilized pole rows.

## Pluto

```text
Use case: scientific-educational
Asset type: production planetary albedo texture for a real-time GPU-rendered Pluto sphere
Input images: Image 1 is the NASA New Horizons global color mosaic and the primary visual reference.
Primary request: Re-create a complete, coherent full-globe Pluto surface texture from the reference. Preserve the observed northern and equatorial visual identity—Tombaugh Regio's large pale heart-like nitrogen-ice basin, charcoal and deep rust-red lowlands, gray-white ice, subdued green-gray mineral hints, rugged ridges and varied impact craters. Invent the missing southern hemisphere as plausible Pluto-like terrain derived from the same geological vocabulary; do not copy, mirror, vertically stretch, smear, or radially pull the photographed pixels.
Style/medium: realistic spacecraft planetary albedo mosaic, scientifically plausible but explicitly artistic in unobserved regions.
Composition/framing: one flat 2:1 equirectangular world map spanning exactly 360 degrees longitude and 180 degrees latitude. North pole is the entire top edge; south pole is the entire bottom edge. This must be a texture map, not a picture of a sphere.
Lighting/mood: uniform diffuse albedo with no directional light, no cast shadows, no dark limb, no atmospheric glow, no vignette.
Materials/textures: continuous multiscale icy geology and craters; feature scale and color must transition naturally across the reconstructed southern hemisphere.
Constraints: left and right edges must be visually seamless and tileable; both pole rows must converge smoothly without starburst, pinwheel, radial wedges, stretching, tears, black/no-data regions, duplicated landmarks, or obvious generative boundary. Preserve broad landmark placement from the reference where observed. No text, labels, grid, border, watermark, space background, planet silhouette, 3D sphere, terminator, rings, or stars.
Avoid: mirrored terrain, repeated bands, vertical smearing, radial streaks, painterly style, exaggerated saturation, invented oceans or clouds.
```

## Sun

```text
Use case: scientific-educational visual material. Asset type: production albedo/emissive texture for a real-time GPU-rendered Sun sphere. Image 1 is an official NASA/GSFC Solar Dynamics Observatory SDO/AIA 171 Å full-disk image and is the primary visual reference. Re-create its rich golden solar surface vocabulary—fine plasma granulation, tangled filament channels, restrained dark coronal-hole-like structures, and scattered bright magnetic active regions—as one complete coherent full-globe texture. Composition: a single flat exact 2:1 equirectangular map spanning 360 degrees longitude and 180 degrees latitude; north pole is the entire top edge and south pole the entire bottom edge. This must be a texture map, never a picture of a sphere. Distribute many small and medium structures naturally across the whole map; no single giant bright patch. Lighting: uniform emissive/albedo exposure with no directional lighting, cast shadow, limb darkening, vignette, halo, corona, rays, flares extending beyond an edge, black space, or baked spherical shading. Color: sophisticated deep amber, molten gold and pale yellow highlights matching the reference, preserving broad dynamic range without white clipping. Constraints: left and right edges tile seamlessly; both pole rows converge smoothly; continuous multiscale plasma detail; no horizontal or vertical smears, radial stretching, pinwheel poles, mirrored hemispheres, duplicated landmarks, obvious repeated bands, seams, text, timestamp, label, watermark, border, grid, stars, planet silhouette, 3D sphere, or empty region. Avoid: smooth generic noise, painted brush texture, regular cells, enormous active region, over-saturation, uniform yellow.
```
