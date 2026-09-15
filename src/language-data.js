/* Solar Time language payload loader. Web and local launches fetch one active
   locale from the public Cloudflare site and therefore require a connection. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  const supported=Object.freeze(['kor','en','chn','jpn','hi','es','de','fr']);
  const cache=new Map(),pending=new Map();
  const scriptUrl=new URL(document.currentScript?.src||location.href,location.href);
  const valid=value=>value&&typeof value.copy==='object'&&typeof value.bodies==='object'&&typeof value.phases==='object';
  async function load(code){
    if(!supported.includes(code))code='kor';
    if(cache.has(code))return cache.get(code);
    if(pending.has(code))return pending.get(code);
    const task=(async()=>{
      const base=location.protocol==='file:'?new URL('https://solartime.app/src/locales/'):new URL('locales/',scriptUrl);
      const url=new URL(code+'.json',base);url.search=scriptUrl.search;
      const response=await fetch(url,{cache:'force-cache',credentials:'same-origin'});
      if(!response.ok)throw Error('Language data could not be loaded: '+code+' ('+response.status+')');
      const data=await response.json();if(!valid(data))throw Error('Language data is invalid: '+code);
      cache.set(code,data);return data;
    })();
    pending.set(code,task);
    try{return await task;}finally{pending.delete(code);}
  }
  modules.LanguageData=Object.freeze({supported,load,loaded:code=>cache.has(code)});
})(window);
