import * as THREE from 'three';
import {displayDirection,normalized,type Vec3} from './sceneMath';
import {icrsToEclipticUnit,type GalaxyObject,type GalaxyRenderer} from './universeLayers';
import {seededRandom} from './historySceneMath';

type GalaxyInput=Pick<GalaxyObject,'object_id'|'morphology'|'appearance'|'direction_icrs_deg'>;
export interface GalaxyDisplayProfile {
  renderer:GalaxyRenderer;
  inclinationDeg:number;
  inclinationAssumed:boolean;
  positionAngleDeg:number;
  positionAngleAssumed:boolean;
  modeledArms:number;
  companions:number;
  dustLanes:number;
  asymmetric:boolean;
  radius:number;
  projectedAxisRatio:number;
}

/** Rendering controls are qualitative except for explicitly supplied source angles/arm counts. */
export function galaxyDisplayProfile(galaxy:GalaxyInput):GalaxyDisplayProfile {
  const fallback:Record<string,GalaxyRenderer>={'galaxy-m31':'inclined_spiral','galaxy-m33':'flocculent_spiral','galaxy-m81':'grand_design_spiral','galaxy-m87':'elliptical_jet','galaxy-lmc':'irregular_barred','galaxy-smc':'irregular_cloud','galaxy-m51':'interacting_pair','galaxy-m104':'edge_on_dust_disk','galaxy-centaurus-a':'dust_lane_elliptical'};
  const renderer=galaxy.appearance?.renderer??fallback[galaxy.object_id]??(galaxy.morphology==='elliptical'?'elliptical_jet':galaxy.morphology==='irregular'?'irregular_cloud':'grand_design_spiral');
  const defaults:Record<GalaxyRenderer,number>={inclined_spiral:77,flocculent_spiral:35,grand_design_spiral:48,elliptical_jet:0,irregular_barred:22,irregular_cloud:12,interacting_pair:15,edge_on_dust_disk:83,dust_lane_elliptical:0};
  const supplied=galaxy.appearance?.inclination_deg;
  const inclinationAssumed=supplied===null||supplied===undefined||!Number.isFinite(supplied)||supplied<0||supplied>90;
  const inclinationDeg=Math.max(0,Math.min(90,inclinationAssumed?defaults[renderer]:supplied));
  const angle=galaxy.appearance?.position_angle_deg,positionAngleAssumed=angle===null||angle===undefined||!Number.isFinite(angle);
  const modeledArms=galaxy.appearance?.arms??(renderer==='flocculent_spiral'?8:renderer==='irregular_barred'?1:['elliptical_jet','irregular_cloud','dust_lane_elliptical','edge_on_dust_disk'].includes(renderer)?0:2);
  return {renderer,inclinationDeg,inclinationAssumed,positionAngleDeg:positionAngleAssumed?0:angle,positionAngleAssumed,modeledArms,companions:renderer==='interacting_pair'?1:0,dustLanes:renderer==='inclined_spiral'?2:['edge_on_dust_disk','dust_lane_elliptical'].includes(renderer)?1:0,asymmetric:renderer==='irregular_barred'||renderer==='irregular_cloud',radius:renderer==='interacting_pair'?9:7,projectedAxisRatio:['elliptical_jet','dust_lane_elliptical'].includes(renderer)?.82:Math.cos(inclinationDeg*Math.PI/180)};
}

/** Local +Z points toward the solar-system source viewpoint; +Y follows catalogue north. */
export function galaxySourceBasis(ra:number,dec:number):{right:Vec3;up:Vec3;towardViewer:Vec3}|null {
  const direction=icrsToEclipticUnit(ra,dec);if(!direction)return null;
  const r=ra*Math.PI/180,d=dec*Math.PI/180,e=84381.448*Math.PI/(180*3600),nx=-Math.sin(d)*Math.cos(r),ny=-Math.sin(d)*Math.sin(r),nz=Math.cos(d);
  const up=displayDirection([nx,ny*Math.cos(e)+nz*Math.sin(e),-ny*Math.sin(e)+nz*Math.cos(e)]);
  const outward=displayDirection(direction),towardViewer=outward.map(value=>-value) as Vec3;
  const right=normalized([up[1]*towardViewer[2]-up[2]*towardViewer[1],up[2]*towardViewer[0]-up[0]*towardViewer[2],up[0]*towardViewer[1]-up[1]*towardViewer[0]]);
  return {right,up,towardViewer};
}

function glowMap():THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,.74)');gradient.addColorStop(.36,'rgba(255,255,255,.3)');gradient.addColorStop(.7,'rgba(255,255,255,.045)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}

/** A thin 3D annulus in its parent's XY disk plane; no foreground screen overlay.
 * Radii, thickness, grain and opacity remain qualitative display assumptions. */
export function createEmbeddedGalaxyDust(objectId:string,innerRadius:number,outerRadius:number,halfThickness:number):THREE.Mesh {
  const middle=(innerRadius+outerRadius)/2,width=(outerRadius-innerRadius)/2;
  const geometry=new THREE.TorusGeometry(middle,width,16,192);geometry.scale(1,1,halfThickness/width);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{innerRadius:{value:innerRadius},outerRadius:{value:outerRadius}},vertexShader:'varying vec3 dustPoint;void main(){dustPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:/* glsl */`varying vec3 dustPoint;uniform float innerRadius;uniform float outerRadius;void main(){float r=length(dustPoint.xy);float fade=smoothstep(innerRadius,innerRadius+.28,r)*(1.0-smoothstep(outerRadius-.48,outerRadius,r));float angle=atan(dustPoint.y,dustPoint.x);float grain=.88+.12*sin(angle*31.0+r*23.0)*sin(r*41.0);float lane=exp(-pow((r-mix(innerRadius,outerRadius,.72))/max(.08,(outerRadius-innerRadius)*.18),2.0));gl_FragColor=vec4(.035,.022,.016,fade*grain*lane*.42);}`});
  const dust=new THREE.Mesh(geometry,material);dust.name=`embedded-dust-${objectId}`;dust.renderOrder=3;dust.userData.objectId=objectId;dust.userData.representation='qualitative_thin_annular_dust_volume';return dust;
}

export function createGalaxyAppearance(galaxy:GalaxyInput):THREE.Group {
  const profile=galaxyDisplayProfile(galaxy),group=new THREE.Group();group.name=`source-informed-${galaxy.object_id}`;group.userData.galaxyProfile=profile;
  const basis=galaxySourceBasis(galaxy.direction_icrs_deg.ra,galaxy.direction_icrs_deg.dec);if(basis)group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().fromArray(basis.right),new THREE.Vector3().fromArray(basis.up),new THREE.Vector3().fromArray(basis.towardViewer)));
  const projected=new THREE.Group();projected.name='galaxy-projected-frame';projected.rotation.z=(profile.positionAngleAssumed?0:profile.positionAngleDeg+90)*Math.PI/180;group.add(projected);
  const disk=new THREE.Group();disk.name='galaxy-stellar-disk';disk.rotation.x=profile.inclinationDeg*Math.PI/180;projected.add(disk);
  let seed=3721;for(const c of galaxy.object_id)seed=(seed*33+c.charCodeAt(0))>>>0;const random=seededRandom(seed),map=glowMap();
  const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(1e-8,random())))*Math.cos(random()*2*Math.PI);
  const cloud=(parent:THREE.Group,positions:number[],colors:number[],size:number,opacity:number)=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const points=new THREE.Points(geometry,new THREE.PointsMaterial({size,map,vertexColors:true,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));points.userData.objectId=galaxy.object_id;parent.add(points);return points;
  };
  const halo=(parent:THREE.Group,width:number,height:number,opacity:number,color:string,position:Vec3=[0,0,0])=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.position.fromArray(position);sprite.scale.set(width,height,1);sprite.userData.objectId=galaxy.object_id;parent.add(sprite);return sprite;
  };
  const ellipsoid=(parent:THREE.Group,center:Vec3,radii:Vec3,count:number,opacity:number)=>{
    const positions:number[]=[],colors:number[]=[];
    for(let i=0;i<count;i++){const r=Math.min(1,Math.abs(gaussian())*.38),u=random()*2-1,a=random()*Math.PI*2,q=Math.sqrt(1-u*u);positions.push(center[0]+r*q*Math.cos(a)*radii[0],center[1]+r*q*Math.sin(a)*radii[1],center[2]+r*u*radii[2]);const c=new THREE.Color().setHSL(.105,.2,.5+random()*.35);colors.push(c.r,c.g,c.b);}
    cloud(parent,positions,colors,.13,opacity);halo(parent,radii[0]*2.3,radii[1]*2.3,.65,'#e9c99e',center);
  };
  const diffuseDisk=(parent:THREE.Group,flocculent:boolean)=>{
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{arms:{value:Math.max(1,profile.modeledArms)},patchy:{value:flocculent?1:0}},vertexShader:'varying vec2 coord;void main(){coord=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:/* glsl */`varying vec2 coord;uniform float arms;uniform float patchy;void main(){float r=length(coord);float a=atan(coord.y,coord.x);float spiral=pow(.5+.5*cos(a*arms-log(max(.055,r))*5.5),5.0);float noise=.5+.5*sin(coord.x*31.0+sin(coord.y*19.0))*sin(coord.y*29.0);float body=exp(-r*3.4)*(1.0-smoothstep(.8,1.0,r));float light=body*(.4+.75*mix(spiral,noise,patchy));vec3 color=mix(vec3(.95,.72,.43),vec3(.38,.58,.95),smoothstep(.08,.55,r));gl_FragColor=vec4(color,light*.75);}`});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(13,13),material);plane.userData.objectId=galaxy.object_id;parent.add(plane);
  };
  const isElliptical=profile.renderer==='elliptical_jet'||profile.renderer==='dust_lane_elliptical';
  const isIrregular=profile.asymmetric;
  if(isElliptical){
    ellipsoid(projected,[0,0,0],[6.1,5,3.4],6500,.22);
    if(profile.renderer==='dust_lane_elliptical'){const dustDisk=new THREE.Group();dustDisk.name='galaxy-embedded-dust-disk';dustDisk.rotation.set(73*Math.PI/180,0,-.36);dustDisk.add(createEmbeddedGalaxyDust(galaxy.object_id,.45,6.1,.38));projected.add(dustDisk);}
    if(profile.renderer==='elliptical_jet'){
      const knots:number[]=[],colors:number[]=[];for(let i=0;i<120;i++){const u=random(),r=(.02+.035*u)*gaussian();knots.push(.45+u*1.15,.1+u*.25+r,.5+r);colors.push(.35,.7,1);}
      cloud(projected,knots,colors,.12,.65);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.4,.1,.5),new THREE.Vector3(1.6,.35,.5)]),new THREE.LineBasicMaterial({color:'#85cfff',transparent:true,opacity:.25}));projected.add(line);
    }
  }else if(isIrregular){
    const positions:number[]=[],colors:number[]=[];const barred=profile.renderer==='irregular_barred';
    const centers:Vec3[]=barred?[[-2.4,.3,0],[1.9,-.6,.2],[.5,2.2,-.2]]:[[-2.8,.6,0],[.8,-.7,.4],[2.8,.1,-.2]];
    for(let i=0;i<8200;i++){const center=centers[Math.floor(random()*centers.length)];let x=center[0]+gaussian()*1.3,y=center[1]+gaussian()*.85,z=center[2]+gaussian()*.45;if(barred&&i<2700){x=(random()-.5)*7;y=gaussian()*.28;z=gaussian()*.2;}if(barred&&i>7400){const u=random();x=1+u*4;y=-.3+Math.sin(u*2.8)*3;z=gaussian()*.3;}positions.push(x,y,z);const c=new THREE.Color().setHSL(i%19===0?.91:.59,.3,.48+random()*.35);colors.push(c.r,c.g,c.b);}
    cloud(disk,positions,colors,.17,.65);centers.forEach((center,i)=>halo(disk,5.4-i*.7,3.6,.17,'#acc9f3',center));
  }else{
    const flocculent=profile.renderer==='flocculent_spiral',edgeOn=profile.renderer==='edge_on_dust_disk';diffuseDisk(disk,flocculent);
    const positions:number[]=[],colors:number[]=[];const arms=Math.max(1,profile.modeledArms);
    for(let i=0;i<11000;i++){
      const r=Math.pow(random(),.7)*6.2;let angle=random()*Math.PI*2;
      if(!edgeOn&&i>2600){angle=(i%arms)*Math.PI*2/arms+Math.log(.2+r)*2.8+gaussian()*(flocculent?.5:.12);if(flocculent)angle+=.6*Math.sin(r*4+i%arms);}
      const thickness=edgeOn?.055:flocculent?.2:.1;positions.push(Math.cos(angle)*r,Math.sin(angle)*r,gaussian()*thickness);
      const c=new THREE.Color().setHSL(r>2.1?(i%37===0?.91:.59):.1,r>2.1?.34:.23,.45+random()*.4);colors.push(c.r,c.g,c.b);
    }
    cloud(disk,positions,colors,.11,flocculent?.48:.62);
    const bulge=edgeOn?2.8:flocculent?.6:profile.renderer==='inclined_spiral'?1.45:1.8;ellipsoid(projected,[0,0,.12],[bulge,bulge*.82,bulge*.65],1800,flocculent?.16:.32);
    if(profile.renderer==='inclined_spiral'){
      for(const r of [3.2,4.4]){const torus=new THREE.Mesh(new THREE.TorusGeometry(r,.045,8,160),new THREE.MeshBasicMaterial({color:'#1d1612',transparent:true,opacity:.32,depthWrite:false}));torus.position.z=.12;torus.renderOrder=2;disk.add(torus);}
    }
    if(edgeOn)disk.add(createEmbeddedGalaxyDust(galaxy.object_id,2.1,6.25,.085));
    if(profile.renderer==='interacting_pair'){
      ellipsoid(disk,[5.6,3.6,.5],[1.55,1.35,.8],1500,.5);
      const bridge:number[]=[],colors:number[]=[];for(let i=0;i<700;i++){const u=random();bridge.push(3+u*2.7,1.4+u*2.4+.55*Math.sin(u*Math.PI)+gaussian()*.12,.2+gaussian()*.08);colors.push(.7,.74,.9);}cloud(disk,bridge,colors,.12,.48);
    }
  }
  const hit=new THREE.Mesh(new THREE.SphereGeometry(profile.radius,16,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));hit.userData.objectId=galaxy.object_id;group.add(hit);
  return group;
}
