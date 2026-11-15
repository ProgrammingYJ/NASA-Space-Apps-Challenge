import {describe,expect,it} from 'vitest';
import {approximateMass,finiteSourceNumber,APPROXIMATE_MASS_ALGORITHM} from './ApproximateMassMath';
import {approximateMassCopy} from './ApproximateMassCopy';
import type {OuterTnoObject} from './OuterTnoPanel';

function outer(fields:Record<string,string|number|null>={},diameter:number|null=null):OuterTnoObject{
  return {object_id:'sbdb-54199096',known_object_id:null,name:'(2014 SO363)',source_url:'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=54199096',source_manifest_sha256:'a'.repeat(64),source_fields:fields,physical:{diameter_km:diameter,mass_kg:null,density_g_cm3:null,rotation_period_h:null}} as OuterTnoObject;
}
const id='sbdb-54199096';
describe('separate assumption mass display',()=>{
  it('matches an analytic radius-1km sphere using SI volume, without overwriting the source',()=>{
    const source=outer({H:'14'},300),before=JSON.stringify(source);
    const result=approximateMass({objectId:id,radiusKm:1,radiusSourceUrl:'https://example.org/radius',outerObject:source});
    expect(result.kind).toBe('estimate');expect(result.diameter_source).toBe('physical_radius');
    // 4/3 pi r³ × 1000 kg/m³ for r=1000 m; independent high-precision decimal evaluation.
    expect(result.mass_kg!/4.1887902047863906e12).toBeCloseTo(1,14);
    expect(result.mass_earth!/7.013849580280519e-13).toBeCloseTo(1,14);
    expect(result.source_url).toBe('https://example.org/radius');expect(result.source_manifest_sha256).toBeNull();
    expect(JSON.stringify(source)).toBe(before);expect(source.physical.mass_kg).toBeNull();
  });
  it('uses H14 and explicit default pV=.1 with independently evaluated decimal expectations',()=>{
    const result=approximateMass({objectId:id,outerObject:outer({H:'14'})});
    // Decimal45-digit calculator: D=1329/sqrt(.1)*10^(-2.8), M=pi/6*1000*(D*1000)^3.
    expect(result.diameter_km!/6.660778334906449).toBeCloseTo(1,13);
    expect(result.mass_kg!/154729657830546.8).toBeCloseTo(1,13);
    expect(result.mass_earth!/2.590844832456993e-11).toBeCloseTo(1,13);
    expect(result.albedo).toBe(.1);expect(result.albedo_source).toBe('project_default');
    expect(result.density_kg_m3).toBe(1000);expect(result.algorithm_version).toBe('source-size-or-H-albedo-density-mass-v1');
    expect(result.source_manifest_sha256).toBe('a'.repeat(64));
  });
  it('uses a positive catalogue diameter before H, and sourced positive albedo before its project default',()=>{
    const sized=approximateMass({objectId:id,outerObject:outer({H:'14',albedo:'.4'},2)});
    expect(sized.diameter_km).toBe(2);expect(sized.diameter_source).toBe('catalogue_diameter');expect(sized.absolute_magnitude_h).toBeNull();
    const bright=approximateMass({objectId:id,outerObject:outer({H:'14',albedo:'.4'})});
    const dark=approximateMass({objectId:id,outerObject:outer({H:'14',albedo:'.1'})});
    expect(bright.albedo_source).toBe('catalogue');expect(bright.mass_kg!/dark.mass_kg!).toBeCloseTo(1/8,14);
    // Geometric albedo is not forcibly clipped at one.
    expect(approximateMass({objectId:id,outerObject:outer({H:'14',albedo:'1.2'})}).albedo).toBe(1.2);
  });
  it('keeps measured primary mass first, then exact-target explicit scenarios',()=>{
    const explicit={mass_earth:.001,mass_kg:5.97217e21,density_kg_m3:2000,radius_km:10,inputs:{target_id:id}};
    const measured=approximateMass({objectId:id,measuredPrimaryMassEarth:1,explicitMass:explicit,outerObject:outer({H:14})});
    expect(measured.kind).toBe('measured');expect(measured.mass_earth).toBe(1);expect(measured.mass_kg).toBe(5.97217e24);
    const custom=approximateMass({objectId:id,explicitMass:explicit,outerObject:outer({H:14})});
    expect(custom.kind).toBe('hypothesis');expect(custom.mass_kg).toBe(explicit.mass_kg);expect(custom.density_kg_m3).toBe(2000);
    const wrong=approximateMass({objectId:id,explicitMass:{...explicit,inputs:{target_id:'sedna'}},outerObject:outer({H:14})});
    expect(wrong.kind).toBe('estimate');expect(wrong.density_kg_m3).toBe(1000);
  });
  it('rejects stale catalogue responses while matching exact IDs and source aliases',()=>{
    const data=outer({H:'7.45'});
    expect(approximateMass({objectId:'sbdb-other',outerObject:data})).toMatchObject({kind:'unavailable',reason:'stale_object',mass_earth:null,mass_kg:null});
    expect(approximateMass({objectId:'sedna',outerObject:{...data,known_object_id:'sedna'}}).kind).toBe('estimate');
    expect(approximateMass({objectId:id,outerObject:data}).absolute_magnitude_h).toBe(7.45);
  });
  it('never converts missing, whitespace or invalid magnitude to zero, and preserves valid H=0',()=>{
    for(const H of [null,'',' ',NaN,Infinity,'NaN','Infinity','0x10']){
      const result=approximateMass({objectId:id,outerObject:outer({H})});
      expect(result).toMatchObject({kind:'unavailable',reason:'no_size_or_h',mass_kg:null,mass_earth:null});
    }
    for(const invalid of [undefined,null,'',' ',false,true,{},'0x10'])expect(finiteSourceNumber(invalid)).toBeNull();
    expect(finiteSourceNumber(' -.5e+2 ')).toBe(-50);
    expect(approximateMass({objectId:id,outerObject:outer({H:0})})).toMatchObject({kind:'estimate',absolute_magnitude_h:0});
  });
  it('fails closed for zero/negative sizes, overflow and underflow without inventing a mass',()=>{
    for(const radius of [0,-1,NaN,Infinity])expect(approximateMass({objectId:id,radiusKm:radius}).mass_kg).toBeNull();
    for(const H of [-1e6,1e6])expect(approximateMass({objectId:id,outerObject:outer({H})})).toMatchObject({kind:'unavailable',reason:'nonfinite_result',mass_kg:null,mass_earth:null});
    expect(approximateMass({objectId:id,radiusKm:Number.MAX_VALUE})).toMatchObject({kind:'unavailable',reason:'nonfinite_result'});
  });
  it('keeps all assumptions and unavailable reasons in five locales',()=>{
    const keys=Object.keys(approximateMassCopy('en')).sort();
    for(const locale of ['ko','en','ja','zh-Hant','fr']){
      const copy=approximateMassCopy(locale);expect(Object.keys(copy).sort()).toEqual(keys);
      for(const text of Object.values(copy))expect(text.trim().length).toBeGreaterThan(0);
      expect(copy.note).toContain('1000 kg/m³');
    }
    expect(APPROXIMATE_MASS_ALGORITHM).toBe('source-size-or-H-albedo-density-mass-v1');
  });
});
