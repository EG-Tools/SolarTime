# Solar Time v0.52 — sources and licenses

The exact built-in ImageGen prompts used for the current Sun, Pluto, Uranus and Europa reconstructions, plus the Earth night-light palette study, are recorded in `assets/IMAGEGEN_PROMPTS.md`.

## Already embedded in this package

**Earth:** NASA Blue Marble Next Generation. Visualization by Reto Stöckli and Robert Simmon / NASA Earth Observatory. Converted from the Basemap-distributed `bmng.jpg` and resampled to 4096×2048 WebP in v0.06. This is not live weather.

https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation-5935/

**Earth night lights:** NASA Earth Observatory's official 13,500×6,750 grayscale 2016 Black Marble 3 km map supplies the complete measured VIIRS night-radiance image. Solar Time resizes that light-only source directly to 4096×2048 and applies a warm colour tone without extracting, reshaping, blurring, or inventing lights. The map is revealed only on the solar night side and the cloud layer partially obscures it. This is a yearly composite, not a live view of electric-light activity.

https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/

**Sun:** NASA/GSFC/Solar Dynamics Observatory, SDO/AIA 171 Å full-disk image captured 2025-09-10 was used as the visual reference. Solar Time's 4096×2048 WebP is an OpenAI ImageGen artistic re-creation of the reference's golden plasma filaments and active-region vocabulary, generated as a complete seamless spherical texture rather than stretching the photographed disk. The antimeridian and pole texels were then converged for spherical display. The off-limb corona and image caption are excluded because Solar Time renders its own separate corona effect. This generated surface is not a current or instantaneous full-Sun scientific map.

https://science.nasa.gov/photojournal/image-of-sun-from-nasas-solar-dynamics-observatory/

**Pluto:** NASA/JHUAPL/SwRI, New Horizons Ralph/MVIC global color mosaic was used as the visual reference. Solar Time's 4096×2048 WebP is an AI-assisted artistic re-creation made with OpenAI ImageGen: the observed broad color and landmark identity guided the generated full-globe albedo map, while the poorly observed southern hemisphere was newly synthesized rather than mirrored or stretched. The antimeridian and pole texels were then converged for spherical display. The generated map, especially the southern terrain, must not be treated as measured scientific data. The old relief layer is not packed as a separate bump map with this texture.

https://science.nasa.gov/resource/pluto-global-color-map/

**Uranus:** A user-supplied NASA Uranus observation was used as the visual reference. Solar Time's 2048×1024 WebP is a new OpenAI ImageGen artistic re-creation made directly as a full 2:1 equirectangular atmosphere map rather than stretching a photographed disk. It keeps the reference's calm cyan/turquoise appearance, restrained atmospheric bands and sparse pale cloud traces; it is not a measured global mosaic. The antimeridian and pole texels are converged for spherical display. Rings are rendered separately as multiple narrow, faint child rings and are not baked into the texture.

https://science.nasa.gov/asset/webb/uranus-voyager-2/

**Europa:** The USGS / NASA-JPL-Caltech Voyager image mosaic supplied through NASA's 3D resources was used as the visual and geological reference. Solar Time's 4096×2048 WebP is an OpenAI ImageGen artistic re-creation designed to remove the visibly mixed-resolution areas of the older map while retaining Europa's pale ice, reddish-brown lineae and chaos-terrain vocabulary. Detail in the reconstruction is illustrative rather than measured geography. The antimeridian and pole texels are converged for spherical display.

https://science.nasa.gov/3d-resources/jupiter-europa/

**Fallback maps, clouds, relief and sky:** artistic procedural material assets authored for Solar Time. These are not scientific mosaics or an accurate star catalogue. In v0.07 the diffuse low-frequency component of the existing 360-degree sky is attenuated by 62%; small star details remain. Original fallbacks remain visible until an optional public replacement is received.

No font file or third-party stock Saturn photograph from a reference screenshot is redistributed here. The user-provided Saturn view is a visual reference, not a spherical texture copied from an unknown license source.

## Packaged high-resolution maps — Solar System Scope / INOVE

Solar Time v0.41 packages the high-resolution 2:1 maps for Mercury, Venus's atmosphere, Mars, Jupiter, Saturn, Neptune and the Moon. They are converted to WebP and published as immutable 512/1024/2048/4096 width tiers through the Solar Time media service; the application chooses a tier from the body's real on-screen coverage. The 8192-pixel rocky-body and Moon sources are reduced to 4096 pixels with Lanczos resampling. Neptune remains at its native 2048-pixel width rather than being falsely advertised as a 4K map.

Mercury, the Moon and Mars use the photographed detail in these colour maps without the older synthetic relief layer, avoiding duplicated or exaggerated crater and terrain shading. Venus uses its atmospheric colour map and ordinary spherical lighting; no crater relief map is applied.

Textures courtesy of Solar System Scope, developed by INOVE. The source pack combines NASA imagery/elevation, artist-adjusted colors and fictional terrain in unmapped gaps, so it is not a current or perfectly calibrated scientific data set.

Source and attribution: https://www.solarsystemscope.com/textures/

Archived source files and individual license pages:
- Mercury: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mercury.jpg
- Venus atmosphere: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_4k_venus_atmosphere.jpg
- Mars: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mars.jpg
- Jupiter: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_jupiter.jpg
- Saturn: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_saturn.jpg
- Neptune: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_2k_neptune.jpg
- Moon: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_moon.jpg

License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/

Uranus, Pluto, the Sun and Europa continue to use their separately credited maps above. Earth's daylight map remains unchanged; its separate night-light layer is credited above.

## Astronomy and ephemeris reference

Planetary positions use the NASA/JPL approximate-position formula fitted for 1800–2050 and its long-term element table for the remaining 2051–2999 presentation range. Moon, Europa and Pluto positions use dedicated Astronomy Engine models. Solar eclipses caused by the Moon use global shadow-event calculations, while Europa transits use a physical umbral-intersection test rather than the illustrative screen orbit.

Multiple reference dates are stored as geometric J2000 ecliptic vectors from NASA/JPL Horizons and compared automatically by the offline test suite. Horizons is a validation source; the released app does not contact it at runtime.

- JPL approximate positions: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- Astronomy Engine 2.1.19 by Don Cross: https://github.com/cosinekitty/astronomy

Astronomy Engine is redistributed under the MIT License. Its copyright notice and license text remain embedded at the beginning of `src/astronomy-engine.min.js`.

## Planetary-alignment catalog

The Sun card lists only dates involving five or more planets and keeps two geometries visibly distinct. The original curated Earth-observer sky-parade dates remain unchanged. Space-centred dates are generated separately by `tools/scan-space-alignments.cjs`: all eight major planets are evaluated once per UTC day from 1800 through 2999, and a date qualifies only when at least five lie within 2° of one three-dimensional diameter through the Sun. Planets on opposite sides of the Sun may share that diameter. A golden viewport guide is anchored to Earth for sky entries and to the Sun for space entries; its small perpendicular connectors show each participating planet's residual from the best-fit projected axis.

Broad same-side groupings are not described as straight-line space alignments. Four-planet dates are intentionally excluded, and the often-repeated claim of seven planets on 2034-02-03 is not included because it conflicts with NASA's late-February five-planet description. The generated space-centred dates are model results, not named official astronomical events.

- NASA explanation and future observing windows: https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/
- Published future-date catalog used for the curated day-level entries: https://starwalk.space/en/news/what-is-planet-parade

## Temperature and gravity reference

Mean planetary temperatures and surface-gravity values use NASA/NSSDCA's metric Planetary Fact Sheet. For Jupiter, Saturn, Uranus and Neptune, the temperature is the value at an atmospheric pressure comparable to Earth's sea-level pressure because these worlds have no solid surface. The card also shows a compact representative low-to-high range; rocky-body extremes and Europa/Pluto ranges follow NASA Science fact pages, while giant-planet ranges are illustrative atmospheric context rather than a complete minimum/maximum through the planet's depth.

https://nssdc.gsfc.nasa.gov/planetary/factsheet/
https://science.nasa.gov/solar-system/temperatures-across-our-solar-system/
https://science.nasa.gov/mission/europa-clipper/mission-faq/
https://science.nasa.gov/dwarf-planets/pluto/facts/
https://science.nasa.gov/sun/facts/

## Exclusions and validation limits

The downloaded-map catalogue does not replace the existing Earth, Sun, Pluto, Uranus or Europa assets. The Saturn ring is separately rendered rather than taken from a photograph of the whole planet. Network/decoder tests use explicitly synthetic test fixtures, excluded from the released app, and do not establish live source reachability.

## v0.08 sky seam correction

The artistic sky alone was rebaked from periodic 3D fields. Diffuse haze stays attenuated by 62%, galaxies use uncropped radial support, and the poles collapse smoothly. The map is stored losslessly to preserve its edge samples. No planetary asset or third-party photo was changed. Regeneration owner: `tools/bake_sky.py`.

## v0.11 reference-style background

The project owner supplied the original AI-generated Solar System illustration and asked to match the circled space-background areas. Two small regions from the original **unannotated** image were isolated as masked sky references: `assets/sky/dust-reference.webp` and `assets/sky/galaxy-reference.webp`. They contain no names, planet disks, orbit lines or drawn annotation circles. They are the user's supplied artwork, not NASA observation products or images downloaded from a third-party stock site.

These fragments are feathered into a lossless 4096×2048 artistic panorama using spherical tangent-plane projection alongside procedural stars and a dusty stellar band. Every fragment is fully transparent at its crop boundary. The panorama is not a measured all-sky atlas. Individual planetary textures and their existing attribution are unchanged.
