import {beforeEach,describe,expect,it} from 'vitest';
import {initialSession,useWorkbench} from './store';
import type {Comparison,Session} from './types';

beforeEach(()=>useWorkbench.setState({revision:0,workspaces:{},session:{...initialSession,observation_ids:[...initialSession.observation_ids]},comparison:null,judgment:'',evidenceId:null}));

describe('observation defaults hydrate without changing user intent',()=>{
  it('keeps an in-flight import revision valid, copies the defaults, and still invalidates on explicit edits',()=>{
    useWorkbench.getState().patch({object_id:'barnards-star'});
    const importRevision=useWorkbench.getState().revision,defaults=['L002','L006'];
    useWorkbench.getState().hydrateObservationPair('rw-aurigae',['L015','L018']);
    expect(useWorkbench.getState().session.observation_ids).toEqual([]);
    useWorkbench.getState().hydrateObservationPair('barnards-star',defaults);
    expect(useWorkbench.getState().session.observation_ids).toEqual(['L002','L006']);
    expect(useWorkbench.getState().revision).toBe(importRevision);
    defaults[0]='changed-outside-the-store';
    expect(useWorkbench.getState().session.observation_ids).toEqual(['L002','L006']);
    useWorkbench.getState().patch({observation_ids:['L006','L002']});
    const editedRevision=useWorkbench.getState().revision;
    expect(editedRevision).toBeGreaterThan(importRevision);
    useWorkbench.getState().hydrateObservationPair('barnards-star',['L002','L006']);
    expect(useWorkbench.getState().session.observation_ids).toEqual(['L006','L002']);
    expect(useWorkbench.getState().revision).toBe(editedRevision);
  });
  it('never replaces a restored pair/result or fills an empty session with malformed defaults',()=>{
    useWorkbench.getState().patch({object_id:'barnards-star'});
    for(const invalid of [[],['L002'],['L002','L002'],['','L006']])useWorkbench.getState().hydrateObservationPair('barnards-star',invalid);
    expect(useWorkbench.getState().session.observation_ids).toEqual([]);
    const restoredSession:Session={...initialSession,object_id:'barnards-star',observation_ids:['L006','L002']};
    // The state contract only examines result presence here; scientific payload
    // integrity belongs to the independent API import contract tests.
    const result={object_id:'barnards-star',frames:[],result_id:'unit-state-fixture'} as unknown as Comparison;
    useWorkbench.getState().restore(restoredSession,result,'preserved judgment','preserved-evidence');
    const revision=useWorkbench.getState().revision;
    useWorkbench.getState().hydrateObservationPair('barnards-star',['L002','L006']);
    expect(useWorkbench.getState().session).toBe(restoredSession);
    expect(useWorkbench.getState().comparison).toBe(result);
    expect(useWorkbench.getState().judgment).toBe('preserved judgment');
    expect(useWorkbench.getState().evidenceId).toBe('preserved-evidence');
    expect(useWorkbench.getState().revision).toBe(revision);
    useWorkbench.setState({session:{...restoredSession,observation_ids:[]}});
    useWorkbench.getState().hydrateObservationPair('barnards-star',['L002','L006']);
    expect(useWorkbench.getState().session.observation_ids).toEqual([]);
  });
});
