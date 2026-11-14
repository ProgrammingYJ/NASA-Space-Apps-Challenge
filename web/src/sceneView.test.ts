import {describe,it,expect} from 'vitest';
import {filteredUniverse,includesKnownObject,includesP9Reference,renderingBudget} from './sceneView';
import type {UniverseData} from './UniverseScene';
describe('observed planets and hypothetical reference views',()=>{
  const objects=['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','moon','sedna','sbdb-54538127'].map(object_id=>({object_id,name:object_id,kind:'solar_system' as const,radius_km:1,position_au:[1,2,3] as [number,number,number]}));
  const original:UniverseData={epoch:'2026-11-14T00:00:00Z',coordinate_frame:'J2000',objects};
  it('uses the eight established planets, keeps the Sun only as a reference and preserves physical data',()=>{
    const filtered=filteredUniverse(original,'confirmed-planets')!;
    expect(filtered.objects.map(row=>row.object_id)).toEqual(['sun','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune']);
    expect(filtered.objects[3]).toBe(original.objects[3]);expect(original.objects).toHaveLength(13);
    expect(includesKnownObject('confirmed-planets','sbdb-54538127')).toBe(false);
  });
  it('does not relabel a known TNO as Planet Nine or change the reference epoch',()=>{
    expect(filteredUniverse(original,'p9-reference')!.objects.map(row=>row.object_id)).toEqual(['sun']);
    expect(filteredUniverse(original,'planets-and-p9')!.objects).toHaveLength(9);
    expect(includesP9Reference('planets-and-p9')).toBe(true);expect(includesP9Reference('confirmed-planets')).toBe(false);
    expect(filteredUniverse(original,'all')).toBe(original);expect(original.epoch).toBe('2026-11-14T00:00:00Z');
  });
  it('bounds display work without changing model time',()=>{
    expect(renderingBudget('balanced').fps).toBeLessThan(renderingBudget('detail').fps);
    expect(renderingBudget('balanced').dpr).toBeLessThanOrEqual(1.25);
  });
});
