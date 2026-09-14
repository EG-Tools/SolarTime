/* Solar Time v0.35: packaged, resolution-tiered materials.
 * Browsers no longer download public 8K photographs, resize them or store
 * Base64 copies in IndexedDB. The release manifest is the single authority. */
(function(root){'use strict';
const REV=root.SolarAssetManifest?.revision||root.SolarAssets?.materialRevision||'offline';
const ids=Object.freeze(['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','europa','clouds']);
const catalog=Object.freeze(ids.map(id=>Object.freeze({id})));
function valid(asset){
 if(typeof asset==='string')return asset.startsWith('data:image/webp;base64,');
 return !!asset&&typeof asset.fallback==='string'&&asset.fallback.length>0&&Array.isArray(asset.tiers)&&asset.tiers.length>0&&asset.tiers.every(row=>Number.isFinite(row.width)&&row.width>=512&&typeof row.path==='string');
}
class Materials {
 constructor(){this.disposed=false;this.state={status:'packaged',loaded:0,total:ids.length,errors:[],cacheAvailable:true};this.refresh();}
 refresh(){const materials=root.SolarAssets?.materials||{};this.state.loaded=ids.filter(id=>valid(materials[id])).length;this.state.status=this.state.loaded===this.state.total?'ready':this.state.loaded?'partial':'fallback';}
 notify(){this.refresh();root.dispatchEvent?.(new CustomEvent('solar-material-status',{detail:{...this.state}}));}
 load(){if(!this.disposed)this.notify();return Promise.resolve(this.state);}
 cancel(){}
 dispose(){this.disposed=true;}
}
root.SolarMaterials={Owner:Materials,catalog,revision:REV,valid};
if(typeof module==='object'&&module.exports)module.exports=root.SolarMaterials;
})(typeof window==='object'?window:globalThis);
