import * as THREE from 'three';
import {displayDirection,type Vec3} from './sceneMath';
import {smallBodyAxes,smallBodyRingRadii,type SmallBodyProfile} from './smallBodyAppearance';
import {coverageDisplayMask,bufferedCoverageDisplayMask,coverageTextureRows,COVERAGE_DISPLAY_POLICY,MAX_COVERAGE_PIXELS} from './appearanceCoverage';

export type AppearanceKind='observed_mosaic'|'radar_mosaic'|'representative_atmosphere'|'illustration'|'literature_constrained';
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
  physical_profile?:SmallBodyProfile;
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
  map_color_type?:'published_rgb_composite'|'single_filter';
  color_composite?:{rgb_channels:string[];contrast_enhanced:boolean;local_color_transform:boolean};
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
  visibility?:string;
}
export interface AppearanceManifest {objects:Record<string,AppearanceEntry>;rings:Record<string,RingEntry>;source_manifest_sha256:string}
export type AppearanceLightingMode='inspection'|'solar';
export type AppearanceCoverageMode='representative'|'marked'|'original';
export interface AppearanceStatus {
  object_id:string;
  state:'loading'|'ready'|'fallback'|'failed';
  kind:AppearanceKind;
  orientation_assumed:boolean;
  source:AppearanceSource|null;
  credit:string;
  limitations:string[];
  display_texture_dimensions?:[number,number];
  lighting_mode?:AppearanceLightingMode;
  coverage_mode?:AppearanceCoverageMode;
  coverage_overlay?:'not_applicable'|'loading'|'ready'|'unavailable';
  coverage_display_policy?:string;
  coverage_marked_pixels?:number;
  coverage_source_pixels?:number;
  coverage_buffered_pixels?:number;
  coverage_buffer_radius_source_px?:number;
  lod_state?:'loading'|'ready'|'retained_after_error';
}
export interface ScaledBand {inner:number;outer:number;color:string;opacity:number;name:string}

export const OVERVIEW_TEXTURE_SIZE=1024;
export const DETAIL_TEXTURE_SIZE=4096;
/** GPU display samples only; the immutable source image and its crop stay unchanged. */
export function displayTextureDimensions(width:number,height:number,maxDimension:number):[number,number]{
  if(![width,height,maxDimension].every(value=>Number.isFinite(value)&&value>0))throw new Error('invalid_display_texture_dimensions');
  const ratio=Math.min(1,maxDimension/Math.max(width,height));
  return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))];
}
/** Hysteresis prevents replacing a texture on every small camera movement. */
export function detailedAppearanceForSize(diameterPixels:number,selected:boolean,wasDetailed:boolean):boolean{
  return selected||Number.isFinite(diameterPixels)&&diameterPixels>=(wasDetailed?128:180);
}

type TextureRequest={run:()=>Promise<THREE.Texture>;resolve:(value:THREE.Texture)=>void;reject:(reason:unknown)=>void};
const textureRequests:TextureRequest[]=[];
let activeTextureRequests=0;
function pumpTextureRequests(){
  while(activeTextureRequests<2&&textureRequests.length){const request=textureRequests.shift()!;activeTextureRequests++;void request.run().then(request.resolve,request.reject).finally(()=>{activeTextureRequests--;pumpTextureRequests();});}
}
const sourceBlobs=new Map<string,Blob>();
let sourceBlobBytes=0;
const SOURCE_CACHE_BYTES=24_000_000;
function rememberSource(url:string,blob:Blob){
  if(blob.size>SOURCE_CACHE_BYTES)return;
  const old=sourceBlobs.get(url);if(old){sourceBlobBytes-=old.size;sourceBlobs.delete(url);}
  sourceBlobs.set(url,blob);sourceBlobBytes+=blob.size;
  while(sourceBlobBytes>SOURCE_CACHE_BYTES||sourceBlobs.size>12){const key=sourceBlobs.keys().next().value;if(!key)break;sourceBlobBytes-=sourceBlobs.get(key)!.size;sourceBlobs.delete(key);}
}
async function decodeSource(blob:Blob,signal:AbortSignal):Promise<THREE.Texture>{
  if(signal.aborted)throw new Error('appearance_disposed');
  const objectUrl=URL.createObjectURL(blob),image=new Image();image.decoding='async';
  try{await new Promise<void>((resolve,reject)=>{const finish=(error?:Error)=>{image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);error?reject(error):resolve();};const abort=()=>{image.src='';finish(new Error('appearance_disposed'));};image.onload=()=>finish();image.onerror=()=>finish(new Error('texture_decode_failed'));signal.addEventListener('abort',abort,{once:true});image.src=objectUrl;});if(signal.aborted)throw new Error('appearance_disposed');const texture=new THREE.Texture(image);texture.needsUpdate=true;return texture;}finally{URL.revokeObjectURL(objectUrl);}
}
function loadPublishedTexture(url:string,priority:boolean,disposed:()=>boolean,signal:AbortSignal):Promise<THREE.Texture>{
  return new Promise((resolve,reject)=>{const request={run:async()=>{if(disposed()||signal.aborted)throw new Error('appearance_disposed');let blob=sourceBlobs.get(url);if(blob){sourceBlobs.delete(url);sourceBlobs.set(url,blob);}else{const response=await fetch(url,{signal,cache:'force-cache',credentials:'same-origin'});if(!response.ok)throw new Error('texture_http_error');blob=await response.blob();if(disposed()||signal.aborted)throw new Error('appearance_disposed');rememberSource(url,blob);}return decodeSource(blob,signal);},resolve,reject};if(priority)textureRequests.unshift(request);else textureRequests.push(request);pumpTextureRequests();});
}

export function subtractRingGaps(bands:RingBand[],gaps:RingBand[]):RingBand[]{
  let result=bands.map(band=>({...band}));
  for(const gap of gaps){result=result.flatMap(band=>{if(gap.outer_km<=band.inner_km||gap.inner_km>=band.outer_km)return [band];const parts:RingBand[]=[];if(gap.inner_km>band.inner_km)parts.push({...band,outer_km:Math.min(band.outer_km,gap.inner_km)});if(gap.outer_km<band.outer_km)parts.push({...band,inner_km:Math.max(band.inner_km,gap.outer_km)});return parts;});}
  return result;
}

/** The source can declare visibility once for a complete ring system. */
export function ringBandsForDisplay(rings:RingEntry|undefined):RingBand[]{
  return subtractRingGaps(rings?.bands_km??[],rings?.gaps_km??[]).map(band=>({...band,visibility:band.visibility??rings?.visibility}));
}

function displayLighting(mode:AppearanceLightingMode):[number,number]{
  // Inspection makes the recorded map readable on the model's night side.
  // Neither display setting is a radiometric prediction or a new observation.
  if(mode==='inspection')return [.42,.92];
  if(mode==='solar')return [.035,1.55];
  throw new Error('invalid_appearance_lighting_mode');
}

function markedCoverage(mode:AppearanceCoverageMode):number{
  if(mode==='marked')return 1;
  if(mode==='original'||mode==='representative')return 0;
  throw new Error('invalid_appearance_coverage_mode');
}

function makeCoverageDisplayTexture(image:HTMLImageElement){
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>MAX_COVERAGE_PIXELS)throw new Error('invalid_coverage_display_raster');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('coverage_display_unavailable');
  context.imageSmoothingEnabled=false;context.drawImage(image,0,0);
  const classified=coverageDisplayMask(context.getImageData(0,0,width,height).data,width,height);
  const buffered=bufferedCoverageDisplayMask(classified.mask,width,height);
  const texture=new THREE.DataTexture(coverageTextureRows(buffered.mask,width,height),width,height,THREE.RedFormat,THREE.UnsignedByteType);
  // Same top-origin decoded raster as the published map; no image is modified.
  texture.flipY=false;texture.unpackAlignment=1;texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.needsUpdate=true;
  return {texture,classified,buffered};
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

function makeSurfaceMaterial(color:string,radius:number,bands:ScaledBand[],entry?:AppearanceEntry,objectId='unknown',lightingMode:AppearanceLightingMode='inspection',coverageMode:AppearanceCoverageMode='marked'){
  const material=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0});
  const sun={value:new THREE.Vector3(0,1,0)};
  const ringNormal={value:new THREE.Vector3(0,1,0)};
  const lighting={value:new THREE.Vector2(...displayLighting(lightingMode))};
  const coverageModeUniform={value:markedCoverage(coverageMode)},coverageEnabled={value:0},coverageMask={value:null as THREE.DataTexture|null};
  const procedural={value:entry?.texture_url?0:['jupiter','saturn','uranus','neptune','venus'].includes(objectId)?1:0};
  let seed=[...objectId].reduce((value,char)=>((value*31+char.charCodeAt(0))>>>0),7919);
  const window=textureWindow(entry??{});
  const bandInner=new Float32Array(MAX_BANDS),bandOuter=new Float32Array(MAX_BANDS),bandOpacity=new Float32Array(MAX_BANDS);
  bands.forEach((band,index)=>{bandInner[index]=band.inner;bandOuter[index]=band.outer;bandOpacity[index]=band.opacity;});
  material.onBeforeCompile=shader=>{
    shader.uniforms.appDisplayLighting=lighting;
    shader.uniforms.appCoverageMode=coverageModeUniform;shader.uniforms.appCoverageEnabled=coverageEnabled;shader.uniforms.appCoverageMask=coverageMask;
    shader.uniforms.appSunDirection=sun;shader.uniforms.appRingNormal=ringNormal;shader.uniforms.appBodyRadius={value:radius};shader.uniforms.appBandCount={value:bands.length};shader.uniforms.appBandInner={value:bandInner};shader.uniforms.appBandOuter={value:bandOuter};shader.uniforms.appBandOpacity={value:bandOpacity};shader.uniforms.appTextureOffset={value:new THREE.Vector2().fromArray(window.offset)};shader.uniforms.appTextureRepeat={value:new THREE.Vector2().fromArray(window.repeat)};shader.uniforms.appLatitudes={value:new THREE.Vector2().fromArray(window.latitude)};shader.uniforms.appTextureFlipX={value:entry?.texture_flip_x?1:0};
    shader.uniforms.appProcedural=procedural;shader.uniforms.appSeed={value:seed%997};shader.uniforms.appGasGiant={value:['jupiter','saturn','uranus','neptune','venus'].includes(objectId)?1:0};
    shader.vertexShader='varying vec3 appLocalPosition; varying vec3 appLocalNormal; varying vec2 appRawUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nappLocalPosition=transformed;appLocalNormal=normal;appRawUv=uv;');
    shader.fragmentShader=shadowUniforms+'\nuniform vec2 appDisplayLighting;uniform float appCoverageMode;uniform float appCoverageEnabled;uniform sampler2D appCoverageMask;varying vec2 appRawUv;uniform vec2 appTextureOffset;uniform vec2 appTextureRepeat;uniform vec2 appLatitudes;uniform float appTextureFlipX;uniform float appProcedural;uniform float appSeed;uniform float appGasGiant;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',/* glsl */`
      float appCoverageWarning=0.0;
      #ifdef USE_MAP
        float appLatitude=appRawUv.y*180.0-90.0;
        float appImageV=(appLatitude-appLatitudes.x)/(appLatitudes.y-appLatitudes.x);
        float appCovered=step(0.0,appImageV)*step(appImageV,1.0);
        vec2 appImageUv=vec2(mix(appRawUv.x,1.0-appRawUv.x,appTextureFlipX),clamp(appImageV,0.0,1.0))*appTextureRepeat+appTextureOffset;
        vec4 appSample=texture2D(map,appImageUv);
        diffuseColor*=mix(vec4(0.035,0.045,0.06,1.0),appSample,appCovered);
        if(appCoverageEnabled>0.5&&appCoverageMode>0.5){
          // Screen-space UI hatching, not generated atmospheric geography.
          appCoverageWarning=max(1.0-appCovered,step(0.5,texture2D(appCoverageMask,appImageUv).r));
        }
      #else
        if(appProcedural>0.5){
          vec3 appPoint=normalize(appLocalPosition);
          float appBands=0.86+0.12*sin(appPoint.y*29.0+0.8*sin(appPoint.z*7.0+appSeed));
          diffuseColor.rgb*=appBands;
        }
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',/* glsl */`vec3 totalDiffuse = diffuseColor.rgb * (appDisplayLighting.x + appDisplayLighting.y * max(dot(normalize(appLocalNormal),appSunDirection),0.0) * appRingShadow(appLocalPosition));
      if(appCoverageWarning>0.5){
        float appStripe=step(6.5,mod(gl_FragCoord.x+gl_FragCoord.y,8.0));
        totalDiffuse=mix(vec3(0.055,0.065,0.075),vec3(0.19,0.21,0.23),appStripe);
      }`);
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;','vec3 totalSpecular = vec3(0.0);');
  };
  material.customProgramCacheKey=()=>`sourced-planet-display-v4`;
  return {material,sun,ringNormal,procedural,lighting,coverageModeUniform,coverageEnabled,coverageMask};
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
  setLightingMode:(mode:AppearanceLightingMode)=>void;
  setCoverageMode:(mode:AppearanceCoverageMode)=>void;
  update:(epochMs:number,sunDirectionWorld:THREE.Vector3)=>void;
  dispose:()=>void;
}

export function createBodyAppearance(options:{objectId:string;displayRadius:number;physicalRadiusKm:number;fallbackColor:string;appearance?:AppearanceEntry;rings?:RingEntry;anisotropy?:number;textureMaxDimension?:number;texturePriority?:boolean;lightingMode?:AppearanceLightingMode;coverageMode?:AppearanceCoverageMode;onStatus?:(status:AppearanceStatus)=>void}):BodyAppearance{
  const {objectId,displayRadius,physicalRadiusKm,appearance,rings}=options;
  let mappingValid=true;try{textureWindow(appearance??{});}catch{mappingValid=false;}
  const bands=scaledRingBands(ringBandsForDisplay(rings),physicalRadiusKm,displayRadius);
  const group=new THREE.Group();const surfaceGroup=new THREE.Group();const ringGroup=new THREE.Group();group.add(surfaceGroup,ringGroup);
  const lightingMode=options.lightingMode??'inspection';
  const coverageMode=options.coverageMode??'marked';
  const surfaceData=makeSurfaceMaterial(appearance?.physical_profile?.color_hex??options.fallbackColor,displayRadius,bands,mappingValid?appearance:undefined,objectId,lightingMode,coverageMode);
  const material:THREE.MeshStandardMaterial|THREE.MeshBasicMaterial=objectId==='sun'?new THREE.MeshBasicMaterial({color:options.fallbackColor}):surfaceData.material;
  if(objectId==='sun')surfaceData.material.dispose();
  const surface=new THREE.Mesh(new THREE.SphereGeometry(displayRadius,64,48),material);surface.userData.objectId=objectId;surface.castShadow=true;surface.receiveShadow=true;surfaceGroup.add(surface);
  const axisScales=smallBodyAxes(appearance?.physical_profile);surface.geometry.scale(...axisScales);
  surface.userData.surfaceRepresentation=appearance?.texture_url?'published_map':appearance?.physical_profile?'literature_constraints_unresolved':'neutral_unresolved_body';
  const centerRadii=smallBodyRingRadii(appearance?.physical_profile,physicalRadiusKm,displayRadius);
  for(const [index,radius] of centerRadii.entries()){
    const vertices=Array.from({length:256},(_,index)=>new THREE.Vector3(Math.cos(index/256*Math.PI*2)*radius,0,Math.sin(index/256*Math.PI*2)*radius));
    const guide=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:'#c4c1b7',transparent:true,opacity:.55,depthWrite:false}));guide.userData.representation='published_ring_center_one_pixel_guide';const pole=appearance?.physical_profile?.rings[index]?.pole_j2000_deg;if(pole)guide.quaternion.copy(orientationQuaternion({pole_icrs_deg:pole},0,false));ringGroup.add(guide);
  }
  const ringMaterials:{material:THREE.ShaderMaterial;sun:{value:THREE.Vector3}}[]=[];
  let usesNarrowGuide=false;
  for(const band of bands){const data=makeRingMaterial(band.color,band.opacity,displayRadius);ringMaterials.push(data);const geometry=new THREE.RingGeometry(band.inner,band.outer,256,4);geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,data.material);mesh.receiveShadow=true;mesh.castShadow=true;ringGroup.add(mesh);if(band.outer-band.inner<displayRadius*.006&&band.opacity>=.02){usesNarrowGuide=true;const lineData=makeRingMaterial(band.color,Math.min(.6,band.opacity),displayRadius);ringMaterials.push(lineData);const radius=(band.inner+band.outer)/2;const vertices=Array.from({length:256},(_,index)=>new THREE.Vector3(Math.cos(index/256*Math.PI*2)*radius,0,Math.sin(index/256*Math.PI*2)*radius));ringGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices),lineData.material));}}
  const atmosphere=objectId==='earth'?makeAtmosphere(displayRadius):null;if(atmosphere)surfaceGroup.add(atmosphere.mesh);
  const hasPole=Boolean(appearance?.body_orientation?.pole_ecliptic||appearance?.body_orientation?.pole_icrs_deg);
  const status:AppearanceStatus={object_id:objectId,state:!mappingValid?'failed':appearance?.texture_url?'loading':appearance?.physical_profile?'ready':'fallback',kind:appearance?.kind??'illustration',orientation_assumed:appearance?.body_orientation?.kind?.includes('assumed')||appearance?.body_orientation?.rotation_phase_verified!==true||!hasPole||!appearance?.body_orientation?.source,source:appearance?.source??null,credit:appearance?.credit??'',limitations:[...RENDER_LIMITATIONS,...(appearance?.limitations??[]),...(rings?.limitations??[]),...(!appearance?.texture_url?[['sun','jupiter','saturn','uranus','neptune','venus'].includes(objectId)?'procedural_atmosphere_is_illustration_not_observed_surface':'unresolved_solid_body_has_no_invented_surface_geography']:[]),...(!mappingValid?['invalid_texture_window_using_illustrative_color']:[]),...(!hasPole?['spin_axis_assumed_for_display']:[]),...(usesNarrowGuide?['narrow_rings_use_one_pixel_display_guides']:[]),...(appearance?.kind==='radar_mosaic'?['radar_texture_is_not_optical_albedo']:[]),...(atmosphere?['atmosphere_is_a_visual_scattering_approximation']:[])]};
  status.lighting_mode=lightingMode;
  status.coverage_mode=coverageMode;
  const coverageApplicable=appearance?.map_color_type==='published_rgb_composite'&&Boolean(appearance.texture_url)&&mappingValid;
  status.coverage_overlay=coverageApplicable?'loading':'not_applicable';
  if(coverageApplicable){status.coverage_display_policy=COVERAGE_DISPLAY_POLICY;status.limitations.push('rgb_zero_channel_overlay_is_display_caution_not_scientific_quality_or_missing_data_mask','zero_rgb_channels_can_also_be_valid_observation_samples','original_published_map_remains_available');}
  let disposed=false;let texture:THREE.Texture|null=null;let coverageTexture:THREE.DataTexture|null=null;const loadController=new AbortController();
  const emit=()=>{options.onStatus?.({...status,limitations:[...status.limitations]});return status;};
  const ready=appearance?.texture_url&&mappingValid?(async()=>{
    try{
      const url=new URL(appearance.texture_url!,window.location.href);
      if(url.origin!==window.location.origin||(!url.pathname.startsWith('/textures/')&&!url.pathname.startsWith('/api/v1/appearance/')))throw new Error('appearance_url_not_allowed');
      const loaded=await loadPublishedTexture(url.href,Boolean(options.texturePriority),()=>disposed,loadController.signal);
      if(disposed){loaded.dispose();return status;}
      if(appearance.pixel_dimensions&&(loaded.image.width!==appearance.pixel_dimensions[0]||loaded.image.height!==appearance.pixel_dimensions[1])){loaded.dispose();throw new Error('texture_dimensions_mismatch');}
      if(coverageApplicable){
        try{
          const overlay=makeCoverageDisplayTexture(loaded.image);
          coverageTexture=overlay.texture;surfaceData.coverageMask.value=coverageTexture;surfaceData.coverageEnabled.value=1;
          status.coverage_overlay='ready';status.coverage_marked_pixels=overlay.classified.marked_pixels;status.coverage_source_pixels=overlay.classified.source_pixels;status.coverage_buffered_pixels=overlay.buffered.buffered_marked_pixels;status.coverage_buffer_radius_source_px=overlay.buffered.radius_source_px;
        }catch{status.coverage_overlay='unavailable';status.limitations.push('coverage_display_overlay_unavailable_original_map_preserved');}
      }
      const dimensions=displayTextureDimensions(loaded.image.width,loaded.image.height,options.textureMaxDimension??DETAIL_TEXTURE_SIZE);
      if(dimensions[0]!==loaded.image.width||dimensions[1]!==loaded.image.height){
        const canvas=document.createElement('canvas');canvas.width=dimensions[0];canvas.height=dimensions[1];const context=canvas.getContext('2d');
        if(!context){loaded.dispose();throw new Error('display_texture_resampling_unavailable');}
        context.drawImage(loaded.image,0,0,...dimensions);loaded.dispose();texture=new THREE.CanvasTexture(canvas);status.limitations.push('source_map_resampled_for_display_only');
      }else texture=loaded;
      status.display_texture_dimensions=dimensions;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.anisotropy=Math.max(1,Math.min(8,options.anisotropy??1));material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;status.state='ready';return emit();
    }
    catch{if(!disposed){status.state='failed';status.kind='illustration';status.source=null;status.credit='';surfaceData.procedural.value=['jupiter','saturn','uranus','neptune','venus'].includes(objectId)?1:0;status.limitations.push('texture_unavailable_using_unresolved_fallback');return emit();}return status;}
  })():Promise.resolve(emit());
  const surfaceWorld=new THREE.Quaternion(),ringWorld=new THREE.Quaternion();
  return {group,surface,status,ready,setLightingMode:mode=>{if(disposed||mode===status.lighting_mode)return;surfaceData.lighting.value.fromArray(displayLighting(mode));status.lighting_mode=mode;emit();},setCoverageMode:mode=>{if(disposed||mode===status.coverage_mode)return;surfaceData.coverageModeUniform.value=markedCoverage(mode);status.coverage_mode=mode;emit();},update:(epochMs,sunDirectionWorld)=>{
    surfaceGroup.quaternion.copy(orientationQuaternion(appearance?.body_orientation,epochMs,true));ringGroup.quaternion.copy(orientationQuaternion(rings??appearance?.body_orientation,epochMs,false));group.updateWorldMatrix(true,true);
    surfaceGroup.getWorldQuaternion(surfaceWorld);ringGroup.getWorldQuaternion(ringWorld);surfaceWorld.invert();surfaceData.sun.value.copy(sunDirectionWorld).applyQuaternion(surfaceWorld).normalize();surfaceData.ringNormal.value.set(0,1,0).applyQuaternion(ringWorld).applyQuaternion(surfaceWorld).normalize();if(atmosphere)atmosphere.sun.value.copy(surfaceData.sun.value);for(const data of ringMaterials)data.sun.value.copy(sunDirectionWorld).applyQuaternion(ringWorld.clone().invert()).normalize();
  },dispose:()=>{disposed=true;loadController.abort();texture?.dispose();coverageTexture?.dispose();group.traverse(child=>{if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(value=>value.dispose());}});group.clear();}};
}
