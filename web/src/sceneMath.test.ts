import {describe, expect, it} from 'vitest';
import {displayPosition, displayDirection, displayRadius, displayOrbitPoints, focusDistance, makeFocus, sampleFocus, validCamera, type CameraState} from './sceneMath';

const camera: CameraState = {position:[0,65,100],target:[0,0,0],representation_version:'solar-display-v1'};
describe('source coordinates and navigable display',()=>{
  it('preserves heliocentric directions under declared radial compression and maps ecliptic axes explicitly',()=>{
    expect(displayPosition([0,0,0])).toEqual([0,0,0]);
    expect(displayPosition([1,0,0])[0]).toBeCloseTo(18*Math.log(2));
    const p=displayPosition([2,4,6]);expect(p[0]/-p[2]).toBeCloseTo(0.5);expect(p[1]/p[0]).toBeCloseTo(3);
    expect(displayDirection([0,1,0])).toEqual([0,0,-1]);
  });
  it('frames a small planet and a large Sun outside their visual surfaces, including a narrow screen',()=>{
    for(const radius of [displayRadius(1188),displayRadius(6371),displayRadius(695700,true)]){
      expect(focusDistance(radius,48,0.5)).toBeGreaterThan(radius*3);
      expect(focusDistance(radius,48,0.5)).toBeGreaterThan(focusDistance(radius,48,1.5));
    }
  });
  it('retargets from the current in-flight camera rather than the old starting position',()=>{
    const first=makeFocus(camera,'earth',[12,0,0],0.7,48,1.5,0,false);
    const midway=sampleFocus(first,300).camera;
    const second=makeFocus(midway,'pluto',[-55,0,4],0.4,48,1.5,300,false);
    expect(sampleFocus(second,300).camera).toEqual(midway);
    const third=makeFocus(sampleFocus(second,500).camera,'mars',[7,0,9],0.5,48,1.5,500,false);
    expect(sampleFocus(third,5000)).toEqual({camera:third.to,done:true});
  });
  it('focuses a catalog direction without travelling to an invented physical distance',()=>{
    const transition=makeFocus(camera,'epsilon-indi-b',[1,0,0],1,48,1.5,0,false,true);
    expect(transition.to.position).toEqual(camera.position);
    expect(transition.to.target).toEqual([80,65,100]);
    const nonAxis=makeFocus(camera,'epsilon-indi-b',[0,1,0],1,48,1.5,0,false,true);
    expect(nonAxis.to.position).toEqual(camera.position);
    expect(nonAxis.to.target).toEqual([0,65,20]);
  });
  it('supports immediate reduced-motion focus and rejects invalid restore cameras',()=>{
    const transition=makeFocus(camera,'earth',[12,0,0],0.7,48,1.5,0,true);
    expect(sampleFocus(transition,0).done).toBe(true);expect(validCamera(camera)).toBe(true);
    expect(validCamera({...camera,position:[Infinity,0,0]})).toBe(false);
    expect(validCamera({...camera,position:[0,0,0]})).toBe(false);
  });
  it('turns to the opposite sky direction without the look target crossing the camera',()=>{
    const opposite:CameraState={position:[0,0,0],target:[-80,0,0],representation_version:'solar-display-v1'};
    const transition=makeFocus(opposite,'epsilon-indi-b',[1,0,0],1,48,1.5,0,false,true);
    for(let time=0;time<=transition.duration;time+=50){const state=sampleFocus(transition,time).camera;expect(Math.hypot(...state.target)).toBeCloseTo(80,8);expect(state.position).toEqual([0,0,0]);expect(state.target.every(Number.isFinite)).toBe(true);}
  });
  it('transforms each eccentric/inclined orbit guide point without inventing an ellipse or flattening inclination',()=>{
    const points:[number,number,number][]=[[1,0,0],[0,2,1],[-3,0,0],[1,0,0]];
    const output=displayOrbitPoints(points);expect(output).toHaveLength(4);expect(output[0]).toEqual(output[3]);
    expect(output[0][0]).toBeCloseTo(18*Math.log(2));expect(output[2][0]).toBeCloseTo(-18*Math.log(4));
    expect(output[1][1]).toBeGreaterThan(0);expect(output[1][2]/output[1][1]).toBeCloseTo(-2);
    expect(points[1]).toEqual([0,2,1]);expect(displayOrbitPoints([[0,0,0],[1,0,0],[NaN,0,0]])).toEqual([]);
  });
});
