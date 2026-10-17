"""Read-only DirectRenderer startup timings; isolated software WebGL, not device FPS."""
import json, math
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]

def main():
 rows=[]
 with sync_playwright() as p:
  for trial in range(5):
   browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   try:
    page=browser.new_page();page.set_content('<canvas id="gpu"></canvas>')
    for name in ['surface-style','surface']:
     page.add_script_tag(content=(ROOT/'src'/f'{name}.js').read_text(encoding='utf-8'))
    rows.extend(page.evaluate("""async()=>{
     const canvas=document.getElementById('gpu'),g=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:false});
     if(!g)throw Error('WebGL unavailable');
     let phase={};const results=[];
     for(const name of ['compileShader','linkProgram','getShaderParameter','getProgramParameter']){
      const original=g[name].bind(g);g[name]=(...args)=>{const start=performance.now();try{return original(...args);}finally{phase[name]=(phase[name]||0)+performance.now()-start;}};
     }
     let start=performance.now(),r=new SolarSurface.DirectRenderer(canvas);
     results.push({kind:'cold-process',readyMs:performance.now()-start,...phase});r.dispose();
     phase={};start=performance.now();r=new SolarSurface.DirectRenderer(canvas);
     results.push({kind:'warm-context',readyMs:performance.now()-start,...phase});
     const extension=g.getExtension('WEBGL_lose_context');if(!extension)throw Error('Context loss extension unavailable');
     const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',resolve,{once:true}));extension.loseContext();await lost;
     const setup=r.setup.bind(r);r.setup=()=>{phase={};const begin=performance.now();setup();results.push({kind:'recovery',readyMs:performance.now()-begin,...phase});};
     const restored=new Promise(resolve=>canvas.addEventListener('webglcontextrestored',resolve,{once:true}));await new Promise(resolve=>setTimeout(resolve,50));extension.restoreContext();
     await Promise.race([restored,new Promise((_,reject)=>setTimeout(()=>reject(Error('restore timeout')),10000))]);
     if(r.contextLost)throw Error(r.stats.error||'restore failed');r.dispose();return results;
    }"""))
   finally:browser.close()
 def stats(values):
  assert values and all(math.isfinite(v) and v>=0 for v in values)
  values=sorted(values)
  return dict(samples=len(values),mean=sum(values)/len(values),p95=values[math.ceil(len(values)*.95)-1],maximum=max(values))
 summary={kind:{key:stats([row.get(key,0) for row in rows if row['kind']==kind]) for key in ['readyMs','compileShader','linkProgram','getShaderParameter','getProgramParameter']} for kind in ['cold-process','warm-context','recovery']}
 result=dict(scope='Isolated Chromium SwiftShader CPU timings with GL-call instrumentation; fresh browser per cold sample, not hardware or application FPS. OS caches may persist.',summary=summary,rows=rows)
 output=ROOT/'.cloudflare/shader-preparation-benchmark.json';output.parent.mkdir(exist_ok=True);output.write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
