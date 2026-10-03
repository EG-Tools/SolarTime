'use strict';
// Frozen pre-simplification projection, used only to verify the compiled frame transform.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
module.exports=function projectRingTourPoint(projection,world,out,radius=0,normal=projection.normal||(projection.normal={})) {
      // One transform for planetary centres AND entry/return annotation paths.
      const {tour,axes,saturn,saturnRadius,units,focal}=projection,pose=tour.pose;
      this.project(world,normal);
      const x=(world.x-saturn.x)/units,y=(world.y-saturn.y)/units,z=(world.z-saturn.z)/units;
      out.localX=axes.u.x*x+axes.u.y*y+axes.u.z*z;out.localY=axes.pole.x*x+axes.pole.y*y+axes.pole.z*z;out.localZ=axes.v.x*x+axes.v.y*y+axes.v.z*z;
      const dx=out.localX-pose.eye[0],dy=out.localY-pose.eye[1],dz=out.localZ-pose.eye[2];
      const dot=v=>v[0]*dx+v[1]*dy+v[2]*dz,depth=dot(pose.forward),denominator=mix(pose.orthoScale,depth,pose.perspective);
      // All bodies use the SAME moving projection as the Saturn ray shader.
      // Blending an unmoving overview into this result held other planets in
      // place while Saturn alone grew. Only correct the initial lens mismatch,
      // not the camera's motion. A fixed clip unit keeps that correction affine.
      const unit=tour.startPose.orthoScale,ratio=radius/saturnRadius,tourW=denominator/unit;
      out.clipW=tourW;
      out.clipX=(this.w/2+pose.offset[0]*focal)*tourW+dot(pose.right)*focal/unit;
      out.clipY=(this.h/2-pose.offset[1]*focal)*tourW-dot(pose.up)*focal/unit;
      out.clipRadius=ratio*focal/unit;
      const correction=(reference,from)=>{
        const sample=point=>{
          if(!from){const v=this.projectView(point,true),w=v.denominator??1;return [this.cx*w+v.x*this.scale,this.cy*w+v.y*this.scale,w];}
          const coords=[point.x,point.y,point.z,point.depthX??point.x,point.depthY??point.y,point.depthZ??point.z];
          return from.origin.map((v,i)=>v+from.columns.reduce((n,col,k)=>n+col[i]*coords[k],0));
        };
        const clip=sample(world),w=reference.orthoScale/unit,gain=w/sample(saturn)[2],f=this.h/(2*Math.tan(reference.fov*Math.PI/360));
        const d=[out.localX-reference.eye[0],out.localY-reference.eye[1],out.localZ-reference.eye[2]],along=v=>v.reduce((sum,n,i)=>sum+n*d[i],0);
        return [clip[0]*gain-(this.w/2+reference.offset[0]*f)*w-along(reference.right)*f/unit,
          clip[1]*gain-(this.h/2-reference.offset[1]*f)*w+along(reference.up)*f/unit,
          clip[2]*gain-w,ratio*(from?.radius??saturnRadius)*gain-ratio*f/unit];
      };
      let delta=correction(tour.returnTo||tour.startPose);
      if(tour.returnNormalFrom){const previous=correction(tour.startPose,tour.returnNormalFrom),t=tour.returnProgress(tour.returnNormalStart||0);delta=delta.map((v,i)=>mix(previous[i],v,t));}
      const remainder=1-pose.perspective;
      out.clipX+=delta[0]*remainder;out.clipY+=delta[1]*remainder;out.clipW+=delta[2]*remainder;out.clipRadius+=delta[3]*remainder;
      out.behind=out.clipW<=.0001;out.z=-depth;
      const safeW=Math.max(.0001,out.clipW);
      out.x=out.clipX/safeW;out.y=out.clipY/safeW;out.radius=out.clipRadius/safeW;
      return out;
    };
