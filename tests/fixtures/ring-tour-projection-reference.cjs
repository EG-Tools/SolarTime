'use strict';
// Independent scalar projection, used only to verify the compiled frame transform.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
module.exports=function projectRingTourPoint(projection,world,out,radius=0,normal=projection.normal||(projection.normal={})) {
      // One transform for planetary centres AND entry/return annotation paths.
      const {tour,axes,saturn,saturnRadius,units,focal}=projection,pose=tour.pose;
      this.project(world,normal);
      const x=(world.x-saturn.x)/units,y=(world.y-saturn.y)/units,z=(world.z-saturn.z)/units;
      out.localX=axes.u.x*x+axes.u.y*y+axes.u.z*z;out.localY=axes.pole.x*x+axes.pole.y*y+axes.pole.z*z;out.localZ=axes.v.x*x+axes.v.y*y+axes.v.z*z;
      const dx=out.localX-pose.eye[0],dy=out.localY-pose.eye[1],dz=out.localZ-pose.eye[2];
      const dot=v=>v[0]*dx+v[1]*dy+v[2]*dz,depth=dot(pose.forward);
      const denominator=mix(pose.orthoScale,depth,pose.perspective);
      // Every centre, radius and orbit point uses this same moving camera depth.
      const unit=tour.startPose.orthoScale,ratio=radius/saturnRadius,tourW=denominator/unit;
      out.clipW=tourW;
      out.clipX=(this.w/2+pose.offset[0]*focal)*tourW+dot(pose.right)*focal/unit;
      out.clipY=(this.h/2-pose.offset[1]*focal)*tourW-dot(pose.up)*focal/unit;
      out.clipRadius=ratio*focal/unit;
      const mapSample=(map,point)=>{
        if(!map){const v=this.projectView(point,true),w=v.denominator??1;return [this.cx*w+v.x*this.scale,this.cy*w+v.y*this.scale,w];}
        const coords=[point.x,point.y,point.z,point.depthX??point.x,point.depthY??point.y,point.depthZ??point.z];
        return map.origin.map((value,row)=>value+map.columns.reduce((sum,column,index)=>sum+column[row]*coords[index],0));
      };
      const referenceSample=(reference,point)=>{
        const px=(point.x-saturn.x)/units,py=(point.y-saturn.y)/units,pz=(point.z-saturn.z)/units;
        const local=[axes.u.x*px+axes.u.y*py+axes.u.z*pz,axes.pole.x*px+axes.pole.y*py+axes.pole.z*pz,axes.v.x*px+axes.v.y*py+axes.v.z*pz];
        const d=local.map((value,index)=>value-reference.eye[index]),along=axis=>axis.reduce((sum,value,index)=>sum+value*d[index],0),f=this.h/(2*Math.tan(reference.fov*Math.PI/360));
        const w=mix(reference.orthoScale,along(reference.forward),reference.perspective||0)/unit;
        return [(this.w/2+reference.offset[0]*f)*w+along(reference.right)*f/unit,
          (this.h/2-reference.offset[1]*f)*w-along(reference.up)*f/unit,w,f/unit];
      };
      const correction=(reference,map)=>{
        const target=mapSample(map,world),base=referenceSample(reference,world),weight=reference.pointified?1:Math.max(1e-6,1-(reference.perspective||0));
        const scale=base[3]/(map?.radius??saturnRadius);
        return [(target[0]*scale-base[0])/weight,(target[1]*scale-base[1])/weight,(target[2]*scale-base[2])/weight,0];
      };
      const normalMap=tour.entryNormalProjection||null,reference=tour.returnTo||tour.entryView||tour.startPose;
      let delta=correction(reference,normalMap);
      if(tour.returnNormalFrom&&(tour.state==='returning'||tour.state==='complete')){
        const base=tour.entryView||tour.startPose,from=correction(tour.liveReturn?this.ringTourMappedView(saturn,tour.returnNormalFrom,base):base,tour.returnNormalFrom),t=tour.returnProgress(tour.returnNormalStart||0);
        delta=delta.map((value,index)=>mix(from[index],value,t));
      }
      let remainder=1-pose.perspective;
      if(tour.pointified&&tour.state==='entering')remainder=1-(clamp(tour.age/1.2,0,1)**3*(clamp(tour.age/1.2,0,1)*(clamp(tour.age/1.2,0,1)*6-15)+10));
      const saturnOrigin=Math.abs(out.localX)+Math.abs(out.localY)+Math.abs(out.localZ)<1e-9;
      const returnBlend=tour.state==='returning'||tour.state==='complete'?tour.returnProgress(tour.returnNormalStart||0):0;
      const calibration=saturnOrigin?0:remainder;
      out.clipX+=delta[0]*calibration;out.clipY+=delta[1]*calibration;out.clipW+=delta[2]*calibration;out.clipRadius+=delta[3]*calibration;
      const visibilityW=out.clipW+(saturnOrigin?remainder*returnBlend*delta[2]:0);
      out.behind=visibilityW<=.0001/unit;out.z=-depth;
      const safeW=Math.max(.0001/unit,out.clipW);
      out.x=out.clipX/safeW;out.y=out.clipY/safeW;out.radius=out.clipRadius/safeW;
      return out;
    };
