import {describe,it,expect} from 'vitest';
import {tangentProjection,catalogPoint,type UniverseCatalogObject} from './universeCatalogMath';
describe('sky projection preserves measured directions, not guessed depth',()=>{
  it('wraps RA at zero and centers exact coordinates',()=>{
    expect(tangentProjection(359.99,30,359.99,30)).toEqual([0,0]);
    const p=tangentProjection(.01,30,359.99,30)!;
    expect(p[0]).toBeGreaterThan(0);expect(p[0]).toBeLessThan(.02);expect(Math.abs(p[1])).toBeLessThan(.00001);
    expect(tangentProjection(180,0,0,0)).toBeNull();
  });
  it('keeps missing and invalid individual coordinates out of the map',()=>{
    const object={coordinate:null} as UniverseCatalogObject;
    expect(catalogPoint(object)).toBeNull();
    expect(catalogPoint({...object,coordinate:{ra_deg:12,dec_deg:100,frame:'ICRS'}})).toBeNull();
    expect(catalogPoint({...object,coordinate:{ra_deg:180,dec_deg:30,frame:'ICRS'}})).toEqual([0,30]);
  });
});
