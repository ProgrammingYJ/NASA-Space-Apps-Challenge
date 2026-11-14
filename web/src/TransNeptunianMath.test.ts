import {describe,it,expect} from 'vitest';
import {nearestTransNeptunianCandidate,transNeptunianDisplayRows,transNeptunianPosition,transNeptunianEpochRows,TNO_SUPPORTED_MIN_JD,TNO_SUPPORTED_MAX_JD,TNO_EXTRAPOLATION_WARNING_DAYS} from './TransNeptunianMath';
import fixture from '../../node/outer-tno.fixture.json';
import type {TransNeptunianPoint} from './TransNeptunianMath';
describe('identified trans-Neptunian display layer',()=>{
  const rows:TransNeptunianPoint[]=[{object_id:'sbdb-1',name:'known',known_object_id:'sedna',position_au:[80,0,0]},
    {object_id:'sbdb-2',name:'unknown surface',known_object_id:null,position_au:[500,0,0]},
    {object_id:'sbdb-3',name:'outside',known_object_id:null,position_au:[1001,0,0]},
    {object_id:'sbdb-4',name:'missing',known_object_id:null,position_au:null}];
  it('plots finite identified rows in1000AU and suppresses duplicates already represented by detailed bodies',()=>{
    const visible=transNeptunianDisplayRows([...rows,rows[1]],new Set(['sedna']));
    expect(visible.map(row=>row.object_id)).toEqual(['sbdb-2']);expect(visible[0].position_au).toEqual([500,0,0]);
    expect(visible[0].display_position[0]).toBeCloseTo(18*Math.log1p(500),12);
  });
  it('resolves marker overlap by pixel distance then depth and stable ID',()=>{
    const candidates=[{object_id:'b',x:10,y:10,depth:.5},{object_id:'a',x:10,y:10,depth:.5},{object_id:'behind',x:10,y:10,depth:2}];
    expect(nearestTransNeptunianCandidate(candidates,10,10)).toBe('a');
    expect(nearestTransNeptunianCandidate(candidates,30,30)).toBeNull();
    expect(nearestTransNeptunianCandidate([{object_id:'near',x:10,y:10,depth:.1},...candidates],10,10)).toBe('near');
  });
  it('matches three separate native-epoch Horizons reference states with the same model limits',()=>{
    for(const sample of fixture.checks){const result=transNeptunianPosition(sample.orbit,sample.epoch_jd_tdb);expect(result).not.toBeNull();expect(Math.hypot(...result!.map((v,i)=>v-sample.expected_position_au[i]))).toBeLessThan(1e-8);}
    const sample=fixture.checks[0];expect(transNeptunianPosition(sample.orbit,sample.epoch_jd_tdb+36526)).not.toBeNull();
    expect(transNeptunianPosition(sample.orbit,TNO_SUPPORTED_MIN_JD-1)).toBeNull();
    expect(transNeptunianPosition(sample.orbit,TNO_SUPPORTED_MAX_JD+1)).toBeNull();
  });
  it('reports missing and out-of-region rows separately and propagates rather than freezing a reference position',()=>{
    const source=fixture.checks[0],row={object_id:source.object_id,name:source.name,known_object_id:null,orbit:source.orbit,reference_position_au:source.expected_position_au as [number,number,number]};
    const now=transNeptunianEpochRows([row,{...row,object_id:'missing',orbit:null}],source.epoch_jd_tdb);
    expect(now.stats).toMatchObject({catalogue_count:2,plotted_count:1,unavailable_count:1,outside_1000_au_count:0});
    const later=transNeptunianEpochRows([row],source.epoch_jd_tdb+10);expect(later.rows[0].position_au).not.toEqual(now.rows[0].position_au);
  });
  it('keeps calculable TNOs across the Solar calendar and marks long-range extrapolation rather than dropping every row',()=>{
    const sample=fixture.checks[0],row={object_id:sample.object_id,name:sample.name,known_object_id:null,orbit:sample.orbit};
    for(const jd of [TNO_SUPPORTED_MIN_JD,800283.5,1721059.5,TNO_SUPPORTED_MAX_JD]){
      const result=transNeptunianEpochRows([row],jd);
      expect(result.stats.unavailable_count).toBe(0);expect(result.stats.extrapolated_count).toBe(1);
      expect(result.stats.plotted_count+result.stats.outside_1000_au_count).toBe(1);
      const calculated=transNeptunianPosition(sample.orbit,jd);expect(calculated?.every(Number.isFinite)).toBe(true);
      expect(calculated).not.toEqual(sample.expected_position_au);
      if(result.rows.length){expect(result.rows[0].position_status).toBe('unvalidated_kepler_extrapolation');expect(result.rows[0].long_range_extrapolation).toBe(true);}
    }
  });
  it('crosses the old100-year edge continuously while separating out-of1000AU from missing elements',()=>{
    const sample=fixture.checks[0],row={object_id:sample.object_id,name:sample.name,known_object_id:null,orbit:sample.orbit};
    const a=transNeptunianEpochRows([row],sample.epoch_jd_tdb-TNO_EXTRAPOLATION_WARNING_DAYS+.001),b=transNeptunianEpochRows([row],sample.epoch_jd_tdb-TNO_EXTRAPOLATION_WARNING_DAYS-.001);
    expect(a.stats.unavailable_count).toBe(0);expect(b.stats.unavailable_count).toBe(0);expect(a.stats.extrapolated_count).toBe(0);expect(b.stats.extrapolated_count).toBe(1);
    const far={...row,object_id:'far',orbit:{...sample.orbit,a_au:1500,e:0,M_deg:0}};
    const farResult=transNeptunianEpochRows([far,{...row,object_id:'unknown',orbit:null}],sample.epoch_jd_tdb);
    expect(farResult.stats).toMatchObject({catalogue_count:2,outside_1000_au_count:1,unavailable_count:1,plotted_count:0});
  });
});
