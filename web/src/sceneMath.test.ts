import {describe, expect, it} from 'vitest';
import {displayPosition, displayDirection, displayRadius, displayOrbitPoints, displayMoonOffset, bodyDisplayPositions, focusDistance, makeFocus, sampleFocus, advanceNavigationForBody, validCamera, type CameraState} from './sceneMath';

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
  it('follows a moving selected body with the same camera offset, and leaves a manual camera fixed',()=>{
    const following={camera,transition:null,followedObjectId:'earth'};
    const next=advanceNavigationForBody(following,'earth',[1,2,3],[1.5,1,5]);
    expect(next.camera.position).toEqual([.5,64,102]);expect(next.camera.target).toEqual([.5,-1,2]);
    const manual={...following,followedObjectId:null};expect(advanceNavigationForBody(manual,'earth',[1,2,3],[99,0,0])).toBe(manual);
    expect(following.camera).toEqual(camera);
  });
  it('moves an in-flight destination without resetting the transition clock or its starting camera',()=>{
    const transition=makeFocus(camera,'mars',[3,0,4],.5,48,1.5,123,false);
    const next=advanceNavigationForBody({camera,transition,followedObjectId:null},'mars',[3,0,4],[4,1,6]);
    expect(next.transition!.startedAt).toBe(123);expect(next.transition!.duration).toBe(transition.duration);expect(next.transition!.from).toBe(transition.from);
    expect(next.transition!.to.target).toEqual([4,1,6]);expect(next.camera).toBe(camera);
  });
  it('follows an evolving direction without translating the camera or applying the frame conversion twice',()=>{
    const direction=displayDirection([0,1,0]);const next=advanceNavigationForBody({camera,transition:null,followedObjectId:'epsilon-indi-b'},'epsilon-indi-b',[1,0,0],direction,true);
    expect(next.camera.position).toEqual(camera.position);expect(next.camera.target[0]).toBe(camera.position[0]);expect(next.camera.target[1]).toBe(camera.position[1]);expect(next.camera.target[2]).toBeLessThan(camera.position[2]);
  });
  it('keeps physical moon input separate while expanding parent-centered display distance and preserving direction',()=>{const relative:[number,number,number]=[.0025,.001,.0002];const offset=displayMoonOffset(relative,6371,1)!;expect(offset[0]/-offset[2]).toBeCloseTo(2.5);expect(offset[1]/offset[0]).toBeCloseTo(.08);expect(Math.hypot(...offset)).toBeGreaterThan(5);expect(relative).toEqual([.0025,.001,.0002]);expect(displayMoonOffset(relative,0,1)).toBeNull();});
  it('locates moons after their parent even when catalog order differs and does not invent a missing ephemeris',()=>{const positions=bodyDisplayPositions([{object_id:'moon-301',kind:'moon',parent_id:'earth',parent_relative_position_au:[.0025,0,0],position_au:[1.0025,0,0],radius_km:1737},{object_id:'earth',kind:'solar_system',position_au:[1,0,0],radius_km:6371},{object_id:'moon-missing',kind:'moon',parent_id:'earth',radius_km:null}]);expect(positions.get('moon-301')![0]).toBeGreaterThan(positions.get('earth')![0]);expect(positions.has('moon-missing')).toBe(false);});
});
