import {describe,it,expect} from 'vitest';
import {filteredUniverse,includesKnownObject,includesP9Reference,renderingBudget} from './sceneView';
import type {UniverseData} from './UniverseScene';
describe('observed planets and real-object orbital TOP 5 views',()=>{
  const objects=['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','sedna','sbdb-54538127'].map(object_id=>({object_id,name:object_id,kind:'solar_system' as const,radius_km:1,position_au:[1,2,3] as [number,number,number]}));
  const original:UniverseData={epoch:'2026-11-14T00:00:00Z',coordinate_frame:'J2000',objects};
  it('uses the eight established planets, keeps the Sun only as a reference and preserves physical data',()=>{
    const filtered=filteredUniverse(original,'confirmed-planets')!;
    expect(filtered.objects.map(row=>row.object_id)).toEqual(['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune']);
    expect(filtered.objects[3]).toBe(original.objects[3]);expect(original.objects).toHaveLength(13);
    expect(includesKnownObject('confirmed-planets','sbdb-54538127')).toBe(false);
  });
  it('shows only ranked real IDs and the Sun without relabelling them as Planet Nine',()=>{
    expect(filteredUniverse(original,'p9-reference')!.objects.map(row=>row.object_id)).toEqual(['sun']);
    const topFive=new Set(['pluto','sedna','sbdb-54538127']);
    const topOnly=filteredUniverse(original,'p9-reference',topFive)!;
    expect(topOnly.objects.map(row=>row.object_id)).toEqual(['sun','pluto','sedna','sbdb-54538127']);
    expect(topOnly.objects[1]).toBe(original.objects[9]);
    expect(includesKnownObject('p9-reference','pluto',topFive)).toBe(true);
    expect(includesKnownObject('p9-reference','neptune',topFive)).toBe(false);
    expect(includesP9Reference('planets-and-p9')).toBe(true);expect(includesP9Reference('confirmed-planets')).toBe(false);
    expect(filteredUniverse(original,'all')).toBe(original);expect(original.epoch).toBe('2026-11-14T00:00:00Z');
  });
  it('combines the native Solar System including dwarfs and moons with the separate TOP 5 layer',()=>{
    const direction={object_id:'epsilon-indi-b',name:'epsilon',kind:'direction' as const,radius_km:null,position_au:[1,2,3] as [number,number,number]};
    const input:UniverseData={...original,objects:[...original.objects,direction]};
    const filtered=filteredUniverse(input,'planets-and-p9',new Set(['sbdb-54538127']))!;
    expect(filtered.objects.map(row=>row.object_id)).toEqual(original.objects.map(row=>row.object_id));
    expect(filtered.objects.some(row=>row.kind==='direction')).toBe(false);
    expect(filtered.objects[9]).toBe(original.objects[9]);
    expect(includesKnownObject('planets-and-p9','pluto')).toBe(true);
    expect(includesKnownObject('planets-and-p9','moon')).toBe(true);
    expect(includesKnownObject('planets-and-p9','epsilon-indi-b')).toBe(false);
    expect(input.objects).toHaveLength(14);
  });
  it('bounds display work without changing model time',()=>{
    expect(renderingBudget('balanced').fps).toBeLessThan(renderingBudget('detail').fps);
    expect(renderingBudget('balanced').dpr).toBeLessThanOrEqual(1.25);
  });
});
