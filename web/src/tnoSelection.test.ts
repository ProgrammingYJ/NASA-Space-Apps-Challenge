import {describe,it,expect} from 'vitest';
import {tnoCataloguePage,tnoPickCandidates} from './tnoSelection';
describe('identified TNO discovery',()=>{
  const rows=Array.from({length:8341},(_,i)=>({object_id:'sbdb-'+i,name:i===8340?'2002 PD153':'Object '+i,spkid:String(i),pdes:String(i),known_object_id:i===0?'sedna':null,orbit:i===8340?null:{}}));
  it('every source row remains reachable with at most25 entries, including the missing-phase object',()=>{
    const found:string[]=[];for(let i=0;i<334;i++){const page=tnoCataloguePage(rows,'',i);expect(page.rows.length).toBeLessThanOrEqual(25);found.push(...page.rows.map(row=>row.object_id));}
    expect(new Set(found).size).toBe(8341);expect(tnoCataloguePage(rows,'2002 PD153',999).rows[0].orbit).toBeNull();
    expect(tnoCataloguePage(rows,'sedna',0).rows[0].object_id).toBe('sbdb-0');expect(tnoCataloguePage(rows,'sbdb-8340',0).total).toBe(1);
  });
  it('dense screen matches are all preserved and order does not depend on GPU vertex depth alone',()=>{
    const result=tnoPickCandidates([{object_id:'near',x:100,y:100,depth:.9},{object_id:'far',x:102,y:100,depth:.1},{object_id:'behind',x:100,y:100,depth:1.1},{object_id:'outside',x:110,y:100,depth:.1}],100,100);
    expect(result.map(row=>row.object_id)).toEqual(['near','far']);
  });
});
