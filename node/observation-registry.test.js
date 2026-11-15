'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resolveRegisteredPair,sessionRules}=require('./schema');
function registry(){return {algorithm_version:'spherex-registered-native-v1',objects:{'barnards-star':{object_id:'barnards-star'}},exposures:{A:{observation_id:'A',object_id:'barnards-star',source_id:'raw-A',source:{sha256:'a'.repeat(64)},enabled:true,detector:'D6',date_avg:'2025-01-01'},B:{observation_id:'B',object_id:'barnards-star',source_id:'raw-B',source:{sha256:'b'.repeat(64)},enabled:true,detector:'D6',date_avg:'2026-01-01'}},pairs:[['A','B']]};}
test('registered pairs preserve requested order and target; sessions use registry membership',()=>{
  const data=registry(),before=JSON.stringify(data);
  assert.deepEqual(resolveRegisteredPair(data,['B','A']),{object_id:'barnards-star',observation_ids:['B','A'],algorithm_version:'spherex-registered-native-v1'});
  const session={object_id:'barnards-star',observation_ids:['A','B']};assert.equal(sessionRules(session,data),session);assert.equal(JSON.stringify(data),before);
});
test('unknown, disabled, cross-target, cross-detector and same-input variants fail closed',()=>{
  for(const changes of [{enabled:false},{object_id:'wise0855'},{detector:'D3'},{date_avg:'2025-01-01'},{source_id:'raw-A'},{source:{sha256:'a'.repeat(64)}}]){const data=registry();Object.assign(data.exposures.B,changes);assert.throws(()=>resolveRegisteredPair(data,['A','B']),/invalid_request/);}
  assert.throws(()=>resolveRegisteredPair(registry(),['A','missing']),/invalid_request/);assert.throws(()=>resolveRegisteredPair(registry(),['A','A']),/invalid_request/);assert.throws(()=>resolveRegisteredPair(registry(),['A','B'],'pluto'),/invalid_request/);
  const data=registry();data.pairs=[];assert.throws(()=>resolveRegisteredPair(data,['A','B']),/invalid_request/);
});
test('unregistered historical bundles retain only their four protected ordered selections',()=>{
  for(const ids of [['S01','S02'],['S02','S01']])assert.equal(resolveRegisteredPair(null,ids).algorithm_version,'spherex-native-v1');
  for(const ids of [['S12','S14'],['S14','S12']])assert.equal(resolveRegisteredPair(null,ids).algorithm_version,'pluto-native-v1');
  for(const ids of [['L001','L005'],['S01','S14'],['S01','S01']])assert.throws(()=>resolveRegisteredPair(null,ids),/invalid_request/);
});
