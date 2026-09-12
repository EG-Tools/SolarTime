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

    # Orient the dusty stellar band across a great circle, not a flat fog stripe.
    def sky_ray(x,y):
        a,e=np.deg2rad(25),np.deg2rad(45)
        right=np.array([np.cos(a),-np.sin(a),0.])
        down=np.array([-np.sin(a)*np.sin(e),-np.cos(a)*np.sin(e),-np.cos(e)])
        forward=np.array([-np.sin(a)*np.cos(e),-np.cos(a)*np.cos(e),np.sin(e)])
        f=np.tan(np.deg2rad(38));q=right*((x*2-1)*1648/928*f)+down*((y*2-1)*f)-forward
        q/=np.linalg.norm(q);return np.array([q[0],q[1]*.866025403784-q[2]*.5,q[1]*.5+q[2]*.866025403784])
    normal = np.cross(sky_ray(.06,.48),sky_ray(.88,.06)).astype(np.float32)
    normal /= np.linalg.norm(normal)
    latitude = np.arcsin(np.clip(nx*normal[0] + ny*normal[1] + nz*normal[2], -1, 1))
    cloud = field(5)*.28 + field(14)*.28 + field(39)*.24 + field(116)*.14 + field(270)*.06
    band = np.exp(-(latitude/.13)**2) * np.clip((cloud-.28)*2.6,0,1.4)**1.6
    dust = np.exp(-((latitude + .008 + (field(9)-.5)*.12)/.041)**2) * np.clip((field(24)-.12)*1.8, 0, .96)
    dust = np.maximum(dust, np.exp(-((latitude-.048+(field(17)-.5)*.05)/.012)**2)*.62)
    # A circular, not cut-off, longitude envelope. No hidden -pi/+pi seam.
    core = .6 + np.exp((np.cos(lon-.1)-1) * (2/.75**2)) * .6
    light = band*(1-dust)*core
    rgb = np.empty((height,width,3), np.float32)
    rgb[:] = [1,2,5]
    for channel, strength in enumerate([83,88,111]):
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

    # Reference-derived photographic detail is baked onto tangent planes on the
    # sphere. Support fades before all image edges and is tested in 3D, so neither
    # the longitude seam nor a rectangular sprite boundary can be visible.
    def stamp(name,center,half_width,angle=0,gain=1):
        tex=np.asarray(Image.open(ROOT/'assets/sky'/name).convert('RGBA')).astype(np.float32)/255
        th,tw=tex.shape[:2];q=np.asarray(center,dtype=np.float32);q/=np.linalg.norm(q)
        east=np.cross(np.array([0,0,1],np.float32),q);east/=np.linalg.norm(east)
        north=np.cross(q,east);c,s=np.cos(angle),np.sin(angle)
        u=east*c+north*s;v=east*s-north*c
        denom=nx*q[0]+ny*q[1]+nz*q[2]
        threshold=np.cos(half_width*1.6)
        ys,xs=np.nonzero(denom>threshold)
        d=denom[ys,xs];scale=np.tan(half_width)
        xx=(nx[ys,xs]*u[0]+ny[ys,xs]*u[1]+nz[ys,xs]*u[2])/d/scale
        yy=(nx[ys,xs]*v[0]+ny[ys,xs]*v[1]+nz[ys,xs]*v[2])/d/(scale*th/tw)
        inside=(np.abs(xx)<1)&(np.abs(yy)<1)
        ys,xs,xx,yy=ys[inside],xs[inside],xx[inside],yy[inside]
        coords=[(yy+1)*.5*(th-1),(xx+1)*.5*(tw-1)]
        alpha=map_coordinates(tex[:,:,3],coords,order=1,mode='constant',cval=0)
        for channel in range(3):
            source=map_coordinates(tex[:,:,channel],coords,order=1,mode='constant',cval=0)*255
            # Keep the dark fissures of the reference instead of washing them out.
            existing=rgb[ys,xs,channel]
            rgb[ys,xs,channel]=existing*(1-alpha*.65)+np.maximum(0,source-2)*alpha*gain

    # A few detailed cloud knots within a mostly dark, sparse 360-degree sky.
    for x,y,span,angle,gain in [(.21,.38,.41,-.20,1.05),(.73,.115,.37,-.28,1.12)]:
        stamp('dust-reference.webp',sky_ray(x,y),span,angle,gain)
    for lon0,lat0,span,angle in [(2.6,.22,.36,.2),(-1.3,-.18,.42,-.3)]:
        stamp('dust-reference.webp',[np.cos(lat0)*np.cos(lon0),np.cos(lat0)*np.sin(lon0),np.sin(lat0)],span,angle,.84)
    stamp('galaxy-reference.webp',sky_ray(.845,.79),.205,.12,1.42)
    stamp('galaxy-reference.webp',sky_ray(.105,.155),.115,-.5,1.03)
    stamp('galaxy-reference.webp',[-.3,-.81,.5],.16,.45,1.15)

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
