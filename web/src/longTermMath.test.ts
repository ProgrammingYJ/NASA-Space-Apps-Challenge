import {describe,it,expect} from 'vitest';
import {modelDateMs,modelDateParts,simulationPosition} from './longTermMath';
import fixture from './longTermParity.fixture.json';
describe('TDB calendar labels and Kepler simulation',()=>{
  it('handles astronomical years 0..99 without Date.UTC century remapping',()=>{
    for(const year of [-2999,-1,0,1,99,100,2000,3000])expect(modelDateParts(modelDateMs(year,1,1))).toEqual({year,month:1,day:1});
    expect(modelDateMs(2000,1,1)/86400000+2440587.5).toBe(2451544.5);
    expect(modelDateMs(0,3,1)-modelDateMs(0,2,28)).toBe(2*86400000);
    expect(()=>modelDateMs(1900,2,29)).toThrow();expect(()=>modelDateMs(2000,2,29)).not.toThrow();
  });
  it('has analytic circular and eccentric periapsis states with a nontrivial node rotation',()=>{
    const ms=modelDateMs(2000,1,1)+43200000;
    const circular={object_id:'test',elements_j2000:[2,0,0,90,0,0],rates_per_century:[0,0,0,0,0,0],additional_terms:{b:0,c:0,s:0,f:0}};
    const p=simulationPosition(circular,ms);expect(p[0]).toBeCloseTo(0,12);expect(p[1]).toBeCloseTo(2,12);expect(p[2]).toBe(0);
    const eccentric=simulationPosition({...circular,elements_j2000:[2,.25,90,90,90,90]},ms);
    expect(eccentric[0]).toBeCloseTo(0,12);expect(eccentric[1]).toBeCloseTo(1.5,12);expect(eccentric[2]).toBeCloseTo(0,12);
  });
  it('matches Python calendar arithmetic and 80 vectors across BCE, year 0 and future dates',()=>{
    for(const sample of fixture.cases){
      const date=sample.calendar_date,ms=modelDateMs(date.year,date.month,date.day)+date.hour*3600000;
      expect(ms).toBe(sample.calendar_ms);expect(ms/86400000+2440587.5).toBe(sample.jd_tdb);
      for(const expected of sample.objects){
        const body=fixture.model.tables.long.bodies.find(b=>b.object_id===expected.object_id)!;
        const position=simulationPosition(body,ms);
        position.forEach((v,i)=>expect(v).toBeCloseTo(expected.position_au[i],11));
      }
    }
  });
});
