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

function mediaHeaders(object,status,key){
 const headers=new Headers();object.writeHttpMetadata(headers);
 const type=mediaType(key);if(type)headers.set('content-type',type);
 headers.set('etag',object.httpEtag);headers.set('accept-ranges','bytes');
 headers.set('access-control-allow-origin','*');headers.set('cross-origin-resource-policy','cross-origin');
 headers.set('cache-control',mediaCacheControl(key));
 if(status===206&&object.range&&'offset' in object.range){
  const start=object.range.offset,end=start+('length' in object.range?object.range.length:object.size)-1;
  headers.set('content-range',`bytes ${start}-${end}/${object.size}`);
 }
 return headers;
}

async function mediaResponse(request,env,ctx,key){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'Range','access-control-max-age':'86400'}});
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{allow:'GET, HEAD, OPTIONS'}});
  const range=request.headers.get('range'),cache=range||mutableUI(key)?null:caches.default;
  if(cache){const cached=await cache.match(request);if(cached)return cached;}
  const object=await env.SOLAR_TIME_MEDIA.get(key,{range:request.headers});
  if(!object)return new Response('Not Found',{status:404});
  if(request.headers.get('if-none-match')===object.httpEtag)return new Response(null,{status:304,headers:mediaHeaders(object,304,key)});
  const partial=!!request.headers.get('range')&&!!object.range,status=partial?206:200,headers=mediaHeaders(object,status,key);
  if(request.method==='HEAD')return new Response(null,{status,headers});
  const response=new Response(object.body,{status,headers});if(cache)ctx.waitUntil(cache.put(request,response.clone()));return response;
}

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  try{
   if(url.pathname.startsWith(MEDIA_PREFIX)){
    const key=decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));
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
