import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createFallbackSolarMaterial,updateFallbackSun,setFallbackLighting} from './fallbackSolarMaterial';

function compiledUniforms(material:THREE.MeshStandardMaterial){
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <begin_vertex>',fragmentShader:'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\nvec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;'};
  material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as THREE.WebGLRenderer);
  return shader;
}

describe('unmapped body Sun-direction display shading',()=>{
  it('has zero night fill and no scene-light/specular/emissive contribution in solar mode',()=>{
    const material=createFallbackSolarMaterial('#8dcbcf','solar'),shader=compiledUniforms(material);
    updateFallbackSun(material,new THREE.Vector3(2,0,0));
    const sun=shader.uniforms.fallbackSunDirection.value as THREE.Vector3;
    const fill=shader.uniforms.fallbackFill.value as number;
    const intensity=(normal:THREE.Vector3)=>fill+1.55*Math.max(normal.normalize().dot(sun),0);
    expect(intensity(new THREE.Vector3(1,0,0))).toBe(1.55);
    expect(intensity(new THREE.Vector3(-1,0,0))).toBe(0);
    expect(intensity(new THREE.Vector3(0,1,0))).toBe(0);
    expect(material.emissiveIntensity).toBe(0);expect(material.emissive.getHex()).toBe(0);
    expect(shader.fragmentShader).not.toContain('reflectedLight.directDiffuse + reflectedLight.indirectDiffuse');
    expect(shader.fragmentShader).toContain('vec3 totalSpecular = vec3(0.0)');
    expect(shader.vertexShader).toContain('fallbackObjectNormal=normal');material.dispose();
  });
  it('updates the same compiled uniforms without altering the input vector or base colour, and inspection explicitly adds fill',()=>{
    const material=createFallbackSolarMaterial('#8dcbcf'),shader=compiledUniforms(material),color=material.color.getHex();
    const input=new THREE.Vector3(0,0,4);updateFallbackSun(material,input);
    expect(input.toArray()).toEqual([0,0,4]);expect((shader.uniforms.fallbackSunDirection.value as THREE.Vector3).toArray()).toEqual([0,0,1]);
    setFallbackLighting(material,'inspection');expect(shader.uniforms.fallbackFill.value).toBe(.42);
    setFallbackLighting(material,'solar');expect(shader.uniforms.fallbackFill.value).toBe(0);expect(material.color.getHex()).toBe(color);
    updateFallbackSun(material,new THREE.Vector3(NaN,0,0));expect((shader.uniforms.fallbackSunDirection.value as THREE.Vector3).toArray()).toEqual([0,0,1]);material.dispose();
  });
  it('does not modify an unmanaged material such as the luminous Sun',()=>{
    const sun=new THREE.MeshBasicMaterial({color:'#ffd283'}),before=sun.color.getHex();
    setFallbackLighting(sun,'solar');updateFallbackSun(sun,new THREE.Vector3(1,0,0));expect(sun.color.getHex()).toBe(before);sun.dispose();
  });
});
