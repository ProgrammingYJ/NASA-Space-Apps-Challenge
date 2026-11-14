import {describe,expect,it} from 'vitest';
import {galaxyDisplayProfile,galaxySourceBasis} from './galaxyAppearance';
import type {GalaxyObject,GalaxyRenderer} from './universeLayers';
import {displayPosition} from './sceneMath';
import {galaxyPositionAu} from './universeLayers';

function galaxy(id:string,renderer:GalaxyRenderer,inclination:number|null=null,arms:number|null=null):GalaxyObject {
  return {object_id:id,name:id,kind:'galaxy',direction_icrs_deg:{ra:10.6847,dec:41.269},distance_mpc:.7665,source:{url:'https://science.nasa.gov/',label:'NASA'},appearance:{renderer,observed_features:[],source:{url:'https://science.nasa.gov/',label:'NASA'},inclination_deg:inclination,position_angle_deg:null,arms,orientation_status:'source_projected_appearance',display_assumptions:[]}};
}
describe('galaxy source projection and distinct qualitative renderers',()=>{
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
