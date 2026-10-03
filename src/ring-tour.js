/* Local Saturn-ring flight prototype. The app owns RAF; DirectRenderer owns textures.
   Coordinates are Saturn radii in its equatorial frame: X/Z ring, Y north pole. */
(function(root){
  'use strict';
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const blend=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const SETTINGS=Object.freeze({entry:10,detailStart:2.5,spiralThreshold:.8,return:3.2,returnFar:5,returnMax:7,returnSpeed:1.1,annotationHide:4,annotationLead:1,pathRadius:2.26,pathInner:1.35,pathDepth:.8,debris:30000,grains:5000,fog:10000,chips:10000});
  // 4×2 atlas row order. Keep the angular rock, long ice and flat slab full-size;
  // rounded ice/stone clumps are half-size in both representations.
  const SPRITE_SIZE=Object.freeze([.5,1,.5,.5,1,.5,1,.5]);
  // Keep the small end unchanged; reduce only the maximum size by 20%.
  const FOG_SIZE_SCALE=.75;
  const INSTANCE_SIZE=Object.freeze({rockMin:.001,rockMax:.009*.8,fogMin:.035*FOG_SIZE_SCALE,fogMax:.045*.8*2*FOG_SIZE_SCALE});
  const MESH_MIN_SIZE=.0025;
  const DEBRIS_LAYER_HEIGHT=.055*1.5;
  const BANK_LIMIT=20*Math.PI/180;
  const DUST_HEIGHT_RATIO=.7;
  const GRAIN_HEIGHT=.7*.8*.7*.7*.8*1.5; // Shared vertical spread for entry, orbit and return.
  const GRAIN_WIDTH=.9*.7;
  const edgeSize=(radius,inner=1.28,outer=2.26)=>mix(.35,1,smooth(Math.min(radius-inner,outer-radius)/((outer-inner)*.25)));
  const edgeHeight=(radius,inner=1.28,outer=2.26)=>Math.sqrt(Math.max(0,1-((2*radius-inner-outer)/(outer-inner))**2));
  const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  // Entry removes and retreat restores opacity with one reversible curve.
  const transition=(time,start,end)=>ease((time-start)/Math.max(.001,end-start));
  function projectionEye(p){
    const shift=(1-p.perspective)*p.orthoScale/Math.max(p.perspective,.001);
    return p.eye.map((v,i)=>v-p.forward[i]*shift);
  }
  function axes(forward,up){const right=unit(cross(up,forward));return {right,up:unit(cross(forward,right)),forward};}
  // Shared cinematic bank: lateral turn rate, independent of scene scale.
  // Ring flight bank is capped at +/-20 degrees. Opening samples curvature
  // only to select its following turn, without applying camera roll.
  function bankAngle(before,at,after,right,step){
    const velocity=after.map((v,i)=>(v-before[i])/(2*step)),speed=Math.hypot(...velocity);
    if(speed<1e-7)return 0;
    const lateral=after.reduce((sum,v,i)=>sum+(v-2*at[i]+before[i])*right[i],0)/(step*step*speed);
    return BANK_LIMIT*Math.tanh(lateral*1.2/BANK_LIMIT);
  }
  function bankPose(pose,angle){
    const c=Math.cos(angle),s=Math.sin(angle),r=pose.right,u=pose.up;
    return {...pose,right:r.map((v,i)=>c*v-s*u[i]),up:u.map((v,i)=>c*v+s*r[i])};
  }
  function withoutDrift(pose){
    if(!pose.drift)return pose;
    return {...pose,eye:pose.eye.map((v,i)=>v-pose.right[i]*pose.drift[0]-pose.up[i]*pose.drift[1]),drift:[0,0]};
  }
  function smoothBank(sample,time,right){
    // Symmetric path filter: anticipate and ease out of bends, without a
    // frame-rate-dependent spring or mutable roll history at handoffs.
    const h=.24,points=Array.from({length:7},(_,i)=>sample(time+(i-3)*h));
    return [1,4,6,4,1].reduce((sum,w,i)=>sum+w*bankAngle(points[i],points[i+1],points[i+2],right,h),0)/16;
  }
  function viewPose({frame,radius,width,height,screen,fov=72}){
    const focal=height/(2*Math.tan(fov*Math.PI/360)),orthoScale=focal/Math.max(radius,.001);
    const eye=unit([frame.u.z,frame.pole.z,frame.v.z]).map(v=>v*Math.max(1.08,orthoScale));
    return {...axes(unit(eye.map(v=>-v)),unit([-frame.u.y,-frame.pole.y,-frame.v.y])),eye,
      offset:[(screen.x-width/2)/focal,(height/2-screen.y)/focal],perspective:0,fov,orthoScale};
  }
  // Screen-space direction perpendicular to Saturn's projected pole. Both hit
  // selection and locator motion use it, even when Saturn is panned or tilted.
  function screenAxis(frame){
    let x=-frame.pole.y,y=frame.pole.x;
    if(Math.hypot(x,y)<1e-6){x=frame.u.x;y=frame.u.y;}
    if(x<0||(Math.abs(x)<1e-8&&y>0)){x=-x;y=-y;}
    return unit([x,y]);
  }
  function quaternion(p){
    const r=p.right,u=p.up,f=p.forward,m=[r[0],u[0],f[0],r[1],u[1],f[1],r[2],u[2],f[2]],trace=m[0]+m[4]+m[8];let q;
    if(trace>0){const s=2*Math.sqrt(trace+1);q=[(m[7]-m[5])/s,(m[2]-m[6])/s,(m[3]-m[1])/s,s/4];}
    else{const i=m[0]>m[4]?(m[0]>m[8]?0:2):(m[4]>m[8]?1:2),j=(i+1)%3,k=(i+2)%3,s=2*Math.sqrt(1+m[i*3+i]-m[j*3+j]-m[k*3+k]);
      q=[0,0,0,0];q[i]=s/4;q[j]=(m[i*3+j]+m[j*3+i])/s;q[k]=(m[i*3+k]+m[k*3+i])/s;q[3]=(m[k*3+j]-m[j*3+k])/s;}
    return unit(q);
  }
  function orientation(a,b,t){
    const qa=quaternion(a);let qb=quaternion(b),d=dot(qa,qb);if(d<0){qb=qb.map(v=>-v);d=-d;}
    const angle=Math.acos(clamp(d,-1,1)),q=angle<.001?unit(blend(qa,qb,t)):qa.map((v,i)=>(v*Math.sin((1-t)*angle)+qb[i]*Math.sin(t*angle))/Math.sin(angle));
    const [x,y,z,w]=q;
    return {right:[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w)],up:[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)],forward:[2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)]};
  }
  const polar=eye=>({angle:Math.atan2(eye[2],eye[0]),radius:Math.hypot(...eye),elevation:Math.atan2(eye[1],Math.hypot(eye[0],eye[2]))});
  const polarEye=({angle,radius,elevation})=>{const r=radius*Math.cos(elevation);return [r*Math.cos(angle),radius*Math.sin(elevation),r*Math.sin(angle)];};
  // Preserve starting velocity and ease to rest. Usually 10% faster than the
  // original spiral; when capped at seven seconds, smoothly make up the distance
  // in the middle instead of jumping speed on the cancel frame.
  const initialTangent=u=>u*(1-u)**3*(1+3*u);
  // Real-ring boarding keeps its own ten-second locator catch-up.
  const entryWeight=(age,opening=false)=>{
    const p=clamp(age/SETTINGS.entry,0,1),lead=p+.1*p*(1-p)*(1-p);
    return ease(lead)+(opening?.4*p*(1-p)**3:0);
  };
  const JUMP_ENTRY=Object.freeze({duration:4,angle:Math.PI/4});
  // Shared polar spiral for Saturn boarding and the Sun/Mercury warp ring.
  function spiralPoint(startAngle,turn,omega,age,curve,distance,elevation){
    return polarEye({radius:distance,elevation,angle:startAngle+(turn+age*omega)*curve});
  }
  function warpPath(from,velocity,ring,duration=ring.duration??5){
    const normal=unit(ring.normal),u=unit(ring.u),v=unit(cross(u,normal));
    const relative=from.eye.map((x,i)=>x-ring.center[i]),local=[dot(relative,u),dot(relative,normal),dot(relative,v)],start=polar(local);
    const tangent=unit(u.map((x,i)=>-x*Math.sin(start.angle)+v[i]*Math.cos(start.angle)));
    const direction=dot(Math.hypot(...velocity)>1e-7?velocity:from.forward,tangent)<0?-1:1;
    const omega=direction*Math.min(.08,ring.speed/ring.radius),elevation=(local[1]<0?-1:1)*.025;
    const turn=direction*Math.min(Math.PI/8,Math.max(.03,Math.atan2(Math.abs(start.radius-ring.radius),ring.radius)*.5));
    return {warp:true,locator:'WARP',from,velocity,ring,u,v,normal,start,duration,omega,elevation,
      skySide:ring.side||(local[1]<0?-1:1),turn,speed:ring.speed};
  }
  function warpPosition(path,age){
    if(path.ring.virtual){
      return warpArcPosition(path,age);
    }
    const t=Math.max(0,age),p=clamp(t/path.duration,0,1),weight=entryWeight(p*SETTINGS.entry);
    const distance=Math.exp(mix(Math.log(Math.max(path.start.radius,1e-9)),Math.log(path.ring.radius/Math.cos(path.elevation)),weight));
    const local=spiralPoint(path.start.angle,path.turn,path.omega,t,weight,distance,mix(path.start.elevation,path.elevation,weight));
    const bridge=t<path.duration?path.duration*initialTangent(p):0;
    // Ease out of the orbital plane into empty space. The camera can now
    // look along real velocity instead of faking an outward/upward gaze.
    const ramp=path.duration*.5,q=clamp((t-ramp)/ramp,0,1);
    const liftSpeed=Math.max(Math.abs(path.omega)*path.ring.radius*1.8,path.ring.radius/path.duration*.5);
    const lift=path.skySide*liftSpeed*(ramp*(q**6-3*q**5+2.5*q**4)+Math.max(0,t-path.duration));
    return path.ring.center.map((x,i)=>x+path.u[i]*local[0]+path.normal[i]*(local[1]+lift)+path.v[i]*local[2]+path.velocity[i]*bridge);
  }
  function planWarp(from,velocity,obstacles=[],duration=5,randomChoice=()=>.5){
    const speed=Math.hypot(...velocity),forward=unit(speed>1e-7?velocity:from.forward);
    // Freeze the banked camera's pitch plane at T, rather than levelling the
    // locator to the solar plane. Project onto the inherited travel tangent.
    let up=from.up.map((x,i)=>x-forward[i]*dot(from.up,forward));
    if(Math.hypot(...up)<.01)up=cross(forward,from.right);
    if(Math.hypot(...up)<1e-6){const axis=Math.abs(forward[0])<.8?[1,0,0]:[0,1,0];up=axis.map((x,i)=>x-forward[i]*dot(axis,forward));}
    up=unit(up);
    const levelRight=unit(cross([0,0,1],from.forward));
    const tilt=dot(from.up,levelRight),bankIntent=Math.abs(from.bankRate||0)>1e-4?from.bankRate:tilt;
    let scale=Math.max(Math.hypot(...from.eye)*.2,1),nearest=Infinity;
    for(const body of obstacles){const gap=Math.hypot(...from.eye.map((x,i)=>x-body.center[i]))-body.radius;
      if(gap<nearest){nearest=gap;scale=Math.max(body.radius*4,Math.max(0,gap)*.3);}
    }
    scale=Math.max(scale,speed*duration,1e-6);
    const accelerationDuration=mix(7.5,5,clamp(speed*duration/scale,0,1));
    const clear=path=>{
      let before=from.eye;
      for(let t=.05;t<=20.0001;t+=.05){
        const after=warpPosition(path,t),segment=after.map((x,i)=>x-before[i]),length2=dot(segment,segment);
        for(const body of obstacles){
          const startDistance=Math.hypot(...from.eye.map((x,i)=>x-body.center[i]));
          const radius=Math.min(body.radius*1.18,startDistance*.99);
          const q=clamp(dot(body.center.map((x,i)=>x-before[i]),segment)/Math.max(length2,1e-20),0,1);
          if(Math.hypot(...before.map((x,i)=>x+segment[i]*q-body.center[i]))<radius)return false;
        }
        before=after;
      }
      return true;
    };

    // Eight screen directions share the same swept-path safety test. Randomness
    // is sampled once per command; replay never changes the chosen direction.
    const right=unit(cross(up,forward)),jitter=Array.from({length:8},()=>clamp(randomChoice(),0,1)*.8);
    for(const angle of [Math.PI/2,Math.PI]){
      const candidates=[];
      for(const reach of [1,2,4])for(let direction=0;direction<8;direction++){
        const heading=(direction%4)*Math.PI/4,side=direction<4?1:-1;
        const planeUp=up.map((v,i)=>v*Math.cos(heading)+right[i]*Math.sin(heading)),normal=unit(cross(planeUp,forward));
        const steering=planeUp.map(v=>v*side),radius=Math.max(scale*reach,speed*duration*1.25/angle),center=from.eye.map((x,i)=>x+steering[i]*radius);
        const ring={virtual:true,orbit:'virtual',retreat:from.retreat,center,normal,u:forward,entryForward:forward,entryUp:planeUp,viewUp:up,direction,turnAngle:angle,side,bankSide:Math.abs(bankIntent)>1e-4?Math.sign(bankIntent):side,radius,speed:speed||radius*.08,duration,accelerationDuration};
        if(!from.retreat&&obstacles.some(b=>{const d=b.center.map((x,i)=>x-center[i]),height=dot(d,normal),radial=Math.sqrt(Math.max(0,dot(d,d)-height*height));return Math.hypot(radial-radius,height)<b.radius*1.18;}))continue;
        const path=warpPath(from,velocity,ring,duration),pose=warpArcPose(path,duration);
        let exposure=0,crowding=0;
        for(const body of obstacles){
          const d=body.center.map((x,i)=>x-from.eye[i]),distance=Math.hypot(...d),apparent=body.radius/Math.max(distance,1e-9);
          if(dot(d,from.forward)>0&&apparent>.0001){
            const lateral=d.map((v,i)=>v-forward[i]*dot(d,forward)),length=Math.hypot(...lateral);
            const alignment=length>1e-9?dot(lateral,steering)/length:0;
            crowding+=(.2+Math.min(1,apparent*20))*((1+clamp(alignment,-1,1))/2)**4;
          }
          const target=body.center.map((x,i)=>x-pose.eye[i]),gap=Math.hypot(...target);
          if(gap>0&&body.radius/gap>.0001&&dot(unit(target),pose.forward)>Math.cos(Math.PI/3)-body.radius/gap)exposure++;
        }
        const early=warpArcMotion(path,duration*.35).angle,earlyForward=forward.map((x,i)=>x*Math.cos(early)+planeUp[i]*Math.sin(early));
        const score=exposure*8+crowding*4+6*(1-dot(from.forward,earlyForward))+Math.log(reach)+jitter[direction];
        candidates.push({ring,path,score});
      }
      candidates.sort((a,b)=>a.score-b.score);
      for(const candidate of candidates)if(clear(candidate.path))return candidate.ring;
    }
    return null;
  }
  function warpArcMotion(path,age){
    const t=Math.max(0,age),d=path.duration,u=clamp(t/d,0,1),s0=Math.hypot(...path.velocity),s1=2*path.ring.radius*path.ring.turnAngle/d-s0;
    const tail=Math.max(0,t-d),drift=.025*(tail-1.2*(1-Math.exp(-tail/1.2)));
    const acceleration=clamp(t/(path.ring.accelerationDuration||d),0,1);
    return {angle:path.ring.side*(path.ring.turnAngle*ease(u)+drift),speed:mix(s0,s1,ease(acceleration))};
  }
  function warpArcPosition(path,age){
    const count=120,step=path.duration/count,ring=path.ring;
    const velocity=t=>{const {angle,speed}=warpArcMotion(path,t);return ring.entryForward.map((x,i)=>speed*(x*Math.cos(angle)+ring.entryUp[i]*Math.sin(angle)));};
    // Cache the velocity integral. The broad bend eases into a subtle ongoing
    // curve so the shared sky keeps moving throughout warp, without a snap.
    const t=Math.max(0,age),index=Math.floor(t/step);
    const points=path.arcSamples||(path.arcSamples=[{eye:[...path.from.eye],velocity:velocity(0)}]);
    while(points.length<=index+1){
      const i=points.length,a=points[i-1],mid=velocity((i-.5)*step),v=velocity(i*step);
      points.push({eye:a.eye.map((x,j)=>x+step*(a.velocity[j]+4*mid[j]+v[j])/6),velocity:v});
    }
    const u=(t-index*step)/step,a=points[index],b=points[index+1];
    const retreat=ease(clamp(t/1.8,0,1));
    return a.eye.map((x,i)=>(2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*step*a.velocity[i]+(-2*u**3+3*u*u)*b.eye[i]+(u**3-u*u)*step*b.velocity[i]+(ring.retreat?.[i]||0)*retreat);
  }
  function warpArcPose(path,age){
    const t=Math.max(0,age),{angle}=warpArcMotion(path,t),f=path.ring.entryForward,u=path.ring.entryUp;
    const base=axes(f,path.ring.viewUp||u),source=path.previous||path.from,previous=axes(source.forward,source.up),start=axes(path.from.forward,path.from.up),carry=t*Math.exp(-t/.6);
    const headingAngle=Math.acos(clamp(dot(start.forward,base.forward),-1,1)),alignDuration=Math.max(2.5,headingAngle/(Math.PI/6));
    const frame=orientation(orientation(previous,start,1+carry/.001),base,transition(t,0,alignDuration));
    // One transported pitch axis stays continuous even through the vertical.
    const axis=unit(cross(u,f)),c=Math.cos(angle),s=Math.sin(angle);
    const rotate=v=>{const k=cross(axis,v),a=dot(axis,v);return v.map((x,i)=>x*c-k[i]*s+axis[i]*a*(1-c));};
    const pose={...frame,right:rotate(frame.right),up:rotate(frame.up),forward:rotate(frame.forward),eye:warpPosition(path,t),look:1};
    const bank=(path.ring.bankSide??path.ring.side)*30*Math.PI/180*smooth(t/(path.duration*2));
    return bankPose(pose,bank);
  }
  function warpPose(path,age){
    if(path.ring.virtual)return warpArcPose(path,age);
    const t=Math.max(0,age),step=1/120,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
    const angles=f=>[Math.atan2(dot(f,path.v),dot(f,path.u)),Math.asin(clamp(dot(f,path.normal),-1,1))];
    const level=(yaw,pitch)=>axes(path.u.map((x,i)=>(x*Math.cos(yaw)+path.v[i]*Math.sin(yaw))*Math.cos(pitch)+path.normal[i]*Math.sin(pitch)),path.normal);
    if(!path.views){
      const a=angles(path.from.forward),prior=angles((path.previous||path.from).forward),base=level(...a);
      path.roll=Math.atan2(dot(path.from.up,base.right),dot(path.from.up,base.up));
      path.views=[{a,w:a.map((x,i)=>wrap(x-prior[i])/.001)}];
    }
    // One deterministic heading follower owns the entire warp. A captured
    // camera-up vector becomes singular when flight turns through it; use the
    // solar horizon instead, with bounded turn speed and the shared bank cap.
    const index=Math.floor(t/step);
    while(path.views.length<=index+1){
      const time=(path.views.length-1)*step,last=path.views[path.views.length-1];
      const ahead=warpPosition(path,time+step+.001),before=warpPosition(path,time+step);
      const velocity=ahead.map((x,i)=>x-before[i]),target=Math.hypot(...velocity)>1e-10?angles(unit(velocity)):last.a;
      const w=last.w.map((v,i)=>clamp(v+clamp(36*(i===0?wrap(target[i]-last.a[i]):target[i]-last.a[i])-12*v,-4,4)*step,-1.2,1.2));
      path.views.push({a:last.a.map((x,i)=>x+(last.w[i]+w[i])*step*.5),w});
    }
    const a=path.views[index],b=path.views[index+1],u=(t-index*step)/step;
    const view=a.a.map((x,i)=>(2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*step*a.w[i]+(-2*u**3+3*u*u)*b.a[i]+(u**3-u*u)*step*b.w[i]);
    const fade=transition(t,0,2.5),roll=mix(path.roll,clamp(path.roll,-BANK_LIMIT,BANK_LIMIT),fade)*(1-fade);
    const frame=t===0?path.from:bankPose(level(view[0],clamp(view[1],-Math.PI/2+.001,Math.PI/2-.001)),roll);
    return {...frame,eye:warpPosition(path,t),look:1};
  }
  function jumpPath(from,velocity,turn,reach,solarUp=[0,1,0],locator=null){
    // One gentle spiral approach, then steady flight. Screen roll must not
    // redefine the solar-system's up/down directions.
    const up=unit(solarUp),forward=unit(from.forward),radial=unit(from.eye);
    let right=cross(forward,up);
    if(Math.hypot(...right)<1e-5)right=cross(up,Math.abs(up[0])<.8?[1,0,0]:[0,0,1]);
    right=unit(right);
    const vertical=unit(cross(right,forward));let side=vertical.map(v=>v*(turn%2?-1:1)),angle=JUMP_ENTRY.angle;
    if(locator){angle=Math.acos(clamp(dot(forward,locator.direction),-1,1));const tangent=locator.direction.map((v,i)=>v-forward[i]*Math.cos(angle));if(Math.hypot(...tangent)>1e-6)side=unit(tangent);}
    const goal=forward.map((v,i)=>v*Math.cos(angle)+side[i]*Math.sin(angle));
    // Translation skirts the body even when T is pressed while looking back
    // at it. View rotation stays small; particles carry the perceived speed.
    const safe=v=>{const heading=v.map((x,i)=>x+side[i]*.5);return unit(heading.map((x,i)=>x-radial[i]*Math.min(0,dot(heading,radial))+radial[i]*.35));};
    return {from,velocity,forward,side,normal:unit(cross(forward,side)),turn:turn%2?-1:1,reach,angle,duration:JUMP_ENTRY.duration,locator:locator?.id,startDirection:safe(forward),endDirection:safe(goal),speed:reach/JUMP_ENTRY.duration};
  }
  function jumpPosition(path,age){
    const t=Math.max(0,age),d=path.duration,u=clamp(t/d,0,1);
    // Analytic integral of a smoothly accelerating, gently turning velocity.
    // Both velocity and acceleration match the cruise segment at four seconds.
    const travel=u**3-.5*u**4,bend=5*u**6-65/7*u**7+6*u**8-4/3*u**9;
    const weight=entryWeight(u*SETTINGS.entry),radius=path.reach*.1,phase=path.turn*Math.PI*.5*weight;
    // Contract toward a moving centre instead of swinging out and back to
    // the original line. The final tangent still matches the cruise exactly.
    return path.from.eye.map((v,i)=>v+path.speed*(d*(path.startDirection[i]*travel+(path.endDirection[i]-path.startDirection[i])*bend)+Math.max(0,t-d)*path.endDirection[i])+radius*(path.side[i]*(1-(1-weight)*Math.cos(phase))+path.normal[i]*(1-weight)*Math.sin(phase)));
  }
  function jumpPose(path,age){
    if(path.warp)return warpPose(path,age);
    const t=Math.max(0,age),eye=jumpPosition(path,t),angle=path.angle*transition(t,0,path.duration);
    const bridge=t<2.5?2.5*initialTangent(t/2.5):0;
    const u=clamp(t/path.duration,0,1),weight=entryWeight(u*SETTINGS.entry),swirl=.1*(1-weight)*Math.sin(path.turn*Math.PI*.5*weight);
    return {eye:eye.map((v,i)=>v+path.velocity[i]*bridge),forward:unit(path.forward.map((v,i)=>v*Math.cos(angle)+path.side[i]*Math.sin(angle)+path.normal[i]*swirl)),look:transition(t,0,1)};
  }
  function jumpTargets(from,locators,solarUp){
    return locators.map(p=>({...p,cost:Math.acos(clamp(dot(unit(from.forward),unit(p.direction)),-1,1))}))
      .sort((a,b)=>a.cost-b.cost).slice(0,3);
  }
  const returnTravel=(u,slope)=>ease(u)+slope*initialTangent(u);
  const returnVelocity=(u,slope)=>(1-u)**2*(slope+2*slope*u+(30-15*slope)*u*u);
  function controlledPose(pose,{yaw=0,pitch=0,pan=[0,0]}){
    let {eye,forward,right,up}=pose;
    forward=unit(forward.map((v,i)=>v*Math.cos(yaw)+right[i]*Math.sin(yaw)));
    right=unit(cross(up,forward));forward=unit(forward.map((v,i)=>v*Math.cos(pitch)+up[i]*Math.sin(pitch)));up=unit(cross(forward,right));
    eye=eye.map((v,i)=>v+right[i]*pan[0]);eye[1]+=pan[1];
    return {...pose,eye,forward,right,up,basis:new Float32Array([...right,...up,...forward])};
  }
  const turnFrame=(frame,angle)=>{const c=Math.cos(angle),s=Math.sin(angle),out={};for(const key of ['right','up','forward']){const [x,y,z]=frame[key];out[key]=[c*x-s*z,y,s*x+c*z];}return out;};
  function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  const angularDebris=seed=>(seed*8)%1<.7;
  function chipGeometry(){
    // One shared six-triangle silhouette, not thousands of individual meshes.
    const vertices=[],radii=[1,.72,.95,.66,.9,.76];
    for(let i=0;i<6;i++){const j=(i+1)%6;vertices.push(0,0,Math.cos(i*TAU/6)*radii[i],Math.sin(i*TAU/6)*radii[i],Math.cos(j*TAU/6)*radii[j],Math.sin(j*TAU/6)*radii[j]);}
    return new Float32Array(vertices);
  }
  function rockGeometry(angular=false,coarse=false){
    // Closed pentagonal bipyramid: 10 triangles at low detail. Split only
    // shared equatorial edges for angular 20, or all edges for rounded 40.
    const vertices=[],points=[[0,1,0],[0,-1,0]],faces=[];
    for(let i=0;i<5;i++)points.push([Math.cos(i*TAU/5),0,Math.sin(i*TAU/5)]);
    for(let i=0;i<5;i++){const a=2+i,b=2+(i+1)%5;faces.push([0,b,a],[1,a,b]);}
    const shape=p=>{const scale=1+(angular?.18:.07)*Math.sin(p[0]*11+p[1]*7+p[2]*13);return p.map((v,i)=>v*scale*(angular?[1.4,.6,.85][i]:1));};
    function triangle(a,b,c){
      const pa=shape(a),pb=shape(b),pc=shape(c),n=unit(cross(pb.map((v,i)=>v-pa[i]),pc.map((v,i)=>v-pa[i])));
      for(const [p,normal] of [[pa,a],[pb,b],[pc,c]])vertices.push(...p,...(angular?n:unit(blend(n,normal,.28))));
    }
    for(const face of faces){const [a,b,c]=face.map(i=>points[i]);if(coarse){triangle(a,b,c);continue;}
      if(angular){const bc=unit(blend(b,c,.5));triangle(a,b,bc);triangle(a,bc,c);continue;}
      const ab=unit(blend(a,b,.5)),bc=unit(blend(b,c,.5)),ca=unit(blend(c,a,.5));
      triangle(a,ab,ca);triangle(b,bc,ab);triangle(c,ca,bc);triangle(ab,bc,ca);}
    return new Float32Array(vertices);
  }
  const VERTEX=`attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
  const RAY=`
    ${root.SolarSurfaceStyle.ringShadowGLSL}
    float ringDetail(float distance){return 1.-smoothstep(1.2,2.8,distance);}
    float ringTransition(vec3 point,float ready){
      // This LOCAL handoff must never erase the distant ring, even at grazing
      // angles. All heights sample the same point on the ring plane.
      // A flattened distance field opens a small patch below the camera,
      // then expands it. No global altitude multiplier fades the entire patch
      // at once. The same field reveals the fixed debris underneath.
      vec3 delta=vec3(point.x,0.,point.z)-detailEye;delta.y*=5.;
      float distance=length(delta);
      return ringDetail(distance)*ready;
    }
    // Pixel/ring overlap: two overlapping edge fades erased the entire thin
    // distant band when one pixel's footprint exceeded the width of the ring.
    float ringCoverage(float radius,float footprint){
      float span=max(footprint,.0001);
      return clamp((min(2.26,radius+span*.5)-max(1.28,radius-span*.5))/span,0.,1.);
    }
    float sphere(vec3 ro,vec3 rd){float b=dot(ro,rd),miss=length(cross(ro,rd)),h=1.-miss*miss;if(h<0.)return -1.;float t=-b-sqrt(h);return t>.001?t:-1.;}
    float ring(vec3 ro,vec3 rd){if(abs(rd.y)<.00001)return -1.;float t=-ro.y/rd.y;vec3 p=ro+rd*t;float r=length(p.xz);return t>.001&&r>1.28&&r<2.26?t:-1.;}
  `;
  const FRAGMENT=`precision highp float;varying vec2 uv;
    uniform vec3 eye,viewEye,detailEye,light;uniform mat3 basis;uniform vec2 lens,offset;uniform sampler2D planetMap,ringMap;uniform float phase,debrisReady,perspective,orthoScale,ringTexel,focal;
    ${RAY}
    ${root.SolarSurfaceStyle?.ringSamplingGLSL||''}
    void main(){
      vec2 q=(uv*2.-1.)*lens-offset;vec3 ro=eye+basis*vec3(q*(1.-perspective)*orthoScale,0.);
      vec3 rayVector=basis*vec3(q*perspective,1.);float rayLength=length(rayVector);vec3 ray=rayVector/rayLength;
      // Parallel projection has no finite near eye. Do not slice the foreground
      // ring at the moving ray-origin plane. During the perspective blend,
      // never retreat BEHIND the effective eye: that projects the ring behind
      // the camera onto the opposite sky edge (above/below the landing plane).
      float retreat=(1.-perspective)*min(4.,orthoScale*rayLength/max(perspective,.00001));
      ro-=ray*retreat;
      float ts=sphere(ro,ray),tr=ring(ro,ray);vec3 color=vec3(0.);float alpha=0.;
      if(ts>0.){vec3 n=normalize(ro+ray*ts);vec2 st=vec2(fract(atan(n.z,n.x)/6.2831853+.5-phase),acos(clamp(n.y,-1.,1.))/3.14159265);
        float day=max(0.,dot(n,light));color=texture2D(planetMap,st).rgb*(.115+.98*day);
        color+=vec3(.18,.26,.33)*pow(1.-max(0.,dot(n,-ray)),5.)*day*.16;alpha=1.;}
      if(tr>0.&&(ts<0.||tr<ts)){
        vec3 p=ro+ray*tr;float r=length(p.xz),f=(r-1.28)/.98;
        vec3 radial=vec3(p.x,0.,p.z)/r;vec2 screenRadial=vec2(dot(radial,basis[0]),dot(radial,basis[1]));
        float radius=focal/max(.01,mix(orthoScale,dot(p-eye,basis[2]),perspective));
        float aa=max(1./(radius*.98),1.15/(max(radius*length(screenRadial),1.)*.98));
        // Ray/plane footprint, not an orthographic projected radius: at grazing
        // angles one pixel spans many radial bands. Filter that complete span.
        float planeScale=mix(orthoScale,dot(p-eye,basis[2]),perspective);
        vec3 dx=planeScale*(basis[0]-ray*basis[0].y/ray.y);
        vec3 dy=planeScale*(basis[1]-ray*basis[1].y/ray.y);
        float footprint=(abs(dot(radial,dx))+abs(dot(radial,dy)))/max(focal*.98,1.);
        aa=mix(aa,max(ringTexel,footprint),perspective);
        vec4 band=ringFiltered(f,aa);
        float edge=max(1./radius,aa*.98);
        float orthoCoverage=smoothstep(1.28,1.28+edge,r)*(1.-smoothstep(2.26-edge,2.26,r));
        float a=band.a*mix(orthoCoverage,ringCoverage(r,aa*.98),perspective);
        // Keep the original ring until the blended projection's effective eye
        // is close enough to see debris, not just the not-yet-boarded locator.
        a*=1.-ringTransition(p,debrisReady);
        // Soft penumbra instead of a binary ray hit, which looked like a cut.
        float shadow=ringShadow(p,light);
        color=band.rgb*shadow*a+color*alpha*(1.-a);alpha=a+alpha*(1.-a);color/=max(alpha,.00001);
      }
      gl_FragColor=vec4(color,alpha);
    }`;
  // Both debris representations share starting angles and signed 0–90°/s spin.
  // Only one elapsed-time uniform changes each frame; instance data stays immutable.
  const DEBRIS_ROTATION=`
    // Representation belongs to the instance, not its screen size. Large
    // rocks are always meshes; small grains always sprites. No silhouette or
    // opacity switch as an approaching rock crosses a pixel-size threshold.
    float debrisFade(float depth,float distance){return smoothstep(.001,.012,depth)*smoothstep(.025,.12,distance);}
    float debrisAngle(float seed,float elapsed){
      float initial=fract(seed*353.17)*6.2831853;
      float speed=(fract(seed*7919.37)*2.-1.)*1.5707963;
      return initial+elapsed*speed;
    }
  `;
  // Both representations share a dry, desaturated mineral response. Compress
  // baked ice highlights and lift deep texture shadows slightly; preserve alpha.
  const DEBRIS_COLOR=`vec3 debrisColor(vec3 color){
    float luma=dot(color,vec3(.2126,.7152,.0722));
    vec3 dry=mix(color,vec3(luma),.35)*.88+vec3(.035);
    return mix(dry,vec3(.99,.96,.88)*(.035+.88*luma),.55*smoothstep(.45,.90,luma));
  }`;
  // Stable per-instance palette, evaluated at vertices rather than per pixel.
  // Preserve texture contrast: no extra texture, lights, or transparent pass.
  const DEBRIS_TINT=`vec3 debrisTint(float seed){
    float warm=1.-step(.7,fract(seed*127.1));
    vec3 ochre=mix(vec3(1.02,1.,.94),vec3(1.06,.99,.85),fract(seed*263.7));
    return mix(vec3(1.),ochre,warm);
  }`;
  // Shared quad and pooled instance upload; no mesh or draw call per rock.
  const PARTICLE_BUDGET=`uniform float particleBudget,budgetRange;
    float budgetFade(vec3 delta,float seed){
      if(particleBudget>=1.)return 1.;
      float rank=.85*clamp(dot(delta,delta)/(budgetRange*budgetRange),0.,1.)+.15*fract(seed*97.31);
      return 1.-smoothstep(particleBudget,particleBudget+.12,rank);
    }`;
  const DEBRIS_VERTEX=`precision highp float;attribute vec2 a;attribute vec3 position;attribute vec2 detail;
    uniform vec3 eye,viewEye;uniform mat3 basis;uniform vec2 lens,offset;uniform float perspective,orthoScale,fogPass,chipPass,elapsed;
    varying vec3 world,tint;varying vec2 spriteUV;varying float seed,fade,ringRadius;
    ${DEBRIS_ROTATION}
    ${DEBRIS_TINT}
    ${PARTICLE_BUDGET}
    void main(){vec3 d=position-eye;vec3 v=vec3(dot(d,basis[0]),dot(d,basis[1]),dot(d,basis[2]));world=position;seed=detail.y;ringRadius=length(position.xz);
      tint=debrisTint(seed);float depth=mix(orthoScale,v.z,perspective);
      // Distant rocks share the disk's crossfade in the fragment shader. Keep
      // only fog's separate short range; an old rock cutoff left an empty gap.
      // Hold fog until it reaches the lens, then fade before the near clip.
      fade=mix(debrisFade(depth,length(position-viewEye)),smoothstep(.001,.018,depth)*(1.-smoothstep(.9,1.8,length(d))),fogPass)*budgetFade(d,seed);
      float angle=mix(debrisAngle(seed,elapsed),seed*53.,fogPass),c=cos(angle),s=sin(angle);vec2 corner=mat2(c,-s,s,c)*a*detail.x;
      corner*=mix(vec2(1.),vec2(.7+.3*fract(seed*117.3),.55+.45*fract(seed*251.7)),chipPass);
      world=position+basis[0]*corner.x+basis[1]*corner.y;
      spriteUV=(a*.5+.5)*.992+.004;
      gl_Position=depth>.001?vec4((v.xy+corner+offset*depth)/lens,depth*(1.-2./(1.+depth)),depth):vec4(2.,2.,2.,1.);
    }`;
  const DEBRIS_FRAGMENT=`precision highp float;uniform vec3 eye,viewEye,detailEye,light;uniform sampler2D ringMap,atlas;uniform float debrisReady,fogPass,chipPass;uniform vec2 atlasGrid;
    varying vec3 world,tint;varying vec2 spriteUV;varying float seed,fade,ringRadius;
    ${RAY}
    ${DEBRIS_COLOR}
    void main(){
      float cell=floor(seed*atlasGrid.x*atlasGrid.y);vec2 st=(vec2(mod(cell,atlasGrid.x),floor(cell/atlasGrid.x))+vec2(spriteUV.x,1.-spriteUV.y))/atlasGrid;
      vec4 rock;
      if(fogPass>.5||chipPass>.5){
        // Three soft lobes, no texture fetch or fractal-noise loop. Each seeded
        // billboard has an irregular dry-ochre silhouette and feathered edges.
        vec2 q=spriteUV*2.-1.,a=q*vec2(1.1,.85),b=(q-vec2(.25,-.18))*vec2(1.6,1.3),c=(q+vec2(.3,.16))*vec2(1.4,1.8);
        float blotch=.55*(1.-smoothstep(.03,1.,dot(a,a)))+.3*(1.-smoothstep(.02,.7,dot(b,b)))+.25*(1.-smoothstep(.02,.8,dot(c,c)));
        float edge=1.-smoothstep(.65,1.,max(abs(q.x),abs(q.y)));
        rock=vec4(mix(vec3(.52,.47,.39),vec3(.72,.65,.53),blotch),blotch*edge);
        // A solid, dry chip: geometry supplies its edge; low-frequency mottling
        // varies per instance without a texture, shimmer or noise octaves.
        if(chipPass>.5){float stain=clamp(blotch+.16*sin(q.x*4.+q.y*3.+seed*31.),0.,1.);
          rock=vec4(mix(vec3(.49,.41,.29),vec3(.81,.72,.55),stain),1.);}
      }else rock=texture2D(atlas,st);
      if(rock.a*fade<mix(.02,.001,fogPass))discard;
      if(fogPass<.5&&rock.a<.35)discard;
      vec3 delta=world-viewEye,ray=normalize(delta);float distance=length(world-eye),rayDistance=length(delta),s=sphere(viewEye,ray);if(s>0.&&s<rayDistance)discard;
      // Choose density for the WHOLE instance. Sampling at each sprite pixel
      // sliced rocks and fog along the radial ring bands like a cookie cutter.
      vec4 band=texture2D(ringMap,vec2(clamp((ringRadius-1.28)/.98,0.,1.),.5));
      if(fogPass<.5&&fract(seed*19.7)>band.a)discard;float tr=ring(viewEye,ray),occlusion=1.;
      if(tr>0.&&tr<rayDistance){vec3 p=viewEye+ray*tr;occlusion=1.-texture2D(ringMap,vec2((length(p.xz)-1.28)/.98,.5)).a*(1.-ringTransition(p,debrisReady));}
      // Dust's former .13 opacity is reduced by 30%, independently of rocks.
      float alpha=rock.a*fade*occlusion*ringTransition(world,debrisReady)*mix(1.,.091*band.a,fogPass);
      // Fully faded pixels must never occlude another solid instance.
      if(alpha<.002)discard;
      gl_FragColor=vec4(mix(debrisColor(rock.rgb),rock.rgb,fogPass)*tint*mix(.72,.6,fogPass)*ringShadow(world,light),alpha);
    }`;
  const ROCK_VERTEX=`precision highp float;attribute vec3 corner,normal,position;attribute vec2 detail;
    uniform vec3 eye,viewEye;uniform mat3 basis;uniform vec2 lens,offset;uniform float perspective,orthoScale,elapsed;
    varying vec3 world,face,tint;varying vec2 rockUV;varying float seed,fade,ringRadius;
    ${DEBRIS_ROTATION}
    ${DEBRIS_TINT}
    ${PARTICLE_BUDGET}
    void main(){
      seed=detail.y;ringRadius=length(position.xz);float angle=debrisAngle(seed,elapsed),c=cos(angle),s=sin(angle),tilt=seed*17.,ct=cos(tilt),st=sin(tilt);
      tint=debrisTint(seed);
      mat3 turn=mat3(c,0.,-s,0.,1.,0.,s,0.,c)*mat3(1.,0.,0.,0.,ct,st,0.,-st,ct);
      vec3 scale=vec3(.7+fract(seed*7.)*.8,.5+fract(seed*11.)*.7,.7+fract(seed*13.)*.8);
      world=position+turn*(corner*scale)*detail.x*1.4;face=normalize(turn*(normal/scale));rockUV=corner.xz*.25+.5;
      vec3 d=world-eye,v=vec3(dot(d,basis[0]),dot(d,basis[1]),dot(d,basis[2]));float depth=mix(orthoScale,v.z,perspective);
      float centerDepth=mix(orthoScale,dot(position-eye,basis[2]),perspective);
      fade=debrisFade(centerDepth,length(position-viewEye))*budgetFade(position-eye,seed);
      gl_Position=vec4((v.xy+offset*depth)/lens,depth*(1.-2./(1.+max(depth,0.))),depth);
    }`;
  const ROCK_FRAGMENT=`precision highp float;uniform vec3 eye,viewEye,detailEye,light;uniform sampler2D ringMap,atlas;uniform float debrisReady;
    varying vec3 world,face,tint;varying vec2 rockUV;varying float seed,fade,ringRadius;
    ${RAY}
    ${DEBRIS_COLOR}
    void main(){
      if(fade*debrisReady<.002)discard;vec3 d=world-viewEye;float distance=length(d),hit=sphere(viewEye,d/distance);if(hit>0.&&hit<distance-.001)discard;
      float density=texture2D(ringMap,vec2(clamp((ringRadius-1.28)/.98,0.,1.),.5)).a;if(fract(seed*19.7)>density)discard;
      float slot=floor(seed*8.);vec4 texel=texture2D(atlas,(vec2(mod(slot,4.),floor(slot/4.))+rockUV)/vec2(4.,2.));
      vec3 albedo=debrisColor(mix(vec3(.39,.38,.35),texel.rgb,smoothstep(.1,.65,texel.a)));
      float alpha=fade*ringTransition(world,debrisReady);if(alpha<.002)discard;
      gl_FragColor=vec4(albedo*tint*(.28+.8*max(0.,dot(normalize(face),light)))*ringShadow(world,light),alpha);
    }`;
  function program(gl,vertex,fragment,names){
    const shaders=[];let p;
    try{
      for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
      }
      p=gl.createProgram();shaders.forEach(s=>gl.attachShader(p,s));gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      const attributes={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i++){const {name}=gl.getActiveAttrib(p,i);attributes[name]=gl.getAttribLocation(p,name);}
      return {program:p,u:Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)])),attributes};
    }catch(error){if(p)gl.deleteProgram(p);throw error;}finally{shaders.forEach(s=>gl.deleteShader(s));}
  }
  class RingTour{
    constructor({frame,radius,width,height,screen,target,light=[-.55,-.75,.65],seed=(Math.random()*4294967296)>>>0,phase=0,grainStyle,openingVelocity,prepared,deferPreparation=false,particleCapacity=1}){
      this.particleCapacity=clamp(particleCapacity,.25,1);this.particleBudget=1;
      this.openingResume=!!openingVelocity;
      const rand=random(seed);this.seed=seed;this.phase=phase;this.state='entering';this.age=0;this.lastMono=null;this.speed=1;
      this.radius=SETTINGS.pathRadius-(SETTINGS.pathRadius-1.28)*random(seed^0x6a09e667)()*.2;this.height=.025+rand()*.023;this.direction=rand()<.5?-1:1;this.period=(115+rand()*55)/6;
      this.fov=72;this.yaw=0;this.pitch=0;this.pan=[0,0];this.resources=null;this.disposed=false;
      this.startPose=viewPose({frame,radius,width,height,screen,fov:this.fov});this.orthoScale=this.startPose.orthoScale;
      this.startEye=this.startPose.eye;
      this.startAngle=Math.atan2(this.startEye[2],this.startEye[0]);this.entryAngle=this.startAngle+(rand()-.5)*.65;
      if(target?.point?.length===3&&target.point.every(Number.isFinite)){
        this.entryAngle=Math.atan2(target.point[2],target.point[0]);
      }
      // Below the ring is not upside down: retain the starting screen's up.
      this.upSign=this.startPose.up[1]<0?-1:1;
      // Approach hemisphere and screen roll are independent: descending from
      // above / ascending from below must not turn the camera upside down.
      this.landingSide=this.startEye[1]<0?-1:1;this.height*=this.landingSide;
      if(target?.side){
        const axis=screenAxis(frame),along=v=>v.x*axis[0]+v.y*axis[1];
        const tangentAt=a=>-Math.sin(a)*along(frame.u)+Math.cos(a)*along(frame.v);
        // The camera-facing tangent defines left/right for the entire route.
        // Using the clicked tangent reversed the approach on the ring's far half.
        this.direction=(Math.sign(tangentAt(this.startAngle))||1)*Math.sign(target.side);
      }
      this.angle=this.entryAngle;
      this.startOffset=this.startPose.offset;
      this.startDistance=Math.hypot(...this.startEye);this.landingDistance=Math.hypot(this.radius,this.height);
      this.returnDuration=mix(SETTINGS.return,SETTINGS.returnFar,smooth((this.startDistance-4)/24));
      this.startElevation=Math.atan2(this.startEye[1],Math.hypot(this.startEye[0],this.startEye[2]));
      this.landingElevation=Math.atan2(this.height,this.radius);
      const configure=direction=>{
        this.direction=direction;this.locatorStart=this.locatorPose(0);this.approachHeading=this.locatorPose(0,this.startAngle);
        this.entryTurn=direction*((direction*(this.entryAngle-this.startAngle)%TAU+TAU)%TAU);
      };
      configure(this.direction);
      if(openingVelocity&&target?.turnSign){
        // Select the opposite screen-space bend for the second half of the S.
        // Compare paths before allocating pools; never create a second tour.
        let chosen=this.direction,best=-Infinity;
        for(const direction of [-1,1]){
          configure(direction);
          const score=target.turnSign*smoothBank(age=>this.entryPosition(age),1,this.startPose.right);
          if(score>best){best=score;chosen=direction;}
        }
        configure(chosen);
      }
      if(openingVelocity){
        // Match the incoming view velocity, then smoothly release into the
        // existing spiral without adding another camera-path owner.
        const a=this.rawEntryPose(0),b=this.rawEntryPose(.001),delta={};
        for(const key of ['eye','offset','right','up','forward'])delta[key]=a[key].map((v,i)=>(openingVelocity[key]?.[i]||0)-(b[key][i]-v)/.001);
        delta.orthoScale=(openingVelocity.orthoScale||0)-(b.orthoScale-a.orthoScale)/.001;
        delta.perspective=-(b.perspective-a.perspective)/.001;
        this.openingMomentum=delta;
      }
      // Double-click tracking fills one quarter of the short screen edge.
      // Match that departure's 2.5-second proximity; a distant overview must
      // reach the same neighbourhood before its original ring starts fading.
      const closeDistance=height/(2*Math.tan(this.fov*Math.PI/360))/(Math.min(width,height)*.25);
      const detailDistance=this.entryMotion(SETTINGS.detailStart,closeDistance).distance;
      let low=SETTINGS.detailStart,high=SETTINGS.entry;
      for(let i=0;i<24;i++){const middle=(low+high)/2;if(this.entryMotion(middle).distance>detailDistance)low=middle;else high=middle;}
      this.detailStart=high;
      // Monotonic radial approach stays outside Saturn without an outward detour.
      this.light=unit([frame.u,frame.pole,frame.v].map(v=>v.x*light[0]+v.y*light[1]+v.z*light[2]));
      if(prepared&&!prepared.disposed&&prepared.preparationReady&&(!prepared.resources||prepared.resources.ready)){
        // Transfer ownership, not a second pool. Camera/path state is still
        // sampled at handoff; only particles and GPU resources were prepared.
        for(const key of ['particleCapacity','points','fogPoints','chipPoints','instanceLayers','meshDetail','instanceData','instanceOrder','depths','instanceSpatial','flightField','atlasImage','resources'])this[key]=prepared[key];
        // T can recycle a completed tour as well as a fresh warm-up. Preserve
        // geometry and the pool; reset only visibility clocks and tube height.
        this.flightField.exit=null;this.flightField.started=false;this.flightField.alpha=0;
        for(const p of this.flightField.points){p.world[1]+=this.height-prepared.height;p.born=Infinity;delete p.exitFade;}
        prepared.disposed=true;this.preparationReady=true;this.pose=this.cameraPose();this.prepareGrainRoute();return;
      }
      if(prepared&&!prepared.disposed)prepared.dispose();
      this.preparationReady=false;this.pose=this.cameraPose();
      this.points=new Float32Array(0);this.fogPoints=new Float32Array(0);this.chipPoints=new Float32Array(0);
      this.instanceData=new Float32Array(0);this.depths=new Float32Array(0);this.meshDetail=new Uint8Array(0);
      this.instanceLayers=[];this.instanceOrder=[];this.flightField={points:[],projected:{},alpha:0};
      this.atlasImage=typeof Image==='function'?new Image():null;
      if(this.atlasImage){this.atlasImage.crossOrigin='anonymous';this.atlasImage.src=RingTour.atlasUrl;}
      this.preparation=this.buildScene(rand,grainStyle);
      if(!deferPreparation)this.advancePreparation();
    }
    advancePreparation(budget=Infinity){
      if(this.disposed)return false;
      if(this.preparationReady)return true;
      const start=performance.now();
      do{
        if(this.preparation.next().done){this.preparation=null;return this.preparationReady;}
      }while(performance.now()-start<budget);
      return false;
    }
    *buildScene(rand,grainStyle){
      // One fixed pool, not particles spawned per frame or attached to the camera.
      this.points=new Float32Array(Math.floor(SETTINGS.debris*this.particleCapacity)*5);
      // Equal counts of each sprite: original slots 0/1/4/5, extra slots 2/3/6/7.
      // Positions are random, so exact 50:50 source allocation creates no spatial bands.
      for(let i=0;i<this.points.length;i+=5){if(i%640===0)yield;const a=rand()*TAU,r=Math.sqrt(mix(1.28**2,2.26**2,rand())),slot=(i/5)%8;
        this.points.set([Math.cos(a)*r,(rand()-.5)*DEBRIS_LAYER_HEIGHT*edgeHeight(r),Math.sin(a)*r,mix(INSTANCE_SIZE.rockMin,INSTANCE_SIZE.rockMax,rand()**3)*SPRITE_SIZE[slot]*edgeSize(r),(slot+.001+rand()*.998)/8],i);}
      this.fogPoints=new Float32Array(Math.floor(SETTINGS.fog*this.particleCapacity)*5);
      // Relative to rock centres at -10..10, dust occupies -7..7 around ring Y=0.
      for(let i=0;i<this.fogPoints.length;i+=5){if(i%640===0)yield;const a=rand()*TAU,r=Math.sqrt(mix(1.3**2,2.24**2,rand()));
        this.fogPoints.set([Math.cos(a)*r,(rand()-.5)*DEBRIS_LAYER_HEIGHT*DUST_HEIGHT_RATIO*edgeHeight(r,1.3,2.24),Math.sin(a)*r,mix(INSTANCE_SIZE.fogMin,INSTANCE_SIZE.fogMax,rand())*edgeSize(r,1.3,2.24),rand()],i);}
      this.chipPoints=new Float32Array(Math.floor(SETTINGS.chips*this.particleCapacity)*5);
      for(let i=0;i<this.chipPoints.length;i+=5){if(i%640===0)yield;const a=rand()*TAU,r=Math.sqrt(mix(1.28**2,2.26**2,rand()));
        this.chipPoints.set([Math.cos(a)*r,(rand()-.5)*DEBRIS_LAYER_HEIGHT*edgeHeight(r),Math.sin(a)*r,mix(.0006,.0036,rand()**3)*edgeSize(r),rand()],i);}
      yield* this.buildInstanceLayerSteps();
      if(grainStyle)for(let i=0;i<Math.floor(SETTINGS.grains*this.particleCapacity);i++){if(i%128===0)yield;
        this.flightField.points.push({world:[0,0,0],seed:(rand()*4294967296)>>>0,born:0,range:1,...grainStyle(rand)});
      }
      yield* this.buildGrainRoute();this.preparationReady=true;this.prepareGrainRoute();
    }
    advance(mono){
      const dt=this.lastMono===null?0:clamp((mono-this.lastMono)/1000,0,.05);this.lastMono=mono;
      this.visualAge=(this.visualAge||0)+dt;
      if(this.state==='returning'){
        this.returnAge=this.replayBridge?clamp((mono-this.replayBridge.start)/1000,0,this.returnDuration):Math.min(this.returnDuration,this.returnAge+dt);this.fadeAge=(this.fadeAge||0)+dt;
        const m=this.returnMotion,u=clamp(this.returnAge/Math.max(m.rotationTime,.001),0,1);
        this.speed=(m.rewind?m.angularVelocity*(1-smooth(u)):m.turn/m.rotationTime*returnVelocity(u,m.slope))/(TAU/this.period);
        this.pose=this.cameraPose();if(this.returnAge>=this.returnDuration)this.state='complete';this.prepareGrainRoute();return this.pose;
      }
      if(this.state==='complete')return this.pose;
      this.age+=dt;this.angle=this.entryAngle+this.age*TAU/this.period*this.direction;
      if(this.state==='entering'&&this.age>=SETTINGS.entry-1e-9)this.state='cruising';
      this.pose=this.cameraPose();
      this.prepareGrainRoute();
      return this.pose;
    }
    stop(){if(!['entering','cruising'].includes(this.state))return false;this.setReturnView(this.startPose);return true;}
    takeoffStart(){
      const dt=.001,current=withoutDrift(this.cameraPose()),before=withoutDrift(this.cameraPose(Math.max(0,this.age-dt),Math.max(0,(this.returnAge||0)-dt)));
      const from={...withoutDrift(this.pose),bankRate:Math.atan2(-dot(before.up,current.right),dot(before.up,current.up))/dt};
      // Differentiate two samples with identical controls, not a stale drawn
      // pose versus a newly panned/FOV-adjusted synthetic frame.
      const velocity=current.eye.map((v,i)=>(v-before.eye[i])/dt);
      const prior=axes(before.forward,before.up),now=axes(current.forward,current.up),shown=axes(from.forward,from.up);
      const previous={...from,eye:from.eye.map((v,i)=>v-velocity[i]*dt)};
      for(const key of ['forward','up','right'])previous[key]=prior.right.map((_,i)=>dot(shown[key],now.right)*prior.right[i]+dot(shown[key],now.up)*prior.up[i]+dot(shown[key],now.forward)*prior.forward[i]);
      return {from,previous,velocity,dt};
    }
    startTakeoff(mono,duration,turn=Math.floor(Math.random()*2),solarUp=[0,1,0],scoreView=null,locators=[],warpRing=null){
      const {from,previous,velocity,dt}=this.takeoffStart();
      const reach=Math.max(6,Math.hypot(...velocity)*4);
      let path=jumpPath(from,velocity,turn,reach,solarUp);
      // A targets are ranked by angular distance, once on T. Projection
      // previews are only a fallback when no sky locators are available.
      if(warpRing){path=warpPath(from,velocity,{...warpRing,speed:Math.hypot(...velocity)||warpRing.speed});path.previous=previous;}
      else if(locators.length){
        path=jumpPath(from,velocity,turn,reach,solarUp,jumpTargets(from,locators,solarUp)[0]);
      }else if(scoreView){
        let best=Infinity;
        const choices=[null,null];
        for(let i=0;i<choices.length;i++){
          const candidate=jumpPath(from,velocity,(turn+i)%2,reach,solarUp,choices[i]);
          const score=[candidate.duration,candidate.duration+2].reduce((sum,t)=>{const pose=jumpPose(candidate,t);return sum+(scoreView?.({...from,...axes(pose.forward,from.up),eye:pose.eye})||0);},0)+(choices[i]?.cost||0)*100000;
          if(score<best){best=score;path=candidate;}
        }
      }
      this.setReturnView(this.startPose);
      this.replayBridge={start:mono,duration,takeoff:{from,previous,path,brakeAt:Infinity,velocity,dt},correction:this.projection?.correction};
      this.returnDuration=duration/1000;this.returnAge=0;this.state='returning';this.pose=this.cameraPose();
    }
    takeoffPose(elapsed){
      const {from,previous,path,brakeAt,dt}=this.replayBridge.takeoff;
      const t=window.SolarRenderer.replayFlightTime(Math.max(0,elapsed),Math.max(brakeAt,path.ring?.accelerationDuration||0)),carry=t*Math.exp(-t/.6);
      const pose=jumpPose(path,t),heading=axes(pose.forward,from.up);
      const look=path.warp?transition(t,0,Math.min(2.5,path.duration)):pose.look;
      const frame=path.warp?pose:orientation(orientation(previous,from,1+carry/dt),heading,look);
      const weight=path.warp?entryWeight(clamp(t/path.duration,0,1)*SETTINGS.entry):0;
      return {...from,...frame,eye:pose.eye,perspective:mix(from.perspective,1,weight),offset:blend(from.offset,[0,0],weight)};
    }
    returnProgress(start=0){return transition(this.returnAge||0,start,this.returnDuration);}
    ringDetailState(viewEye=projectionEye(this.pose)){
      const returning=this.state==='returning'||this.state==='complete';
      // Leave the local handoff region where retreat began. Moving it away
      // with the camera restored the disk almost instantly. Both renderers
      // now crossfade that SAME region over the existing return timeline.
      if(returning)return {eye:this.returnDetail.eye,amount:this.returnDetail.amount*(1-this.returnProgress(this.returnDetailStart||0))};
      // Preview only the nearest patch of the ring, never the entire disk.
      // The old effective-eye height delayed this reveal until ~6 seconds.
      const radius=Math.hypot(viewEye[0],viewEye[2]),scale=clamp(radius,1.28,2.26)/Math.max(radius,.0001);
      const nearest=[viewEye[0]*scale,clamp(viewEye[1],-.2,.2),viewEye[2]*scale];
      const eye=blend(nearest,viewEye,transition(this.age,SETTINGS.entry-2,SETTINGS.entry));
      return {eye,amount:transition(this.age,this.detailStart,SETTINGS.entry)};
    }
    setReturnView(view){
      if(!this.replayBridge&&this.state==='returning'&&this.returnMotion.rewind){
        // Home redirects the end of the same back-out; it never waits at the
        // former Saturn view. Keep its clock and captured controls intact.
        this.returnDetail=this.ringDetailState();this.returnDetailStart=this.returnAge;
        this.returnNormalStart=this.returnAge;
        this.returnRedirect={at:this.returnAge,view};this.returnTo=view;
        this.returnDuration=Math.min(SETTINGS.returnMax,Math.max(this.returnDuration,this.returnAge+SETTINGS.returnFar));
        return;
      }
      const exiting=this.state==='returning',retargetStart=exiting&&this.returnAge===0,from=withoutDrift(this.pose);
      const dt=retargetStart?this.returnMotion.dt:Math.min(.001,exiting?this.returnAge:this.age);
      const previous=retargetStart?this.returnMotion.previous:dt>0?withoutDrift(this.cameraPose(this.age-dt,(this.returnAge||0)-dt)):from,a=polar(from.eye),b=polar(view.eye),old=polar(previous.eye);
      const angularVelocity=dt>0?Math.abs(Math.atan2(Math.sin(a.angle-old.angle),Math.cos(a.angle-old.angle))/dt):0;
      const detail=this.ringDetailState(),baseline=this.returnTarget?SETTINGS.returnFar:mix(SETTINGS.return,SETTINGS.returnFar,smooth((this.startDistance-4)/24));
      this.returnDetail=detail;
      this.returnAnnotation=this.annotationOpacity();
      // Continue the same noise phase; only its envelope changes on retreat.
      // Capture a clean path so vibration never feeds back into exit velocity.
      const strength=exiting&&this.returnNoise?this.returnNoise.strength*(1-ease((this.returnAge||0)/this.returnDuration)):this.driftStrength(this.age,from.eye);
      const noiseAge=exiting&&this.returnNoise?this.returnNoise.age+(this.returnAge||0):this.age;
      this.returnNoise={strength,age:noiseAge};
      if(!exiting&&!this.replayBridge&&this.entryMotion(this.age).weight<SETTINGS.spiralThreshold){
        this.returnDuration=Math.max(baseline,Math.min(5,this.age*.6));
        this.returnMotion={rewind:true,age:this.age,duration:this.returnDuration,angularVelocity,rotationTime:this.returnDuration,dt,previous};
        this.returnFrom=from;this.returnTo=view;this.returnAge=0;this.state='returning';
        this.returnControls={yaw:this.yaw,pitch:this.pitch,pan:[...this.pan],fov:this.fov};
        if(view!==this.startPose)this.returnRedirect={at:0,view};
        this.pose=this.cameraPose();return;
      }
      let turn=(this.direction*(b.angle-a.angle)%TAU+TAU)%TAU;
      if(turn<1e-7&&angularVelocity>1e-6)turn=TAU;
      const naturalTime=angularVelocity>1e-6?2*turn/(angularVelocity*SETTINGS.returnSpeed):baseline/SETTINGS.returnSpeed;
      const rotationTime=Math.min(SETTINGS.returnMax,naturalTime);
      this.returnDuration=Math.min(SETTINGS.returnMax,Math.max(baseline/SETTINGS.returnSpeed,rotationTime));
      this.returnMotion={a,b,turn,rotationTime,slope:turn>1e-8?angularVelocity*rotationTime/turn:0,angularVelocity,dt,previous,
        radiusVelocity:dt>0?Math.log(a.radius/old.radius)/dt:0,elevationVelocity:dt>0?(a.elevation-old.elevation)/dt:0};
      this.returnFrom=from;this.returnTo=view;this.returnAge=0;this.state='returning';
      this.returnControls={yaw:this.yaw,pitch:this.pitch,pan:[...this.pan],fov:this.fov};
      this.pose=this.cameraPose();
    }
    rewindAge(elapsed){
      const m=this.returnMotion,weight=ease(elapsed/m.duration);
      // Briefly brake the incoming velocity before running the SAME entry
      // path backwards. Both ends have continuous velocity, without a U-turn.
      return (m.age+elapsed*Math.exp(-elapsed/.25))*(1-weight);
    }
    rewindPose(elapsed){
      const m=this.returnMotion,saved=this.returnControls,weight=ease(elapsed/m.duration);
      let pose=controlledPose(this.entryPose(this.rewindAge(elapsed),mix(saved.fov,this.startPose.fov,weight)),
        {yaw:saved.yaw*(1-weight),pitch:saved.pitch*(1-weight),pan:saved.pan.map(v=>v*(1-weight))});
      const redirect=this.returnRedirect;
      if(redirect){
        const t=transition(elapsed,redirect.at,this.returnDuration),to=redirect.view,base=this.startPose,a=polar(pose.eye),b=polar(base.eye),c=polar(to.eye);
        // Deform only the end toward home: no extra stop at Saturn, and no
        // Cartesian chord through the planet. Initial backing-out is intact.
        a.radius=Math.exp(mix(Math.log(a.radius),Math.log(c.radius),t));a.elevation=mix(a.elevation,c.elevation,t);
        a.angle+=Math.atan2(Math.sin(c.angle-b.angle),Math.cos(c.angle-b.angle))*t;
        pose={...pose,...orientation(pose,to,t),eye:polarEye(a),
          offset:blend(pose.offset,to.offset,t),
          orthoScale:Math.exp(mix(Math.log(pose.orthoScale),Math.log(to.orthoScale),t)),fov:mix(pose.fov,to.fov,t)};
      }
      return pose;
    }
    returnPose(elapsed){
      if(this.replayBridge?.takeoff)return this.takeoffPose(elapsed);
      if(this.returnMotion.rewind)return this.rewindPose(elapsed);
      const m=this.returnMotion,from=this.returnFrom,to=this.returnTo,t=clamp(elapsed/this.returnDuration,0,1),weight=ease(t),u=clamp(elapsed/m.rotationTime,0,1);
      const travel=returnTravel(u,m.slope);
      // Carry the current radial/lens velocity briefly, even when interrupted
      // halfway through entry. Bounded momentum cannot drag a long return
      // through Saturn. The radius itself is always outside the solid planet.
      const momentum=elapsed*Math.exp(-elapsed/.35)*(1-weight);
      const turn=this.direction*m.turn*travel;
      const radius=Math.max(Math.min(m.a.radius,m.b.radius,1.08),Math.exp(mix(Math.log(m.a.radius),Math.log(m.b.radius),weight)+m.radiusVelocity*momentum));
      const elevation=mix(m.a.elevation,m.b.elevation,weight)+m.elevationVelocity*momentum,angle=m.a.angle+turn,r=radius*Math.cos(elevation);
      const start=m.dt>0?orientation(turnFrame(m.previous,this.direction*m.angularVelocity*m.dt),from,1+momentum/m.dt):from;
      const frame=turnFrame(orientation(start,turnFrame(to,-this.direction*m.turn),weight),turn);
      const value=(key)=>mix(from[key],to[key],weight)+(m.dt>0?(from[key]-m.previous[key])/m.dt*momentum:0);
      return {...frame,eye:[r*Math.cos(angle),radius*Math.sin(elevation),r*Math.sin(angle)],
        offset:from.offset.map((v,i)=>mix(v,to.offset[i],weight)+(m.dt>0?(v-m.previous.offset[i])/m.dt*momentum:0)),
        perspective:clamp(value('perspective'),0,1),orthoScale:Math.max(.001,value('orthoScale')),fov:value('fov')};
    }
    annotationOpacity(){
      if(this.openingResume)return 0;
      if(this.state==='complete')return 0;
      // Early cancellation may retain some departure labels. Fade them out
      // continuously; the renderer alone owns their opening-style reappearance
      // starting before arrival. Finish departure fading before that reveal.
      if(this.state==='returning')return (this.returnAnnotation||0)*(1-smooth(this.returnAge/Math.max(.001,Math.min(SETTINGS.annotationHide,this.returnDuration-SETTINGS.annotationLead))));
      return RingTour.departureAnnotationOpacity(this.visualAge||0);
    }
    look(yaw,pitch){
      const eye=this.animationPaused?this.cameraPose().eye:null;
      this.yaw+=yaw;this.pitch=clamp(this.pitch+pitch,-1.35,1.35);
      if(eye){
        // Rotate a paused screenshot at the same eye, including frozen drift.
        // Release the small correction smoothly after playback resumes.
        const moved=this.cameraPose().eye,weight=1-smooth(((this.visualAge||0)-(this.lookEyeAge||0))/.4);
        const prior=(this.lookEyeOffset||[0,0,0]).map(v=>v*weight);
        this.lookEyeOffset=prior.map((v,i)=>v+eye[i]-moved[i]);
        this.lookEyeAge=this.visualAge||0;
      }
    }
    zoom(factor){if(factor>0&&Number.isFinite(factor))this.fov=clamp(this.fov/factor,35,100);}
    move(x,y){this.pan[0]=clamp(this.pan[0]+x,-.12,.12);this.pan[1]=clamp(this.pan[1]+y,-.012,.16);}
    cruiseTarget(index){
      // X uses the full visible ring width (0..80%); Y is relative to the
      // landing side (0..100%). Entry samples the outer 0..20% of the visible ring.
      if(index===0)return {x:(SETTINGS.pathRadius-this.radius)/(SETTINGS.pathRadius-SETTINGS.pathInner),y:1};
      if(index===1)return {x:SETTINGS.pathDepth,y:0};
      const xStep=.51,yStep=.6;
      const outside=lap=>{
        const rand=random(this.seed^Math.imul(lap,0x9e3779b1));
        return {x:rand()*(SETTINGS.pathDepth-xStep),y:yStep+rand()*(1-yStep)};
      };
      if(index%2===0)return outside(index);
      // Derive the inner target from BOTH neighbours: no retry loop, growing
      // history or dependence on sample order, and every jump stays visible.
      const a=outside(index-1),b=outside(index+1),rand=random(this.seed^Math.imul(index,0x9e3779b1));
      const minimumX=Math.max(a.x,b.x)+xStep,maximumY=Math.min(a.y,b.y)-yStep;
      return {x:mix(minimumX,SETTINGS.pathDepth,rand()),y:maximumY*rand()};
    }
    boardingSpeed(startDistance=Math.hypot(...this.startEye)){
      // Carry the inward approach through the sampled landing point.
      const gap=Math.max(0,Math.log(startDistance/Math.hypot(this.radius,this.height)));
      return Math.min((this.radius-(SETTINGS.pathRadius-(SETTINGS.pathRadius-SETTINGS.pathInner)*SETTINGS.pathDepth))/this.period,this.radius*gap/SETTINGS.entry);
    }
    cruiseWave(age){
      const laps=Math.max(0,(age-SETTINGS.entry)/this.period),lap=Math.floor(laps);
      const a=this.cruiseTarget(lap),b=this.cruiseTarget(lap+1),phase=laps-lap,weight=ease(phase);
      const span=(SETTINGS.pathRadius-SETTINGS.pathInner)*(b.x-a.x);
      const carry=lap===0?this.boardingSpeed()*this.period*initialTangent(phase):0;
      return {radius:SETTINGS.pathRadius-(SETTINGS.pathRadius-SETTINGS.pathInner)*mix(a.x,b.x,weight+carry/span),height:this.height*(2*mix(a.y,b.y,weight+carry/(2*this.radius))-1)};
    }
    locatorPose(age=this.age,angle=this.entryAngle+age*TAU/this.period*this.direction){
      const c=Math.cos(angle),s=Math.sin(angle);
      const forward=unit([-s*this.direction-c*.38,-this.landingSide*.018,c*this.direction-s*.38]);
      const wave=this.cruiseWave(age);
      return {...axes(forward,[0,this.upSign,0]),eye:[wave.radius*c,wave.height,wave.radius*s]};
    }
    entryMotion(age,startDistance=this.startDistance){
      // Slightly lead the radial acceleration, with no jump at departure and
      // no change to the ten-second arrival or the locator's final velocity.
      const p=clamp(age/SETTINGS.entry,0,1),weight=entryWeight(age,this.openingResume),far=smooth((startDistance-4)/8);
      const gap=Math.log(startDistance/this.landingDistance);
      const flow=gap>0?clamp(this.boardingSpeed(startDistance)*SETTINGS.entry/(this.radius*gap),0,1):0;
      // The old radial ease ended at zero speed, then the first lap accelerated
      // again. This monotonic blend ends with the same tangent as cruiseWave.
      const radial=mix(mix(weight,1-(1-weight)**3,far),p*p*(2-p),flow);
      const distance=Math.exp(mix(Math.log(startDistance),Math.log(this.landingDistance),radial));
      // A contracting spiral from departure, not a radial flight followed by
      // a last-second turn. Position and orientation share this angular clock;
      // the radius only shrinks, so there is no outward loop or Saturn crossing.
      return {weight,distance,curve:weight};
    }
    entryPosition(age,motion=this.entryMotion(age)){
      if(age>=SETTINGS.entry)return this.locatorPose(age).eye;
      const {curve,distance}=motion;
      return spiralPoint(this.startAngle,this.entryTurn,TAU/this.period*this.direction,age,curve,distance,mix(this.startElevation,this.landingElevation,curve));
    }
    rawEntryPose(age,fov=this.fov){
      const motion=this.entryMotion(age),{weight,curve}=motion;
      const frame=orientation(this.startPose,this.approachHeading,curve),turn=(this.entryTurn+age*TAU/this.period*this.direction)*curve;
      const pose={...turnFrame(frame,turn),eye:this.entryPosition(age,motion),offset:blend(this.startOffset,[0,0],weight),perspective:weight,fov,orthoScale:this.orthoScale*motion.distance/this.startDistance};
      if(this.entryView){
        // Follow the moving planet progressively, without changing simulation
        // time or the ring arrival. The live lens also prevents a stale size
        // from popping when Saturn moves toward/away from the normal camera.
        const remaining=1-weight,view=this.entryView;
        const scale=Math.exp(Math.log(view.orthoScale/this.startPose.orthoScale)*remaining);
        const eyeScale=Math.max(1.08/Math.hypot(...pose.eye),scale);
        pose.eye=pose.eye.map(v=>v*eyeScale);pose.orthoScale*=scale;
        pose.offset=pose.offset.map((v,i)=>v+(view.offset[i]-this.startOffset[i])*remaining);
      }
      return pose;
    }
    bankEntryPose(pose,age){
      // Bank follows the actual velocity-bridged path, not a different raw
      // spiral underneath it. Otherwise an opening handoff rolls the wrong way.
      const bank=this.cruiseBank(age,smoothBank(t=>{
        const eye=this.entryPosition(t),bridge=this.openingBridge(t);
        return bridge?eye.map((v,i)=>v+this.openingMomentum.eye[i]*bridge):eye;
      },age,pose.right)*transition(age,this.openingResume?2.5:0,this.openingResume?6:2.5));
      return bankPose(pose,bank);
    }
    cruiseBank(age,pathBank){
      // X reaches 80% at the end of the first lap. Until then use path bank;
      // afterwards share X/Y's clock, easing and reproducible large swings.
      const laps=(age-SETTINGS.entry)/this.period;
      if(laps<=1)return pathBank;
      const lap=Math.floor(laps),weight=ease(laps-lap);
      const target=index=>{
        const rand=random(this.seed^Math.imul(index,0x27d4eb2d));
        const sign=((index+(this.seed&1))%2?1:-1);
        return sign*(.58+.42*rand())*BANK_LIMIT;
      };
      return mix(lap===1?pathBank:target(lap),target(lap+1),weight);
    }
    openingBridge(age){
      const handoff=2.5;
      return this.openingMomentum&&age>0&&age<handoff?handoff*initialTangent(age/handoff):0;
    }
    entryPose(age,fov=this.fov){
      const pose=this.rawEntryPose(age,fov),carry=this.openingMomentum;
      const bridge=this.openingBridge(age);
      if(!bridge)return this.bankEntryPose(pose,age);
      // Preserve the incoming velocity without immediately braking it. This
      // tangent bridge has zero acceleration at both ends of the handoff.
      for(const key of ['eye','offset','forward','up'])pose[key]=pose[key].map((v,i)=>v+carry[key][i]*bridge);
      Object.assign(pose,axes(unit(pose.forward),unit(pose.up)));
      pose.orthoScale=Math.max(.001,pose.orthoScale+carry.orthoScale*bridge);
      pose.perspective=clamp(pose.perspective+carry.perspective*bridge,0,1);
      return this.bankEntryPose(pose,age);
    }
    driftStrength(age,eye){
      const radius=Math.hypot(eye[0],eye[2]);
      // Broad spatial falloff includes the approach to the outer edge. Keep
      // peak strength at the ring's centre, without render-density thresholds.
      const radial=1-smooth(Math.abs(radius-1.77)/.8),vertical=1-smooth(Math.abs(eye[1])/.22);
      return .0011119804416*radial*vertical*transition(age,this.detailStart,SETTINGS.entry);
    }
    driftPattern(index){
      // Shuffle bags guarantee all five patterns, without consecutive repeats.
      // Pure indexing also keeps rewind/retarget samples independent of FPS.
      const cycle=Math.floor(index/5),slot=((index%5)+5)%5;
      const order=n=>{
        const rand=random(this.seed^Math.imul(n+1,0x6c8e9cf5)),bag=[0,1,2,3,4];
        for(let i=4;i>0;i--){const j=Math.floor(rand()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
        return bag;
      };
      const bag=order(cycle);
      if(bag[0]===order(cycle-1)[4])[bag[0],bag[1]]=[bag[1],bag[0]];
      return bag[slot];
    }
    driftWave(age){
      const segment=Math.floor(age/4),blendWeight=ease((age-segment*4)/1.2);
      const sample=pattern=>{
        const rand=random(this.seed^Math.imul(pattern+1,0x85ebca6b));
        return [0,1].map(axis=>{
          const a=TAU*rand(),b=TAU*rand(),frequency=4.68*(.65+rand()*.25);
          const phase=age*TAU*frequency;
          if(pattern===3)return .65*Math.sin(phase+axis*Math.PI/2+a)+.35*Math.sin(phase*1.3+b);
          const gain=pattern===1?(axis===0?1:.4):pattern===2?(axis===1?1:.4):1;
          const pulse=pattern===4?.45+.55*Math.sin(age*1.7+a)**2:1;
          return gain*pulse*(.7*Math.sin(phase+a)+.3*Math.sin(phase*1.618+b));
        });
      };
      return blend(sample(this.driftPattern(segment-1)),sample(this.driftPattern(segment)),blendWeight);
    }
    cameraDrift(age,view=this.entryPose(age),active=this.state!=='complete',returnAge=this.returnAge||0){
      if(!active)return [0,0];
      // Always active in the ring region. Seeded low-frequency waves avoid
      // skipped events, quiet slots, frame jitter and any rotation/dolly.
      const returning=this.state==='returning'&&this.returnNoise;
      const strength=returning?this.returnNoise.strength*(1-ease(returnAge/this.returnDuration)):this.driftStrength(age,view.eye);
      if(returning)age=this.returnNoise.age+returnAge;
      return this.driftWave(age).map(v=>v*strength);
    }
    cameraPose(age=this.age,returnAge=this.returnAge){
      let pose,yaw=this.yaw,pitch=this.pitch,pan=this.pan;
      if(this.state==='returning'||this.state==='complete'){
        const t=ease((returnAge||0)/this.returnDuration),saved=this.returnControls;
        pose=this.returnPose(returnAge||0);
        yaw=(this.yaw-saved.yaw)*(1-t);pitch=(this.pitch-saved.pitch)*(1-t);pan=this.pan.map((v,i)=>(v-saved.pan[i])*(1-t));
        pose.fov+=(this.fov-saved.fov)*(1-t);
      }else pose=this.entryPose(age);
      const view=controlledPose(pose,{yaw,pitch,pan}),drift=this.cameraDrift(age,view,undefined,returnAge||0);
      view.eye=view.eye.map((v,i)=>v+view.right[i]*drift[0]+view.up[i]*drift[1]);
      view.drift=drift;
      if(this.lookEyeOffset){const weight=1-smooth(((this.visualAge||0)-this.lookEyeAge)/.4);view.eye=view.eye.map((v,i)=>v+this.lookEyeOffset[i]*weight);}
      return view;
    }
    entryLayers(progress=this.ringDetailState().amount){
      // One proximity fade, not three staged entrances. Solid detail leads
      // visually; softer dust and sparse highlights support the same region.
      return {particles:.45*progress,debris:progress,dust:.65*progress};
    }
    grainFade(p,now=this.visualAge||0){
      return p.exitFade===undefined?smooth((now-p.born)/p.reveal):p.exitFade;
    }
    *buildGrainRoute(){
      const field=this.flightField;
      if(!field.routeKind){
        field.routeKind='orbit';field.revision=1;
        const centre=SETTINGS.pathRadius-(SETTINGS.pathRadius-SETTINGS.pathInner)*SETTINGS.pathDepth*.5;
        let built=0;
        for(const p of field.points){if(built++%128===0)yield;
          const rand=random(p.seed),a=rand()*TAU,section=rand()*TAU,spread=Math.sqrt(rand());
          // A filled elliptical tube: broad in the middle, thin at the sides.
          const x=Math.cos(section)*spread,y=Math.sin(section)*spread,r=centre+x*GRAIN_WIDTH*.5;
          p.world=[Math.cos(a)*r,this.height+y*GRAIN_HEIGHT*.5,Math.sin(a)*r];
          p.size*=edgeSize(r,centre-GRAIN_WIDTH*.5,centre+GRAIN_WIDTH*.5);
          p.range=1;p.born=Infinity;p.delay=rand()*.35;p.reveal=.5+rand()*.7;
        }
      }
    }
    prepareGrainRoute(){
      const field=this.flightField;if(!field||!this.preparationReady)return;
      const now=this.visualAge||0;
      // Only one world-fixed orbit field. No entry/return path sampling,
      // replacement clouds or per-particle pending/recycle lifecycle.
      if(!field.routeKind)for(const step of this.buildGrainRoute()){}
      if(this.state==='complete'){field.alpha=0;return;}
      if(this.state==='returning'){
        if(!field.exit){
          field.exit={started:now,alpha:field.alpha};
          for(const p of field.points)p.exitFade=this.grainFade(p,now);
        }
        field.alpha=field.exit.alpha*(1-smooth((now-field.exit.started)/.6));
        return;
      }
      const progress=this.ringDetailState().amount,layers=this.entryLayers(progress);
      field.range=mix(2,1,progress);
      if(layers.particles<=0){field.alpha=0;return;}
      if(!field.started){
        field.started=true;
        for(const p of field.points)p.born=now+p.delay;
      }
      field.alpha=layers.particles;
    }
    grainProjection(width,height){
      const frame=this.grainFrame||(this.grainFrame={}),pose=this.pose;
      frame.focal=height/(2*Math.tan(pose.fov*Math.PI/360));
      frame.speed=this.speed*TAU*this.radius/this.period*smooth(this.age/SETTINGS.entry);
      frame.eyeSquared=dot(pose.eye,pose.eye);return frame;
    }
    projectGrain(p,field,out,width,height,frame=this.grainProjection(width,height)){
      out.visible=false;out.alpha=0;if(field.alpha<=0||this.state==='complete')return out;
      const reveal=this.grainFade(p);if(reveal<=0)return out;
      const pose=this.pose,dx=p.world[0]-pose.eye[0],dy=p.world[1]-pose.eye[1],dz=p.world[2]-pose.eye[2];
      const z=dx*pose.forward[0]+dy*pose.forward[1]+dz*pose.forward[2];
      if(z<=.012)return out;
      const distance=Math.hypot(dx,dy,dz);
      // A distant return route must not advertise its entire future cloud.
      // Only visibility changes; the route positions remain world-fixed.
      const range=Math.min(p.range,1)*(field.range||1);
      const density=this.particleDensity(distance*distance/(range*range),p.seed/4294967296);
      if(density<=0)return out;
      if(distance>=range)return out;
      const x=dx*pose.right[0]+dy*pose.right[1]+dz*pose.right[2],y=dx*pose.up[0]+dy*pose.up[1]+dz*pose.up[2];
      const f=frame.focal,safeZ=mix(pose.orthoScale,z,pose.perspective);
      out.x=width/2+(x/safeZ+pose.offset[0])*f;out.y=height/2-(y/safeZ+pose.offset[1])*f;
      const pixels=p.size*.0008*f*p.range/safeZ;
      out.size=clamp(pixels,.2,7);out.glowSize=out.size*p.glow*.0625;
      // Same glow/tail painter as the opening; only world-to-camera projection differs.
      const speed=frame.speed;
      out.tail=clamp(Math.hypot(x,y)*f*speed/(60*safeZ*safeZ),0,24);out.angle=Math.atan2(-y,x);
      out.alpha=.5*reveal*density*field.alpha*smooth((pixels-.35)/.85)*smooth(z/(.08*range))*(1-smooth((distance/range-.25)/.75));
      const b=(pose.eye[0]*dx+pose.eye[1]*dy+pose.eye[2]*dz)/distance,h=b*b-frame.eyeSquared+1,hit=h>=0?-b-Math.sqrt(h):-1;
      out.visible=!(hit>0&&hit<distance)&&
        out.x>=-12&&out.x<=width+12&&out.y>=-12&&out.y<=height+12;
      return out;
    }
    skyCamera(axes,camera){
      const world=v=>['x','y','z'].map(k=>axes.u[k]*v[0]+axes.pole[k]*v[1]+axes.v[k]*v[2]),p=this.pose,f=world(p.forward);
      return {...camera,azimuth:Math.atan2(f[0],f[1]),elevation:-Math.asin(clamp(f[2],-1,1)),
        viewAxes:{right:world(p.right),down:world(p.up).map(v=>-v),forward:f.map(v=>-v)}};
    }
    buildInstanceLayers(){for(const step of this.buildInstanceLayerSteps()){};}
    *buildInstanceLayerSteps(){
      for(const upload of this.resources?.layerUploads?.values()||[])this.resources.gl.deleteBuffer(upload.buffer);
      this.resources?.layerUploads?.clear();this.instanceVisibility?.clear();
      // Immutable membership: each rock belongs to exactly ONE representation.
      // Share CPU staging; each pass retains its immutable uploaded membership.
      this.instanceLayers=[{mesh:'angularMesh'},{mesh:'mesh'},{}, {fog:true}].map(layer=>({...layer,points:layer.fog?this.fogPoints:this.points,indices:[],count:0}));
      for(let i=0;i<this.points.length;i+=5){if(i%640===0)yield;const layer=this.points[i+3]<MESH_MIN_SIZE?2:angularDebris(this.points[i+4])?0:1;this.instanceLayers[layer].indices.push(i);}
      // Thin only close clumps, once at creation. Membership never changes as
      // the camera moves; existing distance/entry fades remain untouched.
      const cells=new Map(),fog=this.fogPoints,cellSize=INSTANCE_SIZE.fogMax;
      for(let i=0;i<fog.length;i+=5){if(i%640===0)yield;
        const x=Math.floor(fog[i]/cellSize),y=Math.floor(fog[i+1]/cellSize),z=Math.floor(fog[i+2]/cellSize);let crowded=false;
        for(let dx=-1;dx<=1&&!crowded;dx++)for(let dy=-1;dy<=1&&!crowded;dy++)for(let dz=-1;dz<=1&&!crowded;dz++){
          for(const j of cells.get(`${x+dx},${y+dy},${z+dz}`)||[]){
            // Enlarged soft envelopes may overlap; retain the original centre
            // spacing so doubling visual size does not erase most of the pool.
            const gap=.35/FOG_SIZE_SCALE*(fog[i+3]+fog[j+3]);
            if((fog[i]-fog[j])**2+(fog[i+1]-fog[j+1])**2+(fog[i+2]-fog[j+2])**2<gap*gap){crowded=true;break;}
          }
        }
        if(crowded)continue;
        const key=`${x},${y},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
        this.instanceLayers[3].indices.push(i);
      }
      // Both rock families use the SAME identity, position, spin and material at
      // both detail levels. Never overlay a mesh and billboard for one rock.
      this.meshDetail=new Uint8Array(this.points.length/5).fill(1);
      const coarse=this.instanceLayers.slice(0,2).map((layer,i)=>{
        layer.lod=1;return {mesh:i===0?'angularCoarseMesh':'coarseMesh',lod:0,points:this.points,indices:layer.indices,count:0};
      });
      this.instanceLayers.splice(3,0,...coarse);
      this.instanceLayers.splice(5,0,{chips:true,points:this.chipPoints,indices:Array.from({length:this.chipPoints.length/5},(_,i)=>i*5),count:0});
      this.instanceData=new Float32Array(Math.max(...this.instanceLayers.map(layer=>layer.indices.length))*5);
      this.instanceSpatial=new Map();
      for(const layer of this.instanceLayers)if(!this.instanceSpatial.has(layer.indices)){const spatial=yield* this.buildSpatialIndexSteps(layer.points,layer.indices);this.instanceSpatial.set(layer.indices,spatial);}
      this.instanceOrder=[];this.depths=new Float32Array(Math.max(this.points.length,this.fogPoints.length,this.chipPoints.length)/5);
    }
    *buildSpatialIndexSteps(points,indices){
      const cells=new Map(),size=.35,membership=new Uint16Array(indices.length);let visited=0;
      for(const i of indices){if(visited++%128===0)yield;
        const x=points[i],y=points[i+1],z=points[i+2],key=Math.floor(x/size)+','+Math.floor(y/size)+','+Math.floor(z/size);
        let c=cells.get(key);
        if(!c){c={id:cells.size,min:[x,y,z],max:[x,y,z],size:0};cells.set(key,c);}
        membership[visited-1]=c.id;
        c.size=Math.max(c.size,points[i+3]);
        for(let k=0;k<3;k++){c.min[k]=Math.min(c.min[k],points[i+k]);c.max[k]=Math.max(c.max[k],points[i+k]);}
      }
      for(const c of cells.values()){c.center=c.min.map((v,k)=>(v+c.max[k])*.5);c.radius=Math.hypot(...c.max.map((v,k)=>(v-c.min[k])*.5))+1e-9;delete c.min;delete c.max;}
      return {points,cells:[...cells.values()],membership,visible:new Uint8Array(cells.size)};
    }
    instanceCandidates(points,indices,range,frustum){
      const spatial=this.instanceSpatial?.get(indices);
      if(!spatial||spatial.points!==points)return indices;
      const out=this.spatialCandidates||(this.spatialCandidates=[]),p=this.pose;out.length=0;spatial.visible.fill(0);
      for(const c of spatial.cells){
        const x=c.center[0]-p.eye[0],y=c.center[1]-p.eye[1],z=c.center[2]-p.eye[2];
        if(x*x+y*y+z*z>(range+c.radius)**2)continue;
        const depth=x*p.forward[0]+y*p.forward[1]+z*p.forward[2],projectedDepth=mix(p.orthoScale,depth,p.perspective);
        if(projectedDepth < -c.size*3.5-c.radius*p.perspective)continue;
        if(frustum){
          const vx=x*p.right[0]+y*p.right[1]+z*p.right[2],vy=x*p.up[0]+y*p.up[1]+z*p.up[2],margin=c.size+c.radius/3.5;
          if(vx-frustum[0][0]*projectedDepth>margin*frustum[0][1]||-vx-frustum[1][0]*projectedDepth>margin*frustum[1][1]||
             vy-frustum[2][0]*projectedDepth>margin*frustum[2][1]||-vy-frustum[3][0]*projectedDepth>margin*frustum[3][1])continue;
        }
        spatial.visible[c.id]=1;
      }
      // Retain original draw order with a cheap membership scan, never a second sort.
      for(let j=0;j<indices.length;j++)if(spatial.visible[spatial.membership[j]])out.push(indices[j]);
      return out;
    }
    particleDensity(distanceSquared,seed){
      const budget=this.particleBudget??1;if(budget>=1)return 1;
      const rank=.85*clamp(distanceSquared,0,1)+.15*((seed*97.31)%1);
      return 1-smooth((rank-budget)/.12);
    }
    instanceFrustum(width,height){
      // Four view-space planes for the SAME blended lens used by the shaders.
      // Sphere margins include rotation and the most stretched angular mesh
      // (1.18 * 1.4 * 1.5 * 1.4 < 3.5), so screen-edge rocks never pop.
      const p=this.pose,tan=Math.tan(p.fov*Math.PI/360),x=width/height*tan,y=tan;
      return [x-p.offset[0],x+p.offset[0],y-p.offset[1],y+p.offset[1]].map(a=>[a,Math.hypot(1,a*p.perspective)*3.5]);
    }
    visibleInstances(points,range,out,order,indices,sorted=true,frustum=null,lod=null,frame=0,pack=true){
      order.length=0;const p=this.pose,rangeSquared=range*range;
      // LODs share culling, depth, hysteresis and stable ordering within this draw.
      const cache=frame&&lod?(this.instanceVisibility||(this.instanceVisibility=new Map())):null;
      let record=cache?.get(indices);
      if(record?.frame===frame&&record.points===points&&record.range===range&&record.focal===lod.focal){
        this.instanceChecks=0;
        for(const i of record.order)if(this.meshDetail[i/5]===lod.level)order.push(i);
      }else{
        if(cache&&!record){record={order:[]};cache.set(indices,record);}
        const selected=cache?record.order:order;selected.length=0;
        const candidates=this.instanceCandidates(points,indices,range,frustum);this.instanceChecks=candidates.length;
        for(const i of candidates){
          const x=points[i]-p.eye[0],y=points[i+1]-p.eye[1],z=points[i+2]-p.eye[2],depth=x*p.forward[0]+y*p.forward[1]+z*p.forward[2];
          const projectedDepth=mix(p.orthoScale,depth,p.perspective);
          const size=points[i+3];
          if(x*x+y*y+z*z>rangeSquared||projectedDepth < -size*3.5)continue;
          if(this.particleBudget<1&&this.particleDensity((x*x+y*y+z*z)/rangeSquared,points[i+4])<=0)continue;
          if(frustum){
            const vx=x*p.right[0]+y*p.right[1]+z*p.right[2],vy=x*p.up[0]+y*p.up[1]+z*p.up[2];
            if(vx-frustum[0][0]*projectedDepth>size*frustum[0][1]||-vx-frustum[1][0]*projectedDepth>size*frustum[1][1]||
               vy-frustum[2][0]*projectedDepth>size*frustum[2][1]||-vy-frustum[3][0]*projectedDepth>size*frustum[3][1])continue;
          }
          if(lod){
            // Conservative full diameter in physical pixels. Hysteresis prevents
            // repeated switches; tiny rocks use 10 vs 20/40 triangles.
            const pixels=7*size*lod.focal/Math.max(.0001,projectedDepth),slot=i/5;
            if(cache||lod.level===1){if(pixels<4)this.meshDetail[slot]=0;else if(pixels>6)this.meshDetail[slot]=1;}
            if(!cache&&this.meshDetail[slot]!==lod.level)continue;
          }
          this.depths[i/5]=depth;selected.push(i);
        }
        if(sorted)selected.sort((a,b)=>this.depths[b/5]-this.depths[a/5]);
        if(cache){Object.assign(record,{frame,points,range,focal:lod.focal});for(const i of selected)if(this.meshDetail[i/5]===lod.level)order.push(i);}
      }
      if(pack)this.packInstances(points,order,out);
      return order.length;
    }
    packInstances(points,order,out){
      for(let j=0;j<order.length;j++)for(let k=0;k<5;k++)out[j*5+k]=points[order[j]+k];
    }
    prepare(gpu,budget=Infinity){
      const g=gpu.gl;if(this.disposed||gpu.contextLost||g.isContextLost())return false;
      const start=performance.now();
      try{
        if(!this.resources){
          const resources=this.resources={gl:g,instances:g.getExtension('ANGLE_instanced_arrays')};
          if(!resources.instances)throw Error('Instanced ring debris is not supported by this GPU.');
          resources.scene=program(g,VERTEX,FRAGMENT,['eye','viewEye','detailEye','basis','lens','offset','planetMap','ringMap','phase','debrisReady','perspective','orthoScale','light','ringTexel','focal']);
        }
        if(!this.preparationReady&&performance.now()-start<budget)this.advancePreparation(Math.max(0,budget-(performance.now()-start)));
        if(this.preparationReady&&!this.resources.ready){
          if(!this.gpuPreparation)this.gpuPreparation=this.buildGpuResources(gpu);
          while(performance.now()-start<budget)if(this.gpuPreparation.next().done){this.gpuPreparation=null;break;}
        }
        return !!this.resources.scene;
      }catch(error){this.dispose();throw error;}
    }
    *buildGpuResources(gpu){
      const g=gpu.gl,resources=this.resources;
      resources.dust=program(g,DEBRIS_VERTEX,DEBRIS_FRAGMENT,['eye','viewEye','detailEye','basis','lens','offset','ringMap','atlas','debrisReady','perspective','orthoScale','fogPass','chipPass','atlasGrid','elapsed','light','particleBudget','budgetRange']);yield;
      resources.rock=program(g,ROCK_VERTEX,ROCK_FRAGMENT,['eye','viewEye','detailEye','basis','lens','offset','ringMap','atlas','debrisReady','perspective','orthoScale','light','elapsed','particleBudget','budgetRange']);yield;
      resources.meshBytes=0;
      for(const key of ['mesh','angularMesh','coarseMesh','angularCoarseMesh']){const mesh=rockGeometry(key.startsWith('angular'),key==='coarseMesh'||key==='angularCoarseMesh');resources[key+'Vertices']=mesh.length/6;resources.meshBytes+=mesh.byteLength;
        resources[key]=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,resources[key]);g.bufferData(g.ARRAY_BUFFER,mesh,g.STATIC_DRAW);yield;}
      const chip=chipGeometry();resources.chipVertices=chip.length/2;resources.meshBytes+=chip.byteLength;
      resources.chip=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,resources.chip);g.bufferData(g.ARRAY_BUFFER,chip,g.STATIC_DRAW);
      resources.ready=true;
    }
    draw(gpu,width,height){
      const g=gpu.gl,planet=gpu.textures.get('saturn'),ring=gpu.textures.get('saturn-ring');
      if(!planet?.texture||!ring?.texture||!this.prepare(gpu,3))return false;
      const r=this.resources,{scene,dust,instances}=r,p=this.pose,tan=Math.tan(p.fov*Math.PI/360);
      const viewEye=projectionEye(p),detail=this.ringDetailState(viewEye);
      // The orbit-only field is world-fixed; disk/debris/dust retain their
      // shared local ring handoff. Free look never moves the particles.
      this.prepareGrainRoute();
      for(const [key,image] of [['atlas',this.atlasImage]])if(!r[key]&&image?.complete&&image.naturalWidth){
        r[key+'Age']=this.visualAge;r[key+'Bytes']=Math.ceil(image.naturalWidth*image.naturalHeight*4*4/3);
        r[key]=g.createTexture();g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,r[key]);
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);
        for(const key of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,key,g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
        g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.generateMipmap(g.TEXTURE_2D);
      }
      g.disable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA,g.ONE,g.ONE_MINUS_SRC_ALPHA);
      g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,planet.texture);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,ring.texture);
      const set=shader=>{g.useProgram(shader.program);g.uniform3fv(shader.u.eye,p.eye);g.uniform3fv(shader.u.detailEye,detail.eye);g.uniform3fv(shader.u.light,this.light);g.uniformMatrix3fv(shader.u.basis,false,p.basis);g.uniform2f(shader.u.lens,width/height*tan,tan);g.uniform2fv(shader.u.offset,p.offset);g.uniform1f(shader.u.perspective,p.perspective);g.uniform1f(shader.u.orthoScale,p.orthoScale);g.uniform1i(shader.u.ringMap,1);};
      const proximity=this.preparationReady&&r.ready?detail.amount:0,layers=this.entryLayers(proximity);
      const ready=r.atlas?smooth((this.visualAge-r.atlasAge)/.8)*layers.debris:0;
      g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,r.atlas||planet.texture);
      set(scene);g.uniform3fv(scene.u.viewEye,viewEye);g.uniform1i(scene.u.planetMap,0);
      g.uniform1f(scene.u.ringTexel,1/ring.width);g.uniform1f(scene.u.focal,height/(2*tan));
      g.uniform1f(scene.u.phase,this.phase);g.uniform1f(scene.u.debrisReady,ready);
      g.bindBuffer(g.ARRAY_BUFFER,gpu.quad);const a=scene.attributes.a;g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);g.drawArrays(g.TRIANGLES,0,6);
      g.disableVertexAttribArray(a);
      if(!this.preparationReady||!r.ready){this.drawCalls=1;gpu.stats.drawCalls++;gpu.resetBindings();return true;}
      // Rocks are solid: depth testing prevents far sprites and mesh faces
      // showing through nearer ones. Fog reads depth but never writes it.
      g.clearDepth(1);g.depthMask(true);g.clear(g.DEPTH_BUFFER_BIT);g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);
      let calls=1;this.nearCount=0;this.fogCount=0;this.chipCount=0;this.submittedInstances=0;this.submittedVertices=0;this.instanceUploadBytes=0;this.instanceFrame=(this.instanceFrame||0)+1;
      const range=2.92+Math.hypot(...detail.eye.map((v,i)=>v-p.eye[i])),frustum=this.instanceFrustum(width,height);
      for(const layer of this.instanceLayers){
        const {mesh,fog,chips,points,indices}=layer,texture=fog||chips?planet.texture:r.atlas,shader=mesh?r.rock:dust;
        const opacity=fog||chips?smooth(this.visualAge/1.2)*(fog?layers.dust:layers.debris):ready;
        const lod=layer.lod===undefined?null:{level:layer.lod,focal:height*(gpu.dpr||1)/(2*tan)};
        layer.count=texture&&opacity>0?this.visibleInstances(points,fog?1.85:range,this.instanceData,this.instanceOrder,indices,!!mesh||!!fog||!!chips,frustum,lod,this.instanceFrame,false):0;
        const count=layer.count;if(!count)continue;
        if(mesh)this.nearCount+=count;if(fog)this.fogCount=count;this.submittedInstances+=count;
        if(chips)this.chipCount=count;const vertices=mesh?r[mesh+'Vertices']:chips?r.chipVertices:6;
        this.submittedVertices+=count*vertices;
        g.depthMask(!fog);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,texture);
        set(shader);g.uniform3fv(shader.u.viewEye,viewEye);g.uniform1i(shader.u.atlas,2);
        g.uniform1f(shader.u.elapsed,this.visualAge||0);g.uniform1f(shader.u.debrisReady,opacity);g.uniform1f(shader.u.particleBudget,this.particleBudget);g.uniform1f(shader.u.budgetRange,fog?1.85:range);
        if(!mesh){g.uniform2f(shader.u.atlasGrid,fog?2:4,2);g.uniform1f(shader.u.fogPass,fog?1:0);g.uniform1f(shader.u.chipPass,chips?1:0);}
        const attributes=shader.attributes,corner=mesh?attributes.corner:attributes.a,{position,detail}=attributes;
        g.bindBuffer(g.ARRAY_BUFFER,mesh?r[mesh]:chips?r.chip:gpu.quad);
        g.enableVertexAttribArray(corner);g.vertexAttribPointer(corner,mesh?3:2,g.FLOAT,false,mesh?24:0,0);
        if(mesh){g.enableVertexAttribArray(attributes.normal);g.vertexAttribPointer(attributes.normal,3,g.FLOAT,false,24,12);g.enable(g.CULL_FACE);g.frontFace(g.CW);}
        this.uploadInstances(g,layer,count);
        g.enableVertexAttribArray(position);g.vertexAttribPointer(position,3,g.FLOAT,false,20,0);
        g.enableVertexAttribArray(detail);g.vertexAttribPointer(detail,2,g.FLOAT,false,20,12);
        instances.vertexAttribDivisorANGLE(position,1);instances.vertexAttribDivisorANGLE(detail,1);
        instances.drawArraysInstancedANGLE(g.TRIANGLES,0,vertices,count);calls++;
        instances.vertexAttribDivisorANGLE(position,0);instances.vertexAttribDivisorANGLE(detail,0);
        for(const attr of Object.values(attributes))g.disableVertexAttribArray(attr);
        if(mesh){g.disable(g.CULL_FACE);g.frontFace(g.CCW);}
      }
      g.depthMask(true);g.disable(g.DEPTH_TEST);
      this.drawCalls=calls;gpu.resetBindings();gpu.stats.drawCalls+=calls;return true;
    }
    uploadInstances(g,layer,count){
      const uploads=this.resources.layerUploads||(this.resources.layerUploads=new Map());
      let upload=uploads.get(layer);
      if(!upload){upload={buffer:g.createBuffer(),order:[],points:null,bytes:0};uploads.set(layer,upload);}
      g.bindBuffer(g.ARRAY_BUFFER,upload.buffer);
      const order=this.instanceOrder;
      if(upload.points===layer.points&&upload.order.length===count&&order.every((v,i)=>v===upload.order[i]))return;
      this.packInstances(layer.points,order,this.instanceData);
      const bytes=count*20;
      if(bytes>upload.bytes){
        // Grow geometrically, bounded by this immutable layer, instead of reallocating per entering grain.
        upload.bytes=Math.min(layer.indices.length*20,Math.max(bytes,upload.bytes*2,2560));
        g.bufferData(g.ARRAY_BUFFER,upload.bytes,g.DYNAMIC_DRAW);
      }
      g.bufferSubData(g.ARRAY_BUFFER,0,this.instanceData.subarray(0,count*5));this.instanceUploadBytes+=bytes;
      upload.points=layer.points;upload.order.length=count;for(let i=0;i<count;i++)upload.order[i]=order[i];
    }
    memoryUsage(){
      const r=this.resources;if(!r)return 0;let bytes=(r.meshBytes||0)+(r.atlasBytes||0);
      for(const upload of r.layerUploads?.values()||[])bytes+=upload.bytes;return bytes;
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;
      this.preparation?.return();this.preparation=null;this.gpuPreparation?.return();this.gpuPreparation=null;
      const r=this.resources;if(r){
        for(const upload of r.layerUploads?.values()||[])r.gl.deleteBuffer(upload.buffer);r.layerUploads?.clear();
        for(const key of ['scene','dust','rock'])if(r[key])r.gl.deleteProgram(r[key].program);
        for(const key of ['mesh','angularMesh','coarseMesh','angularCoarseMesh','chip'])if(r[key])r.gl.deleteBuffer(r[key]);
        if(r.atlas)r.gl.deleteTexture(r.atlas);
      }
      if(this.atlasImage)this.atlasImage.src='';this.atlasImage=null;
      this.flightField.points.length=0;this.instanceLayers.length=this.instanceOrder.length=0;this.resources=null;this.projection=null;
      this.instanceVisibility?.clear();this.instanceSpatial?.clear();this.spatialCandidates=null;this.grainFrame=null;
      this.meshDetail=new Uint8Array(0);
      for(const key of ['points','instanceData','depths','fogPoints','chipPoints'])this[key]=new Float32Array(0);
    }
  }
  RingTour.cursorImage='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="#d9e6f3" stroke-width="1.7" fill="#111b29"><path d="M10 14a6 6 0 0 1 12 0"/><ellipse cx="16" cy="17" rx="13" ry="5"/><path d="m11 24-2 4m7-4v5m5-5 2 4"/><path d="M9 17h1m5 1h2m5-1h1" stroke="white"/></g></svg>')+'")';
  RingTour.cursor=RingTour.cursorImage+' 16 16, pointer';
  RingTour.atlasUrl='https://solar-time.keg0320.workers.dev/media/releases/content/textures/saturn-debris-atlas-v2-1024x512.eba63be4d82c5761d.webp';
  RingTour.settings=SETTINGS;
  RingTour.departureAnnotationOpacity=age=>1-smooth(age/SETTINGS.annotationHide);
  RingTour.screenAxis=screenAxis;
  RingTour.viewPose=viewPose;
  RingTour.bankAngle=bankAngle;
  RingTour.bankLimit=BANK_LIMIT;
  RingTour.smoothBank=smoothBank;
  RingTour.jumpPath=jumpPath;
  RingTour.warpPath=warpPath;
  RingTour.planWarp=planWarp;
  RingTour.warpPosition=warpPosition;
  RingTour.jumpPose=jumpPose;
  RingTour.jumpTargets=jumpTargets;
  RingTour.spriteSize=SPRITE_SIZE;
  root.SolarRingTour=RingTour;
})(window);
