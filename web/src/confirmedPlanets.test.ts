import {it,expect} from 'vitest';
import {confirmedPlanetRows} from './confirmedPlanets';
it('keeps confirmed listing identity and unknown geometry without manufacturing coordinates',()=>{
  const objects=confirmedPlanetRows({planet_count:2,host_count:2,url:'https://science.nasa.gov',objects:[{object_id:'actual-a',name:'Actual a',hostname:'Actual',ra_deg:12,dec_deg:-20},{object_id:'actual-b',name:'Actual b',hostname:'Another',ra_deg:null,dec_deg:null}]});
  expect(objects.map(o=>o.object_id)).toEqual(['actual-a','actual-b']);
  expect(objects[0].coordinate?.role).toBe('host_catalog_direction_reference');
  expect(objects[1].coordinate).toBeNull();
  expect(objects.every(o=>o.distance_pc===null)).toBe(true);
  expect(confirmedPlanetRows(undefined)).toEqual([]);
});
