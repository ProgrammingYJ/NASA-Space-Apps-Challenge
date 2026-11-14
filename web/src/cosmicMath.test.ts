import {describe,it,expect} from 'vitest';
import {advanceCosmicAge,historyStage,type CosmicHistory} from './cosmicMath';
describe('cosmic display time has explicit geological units',()=>{
  it('converts million years per second to Gyr without reusing hour-based orbital time',()=>{
    expect(advanceCosmicAge(0,100,1,13.8).age).toBe(.0001);
    expect(advanceCosmicAge(0,100,100,13.8).age).toBe(.01);
    expect(advanceCosmicAge(0,100,1000,13.8).age).toBe(.1);
    expect(advanceCosmicAge(13.79,100,1000,13.8)).toEqual({age:13.8,ended:true});
    expect(advanceCosmicAge(1,60000,100,13.8)).toEqual(advanceCosmicAge(1,100,100,13.8));
    expect(()=>advanceCosmicAge(NaN,10,100,13.8)).toThrow();
  });
  it('selects the preceding display milestone while preserving source anchors',()=>{
    const data={reference_age_gyr:13.8,stages:[{stage_id:'big_bang',age_gyr:0},{stage_id:'solar_system',age_gyr:9.2},{stage_id:'present',age_gyr:13.8}]} as CosmicHistory;
    expect(historyStage(data,9.1).stage_id).toBe('big_bang');expect(historyStage(data,9.3)).toBe(data.stages[1]);expect(historyStage(data,13.8).stage_id).toBe('present');expect(()=>historyStage(data,-.001)).toThrow();expect(data.stages[1].age_gyr).toBe(9.2);
  });
});
