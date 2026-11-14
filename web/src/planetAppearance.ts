import * as THREE from 'three';
import {displayDirection,type Vec3} from './sceneMath';

export type AppearanceKind='observed_mosaic'|'radar_mosaic'|'representative_atmosphere'|'illustration';
export interface AppearanceSource {url:string;label:string}
export interface BodyOrientation {
  kind?:string;
  epoch?:string;
  pole_icrs_deg?:{ra:number;dec:number};
  pole_ecliptic?:Vec3;
  prime_meridian_deg?:number;
  rotation_rate_deg_per_day?:number;
  texture_longitude_offset_deg?:number;
  source?:AppearanceSource;
  rotation_phase_verified?:boolean;
}
export interface AppearanceEntry {
  texture_url:string|null;
  kind:AppearanceKind;
  source:AppearanceSource;
  credit:string;
  limitations:string[];
  body_orientation?:BodyOrientation;
  texture_region_px?:{x:number;y:number;width:number;height:number};
  pixel_dimensions?:[number,number];
  lat_bounds_deg?:[number,number];
  texture_flip_x?:boolean;
}
export interface RingBand {
  inner_km:number;
  outer_km:number;
  name?:string;
  color?:string;
  display_opacity?:number;
  visibility?:string;
  source?:AppearanceSource;
}
export interface RingEntry {
  bands_km:RingBand[];
  gaps_km?:RingBand[];
  pole_icrs_deg?:{ra:number;dec:number};
  pole_ecliptic?:Vec3;
  source?:AppearanceSource;
  credit?:string;
  limitations?:string[];
}
export interface AppearanceManifest {objects:Record<string,AppearanceEntry>;rings:Record<string,RingEntry>;source_manifest_sha256:string}
export interface AppearanceStatus {
  object_id:string;
  state:'loading'|'ready'|'fallback'|'failed';
  kind:AppearanceKind;
  orientation_assumed:boolean;
  source:AppearanceSource|null;
  credit:string;
  limitations:string[];
}
export interface ScaledBand {inner:number;outer:number;color:string;opacity:number;name:string}

export function subtractRingGaps(bands:RingBand[],gaps:RingBand[]):RingBand[]{
  let result=bands.map(band=>({...band}));
  for(const gap of gaps){result=result.flatMap(band=>{if(gap.outer_km<=band.inner_km||gap.inner_km>=band.outer_km)return [band];const parts:RingBand[]=[];if(gap.inner_km>band.inner_km)parts.push({...band,outer_km:Math.min(band.outer_km,gap.inner_km)});if(gap.outer_km<band.outer_km)parts.push({...band,inner_km:Math.max(band.inner_km,gap.outer_km)});return parts;});}
  return result;
}

export function textureWindow(entry:Pick<AppearanceEntry,'texture_region_px'|'pixel_dimensions'|'lat_bounds_deg'>):{offset:[number,number];repeat:[number,number];latitude:[number,number]}{
  const region=entry.texture_region_px;const dimensions=entry.pixel_dimensions;const latitude=entry.lat_bounds_deg??[-90,90];
  if(!Array.isArray(latitude)||latitude.length!==2||!latitude.every(Number.isFinite)||latitude[0]<-90||latitude[1]>90||latitude[1]<=latitude[0])throw new Error('invalid_texture_latitudes');
  if(!region)return {offset:[0,0],repeat:[1,1],latitude};
  if(!dimensions||!dimensions.every(Number.isFinite)||dimensions.some(value=>value<=0)||![region.x,region.y,region.width,region.height].every(Number.isFinite)||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>dimensions[0]||region.y+region.height>dimensions[1])throw new Error('invalid_texture_region');
  return {offset:[region.x/dimensions[0],(dimensions[1]-region.y-region.height)/dimensions[1]],repeat:[region.width/dimensions[0],region.height/dimensions[1]],latitude};
}

const MAX_BANDS=12;
const FIXED_OBLIQUITY=84381.448/3600*Math.PI/180;
const RENDER_LIMITATIONS=['visual_lighting_not_photometry','map_not_an_observation_at_model_epoch','longitude_alignment_not_validated'];

export function scaledRingBands(bands:RingBand[],physicalRadiusKm:number,displayRadius:number):ScaledBand[]{
  if(!Number.isFinite(physicalRadiusKm)||physicalRadiusKm<=0||!Number.isFinite(displayRadius)||displayRadius<=0)return [];
  return bands.filter(band=>Number.isFinite(band.inner_km)&&Number.isFinite(band.outer_km)&&band.inner_km>=physicalRadiusKm&&band.outer_km>band.inner_km).slice(0,MAX_BANDS).map(band=>({inner:band.inner_km/physicalRadiusKm*displayRadius,outer:band.outer_km/physicalRadiusKm*displayRadius,color:band.color??(band.name==='C'?'#9e9585':band.name==='B'?'#d3c6a6':'#c5b99e'),opacity:Math.max(0,Math.min(1,band.display_opacity??(band.visibility==='very_faint'?.018:band.visibility==='faint'?.16:.72))),name:band.name??''}));
}

export function displayPole(orientation:BodyOrientation|RingEntry|undefined):Vec3{
  if(orientation?.pole_ecliptic)return displayDirection(orientation.pole_ecliptic);
  if(orientation?.pole_icrs_deg){const ra=orientation.pole_icrs_deg.ra*Math.PI/180;const dec=orientation.pole_icrs_deg.dec*Math.PI/180;const equatorial:[number,number,number]=[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];const ecliptic:Vec3=[equatorial[0],Math.cos(FIXED_OBLIQUITY)*equatorial[1]+Math.sin(FIXED_OBLIQUITY)*equatorial[2],-Math.sin(FIXED_OBLIQUITY)*equatorial[1]+Math.cos(FIXED_OBLIQUITY)*equatorial[2]];return displayDirection(ecliptic);}
  return [0,1,0];
}

export function sphereBlocksSun(point:Vec3,sunDirection:Vec3,radius:number):boolean{
  const length=Math.hypot(...sunDirection);if(length===0||radius<=0)return false;const direction=sunDirection.map(value=>value/length) as Vec3;
  const t=-(point[0]*direction[0]+point[1]*direction[1]+point[2]*direction[2]);if(t<=0)return false;
  return Math.hypot(point[0]+t*direction[0],point[1]+t*direction[1],point[2]+t*direction[2])<radius;
}

export function ringsBlockSun(point:Vec3,sunDirection:Vec3,bands:ScaledBand[],normal:Vec3=[0,1,0]):boolean{
  const denominator=sunDirection[0]*normal[0]+sunDirection[1]*normal[1]+sunDirection[2]*normal[2];if(Math.abs(denominator)<1e-10)return false;const t=-(point[0]*normal[0]+point[1]*normal[1]+point[2]*normal[2])/denominator;if(t<=0)return false;const radius=Math.hypot(point[0]+t*sunDirection[0],point[1]+t*sunDirection[1],point[2]+t*sunDirection[2]);return bands.some(band=>radius>=band.inner&&radius<=band.outer);
}

function orientationQuaternion(orientation:BodyOrientation|RingEntry|undefined,epochMs:number,spin:boolean):THREE.Quaternion{
  const pole=displayPole(orientation);const aligned=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3().fromArray(pole));
  if(spin&&orientation&&'rotation_rate_deg_per_day' in orientation){const rate=orientation.rotation_rate_deg_per_day??0;const reference=Date.parse(orientation.epoch??'2000-01-01T12:00:00Z');const days=Number.isFinite(reference)?(epochMs-reference)/86400000:0;const angle=(orientation.prime_meridian_deg??0)+(orientation.texture_longitude_offset_deg??0)+rate*days;aligned.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(angle%360)*Math.PI/180));}
  return aligned;
}

const shadowUniforms=/* glsl */`
uniform vec3 appSunDirection;
uniform vec3 appRingNormal;
uniform float appBodyRadius;
uniform int appBandCount;
uniform float appBandInner[12];
uniform float appBandOuter[12];
uniform float appBandOpacity[12];
varying vec3 appLocalPosition;
varying vec3 appLocalNormal;
float appRingShadow(vec3 point) {
  float denominator=dot(appSunDirection,appRingNormal);
  if(abs(denominator)<0.0001)return 1.0;
  float t=-dot(point,appRingNormal)/denominator;
  if(t<=0.0)return 1.0;
  float radius=length(point+t*appSunDirection);
  float shade=1.0;
  for(int i=0;i<12;i++){
    if(i>=appBandCount)break;
    float inner=smoothstep(appBandInner[i]-0.008*appBodyRadius,appBandInner[i]+0.008*appBodyRadius,radius);
    float outer=1.0-smoothstep(appBandOuter[i]-0.008*appBodyRadius,appBandOuter[i]+0.008*appBodyRadius,radius);
    shade*=1.0-inner*outer*appBandOpacity[i];
  }
  return shade;
}
`;

function makeSurfaceMaterial(color:string,radius:number,bands:ScaledBand[],entry?:AppearanceEntry,objectId='unknown'){
  const material=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0});
  const sun={value:new THREE.Vector3(0,1,0)};
  const ringNormal={value:new THREE.Vector3(0,1,0)};
  const procedural={value:entry?.texture_url?0:1};
  let seed=[...objectId].reduce((value,char)=>((value*31+char.charCodeAt(0))>>>0),7919);
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const craterCenters=new Float32Array(36),craterRadii=new Float32Array(12);for(let i=0;i<12;i++){const z=random()*2-1;const angle=random()*Math.PI*2;const r=Math.sqrt(1-z*z);craterCenters.set([r*Math.cos(angle),z,r*Math.sin(angle)],i*3);craterRadii[i]=.045+random()*.19;}
  const window=textureWindow(entry??{});
  const bandInner=new Float32Array(MAX_BANDS),bandOuter=new Float32Array(MAX_BANDS),bandOpacity=new Float32Array(MAX_BANDS);
  bands.forEach((band,index)=>{bandInner[index]=band.inner;bandOuter[index]=band.outer;bandOpacity[index]=band.opacity;});
  material.onBeforeCompile=shader=>{
    shader.uniforms.appSunDirection=sun;shader.uniforms.appRingNormal=ringNormal;shader.uniforms.appBodyRadius={value:radius};shader.uniforms.appBandCount={value:bands.length};shader.uniforms.appBandInner={value:bandInner};shader.uniforms.appBandOuter={value:bandOuter};shader.uniforms.appBandOpacity={value:bandOpacity};shader.uniforms.appTextureOffset={value:new THREE.Vector2().fromArray(window.offset)};shader.uniforms.appTextureRepeat={value:new THREE.Vector2().fromArray(window.repeat)};shader.uniforms.appLatitudes={value:new THREE.Vector2().fromArray(window.latitude)};shader.uniforms.appTextureFlipX={value:entry?.texture_flip_x?1:0};
    shader.uniforms.appProcedural=procedural;shader.uniforms.appCraterCenters={value:craterCenters};shader.uniforms.appCraterRadii={value:craterRadii};shader.uniforms.appSeed={value:seed%997};shader.uniforms.appGasGiant={value:['jupiter','saturn','uranus','neptune','venus'].includes(objectId)?1:0};
    shader.vertexShader='varying vec3 appLocalPosition; varying vec3 appLocalNormal; varying vec2 appRawUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nappLocalPosition=transformed;appLocalNormal=normal;appRawUv=uv;');
    shader.fragmentShader=shadowUniforms+'\nvarying vec2 appRawUv;uniform vec2 appTextureOffset;uniform vec2 appTextureRepeat;uniform vec2 appLatitudes;uniform float appTextureFlipX;uniform float appProcedural;uniform vec3 appCraterCenters[12];uniform float appCraterRadii[12];uniform float appSeed;uniform float appGasGiant;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',/* glsl */`
      #ifdef USE_MAP
        float appLatitude=appRawUv.y*180.0-90.0;
        float appImageV=(appLatitude-appLatitudes.x)/(appLatitudes.y-appLatitudes.x);
        float appCovered=step(0.0,appImageV)*step(appImageV,1.0);
        vec2 appImageUv=vec2(mix(appRawUv.x,1.0-appRawUv.x,appTextureFlipX),clamp(appImageV,0.0,1.0))*appTextureRepeat+appTextureOffset;
        vec4 appSample=texture2D(map,appImageUv);
        diffuseColor*=mix(vec4(0.035,0.045,0.06,1.0),appSample,appCovered);
      #else
        if(appProcedural>0.5){
          vec3 appPoint=normalize(appLocalPosition);
          float appTerrain=sin(appPoint.x*31.0+appSeed)*sin(appPoint.y*27.0-appSeed)*sin(appPoint.z*39.0+appSeed*0.37);
          appTerrain+=0.35*sin(appPoint.x*89.0+appPoint.z*51.0)*sin(appPoint.y*73.0);
          float appCraters=0.0;
          for(int i=0;i<12;i++){float d=length(appPoint-appCraterCenters[i]);float r=appCraterRadii[i];appCraters-=0.22*(1.0-smoothstep(r*0.1,r,d));appCraters+=0.18*smoothstep(r*.72,r*.92,d)*(1.0-smoothstep(r*.92,r*1.1,d));}
          float appBands=0.86+0.12*sin(appPoint.y*29.0+0.8*sin(appPoint.z*7.0+appSeed));
          diffuseColor.rgb*=mix(clamp(0.88+appTerrain*.18+appCraters,.38,1.25),appBands,appGasGiant);
        }
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;','vec3 totalDiffuse = diffuseColor.rgb * (0.035 + 1.55 * max(dot(normalize(appLocalNormal),appSunDirection),0.0) * appRingShadow(appLocalPosition));');
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;','vec3 totalSpecular = vec3(0.0);');
  };
  material.customProgramCacheKey=()=>`sourced-planet-display-v1`;
  return {material,sun,ringNormal,procedural};
}

function makeRingMaterial(color:string,opacity:number,radius:number){
  const sun={value:new THREE.Vector3(0,1,0)};
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{sunDirection:sun,bodyRadius:{value:radius},bandColor:{value:new THREE.Color(color)},bandOpacity:{value:opacity}},vertexShader:/* glsl */`varying vec3 localPosition;void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:/* glsl */`
    uniform vec3 sunDirection;uniform float bodyRadius;uniform vec3 bandColor;uniform float bandOpacity;varying vec3 localPosition;
    void main(){float towardSun=-dot(localPosition,sunDirection);float distanceToRay=length(localPosition+towardSun*sunDirection);float shadow=towardSun>0.0?smoothstep(bodyRadius*0.985,bodyRadius*1.015,distanceToRay):1.0;float illumination=0.18+1.15*sqrt(abs(sunDirection.y))*mix(0.08,1.0,shadow);gl_FragColor=vec4(bandColor*illumination,bandOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  return {material,sun};
}

function makeAtmosphere(radius:number){
  const sun={value:new THREE.Vector3(0,1,0)};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{sunDirection:sun},vertexShader:/* glsl */`varying vec3 viewNormal;varying vec3 viewPoint;varying vec3 localNormal;void main(){localNormal=normal;viewNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);viewPoint=p.xyz;gl_Position=projectionMatrix*p;}`,fragmentShader:/* glsl */`uniform vec3 sunDirection;varying vec3 viewNormal;varying vec3 viewPoint;varying vec3 localNormal;void main(){float rim=pow(1.0-abs(dot(normalize(viewNormal),normalize(-viewPoint))),3.0);float day=smoothstep(-0.18,0.5,dot(normalize(localNormal),sunDirection));gl_FragColor=vec4(0.18,0.46,1.0,rim*day*0.42);}`});
  return {mesh:new THREE.Mesh(new THREE.SphereGeometry(radius*1.025,64,48),material),sun};
}

export interface BodyAppearance {
  group:THREE.Group;
  surface:THREE.Mesh;
  status:AppearanceStatus;
  ready:Promise<AppearanceStatus>;
  update:(epochMs:number,sunDirectionWorld:THREE.Vector3)=>void;
  dispose:()=>void;
}

export function createBodyAppearance(options:{objectId:string;displayRadius:number;physicalRadiusKm:number;fallbackColor:string;appearance?:AppearanceEntry;rings?:RingEntry;anisotropy?:number;onStatus?:(status:AppearanceStatus)=>void}):BodyAppearance{
  const {objectId,displayRadius,physicalRadiusKm,appearance,rings}=options;
  let mappingValid=true;try{textureWindow(appearance??{});}catch{mappingValid=false;}
  const bands=scaledRingBands(subtractRingGaps(rings?.bands_km??[],rings?.gaps_km??[]),physicalRadiusKm,displayRadius);
  const group=new THREE.Group();const surfaceGroup=new THREE.Group();const ringGroup=new THREE.Group();group.add(surfaceGroup,ringGroup);
  const surfaceData=makeSurfaceMaterial(options.fallbackColor,displayRadius,bands,mappingValid?appearance:undefined,objectId);
  const material:THREE.MeshStandardMaterial|THREE.MeshBasicMaterial=objectId==='sun'?new THREE.MeshBasicMaterial({color:options.fallbackColor}):surfaceData.material;
  if(objectId==='sun')surfaceData.material.dispose();
  const surface=new THREE.Mesh(new THREE.SphereGeometry(displayRadius,64,48),material);surface.userData.objectId=objectId;surface.castShadow=true;surface.receiveShadow=true;surfaceGroup.add(surface);
  const ringMaterials:{material:THREE.ShaderMaterial;sun:{value:THREE.Vector3}}[]=[];
  for(const band of bands){const data=makeRingMaterial(band.color,band.opacity,displayRadius);ringMaterials.push(data);const geometry=new THREE.RingGeometry(band.inner,band.outer,256,4);geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,data.material);mesh.receiveShadow=true;mesh.castShadow=true;ringGroup.add(mesh);}
  const atmosphere=objectId==='earth'?makeAtmosphere(displayRadius):null;if(atmosphere)surfaceGroup.add(atmosphere.mesh);
  const hasPole=Boolean(appearance?.body_orientation?.pole_ecliptic||appearance?.body_orientation?.pole_icrs_deg);
  const status:AppearanceStatus={object_id:objectId,state:!mappingValid?'failed':appearance?.texture_url?'loading':'fallback',kind:appearance?.kind??'illustration',orientation_assumed:appearance?.body_orientation?.kind?.includes('assumed')||appearance?.body_orientation?.rotation_phase_verified!==true||!hasPole||!appearance?.body_orientation?.source,source:appearance?.source??null,credit:appearance?.credit??'',limitations:[...RENDER_LIMITATIONS,...(appearance?.limitations??[]),...(rings?.limitations??[]),...(!appearance?.texture_url?['procedural_terrain_is_illustration_not_observed_surface']:[]),...(!mappingValid?['invalid_texture_window_using_illustrative_color']:[]),...(!hasPole?['spin_axis_assumed_for_display']:[]),...(appearance?.kind==='radar_mosaic'?['radar_texture_is_not_optical_albedo']:[]),...(atmosphere?['atmosphere_is_a_visual_scattering_approximation']:[])]};
  let disposed=false;let texture:THREE.Texture|null=null;
  const emit=()=>{options.onStatus?.({...status,limitations:[...status.limitations]});return status;};
  const ready=appearance?.texture_url&&mappingValid?(async()=>{
    try{const url=new URL(appearance.texture_url!,window.location.href);if(url.origin!==window.location.origin||(!url.pathname.startsWith('/textures/')&&!url.pathname.startsWith('/api/v1/appearance/')))throw new Error('appearance_url_not_allowed');const loaded=await new THREE.TextureLoader().loadAsync(url.href);if(disposed){loaded.dispose();return status;}if(appearance.pixel_dimensions&&(loaded.image.width!==appearance.pixel_dimensions[0]||loaded.image.height!==appearance.pixel_dimensions[1])){loaded.dispose();throw new Error('texture_dimensions_mismatch');}texture=loaded;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.anisotropy=Math.max(1,Math.min(8,options.anisotropy??1));material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;status.state='ready';return emit();}
    catch{if(!disposed){status.state='failed';status.kind='illustration';status.source=null;status.credit='';surfaceData.procedural.value=1;status.limitations.push('texture_unavailable_using_procedural_illustration');return emit();}return status;}
  })():Promise.resolve(emit());
  const surfaceWorld=new THREE.Quaternion(),ringWorld=new THREE.Quaternion();
  return {group,surface,status,ready,update:(epochMs,sunDirectionWorld)=>{
    surfaceGroup.quaternion.copy(orientationQuaternion(appearance?.body_orientation,epochMs,true));ringGroup.quaternion.copy(orientationQuaternion(rings??appearance?.body_orientation,epochMs,false));group.updateWorldMatrix(true,true);
    surfaceGroup.getWorldQuaternion(surfaceWorld);ringGroup.getWorldQuaternion(ringWorld);surfaceWorld.invert();surfaceData.sun.value.copy(sunDirectionWorld).applyQuaternion(surfaceWorld).normalize();surfaceData.ringNormal.value.set(0,1,0).applyQuaternion(ringWorld).applyQuaternion(surfaceWorld).normalize();if(atmosphere)atmosphere.sun.value.copy(surfaceData.sun.value);for(const data of ringMaterials)data.sun.value.copy(sunDirectionWorld).applyQuaternion(ringWorld.clone().invert()).normalize();
  },dispose:()=>{disposed=true;texture?.dispose();group.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(value=>value.dispose());}});group.clear();}};
}
