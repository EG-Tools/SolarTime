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
  modules.Preferences=Object.freeze({read,write});
})(window);
