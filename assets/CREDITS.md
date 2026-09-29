# Solar Time — Credits and Sources

This document lists the media, scientific references and third-party components currently used by Solar Time. Version-by-version changes belong in [`CHANGELOG.md`](../CHANGELOG.md), not in this credit record.

## Audio

### Background music

The ambient background tracks are created by Lyrikey with Suno AI.

- Lyrikey: https://suno.com/@lyrikey

### Default alarm sound

“Soft Morning” by Maryan Dembitskyi is provided through Pixabay for free use. Solar Time loops the sound until the user stops or snoozes the alarm.

- Maryan Dembitskyi — Soft Morning: https://pixabay.com/ko/users/marmixer-6762941/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=484625

## Earth maps

### Daylight map

The Earth surface uses NASA Earth Observatory’s Blue Marble Next Generation. The image is a prepared global composite, not live weather.

- NASA Earth Observatory — Blue Marble Next Generation: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation-5935/

### Night lights

The night-light layer is derived from NASA Earth Observatory’s official 2016 Black Marble 3 km VIIRS map. Solar Time resizes the measured light-only source and applies a warm colour tone. The layer appears only on the solar night side and is partially obscured by clouds. It is a yearly composite, not a live view of electric-light activity.

- NASA Earth Observatory — Earth at Night: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/

## Solar System Scope textures

Mercury, Venus’s atmosphere, the Moon, Mars, Jupiter, Saturn and Neptune use maps from Solar System Scope / INOVE. The source pack combines NASA imagery and elevation data with artist-adjusted colours and reconstructed terrain in unmapped areas, so it is not a current or perfectly calibrated scientific data set.

- Texture collection: https://www.solarsystemscope.com/textures/
- Mercury: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mercury.jpg
- Venus atmosphere: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_4k_venus_atmosphere.jpg
- Moon: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_moon.jpg
- Mars: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_mars.jpg
- Jupiter: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_jupiter.jpg
- Saturn: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_saturn.jpg
- Neptune: https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_2k_neptune.jpg

Textures courtesy of Solar System Scope, developed by INOVE.

License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

## AI-assisted artistic reconstructions

The following maps are artistic spherical reconstructions made with OpenAI ImageGen from the cited scientific references. They preserve the broad visual identity of each body but contain illustrative detail and must not be treated as measured global maps.

- **Sun:** NASA/GSFC/Solar Dynamics Observatory imagery — https://science.nasa.gov/photojournal/image-of-sun-from-nasas-solar-dynamics-observatory/
- **Pluto:** NASA/JHUAPL/SwRI New Horizons global colour mosaic — https://science.nasa.gov/resource/pluto-global-color-map/
- **Uranus:** NASA Uranus observations — https://science.nasa.gov/asset/webb/uranus-voyager-2/
- **Europa:** USGS / NASA-JPL-Caltech Voyager mosaic — https://science.nasa.gov/3d-resources/jupiter-europa/

The prompts used to create these reconstructions and the Earth night-light palette study are recorded in [`IMAGEGEN_PROMPTS.md`](IMAGEGEN_PROMPTS.md).

## Project-authored visual material

Clouds, fallback maps, relief effects, rings, the solar corona and other supporting visual materials are authored or procedurally rendered for Solar Time unless another source is listed above.

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
