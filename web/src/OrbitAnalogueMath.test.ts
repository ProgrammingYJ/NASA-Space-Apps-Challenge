import {describe,expect,it} from 'vitest';
import {rankOrbitAnalogues,TNO_ELEMENT_FRAME,type AnalogueObject,type AnalogueElements} from './OrbitAnalogueMath';
import {orbitAnalogueCopy} from './OrbitAnalogueCopy';
const hypothesis={a_au:500,e:.4,i_deg:30,epoch_jd_tdb:2458270};
const source={coordinate_frame:TNO_ELEMENT_FRAME,time_scale:'TDB',source_manifest_sha256:'a'.repeat(64)};
const object=(id:string,changes:Partial<AnalogueElements>={}):AnalogueObject=>({object_id:id,name:id,spkid:id.replace('sbdb-',''),pdes:'2015 AB1',known_object_id:null,orbit:{...hypothesis,...changes}});
describe('source-epoch exploratory TNO element comparison',()=>{
  it('calculates each difference independently and keeps original identity and epochs without propagating phase',()=>{
    const row=object('sbdb-12',{a_au:550,e:.5,i_deg:48,epoch_jd_tdb:2461200.5});
    const before=JSON.stringify(row),result=rankOrbitAnalogues(hypothesis,[row],source),match=result.rows[0];
    expect(result.status).toBe('ready');expect(match.relative_a_difference).toBeCloseTo(.1,14);expect(match.eccentricity_difference).toBeCloseTo(.1,14);expect(match.inclination_difference_deg).toBe(18);expect(match.score).toBeCloseTo(.3,14);
    expect(match.object).toBe(row);expect(match.object.spkid).toBe('12');expect(match.object.orbit?.epoch_jd_tdb).toBe(2461200.5);expect(JSON.stringify(row)).toBe(before);expect(hypothesis.epoch_jd_tdb).toBe(2458270);
  });
  it('reports missing elements, invalid elements and absent epoch separately without substituting zeros',()=>{
    const rows=[{...object('sbdb-1'),orbit:null},object('sbdb-2',{a_au:0}),object('sbdb-3',{epoch_jd_tdb:null as unknown as number}),object('sbdb-4',{e:NaN}),object('sbdb-5')];
    const result=rankOrbitAnalogues(hypothesis,rows,source);expect(result.input_count).toBe(5);expect(result.compared_count).toBe(1);expect(result.excluded).toEqual({missing_elements:1,invalid_elements:2,invalid_epoch:1});expect(result.rows[0].object.object_id).toBe('sbdb-5');
  });
  it('rejects unsupported frame/time or absent provenance and invalid hypothesis rather than reporting a match',()=>{
    for(const change of [{coordinate_frame:'ICRS'},{time_scale:'UTC'},{source_manifest_sha256:''}])expect(rankOrbitAnalogues(hypothesis,[object('sbdb-1')],{...source,...change}).status).toBe('unsupported_source');
    expect(rankOrbitAnalogues({...hypothesis,a_au:NaN},[object('sbdb-1')],source).status).toBe('invalid_hypothesis');
    expect(rankOrbitAnalogues({...hypothesis,epoch_jd_tdb:null as unknown as number},[],source).status).toBe('invalid_hypothesis');
  });
  it('caps the result at ten with deterministic ties; identical a/e/i does not test uncertainty or identity',()=>{
    const rows=Array.from({length:12},(_,i)=>object('sbdb-'+String(i).padStart(2,'0'))).reverse(),result=rankOrbitAnalogues(hypothesis,rows,source,99);
    expect(result.rows).toHaveLength(10);expect(result.compared_count).toBe(12);expect(result.rows[0].object.object_id).toBe('sbdb-00');expect(result.rows.every(row=>row.score===0)).toBe(true);expect(rankOrbitAnalogues(hypothesis,[],source).rows).toEqual([]);
  });
  it('provides the same explanatory and error keys in all five languages',()=>{
    const keys=Object.keys(orbitAnalogueCopy('en')).sort();for(const language of ['ko','en','ja','zh-Hant','fr']){const copy=orbitAnalogueCopy(language);expect(Object.keys(copy).sort()).toEqual(keys);expect(Object.values(copy).every(value=>typeof value==='string'&&value.length>0)).toBe(true);}
  });
});
