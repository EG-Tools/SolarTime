"""Real WebGL/Canvas2D pixel tests. Fails (does not skip) when WebGL is unavailable.
Shader baseline for comparison is the r7 radial sampling formula, not an old runtime.
No services, textures, credentials, or native iPhone measurements are involved.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,sys
ROOT=Path(__file__).resolve().parents[2]
PROBE=r'''()=>{
const n=32,canvas=document.createElement('canvas');canvas.width=canvas.height=n;
const g=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
if(!g)throw Error('WebGL is required for tiny-star pixel regression');
const effects=SolarVisualEffects,buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);
function shader(type,src){const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;}
function program(sources){const p=g.createProgram(),v=shader(g.VERTEX_SHADER,sources.vertex),f=shader(g.FRAGMENT_SHADER,sources.fragment);g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);g.deleteShader(v);g.deleteShader(f);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));g.useProgram(p);
 for(const [name,offset]of [['position',0],['appearance',12]]){const a=g.getAttribLocation(p,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,3,g.FLOAT,false,24,offset);}
 const u=Object.fromEntries(['right','down','forward','size','fov','pointScale','seconds'].map(k=>[k,g.getUniformLocation(p,k)]));g.uniform3f(u.right,1,0,0);g.uniform3f(u.down,0,1,0);g.uniform3f(u.forward,0,0,1);g.uniform2f(u.size,n,n);g.uniform1f(u.fov,1);return {p,u};}
g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.disable(g.DITHER);g.viewport(0,0,n,n);g.clearColor(0,0,0,1);
const pixels=new Uint8Array(n*n*4),metrics=values=>{const min=Math.min(...values),max=Math.max(...values),mean=values.reduce((a,b)=>a+b)/values.length;return {min,max,mean,relativeRange:(max-min)/mean};};
function energy(){let total=0;for(let i=0;i<pixels.length;i+=4)total+=pixels[i]+pixels[i+1]+pixels[i+2];return total;}
function frame(u,r,ratio,fx,fy,time=0){g.uniform1f(u.pointScale,ratio);g.uniform1f(u.seconds,time);g.bufferData(g.ARRAY_BUFFER,new Float32Array([(n/2+fx)/(n/2)-1,(n/2+fy)/(n/2)-1,-1,r,.7,1.5]),g.DYNAMIC_DRAW);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.POINTS,0,1);g.readPixels(0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,pixels);return energy();}
const gpu=[],temporal=[];
for(const precision of ['highp','mediump']){
 const {p,u}=program(effects.starShaderSources(precision));
 for(const ratio of [.75,1,1.5])for(const r of [.14,.3,.54]){
  const values=[];for(let k=0;k<=32;k++)values.push(frame(u,r,ratio,k/32,k/32));
  gpu.push({precision,ratio,radius:r,...metrics(values)});
 }
 for(const r of [.14,.54,.8]){const values=[];for(let k=0;k<=40;k++)values.push(frame(u,r,1,.25,.375,k*2.25));temporal.push({precision,radius:r,...metrics(values)});}
 g.deleteProgram(p);
}
// Reproduce the old tiny radial sampling at the same locations, in actual GL.
const prior=effects.starShaderSources('highp');
prior.fragment=`precision highp float;varying highp float intensity;void main(){float d=length(gl_PointCoord-.5);float a=((1.-smoothstep(.08,.48,d))*.08+(1.-smoothstep(.01,.16,d))*.48)*intensity;if(a<.002)discard;gl_FragColor=vec4(vec3(1.),a);}`;
const old=program(prior),oldValues=[];for(let k=0;k<=32;k++)oldValues.push(frame(old.u,.14,1,k/32,k/32));g.deleteProgram(old.p);
const legacy=metrics(oldValues);
const two=document.createElement('canvas');two.width=two.height=n;const ctx=two.getContext('2d',{willReadFrequently:true});
const cpu=[];
for(const ratio of [.75,1,1.5,2])for(const r of [.14,.3,.54]){
 const values=[];
 for(let k=0;k<=32;k++){
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,n,n);
  ctx.setTransform(ratio,0,0,ratio,0,0);effects.drawTinyStar(ctx,(n/2+k/32)/ratio,(n/2+k/32)/ratio,r,.7,1.5,ratio);
  pixels.set(ctx.getImageData(0,0,n,n).data);values.push(energy());
 }
 cpu.push({ratio,radius:r,...metrics(values)});
}
const ext=g.getExtension('WEBGL_debug_renderer_info'),renderer=ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);
return {renderer,error:g.getError(),legacy,gpu,temporal,cpu};
}'''

def main():
 with sync_playwright() as p:
  opt={'headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):opt['executable_path']=os.environ['SOLAR_CHROMIUM_EXECUTABLE']
  browser=p.chromium.launch(**opt)
  try:
   page=browser.new_page();page.add_script_tag(content=(ROOT/'src/visual-effects.js').read_text(encoding='utf8'));result=page.evaluate(PROBE)
  finally:browser.close()
 out=ROOT/'.cloudflare/tiny-star-regression.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf8')
 assert result['error']==0,result
 assert result['legacy']['relativeRange']>.5,('Baseline did not reproduce radial shimmer',result['legacy'])
 for row in result['gpu']:
  assert row['min']>0 and row['relativeRange']<.12,('GPU subpixel light instability',row)
 for row in result['temporal']:
  if row['radius']<.55:assert row['relativeRange']==0,('Tiny-star brightness animated',row)
  else:assert row['relativeRange']>.1,('Large star animation removed',row)
 for row in result['cpu']:
  assert row['min']>0 and row['relativeRange']<.15,('Canvas sprite light instability',row)
 print('WebGL renderer:',result['renderer'])
 print('Old radial relative range:',result['legacy']['relativeRange'])
 print('Worst filtered GPU relative range:',max(x['relativeRange'] for x in result['gpu']))
 print('Worst filtered Canvas2D relative range:',max(x['relativeRange'] for x in result['cpu']))
 print('PASS: 18 GPU motion sweeps, 6 temporal sweeps, 12 Canvas2D motion sweeps.')
if __name__=='__main__':main()
