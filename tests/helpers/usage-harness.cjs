'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../src/usage-analytics.js'),'utf8');
function attachUsage(window,{granted=true,production=true}={}){
 const events=[],listeners=[];
 const old=window.addEventListener?.bind(window);
 window.addEventListener=(name,fn)=>{if(name==='solar:consentchange')listeners.push(fn);old?.(name,fn);};
 window.SolarConsent={value:()=>granted?'granted':'denied'};
 window.SolarGoogleAnalytics={production,measurementId:'G-4MP85CMH64'};
 window.gtag=(...args)=>events.push(args);
 const run=()=>vm.runInNewContext(source,{window});run();
 return {events,run,listeners,change(value){granted=value;for(const listener of listeners)listener({detail:{value:value?'granted':'denied'}});}};
}
module.exports={attachUsage};
