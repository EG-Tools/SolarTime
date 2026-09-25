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
  modules.AlarmSound=Object.freeze({prepare,decodeBounded,decodedBytes,MAX_BYTES,MAX_DECODED_BYTES});
})(window);
