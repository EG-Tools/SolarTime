"""Bake only the celestial background. No planet material is changed.

The random volume is a true 40-sample periodic lattice. The previous `% 39`
plus ndimage `wrap` skipped interpolation across different boundary samples,
leaving discontinuous planes *inside* the spherical sky. Longitude and galaxy
support are periodic too. Lossless storage keeps those joins after encoding.
"""
from pathlib import Path
import argparse
import json
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def volume_sample(grid, coordinates):
    # Unlike `wrap`, grid-wrap interpolates the last voxel back to the first.
    return map_coordinates(grid, coordinates, order=1, mode='grid-wrap', prefilter=False)


def smoothstep(x):
    t = np.clip(x, 0, 1)
    return t * t * (3 - 2 * t)


def bake(output, width=4096):
    if width < 128 or width & (width - 1):
        raise ValueError('A power-of-two width >= 128 is required for WebGL 1 repeat')
    height = width // 2
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Pixel centres: opposite meridians have one normal texel interval between them.
    lon = ((np.arange(width, dtype=np.float32) + .5) / width * (2*np.pi) - np.pi)[None, :]
    lat = (np.pi/2 - (np.arange(height, dtype=np.float32) + .5) / height * np.pi)[:, None]
    nx = np.cos(lat) * np.cos(lon)
    ny = np.cos(lat) * np.sin(lon)
    nz = np.broadcast_to(np.sin(lat), (height, width))
    grid = np.random.default_rng(106).random((40,40,40), dtype=np.float32)

    def field(scale, offset=0):
        return volume_sample(grid, [nz*scale + 19 + offset, ny*scale + 19, nx*scale + 19])

    normal = np.array([.12,.31,.943], np.float32)
    normal /= np.linalg.norm(normal)
    latitude = np.arcsin(np.clip(nx*normal[0] + ny*normal[1] + nz*normal[2], -1, 1))
    cloud = field(5)*.45 + field(14)*.32 + field(39)*.17 + field(116)*.06
    band = np.exp(-(latitude/.14)**2) * (.25 + cloud**2*2.2)
    dust = np.exp(-((latitude + .006 + (field(9)-.5)*.095)/.055)**2) * np.clip((field(18)-.24)*1.5, 0, .91)
    # A circular, not cut-off, longitude envelope. No hidden -pi/+pi seam.
    core = np.exp((np.cos(lon-.1)-1) * (2/.75**2)) * .9 + .35
    light = band*(1-dust)*core
    rgb = np.empty((height,width,3), np.float32)
    rgb[:] = [1,2,5]
    for channel, strength in enumerate([91,97,118]):
        rgb[:,:,channel] += light*strength
    neb = np.clip(field(9,6)-.60,0,.4) * np.exp(-(latitude/.33)**2) * 38
    rgb[:,:,0] += neb*.9
    rgb[:,:,2] += neb*1.9

    # Keep v0.07's reduced diffuse haze. Only this diffuse layer is filtered;
    # stars/galaxies below retain their sharp detail. Filters wrap horizontally.
    low = gaussian_filter(rgb, (max(1,width/256), max(1,width/256), 0), mode=('reflect','wrap','nearest'))
    rgb = np.maximum(0, rgb - low*.62)
    image = Image.fromarray(np.clip(np.rint(rgb),0,255).astype(np.uint8))
    draw = ImageDraw.Draw(image, 'RGB')
    random = np.random.default_rng(607)
    for _ in range(38000):
        x = int(random.random()*width)
        y = min(height-1, int(np.arccos(random.uniform(-1,1))/np.pi*height))
        brightness = int(35 + random.random()**3*181)
        size = 1 if random.random()<.985 else 2
        color = (brightness, int(brightness*.94), min(255,int(brightness*1.06)))
        if size == 1:
            draw.point((x,y), fill=color)
        else:
            # Splats crossing the meridian wrap, rather than being cropped.
            for px in (x-width,x,x+width):
                draw.ellipse((px-1,y-1,px+1,y+1), fill=color)
    rgb = np.asarray(image).astype(np.float32)

    # Radial galaxy support: sample the entire rotated shape and fade smoothly
    # to zero before its bounding rectangle. Never paste a cropped rectangle.
    ratio = width/4096
    for cx,cy,scale,angle in [(720,865,80,.5),(3110,1350,107,-.6),(2360,415,61,.9),(1170,1510,48,-.2)]:
        cx,cy,scale = cx*ratio,cy*ratio,scale*ratio
        radius = int(np.ceil(scale*2))+2
        xs = np.arange(int(cx)-radius,int(cx)+radius+1)
        ys = np.arange(max(0,int(cy)-radius),min(height,int(cy)+radius+1))
        xx,yy = np.meshgrid(xs+.5-cx,ys+.5-cy)
        c,s = np.cos(angle),np.sin(angle)
        u,v = (xx*c+yy*s)/scale,(-xx*s+yy*c)/(scale*.40)
        rho = np.hypot(u,v)
        phi = np.arctan2(v,u)
        arms = (.5+.5*np.cos(phi*2-rho*10+1))**4
        taper = 1-smoothstep((rho-1.35)/.65)
        spiral = (np.exp(-rho*2)*(.16+.58*arms)+np.exp(-rho*rho*48)*1.2)*taper
        for channel,strength in enumerate([128,132,154]):
            rgb[np.ix_(ys,xs % width,[channel])] += spiral[:,:,None]*strength

    # A pole is one direction, not thousands of different longitude samples.
    # Collapse only the last two degrees of the map smoothly to the row mean.
    cap = max(2, round(height*2/180))
    for y in range(cap):
        weight = float(smoothstep(y/(cap-1)))
        for row in (y,height-1-y):
            rgb[row] = rgb[row].mean(axis=0)*(1-weight)+rgb[row]*weight
    pixels = np.clip(np.rint(rgb),0,255).astype(np.uint8)
    Image.fromarray(pixels).save(output, lossless=True, method=4)
    # Verify the distributed, decoded bytes, not just the in-memory source.
    decoded = np.asarray(Image.open(output).convert('RGB'))
    assert np.array_equal(decoded,pixels), 'Panorama encoding altered the boundary samples'
    assert np.all(decoded[0] == decoded[0,0]) and np.all(decoded[-1] == decoded[-1,0])
    print(json.dumps({'file':str(output),'size':[width,height],'bytes':output.stat().st_size,'lossless':True}))
    return pixels


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'assets/universe.webp')
    parser.add_argument('--width',type=int,default=4096)
    args = parser.parse_args()
    bake(args.output,args.width)
