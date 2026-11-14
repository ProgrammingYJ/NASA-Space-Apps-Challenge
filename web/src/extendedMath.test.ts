import {describe,it,expect} from 'vitest';
import {composeExtended,extendedPosition,prepareExtended,type ExtendedCatalog,type ExtendedObject} from './extendedMath';
import type {UniverseData} from './UniverseScene';
const start='2026-11-14T00:00:00Z',end='2026-11-15T00:00:00Z';
const moon:ExtendedObject={object_id:'moon-test',name:'test',kind:'moon',parent_id:'earth',status:'available',radius_km:null,knots:[{epoch:start,tdb_jd:1,position_au:[1,2,3],velocity_au_day:[2,0,0]},{epoch:end,tdb_jd:2,position_au:[3,2,3],velocity_au_day:[2,0,0]}]};
const catalog:ExtendedCatalog={objects:[moon,{...moon,object_id:'unavailable',status:'ephemeris_unavailable',knots:[]}],summary:{},source_manifest_sha256:'test',start_epoch:start,end_epoch:end,limitations:[]};
describe('source-relative extended solar positions',()=>{
  it('keeps missing ephemerides out of physical scenes and preserves open, immutable interval traces',()=>{
    const prepared=prepareExtended(catalog);expect(prepared).toHaveLength(1);expect(prepared[0].trace.closed).toBe(false);expect(prepared[0].trace.kind).toBe('sampled_ephemeris_trace');expect(prepared[0].trace.points_au[0]).toBe(moon.knots![0].position_au);
  });
  it('interpolates bounded relative positions and adds the actual parent exactly once',()=>{
    const epoch=Date.parse(start)+43200000;expect(extendedPosition(moon,epoch)).toEqual([2,2,3]);const base:UniverseData={epoch:start,coordinate_frame:'J2000 ecliptic',objects:[{object_id:'earth',name:'Earth',kind:'solar_system',position_au:[10,20,30]}]};
    const prepared=prepareExtended(catalog);const scene=composeExtended(base,prepared,epoch);expect(scene.objects[1].position_au).toEqual([12,22,33]);expect(scene.objects[1].parent_relative_position_au).toEqual([2,2,3]);expect(scene.objects[1].radius_km).toBeUndefined();expect(scene.objects[1].orbit).toBe(prepared[0].trace);expect(base.objects).toHaveLength(1);
    expect(()=>extendedPosition(moon,Date.parse(start)-1)).toThrow();expect(()=>extendedPosition(moon,Date.parse(end)+1)).toThrow();
  });
});
