/* Test-only astronomy and surface adapters. NEVER referenced by index.html.
   The actual app.js, renderer.js, materials.js and sky.js run around these adapters. */
(function(){'use strict';
 const TAU=Math.PI*2,DEG=Math.PI/180,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=(n,m=TAU)=>(n%m+m)%m;
 const ids=['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto'];
 const size=[6.5,10.5,17.25,8.5,29,24,16.5,16,5],orbit=[95,143,198,254,344,440,533,625,718];
 const BODIES=ids.map((id,i)=>({id,ko:id,en:id.toUpperCase(),size:size[i],orbit:orbit[i],tilt:23,spin:1,spinSeconds:86400,period:365,color:'#bbbbbb',description:'TEST FIXTURE'}));
 const SUN={id:'sun',ko:'sun',en:'SUN',size:28,tilt:7.25,spin:25,period:1},MOON={id:'moon',ko:'moon',en:'MOON',size:3.9,tilt:6.68,spin:27,period:27,displayOrbit:30};
 const now=Date.UTC(2026,8,12),MIN_TIME=Date.UTC(1800,0,1),MAX_TIME=Date.UTC(2999,11,31);
 class Clock{constructor(t,m){this.anchorMs=t;this.anchorMono=m;this.rate=1;this.live=true;this.paused=false;}value(m,w=Date.now()){return this.paused?this.anchorMs:this.live?w:this.anchorMs+(m-this.anchorMono)*this.rate;}setRate(r,m){this.anchorMs=this.value(m);this.anchorMono=m;this.rate=r;this.live=false;this.paused=false;}setDate(t,m){this.anchorMs=t;this.anchorMono=m;this.live=false;this.paused=true;}toggle(m){if(!this.paused)this.anchorMs=this.value(m);this.anchorMono=m;this.paused=!this.paused;}now(m){this.anchorMs=Date.now();this.anchorMono=m;this.live=true;this.paused=false;this.rate=1;}}
 const point=(r,t)=>({x:r*Math.cos(t),y:r*Math.sin(t),z:r*.02*Math.sin(t)});
 const A={TAU,DEG,clamp,wrap,BODIES,SUN,MOON,MIN_TIME,MAX_TIME,SimulationClock:Clock,
 calibrateAt(){},modelStatus:()=>({year:2026,epoch:now}),modelYear:()=>2026,
 positionAt:(b,t,display=false)=>point(display?b.orbit||0:(b.orbit||1)/198,ids.indexOf(b.id)*.57+.3),
 orbitAt:(b,t,count=360)=>Array.from({length:count+1},(_,i)=>point(b.orbit,i/count*TAU)),
 moonAt:(t,r=1)=>point(r,.7),moonElements:()=>({}),pointOnOrbit:(el,t,r)=>point(r,t),
 moonPhase:()=>({fraction:.5,name:'fixture'}),rotationPoleTilt:b=>(b.tilt||0)*DEG,
 rotationAt:()=>0,bodyAxes:()=>({u:{x:1,y:0,z:0},v:{x:0,y:1,z:0},pole:{x:0,y:0,z:1}}),
 surfaceDirection:()=>({x:.3,y:-.4,z:Math.sqrt(.75)}),siteSun:()=>({altitude:30})};
 window.SolarAstro=A;
 class Surface{constructor(){this.images=new Map();this.stats={fixture:true};}update(jobs){for(const j of jobs)if(!this.images.has(j.id)){let c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(20,20,1,32,32,32);g.addColorStop(0,'#dddddd');g.addColorStop(1,'#222222');x.fillStyle=g;x.beginPath();x.arc(32,32,31,0,TAU);x.fill();this.images.set(j.id,c);}}get(id){return this.images.get(id);}resume(){}pause(){}invalidate(){}dispose(){this.images.clear();}}
 window.SolarSurface={Service:Surface};
})();
