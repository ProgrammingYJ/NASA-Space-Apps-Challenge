import {it,expect} from 'vitest';
import {catalogSkyDirections,CATALOG_SKY_RADIUS,type CatalogSkyIndex} from './catalogSky';

const index=(objects:CatalogSkyIndex['objects']):CatalogSkyIndex=>({url:'https://science.nasa.gov/exoplanets/',raw_sha256:'a'.repeat(64),objects});
it('retains one original direction per actual host and ignores unusable rows without manufacturing a replacement field',()=>{
  const source=index([
    {object_id:'a-invalid',hostname:'Actual A',ra_deg:null,dec_deg:0},
    {object_id:'a-b',hostname:'Actual A',ra_deg:0,dec_deg:0},
    {object_id:'a-c',hostname:'Actual A',ra_deg:17,dec_deg:22},
    {object_id:'b-b',hostname:'Actual B',ra_deg:90,dec_deg:0},
    ...[NaN,Infinity,-1,360].map((ra_deg,i)=>({object_id:'invalid-ra-'+i,hostname:'Invalid RA '+i,ra_deg,dec_deg:0})),
    ...[NaN,Infinity,-91,91,null].map((dec_deg,i)=>({object_id:'invalid-dec-'+i,hostname:'Invalid Dec '+i,ra_deg:12,dec_deg})),
    {object_id:'blank',hostname:'   ',ra_deg:12,dec_deg:0},
  ]);
  const before=JSON.stringify(source);const stars=catalogSkyDirections(source);
  expect(stars.map(star=>[star.hostname,star.source_object_id])).toEqual([['Actual A','a-b'],['Actual B','b-b']]);
  expect(stars[0].catalog_ra_deg).toBe(0);expect(stars[0].catalog_dec_deg).toBe(0);
  expect(stars.every(star=>Math.abs(Math.hypot(...star.display_direction)-1)<1e-12)).toBe(true);
  expect(JSON.stringify(source)).toBe(before);expect(catalogSkyDirections(undefined)).toEqual([]);expect(catalogSkyDirections(index([]))).toEqual([]);
});
it('uses the declared fixed display rotation once and keeps directions independent of the chosen reference sphere radius',()=>{
  const stars=catalogSkyDirections(index([{object_id:'a',hostname:'A',ra_deg:0,dec_deg:0},{object_id:'b',hostname:'B',ra_deg:90,dec_deg:0},{object_id:'c',hostname:'C',ra_deg:0,dec_deg:90}]));
  expect(stars[0].display_direction).toEqual([1,0,-0]);
  const e=84381.448*Math.PI/(180*3600);
  expect(stars[1].display_direction[1]).toBeCloseTo(-Math.sin(e),12);expect(stars[1].display_direction[2]).toBeCloseTo(-Math.cos(e),12);
  expect(stars[2].display_direction[1]).toBeCloseTo(Math.cos(e),12);expect(stars[2].display_direction[2]).toBeCloseTo(-Math.sin(e),12);
  expect(Math.hypot(...stars[1].display_direction.map(n=>n*CATALOG_SKY_RADIUS))).toBeCloseTo(1800,9);
});
