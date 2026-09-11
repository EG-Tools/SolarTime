/* Solar Time v0.02 — dependency-free, depth-projected Canvas renderer.
   Textures and star field are original procedural artwork, not astronomical imagery. */
(function () {
  'use strict';
  const A=window.SolarAstro, {TAU,DEG,clamp}=A;
  function random(seed) { return function() { let t=seed+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  const mix=(a,b,t)=>a+(b-a)*t;
  function noise(x,y) {
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const hash=(a,b)=>{ let h=Math.imul(a,374761393)+Math.imul(b,668265263); h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967295; };
    return mix(mix(hash(ix,iy),hash(ix+1,iy),sx),mix(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
  }
  function fbm(x,y) { return noise(x,y)*.53+noise(x*2.03+19,y*2.03)*.27+noise(x*4.11,y*4.11+37)*.13+noise(x*8.17,y*8.17)*.07; }
  const palettes={
    mercury:[[62,57,54],[129,120,108],[193,183,168]],
    venus:[[161,111,47],[218,181,111],[247,222,164]],
    mars:[[86,43,29],[176,84,48],[226,155,108]],
    jupiter:[[113,77,61],[197,160,125],[241,224,190]],
    saturn:[[143,122,87],[206,188,144],[242,226,184]],
    uranus:[[67,143,158],[127,195,204],[185,230,228]],
    neptune:[[22,50,133],[43,93,192],[104,162,228]],
    pluto:[[91,64,52],[158,125,100],[213,196,165]],
    moon:[[66,67,69],[135,135,132],[208,205,196]],
    sun:[[233,71,3],[255,157,17],[255,239,140]]
  };
  function colorAt(p,t) { t=clamp(t,0,1); const i=t<.5?0:1, f=t<.5?t*2:(t-.5)*2; return p[i].map((v,j)=>mix(v,p[i+1][j],f)); }
  // Hand-drawn, simplified geographic masks in longitude/latitude, intentionally not a GIS map.
  const continents=[
    [[-168,70],[-150,71],[-134,60],[-126,52],[-124,41],[-118,33],[-111,30],[-105,23],[-97,19],[-88,21],[-82,26],[-81,34],[-75,40],[-66,44],[-60,52],[-69,58],[-82,62],[-92,69],[-109,73],[-130,70]],
    [[-92,20],[-88,16],[-85,10],[-78,8],[-77,5],[-81,8]],
    [[-80,10],[-69,11],[-61,6],[-50,1],[-35,-6],[-40,-20],[-49,-30],[-57,-38],[-66,-55],[-73,-51],[-74,-35],[-71,-19],[-80,-4]],
    [[-53,59],[-44,61],[-22,72],[-25,82],[-44,84],[-62,78]],
    [[-17,36],[-6,36],[11,37],[25,32],[34,31],[35,22],[44,12],[51,12],[43,-11],[35,-23],[28,-34],[18,-35],[11,-20],[9,-1],[-6,5],[-16,14]],
    [[-10,36],[-9,44],[2,50],[8,55],[7,62],[20,70],[34,71],[29,61],[40,57],[47,68],[70,73],[99,77],[128,73],[153,61],[177,64],[179,52],[163,57],[151,47],[144,45],[141,37],[131,43],[127,36],[121,30],[122,23],[112,20],[109,9],[102,2],[98,8],[99,21],[89,22],[81,8],[75,12],[67,25],[57,25],[53,17],[44,13],[36,30],[26,40],[14,41],[5,43]],
    [[113,-22],[119,-18],[129,-14],[137,-12],[143,-17],[153,-25],[150,-36],[137,-39],[129,-32],[115,-35]],
    [[47,-13],[51,-17],[48,-26],[44,-23]],[[131,32],[141,42],[145,44],[141,34]],
    [[95,5],[104,-5],[114,-8],[117,-7],[109,0]],[[132,-3],[148,-6],[145,-10],[133,-8]],
    [[167,-34],[178,-39],[172,-46],[166,-46]],
    [[-180,-72],[-145,-76],[-100,-72],[-62,-63],[-54,-72],[-14,-70],[24,-68],[70,-69],[106,-66],[150,-69],[180,-72],[180,-90],[-180,-90]]
  ];
  function createTexture(id) {
    const w=512,h=256,can=document.createElement('canvas'); can.width=w;can.height=h;
    const c=can.getContext('2d'), image=c.createImageData(w,h),data=image.data;
    let mask=null;
    if(id==='earth') {
      const land=document.createElement('canvas');land.width=w;land.height=h;
      const lc=land.getContext('2d');lc.fillStyle='white';
      for(const poly of continents) { lc.beginPath();poly.forEach(([lon,lat],i)=>{const x=(lon+180)/360*w,y=(90-lat)/180*h;i?lc.lineTo(x,y):lc.moveTo(x,y);});lc.closePath();lc.fill(); }
      mask=lc.getImageData(0,0,w,h).data;
    }
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const u=x/w,v=y/h, n=fbm(u*26+3,v*18+11), detail=noise(u*170,v*90);
      let col,t;
      if(id==='earth') {
        const lat=Math.abs(v-.5)*2,land=mask[(y*w+x)*4+3]>.5;
        if(land) {
          const desert=clamp((.28-Math.abs(lat-.28))*4,0,1)*clamp((n-.33)*3,0,1);
          col=[mix(52+n*35,172+n*25,desert),mix(86+n*46,146+n*22,desert),mix(49+n*27,96+n*23,desert)];
        } else col=[12+n*12,49+n*28,94+n*55];
        const ice=clamp((lat-.80-n*.13)*16,0,1);
        col=col.map(k=>mix(k,225,ice));
        const cloudField=fbm(u*17+noise(u*7,v*9)*1.8,v*24);
        let cloud=clamp((cloudField-.54)*5,0,.9);
        cloud*=.70+.3*Math.sin(v*90+u*13)**2;
        col=col.map(k=>mix(k,240,cloud));
      } else {
        if(['jupiter','saturn','venus','uranus','neptune'].includes(id)) {
          const freq=id==='jupiter'?54:id==='saturn'?90:35;
          const swirl=noise(u*8,v*15)*.045+Math.sin(u*TAU*3+v*28)*.004;
          t=.49+Math.sin((v+swirl)*freq)*.14+Math.sin(v*freq*2.1+n*3)*.09+(n-.5)*.35;
          if(id==='jupiter') {
            const dx=(u-.71)/.065,dy=(v-.63)/.034,spot=Math.exp(-dx*dx-dy*dy);
            col=colorAt(palettes[id],t); col=col.map((k,j)=>mix(k,[182,99,67][j],spot*.86));
          }
          if(id==='uranus')t=.53+(n-.5)*.2+Math.sin(v*freq)*.035;
          if(id==='neptune')t=.40+(n-.5)*.35+Math.sin(v*freq)*.1;
        } else if(id==='sun') {
          const granules=noise(u*210+noise(u*28,v*25),v*115);
          const veins=1-Math.abs(noise(u*98,v*64)-.5)*2;
          t=clamp(.17+n*.46+granules*.24+veins*.14,0,1);
        } else {
          t=n*.82+detail*.18;
          if(id==='moon'||id==='mercury')t=clamp((n-.33)*1.5+detail*.15,.12,.9);
          if(id==='mars') {t=n*.8+detail*.15; if(Math.abs(v-.5)>.44)t=.9;}
          if(id==='pluto')t=clamp(n*.9+Math.exp(-((u-.65)**2/.006+(v-.5)**2/.045))*.32,0,1);
        }
        col=col||colorAt(palettes[id],t);
      }
      const i=(y*w+x)*4; data[i]=col[0];data[i+1]=col[1];data[i+2]=col[2];data[i+3]=255;
    }
    c.putImageData(image,0,0);
    if(['mercury','moon','pluto','mars'].includes(id)) {
      const rng=random(id.charCodeAt(0)*3941);
      for(let i=0;i<145;i++) {
        const x=rng()*w,y=rng()*h,r=.6+rng()**3*6;
        c.beginPath();c.ellipse(x,y,r,r*.8,0,0,TAU);c.fillStyle=`rgba(26,22,22,${.05+rng()*.14})`;c.fill();
        c.beginPath();c.ellipse(x,y+.45,r,r*.8,0,.15,Math.PI+.1);c.strokeStyle='rgba(243,222,193,.18)';c.lineWidth=.7;c.stroke();
      }
    }
    return {w,h,data:c.getImageData(0,0,w,h).data};
  }
  class Renderer {
    constructor(background,canvas) {
      this.bg=background;this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
      if(!this.ctx)throw new Error('Canvas 2D is unavailable.');
      this.options={orbits:true,labels:true,twinkle:true,activity:true,pluto:true,moon:true,quality:'auto'};
      this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1};
      this.textures={};this.sprites=new Map();this.paths=[];this.hitTargets=[];this.projected=[];
      this.selected=null;this.hover=null;this.lastPathMs=NaN;this.dirty=true;this.frameCount=0;
      for(const b of [...A.BODIES,A.SUN,A.MOON])this.textures[b.id]=createTexture(b.id);
      this.resize();
    }
    resize() {
      const box=this.canvas.getBoundingClientRect();this.w=Math.max(1,box.width);this.h=Math.max(1,box.height);
      this.dpr=Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);
      // Anamorphic presentation: widen projected orbital positions, keep planet icons round.
      this.lensStretch=clamp(this.w/this.h,1,1.72);
      this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.makeBackground();this.dirty=true;this.sprites.clear();
    }
    makeBackground() {
      const w=this.w,h=this.h,dpr=Math.min(this.dpr,1.5),rng=random(73915);
      this.bg.width=Math.round(w*dpr);this.bg.height=Math.round(h*dpr);
      const c=this.bg.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
      c.fillStyle='#03060b';c.fillRect(0,0,w,h);
      // Low-resolution, cached galactic dust — not recalculated every frame.
      const mw=document.createElement('canvas');mw.width=480;mw.height=300;const mc=mw.getContext('2d');
      const image=mc.createImageData(mw.width,mw.height);
      for(let y=0;y<mw.height;y++)for(let x=0;x<mw.width;x++) {
        const u=x/mw.width,v=y/mw.height,dist=(v-(.85-u*.63));
        const n=fbm(u*9+12,v*10), fine=fbm(u*48,v*50),band=Math.exp(-dist*dist/.006);
        const dust=Math.exp(-((dist+.023+Math.sin(u*19)*.012)**2)/.00036);
        const intensity=band*(.10+n*n*.64+fine*.12)*(1-dust*.72);
        const j=(y*mw.width+x)*4;image.data[j]=55+fine*20;image.data[j+1]=61+fine*22;image.data[j+2]=81+fine*28;image.data[j+3]=intensity*220;
      }
      mc.putImageData(image,0,0);c.drawImage(mw,0,0,w,h);
      const vignette=c.createRadialGradient(w*.52,h*.55,0,w*.52,h*.55,Math.max(w,h)*.7);
      vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.62)');c.fillStyle=vignette;c.fillRect(0,0,w,h);
      const count=Math.round(clamp(w*h/800,450,2600));this.stars=[];
      for(let i=0;i<count;i++) {
        const x=rng()*w,y=rng()*h,r=.22+rng()**5*1.1,alpha=.15+rng()*.5,warm=rng()>.7;
        c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=warm?`rgba(227,208,180,${alpha})`:`rgba(201,221,244,${alpha})`;c.fill();
        if(i%31===0)this.stars.push({x,y,r:r+.25,period:8+rng()*20,offset:rng()*28,duration:.7+rng()*2.2});
      }
      // Three restrained distant bright stars.
      for(const [x,y,r] of [[w*.16,h*.39,2],[w*.83,h*.27,1.7],[w*.92,h*.7,1.3]])this.starGlow(c,x,y,r,.45);
    }
    starGlow(c,x,y,r,alpha) {
      const g=c.createRadialGradient(x,y,0,x,y,r*6);
      g.addColorStop(0,`rgba(207,226,255,${alpha})`);g.addColorStop(.15,`rgba(151,195,249,${alpha*.55})`);g.addColorStop(1,'rgba(112,161,226,0)');
      c.fillStyle=g;c.fillRect(x-r*6,y-r*6,r*12,r*12);
      c.strokeStyle=`rgba(213,228,252,${alpha*.6})`;c.lineWidth=.5;c.beginPath();c.moveTo(x-r*4,y);c.lineTo(x+r*4,y);c.moveTo(x,y-r*4);c.lineTo(x,y+r*4);c.stroke();
      c.fillStyle=`rgba(247,250,255,${alpha})`;c.beginPath();c.arc(x,y,r*.6,0,TAU);c.fill();
    }
    view(p) {
      const {azimuth:a,elevation:e}=this.camera, ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
      const x=p.x*ca-p.y*sa,y=p.x*sa+p.y*ca;
      return {x:x*this.lensStretch,y:-(y*se+p.z*ce),z:-y*ce+p.z*se};
    }
    project(p) { const v=this.view(p);return {x:this.cx+v.x*this.scale,y:this.cy+v.y*this.scale,z:v.z}; }
    getBodies() { return this.options.pluto?A.BODIES:A.BODIES.filter(b=>b.id!=='pluto'); }
    rebuild(ms) {
      this.paths=this.getBodies().map(body=>({body,points:A.orbitAt(body,ms,360)}));
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const p of this.paths)for(const v of p.points) {const q=this.view(v);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
      const mobile=this.w<680,compact=this.h<630;
      const left=mobile?24:58,right=this.w-(mobile?24:58),top=compact?100:mobile?192:190,bottom=this.h-(compact?105:mobile?195:190);
      this.scale=Math.max(.05,Math.min((right-left)/(maxX-minX),(bottom-top)/(maxY-minY)))*this.camera.zoom;
      this.cx=(left+right)/2-(minX+maxX)*this.scale/2;
      this.cy=(top+bottom)/2-(minY+maxY)*this.scale/2;
      this.bodyScale=clamp(Math.min(this.w/1330,this.h/820),.55,1.35)*Math.sqrt(this.camera.zoom);
      this.lastPathMs=ms;this.dirty=false;
    }
    setOption(key,value) { this.options[key]=value;this.dirty=true;if(key==='quality')this.resize(); }
    resetCamera() {this.camera={azimuth:25*DEG,elevation:45*DEG,zoom:1};this.dirty=true;}
    orbit(c,path,highlight) {
      const rgb=path.body.id==='earth'?'110,174,212':path.body.id==='pluto'?'155,140,127':'138,151,168';
      c.lineWidth=highlight?1.25:.72;
      if(path.body.id==='pluto')c.setLineDash([2,5]);
      // Draw each hemisphere separately to keep distant arcs restrained.
      for(let pass=0;pass<2;pass++) {
        c.strokeStyle=`rgba(${rgb},${highlight?.64:pass?.32:.17})`;c.beginPath();let active=false;
        for(const p of path.points) {const q=this.project(p),front=q.z>=0;if(front===(pass===1)){active?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);active=true;}else {if(active)c.lineTo(q.x,q.y);active=false;}}
        c.stroke();
      }
      c.setLineDash([]);
    }
    shade(body,p,r,ms,t,force=false) {
      const sun=body.id==='sun',tex=this.textures[body.id],diam=Math.max(18,Math.min(sun?180:200,Math.ceil(r*2*this.dpr*1.25)));
      const spin=A.rotationAt(body,ms);
      const key=[diam,Math.round(spin*tex.w*2),Math.round(this.camera.azimuth*100),Math.round(this.camera.elevation*100),Math.round(Math.atan2(p.y,p.x)*80),sun&&this.options.activity?Math.floor(t*12):0].join(':');
      const cached=this.sprites.get(body.id);if(cached&&cached.key===key&&!force)return cached.canvas;
      const canvas=cached&&cached.canvas.width===diam?cached.canvas:document.createElement('canvas');canvas.width=diam;canvas.height=diam;
      const c=canvas.getContext('2d'),img=c.createImageData(diam,diam),out=img.data;
      const {azimuth:a,elevation:e}=this.camera,ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
      const light=this.view({x:-p.x,y:-p.y,z:-p.z});light.x/=this.lensStretch;const len=Math.hypot(light.x,light.y,light.z)||1;
      const lx=light.x/len,ly=light.y/len,lz=light.z/len,tilt=A.rotationPoleTilt(body),ct=Math.cos(tilt),st=Math.sin(tilt);
      for(let py=0;py<diam;py++)for(let px=0;px<diam;px++) {
        const nx=(px+.5)/diam*2-1,ny=(py+.5)/diam*2-1,r2=nx*nx+ny*ny;if(r2>=1)continue;
        const nz=Math.sqrt(1-r2);
        const vx=nx,vy=-ny*se-nz*ce,vz=-ny*ce+nz*se;
        const wx=vx*ca+vy*sa,wy=-vx*sa+vy*ca,wz=vz;
        const ty=wy*ct+wz*st,tz=-wy*st+wz*ct;
        let u=A.wrap(Math.atan2(ty,wx)-spin+Math.PI)/TAU,v=Math.acos(clamp(tz,-1,1))/Math.PI;
        if(sun&&this.options.activity) {u=A.wrap(u+Math.sin(v*45+t*.65)*.007,1);v=clamp(v+Math.sin(u*37-t*.72)*.008,0,.999);}
        const tx=u*tex.w,tyi=clamp(v*tex.h,0,tex.h-1),x0=Math.floor(tx),y0=Math.floor(tyi);
        const x1=(x0+1)%tex.w,y1=Math.min(y0+1,tex.h-1),fx=tx-x0,fy=tyi-y0;
        const j00=(y0*tex.w+x0)*4,j10=(y0*tex.w+x1)*4,j01=(y1*tex.w+x0)*4,j11=(y1*tex.w+x1)*4;
        let lit=sun ? .77+.23*nz : .30+.78*Math.max(0,nx*lx+ny*ly+nz*lz);
        if(sun&&this.options.activity)lit*=1+.035*Math.sin(t*1.7+nx*20+ny*15);
        const rim=!sun&&['earth','uranus','neptune'].includes(body.id)?(1-nz)**5*.24:0;
        const i=(py*diam+px)*4;
        for(let k=0;k<3;k++) {
          const color=mix(mix(tex.data[j00+k],tex.data[j10+k],fx),mix(tex.data[j01+k],tex.data[j11+k],fx),fy);
          out[i+k]=color*lit+rim*(k===0?55:k===1?142:240);
        }
        out[i+3]=clamp((1-Math.sqrt(r2))*diam,0,1)*255;
      }
      c.putImageData(img,0,0);this.sprites.set(body.id,{key,canvas});return canvas;
    }
    corona(c,x,y,r,t) {
      const active=this.options.activity,pulse=active?1+Math.sin(t*.68)*.035:1;
      c.save();c.globalCompositeOperation='screen';
      const g=c.createRadialGradient(x,y,r*.8,x,y,r*5.9*pulse);
      g.addColorStop(0,'rgba(255,158,43,.31)');g.addColorStop(.11,'rgba(255,135,28,.20)');g.addColorStop(.33,'rgba(196,91,17,.075)');g.addColorStop(1,'rgba(123,53,7,0)');
      c.fillStyle=g;c.fillRect(x-r*6,y-r*6,r*12,r*12);
      const glow=c.createRadialGradient(x,y,r*.96,x,y,r*1.7);glow.addColorStop(0,'rgba(255,199,88,.75)');glow.addColorStop(.18,'rgba(255,146,28,.3)');glow.addColorStop(1,'rgba(252,104,10,0)');
      c.fillStyle=glow;c.fillRect(x-r*1.8,y-r*1.8,r*3.6,r*3.6);
      for(let i=0;i<15;i++) {
        const a=i*2.39996+Math.sin(i*73)*.5+(active?t*.009:0),cycle=active?((Math.sin(t*(.3+i%5*.03)+i*1.7)+1)*.5)**3:.2;
        const reach=r*(1.035+.26*cycle+(i%7===0?.12:0)),spread=.018+(i%3)*.009;
        const p0={x:x+Math.cos(a-spread)*r*.97,y:y+Math.sin(a-spread)*r*.97};
        c.beginPath();c.moveTo(p0.x,p0.y);
        c.bezierCurveTo(x+Math.cos(a-.08)*reach,y+Math.sin(a-.08)*reach,x+Math.cos(a+.07)*reach,y+Math.sin(a+.07)*reach,x+Math.cos(a+spread)*r*.97,y+Math.sin(a+spread)*r*.97);
        c.strokeStyle=`rgba(255,${135+i%6*12},34,${.045+cycle*.30})`;c.lineWidth=.55+cycle*.4;c.stroke();
      }
      c.restore();
    }
    rings(c,b,p,r,front) {
      const sat=b.id==='saturn',a=sat?-.28:-.64,flatten=sat?.35:.33;
      c.save();c.translate(p.x,p.y);c.rotate(a);c.scale(1,flatten);
      const inner=sat?1.28:1.58,outer=sat?2.26:1.94,steps=sat?58:9;
      for(let i=0;i<steps;i++) {
        const f=i/(steps-1),rr=mix(inner,outer,f)*r;
        if(sat&&f>.56&&f<.62)continue;
        const alpha=sat?(.19+.48*Math.sin(f*75)**2)*(f>.85?.6:1):.22;
        c.strokeStyle=sat?`rgba(${205+Math.round(f*25)},${180+Math.round(f*22)},${133+Math.round(f*38)},${alpha})`:`rgba(150,194,193,${alpha})`;
        c.lineWidth=(outer-inner)*r/steps*1.18;c.beginPath();c.arc(0,0,rr,front?0:Math.PI,front?Math.PI:TAU);c.stroke();
      }
      c.restore();
    }
    drawBody(c,b,world,screen,r,ms,t) {
      if(b.id==='sun')this.corona(c,screen.x,screen.y,r,t);
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,false);
      if(b.id==='earth') {
        const g=c.createRadialGradient(screen.x,screen.y,r*.86,screen.x,screen.y,r*1.2);g.addColorStop(0,'rgba(63,159,225,.12)');g.addColorStop(.58,'rgba(94,188,248,.22)');g.addColorStop(1,'rgba(74,155,219,0)');c.fillStyle=g;c.fillRect(screen.x-r*1.2,screen.y-r*1.2,r*2.4,r*2.4);
      }
      const img=this.shade(b,world,r,ms,t);c.drawImage(img,screen.x-r,screen.y-r,r*2,r*2);
      if(b.id==='saturn'||b.id==='uranus')this.rings(c,b,screen,r,true);
      if(this.selected===b.id||this.hover===b.id) {
        c.strokeStyle=this.selected===b.id?'rgba(225,203,155,.7)':'rgba(210,226,244,.4)';c.lineWidth=.8;c.beginPath();c.arc(screen.x,screen.y,r+5,0,TAU);c.stroke();
      }
    }
    labels(c,bodies) {
      const boxes=[],mobile=this.w<680;
      const font=mobile?9:10;
      c.textAlign='center';c.textBaseline='top';c.font=`500 ${font}px "Segoe UI", Arial, sans-serif`;
      if('letterSpacing' in c)c.letterSpacing='1.65px';
      for(const item of bodies.filter(p=>p.body.id!=='moon')) {
        const {body:b,screen:s,r}=item,w=c.measureText(b.en).width+10,h=font+10;
        let x=s.x,y=s.y+r+(b.id==='saturn'?11:9);
        let box={x:x-w/2,y,w,h};
        const overlaps=bb=>boxes.some(v=>bb.x<v.x+v.w&&bb.x+bb.w>v.x&&bb.y<v.y+v.h&&bb.y+bb.h>v.y)||bodies.some(v=>v!==item&&Math.abs(bb.x+bb.w/2-v.screen.x)<bb.w/2+v.r+2&&Math.abs(bb.y+bb.h/2-v.screen.y)<bb.h/2+v.r+2);
        for(const off of [[0,r+9],[0,-r-h-7],[r+w*.55+7,-h*.5],[-r-w*.55-7,-h*.5],[0,r+27]]) {
          x=clamp(s.x+off[0],w/2+8,this.w-w/2-8);y=s.y+off[1];box={x:x-w/2,y,w,h};if(!overlaps(box))break;
        }
        boxes.push(box);
        if(Math.abs(x-s.x)>10||y<s.y) {c.strokeStyle='rgba(161,179,201,.22)';c.lineWidth=.6;c.beginPath();c.moveTo(s.x,s.y+(y>s.y?r+3:-r-3));c.lineTo(x,y+h*.4);c.stroke();}
        c.shadowColor='rgba(0,0,0,.95)';c.shadowBlur=6;c.fillStyle=this.selected===b.id?'#eedbb8':b.id==='sun'?'#f1c889':'#b9c4d2';c.fillText(b.en,x,y);c.shadowBlur=0;
        this.hitTargets.push({id:b.id,x:box.x,y:box.y,w:box.w,h:box.h,label:true});
      }
      const moon=bodies.find(p=>p.body.id==='moon');
      if(moon&&this.w>700) {
        if('letterSpacing' in c)c.letterSpacing='1px';c.font='500 8px "Segoe UI", Arial';
        const text='MOON',w=c.measureText(text).width+5;
        let x=moon.screen.x,y=moon.screen.y+moon.r+6,box={x:x-w/2,y,w,h:12};
        if(boxes.some(v=>box.x<v.x+v.w&&box.x+box.w>v.x&&box.y<v.y+v.h&&box.y+box.h>v.y)) {x+=12;y-=20;}
        c.fillStyle='#7d8d9f';c.fillText(text,x,y);
      }
      if('letterSpacing' in c)c.letterSpacing='0px';
    }
    draw(ms,seconds) {
      const c=this.ctx;this.frameCount++;c.clearRect(0,0,this.w,this.h);
      if(this.dirty||Math.abs(ms-this.lastPathMs)>A.DAY*30)this.rebuild(ms);
      if(this.options.twinkle)for(const s of this.stars) {
        const phase=A.wrap(seconds+s.offset,s.period);
        if(phase<s.duration) {const alpha=Math.sin(phase/s.duration*Math.PI)**2*.85;this.starGlow(c,s.x,s.y,s.r,alpha);}
      }
      if(this.options.orbits)for(const path of this.paths)this.orbit(c,path,this.selected===path.body.id);
      const bodies=this.getBodies().map(body=>{const world=A.positionAt(body,ms,true);return {body,world,screen:this.project(world),r:body.size*this.bodyScale};});
      bodies.push({body:A.SUN,world:{x:0,y:0,z:0},screen:this.project({x:0,y:0,z:0}),r:A.SUN.size*this.bodyScale});
      const earth=bodies.find(p=>p.body.id==='earth');
      if(this.options.moon) {
        const radius=Math.max(30,earth.r*2.6/this.scale),local=A.moonAt(ms,radius);
        const world={x:earth.world.x+local.x,y:earth.world.y+local.y,z:earth.world.z+local.z};
        if(this.options.orbits) {
          const el=A.moonElements(ms);c.strokeStyle='rgba(115,155,189,.26)';c.lineWidth=.65;c.beginPath();
          for(let i=0;i<=90;i++) {const p=A.pointOnOrbit(el,i/90*TAU,radius),s=this.project({x:earth.world.x+p.x,y:earth.world.y+p.y,z:earth.world.z+p.z});i?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y);}c.stroke();
        }
        bodies.push({body:A.MOON,world,screen:this.project(world),r:A.MOON.size*this.bodyScale});
      }
      bodies.sort((a,b)=>a.screen.z-b.screen.z);
      this.hitTargets=[];
      for(const p of bodies) {
        this.drawBody(c,p.body,p.world,p.screen,p.r,ms,seconds);
        this.hitTargets.push({id:p.body.id,x:p.screen.x,y:p.screen.y,r:Math.max(p.r+6,11),z:p.screen.z});
      }
      if(this.options.labels)this.labels(c,bodies);
      this.projected=bodies;
    }
    hit(x,y) {
      for(let i=this.hitTargets.length-1;i>=0;i--) {
        const t=this.hitTargets[i];if(t.label?(x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h):Math.hypot(x-t.x,y-t.y)<t.r)return t.id;
      }
      return null;
    }
  }
  window.SolarRenderer=Renderer;
})();
