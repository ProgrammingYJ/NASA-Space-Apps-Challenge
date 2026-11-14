import {describe,it,expect} from 'vitest';
import {sampleHistoricalComet,tdbCalendarLabel,type HistoricalComet} from './historicalCometMath';
const comet:HistoricalComet={object_id:'reference',name:'linear test',designation:'fixture',default_index:0,frame:'J2000 ecliptic',center:'Sun',time_scale:'TDB',sources:[],limitations:[],knots:[{jd_tdb:2451545,calendar_tdb:'2000-Jan-01 12:00:00',position_au:[1,2,3],velocity_au_day:[.1,-.2,.3]},{jd_tdb:2451547,calendar_tdb:'2000-Jan-03 12:00:00',position_au:[1.2,1.6,3.6],velocity_au_day:[.1,-.2,.3]}]};
describe('historical comet display window',()=>{
  it('preserves exact source knots and linearly moving independent reference',()=>{expect(sampleHistoricalComet(comet,0).position).toEqual([1,2,3]);expect(sampleHistoricalComet(comet,1).position).toEqual([1.2,1.6,3.6]);const middle=sampleHistoricalComet(comet,.5);expect(middle.position).toEqual([1.1,1.8,3.3]);expect(middle.jd_tdb).toBe(2451546);expect(middle.exact_knot).toBe(false);});
  it('rejects out-of-window positions instead of extrapolating historical or future returns',()=>{for(const x of [-1,1.01,NaN,Infinity])expect(()=>sampleHistoricalComet(comet,x)).toThrow();});
  it('labels source TDB calendar without claiming UTC conversion',()=>{expect(tdbCalendarLabel(2451545)).toBe('2000-01-01 12:00:00 TDB');});
});
