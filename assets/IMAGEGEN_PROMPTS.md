# Solar Time v0.36 ImageGen prompts

The final `assets/pluto.webp`, `assets/sun.webp`, `assets/uranus.webp`, and `assets/europa.webp` maps were created with the built-in OpenAI ImageGen tool. The project finishing tools close the left/right seam, stabilize pole rows, and normalize them to the documented 2:1 WebP sizes.

## Earth night-light palette reference

These studies are archived visual references only and are not used by the production texture. The shipped map comes directly from NASA's official 13,500×6,750 grayscale Black Marble 2016 radiance image; `tools/prepare-earth-night.cjs` only resizes it and applies a monotonic warm colour tone.

### High-detail refinement reference

The second study tightened the treatment after close-up testing exposed merged clusters in the first version. It remains documentation only: the production texture adds no generated glow or spatial reconstruction to the official NASA source.

```text
Use case: scientific-educational. Asset type: lighting-treatment reference for a production WebGL Earth night-side emissive texture. Input image: official NASA Black Marble global composite; use it as the geographic authority and preserve its real distribution of settlements and transport corridors. Primary request: demonstrate a substantially sharper, higher-quality city-light treatment made of fine discrete light points and narrow connected urban networks, with dense cities retaining internal detail instead of merging into white blobs. Style/medium: realistic orbital satellite composite, not illustration. Composition/framing: exact flat 2:1 equirectangular world map. Lighting/mood: restrained emissive lighting on pure black, crisp cores with only a sub-pixel soft halo. Color palette: natural warm ivory, muted sodium amber and occasional neutral white; avoid uniform orange. Constraints: dark oceans and unlit terrain remain completely black; preserve fine local variation; no invented settlements; no daylight terrain, borders, labels, grids, clouds, aurora, fires, stars, atmosphere, planet sphere, vignette, text or watermark. Avoid: broad bloom, chunky dots, smeared clusters, horizontal streaks, painterly patterns, repeated noise, overexposure and neon color.
```

### Initial palette reference

```text
Use case: scientific-educational. Asset type: visual style reference for a production WebGL Earth night-side emissive map. Use the attached official NASA Black Marble global composite as the geographic authority. Preserve an exact flat 2:1 equirectangular composition and the real continental distribution of artificial lights. Isolate urban and transport-network radiance against pure black, using restrained warm ivory, pale amber and soft gold with a very small natural bloom around the brightest metropolitan clusters. Keep dark oceans and unlit land completely black. No daylight terrain, borders, labels, grids, clouds, aurora, fires, stars, atmosphere, planet sphere, vignette, text or invented settlements. Avoid neon orange, broad glowing continents, exaggerated bloom, uniform dots, repeated patterns and painterly styling.
```

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

## Uranus

```text
Create a brand-new scientific-inspired WebGL asset using the attached NASA Uranus observation only as visual mood and color reference, not as a literal crop or reconstruction. Output a seamless 2:1 equirectangular diffuse/albedo texture map covering the full 360-degree atmosphere of Uranus. The entire canvas must be the flat map: no spherical planet disk, no rings, no black space, no stars, no text, no labels, no watermark, no vignette, no limb darkening, no cast shadow, and no specular highlight. Use smooth cyan, turquoise, and blue-green cloud layers like the reference, with very subtle low-contrast latitudinal atmospheric banding, a restrained pale cyan band, fine soft cloud haze, and a few faint elongated white-cyan cloud traces. Uranus should remain calm and mostly featureless, not stormy like Neptune or Jupiter. Use even neutral illumination, texture detail that wraps naturally around a sphere, pole-safe distortion, and make the left and right edges visually seamless. High-resolution production texture, wide 2:1 composition, clean continuous surface with no seams.
```

## Europa

```text
Use case: scientific-educational
Asset type: production-ready spherical surface texture for Jupiter's moon Europa in the Solar Time WebGL application
Input images: Image 1 is a visual reference for Europa's pale cream ice, reddish-brown lineae, branching fractures, and mottled chaos terrain; use it as identity and palette guidance, not as a layout that must be preserved pixel-for-pixel.
Primary request: recreate Europa as a new, uniformly high-detail full-globe 2:1 equirectangular texture. Every longitude and latitude must have equally crisp, coherent fine ice grain, thin intersecting reddish-brown fractures, subtle ridges, and occasional restrained chaos-terrain patches. Eliminate the reference's blurry, stretched, low-resolution central zones and any visible difference in detail density.
Composition/framing: exact flat longitude-latitude world map covering the full rectangular canvas edge to edge; intended to wrap once around a sphere. Left and right edges must join seamlessly, and polar regions must converge cleanly without radial pinching artifacts.
Lighting/mood: neutral diffuse albedo only, evenly lit everywhere; no directional light, terminator, shadow, glow, atmosphere, specular highlight, vignette, or three-dimensional sphere shading.
Color palette: natural Europa ivory, pale warm beige ice, restrained ochre and rusty brown fracture lines; avoid yellow saturation and black cracks.
Materials/textures: crisp but natural fine-scale ice texture, layered lineae of varying width, subtle mottling, consistent sharpness across the entire map.
Constraints: one continuous seamless 2:1 equirectangular surface; no circular planet, no background, no horizon, no labels, no text, no grid, no borders, no stars, no watermark. Do not leave empty or smooth blurry areas. No obvious repeated tile, mirrored continent, seam, or single giant focal feature.
```
