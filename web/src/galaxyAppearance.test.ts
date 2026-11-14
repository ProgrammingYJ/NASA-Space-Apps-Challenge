import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createGalaxyAppearance,galaxyDisplayProfile,galaxySourceBasis} from './galaxyAppearance';
import type {GalaxyObject,GalaxyRenderer} from './universeLayers';
import {displayPosition} from './sceneMath';
import {galaxyPositionAu} from './universeLayers';

function galaxy(id:string,renderer:GalaxyRenderer,inclination:number|null=null,arms:number|null=null):GalaxyObject {
  return {object_id:id,name:id,kind:'galaxy',direction_icrs_deg:{ra:10.6847,dec:41.269},distance_mpc:.7665,source:{url:'https://science.nasa.gov/',label:'NASA'},appearance:{renderer,observed_features:[],source:{url:'https://science.nasa.gov/',label:'NASA'},inclination_deg:inclination,position_angle_deg:null,arms,orientation_status:'source_projected_appearance',display_assumptions:[]}};
}
describe('galaxy source projection and distinct qualitative renderers',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  function canvasDocument(){vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop:()=>{}}),fillStyle:'',fillRect:()=>{}})})});}
  it('embeds the actual M104 dust vertices inside the same inclined stellar disk instead of a foreground rectangle',()=>{
    canvasDocument();const group=createGalaxyAppearance(galaxy('galaxy-m104','edge_on_dust_disk'));
    const disk=group.getObjectByName('galaxy-stellar-disk')!,dust=group.getObjectByName('embedded-dust-galaxy-m104') as THREE.Mesh;
    group.rotation.y+=.8;group.updateMatrixWorld(true);expect(dust.parent).toBe(disk);expect(dust.geometry).toBeInstanceOf(THREE.TorusGeometry);expect(dust.position.length()).toBe(0);
    const positions=dust.geometry.getAttribute('position'),point=new THREE.Vector3();
    for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(dust.matrixWorld);disk.worldToLocal(point);expect(Math.abs(point.z)).toBeLessThanOrEqual(.08500001);expect(Math.hypot(point.x,point.y)).toBeGreaterThanOrEqual(2.099999);expect(Math.hypot(point.x,point.y)).toBeLessThanOrEqual(6.250001);}
    const normal=new THREE.Vector3(0,0,1).transformDirection(dust.matrixWorld),diskNormal=new THREE.Vector3(0,0,1).transformDirection(disk.matrixWorld);expect(normal.dot(diskNormal)).toBeCloseTo(1,12);expect(disk.rotation.x).toBeCloseTo(83*Math.PI/180,12);
  });
  it('keeps the Cen A elliptical bulge and a thicker embedded tilted dust volume distinct from the Sombrero disk',()=>{
    canvasDocument();const group=createGalaxyAppearance(galaxy('galaxy-centaurus-a','dust_lane_elliptical'));
    const dust=group.getObjectByName('embedded-dust-galaxy-centaurus-a') as THREE.Mesh,plane=group.getObjectByName('galaxy-embedded-dust-disk')!;
    expect(dust.parent).toBe(plane);expect(dust.position.length()).toBe(0);dust.geometry.computeBoundingBox();expect(dust.geometry.boundingBox!.max.z).toBeCloseTo(.38,6);expect(plane.rotation.x).toBeCloseTo(73*Math.PI/180,12);expect(group.userData.galaxyProfile.renderer).toBe('dust_lane_elliptical');expect(group.userData.galaxyProfile.modeledArms).toBe(0);
  });
  it('preserves sourced M31 inclination and keeps unknown angles explicitly assumed',()=>{
    const object=galaxy('galaxy-m31','inclined_spiral',77),before=galaxyPositionAu(object);
    const profile=galaxyDisplayProfile(object);expect(profile.inclinationDeg).toBe(77);expect(profile.inclinationAssumed).toBe(false);expect(profile.positionAngleAssumed).toBe(true);
    expect(profile.projectedAxisRatio).toBeCloseTo(.2249510543,9);expect(profile.dustLanes).toBe(2);
    expect(galaxyDisplayProfile(galaxy('galaxy-m81','grand_design_spiral')).inclinationAssumed).toBe(true);
    expect(galaxyDisplayProfile(galaxy('galaxy-m31','inclined_spiral',200)).inclinationAssumed).toBe(true);
    expect(galaxyPositionAu(object)).toEqual(before);
  });
  it('gives no spiral arms to M87, an actual two-arm model to M81, and separates irregular, companion and dust-lane shapes',()=>{
    expect(galaxyDisplayProfile(galaxy('galaxy-m87','elliptical_jet',null,0)).modeledArms).toBe(0);
    expect(galaxyDisplayProfile(galaxy('galaxy-m81','grand_design_spiral',null,2)).modeledArms).toBe(2);
    expect(galaxyDisplayProfile(galaxy('galaxy-lmc','irregular_barred',null,1)).asymmetric).toBe(true);
    expect(galaxyDisplayProfile(galaxy('galaxy-smc','irregular_cloud')).modeledArms).toBe(0);
    expect(galaxyDisplayProfile(galaxy('galaxy-m51','interacting_pair')).companions).toBe(1);
    expect(galaxyDisplayProfile(galaxy('galaxy-m104','edge_on_dust_disk')).projectedAxisRatio).toBeLessThan(.15);
    expect(galaxyDisplayProfile(galaxy('galaxy-centaurus-a','dust_lane_elliptical')).dustLanes).toBe(1);
  });
  it('constructs an orthonormal source-view basis with its front facing the solar-system origin',()=>{
    const object=galaxy('galaxy-m31','inclined_spiral',77),basis=galaxySourceBasis(object.direction_icrs_deg.ra,object.direction_icrs_deg.dec)!;
    const position=displayPosition(galaxyPositionAu(object)!);const length=Math.hypot(...position);
    for(const v of Object.values(basis))expect(Math.hypot(...v)).toBeCloseTo(1,12);
    const dot=(a:number[],b:number[])=>a.reduce((sum,value,i)=>sum+value*b[i],0);
    expect(dot(basis.right,basis.up)).toBeCloseTo(0,12);expect(dot(basis.up,basis.towardViewer)).toBeCloseTo(0,12);
    expect(dot(basis.towardViewer,position)/length).toBeCloseTo(-1,12);expect(galaxySourceBasis(0,91)).toBeNull();
  });
});
