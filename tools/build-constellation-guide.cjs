'use strict';
// Static illustrations reuse the runtime catalogue; no sky renderer runs in the guide.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const descriptions={
 'big-dipper':'Find the four-star bowl and the three-star handle. The outer bowl edge joins Merak and Dubhe. Compare this compact pattern with Ursa Major to see how a familiar asterism fits inside a larger constellation.',
 'polaris':'This single-star target uses a circle instead of a stick figure. Compare it with Ursa Minor: Polaris sits at the end of the smaller dipper\'s handle. Its large display symbol is a visual aid.',
 'ursa-major':'Begin with the Dipper, then trace the extra branches forming the bear\'s body and legs. Switching between these two targets is a useful way to learn which stars belong to both drawings.',
 'ursa-minor':'Follow the narrow handle from Polaris to the small bowl. Compare its proportions with the broader Big Dipper. Keeping the Polaris marker enabled provides a reference while you rotate the scene.',
 'cassiopeia':'Five main stars form a compact zigzag. It may read as a W, an M, or a tilted series of peaks depending on camera orientation. Try identifying it again with its connecting lines switched off.',
 'orion':'Start at the three aligned belt stars, then trace the broad body around them. The longer branches extend beyond the familiar central figure; use the belt as your anchor when the complete drawing looks busy.',
 'scorpius':'Follow the long chain from the branches near Antares into the curved tail. Its bend is more distinctive than any single straight segment. Rotate the view and look for that same hook again.',
 'leo':'Look for the curved head at one end and the triangular body toward Denebola. Keeping those two shapes in mind is easier than memorising every segment of the full lion.',
 'cygnus':'Locate the central crossing, then follow the long axis and the two wings. The cross is the easiest first impression; the complete app drawing includes additional stars along its branches.',
 'taurus':'Find the face near Aldebaran and follow the two long horns. Compare the short, crowded face segments with the much longer horn lines rather than treating the entire pattern as one triangle.',
 'aries':'A short bent chain makes Aries a useful starting target after a complex figure. Identify its brightest labelled star, then turn the connecting lines off and try to recover the same curve.',
 'gemini':'Find the two head stars, Castor and Pollux, then follow the two branching bodies. The drawings need not look perfectly parallel: the paired heads are the more reliable recognition cue.',
 'cancer':'Look for a modest branching figure rather than a bright, dramatic outline. Follow the central junction first. The enlarged dots in this guide make the structure easier to study than in a real bright urban sky.',
 'virgo':'Begin at Spica and work along the wide, branching figure. Virgo spreads across a large area; compare the branch directions before trying to memorise its many individual segments.',
 'libra':'Trace the broad loop and its projecting branch. Contrast this comparatively compact figure with the long curve of neighbouring Scorpius when moving through the zodiac patterns.',
 'sagittarius':'Find the compact Teapot-like group inside the larger branched drawing. Study that small group first, then follow the extended limbs so that the full figure does not become a tangle of lines.',
 'capricornus':'Look for a shallow, extended chain with shorter branches beneath it. Solar Time uses the connected figure shown here; other charts may emphasise a more triangular silhouette.',
 'aquarius':'Start at the upper chain and follow the long descending branches. This is a spread-out figure, so tracing one branch at a time is more useful than expecting a compact symbol.',
 'pisces':'Two extended chains meet near Alrescha, with a loop at one end. Follow the connection between the two parts before studying the smaller loop. A wide camera view helps preserve the overall shape.',
 'pegasus':'Find the Great Square, then trace the branches leaving it. Alpheratz forms one corner of this drawing and also begins the Andromeda chain; compare both targets to recognise their shared landmark.',
 'andromeda':'Follow the main chain from Alpheratz through Mirach toward Almach. A shorter branch leaves the chain near Mirach. Compare that branch with the nearby galaxy illustration in the app.',
 'crux':'Two crossing axes make a compact Southern Cross. Compare its short outline with the much larger Cygnus cross. Similar shapes do not mean that two patterns occupy the same part of the sky.'
};
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit=a=>{const n=Math.hypot(a.x,a.y,a.z);return {x:a.x/n,y:a.y/n,z:a.z/n};};
function catalogue(root){
 const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'src/sky.js'),'utf8'),context);
 return Object.values(context.window.SolarSky.FEATURES);
}
function diagram(feature){
 const centre=unit(feature.stars.reduce((v,s)=>({x:v.x+s.direction.x,y:v.y+s.direction.y,z:v.z+s.direction.z}),{x:0,y:0,z:0}));
 const tilt=23.4392911*Math.PI/180,pole={x:0,y:Math.sin(tilt),z:Math.cos(tilt)};
 const right=unit(cross(centre,pole)),up=unit(cross(right,centre));
 const raw=feature.stars.map(s=>{const d=dot(s.direction,centre);if(d<=0)throw Error('Diagram exceeds tangent hemisphere: '+feature.id);return {x:dot(s.direction,right)/d,y:-dot(s.direction,up)/d};});
 const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(288/Math.max(maxX-minX,1e-8),174/Math.max(maxY-minY,1e-8));
 const points=raw.map(p=>({x:180+(p.x-(minX+maxX)/2)*scale,y:116+(p.y-(minY+maxY)/2)*scale}));
 const num=n=>n.toFixed(2),line=feature.edges.map(([a,b])=>'<line x1="'+num(points[a].x)+'" y1="'+num(points[a].y)+'" x2="'+num(points[b].x)+'" y2="'+num(points[b].y)+'"/>').join('');
 const stars=points.map((p,i)=>'<circle cx="'+num(p.x)+'" cy="'+num(p.y)+'" r="'+num(Math.max(1.8,4-feature.stars[i].magnitude*.3))+'"><title>'+escape(feature.stars[i].name)+'</title></circle>').join('');
 const name=feature.card.english,brightest=feature.stars.reduce((a,b)=>a.magnitude<b.magnitude?a:b);
 return '<svg class="constellation-chart" viewBox="0 0 360 250" role="img" aria-labelledby="chart-'+feature.id+'"><title id="chart-'+feature.id+'">'+escape(name)+' — '+feature.stars.length+' plotted stars; north up, east left</title><g fill="none" stroke="#c9ad79" stroke-width="1.4">'+line+(feature.marker?'<circle cx="180" cy="116" r="14"/>':'')+'</g><g fill="#edf4ff">'+stars+'</g><text x="180" y="238" text-anchor="middle" fill="#aeb8c7" font-size="13">'+escape(brightest.name)+'</text></svg>';
}
function render(root){
 const features=catalogue(root);
 if(features.length!==Object.keys(descriptions).length||features.some(f=>!descriptions[f.id]))throw Error('Update guide descriptions for the current catalogue.');
 return '      <div class="info-grid constellation-grid">\n'+features.map(feature=>'        <article class="info-card" id="'+feature.id+'"><h3>'+escape(feature.card.english.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()))+'</h3>'+diagram(feature)+'<p>'+escape(descriptions[feature.id])+'</p></article>').join('\n')+'\n      </div>';
}
function sync(root,{write=false}={}){
 const file=path.join(root,'constellations.html'),source=fs.readFileSync(file,'utf8'),start='      <!-- constellation-catalogue:start -->',end='      <!-- constellation-catalogue:end -->';
 const a=source.indexOf(start),b=source.indexOf(end);if(a<0||b<a)throw Error('Missing constellation catalogue markers.');
 const next=source.slice(0,a+start.length)+'\n'+render(root)+'\n'+source.slice(b);
 if(next!==source){if(!write)throw Error('Stale constellation diagrams. Run node tools/build-constellation-guide.cjs --write.');fs.writeFileSync(file,next);}
 return next!==source;
}
if(require.main===module){const root=path.resolve(__dirname,'..');sync(root,{write:process.argv.includes('--write')});console.log('Constellation guide matches the runtime catalogue.');}
module.exports={catalogue,diagram,render,sync};
