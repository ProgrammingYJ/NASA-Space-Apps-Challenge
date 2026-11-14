import {normalizeObjectSearch} from './objectNames';
import type {TransNeptunianScreenCandidate} from './TransNeptunianMath';

export interface TnoSearchRow {object_id:string;name:string;known_object_id:string|null;spkid?:string;pdes?:string;iau_name?:string|null;orbit?:unknown}
/** A bounded DOM page retains access to every source row, including missing orbits. */
export function tnoCataloguePage<T extends TnoSearchRow>(rows:readonly T[],query:string,page:number,pageSize=25){
  const size=Math.max(1,Math.min(50,Math.trunc(pageSize)||25)),needle=normalizeObjectSearch(query);
  const matches=needle?rows.filter(row=>normalizeObjectSearch([row.object_id,row.name,row.known_object_id,row.spkid,row.pdes,row.iau_name].filter(Boolean).join(' ')).includes(needle)):rows;
  const pages=Math.max(1,Math.ceil(matches.length/size)),current=Math.max(0,Math.min(pages-1,Math.trunc(page)||0));
  return {rows:matches.slice(current*size,(current+1)*size),total:matches.length,page:current,pages,pageSize:size};
}
/** Screen-space selection includes every overlapping visible marker, ordered deterministically. */
export function tnoPickCandidates(rows:readonly TransNeptunianScreenCandidate[],x:number,y:number,tolerancePx=9){
  if(![x,y,tolerancePx].every(Number.isFinite)||tolerancePx<=0)return [];
  return rows.filter(row=>[row.x,row.y,row.depth].every(Number.isFinite)&&row.depth>=-1&&row.depth<=1&&(row.x-x)**2+(row.y-y)**2<=tolerancePx**2)
    .map(row=>({...row,distance_px:Math.hypot(row.x-x,row.y-y)}))
    .sort((a,b)=>a.distance_px-b.distance_px||a.depth-b.depth||a.object_id.localeCompare(b.object_id));
}
