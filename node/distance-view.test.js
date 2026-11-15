'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sessionRules}=require('./schema');
function session(view,position=[120,80,100]){
  return {object_id:'pluto',observation_ids:['S12','S14'],universe_context:{selected_object_id:'pluto',distance_view:view,camera:{position,target:[0,0,0],representation_version:'solar-display-v1'}}};
}
test('local linear camera metadata retains its origin and extended coordinates',()=>{
  const value=session({algorithm_version:'parent-linear-distance-v1',origin_object_id:'pluto'},[20000,0,0]);
  assert.deepEqual(sessionRules(structuredClone(value)),value);
});
test('missing or blank local origin cannot reinterpret a saved camera',()=>{
  for(const origin of [undefined,null,'','  '])assert.throws(()=>sessionRules(session({algorithm_version:'parent-linear-distance-v1',origin_object_id:origin})),/invalid_request/);
});
test('legacy and common overview retain their old bounds and forbid a local origin',()=>{
  for(const view of [undefined,{algorithm_version:'legacy-expanded-v1'},{algorithm_version:'solar-overview-common-v2'}]){
    assert.doesNotThrow(()=>sessionRules(session(view)));
    assert.throws(()=>sessionRules(session(view,[10000,0,0])),/invalid_request/);
  }
  for(const algorithm_version of ['legacy-expanded-v1','solar-overview-common-v2'])assert.throws(()=>sessionRules(session({algorithm_version,origin_object_id:'earth'})),/invalid_request/);
});
test('extended views still reject non-finite coordinates and envelope boundary',()=>{
  const view={algorithm_version:'parent-linear-distance-v1',origin_object_id:'earth'};
  for(const position of [[Infinity,0,0],[NaN,0,0],[1e8,0,0],[0,0,0]])assert.throws(()=>sessionRules(session(view,position)),/invalid_request/);
});
