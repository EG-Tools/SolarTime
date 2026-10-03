/* Solar Time resilient local preferences. */
(function(root){
  'use strict';
  const modules=root.SolarModules||(root.SolarModules={});
  function read(key,fallback=null){
    try{const value=JSON.parse(root.localStorage.getItem(key)||'null');return value??fallback;}
    catch(_){return fallback;}
  }
  function write(key,value){
    try{root.localStorage.setItem(key,JSON.stringify(value));return true;}
    catch(_){return false;}
  }
  function createHelpReminder(now=()=>Date.now()){
    const seenKey='solar-time.help-seen.v1',visitKey='solar-time.help-visit.v1',absence=14*24*60*60*1000;
    let seen=read(seenKey)===true,state={lastActive:0,pending:!seen},lastWrite=0;
    const current=()=>{const value=read(visitKey,state);return value&&Number.isFinite(value.lastActive)&&value.lastActive>=0&&typeof value.pending==='boolean'?value:state;};
    const save=value=>{state=value;lastWrite=value.lastActive;write(visitKey,value);};
    return Object.freeze({
      visit(){
        const time=now(),previous=current();
        // Keep an unshown reminder across reloads. Existing seen-only users
        // establish a baseline without receiving another popup immediately.
        const pending=previous.pending||read(seenKey,seen)!==true||(previous.lastActive>0&&time-previous.lastActive>=absence);
        save({lastActive:time,pending});return pending;
      },
      touch(force=false){
        const time=now();if(!force&&time>=lastWrite&&time-lastWrite<60000)return;
        save({...current(),lastActive:time});
      },
      pending(){return current().pending;},
      seen(){seen=true;write(seenKey,true);save({lastActive:now(),pending:false});}
    });
  }
  modules.Preferences=Object.freeze({read,write,createHelpReminder});
})(window);
