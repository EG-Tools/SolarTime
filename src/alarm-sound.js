/* Bounded alarm audio: Blob media streams avoid expanding long files into PCM. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={}),MAX_BYTES=30*1024*1024,MAX_DECODED_BYTES=32*1024*1024;
  const decodedBytes=buffer=>Number(buffer?.length||0)*Number(buffer?.numberOfChannels||0)*4;
  async function decodeBounded(blob,context){
    if(blob.size>MAX_BYTES)throw Error('Alarm file exceeds the compressed size limit');
    const buffer=await context.decodeAudioData(await blob.arrayBuffer());
    if(decodedBytes(buffer)>MAX_DECODED_BYTES)throw Error('Use streaming for a large decoded alarm');
    return buffer;
  }
  async function prepare(blob,{getContext,signal}={}){
    if(signal?.aborted)throw Error('Alarm preparation cancelled');
    if(blob.size>MAX_BYTES)throw Error('Alarm file exceeds the compressed size limit');
    // A modern browser retains the compressed Blob and lets its media decoder
    // stream it; there is no duration-dependent full-file AudioBuffer allocation.
    const urls=root.URL;
    if(typeof root.Audio==='function'&&typeof urls?.createObjectURL==='function'){
      const url=urls.createObjectURL(blob);let disposed=false;
      const dispose=()=>{if(!disposed){disposed=true;urls.revokeObjectURL(url);}};
      try{
        const duration=await new Promise((resolve,reject)=>{
          const media=new root.Audio();let timer,done=false;
          const finish=(error)=>{if(done)return;done=true;root.clearTimeout?.(timer);signal?.removeEventListener('abort',abort);media.onloadedmetadata=media.onerror=null;
            const duration=media.duration;try{media.pause();media.removeAttribute?.('src');media.load?.();}catch(_){}error?reject(error):resolve(duration);};
          const abort=()=>finish(Error('Alarm preparation cancelled'));
          signal?.addEventListener('abort',abort,{once:true});
          media.onloadedmetadata=()=>finish(Number.isFinite(media.duration)&&media.duration>0?null:Error('Invalid audio duration'));
          media.onerror=()=>finish(Error('Unsupported audio file'));
          timer=root.setTimeout(()=>finish(Error('Audio metadata timeout')),10000);
          media.preload='metadata';media.src=url;media.load?.();
        });
        if(signal?.aborted)throw Error('Alarm preparation cancelled');
        // Short alarms retain the existing Web Audio playback path (including
        // mobile autoplay unlocking). Long tracks stay streamed and bounded.
        if(duration<=60&&getContext){
          try{const context=getContext();if(context){const buffer=await decodeBounded(blob,context);if(signal?.aborted)throw Error('Alarm preparation cancelled');dispose();return {url:'',buffer,duration,dispose(){this.buffer=null;}};}}
          catch(error){if(signal?.aborted)throw error;/* Media playback remains available when Web Audio cannot decode this format. */}
        }
        return {url,buffer:null,duration,dispose};
      }catch(error){dispose();throw error;}
    }
    // Older/test environments without Blob media support retain the bounded
    // Web Audio fallback. Playback never retains a buffer above the budget.
    const context=getContext?.();if(!context)throw Error('Audio unavailable');
    const buffer=await decodeBounded(blob,context);
    if(signal?.aborted)throw Error('Alarm preparation cancelled');
    return {buffer,url:'',duration:buffer.duration||0,dispose(){this.buffer=null;}};
  }
  // Default sound only: probe before decoding. Never expand a long track to PCM.
  const DEFAULT_TIMEOUT=12000,DEFAULT_MAX_BYTES=4*1024*1024,DEFAULT_MAX_SECONDS=45,DEFAULT_MAX_PCM=16*1024*1024;
  function abortError(){return Error('Default alarm preparation cancelled or timed out');}
  function waitFor(promise,signal){
    return new Promise((resolve,reject)=>{
      if(signal?.aborted){Promise.resolve(promise).catch(()=>{});reject(abortError());return;}
      const abort=()=>{signal?.removeEventListener('abort',abort);reject(abortError());};
      signal?.addEventListener('abort',abort,{once:true});
      Promise.resolve(promise).then(value=>{signal?.removeEventListener('abort',abort);signal?.aborted?reject(abortError()):resolve(value);},error=>{signal?.removeEventListener('abort',abort);reject(error);});
    });
  }
  function remoteDuration(url,signal){
    return new Promise((resolve,reject)=>{
      const media=new root.Audio();let done=false,timer;
      const finish=error=>{if(done)return;done=true;root.clearTimeout?.(timer);signal?.removeEventListener('abort',abort);media.onloadedmetadata=media.onerror=null;
        const duration=media.duration;try{media.pause();media.removeAttribute?.('src');media.load?.();}catch(_){}error?reject(error):resolve(duration);};
      const abort=()=>finish(abortError());signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted){abort();return;}
      media.onloadedmetadata=()=>finish(media.duration>0?null:Error('Invalid default audio duration'));
      media.onerror=()=>finish(Error('Default audio metadata unavailable'));
      timer=root.setTimeout?.(()=>finish(Error('Default audio metadata timeout')),4000);
      try{media.preload='metadata';media.src=url;media.load?.();}catch(error){finish(error);}
    });
  }
  async function readDefault(response,signal){
    if(Number(response.headers?.get?.('content-length')||0)>DEFAULT_MAX_BYTES)throw Error('Default alarm compressed budget exceeded');
    const reader=response.body?.getReader?.();
    if(!reader){const blob=await waitFor(response.blob(),signal);if(blob.size>DEFAULT_MAX_BYTES)throw Error('Default alarm compressed budget exceeded');return blob;}
    let size=0,complete=false;const chunks=[];
    try{
      while(true){const part=await waitFor(reader.read(),signal);if(part.done){complete=true;break;}size+=part.value.byteLength;if(size>DEFAULT_MAX_BYTES)throw Error('Default alarm compressed budget exceeded');chunks.push(part.value);}
      return new Blob(chunks,{type:response.headers?.get?.('content-type')||'audio/mpeg'});
    }finally{if(!complete)reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  async function prepareDefault(urls,{getContext,signal}={}){
    const abort=typeof root.AbortController==='function'?new root.AbortController():null,local=abort?.signal||signal;
    let timer;const cancel=()=>abort?.abort();signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted)cancel();
    if(abort)timer=root.setTimeout?.(cancel,DEFAULT_TIMEOUT);
    try{
      for(const url of [...new Set(urls)]){
        if(local?.aborted)throw abortError();let duration=0;
        const streamed=()=>({url,buffer:null,duration,dispose(){this.url='';this.buffer=null;}});
        try{
          if(typeof root.Audio==='function'){
            duration=await remoteDuration(url,local);
            if(duration>DEFAULT_MAX_SECONDS||!Number.isFinite(duration))return streamed();
          }
          // No media metadata support is a compatibility fallback, still bounded
          // by compressed bytes, retained PCM, and the overall preparation time.
          const response=await waitFor(root.fetch(url,{cache:'force-cache',signal:local}),local);
          if(!response.ok)throw Error('Default audio download failed');
          const blob=await readDefault(response,local),context=getContext?.();if(!context)throw Error('Web Audio unavailable');
          const buffer=await waitFor(context.decodeAudioData(await waitFor(blob.arrayBuffer(),local)),local);
          if(decodedBytes(buffer)>DEFAULT_MAX_PCM||buffer.duration>DEFAULT_MAX_SECONDS){if(typeof root.Audio==='function')return streamed();throw Error('Default alarm decoded budget exceeded');}
          return {url:'',buffer,duration:buffer.duration||duration,dispose(){this.buffer=null;}};
        }catch(error){
          if(local?.aborted)throw error;
          if(duration>0&&typeof root.Audio==='function')return streamed();
        }
      }
      return null;
    }finally{root.clearTimeout?.(timer);signal?.removeEventListener('abort',cancel);abort?.abort();}
  }
  modules.AlarmSound=Object.freeze({prepare,prepareDefault,decodeBounded,decodedBytes,MAX_BYTES,MAX_DECODED_BYTES,DEFAULT_TIMEOUT,DEFAULT_MAX_BYTES,DEFAULT_MAX_SECONDS,DEFAULT_MAX_PCM});
})(window);
