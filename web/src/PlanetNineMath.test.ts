import {describe,expect,it} from 'vitest';
import {planetNineArchiveLink,planetNineCalendarJD,planetNineRows,planetNineSkyPlot} from './PlanetNineMath';
import {planetNineCopy,planetNineDiagnosticsCopy,planetNineGravitySaveCopy,planetNineGravitySourceCopy} from './PlanetNineCopy';

describe('Planet Nine calendar, sky projection and archive boundary',()=>{
  it('preserves JD calendar labels and rejects calendar overflow rather than rolling dates',()=>{
    expect(planetNineCalendarJD('2000-01-01')).toBe(2451544.5);
    expect(planetNineCalendarJD('2018-06-01')).toBe(2458270.5);
    expect(planetNineCalendarJD('2018-05-31')).toBe(2458269.5);
    expect(()=>planetNineCalendarJD('2026-02-29')).toThrow();
    expect(()=>planetNineCalendarJD('2026-13-01')).toThrow();
    expect(()=>planetNineCalendarJD('2026-09-29T00:00:00Z')).toThrow();
  });
  it('unwraps an RA-zero crossing instead of drawing across the entire sky',()=>{
    const plot=planetNineSkyPlot([{ra_deg:359.9,dec_deg:10},{ra_deg:.05,dec_deg:10.05},{ra_deg:.2,dec_deg:10.1}]);
    expect(plot).not.toBeNull();expect(plot!.raMax-plot!.raMin).toBeCloseTo(.3,10);
    expect(plot!.dots[0].x).toBeGreaterThan(plot!.dots[2].x);
    expect(plot!.dots.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))).toBe(true);
    expect(planetNineSkyPlot([{ra_deg:NaN,dec_deg:0}])).toBeNull();
  });
  it('keeps a stationary path finite and centered without inventing motion',()=>{
    const plot=planetNineSkyPlot([{ra_deg:20,dec_deg:-10},{ra_deg:20,dec_deg:-10}]);
    expect(plot!.dots[0]).toEqual(plot!.dots[1]);expect(plot!.dots[0].x).toBeCloseTo(316);expect(plot!.dots[0].y).toBeCloseTo(148);
  });
  it('does not expose arbitrary or active-content URLs from service metadata',()=>{
    expect(planetNineArchiveLink('https://irsa.ipac.caltech.edu/a.fits')).toBe('https://irsa.ipac.caltech.edu/a.fits');
    for(const url of ['javascript:alert(1)','http://irsa.ipac.caltech.edu/a','https://irsa.ipac.caltech.edu.evil.example/a','https://evil.example/a','data:text/html,abc','https://user:pass@irsa.ipac.caltech.edu/a','https://irsa.ipac.caltech.edu:444/a'])expect(planetNineArchiveLink(url)).toBeNull();
    expect(planetNineRows({rows:[{observation_id:'x'},null,'x',[]]})).toEqual([{observation_id:'x'}]);
  });
  it('supplies all five locales with identical copy keys and nonempty condition/status/error text',()=>{
    const keys=Object.keys(planetNineCopy('en')).sort();
    for(const locale of ['ko','en','ja','zh-Hant','fr']){
      const copy=planetNineCopy(locale);expect(Object.keys(copy).sort()).toEqual(keys);expect(Object.values(copy).every(value=>typeof value==='string'&&value.length>0)).toBe(true);
      expect(planetNineDiagnosticsCopy(locale).integrationBounds.length).toBeGreaterThan(10);expect(planetNineGravitySourceCopy(locale).note.length).toBeGreaterThan(10);expect(planetNineGravitySaveCopy(locale).length).toBeGreaterThan(10);
    }
    expect(planetNineCopy('zh-Hant').coverageNote).toContain('觀測');
  });
});
