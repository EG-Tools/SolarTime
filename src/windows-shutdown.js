/* Optional Windows protocol bridge. Browsers never execute shutdown.exe directly. */
(function(root){
  'use strict';
  const modules=root.SolarModules=root.SolarModules||{};
  const HELPER_URL='https://solar-time.keg0320.workers.dev/media/releases/content/windows/SolarTimeShutdownHelper.ea76a5dbdc6e2567.cmd';
  const HELPER_SOURCE_URL='https://solar-time.keg0320.workers.dev/media/releases/content/windows/SolarTimeShutdownHelper.ea76a5dbdc6e2567.source.txt';
  const HELPER_SHA256='EA76A5DBDC6E256734ADB430BE04EE5B049CE647E664F3054C4CC11EC1F345FA';
  const HELPER_STATUS_URL='https://solar-time.keg0320.workers.dev/api/windows-helper/install-status';
  function platform(userAgent=root.navigator?.userAgent||'',reported=root.navigator?.platform||''){
    const ua=String(userAgent),native=String(reported),mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua),windows=/Windows/i.test(ua)||/^Win/i.test(native);return {windows,mobile};
  }
  function create(document=root.document){
    const detected=platform(),eligible=detected.windows&&!detected.mobile;
    function invoke(uri){if(!eligible)return false;const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.src=uri;document.body.append(frame);root.setTimeout(()=>frame.remove(),1400);return true;}
    function installToken(){if(!eligible||!root.crypto?.getRandomValues)return '';const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
    function download(){const token=installToken();if(!token)return '';const link=document.createElement('a'),url=new URL(HELPER_URL);url.searchParams.set('install',token);link.href=url.href;link.download='SolarTimeShutdownHelper.cmd';link.rel='noopener';link.hidden=true;document.body.append(link);link.click();link.remove();return token;}
    async function installStatus(token){if(!/^[a-f0-9]{32}$/.test(String(token||'')))return false;try{const url=new URL(HELPER_STATUS_URL);url.searchParams.set('token',token);const response=await root.fetch(url,{cache:'no-store'});if(!response.ok)return false;return (await response.json()).installed===true;}catch(_){return false;}}
    return Object.freeze({
      eligible,platform:detected,download,installStatus,helperUrl:HELPER_URL,helperSourceUrl:HELPER_SOURCE_URL,helperSha256:HELPER_SHA256,
      schedule(seconds){const value=Math.max(60,Math.min(359940,Math.round(Number(seconds)||0)));return invoke('solartime-timer://schedule?seconds='+value);},
      cancel(){return invoke('solartime-timer://cancel');},
      uninstall(){return invoke('solartime-timer://uninstall');}
    });
  }
  modules.WindowsShutdown=Object.freeze({create,platform,HELPER_URL,HELPER_SOURCE_URL,HELPER_SHA256,HELPER_STATUS_URL});
})(typeof window!=='undefined'?window:globalThis);
