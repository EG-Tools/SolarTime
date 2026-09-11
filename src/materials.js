/* Solar Time v0.10: one owner for optional public image maps and their local cache.
 * The scene and all astronomy start from embedded assets without waiting for I/O.
 * Only catalogued, creditable public images are requested; no credentials are sent.
 */
(function(root){'use strict';
const REV='public-maps-2026-09-v1',DB='solar-time-materials',STORE='maps';
const MAX_BYTES=16*1024*1024,MAX_CACHE_BYTES=24*1024*1024,MAX_AGE=365*86400000;
const SSS='https://www.solarsystemscope.com/textures/download/';
// Immutable, credited mirror for hosts that do not permit cross-origin reads.
const MIRROR='https://cdn.jsdelivr.net/gh/Whitebee7/solarsystem@235e72c02e825e0c8d0792ec0aa6be43e1a14f68/textures/';
const catalog=Object.freeze([
 {id:'saturn',name:'토성',urls:[SSS+'8k_saturn.jpg',SSS+'2k_saturn.jpg',MIRROR+'2k_saturn.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0'},
 {id:'neptune',name:'해왕성',urls:[SSS+'2k_neptune.jpg',MIRROR+'2k_neptune.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0'},
 {id:'venus',name:'금성',urls:[SSS+'4k_venus_atmosphere.jpg',SSS+'2k_venus_atmosphere.jpg','https://cdn.jsdelivr.net/gh/Shriisoot/Planets-texture@9c2aedaeb89f35814401873f22ce78bb02421dea/4k_venus_atmosphere.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0'},
 {id:'moon',name:'달',urls:['https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',MIRROR+'2k_moon.jpg'],credit:'NASA SVS / LRO / LROC · Ernie Wright'},
 {id:'jupiter',name:'목성',urls:[SSS+'8k_jupiter.jpg',SSS+'2k_jupiter.jpg',MIRROR+'2k_jupiter.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0',feature:{latitude:-22,longitude:-48.6}},
 {id:'mars',name:'화성',urls:[SSS+'8k_mars.jpg',SSS+'2k_mars.jpg',MIRROR+'2k_mars.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0'},
 {id:'mercury',name:'수성',urls:[SSS+'8k_mercury.jpg',SSS+'2k_mercury.jpg',MIRROR+'2k_mercury.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0'},
 {id:'uranus',name:'천왕성',urls:[SSS+'2k_uranus.jpg',MIRROR+'2k_uranus.jpg'],credit:'Solar System Scope / INOVE · CC BY 4.0'}
]);
function valid(row,entry,now=Date.now()){
 return !!row&&row.revision===REV&&row.id===entry.id&&entry.urls.includes(row.url)&&row.width>=1024&&row.width<=4096&&row.height===row.width/2&&typeof row.data==='string'&&row.data.startsWith('data:image/webp;base64,')&&row.data.length<MAX_BYTES&&Number.isFinite(row.created)&&row.created<=now+60000&&now-row.created<MAX_AGE;
}
class Materials {
 constructor(){this.disposed=false;this.generation=0;this.pending=null;this.controllers=new Set();this.db=null;this.pristine='';this.exporting=null;this.objectURLs=new Map();this.state={status:'embedded',loaded:0,total:catalog.length,errors:[],cacheAvailable:false};}
 capture(){if(!this.pristine)this.pristine='<!doctype html>\n'+document.documentElement.outerHTML;}
 notify(){this.state.loaded=catalog.filter(e=>root.SolarAssets.materialInfo?.[e.id]?.revision===REV).length;root.dispatchEvent(new CustomEvent('solar-material-status',{detail:{...this.state}}));}
 async database(){
  if(this.db)return this.db;if(!root.indexedDB)return null;
  return new Promise(resolve=>{let done=false;const finish=value=>{if(done){value?.close();return;}done=true;clearTimeout(timer);resolve(value);};
   const timer=setTimeout(()=>finish(null),1200);let request;
   try{request=indexedDB.open(DB,1);}catch(_){finish(null);return;}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
   request.onerror=()=>finish(null);request.onblocked=()=>finish(null);
   request.onsuccess=()=>{if(this.disposed||done){request.result.close();finish(null);return;}this.db=request.result;this.db.onversionchange=()=>{this.db?.close();this.db=null;};this.state.cacheAvailable=true;finish(this.db);};
  });
 }
 async verifyCached(rows){
  const good=[];for(const row of rows){const entry=catalog.find(e=>e.id===row.id);if(!entry||!valid(row,entry))continue;let b;try{const raw=atob(row.data.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));b=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));if(b.width===row.width&&b.height===row.height)good.push(row);}catch(_){/* Malformed cache is not authoritative. */}finally{b?.close();}}return good;
 }
 async cached(){const db=await this.database();if(!db||this.disposed)return [];
  return new Promise(resolve=>{try{const req=db.transaction(STORE).objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>resolve([]);}catch(_){resolve([]);}});
 }
 save(rows){if(!this.db||this.disposed)return;try{const store=this.db.transaction(STORE,'readwrite').objectStore(STORE);store.clear();let bytes=0;for(const row of rows){bytes+=row.data.length;if(bytes<=MAX_CACHE_BYTES)store.put(row);}}catch(_){/* Storage denial never affects the running scene. */}}
 publish(rows){
  if(this.disposed||!rows.length)return;
  const materials={...root.SolarAssets.materials},info={...root.SolarAssets.materialInfo};let changed=false;
  for(const row of rows){const entry=catalog.find(e=>e.id===row.id);if(!entry||!valid(row,entry))continue;
   if(materials[row.id]===row.data&&info[row.id]?.revision===REV&&info[row.id]?.url===row.url)continue;
   materials[row.id]=row.data;
   // Old synthetic height maps do not describe these newly loaded photographs.
   delete materials[row.id+'-relief'];
   info[row.id]={revision:REV,url:row.url,width:row.width,height:row.height,credit:row.id==='moon'&&!row.url.includes('svs.gsfc.nasa.gov')?'Solar System Scope / INOVE · CC BY 4.0':entry.credit,feature:entry.feature||null};changed=true;
  }
  if(changed){root.SolarAssets.materials=materials;root.SolarAssets.materialInfo=info;root.SolarAssets.materialRevision=(root.SolarAssets.materialRevision||0)+1;}
  this.notify();
 }
 async fetchMap(entry,generation){
  for(const url of entry.urls){
   if(this.disposed||generation!==this.generation)throw Error('Cancelled');
   const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),6500);let bitmap;
   try{
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',mode:'cors',cache:'force-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const advertised=Number(response.headers.get('content-length'));
    if(advertised>MAX_BYTES)throw Error('Image too large');
    const reader=response.body?.getReader();let imageBlob;
    if(reader){let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Error('Image too large');}chunks.push(value);}imageBlob=new Blob(chunks,{type:response.headers.get('content-type')||'image/jpeg'});}
    else{imageBlob=await response.blob();if(imageBlob.size>MAX_BYTES)throw Error('Image too large');}
    bitmap=await createImageBitmap(imageBlob);
    if(bitmap.width<1024||Math.abs(bitmap.width/bitmap.height-2)>.03)throw Error('Not a global 2:1 texture');
    const width=Math.min(4096,2**Math.floor(Math.log2(bitmap.width))),height=width/2;
    const c=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas');c.width=width;c.height=height;
    c.getContext('2d').drawImage(bitmap,0,0,width,height);bitmap.close();bitmap=null;
    const packed=c.convertToBlob?await c.convertToBlob({type:'image/webp',quality:.95}):await new Promise(resolve=>c.toBlob(resolve,'image/webp',.95));
    if(!packed||packed.type!=='image/webp')throw Error('WebP encoder unavailable');
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Image encode failed'));reader.readAsDataURL(packed);});
    if(this.disposed||generation!==this.generation)throw Error('Cancelled');
    return {id:entry.id,url,revision:REV,width,height,created:Date.now(),data};
   }catch(error){if(this.disposed||generation!==this.generation)throw error;this.lastFetchError=error.message;}
   finally{bitmap?.close();clearTimeout(timer);this.controllers.delete(controller);}
  }
  throw Error(this.lastFetchError||'Image download failed');
 }
 load(){
  if(this.pending)return this.pending;if(this.disposed)return Promise.resolve(this.state);
  const generation=++this.generation;
  this.pending=(async()=>{
   this.state.status='loading';this.state.errors=[];this.notify();
   const rows=await this.verifyCached(await this.cached());
   if(this.disposed||generation!==this.generation)return this.state;
   this.publish(rows);
   const queue=catalog.filter(e=>root.SolarAssets.materialInfo?.[e.id]?.revision!==REV),fetched=[];
   if(navigator.onLine!==false){
    const worker=async()=>{while(queue.length&&!this.disposed&&generation===this.generation){const entry=queue.shift();try{fetched.push(await this.fetchMap(entry,generation));}catch(error){this.state.errors.push({id:entry.id,message:error.message});}}};
    await Promise.all([worker(),worker(),worker()]);
   }
   if(this.disposed||generation!==this.generation)return this.state;
   this.publish(fetched);this.save([...rows.filter(r=>!fetched.some(f=>f.id===r.id)),...fetched]);
   this.state.status=this.state.loaded===catalog.length?'ready':this.state.loaded?'partial':'fallback';this.notify();return this.state;
  })().catch(error=>{if(!this.disposed){this.state.status='fallback';this.state.errors.push({id:'cache',message:error.message});this.notify();}return this.state;}).finally(()=>{this.pending=null;});
  return this.pending;
 }
 async offlineHTML(){
  if(!this.pristine)throw Error('Original document unavailable');
  const d=new DOMParser().parseFromString(this.pristine,'text/html');
  for(const element of d.querySelectorAll('script[src],link[rel="stylesheet"]')){
   if(element.id==='solar-assets')continue;
   const url=new URL(element.getAttribute('src')||element.getAttribute('href'),location.href);
   if(url.origin!==location.origin||!['file:','https:','http:'].includes(url.protocol))throw Error('Unexpected code origin');
   const ctl=new AbortController();this.controllers.add(ctl);const timer=setTimeout(()=>ctl.abort(),8000);
   try{const r=await fetch(url,{signal:ctl.signal});if(!r.ok)throw Error('Cannot embed '+url.pathname);const text=await r.text();
    if(element.tagName==='SCRIPT'){element.removeAttribute('src');element.textContent=text.replace(/<\/script/gi,'<\\/script');}
    else{const style=d.createElement('style');style.textContent=text;element.replaceWith(style);}
   }finally{clearTimeout(timer);this.controllers.delete(ctl);}
  }
  const node=d.getElementById('solar-assets');if(!node)throw Error('Asset entry point missing');node.removeAttribute('src');node.textContent='window.SolarAssets='+JSON.stringify(root.SolarAssets).replace(/<\/script/gi,'<\\/script')+';';
  return '<!doctype html>\n'+d.documentElement.outerHTML;
 }
 download(){if(this.exporting)return this.exporting;this.exporting=(async()=>{
  const html=await this.offlineHTML();if(this.disposed)return;
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='SolarTime_v0.10_photos.html';a.click();
  const timer=setTimeout(()=>{URL.revokeObjectURL(url);this.objectURLs.delete(url);},30000);this.objectURLs.set(url,timer);
 })().finally(()=>{this.exporting=null;});return this.exporting;}
 cancel(){this.generation++;for(const ctl of this.controllers)ctl.abort();this.controllers.clear();}
 dispose(){this.disposed=true;this.cancel();this.db?.close();this.db=null;for(const [url,timer]of this.objectURLs){clearTimeout(timer);URL.revokeObjectURL(url);}this.objectURLs.clear();}
}
root.SolarMaterials={Owner:Materials,catalog,revision:REV,valid};
if(typeof module==='object'&&module.exports)module.exports=root.SolarMaterials;
})(typeof window==='object'?window:globalThis);
