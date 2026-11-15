import * as THREE from 'three';
import type {AppearanceLightingMode} from './planetAppearance';

const uniformsByMaterial=new WeakMap<THREE.Material,{sun:{value:THREE.Vector3};fill:{value:number}}>();
const fillFor=(mode:AppearanceLightingMode)=>{
  if(mode==='solar')return 0;
  if(mode==='inspection')return .42;
  throw new Error('invalid_fallback_lighting_mode');
};

/** Display-only Lambert shading. Scene fill/ambient lights do not illuminate the night side.
 * The untranslated fallback's object normals and supplied Sun vector share display axes.
 * This material does not provide calibrated radiometry, rotation, or a measured surface.
 */
export function createFallbackSolarMaterial(color:THREE.ColorRepresentation,mode:AppearanceLightingMode='solar'):THREE.MeshStandardMaterial{
  const material=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,emissive:0x000000,emissiveIntensity:0});
  const sun={value:new THREE.Vector3(0,1,0)},fill={value:fillFor(mode)};
  uniformsByMaterial.set(material,{sun,fill});
  material.onBeforeCompile=shader=>{
    shader.uniforms.fallbackSunDirection=sun;shader.uniforms.fallbackFill=fill;
    shader.vertexShader='varying vec3 fallbackObjectNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfallbackObjectNormal=normal;');
    shader.fragmentShader='varying vec3 fallbackObjectNormal;uniform vec3 fallbackSunDirection;uniform float fallbackFill;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;','vec3 totalDiffuse = diffuseColor.rgb * (fallbackFill + 1.55 * max(dot(normalize(fallbackObjectNormal),fallbackSunDirection),0.0));');
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;','vec3 totalSpecular = vec3(0.0);');
  };
  material.customProgramCacheKey=()=> 'fallback-solar-direction-v1';
  return material;
}

export function updateFallbackSun(material:THREE.Material,sun:THREE.Vector3):void{
  const uniforms=uniformsByMaterial.get(material);
  if(!uniforms||![sun.x,sun.y,sun.z].every(Number.isFinite))return;
  uniforms.sun.value.copy(sun).normalize();
}

export function setFallbackLighting(material:THREE.Material,mode:AppearanceLightingMode):void{
  const uniforms=uniformsByMaterial.get(material);if(uniforms)uniforms.fill.value=fillFor(mode);
}
