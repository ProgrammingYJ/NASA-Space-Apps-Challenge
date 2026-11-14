import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {TransNeptunianLayer} from './TransNeptunianLayer';
import fixture from '../../node/outer-tno.fixture.json';
describe('GPU TNO navigation contract',()=>{
  it('selects identified vertices using raycast indices and a constant screen marker',()=>{
    const layer=new TransNeptunianLayer([{object_id:'sbdb-a',name:'a',known_object_id:null,position_au:[80,0,0]},
      {object_id:'sbdb-b',name:'b',known_object_id:null,position_au:[0,80,0]}]);
    const camera=new THREE.PerspectiveCamera(50,1,.1,2000),center=layer.positionFor('sbdb-a')!;
    camera.position.set(center[0],center[1],center[2]+100);camera.lookAt(...center);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    expect(layer.pick(new THREE.Raycaster(),camera,new THREE.Vector2(0,0),800,800)).toBe('sbdb-a');
    const size=layer.points.material.size;layer.setSelected('sbdb-a',[[70,0,0],[80,10,0],[70,0,0]]);expect(layer.points.material.size).toBe(size);
    layer.setVisible(false);expect(layer.pick(new THREE.Raycaster(),camera,new THREE.Vector2(),800,800)).toBeNull();layer.dispose();
  });
  it('updates client positions for model time and reports operating-range omissions',()=>{
    const source=fixture.checks[0];const layer=new TransNeptunianLayer([{object_id:source.object_id,name:source.name,known_object_id:null,orbit:source.orbit,reference_position_au:source.expected_position_au as [number,number,number]}]);
    layer.updateEpoch(source.epoch_jd_tdb);const initial=layer.positionFor(source.object_id);
    layer.updateEpoch(source.epoch_jd_tdb+10);expect(layer.positionFor(source.object_id)).not.toEqual(initial);expect(layer.statistics).toMatchObject({catalogue_count:1,rendered_count:1});
    layer.updateEpoch(source.epoch_jd_tdb+36526);expect(layer.count).toBe(1);expect(layer.statistics?.extrapolated_count).toBe(1);
    layer.updateEpoch(2816788);expect(layer.count).toBe(0);expect(layer.statistics?.unavailable_count).toBe(1);layer.dispose();
  });
  it('deduplicates known bodies without allocating one mesh or label per source',()=>{
    const layer=new TransNeptunianLayer([{object_id:'a',name:'Sedna',known_object_id:'sedna',position_au:[80,0,0]},
      {object_id:'b',name:'other',known_object_id:null,position_au:[50,1,2]}],{excludedIds:new Set(['sedna'])});
    expect(layer.count).toBe(1);expect(layer.group.children.length).toBe(3);expect(layer.points.geometry.drawRange.count).toBe(1);layer.dispose();
  });
  it('retains every overlapping marker in a bounded screen-space click and excludes points behind the camera',()=>{
    const layer=new TransNeptunianLayer([{object_id:'front-a',name:'a',known_object_id:null,position_au:[80,0,0]},
      {object_id:'front-b',name:'b',known_object_id:null,position_au:[80,.01,0]}]);
    const camera=new THREE.PerspectiveCamera(50,1,.1,2000),center=layer.positionFor('front-a')!;
    camera.position.set(center[0],center[1],center[2]+100);camera.lookAt(...center);camera.updateMatrixWorld();
    expect(layer.pickCandidates(camera,new THREE.Vector2(),800,800).map(row=>row.object_id)).toEqual(['front-a','front-b']);
    camera.lookAt(center[0],center[1],center[2]+200);camera.updateMatrixWorld();expect(layer.pickCandidates(camera,new THREE.Vector2(),800,800)).toEqual([]);layer.dispose();
  });
});
