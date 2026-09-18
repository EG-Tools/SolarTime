/* Approved material parameters shared by direct GPU, worker and CPU adapters. */
(function(root){
  'use strict';
  const sun=Object.freeze({crawl:.24,warpY:150,warpX:56,warpX2:48,warpY2:138,
    warpAmountX:.00121125,warpAmountY:.0009025,waveX:52,waveY:150,waveX2:64,waveY2:176,
    brightBase:-.00855,brightAmount:.073625,darkBase:-.01425,darkAmount:.03705,
    glow:Object.freeze([.08075,.0247,.0019])});
  const f=n=>Number.isInteger(n)?n+'.':String(n);
  const warpGLSL=`if(kind==2.&&sunActivity>.5){
    float crawl=effectTime*${f(sun.crawl)};
    vec2 warp=vec2(sin(uv.y*${f(sun.warpY)}+sin(uv.x*PI*${f(sun.warpX)}+crawl)*1.7+crawl)*${f(sun.warpAmountX)},
      sin(uv.x*PI*${f(sun.warpX2)}-sin(uv.y*${f(sun.warpY2)}-crawl*.8)+crawl*.7)*${f(sun.warpAmountY)});
    uv=vec2(fract(uv.x+warp.x),clamp(uv.y+warp.y,.001,.999));
  }`;
  const lightingGLSL=`float lum=dot(base,vec3(.2126,.7152,.0722));
    float bright=smoothstep(.46,.72,lum),dark=1.-smoothstep(.22,.35,lum);
    float waveA=sin(uv.x*PI*${f(sun.waveX)}+uv.y*${f(sun.waveY)}+effectTime*.73);
    float waveB=sin(uv.x*PI*${f(sun.waveX2)}-uv.y*${f(sun.waveY2)}-effectTime*.41);
    float brightCycle=.5+.5*(waveA*.62+waveB*.38);
    float darkCycle=.5+.5*(waveA*.32-waveB*.68);
    float active=step(.5,sunActivity);
    float gain=1.+active*(bright*(${f(sun.brightBase)}+${f(sun.brightAmount)}*brightCycle)+dark*(${f(sun.darkBase)}+${f(sun.darkAmount)}*darkCycle));
    float facing=.4+.6*sqrt(n.z);
    col=base*(1.05+.45*pow(n.z,.5))*gain;
    col+=active*vec3(${sun.glow.map(f).join(',')})*bright*brightCycle*facing;`;
  const seam=Object.freeze({minBand:2,maxBand:32,ratio:.012});
  const api=Object.freeze({sun,seam,warpGLSL,lightingGLSL});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SolarSurfaceStyle=api;
})(typeof window==='object'?window:globalThis);
