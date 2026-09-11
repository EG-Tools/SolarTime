"""Deterministic offline material bake. Earth: bundled NASA Blue Marble NG.
All other materials and panorama are artistic shader inputs, not observation maps.
Requires numpy, scipy, Pillow only for regeneration; runtime is dependency-free.
"""
from pathlib import Path
import json, sys
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets';OUT.mkdir(exist_ok=True)
rng=np.random.default_rng(106)
W,H=4096,2048
lon=np.linspace(-np.pi,np.pi,W,endpoint=False,dtype='float32')[None,:]
lat=np.linspace(np.pi/2,-np.pi/2,H,dtype='float32')[:,None]
nx=np.cos(lat)*np.cos(lon);ny=np.cos(lat)*np.sin(lon);nz=np.broadcast_to(np.sin(lat),(H,W))
noisegrid=rng.random((40,40,40),dtype=np.float32)
def field(scale,offset=0):
    return map_coordinates(noisegrid,[(nz*scale+19+offset)%39,(ny*scale+19)%39,(nx*scale+19)%39],order=1,mode='wrap',prefilter=False)
def fbm(scales=(3,8,23,65)):
    out=np.zeros((H,W),np.float32)
    for s,a in zip(scales,(.48,.29,.16,.07)):out+=field(s)*a
    return out
base=fbm()
def save(id,rgb,quality=93):
    a=np.clip(rgb,0,255).astype('uint8')
    # All longitudes are periodic; blend only the final pixel pair to avoid a seam.
    av=(a[:,0,:].astype('float32')+a[:,-1,:])/2;a[:,0,:]=av;a[:,-1,:]=av
    Image.fromarray(a).save(OUT/(id+'.webp'),quality=quality,method=4)
    print(id,(OUT/(id+'.webp')).stat().st_size,flush=True)

# Satellite-derived land/ocean detail, not polygon coastlines.
earthpath=Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'earth.webp'
earth=np.asarray(Image.open(earthpath).convert('RGB').resize((W,H),Image.Resampling.LANCZOS)).astype('float32')

if not (OUT/'earth.webp').exists(): save('earth',earth)
# A separate, semi-transparent cloud layer: weather is illustrative.
cloud=np.clip((field(5,.3)*.65+field(17)*.23+field(57)*.12-.5)*4.0,0,1)
cloud*=.78+.22*np.cos(lat*5)**2

if not (OUT/'clouds.webp').exists(): save('clouds',np.repeat((cloud*255)[:,:,None],3,axis=2),89)

# Rock: continuous spherical relief and geodesic craters (no polygonal stamps).
for id in ['moon','mercury','mars','pluto']:
    if (OUT/(id+'-relief.webp')).exists(): continue
    seed={'moon':43,'mercury':47,'mars':53,'pluto':59}[id];r=np.random.default_rng(seed)
    relief=(field(12)*.50+field(47)*.30+field(141)*.20-.5)*.16
    albedo=base.copy()
    if id=='moon':
        mare=np.clip((field(2.7,2)-.51)*4,0,.9)
        albedo=albedo*.48+.38-mare*.29
    for k in range(1250 if id=='moon' else 600):
        u=r.uniform(-np.pi,np.pi);v=np.arcsin(r.uniform(-.93,.93));rad=.003+float(r.random()**3)*.045
        xc=int((u+np.pi)/(2*np.pi)*W);yc=int((np.pi/2-v)/np.pi*H)
        ry=max(2,int(rad*H/np.pi*1.65));rx=max(2,int(ry/max(.15,np.cos(v))))
        xs=np.arange(xc-rx,xc+rx+1);ys=np.arange(max(0,yc-ry),min(H,yc+ry+1));xx,yy=np.meshgrid(xs,ys)
        d=np.sqrt(((xx-xc)*np.cos(v))**2+(yy-yc)**2)/(rad*H/np.pi)
        bowl=-np.exp(-(d/.70)**4)*.085;rim=np.exp(-((d-.98)/.12)**2)*.10
        influence=(bowl+rim)*min(1,rad/.009)
        indices=(ys[:,None],xs[None,:]%W)
        relief[indices]+=influence.astype('float32')
        albedo[indices]+=((rim*.6+bowl*.13)*(1 if id=='moon' else .5)).astype('float32')
    if id=='moon':rgb=np.stack([albedo*218+20,albedo*218+19,albedo*217+18],-1)
    elif id=='mercury':rgb=np.stack([albedo*199+30,albedo*185+26,albedo*170+23],-1)
    elif id=='mars':
        rgb=np.stack([albedo*180+56,albedo*117+35,albedo*83+22],-1)
        ice=np.clip((np.abs(lat)-1.38)*11,0,.85);rgb=rgb*(1-ice[...,None])+223*ice[...,None]
    else:
        heart=np.exp(-((nx+.70)**2+(ny-.50)**2+(nz-.2)**2)*8)
        rgb=np.stack([albedo*141+68,albedo*135+58,albedo*130+51],-1)+heart[...,None]*38
    save(id,rgb)
    save(id+'-relief',np.repeat(np.clip(.5+relief,0,1)[:,:,None]*255,3,-1),95)
    del rgb,relief,albedo

# Broad cream zones / irregular warm belts, with multiscale advected turbulence.
warp=(field(7)-.5)*.050+(field(23)-.5)*.020+(field(73)-.5)*.006
phi=lat+warp
belts=np.zeros((H,W),np.float32)
for center,width,depth in [(-63,8,.30),(-46,4,.24),(-28,5,.70),(-12,4,.85),(11,6,.80),(29,4,.60),(48,7,.45),(64,8,.30)]:
 belts+=np.exp(-((phi-center*np.pi/180)/(width*np.pi/180))**2)*depth
belts=np.clip(belts,0,1)
turb=field(29)*.46+field(83)*.31+field(217)*.23
filaments=np.sin(phi*370+field(37)*11)*.03+(turb-.5)*.38
weight=np.clip(belts+filaments,0,1)
rgb=np.zeros((H,W,3),np.float32)
for k,(cream,brown) in enumerate([(231,155),(221,113),(199,80)]):rgb[:,:,k]=cream*(1-weight)+brown*weight+(turb-.5)*34
# Feathery vortex, not concentric target rings; static illustrative longitude 70E.
du=np.arctan2(np.sin(lon-70*np.pi/180),np.cos(lon-70*np.pi/180));dx=du/.23;dy=(lat+22*np.pi/180)/.11
rr=np.sqrt(dx*dx+dy*dy);angle=np.arctan2(dy,dx)
flow=angle+3*np.exp(-rr*rr*.8)
vv=map_coordinates(noisegrid,[(np.broadcast_to(rr,(H,W))*6+13)%39,(np.sin(flow)*rr*8+19)%39,(np.cos(flow)*rr*8+19)%39],order=1,mode='wrap',prefilter=False)
strand=np.sin(angle*3+np.log(rr+.15)*7+(vv-.5)*9)*.06+(vv-.5)*.42
spot=np.stack([197+strand*100,109+strand*110,69+strand*115],-1)
mask=np.exp(-(rr/.99)**6)*.94
halo=np.exp(-((rr-1.10)/.22)**2)*14
rgb=rgb*(1-mask[...,None])+spot*mask[...,None]+halo[...,None]
save('jupiter',rgb,95)


# Banded atmospheres: advected multi-scale eddies and one well-defined Jovian vortex.
for id in ['jupiter','saturn','venus','uranus','neptune','sun']:
    if (OUT/(id+'.webp')).exists() and (OUT/(id+'.webp')).stat().st_size>1000: continue
    frequency={'jupiter':62,'saturn':105,'venus':32,'uranus':50,'neptune':66,'sun':90}[id]
    warp=(field(6)-.5)*.06+(field(19)-.5)*.012
    wave=(lat+warp)*frequency
    bands=np.sin(wave)*.11+np.sin(wave*2.14+field(13)*3)*.045+(base-.5)*.7
    t=np.clip(.51+bands,0,1)
    if id=='jupiter':
        rgb=np.stack([110+135*t,83+143*t,68+134*t],-1)
        # GRS around 70E / 22S. Longitudinal location is illustrative, not its live ephemeris.
        du=np.arctan2(np.sin(lon-70*np.pi/180),np.cos(lon-70*np.pi/180))
        dx=du/.21;dy=(lat+22*np.pi/180)/.11;rr=np.sqrt(dx*dx+dy*dy)
        spiral=np.sin(rr*28-np.arctan2(dy,dx)*2+field(23)*4)*.5+.5
        spot=np.stack([181+spiral*42,82+spiral*47,49+spiral*37],-1)
        mask=np.clip((1.28-rr)*4,0,1)
        rgb=rgb*(1-mask[...,None])+spot*mask[...,None]
    elif id=='saturn':rgb=np.stack([171+64*t,145+65*t,100+82*t],-1)
    elif id=='venus':rgb=np.stack([181+61*t,139+77*t,80+103*t],-1)
    elif id=='uranus':rgb=np.stack([105+t*21,175+t*24,185+t*25],-1)
    elif id=='neptune':rgb=np.stack([35+t*25,82+t*45,155+t*56],-1)
    else:
        t=np.clip(.42+field(64)*.33+(field(187)-.5)*.20+(base-.5)*.5,0,1)
        rgb=np.stack([238+t*22,84+t*160,8+t*71],-1)
    save(id,rgb)

# Complete sphere, not a repeated screen picture. Dark dusty galactic band + stars.
normal=np.array([.12,.31,.943],np.float32);normal/=np.linalg.norm(normal)
b=np.arcsin(np.clip(nx*normal[0]+ny*normal[1]+nz*normal[2],-1,1))
cloud=field(5)*.45+field(14)*.32+field(39)*.17+field(116)*.06
gal=np.exp(-(b/.14)**2)*(.25+cloud**2*2.2)
dust=np.exp(-((b+.006+(field(9)-.5)*.095)/.055)**2)*np.clip((field(18)-.24)*1.5,0,.91)
core=np.exp(-((lon-.1)/.75)**2)*.9+.35
light=gal*(1-dust)*core
rgb=np.zeros((H,W,3),np.float32);rgb[:]=[1,2,5]
for ch,f in enumerate([91,97,118]):rgb[:,:,ch]+=light*f
neb=np.clip(field(9,6)-.60,0,.4)*np.exp(-(b/.33)**2)*38
rgb[:,:,0]+=neb*.9;rgb[:,:,2]+=neb*1.9
image=Image.fromarray(np.clip(rgb,0,255).astype('uint8'))
d=ImageDraw.Draw(image,'RGB');r=np.random.default_rng(607)
for k in range(38000):
    x=int(r.random()*W);y=int((np.arccos(r.uniform(-1,1)))/np.pi*H)
    brightness=int(35+r.random()**3*181);size=1 if r.random()<.985 else 2
    col=(brightness,int(brightness*.94),min(255,int(brightness*1.06)))
    if size==1:d.point((x,y),fill=col)
    else:d.ellipse((x-1,y-1,x+1,y+1),fill=col)
# Small distant galaxies are painterly/illustrative and embedded in celestial directions.
arr=np.asarray(image).astype('float32')
for xc,yc,scale,angle in [(720,865,80,.5),(3110,1350,107,-.6),(2360,415,61,.9),(1170,1510,48,-.2)]:
    xs=np.arange(max(0,xc-scale*2),min(W,xc+scale*2));ys=np.arange(max(0,yc-scale),min(H,yc+scale))
    xx,yy=np.meshgrid(xs-xc,ys-yc);c=np.cos(angle);s=np.sin(angle)
    u=(xx*c+yy*s)/scale;v=(-xx*s+yy*c)/(scale*.40);rho=np.sqrt(u*u+v*v);phi=np.arctan2(v,u)
    arms=(.5+.5*np.cos(phi*2-rho*10+1))**4
    spiral=(np.exp(-rho*2)*(.16+.58*arms)+np.exp(-rho*rho*48)*1.2)*np.clip(2-rho,0,1)
    for k,f in enumerate([128,132,154]):arr[np.ix_(ys,xs,[k])]+=spiral[:,:,None]*f
save('universe',arr,92)
# Explicit bright stellar directions are twinkled in the GPU on top of the panorama.
r=np.random.default_rng(481)
stars=[]
for i in range(210):
    z=r.uniform(-1,1);a=r.random()*2*np.pi;rr=np.sqrt(1-z*z)
    stars.append([float(rr*np.cos(a)),float(rr*np.sin(a)),float(z),float(r.uniform(.6,1.9)),float(r.uniform(.15,.75)),float(r.random()*25)])
(OUT/'stars.json').write_text(json.dumps(stars,separators=(',',':')))
