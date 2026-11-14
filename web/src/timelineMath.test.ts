import {describe,expect,it} from 'vitest';
import source from '../../data/manifests/solar_system_ephemeris.json';
import validation from '../../data/manifests/timeline_validation.json';
import {advancePlayback,epochText,hermite,timelineBounds,timelineScene,type TimelineData} from './timelineMath';
import type {UniverseData,OrbitGuide} from './UniverseScene';
import type {Vec3} from './sceneMath';

// Original source values, rather than copies of interpolation outputs. The TDB
// knots below are Astropy UTC→TDB conversion results, checked by Python tests.
const tdb=[2461357.500800726,2461358.500800726,2461359.5008007265,2461360.5008007265];
const epochs=source.sample_epochs_utc;
const data:TimelineData={schema_version:'1.0',algorithm_version:'display-hermite-v1',start_epoch:epochs[0],end_epoch:epochs[3],default_epoch:epochs[1],guide_reference_epoch:epochs[1],source_manifest_sha256:'fixture',timeline_validation_sha256:null,limitations:[],
  knots:epochs.map((epoch,index)=>({epoch,tdb_jd:tdb[index],states:Object.fromEntries(source.bodies.map(body=>[body.object_id,{position_au:body.samples[index].position_au as Vec3,velocity_au_day:body.samples[index].velocity_au_day as Vec3}])),directions:{'epsilon-indi-b':{direction_ecliptic:[1,index*0.00001,0],direction_icrs_deg:{ra:359.99+index*0.01,dec:0}}}}))};
const orbit:OrbitGuide={kind:'osculating_kepler_guide',epoch:epochs[1],points_au:[[1,0,0],[0,1,0],[1,0,0]],source:{url:'https://ssd.jpl.nasa.gov/horizons/'}};
const base:UniverseData={epoch:epochs[1],coordinate_frame:'Ecliptic J2000',objects:[{object_id:'sun',name:'Sun',kind:'solar_system',position_au:[0,0,0]},...source.bodies.map(body=>({object_id:body.object_id,name:body.name,kind:'solar_system' as const,position_au:body.samples[1].position_au as Vec3,orbit})),{object_id:'epsilon-indi-b',name:'ε Indi B',kind:'direction',direction_ecliptic:[1,0,0],distance_au:null}]};

describe('bounded model playback and actual source interpolation',()=>{
  it('uses model hours per real second and clamps the final frame without overshoot',()=>{
    const bounds={start:0,end:72*3600000};
    expect(advancePlayback(0,100,1,bounds).epoch).toBe(360000);
    expect(advancePlayback(0,100,6,bounds).epoch).toBe(2160000);
    expect(advancePlayback(0,100,24,bounds).epoch).toBe(8640000);
    expect(advancePlayback(bounds.end-1,100,24,bounds)).toEqual({epoch:bounds.end,ended:true});
    expect(advancePlayback(0,60000,6,bounds)).toEqual(advancePlayback(0,100,6,bounds));
    expect(advancePlayback(0,-1,6,bounds).epoch).toBe(0);
    expect(()=>advancePlayback(NaN,10,6,bounds)).toThrow();
  });
  it('reproduces an independently defined cubic and derivative with a non-unit day interval',()=>{
    const p=(t:number):Vec3=>[1+2*t+3*t*t+4*t**3,-3+t*t,7-5*t];
    const v=(t:number):Vec3=>[2+6*t+12*t*t,2*t,-5];
    const result=hermite(p(0),v(0),p(2),v(2),.3,2);
    result.position.forEach((value,i)=>expect(value).toBeCloseTo(p(.6)[i],12));
    result.velocity.forEach((value,i)=>expect(value).toBeCloseTo(v(.6)[i],12));
    expect(()=>hermite(p(0),v(0),p(2),v(2),1.01,2)).toThrow();
    expect(()=>hermite(p(0),v(0),p(2),v(2),.5,0)).toThrow();
  });
  it('retains every original endpoint position and leaves source/guide objects unchanged',()=>{
    const original=JSON.stringify(base);const knots=JSON.stringify(data);
    for(const knot of data.knots){
      const scene=timelineScene(base,data,Date.parse(knot.epoch));
      for(const body of scene.objects.filter(b=>b.kind==='solar_system'&&b.object_id!=='sun')){
        expect(body.position_au).toEqual(knot.states[body.object_id].position_au);
        expect(body.position_kind).toBe('geometric_ephemeris_sample');
        expect(body.orbit).toBe(orbit);
      }
      expect(scene.objects[0].position_au).toEqual([0,0,0]);
      expect(scene.objects.at(-1)?.distance_au).toBeNull();
      expect(scene.objects.at(-1)?.direction_ecliptic).toEqual(knot.directions['epsilon-indi-b'].direction_ecliptic);
    }
    expect(JSON.stringify(base)).toBe(original);expect(JSON.stringify(data)).toBe(knots);
  });
  it('checks 27 non-knot positions against separate original Horizons midpoint queries',()=>{
    for(const row of validation.results)for(const check of row.checks){
      const scene=timelineScene(base,data,Date.parse(check.epoch));
      const body=scene.objects.find(body=>body.object_id===row.object_id)!;
      const km=Math.hypot(...body.position_au!.map((value,i)=>(value-check.actual_position_au[i])*149597870.700));
      // A tested discrepancy allowance, not a general ephemeris uncertainty.
      expect(km).toBeLessThan(19.1);
      expect(body.position_kind).toBe('interpolated_ephemeris');
      expect(body.orbit).toBe(orbit);
      expect(body.orbit?.epoch).toBe(epochs[1]);
    }
  });
  it('normalizes a direction without assigning a distance and rejects extrapolation/version drift',()=>{
    const bounds=timelineBounds(data);const scene=timelineScene(base,data,bounds.start+3600000);
    const direction=scene.objects.at(-1)!;
    expect(Math.hypot(...direction.direction_ecliptic!)).toBeCloseTo(1,14);
    expect(direction.distance_au).toBeNull();expect(direction.position_au).toBeUndefined();
    expect(scene.epoch).toBe(epochText(bounds.start+3600000));
    expect(()=>timelineScene(base,data,bounds.start-1)).toThrow();
    expect(()=>timelineScene(base,data,bounds.end+1)).toThrow();
    expect(()=>timelineScene(base,{...data,algorithm_version:'old' as TimelineData['algorithm_version']},bounds.start)).toThrow();
  });
});
