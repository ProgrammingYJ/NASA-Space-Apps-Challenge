import {describe,expect,it} from 'vitest';
import {modelDateMs,simulationScene,type LongTermModel,type SimulationTnoCatalogue,type NativeTnoSimulationMetadata} from './longTermMath';
import type {UniverseBody,UniverseData} from './UniverseScene';
import type {ExtendedObject} from './extendedMath';
import fixture from './longTermParity.fixture.json';

// Synthetic circular elements exercise the scene/source contract analytically;
// they are deliberately not presented as a real orbit determination for Eris.
const model=fixture.model as LongTermModel;
const radiusSource={url:'https://www.eso.org/public/news/eso1142/',definition:'unit-test native radius metadata',uncertainty_km:6};
const base:UniverseData={epoch:'2026-11-14T00:00:00Z',coordinate_frame:'Ecliptic of J2000.0',objects:[
  {object_id:'sun',name:'Sun',kind:'solar_system',radius_km:695700,position_au:[0,0,0]},
  ...model.tables.long.bodies.map(record=>({object_id:record.object_id==='earth-moon-barycenter'?'earth':record.object_id,name:record.object_id,kind:'solar_system' as const,radius_km:6371,position_au:[1,2,3] as [number,number,number]})),
  {object_id:'eris',name:'Native Eris name',kind:'dwarf_planet',parent_id:'sun',radius_km:1163,radius_source:radiusSource,position_au:[90,1,2]},
]};
const orbit={a_au:40,e:0,i_deg:0,omega_deg:0,Omega_deg:0,M_deg:0,epoch_jd_tdb:2461200.5};
const row={object_id:'sbdb-20136199',spkid:'20136199',name:'source display name',known_object_id:'eris',orbit,reference_position_au:[40,0,0] as [number,number,number],reference_radius_au:40,semimajor_axis_au:40,perihelion_au:40,aphelion_au:40};
const catalogue:SimulationTnoCatalogue={algorithm_version:'jpl-sbdb-tno-two-body-v2',source_manifest_sha256:'a'.repeat(64),
  source:{url:'https://ssd-api.jpl.nasa.gov/sbdb_query.api?sb-class=TNO',sha256:'b'.repeat(64)},reference_jd_tdb:2461358.500800726,
  coordinate_frame:'heliocentric_IAU76_80_ecliptic_J2000',time_scale:'TDB',position_unit:'au',objects:[row]};
const native=(objects:UniverseBody[])=>objects.find(body=>body.object_id==='eris') as UniverseBody&{native_tno_simulation:NativeTnoSimulationMetadata};

describe('source-pinned native TNOs in past/future simulation scenes',()=>{
  it('keeps native centres at 1371, 2035 and 3000 without replacing radii, duplicating IDs or changing the eight planet fits',()=>{
    const original=structuredClone(base),source=structuredClone(catalogue),positions=[];
    for(const year of [1371,2035,3000]){
      const ms=modelDateMs(year),plain=simulationScene(base,model,ms),scene=simulationScene(base,model,ms,{outerTnoCatalogue:{...catalogue,objects:[row,row]}}),body=native(scene.objects);
      expect(scene.objects.filter(body=>body.object_id==='eris')).toHaveLength(1);
      expect(scene.objects.filter(body=>body.object_id!=='eris')).toEqual(plain.objects);
      expect(body.name).toBe('Native Eris name');expect(body.kind).toBe('dwarf_planet');expect(body.radius_km).toBe(1163);expect(body.radius_source).toBe(radiusSource);
      expect(body.position_au!.every(Number.isFinite)).toBe(true);expect(body.position_au).not.toEqual(base.objects.at(-1)!.position_au);positions.push(body.position_au);
      expect(body.native_tno_simulation).toMatchObject({source_object_id:'sbdb-20136199',source_spkid:'20136199',known_object_id:'eris',source_manifest_sha256:'a'.repeat(64),source_snapshot_sha256:'b'.repeat(64),source_epoch_jd_tdb:2461200.5,jd_tdb:ms/86400000+2440587.5,propagated_position_uncertainty:null,new_classification:null,long_term_accuracy_verified:false});
      expect(body.native_tno_simulation.long_range_extrapolation).toBe(year!==2035);
      expect(body.orbit?.points_au).toHaveLength(129);expect(body.orbit?.epoch_tdb_jd).toBe(2461200.5);
      expect(scene.native_tno_simulation.added_count).toBe(1);
    }
    expect(positions[0]).not.toEqual(positions[1]);expect(positions[1]).not.toEqual(positions[2]);expect(base).toEqual(original);expect(catalogue).toEqual(source);
    // Pluto's original native universe record uses the generic solar_system
    // rendering kind. Preserve that metadata rather than requiring a new kind.
    const pluto:UniverseBody={object_id:'pluto',name:'Pluto',kind:'solar_system',radius_km:1188.3,position_au:[30,0,0]};
    const plutoRow={...row,object_id:'sbdb-20134340',spkid:'20134340',known_object_id:'pluto'};
    const withPluto=simulationScene({...base,objects:[...base.objects,pluto]},model,modelDateMs(1371),{outerTnoCatalogue:{...catalogue,objects:[plutoRow]}});
    expect(withPluto.objects.find(body=>body.object_id==='pluto')).toMatchObject({kind:'solar_system',radius_km:1188.3});
  });
  it('uses the selected TDB phase, independently matching a circular quarter orbit and the source epoch periapsis',()=>{
    const mu=1.32712440041279419e20*86400**2/149597870700**3,quarterDays=Math.PI/(2*Math.sqrt(mu/40**3));
    const at=(jd:number)=>native(simulationScene(base,model,(jd-2440587.5)*86400000,{outerTnoCatalogue:catalogue}).objects);
    expect(at(orbit.epoch_jd_tdb).position_au).toEqual([40,0,0]);
    const quarter=at(orbit.epoch_jd_tdb+quarterDays);
    expect(quarter.position_au![0]).toBeCloseTo(0,8);expect(quarter.position_au![1]).toBeCloseTo(40,10);expect(quarter.position_au![2]).toBe(0);
    expect(quarter.native_tno_simulation.status).toBe('osculating_two_body_prediction');
  });
  it('fails closed for wrong frame/time/source/identity/elements instead of freezing a source position or inserting the Sun origin',()=>{
    const badSources=[{coordinate_frame:'ICRS'},{time_scale:'UTC'},{position_unit:'km'},{algorithm_version:'unknown'},
      {source_manifest_sha256:'not-a-sha'},{source:{...catalogue.source,url:'https://example.com/sbdb_query.api?sb-class=TNO'}}];
    for(const change of badSources){
      const scene=simulationScene(base,model,modelDateMs(1371),{outerTnoCatalogue:{...catalogue,...change}});
      expect(native(scene.objects)).toBeUndefined();expect(scene.native_tno_simulation.status).toBe('invalid_source_contract');
    }
    for(const invalid of [{...row,spkid:'20134340'},{...row,object_id:'sbdb-20134340'},
      {...row,orbit:{...orbit,M_deg:NaN}},{...row,orbit:{...orbit,epoch_jd_tdb:0}},{...row,orbit:null}]){
      const scene=simulationScene(base,model,modelDateMs(1371),{outerTnoCatalogue:{...catalogue,objects:[invalid]}});
      expect(native(scene.objects)).toBeUndefined();expect(scene.native_tno_simulation.omitted).toHaveLength(1);
    }
    const noMetadata=simulationScene({...base,objects:base.objects.filter(body=>body.object_id!=='eris')},model,modelDateMs(1371),{outerTnoCatalogue:catalogue});
    expect(native(noMetadata.objects)).toBeUndefined();expect(noMetadata.native_tno_simulation.omitted[0].reason).toBe('missing_native_metadata');
  });
});

describe('the one explicitly pinned native Ceres solar state',()=>{
  const sourceUrl='https://ssd.jpl.nasa.gov/api/horizons.api?'+new URLSearchParams({COMMAND:"'1;'",CENTER:"'500@10'",EPHEM_TYPE:"'VECTORS'",REF_PLANE:"'ECLIPTIC'",REF_SYSTEM:"'ICRF'",OUT_UNITS:"'AU-D'",VEC_CORR:"'NONE'",TIME_TYPE:"'UT'"});
  const ceres:ExtendedObject&{horizons_id:string;position_reference:string}={object_id:'ceres',horizons_id:'1;',name:'Ceres',kind:'dwarf_planet',parent_id:'sun',status:'available',position_reference:'parent_body_center',radius_km:469.7,
    source:{url:sourceUrl,sha256:'6851c4fd5c5389db14ca85944dd7a93c676fa3181a726845af13e3dfd0852d82'},
    knots:[{epoch:'2026-11-13T00:00:00Z',tdb_jd:2461357.500800726,position_au:[-.1725469505405003,2.633204098011663,.1151447128281014],velocity_au_day:[-.01054883252225362,-.001489279927441237,.001896015718784405]}]};
  const nativeCeres:UniverseBody={object_id:'ceres',name:'Native Ceres',kind:'dwarf_planet',parent_id:'sun',position_au:[-1,2,0],radius_km:469.7};
  const sourceBase={...base,objects:[...base.objects,nativeCeres]};
  const records=(record:ExtendedObject)=>({source_manifest_sha256:'c'.repeat(64),objects:[record]});
  it('reconstructs the saved TDB state, preserves the separate UTC label and remains finite across the model calendar',()=>{
    const knot=ceres.knots![0],atEpoch=simulationScene(sourceBase,model,(knot.tdb_jd-2440587.5)*86400000,{extendedCatalogue:records(ceres)});
    const body=atEpoch.objects.find(body=>body.object_id==='ceres')!;
    body.position_au!.forEach((value,index)=>expect(value).toBeCloseTo(knot.position_au[index],11));
    expect(body.radius_km).toBe(469.7);expect(body.name).toBe('Native Ceres');
    expect(atEpoch.ceres_simulation.metadata).toMatchObject({source_epoch_jd_tdb:2461357.500800726,source_epoch_utc_label:knot.epoch,position_reference:'sun_body_center',gm_m3_s2:1.32712440041279419e20,long_term_accuracy_verified:false});
    const utcCalendar=simulationScene(sourceBase,model,Date.parse(knot.epoch),{extendedCatalogue:records(ceres)}).objects.find(body=>body.object_id==='ceres')!;
    expect(Math.hypot(...utcCalendar.position_au!.map((value,index)=>value-knot.position_au[index]))).toBeGreaterThan(1e-7);
    for(const year of [1371,2035,3000]){
      const result=simulationScene(sourceBase,model,modelDateMs(year),{extendedCatalogue:records(ceres)}),ceresBody=result.objects.find(body=>body.object_id==='ceres')!;
      expect(result.ceres_simulation.added_count).toBe(1);expect(ceresBody.position_au!.every(Number.isFinite)).toBe(true);expect(ceresBody.radius_km).toBe(469.7);
      expect(ceresBody.position_au).not.toEqual(knot.position_au);expect(ceresBody.orbit?.source.sha256).toBe(ceres.source!.sha256);
    }
  });
  it('never generalizes the Sun-parent branch or accepts a different identity, response hash, frame or missing source state',()=>{
    for(const record of [
      {...ceres,object_id:'other-solar-body'},
      {...ceres,horizons_id:'2;'},
      {...ceres,source:{...ceres.source!,sha256:'f'.repeat(64)}},
      {...ceres,source:{...ceres.source!,url:sourceUrl.replace('ICRF','FK4')}},
      {...ceres,knots:[]},
    ]){
      const result=simulationScene(sourceBase,model,modelDateMs(1371),{extendedCatalogue:records(record)});
      expect(result.objects.some(body=>body.object_id==='ceres')).toBe(false);expect(result.ceres_simulation.added_count).toBe(0);
    }
  });
});
