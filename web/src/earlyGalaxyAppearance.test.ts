import {describe,expect,it} from 'vitest';
import {createEarlyGalaxyField,sampleEarlyGalaxyField} from './earlyGalaxyAppearance';

function buffers(field:ReturnType<typeof createEarlyGalaxyField>){return {positions:new Float32Array(field.early.length),colors:new Float32Array(field.early.length)};}
function covarianceRoundness(array:Float32Array,offset:number,count:number){
  const mean=[0,0,0];for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++)mean[axis]+=array[offset+i*3+axis]/count;
  const m=Array.from({length:3},()=>[0,0,0]);for(let i=0;i<count;i++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)m[a][b]+=(array[offset+i*3+a]-mean[a])*(array[offset+i*3+b]-mean[b])/count;
  const determinant=m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  return 27*determinant/(m[0][0]+m[1][1]+m[2][2])**3;
}

describe('diverse, deterministic conceptual history galaxies',()=>{
  it('generates intrinsic shape differences rather than rotating copies of one spiral',()=>{
    const field=createEarlyGalaxyField();expect(field.models).toHaveLength(35);expect(field.early.length/3).toBe(12600);
    expect(new Set(field.models.map(model=>model.earlyFamily)).size).toBe(5);
    const compact=field.models.findIndex(model=>model.earlyFamily==='compact'),elongated=field.models.findIndex(model=>model.earlyFamily==='elongated');
    const compactRoundness=covarianceRoundness(field.early,compact*field.pointsPerModel*3,field.pointsPerModel),elongatedRoundness=covarianceRoundness(field.early,elongated*field.pointsPerModel*3,field.pointsPerModel);
    expect(compactRoundness).toBeGreaterThan(.5);expect(elongatedRoundness).toBeLessThan(.1);
    expect(new Set(field.models.map(model=>model.radius.toFixed(3))).size).toBeGreaterThan(30);
    expect(new Set(field.models.map(model=>model.orientation.join(','))).size).toBe(35);
  });
  it('reproduces both the field and a seeked age exactly without changing its keyframe buffers',()=>{
    const field=createEarlyGalaxyField(),fresh=createEarlyGalaxyField(),target=buffers(field),second=buffers(fresh),initial=field.early.slice();
    expect(field.models).toEqual(fresh.models);expect(field.early).toEqual(fresh.early);
    const first=sampleEarlyGalaxyField(field,.8,target.positions,target.colors),positions=target.positions.slice(),colors=target.colors.slice();
    sampleEarlyGalaxyField(field,10,target.positions,target.colors);const restored=sampleEarlyGalaxyField(field,.8,target.positions,target.colors);
    sampleEarlyGalaxyField(fresh,.8,second.positions,second.colors);
    expect(restored.fingerprint).toBe(first.fingerprint);expect(target.positions).toEqual(positions);expect(target.colors).toEqual(colors);expect(second.positions).toEqual(positions);expect(field.early).toEqual(initial);
  });
  it('keeps disk cues after the conservative 0.7 Gyr display boundary and uses individual continuous growth schedules',()=>{
    const field=createEarlyGalaxyField(),target=buffers(field);
    expect(sampleEarlyGalaxyField(field,.279,target.positions,target.colors).activeFamilies).toEqual({});
    const early=sampleEarlyGalaxyField(field,.6,target.positions,target.colors);expect(Object.keys(early.activeFamilies).length).toBeGreaterThanOrEqual(3);expect(early.diskProgress.every(value=>value===0)).toBe(true);
    const later=sampleEarlyGalaxyField(field,3,target.positions,target.colors);expect(new Set(later.transitionProgress.map(value=>value.toFixed(6))).size).toBeGreaterThan(10);
    const before=target.positions.slice();const after=sampleEarlyGalaxyField(field,3.0001,target.positions,target.colors);
    let maxChange=0;for(let i=0;i<before.length;i++)maxChange=Math.max(maxChange,Math.abs(target.positions[i]-before[i]));expect(maxChange).toBeLessThan(.005);expect(after.fingerprint).not.toBe(later.fingerprint);
    const late=sampleEarlyGalaxyField(field,13.8,target.positions,target.colors);expect(Object.keys(late.activeFamilies).sort()).toEqual(['disk','disturbed_pair','irregular','spheroid']);expect(target.positions.every(Number.isFinite)).toBe(true);
  });
});
