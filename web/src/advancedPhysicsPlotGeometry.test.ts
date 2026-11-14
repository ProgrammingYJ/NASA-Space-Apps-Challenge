import {describe,it,expect} from 'vitest';
import {fitPhysicalDomainRect} from './advancedPhysicsPlotGeometry';
describe('physical field axes and letterboxing',()=>{
  it('retains a 1 by 0.4 fluid domain inside a taller viewport',()=>{expect(fitPhysicalDomainRect({left:20,top:50,width:1000,height:600},1,.4)).toEqual({left:20,top:150,width:1000,height:400});});
  it('keeps a 1 by 1 electromagnetic cavity square in a wide viewport',()=>{expect(fitPhysicalDomainRect({left:20,top:50,width:1000,height:600},1,1)).toEqual({left:220,top:50,width:600,height:600});});
  it('fits both domains on a mobile plot without clipping or changing their physical ratios',()=>{const box={left:62,top:54,width:210,height:196};for(const [w,h] of [[1,.4],[1,1]]){const rect=fitPhysicalDomainRect(box,w,h);expect(rect.width/rect.height).toBeCloseTo(w/h,14);expect(rect.left).toBeGreaterThanOrEqual(box.left);expect(rect.top).toBeGreaterThanOrEqual(box.top);expect(rect.left+rect.width).toBeLessThanOrEqual(box.left+box.width);expect(rect.top+rect.height).toBeLessThanOrEqual(box.top+box.height);expect(rect.left+rect.width/2).toBe(box.left+box.width/2);expect(rect.top+rect.height/2).toBe(box.top+box.height/2);}});
  it('rejects missing or nonphysical dimensions',()=>{for(const dimensions of [[0,1],[1,-1],[NaN,1],[1,Infinity]])expect(()=>fitPhysicalDomainRect({left:0,top:0,width:200,height:200},dimensions[0],dimensions[1])).toThrow();});
});
