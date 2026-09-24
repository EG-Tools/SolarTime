const MEDIA_PREFIX='/media/';
const HELPER_API_PREFIX='/api/windows-helper/';
const HELPER_TOKEN=/^[a-f0-9]{32}$/;
const RECEIPT_PREFIX='releases/runtime/windows-helper-v2/';
const helperCors=Object.freeze({'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'600'});
const helperStatusKey=token=>`releases/runtime/windows-helper/${token}`;
const receiptKey=(kind,token)=>RECEIPT_PREFIX+kind+'/'+token;
const helperOrigin=origin=>!origin||origin==='null'||['https://solartime.app','https://www.solartime.app','https://eg-tools.github.io','https://solar-time.keg0320.workers.dev'].includes(origin)||/^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/.test(origin);

function validReceipt(value,kind){
 const actions=kind==='install'?['install']:['schedule','cancel','probe','uninstall'];
 return value&&value.protocol===2&&actions.includes(value.action)&&typeof value.ok==='boolean'&&
  Number.isInteger(value.code)&&value.code>=-2147483648&&value.code<=2147483647&&
  /^[A-F0-9]{64}$/.test(value.revision||'')&&Number.isSafeInteger(value.at)&&
  value.at>0&&
  Number.isSafeInteger(value.deadline)&&value.deadline>=0&&value.deadline<=value.at+360120000&&
  (value.ok?value.code===0:value.code!==0)&&
  (value.ok&&value.action==='schedule'?value.deadline>value.at:value.deadline===0);
}
async function cleanupHelperReceipts(env){
 // This cron is scoped to ephemeral helper receipts, NEVER media content.
 for(const prefix of [RECEIPT_PREFIX,'releases/runtime/windows-helper/']){
  let cursor;
  for(let page=0;page<10;page++){
   const result=await env.SOLAR_TIME_MEDIA.list({prefix,limit:1000,cursor});
   const expired=result.objects.filter(object=>new Date(object.uploaded).getTime()<Date.now()-3600000).map(object=>object.key);
   if(expired.length)await env.SOLAR_TIME_MEDIA.delete(expired);
   if(!result.truncated)break;cursor=result.cursor;
  }
 }
}
async function helperApiResponse(request,env,ctx,url){
 const headers={...helperCors,'cache-control':'no-store','x-content-type-options':'nosniff'};
 if(!helperOrigin(request.headers.get('origin')))return new Response('Forbidden',{status:403,headers:{'cache-control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(url.pathname===HELPER_API_PREFIX+'health'){
  if(request.method!=='GET')return new Response('Method Not Allowed',{status:405,headers});
  return Response.json({protocol:2,receipts:true},{headers});
 }
 const token=String(url.searchParams.get('token')||'');
 if(!HELPER_TOKEN.test(token))return Response.json({error:'invalid token'},{status:400,headers});
 const isInstall=url.pathname===HELPER_API_PREFIX+'install-complete'||url.pathname===HELPER_API_PREFIX+'install-status';
 const kind=isInstall?'install':'operation',key=receiptKey(kind,token);
 if(url.pathname===HELPER_API_PREFIX+kind+'-complete'){
  if(request.method!=='POST')return new Response('Method Not Allowed',{status:405,headers:{...headers,allow:'POST, OPTIONS'}});
  // Preserve old clients, but v2 browsers never trust a legacy boolean installation signal.
  if(isInstall&&!request.headers.get('content-type')?.includes('application/json')){
   await env.SOLAR_TIME_MEDIA.put(helperStatusKey(token),'1',{httpMetadata:{contentType:'text/plain',cacheControl:'no-store'}});
   return new Response(null,{status:204,headers});
  }
  if(!request.headers.get('content-type')?.includes('application/json'))return new Response('JSON required',{status:415,headers});
  if(Number(request.headers.get('content-length')||0)>1024)return new Response('Too large',{status:413,headers});
  // Bound streamed requests too, not only Content-Length.
  const reader=request.body?.getReader();let text='',size=0;
  if(reader){const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();return new Response('Too large',{status:413,headers});}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
  let value;try{value=JSON.parse(text);}catch(_){return new Response('Invalid JSON',{status:400,headers});}
  if(!validReceipt(value,kind))return new Response('Invalid receipt',{status:400,headers});
  // Whitelist fields; never store arbitrary strings, hostnames, paths or command output.
  const result={protocol:2,action:value.action,ok:value.ok,code:value.code,revision:value.revision,at:value.at,deadline:value.deadline};
  const existing=await env.SOLAR_TIME_MEDIA.get(key);
  if(existing){const saved=await existing.json();return new Response(null,{status:JSON.stringify(saved.result)===JSON.stringify(result)?204:409,headers});}
  const saved=await env.SOLAR_TIME_MEDIA.put(key,JSON.stringify({result,receivedAt:Date.now()}),{onlyIf:new Headers({'if-none-match':'*'}),httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
  return new Response(null,{status:saved?204:409,headers});
 }
 if(url.pathname===HELPER_API_PREFIX+kind+'-status'){
  if(request.method!=='GET')return new Response('Method Not Allowed',{status:405,headers:{...headers,allow:'GET, OPTIONS'}});
  const object=await env.SOLAR_TIME_MEDIA.get(key);
  if(object){
   const saved=await object.json(),ttl=isInstall?10*60000:3*60000;
   if(Date.now()-saved.receivedAt<=ttl){
    const result=saved.result;
    return Response.json(isInstall?{installed:result.ok,protocol:result.protocol,revision:result.revision}:{result},{headers});
   }
   ctx.waitUntil(env.SOLAR_TIME_MEDIA.delete(key));
  }
  if(isInstall){const legacy=helperStatusKey(token),found=await env.SOLAR_TIME_MEDIA.head(legacy);if(found)ctx.waitUntil(env.SOLAR_TIME_MEDIA.delete(legacy));return Response.json({installed:!!found},{headers});}
  return Response.json({result:null},{headers});
 }
 return new Response('Not Found',{status:404,headers});
}

function mediaType(key){
 const value=String(key||'').toLowerCase();
 if(value.endsWith('.png'))return 'image/png';
 if(value.endsWith('.webp'))return 'image/webp';
 if(value.endsWith('.mp3'))return 'audio/mpeg';
 if(value.endsWith('.json'))return 'application/json; charset=utf-8';
 if(value.endsWith('.svg'))return 'image/svg+xml';
 if(value.endsWith('.gz'))return 'application/gzip';
 if(value.endsWith('.cmd'))return 'application/octet-stream';
 return '';
}

const mutableUI=key=>/(?:^|\/)content\/ui\//.test(key);
const mediaCacheControl=key=>mutableUI(key)?'public, max-age=3600, must-revalidate':'public, max-age=31536000, immutable';
const comparableEtag=value=>String(value||'').trim().replace(/^W\//i,'');
const etagMatches=(header,etag)=>String(header||'').split(',').some(value=>value.trim()==='*'||comparableEtag(value)===comparableEtag(etag));
function mediaCacheRequest(request,withHeaders=false){
 const url=new URL(request.url);url.search='';
 return new Request(url.toString(),withHeaders?{headers:request.headers}:undefined);
}

function mediaHeaders(object,status,key){
 const headers=new Headers();object.writeHttpMetadata(headers);
 const type=mediaType(key);if(type)headers.set('content-type',type);
 headers.set('etag',object.httpEtag);headers.set('accept-ranges','bytes');
 headers.set('access-control-allow-origin','*');headers.set('cross-origin-resource-policy','cross-origin');
 headers.set('cache-control',mediaCacheControl(key));
 if(/\.cmd$/i.test(key)){
  headers.set('content-type','application/octet-stream');
  headers.set('content-disposition','attachment; filename="SolarTimeShutdownHelper.cmd"');
  headers.set('x-content-type-options','nosniff');
 }
 if(status===206&&object.range){
  const range=object.range,start=Number.isFinite(range.suffix)?Math.max(0,object.size-range.suffix):(range.offset||0);
  const length=Math.min(range.length??range.suffix??(object.size-start),object.size-start),end=start+length-1;
  headers.set('content-range',`bytes ${start}-${end}/${object.size}`);
  headers.set('content-length',String(length));
 }else if(status===200)headers.set('content-length',String(object.size));
 return headers;
}

async function mediaResponse(request,env,ctx,key){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'Range','access-control-max-age':'86400'}});
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{allow:'GET, HEAD, OPTIONS'}});
  const head=request.method==='HEAD',range=head?null:request.headers.get('range'),cache=mutableUI(key)?null:caches.default;
  const lookup=mediaCacheRequest(request,true);if(head)lookup.headers.delete('range');
  if(cache){const cached=await cache.match(lookup);if(cached){if(!head)return cached;if(cached.body)ctx.waitUntil(cached.body.cancel());return new Response(null,{status:cached.status,headers:cached.headers});}}
  const object=head?await env.SOLAR_TIME_MEDIA.head(key):await env.SOLAR_TIME_MEDIA.get(key,{range:request.headers});
  if(!object)return new Response('Not Found',{status:404});
  if(etagMatches(request.headers.get('if-none-match'),object.httpEtag)){if(object.body)ctx.waitUntil(object.body.cancel());return new Response(null,{status:304,headers:mediaHeaders(object,304,key)});}
  const partial=!!range&&!!object.range,status=partial?206:200,headers=mediaHeaders(object,status,key);
  if(head)return new Response(null,{status,headers});
  const response=new Response(object.body,{status,headers});
  if(cache){
    const cacheKey=mediaCacheRequest(request),whole=!partial||Number(headers.get('content-length'))===object.size;
    // Store only complete 200 responses. Cache.match can then answer Range/ETag
    // requests itself. Never buffer media in JS or prefetch unbounded archives.
    if(whole){
      const copy=response.clone();ctx.waitUntil(cache.put(cacheKey,new Response(copy.body,{headers:mediaHeaders(object,200,key)})).catch(error=>console.warn('Media cache write failed',String(error))));
    }else if(/\.mp3$/i.test(key)&&object.size<=16*1024*1024){
      ctx.waitUntil((async()=>{
        const cached=await cache.match(cacheKey);if(cached){await cached.body?.cancel();return;}
        const full=await env.SOLAR_TIME_MEDIA.get(key);
        if(full)await cache.put(cacheKey,new Response(full.body,{headers:mediaHeaders(full,200,key)}));
      })().catch(error=>console.warn('Music cache fill failed',String(error))));
    }
  }
  return response;
}

export default {
 async scheduled(event,env,ctx){ctx.waitUntil(cleanupHelperReceipts(env));},
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  try{
   if(url.pathname.startsWith(HELPER_API_PREFIX))return await helperApiResponse(request,env,ctx,url);
   if(url.pathname.startsWith(MEDIA_PREFIX)){
    let key;try{key=decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));}catch(_){return new Response('Bad Request',{status:400});}
    if(key.startsWith('releases/runtime/'))return new Response('Not Found',{status:404});
    if(!key||key.includes('..'))return new Response('Bad Request',{status:400});
    return await mediaResponse(request,env,ctx,key);
   }
   return await env.ASSETS.fetch(request);
  }catch(error){
   console.error(JSON.stringify({message:'request failed',path:url.pathname,error:error instanceof Error?error.message:String(error)}));
   return new Response('Internal Server Error',{status:500});
  }
 }
};
