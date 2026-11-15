'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {nativeTnoContextReasons,validator}=require('./schema');
const {constants}=require('./outer-tno');

test('optional native TNO pins preserve old contexts and distinguish source/runtime changes',()=>{
  const current={source_manifest_sha256:'a'.repeat(64),algorithm_version:constants.VERSION};
  const context={outer_tno_manifest_sha256:current.source_manifest_sha256,native_tno_simulation_algorithm_version:constants.VERSION};
  const before=JSON.stringify({context,current});
  assert.deepEqual(nativeTnoContextReasons({},undefined),[]);
  assert.deepEqual(nativeTnoContextReasons(context,current),[]);
  assert.deepEqual(nativeTnoContextReasons({...context,outer_tno_manifest_sha256:'b'.repeat(64)},current),['outer_tno_sources_changed']);
  assert.deepEqual(nativeTnoContextReasons(context,{...current,algorithm_version:'future-runtime-version'}),['native_tno_algorithm_changed']);
  assert.deepEqual(nativeTnoContextReasons(context,null),['outer_tno_data_unavailable']);
  assert.deepEqual(nativeTnoContextReasons({outer_tno_manifest_sha256:current.source_manifest_sha256},current),[]);
  assert.deepEqual(nativeTnoContextReasons({native_tno_simulation_algorithm_version:constants.VERSION},current),[]);
  assert.equal(JSON.stringify({context,current}),before);
});

test('generated OpenAPI accepts optional native pins and rejects malformed or obsolete declarations',()=>{
  const document=JSON.parse(fs.readFileSync(path.join(__dirname,'../contracts/openapi.json'),'utf8')),validate=validator(document);
  const base={selected_object_id:'pluto',model_epoch:'2026-11-14T00:00:00Z',source_manifest_sha256:'a'.repeat(64)};
  const legacy=validate('UniverseContext',base);
  assert.equal(Object.hasOwn(legacy,'outer_tno_manifest_sha256'),false);assert.equal(Object.hasOwn(legacy,'native_tno_simulation_algorithm_version'),false);
  const pinned=validate('UniverseContext',{...base,outer_tno_manifest_sha256:'b'.repeat(64),native_tno_simulation_algorithm_version:constants.VERSION});
  assert.equal(pinned.outer_tno_manifest_sha256,'b'.repeat(64));assert.equal(pinned.native_tno_simulation_algorithm_version,constants.VERSION);
  for(const changed of [{outer_tno_manifest_sha256:'invalid'}, {native_tno_simulation_algorithm_version:constants.SOURCE_VERSION}])assert.throws(()=>validate('UniverseContext',{...base,...changed}),/invalid_request/);
});
