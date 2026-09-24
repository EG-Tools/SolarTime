/* Optional Windows protocol bridge. A dispatched URI is NEVER a success receipt. */
(function(root){
  'use strict';
  const modules=root.SolarModules=root.SolarModules||{};
  const HELPER_URL='https://solar-time.keg0320.workers.dev/media/releases/content/windows/SolarTimeShutdownHelper.4a6a6f50fc48ada9.cmd';
  const HELPER_SOURCE_URL='https://solar-time.keg0320.workers.dev/media/releases/content/windows/SolarTimeShutdownHelper.4a6a6f50fc48ada9.source.txt';
  const HELPER_SHA256='4A6A6F50FC48ADA93996B036CD3F21C68F083ABB3B946A72FECD9ADC07C37F41';
  const API='https://solar-time.keg0320.workers.dev/api/windows-helper/';
  const HELPER_STATUS_URL=API+'install-status';
  const TOKEN=/^[a-f0-9]{32}$/,TIMEOUT=45000;
  function platform(userAgent=root.navigator?.userAgent||'',reported=root.navigator?.platform||''){
    const ua=String(userAgent),native=String(reported),mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua),windows=/Windows/i.test(ua)||/^Win/i.test(native);return {windows,mobile};
  }
  function create(document=root.document){
    const detected=platform(),eligible=detected.windows&&!detected.mobile;
    let lastIssued=0;
    const tasks=new Set();
    function randomToken(){if(!eligible||!root.crypto?.getRandomValues)return '';const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
    function invoke(uri){
      if(!eligible||root.navigator?.userActivation?.isActive===false)return false;
      const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.src=uri;
      // Keep the frame while the user answers the external-protocol dialog.
      document.body.append(frame);root.setTimeout(()=>frame.remove(),TIMEOUT+15000);return true;
    }
    function download(){const token=randomToken();if(!token)return '';const link=document.createElement('a'),url=new URL(HELPER_URL);url.searchParams.set('install',token);link.href=url.href;link.download='SolarTimeShutdownHelper.cmd';link.rel='noopener';link.hidden=true;document.body.append(link);link.click();link.remove();return token;}
    async function getStatus(endpoint,token){
      const url=new URL(API+endpoint);url.searchParams.set('token',token);
      const controller=new root.AbortController(),timer=root.setTimeout(()=>controller.abort(),5000);
      try{const response=await root.fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)return null;return await response.json();}catch(_){return null;}finally{root.clearTimeout(timer);}
    }
    async function installStatus(token){if(!TOKEN.test(String(token||'')))return false;const result=await getStatus('install-status',token);return result?.installed===true&&result.protocol===2&&result.revision===HELPER_SHA256;}
    function command(action,seconds){
      const token=randomToken(),at=lastIssued=Math.max(Date.now(),lastIssued+1);
      if(!token)return Promise.resolve({ok:false,uncertain:false,reason:'unsupported'});
      const query=(action==='schedule'?'seconds='+seconds+'&':'')+'token='+token+'&at='+at;
      // This must happen synchronously inside the click/change event, before any await.
      try{if(!invoke('solartime-timer://'+action+'?'+query))return Promise.resolve({ok:false,uncertain:false,reason:'not-launched'});}catch(_){return Promise.resolve({ok:false,uncertain:false,reason:'not-launched'});}
      return new Promise(resolve=>{
        let done=false,poll=0;
        const task={finish(result){if(done)return;done=true;root.clearTimeout(poll);root.clearTimeout(timeout);tasks.delete(task);resolve(result);}};
        const timeout=root.setTimeout(()=>task.finish({ok:false,uncertain:true,reason:'timeout'}),TIMEOUT);
        tasks.add(task);
        async function check(){
          const result=await getStatus('operation-status',token);if(done)return;
          const receipt=result?.result;
          if(receipt&&receipt.protocol===2&&receipt.action===action&&receipt.at===at&&typeof receipt.ok==='boolean'&&Number.isInteger(receipt.code)){
            if(receipt.revision!==HELPER_SHA256){task.finish({ok:false,uncertain:true,reason:'revision'});return;}
            if(receipt.ok&&action==='schedule'&&(!Number.isSafeInteger(receipt.deadline)||receipt.deadline<at||receipt.deadline>at+(seconds+180)*1000)){
              task.finish({ok:false,uncertain:true,reason:'invalid-receipt'});return;
            }
            task.finish({...receipt,uncertain:false,reason:receipt.ok?'':'native-error'});return;
          }
          poll=root.setTimeout(check,1000);
        }
        check();
      });
    }
    return Object.freeze({
      eligible,platform:detected,download,installStatus,helperUrl:HELPER_URL,helperSourceUrl:HELPER_SOURCE_URL,helperSha256:HELPER_SHA256,
      schedule(seconds){const value=Math.max(60,Math.min(359940,Math.round(Number(seconds)||0)));return command('schedule',value);},
      cancel(){return command('cancel');},probe(){return command('probe');},uninstall(){return command('uninstall');},
      dispose(){for(const task of [...tasks])task.finish({ok:false,uncertain:true,reason:'disposed'});}
    });
  }
  modules.WindowsShutdown=Object.freeze({create,platform,HELPER_URL,HELPER_SOURCE_URL,HELPER_SHA256,HELPER_STATUS_URL});
})(typeof window!=='undefined'?window:globalThis);
