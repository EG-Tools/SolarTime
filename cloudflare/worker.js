const MEDIA_PREFIX='/media/';

function mediaType(key){
 const value=String(key||'').toLowerCase();
 if(value.endsWith('.png'))return 'image/png';
 if(value.endsWith('.webp'))return 'image/webp';
 if(value.endsWith('.mp3'))return 'audio/mpeg';
 if(value.endsWith('.json'))return 'application/json; charset=utf-8';
 if(value.endsWith('.svg'))return 'image/svg+xml';
 if(value.endsWith('.gz'))return 'application/gzip';
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
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  try{
   if(url.pathname.startsWith(MEDIA_PREFIX)){
    let key;try{key=decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));}catch(_){return new Response('Bad Request',{status:400});}
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
