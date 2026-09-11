"""Public-image integration tests using explicit synthetic network fixtures.

No requests leave the browser. These tests prove loader/cache/export behavior,
NOT access to the live NASA/INOVE image servers. Fixtures are never bundled.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
report = {'version':'0.09','mode':'synthetic fetch fixtures; no live source downloads',
          'checks':[], 'limitations':['Public image server connectivity/CORS and hardware WebGL are not tested.','IDB persistence is not tested in the opaque injected document; cache records are supplied at the owner boundary.']}

def check(name, ok, detail=None):
    report['checks'].append({'name':name,'passed':bool(ok),'detail':detail})
    if not ok:
        raise AssertionError(f'{name}: {detail}')

PRELUDE = r'''() => {
 Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
 const c=document.createElement('canvas');c.width=2048;c.height=1024;const x=c.getContext('2d');
 // Intentionally artificial test data, not an astronomical image.
 const g=x.createLinearGradient(0,0,2048,1024);g.addColorStop(0,'#235a98');g.addColorStop(1,'#d79c58');x.fillStyle=g;x.fillRect(0,0,2048,1024);
 for(let i=0;i<32;i++){x.fillStyle=i%2?'#548073':'#89675a';x.fillRect(0,i*32,2048,9);}
 x.fillStyle='#ac6349';x.beginPath();x.ellipse(715,650,180,60,0,0,Math.PI*2);x.fill();
 const data=c.toDataURL('image/webp',.9),raw=atob(data.split(',')[1]),bytes=Uint8Array.from(raw,q=>q.charCodeAt(0));
 window.fixture={data,bytes,calls:[],active:0,maxActive:0,mode:'success',failFirstSaturn:true};
 window.fetch=(url,options={})=>new Promise((resolve,reject)=>{
  const f=window.fixture,u=String(url);f.calls.push(u);f.active++;f.maxActive=Math.max(f.maxActive,f.active);
  let done=false;const finish=(err)=>{if(done)return;done=true;f.active--;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);
   if(err){reject(err);return;}
   if(f.mode==='failure'||(f.failFirstSaturn&&u.endsWith('/8k_saturn.jpg'))||(f.mode==='moon-mirror'&&u.includes('svs.gsfc.nasa.gov'))){reject(Error('Synthetic network failure'));return;}
   resolve(new Response(bytes,{status:200,headers:{'Content-Type':'image/webp','Content-Length':String(bytes.length)}}));
  };
  const abort=()=>finish(new DOMException('Synthetic cancellation','AbortError'));
  const timer=setTimeout(()=>finish(),f.mode==='stall'?10000:40);
  if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
 });
}'''

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1280,'height':800},timezone_id='Asia/Seoul')
    page=ctx.new_page(); errors=[]; network=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('https:','http:')) else None)
    page.evaluate(PRELUDE)
    page.set_content((ROOT/'dist/Solar-Time_v0.09.html').read_text(),wait_until='load')
    page.wait_for_function('window.SolarTime?.version==="0.09"',timeout=15000)
    page.wait_for_function('SolarTime.materials.state.status==="ready"',timeout=20000)
    result=page.evaluate('''()=>({state:SolarTime.materials.state,info:SolarAssets.materialInfo,revision:SolarAssets.materialRevision,calls:fixture.calls,maxActive:fixture.maxActive,
     relief:Object.keys(SolarAssets.materials).filter(x=>x.endsWith('-relief')),earthUnchanged:!SolarAssets.materialInfo.earth,
     model:SolarTime.getModel(),raster:Math.max(...Array.from(SolarTime.renderer.surface.frames.values()).map(x=>x.image.width))})''')
    check('All eight public-map slots accept, decode and publish fixture image bytes',result['state']['loaded']==8,result['state'])
    check('Concurrent network producers are bounded to three',result['maxActive']<=3,result['maxActive'])
    check('First-host failure proceeds to a catalogued Saturn fallback',any(x.endswith('/2k_saturn.jpg') for x in result['calls']),result['calls'])
    check('Native 2K maps are not misreported or upscaled as 4K',all(x['width']==2048 and x['height']==1024 for x in result['info'].values()))
    check('Earth remains embedded and orbital model remains local',result['earthUnchanged'] and result['model']['source']=='local')
    check('Original synthetic relief is not paired with newly received Moon map','moon-relief' not in result['relief'],result['relief'])
    check('Moon uses NASA credit when the NASA slot supplies the image','NASA' in result['info']['moon']['credit'],result['info']['moon'])
    page.evaluate('SolarTime.renderer.focusBody("moon");SolarTime.renderer.setZoom(64)')
    page.wait_for_function('''()=>{const e=SolarTime.renderer.surface.frames.get('moon');return e&&e.job.textureWidth===2048&&e.image.width>=512}''',timeout=15000)
    detail=page.evaluate('''()=>{const e=SolarTime.renderer.surface.frames.get('moon');return {width:e.image.width,textureWidth:e.job.textureWidth,geometry:e.job.geometry,backend:SolarTime.renderer.surface.stats}}''')
    check('Renderer consumes new map revision and preserves 1024 raster ceiling',detail['width']<=1024 and detail['textureWidth']==2048,detail)
    # An export must carry the received bytes, not URLs to them or test injection.
    exported=page.evaluate('SolarTime.materials.offlineHTML()')
    check('Portable export embeds photo data and catalogue credits', 'materialInfo' in exported and 'NASA SVS / LRO / LROC' in exported and 'window.fixture' not in exported)
    offline=browser.new_context(viewport={'width':1280,'height':800},offline=True)
    op=offline.new_page(); offline_requests=[]; offline_errors=[]
    op.on('request',lambda r:offline_requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
    op.on('pageerror',lambda e:offline_errors.append(str(e)))
    op.set_content(exported,wait_until='load');op.wait_for_function('window.SolarTime?.materials.state.status==="ready"',timeout=15000)
    check('Exported file reopens offline with all eight received materials',op.evaluate('SolarTime.materials.state.loaded')==8 and not offline_requests,offline_requests)
    check('Exported offline app has no page exceptions',not offline_errors,offline_errors)
    check('Image-inclusive export keeps the exact tab title and corrected radius owner',op.title()=='Solar Time' and op.evaluate('typeof SolarTime.renderer.bodyRadiusAtZoom==="function"'))
    offline.close()
    # Isolated owner checks retain the exact production decoder and publisher.
    isolated=ctx.new_page();isolated.evaluate(PRELUDE)
    isolated.add_script_tag(content=(ROOT/'src/materials.js').read_text())
    isolated.evaluate('window.SolarAssets={materials:{earth:"preserved",moon:"fallback","moon-relief":"synthetic"},materialInfo:{}}')
    check('Repeated load calls share one producer',isolated.evaluate('''()=>{const m=window.owner=new SolarMaterials.Owner();m.cached=async()=>[];const p=m.load();return p===m.load()}'''))
    isolated.wait_for_function('owner.state.status==="ready"',timeout=15000)
    cache=isolated.evaluate('''async()=>{const m=owner,e=SolarMaterials.catalog.find(x=>x.id==='moon');
     const row={id:'moon',url:e.urls[0],revision:SolarMaterials.revision,width:2048,height:1024,created:Date.now(),data:fixture.data};
     const bad={...row,data:'data:image/webp;base64,AAAA'};return {good:(await m.verifyCached([row])).length,bad:(await m.verifyCached([bad])).length};}''')
    check('Cache bytes must actually decode, not merely have matching metadata',cache=={'good':1,'bad':0},cache)
    moon=isolated.evaluate('''async()=>{fixture.mode='moon-mirror';fixture.failFirstSaturn=false;
     const m=new SolarMaterials.Owner(),e=SolarMaterials.catalog.find(x=>x.id==='moon');const row=await m.fetchMap(e,m.generation);m.publish([row]);m.dispose();return {url:row.url,credit:SolarAssets.materialInfo.moon.credit};}''')
    check('Moon mirror fallback carries its actual Solar System Scope credit','jsdelivr.net' in moon['url'] and 'Solar System Scope' in moon['credit'],moon)
    failed=isolated.evaluate('''async()=>{owner.dispose();fixture.mode='failure';fixture.calls=[];SolarAssets={materials:{earth:'preserved',moon:'fallback'},materialInfo:{}};
     const m=new SolarMaterials.Owner();m.cached=async()=>[];await m.load();const result={state:m.state,calls:fixture.calls.length,max:SolarMaterials.catalog.reduce((n,e)=>n+e.urls.length,0),moon:SolarAssets.materials.moon};m.dispose();return result;}''')
    check('Total failure is bounded and keeps the embedded fallback',failed['state']['status']=='fallback' and failed['state']['loaded']==0 and failed['calls']<=failed['max'] and failed['moon']=='fallback',failed)
    cancelled=isolated.evaluate('''async()=>{fixture.mode='stall';fixture.calls=[];const m=new SolarMaterials.Owner();m.cached=async()=>[];const p=m.load();await new Promise(r=>setTimeout(r,20));m.dispose();await p;return {disposed:m.disposed,controllers:m.controllers.size,loaded:m.state.loaded,active:fixture.active};}''')
    check('Disposal aborts in-flight requests and prevents late image commits',cancelled['disposed'] and cancelled['controllers']==0 and cancelled['active']==0 and cancelled['loaded']==0,cancelled)
    check('No public HTTP requests escaped the mocked test boundary',not network,network)
    check('No page exceptions in integrated replacement/export workflow',not errors,errors)
    isolated.close();ctx.close();browser.close()

report['passed']=all(x['passed'] for x in report['checks']);report['check_count']=len(report['checks'])
(ROOT/'docs/materials-browser-v0.09.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
