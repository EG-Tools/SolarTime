"""Solar Time v0.14: continuous full-sphere artistic sky, not an observation map.

No rectangular photograph stamps. Every diffuse feature is evaluated from a
unit direction; cubic periodic volume noise has continuous first derivatives.
Galaxy support fades to zero BEFORE its finite tangent-plane evaluation ends.
Output is lossless 2:1 equirectangular WebP, sampled at texel centres.

Development only: Python 3 + numpy + scipy + Pillow. Normal users need no Python.
"""
from pathlib import Path
import argparse
import json
import numpy as np
from scipy.ndimage import map_coordinates, spline_filter
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TAU = 2 * np.pi

def smoothstep(x):
    t = np.clip(x, 0, 1)
    return t*t*t*(t*(t*6-15)+10)

def volume_sample(grid, coordinates):
    # grid-wrap interpolates across the last/first *different* samples.
    return map_coordinates(grid, coordinates, order=3, mode='grid-wrap', prefilter=False)

def sky_ray(x, y):
    a, e = np.deg2rad(25), np.deg2rad(45)
    right = np.array([np.cos(a), -np.sin(a), 0.])
    down = np.array([-np.sin(a)*np.sin(e), -np.cos(a)*np.sin(e), -np.cos(e)])
    forward = np.array([-np.sin(a)*np.cos(e), -np.cos(a)*np.cos(e), np.sin(e)])
    f = np.tan(np.deg2rad(38))
    q = right*((x*2-1)*1648/928*f)+down*((y*2-1)*f)-forward
    q /= np.linalg.norm(q)
    return np.array([q[0], q[1]*np.sqrt(.75)-q[2]*.5, q[1]*.5+q[2]*np.sqrt(.75)])

def bake(output, width=4096):
    if width < 128 or width & (width-1):
        raise ValueError('Width must be a power of two >= 128')
    height = width//2
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(140614)
    grid = spline_filter(rng.random((48,48,48), dtype=np.float32), order=3, mode='grid-wrap').astype(np.float32)
    normal = np.cross(sky_ray(.025,.56), sky_ray(.91,.10)); normal /= np.linalg.norm(normal)
    core = sky_ray(.69,.22)
    lon = ((np.arange(width, dtype=np.float32)+.5)/width*TAU-np.pi)[None,:]
    lat = (np.pi/2-(np.arange(height, dtype=np.float32)+.5)/height*np.pi)[:,None]
    image = np.empty((height,width,3), np.uint8)
    # Each galaxy is a direction and a spherical angular radius, not a UV rectangle.
    galaxies = [(sky_ray(.835,.77), .12, .42, 1.4),
                (sky_ray(.11,.17), .075, -.55, .9),
                (np.array([-.38,-.86,.34]), .12, -.3, 1.1),
                (np.array([.48,-.30,-.82]), .09, .65, .75)]
    for y0 in range(0,height,64):
        la = lat[y0:y0+64]
        nx = np.cos(la)*np.cos(lon); ny = np.cos(la)*np.sin(lon)
        nz = np.broadcast_to(np.sin(la),nx.shape)
        def field(scale, offset=0):
            return volume_sample(grid,[nz*scale+17.31+offset,ny*scale+23.14,nx*scale+9.27])
        f4, f10, f23 = field(4), field(10), field(23)
        cloud = .28*f4+.25*f10+.20*f23+.14*field(55)+.08*field(126)+.05*field(286)
        latitude = np.arcsin(np.clip(nx*normal[0]+ny*normal[1]+nz*normal[2],-1,1))
        warp = (f10-.5)*.09+(f23-.5)*.033
        width_field = .105+(f4-.5)*.035
        envelope = np.exp(-((latitude+warp)/width_field)**2)
        core_dot = nx*core[0]+ny*core[1]+nz*core[2]
        core_gain = .55+1.15*np.exp((core_dot-1)*5)
        density = envelope*core_gain*np.clip((cloud-.23)*3.8,0,1.65)**2
        lanes = np.exp(-((latitude+warp+.006)/.023)**2)*(.48+f23*.55)
        lanes += .54*np.exp(-((latitude+warp-.045-(f4-.5)*.035)/.011)**2)
        extinction = np.exp(-np.clip(lanes,0,1.5)*2.55)
        knots = np.clip((field(37,5)-.38)*2.4,0,1.4)
        light = density*extinction*(.62+.45*knots)
        halo = np.exp(-((latitude+warp)/.235)**2)*core_gain*.55
        rgb = np.empty((*nx.shape,3),np.float32); rgb[:] = [1.2,1.9,3.6]
        rgb += light[...,None]*np.array([50,54,69],np.float32)
        rgb += halo[...,None]*np.array([1.8,2.0,3.0],np.float32)
        emission = np.maximum(field(13,7)-.65,0)*np.exp(-(latitude/.17)**2)*55
        rgb += emission[...,None]*np.array([.85,.15,.75],np.float32)
        # Continuous, asymmetric logarithmic spirals with feathered spherical support.
        for center, radius, angle, gain in galaxies:
            q = center/np.linalg.norm(center)
            pole = np.array([0,0,1.]) if abs(q[2])<.95 else np.array([0,1.,0])
            east = np.cross(pole,q); east /= np.linalg.norm(east); north = np.cross(q,east)
            c,s = np.cos(angle),np.sin(angle)
            u = east*c+north*s; v = -east*s+north*c
            dot = nx*q[0]+ny*q[1]+nz*q[2]
            # Spherical circular fade reaches zero well inside the evaluation cap.
            angle_distance = np.arccos(np.clip(dot,-1,1))
            support = 1-smoothstep((angle_distance/radius-.68)/.30)
            mask = support>0
            if not mask.any():
                continue
            den = np.maximum(dot[mask],.1)*np.tan(radius)
            x = (nx[mask]*u[0]+ny[mask]*u[1]+nz[mask]*u[2])/den
            y = (nx[mask]*v[0]+ny[mask]*v[1]+nz[mask]*v[2])/den/.37
            r = np.hypot(x,y); phi=np.arctan2(y,x)
            arms = .5+.5*np.cos(2*phi-6*np.log(r+.10)+.7*np.sin(phi*3))
            spiral = np.exp(-r*4)*(.17+.83*arms**5)
            nucleus = np.exp(-(r/.085)**2)
            dust_lane = 1-.53*np.exp(-((y+.07*np.sin(x*7))/.048)**2)*np.clip(r*6,0,1)
            galaxy = (spiral[:,None]*np.array([97,111,148])+nucleus[:,None]*np.array([186,156,107]))*dust_lane[:,None]
            rgb[mask] += galaxy*support[mask,None]*gain
        image[y0:y0+len(la)] = np.clip(np.rint(rgb),0,255).astype(np.uint8)
    # Uniform solid-angle star distribution. A spherical Gaussian is elongated in
    # longitude exactly as required by equirectangular projection, never at random.
    pixels = image.astype(np.float32)
    rng = np.random.default_rng(614038)
    for _ in range(32000):
        longitude = rng.uniform(-np.pi,np.pi)
        latitude = np.arcsin(rng.uniform(-1,1))
        px = (longitude/TAU+.5)*width-.5; py=(.5-latitude/np.pi)*height-.5
        sigma_y = (.24+rng.random()*.27)*(width/4096)
        sigma_x = sigma_y/max(.03,np.cos(latitude))
        strength = 26+190*rng.random()**4
        warm = rng.random()
        tint = np.array([1,.91,.76]) if warm<.22 else np.array([.85,.92,1.])
        rx,ry=max(1,int(np.ceil(sigma_x*3))),max(1,int(np.ceil(sigma_y*3)))
        xs=np.arange(int(np.floor(px))-rx,int(np.floor(px))+rx+2)
        ys=np.arange(max(0,int(np.floor(py))-ry),min(height,int(np.floor(py))+ry+2))
        if not len(ys): continue
        fall=np.exp(-.5*(((xs-px)/sigma_x)[None,:]**2+((ys-py)/sigma_y)[:,None]**2))
        pixels[ys[:,None],(xs%width)[None,:]] += fall[...,None]*strength*tint
    # The actual pole is one direction: cap blending is smooth and has zero slope.
    cap=max(2,round(height*.8/180))
    for i in range(cap):
        weight=float(smoothstep(i/(cap-1)))
        for row in (i,height-1-i):
            pixels[row] = pixels[row].mean(axis=0)*(1-weight)+pixels[row]*weight
    pixels=np.clip(np.rint(pixels),0,255).astype(np.uint8)
    Image.fromarray(pixels).save(output,lossless=True,method=6)
    decoded=np.asarray(Image.open(output).convert('RGB'))
    assert np.array_equal(decoded,pixels)
    assert np.all(decoded[0]==decoded[0,0]) and np.all(decoded[-1]==decoded[-1,0])
    metrics={'version':'0.14','size':[width,height],'bytes':output.stat().st_size,
             'lossless':True,'singleColourPoles':True,'rectangularStamps':0,
             'seamMeanByteDifference':float(np.abs(decoded[:,0].astype(float)-decoded[:,-1]).mean()),
             'adjacentMeanByteDifference':float(np.abs(np.diff(decoded.astype(np.int16),axis=1)).mean())}
    print(json.dumps(metrics,ensure_ascii=False))
    return pixels,metrics

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--width',type=int,default=4096)
    parser.add_argument('--output',type=Path,default=ROOT/'assets/universe.webp')
    args=parser.parse_args()
    _,metrics=bake(args.output,args.width)
    (ROOT/'docs').mkdir(exist_ok=True)
    (ROOT/'docs/sky-validation-v0.14.json').write_text(json.dumps(metrics,indent=2)+'\n')
