import {describe,it,expect} from 'vitest';
import {modelDateMs,modelDateParts,simulationPosition,parseModelDateDraft,simulationScene,simulationMoonMetadata,type LongTermModel} from './longTermMath';
import {EARTH_MOON_OFFSET_SCALE,MOON_SIMULATION_ALGORITHM} from './moonKepler';
import type {ExtendedObject} from './extendedMath';
import type {UniverseData} from './UniverseScene';
import fixture from './longTermParity.fixture.json';
describe('TDB calendar labels and Kepler simulation',()=>{
  it('accepts year zero and negative date drafts without treating an unfinished field as zero',()=>{
    expect(parseModelDateDraft({year:'0',month:'11',day:'14'})).toEqual({year:0,month:11,day:14});
    expect(parseModelDateDraft({year:'-2999',month:'1',day:'1'})).toEqual({year:-2999,month:1,day:1});
    for(const year of ['','-','1.5','NaN','Infinity'])expect(()=>parseModelDateDraft({year,month:'1',day:'1'})).toThrow();
    expect(()=>parseModelDateDraft({year:'2000',month:'',day:'1'})).toThrow();
    expect(()=>parseModelDateDraft({year:'1900',month:'2',day:'29'})).toThrow();
  });
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

describe('parent-relative Moon approximations in the long-term scene',()=>{
  const model=fixture.model as LongTermModel;
  const base:UniverseData={epoch:'2026-11-14T00:00:00Z',coordinate_frame:'Ecliptic of J2000.0',objects:[
    {object_id:'sun',name:'Sun',kind:'solar_system',radius_km:695700,position_au:[0,0,0]},
    ...model.tables.long.bodies.map(record=>({object_id:record.object_id==='earth-moon-barycenter'?'earth':record.object_id,name:record.object_id,kind:'solar_system' as const,radius_km:record.object_id==='saturn'?58232:6371,position_au:[1,2,3] as [number,number,number]})),
    {object_id:'pluto',name:'Pluto',kind:'dwarf_planet',radius_km:1188.3,position_au:[30,0,0]},
    {object_id:'moon-606',name:'Titan',kind:'moon',parent_id:'saturn',radius_km:2574.76,position_au:[30,1,2],
      radius_source:{url:'https://ssd.jpl.nasa.gov/sats/phys_par/',definition:'Mean radius of volume-equivalent sphere',uncertainty_km:.02}},
  ]};
  function sourceUrl(center:string,plane='ECLIPTIC'){
    return 'https://ssd.jpl.nasa.gov/api/horizons.api?'+new URLSearchParams({EPHEM_TYPE:"'VECTORS'",REF_PLANE:`'${plane}'`,REF_SYSTEM:"'ICRF'",OUT_UNITS:"'AU-D'",VEC_CORR:"'NONE'",CENTER:`'500@${center}'`});
  }
  const titan:ExtendedObject={object_id:'moon-606',name:'Titan',kind:'moon',parent_id:'saturn',status:'available',radius_km:2574.76,period_days:15.945448,
    source:{url:sourceUrl('699'),sha256:'dff9590ff287ac28296728910274b9a16cf5fa9d24aae534a10aaa825ee7e235'},
    knots:[{epoch:'2026-11-13T00:00:00Z',tdb_jd:2461357.500800726,
      position_au:[.000240211872651548,-.007213669767532534,.003695603884869861],
      velocity_au_day:[.003223765759439939,.00003512534319663326,-.0003387797465696696]}]};
  const moon:ExtendedObject={object_id:'moon-301',name:'Moon',kind:'moon',parent_id:'earth',status:'available',radius_km:1737.4,
    source:{url:sourceUrl('399'),sha256:'a37e7bddb372520f09941aec1f6d73788bce6d887adc76a53aebb0034ede6846'},
    knots:[{epoch:'2026-11-13T00:00:00Z',tdb_jd:2461357.500800726,
      position_au:[.00006487543928800212,-.002702030522195708,-.0001907201554865963],
      velocity_au_day:[.0005593080952028699,.000006475207938530518,.00002857364685472215]}]};
  const catalogue=(objects:ExtendedObject[])=>({objects,source_manifest_sha256:'a'.repeat(64)});
  it('preserves the original three-argument behavior without freezing old Moon or Pluto positions',()=>{
    const result=simulationScene(base,model,modelDateMs(1371));
    expect(result.objects).toHaveLength(9);expect(result.objects.some(body=>body.kind==='moon'||body.object_id==='pluto')).toBe(false);
    expect(result.moon_simulation.status).toBe('source_catalogue_missing');expect(result.moon_simulation.added_count).toBe(0);
  });
  it('reconstructs a real source offset, preserves physical radius/source and reports an unvalidated model',()=>{
    const ms=(titan.knots![0].tdb_jd-2440587.5)*86400000,copy=structuredClone(base);
    const result=simulationScene(base,model,ms,{sourceUniverse:base,extendedCatalogue:catalogue([titan])});
    const parent=result.objects.find(body=>body.object_id==='saturn')!,body=result.objects.find(body=>body.object_id==='moon-606')!;
    body.parent_relative_position_au!.forEach((value,i)=>expect(value).toBeCloseTo(titan.knots![0].position_au[i],14));
    body.position_au!.forEach((value,i)=>expect(value-parent.position_au![i]).toBeCloseTo(titan.knots![0].position_au[i],13));
    expect(body.radius_km).toBe(2574.76);expect(body.radius_source).toEqual(base.objects.find(row=>row.object_id==='moon-606')!.radius_source);
    expect(body.kind).toBe('moon');expect(body.body_class).toBeUndefined();expect(body.position_kind).toBe('osculating_kepler_extrapolation');
    expect(simulationMoonMetadata(body)).toMatchObject({algorithm_version:MOON_SIMULATION_ALGORITHM,status:'unvalidated_two_body_extrapolation',
      source_epoch_jd_tdb:2461357.500800726,gm_km3_s2:37940584.8418,position_reference:'parent_body_center',new_classification:null,propagated_position_uncertainty:null,long_term_accuracy_verified:false});
    expect(body.orbit?.points_au).toHaveLength(129);expect(body.orbit?.closed).toBe(true);
    expect(result.moon_simulation).toMatchObject({source_moon_count:1,added_count:1,omitted:[],source_manifest_sha256:'a'.repeat(64)});
    expect(base).toEqual(copy);
  });
  it('keeps source-supported moons moving at 1371, 1895, 2014, 2233, 2529 and 3000',()=>{
    const rows=[1371,1895,2014,2233,2529,3000].map(year=>simulationScene(base,model,modelDateMs(year),{extendedCatalogue:catalogue([titan,moon])}));
    for(const result of rows){
      expect(result.moon_simulation.added_count).toBe(2);
      for(const id of ['moon-606','moon-301'])expect(result.objects.find(body=>body.object_id===id)!.position_au!.every(Number.isFinite)).toBe(true);
    }
    const first=rows[0].objects.find(body=>body.object_id==='moon-606')!,later=rows[1].objects.find(body=>body.object_id==='moon-606')!;
    expect(first.position_au).not.toEqual(base.objects.find(body=>body.object_id==='moon-606')!.position_au);
    expect(first.parent_relative_position_au).not.toEqual(later.parent_relative_position_au);
    expect(first.orbit).toBe(later.orbit); // the same source-epoch ellipse, not repeated geometry generation
  });
  it('retains the fitted EMB parent and converts the geocentric Moon offset explicitly',()=>{
    const ms=(moon.knots![0].tdb_jd-2440587.5)*86400000,result=simulationScene(base,model,ms,{extendedCatalogue:catalogue([moon])});
    const body=result.objects.find(row=>row.object_id==='moon-301')!,earth=result.objects.find(row=>row.object_id==='earth')!;
    const earthModel=model.tables.long.bodies.find(record=>['earth','earth-moon-barycenter'].includes(record.object_id))!;
    expect(earth.position_au).toEqual(simulationPosition(earthModel,ms));
    body.parent_relative_position_au!.forEach((value,i)=>expect(value).toBeCloseTo(moon.knots![0].position_au[i]*EARTH_MOON_OFFSET_SCALE,14));
    expect(simulationMoonMetadata(body)).toMatchObject({source_position_reference:'parent_body_center',position_reference:'earth_moon_barycenter',display_offset_scale:EARTH_MOON_OFFSET_SCALE});
  });
  it('leaves absent parents, unsupported sources and missing states unavailable with reasons',()=>{
    const invalidFrame={...titan,object_id:'moon-frame',source:{...titan.source!,url:sourceUrl('699','FRAME')}};
    const missing={...titan,object_id:'moon-no-state',knots:[]};
    const unsupported={...titan,object_id:'moon-unavailable',status:'ephemeris_unavailable'};
    const pluto={...titan,object_id:'moon-901',parent_id:'pluto'};
    const result=simulationScene(base,model,modelDateMs(1895),{extendedCatalogue:catalogue([titan,titan,invalidFrame,missing,unsupported,pluto])});
    expect(result.moon_simulation.source_moon_count).toBe(5);expect(result.moon_simulation.added_count).toBe(1);
    expect(result.moon_simulation.omitted).toEqual([
      {object_id:'moon-frame',parent_id:'saturn',reason:'invalid_source_frame_or_center'},
      {object_id:'moon-no-state',parent_id:'saturn',reason:'missing_or_unbound_source_state'},
      {object_id:'moon-unavailable',parent_id:'saturn',reason:'source_unavailable'},
      {object_id:'moon-901',parent_id:'pluto',reason:'missing_parent'},
    ]);
    expect(result.objects.filter(body=>body.kind==='moon').map(body=>body.object_id)).toEqual(['moon-606']);
  });
});
