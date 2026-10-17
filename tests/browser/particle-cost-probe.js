(() => {
  const r=SolarTime.renderer,original=r.drawFlightParticles,rows=[],pairs={};
  const stat=values=>{if(!values.length||values.some(v=>!Number.isFinite(v)))throw Error('Invalid particle timing samples');const sorted=[...values].sort((a,b)=>a-b);return {samples:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};
  r.drawFlightParticles=function(c,field,project){
    const kind=field.replay?.openingMove?'opening':field.replay?.saturnTour?'ring-entry':'warp';
    const capture=!pairs[kind],frozen=capture?new Map():null;
    let projection=0,count=0,visible=0;const start=performance.now();
    const result=original.call(this,c,field,(p,f,out)=>{const begin=performance.now(),q=project(p,f,out);projection+=performance.now()-begin;count++;if(q.visible&&q.alpha>=1e-4)visible++;if(frozen)frozen.set(p,{...q});return q;});
    rows.push({kind,total:performance.now()-start,projection,count,visible});
    if(capture&&visible>=20){
      const canvas=document.createElement('canvas');canvas.width=c.canvas.width;canvas.height=c.canvas.height;
      const ctx=canvas.getContext('2d'),plain=[],timed=[],counts=[];
      const lookup=(p,f,out)=>{const q=frozen.get(p);if(!q)throw Error('Particle inputs changed during calibration');return Object.assign(out||{},q);};
      const run=instrumented=>{ctx.clearRect(0,0,canvas.width,canvas.height);let calls=0,measured=0;const projectionFn=instrumented?(...args)=>{const t=performance.now(),q=lookup(...args);measured+=performance.now()-t;calls++;return q;}:lookup;
        const t=performance.now();original.call(this,ctx,field,projectionFn);const elapsed=performance.now()-t;if(instrumented)counts.push(calls);return elapsed;};
      run(false);run(true);counts.length=0;
      for(let i=0;i<8;i++){if(i%2){timed.push(run(true));plain.push(run(false));}else{plain.push(run(false));timed.push(run(true));}}
      if(counts.some(n=>n!==count))throw Error('Particle count changed during calibration');
      pairs[kind]={particles:count,visible,baselineMs:stat(plain),instrumentedMs:stat(timed),pairedDeltaMs:stat(timed.map((v,i)=>v-plain[i])),scope:'Same frame, same particles and frozen projected coordinates, offscreen Canvas CPU submission; calibrates timer wrapper overhead, not live projection or GPU completion.'};
    }
    return result;
  };
  return window.__particleCostProbe={finish(){r.drawFlightParticles=original;const valid=rows.filter(x=>x.count>0);if(!valid.length||!Object.keys(pairs).length)throw Error('No usable particle frames');return {scope:'Instrumented live CPU timings plus paired frozen-frame calibration. Software/offline runs are not device FPS.',frames:valid.length,liveTotalMs:stat(valid.map(x=>x.total)),liveProjectionMs:stat(valid.map(x=>x.projection)),liveSubmissionAndLoopMs:stat(valid.map(x=>Math.max(0,x.total-x.projection))),pairs};}};
})()
