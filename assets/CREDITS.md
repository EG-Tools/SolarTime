# Solar Time — Credits and Sources

This document lists the media, scientific references and third-party components currently used by Solar Time. Version-by-version changes belong in [`CHANGELOG.md`](../CHANGELOG.md), not in this credit record.

## Audio

### Background music

The ambient background tracks are created by Lyrikey with Suno AI.

- Lyrikey: https://suno.com/@lyrikey

### Default alarm sound

“Soft Morning” by Maryan Dembitskyi is provided through Pixabay for free use. Solar Time loops the sound until the user stops or snoozes the alarm.

- Maryan Dembitskyi — Soft Morning: https://pixabay.com/ko/users/marmixer-6762941/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=484625

## Venus surface and atmosphere

The cloud-free surface is NASA's Magellan radar mosaic, with gaps filled by a global texture. It is a radar-based visualization, not a natural-colour photograph. The 1440×720 NASA source is resampled to a power-of-two 4096×2048 master for WebGL; this does not add measured detail. `tools/prepare-venus-surface.cjs` verifies the original checksum and builds 256/512/1024/2048/4096 LOD tiers. Its explicit `--publish` option uploads only these immutable textures and verifies public bytes before connecting the local runtime to R2.

- NASA / JPL-Caltech: https://science.nasa.gov/3d-resources/venus/
- Original: https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/venus/Venus.tif

The existing Solar System Scope / INOVE Venus atmosphere map (CC BY 4.0) remains the cloud layer. This local visual mode intentionally co-rotates clouds with the surface (not the observed atmospheric superrotation), with a slightly raised projected shell at 1.02 times the surface radius. The shell height is visually exaggerated and the slider adjusts uniform opacity without fractal weather. These are illustrative controls, not reconstructed observations; Venus does not naturally clear to reveal its surface in visible light.

- Cloud texture: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_4k_venus_atmosphere.jpg
- NASA cloud motion: https://science.nasa.gov/photojournal/venus-multiple-views-of-high-level-clouds/
- NASA cloud height: https://science.nasa.gov/photojournal/venus-from-mariner-10/

## Earth maps

### Daylight map

The Earth surface uses NASA Earth Observatory’s Blue Marble Next Generation. The image is a prepared global composite, not live weather.

- NASA Earth Observatory — Blue Marble Next Generation: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation-5935/

### Night lights

The night-light layer is derived from NASA Earth Observatory’s official 2016 Black Marble 3 km VIIRS map. Solar Time resizes the measured light-only source and applies a warm colour tone. The layer appears only on the solar night side and is partially obscured by clouds. It is a yearly composite, not a live view of electric-light activity.

- NASA Earth Observatory — Earth at Night: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/

### Atmospheric clouds

The atmospheric cloud layer is derived from NASA Visible Earth’s Blue Marble global cloud composite. Solar Time converts the official 8192×4096 luminance map into a 4096×2048 grayscale master, then generates independent LOD tiers with a softly matched longitude seam. It is a fixed multi-day composite, not live weather.

- NASA Visible Earth — Blue Marble: Clouds: https://visibleearth.nasa.gov/images/57747/blue-marble-clouds/77558l
- NASA source image: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif

The previous Solar Time cloud map remains an optional secondary pattern (A, `clouds-alt`), referenced from its existing immutable media URLs at up to 2048×1024. Its edges are feathered once on upload and it repeats twice horizontally and vertically; the newer NASA composite (B, `clouds`) retains its whole-map 4096×2048 scale. Both patterns are blended regionally on one atmospheric shell, with independent illustrative birth/death cycles. This is not a weather forecast or simulation of measured winds.

## Solar System Scope textures

Mercury, Venus’s atmosphere, the Moon, Mars, Jupiter, Saturn and Neptune use maps from Solar System Scope / INOVE. The source pack combines NASA imagery and elevation data with artist-adjusted colours and reconstructed terrain in unmapped areas, so it is not a current or perfectly calibrated scientific data set.

- Texture collection: https://www.solarsystemscope.com/textures/
- Mercury: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mercury.jpg
- Venus atmosphere: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_4k_venus_atmosphere.jpg
- Moon: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_moon.jpg
- Mars: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mars.jpg
- Jupiter: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_jupiter.jpg
- Saturn: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_saturn.jpg
- Saturn rings: https://www.solarsystemscope.com/textures/download/8k_saturn_ring_alpha.png
- Neptune: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_2k_neptune.jpg

Textures courtesy of Solar System Scope, developed by INOVE.

License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

The Saturn ring colour/alpha map is supplied by Solar System Scope / INOVE. Solar Time preserves the original 8192×500 PNG in immutable R2 storage and averages the strip height into an axisymmetric radial profile, with lossless 256/512/1024/2048/4096×1 WebP tiers. Inner and outer edges are not longitude-wrapped or seam-blended. The standard GPU renderer samples the source's colour and transparency; a procedural approximation remains available while loading, offline, or in the non-WebGL compatibility renderer. `tools/prepare-saturn-rings.cjs --publish` uploads and verifies only the new ring files, without deploying the app.

## AI-assisted artistic reconstructions

The following maps are artistic spherical reconstructions made with OpenAI ImageGen from the cited scientific references. They preserve the broad visual identity of each body but contain illustrative detail and must not be treated as measured global maps.

- **Sun:** NASA/GSFC/Solar Dynamics Observatory imagery — https://science.nasa.gov/photojournal/image-of-sun-from-nasas-solar-dynamics-observatory/
- **Pluto:** NASA/JHUAPL/SwRI New Horizons global colour mosaic — https://science.nasa.gov/resource/pluto-global-color-map/
- **Uranus:** NASA Uranus observations — https://science.nasa.gov/asset/webb/uranus-voyager-2/
- **Europa:** USGS / NASA-JPL-Caltech Voyager mosaic — https://science.nasa.gov/3d-resources/jupiter-europa/

The prompts used to create these reconstructions and the Earth night-light palette study are recorded in [`IMAGEGEN_PROMPTS.md`](IMAGEGEN_PROMPTS.md).

## Project-authored visual material

Fallback maps, relief effects, rings, the solar corona and other supporting visual materials are authored or procedurally rendered for Solar Time unless another source is listed above.

The space background is an artistic panorama assembled from project-owner-supplied AI artwork and procedural stars, dust and haze. It is not a measured all-sky atlas or an accurate star catalogue. The current package does not redistribute a third-party stock Saturn photograph or an unknown-license planetary screenshot.

## Astronomy and ephemeris references

Planetary positions use NASA/JPL approximate-position formulae for the current-era range and a long-term element model for the remainder of the supported presentation range. The Moon, Europa and Pluto use dedicated models. Solar eclipses caused by the Moon use global shadow-event calculations; Europa events use a physical umbral-intersection test.

Reference dates are stored as geometric J2000 ecliptic vectors and compared with NASA/JPL Horizons by the offline test suite. The released app does not contact Horizons at runtime.

- NASA/JPL approximate positions: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- NASA/JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- Astronomy Engine by Don Cross: https://github.com/cosinekitty/astronomy

Astronomy Engine is redistributed under the MIT License. Its copyright notice and license text remain embedded in `src/astronomy-engine.min.js`.

## Planetary-alignment references

Solar Time distinguishes Earth-observer sky groupings from space-centred alignments. Space-centred dates are calculated by the project’s offline scanner; curated observer dates use the references below.

- NASA — Planetary Alignments and Planet Parades: https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/
- Star Walk — What Is a Planet Parade?: https://starwalk.space/en/news/what-is-planet-parade

The generated space-centred dates are model results, not named official astronomical events.

## Physical-property references

Planetary temperature and gravity values primarily use NASA/NSSDCA fact sheets. Giant-planet temperatures represent an atmospheric pressure comparable to Earth’s sea-level pressure because those planets have no solid surface. Displayed low-to-high ranges are compact educational context rather than complete atmospheric profiles.

- NASA/NSSDCA Planetary Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- NASA — Temperatures Across Our Solar System: https://science.nasa.gov/solar-system/temperatures-across-our-solar-system/
- NASA — Europa Clipper FAQ: https://science.nasa.gov/mission/europa-clipper/mission-faq/
- NASA — Pluto Facts: https://science.nasa.gov/dwarf-planets/pluto/facts/
- NASA — Sun Facts: https://science.nasa.gov/sun/facts/

## Accuracy notice

Solar Time is an educational and ambient visualization. Texture colours, unobserved terrain, body sizes, orbit spacing and event presentation may be adjusted for readability. It is not a precision ephemeris and must not be used for observation planning, navigation or mission operations.
