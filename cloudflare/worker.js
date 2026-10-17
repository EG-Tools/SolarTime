const MEDIA_PREFIX='/media/';
const HELPER_API_PREFIX='/api/windows-helper/';
const HELPER_TOKEN=/^[a-f0-9]{32}$/;
const RECEIPT_PREFIX='releases/runtime/windows-helper-v2/';
const helperCors=Object.freeze({'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, DELETE, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'600'});
const helperStatusKey=token=>`releases/runtime/windows-helper/${token}`;
const receiptKey=(kind,token)=>RECEIPT_PREFIX+kind+'/'+token;
const helperOrigin=origin=>!origin||origin==='null'||['https://solartime.app','https://www.solartime.app','https://lyrikey.github.io','https://solar-time.keg0320.workers.dev'].includes(origin)||/^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/.test(origin);

function validReceipt(value,kind){
 const actions=kind==='install'?['install']:kind==='diagnostic'?['probe']:['schedule','cancel','probe','uninstall'];
 return value&&value.protocol===2&&actions.includes(value.action)&&typeof value.ok==='boolean'&&
  Number.isInteger(value.code)&&value.code>=-2147483648&&value.code<=2147483647&&
  /^[A-F0-9]{64}$/.test(value.revision||'')&&Number.isSafeInteger(value.at)&&
  value.at>0&&
  Number.isSafeInteger(value.deadline)&&value.deadline>=0&&value.deadline<=value.at+360120000&&
  (value.ok?value.code===0:value.code!==0)&&
  (value.ok&&value.action==='schedule'?value.deadline>value.at:value.deadline===0);
}
const CLEANUP_STATE_KEY='releases/runtime/windows-helper-cleanup.json';
async function cleanupHelperReceipts(env){
 // Only ephemeral confirmation prefixes. Cursors prevent starvation when a
 // bounded hourly batch cannot visit all objects. No media prefix is accepted.
 const prefixes=[RECEIPT_PREFIX,'releases/runtime/windows-helper/'];
 let previous=null;const report={at:Date.now(),scanned:0,deleted:0,cursors:{},complete:true};
 try{
  const saved=await env.SOLAR_TIME_MEDIA.get(CLEANUP_STATE_KEY);
  if(saved)try{previous=await saved.json();}catch(_){/* Invalid old diagnostics do not block expiry cleanup. */}
  for(const prefix of prefixes){
   let cursor=previous?.cursors?.[prefix];if(typeof cursor!=='string'||cursor.length>4096)cursor=undefined;
   for(let page=0;page<10;page++){
    const result=await env.SOLAR_TIME_MEDIA.list({prefix,limit:1000,cursor});report.scanned+=result.objects.length;
    const expired=result.objects.filter(object=>object.key.startsWith(prefix)&&new Date(object.uploaded).getTime()<Date.now()-3600000).map(object=>object.key);
    if(expired.length){await env.SOLAR_TIME_MEDIA.delete(expired);report.deleted+=expired.length;}
    if(!result.truncated){cursor=undefined;break;}cursor=result.cursor;
   }
   if(cursor){report.cursors[prefix]=cursor;report.complete=false;}
  }
  report.incompleteRuns=report.complete?0:(Number(previous?.incompleteRuns)||0)+1;
  report.backlogSince=report.complete?null:(previous?.backlogSince||report.at);
  await env.SOLAR_TIME_MEDIA.put(CLEANUP_STATE_KEY,JSON.stringify(report),{httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
  console.info(JSON.stringify({message:'helper receipt cleanup',scanned:report.scanned,deleted:report.deleted,complete:report.complete,incompleteRuns:report.incompleteRuns,backlogSince:report.backlogSince}));
  return report;
 }catch(error){console.error(JSON.stringify({message:'helper receipt cleanup failed',scanned:report.scanned,deleted:report.deleted}));throw error;}
}
async function helperRateLimit(request,env,token,headers){
 // Per-request-ID quota first. A generous per-network abuse ceiling also stops
 // random-ID fan-out; separate read/write counters preserve normal cancellation.
 const limits=[];
 if(env.HELPER_TOKEN_LIMIT)limits.push([env.HELPER_TOKEN_LIMIT,'token:'+token]);
 const ip=request.headers.get('cf-connecting-ip');
 if(ip){const binding=request.method==='GET'?env.HELPER_READ_LIMIT:env.HELPER_WRITE_LIMIT;if(binding){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('solar-time-helper:'+ip));
  const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');limits.push([binding,key]);
 }}
 for(const [binding,key] of limits){
  try{if(!(await binding.limit({key})).success)return Response.json({error:'rate limited'},{status:429,headers:{...headers,'retry-after':'60'}});}
  catch(_){console.warn('Helper rate limiter unavailable; confirmation remains available');}
 }
 return null;
}
async function helperApiResponse(request,env,ctx,url){
 const headers={...helperCors,'cache-control':'no-store','x-content-type-options':'nosniff'};
 if(!helperOrigin(request.headers.get('origin')))return new Response('Forbidden',{status:403,headers:{'cache-control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(url.pathname===HELPER_API_PREFIX+'health'){
  if(request.method!=='GET')return new Response('Method Not Allowed',{status:405,headers});
  return Response.json({protocol:2,receipts:true,diagnostics:true,rateLimits:!!(env.HELPER_TOKEN_LIMIT&&env.HELPER_READ_LIMIT&&env.HELPER_WRITE_LIMIT)},{headers});
 }
 const token=String(url.searchParams.get('token')||'');
 if(!HELPER_TOKEN.test(token))return Response.json({error:'invalid token'},{status:400,headers});
 const isInstall=url.pathname===HELPER_API_PREFIX+'install-complete'||url.pathname===HELPER_API_PREFIX+'install-status';
 const isDiagnostic=url.pathname===HELPER_API_PREFIX+'diagnostic-complete'||url.pathname===HELPER_API_PREFIX+'diagnostic-status';
 const kind=isInstall?'install':isDiagnostic?'diagnostic':'operation',key=receiptKey(kind,token);
 if(![HELPER_API_PREFIX+kind+'-complete',HELPER_API_PREFIX+kind+'-status'].includes(url.pathname))return new Response('Not Found',{status:404,headers});
 const limited=await helperRateLimit(request,env,token,headers);if(limited)return limited;
 // Deployment round trips use a separate namespace and probe-only schema.
 // They never send a native command or remove an installation/operation result.
 if(isDiagnostic&&url.pathname.endsWith('-status')&&request.method==='DELETE'){
  await env.SOLAR_TIME_MEDIA.delete(key);return new Response(null,{status:204,headers});
 }
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
const mediaLastModified=object=>{const date=new Date(object?.uploaded||0);return Number.isFinite(date.getTime())&&date.getTime()>0?date.toUTCString():'';};
function ifRangeMatches(value,object){
 const validator=String(value||'').trim();if(!validator)return true;
 // If-Range requires a strong entity tag. Weak tags must fall back to the
 // complete representation even when their opaque value looks identical.
 if(validator.startsWith('"')||/^W\//i.test(validator))return !/^W\//i.test(validator)&&validator===String(object?.httpEtag||'').trim();
 const expected=mediaLastModified(object),date=Date.parse(validator);
 return !!expected&&Number.isFinite(date)&&date===Date.parse(expected);
}
function validByteRange(value,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(String(value||'').trim());if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(size)||size<1)return false;
 if(match[1]){const start=Number(match[1]),end=match[2]?Number(match[2]):size-1;return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<size&&end>=start;}
 const suffix=Number(match[2]);return Number.isSafeInteger(suffix)&&suffix>0;
}
function mediaCacheRequest(request,withHeaders=false){
 const url=new URL(request.url);url.search='';
 return new Request(url.toString(),withHeaders?{headers:request.headers}:undefined);
}

function mediaHeaders(object,status,key){
 const headers=new Headers();object.writeHttpMetadata(headers);
 const type=mediaType(key);if(type)headers.set('content-type',type);
 headers.set('etag',object.httpEtag);headers.set('accept-ranges','bytes');
 const lastModified=mediaLastModified(object);if(lastModified)headers.set('last-modified',lastModified);
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

function mediaDelivery(response,cacheStatus){
 const headers=new Headers(response.headers);
 headers.set('x-solar-media-cache',cacheStatus);
 headers.set('timing-allow-origin','*');
 headers.set('access-control-expose-headers','Content-Length, Content-Range, ETag, Last-Modified, Age, CF-Cache-Status, X-Solar-Media-Cache, X-Solar-Media-Error');
 headers.set('server-timing','solar-cache;desc="'+cacheStatus+'"');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

function mediaError(status,message,code,cacheStatus='BYPASS',extra){
 const headers=new Headers(extra);headers.set('content-type','text/plain; charset=utf-8');headers.set('cache-control','no-store');
 headers.set('access-control-allow-origin','*');headers.set('cross-origin-resource-policy','cross-origin');headers.set('x-content-type-options','nosniff');
 headers.set('x-solar-media-error',code);
 return mediaDelivery(new Response(message,{status,headers}),cacheStatus);
}

// Only scalar ownership markers are shared. Streams and promises stay with
// their originating request; a later request never awaits another request's I/O.
const musicFills=new Map(),MAX_MUSIC_FILLS=8;
function fillMusic(cache,cacheKey,env,ctx,key){
  const now=Date.now();for(const [id,entry] of musicFills)if(entry.expires<=now)musicFills.delete(id);
  const id=cacheKey.url;if(musicFills.has(id)||musicFills.size>=MAX_MUSIC_FILLS){console.info(JSON.stringify({message:'music cache fill',result:musicFills.has(id)?'coalesced':'capacity',bytes:0}));return;}
  const entry={expires:now+60000};musicFills.set(id,entry);
  ctx.waitUntil((async()=>{
    let result='missing',bytes=0;
    try{
      const cached=await cache.match(cacheKey);if(cached){result='already-cached';await cached.body?.cancel();return;}
      const full=await env.SOLAR_TIME_MEDIA.get(key);
      if(full){bytes=full.size;await cache.put(cacheKey,new Response(full.body,{headers:mediaHeaders(full,200,key)}));result='stored';}
    }catch(error){result='failed';console.warn('Music cache fill failed',String(error));}
    finally{if(musicFills.get(id)===entry)musicFills.delete(id);console.info(JSON.stringify({message:'music cache fill',result,bytes,durationMs:Date.now()-now}));}
  })());
}
async function mediaResponse(request,env,ctx,key){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'Range, If-Range, If-None-Match','access-control-max-age':'86400'}});
  if(request.method!=='GET'&&request.method!=='HEAD')return mediaError(405,'Method Not Allowed','method-not-allowed','BYPASS',{allow:'GET, HEAD, OPTIONS'});
  const head=request.method==='HEAD',range=head?null:request.headers.get('range'),ifRange=range?request.headers.get('if-range'):null,cache=mutableUI(key)?null:caches.default;
  const lookup=mediaCacheRequest(request,true);if(head)lookup.headers.delete('range');
  if(cache){
    let cached;try{
      if(ifRange||request.headers.has('if-none-match')){
        const wholeRequest=mediaCacheRequest(request,true);wholeRequest.headers.delete('range');wholeRequest.headers.delete('if-range');
        const whole=await cache.match(wholeRequest);
        if(whole?.status===304)cached=whole;
        else if(whole){
          const metadata={httpEtag:whole.headers.get('etag'),uploaded:whole.headers.get('last-modified')};
          if(ifRangeMatches(ifRange,metadata)){await whole.body?.cancel();const ranged=new Request(lookup);ranged.headers.delete('if-range');cached=await cache.match(ranged);}
          else cached=whole;
        }
      }else cached=await cache.match(lookup);
    }catch(_){console.warn('Media cache read unavailable; serving R2');}
    if(cached){
      if(cached.status===416){if(cached.body)ctx.waitUntil(cached.body.cancel());return mediaError(416,'Range Not Satisfiable','range-not-satisfiable','HIT',{'accept-ranges':'bytes','content-range':cached.headers.get('content-range')||'*'});}
      if(head){if(cached.body)ctx.waitUntil(cached.body.cancel());cached=new Response(null,{status:cached.status,headers:cached.headers});}
      return mediaDelivery(cached,'HIT');
    }
  }
  let object,metadata,rangeAllowed=!!range;
  const cacheStatus=cache?'MISS':'BYPASS',noneMatch=request.headers.get('if-none-match');
  const unsatisfied=size=>mediaError(416,'Range Not Satisfiable','range-not-satisfiable',cacheStatus,{'accept-ranges':'bytes','content-range':`bytes */${size}`});
  // Only conditional/ranged requests need a metadata read; ordinary GET stays
  // a single streaming read. Evaluate validators before applying Range.
  if(head||range||noneMatch){
    metadata=await env.SOLAR_TIME_MEDIA.head(key);
    if(!metadata)return mediaError(404,'Not Found','not-found',cacheStatus);
    if(etagMatches(noneMatch,metadata.httpEtag))return mediaDelivery(new Response(null,{status:304,headers:mediaHeaders(metadata,304,key)}),cacheStatus);
    if(ifRange)rangeAllowed=ifRangeMatches(ifRange,metadata);
    if(rangeAllowed&&!validByteRange(range,metadata.size))return unsatisfied(metadata.size);
  }
  if(head)object=metadata;
  else try{object=await env.SOLAR_TIME_MEDIA.get(key,rangeAllowed?{range:new Headers({range})}:undefined);}
  catch(error){
    // A missing/changed object can still invalidate a range after HEAD.
    // Never disguise unrelated storage/network errors as a client range error.
    if(!rangeAllowed||!(error?.code===10039||error?.code==='10039'||error?.code==='InvalidRange'||/\b(?:InvalidRange|10039)\b/.test(String(error?.message))))throw error;
    const current=await env.SOLAR_TIME_MEDIA.head(key);
    if(!current)return mediaError(404,'Not Found','not-found',cacheStatus);
    return unsatisfied(current.size);
  }
  if(!object)return mediaError(404,'Not Found','not-found',cacheStatus);
  if(etagMatches(noneMatch,object.httpEtag)){if(object.body)ctx.waitUntil(object.body.cancel());return mediaDelivery(new Response(null,{status:304,headers:mediaHeaders(object,304,key)}),cacheStatus);}
  const partial=!!range&&!!object.range,status=partial?206:200,headers=mediaHeaders(object,status,key);
  if(head)return mediaDelivery(new Response(null,{status,headers}),cache?'MISS':'BYPASS');
  const response=new Response(object.body,{status,headers});
  if(cache){
    const cacheKey=mediaCacheRequest(request),whole=!partial||Number(headers.get('content-length'))===object.size;
    // Store only complete 200 responses. Cache.match can then answer Range/ETag
    // requests itself. Never buffer media in JS or prefetch unbounded archives.
    if(whole){
      const copy=response.clone();ctx.waitUntil(cache.put(cacheKey,new Response(copy.body,{headers:mediaHeaders(object,200,key)})).catch(error=>console.warn('Media cache write failed',String(error))));
    }else if(/\.mp3$/i.test(key)&&object.size<=16*1024*1024){
      fillMusic(cache,cacheKey,env,ctx,key);
    }
  }
  return mediaDelivery(response,cache?'MISS':'BYPASS');
}

export default {
 async scheduled(event,env,ctx){ctx.waitUntil(cleanupHelperReceipts(env));},
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  try{
   if(url.pathname.startsWith(HELPER_API_PREFIX))return await helperApiResponse(request,env,ctx,url);
   if(url.pathname.startsWith(MEDIA_PREFIX)){
    let key;try{key=decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));}catch(_){return mediaError(400,'Bad Request','bad-path');}
    if(key.startsWith('releases/runtime/'))return mediaError(404,'Not Found','not-found');
    if(!key||key.includes('..'))return mediaError(400,'Bad Request','bad-path');
    const started=Date.now(),response=await mediaResponse(request,env,ctx,key);
    // Existing Workers log sampling bounds telemetry cost. No body reads or
    // user identifiers: record regional response setup, not download duration.
    const contentLength=Number(response.headers.get('content-length'))||0;
    console.info(JSON.stringify({message:'media delivery',method:request.method,kind:key.split('.').pop()?.toLowerCase(),colo:request.cf?.colo||null,country:request.cf?.country||null,status:response.status,cache:response.headers.get('x-solar-media-cache'),range:request.headers.has('range'),contentLength,bytes:request.method==='HEAD'||response.status===304?0:contentLength,responseMs:Date.now()-started}));
    return response;
   }
   return await env.ASSETS.fetch(request);
  }catch(error){
   console.error(JSON.stringify({message:'request failed',path:url.pathname,error:error instanceof Error?error.message:String(error)}));
   return url.pathname.startsWith(MEDIA_PREFIX)?mediaError(500,'Internal Server Error','internal'):new Response('Internal Server Error',{status:500});
  }
 }
};
