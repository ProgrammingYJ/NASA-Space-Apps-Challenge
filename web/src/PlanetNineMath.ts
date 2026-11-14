import type {PlanetNinePathPoint} from './PlanetNineTypes';

/** Calendar labels for the model's explicit TDB assumption; not a UTC↔TDB conversion. */
export function planetNineCalendarJD(date:string):number {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('date');
  const ms=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date)throw new Error('date');
  return ms/86400000+2440587.5;
}

/** Unwrap RA around neighboring samples so a 359°→0° path remains continuous. */
export function planetNineSkyPlot(points:Pick<PlanetNinePathPoint,'ra_deg'|'dec_deg'>[]) {
  const valid=points.filter(p=>Number.isFinite(p.ra_deg)&&Number.isFinite(p.dec_deg)&&Math.abs(p.dec_deg)<=90);
  if(!valid.length)return null;
  const unwrapped:number[]=[];
  for(const point of valid){let ra=point.ra_deg;if(unwrapped.length){const previous=unwrapped[unwrapped.length-1];while(ra-previous>180)ra-=360;while(ra-previous< -180)ra+=360;}unwrapped.push(ra);}
  const range=(values:number[],minimum:number)=>{const low=Math.min(...values),high=Math.max(...values),span=Math.max(minimum,high-low);return {low:(low+high-span)/2,high:(low+high+span)/2};};
  const r=range(unwrapped,.002),d=range(valid.map(p=>p.dec_deg),.002);
  const dots=valid.map((p,i)=>({x:576-(unwrapped[i]-r.low)/(r.high-r.low)*520,y:32+(d.high-p.dec_deg)/(d.high-d.low)*232,ra:p.ra_deg,dec:p.dec_deg}));
  return {dots,path:dots.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' '),raMin:r.low,raMax:r.high,decMin:d.low,decMax:d.high};
}

/** Links are external archive references, never an instruction to fetch arbitrary URLs. */
export function planetNineArchiveLink(value:unknown):string|null {
  if(typeof value!=='string')return null;
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='irsa.ipac.caltech.edu'&&!url.username&&!url.password&&!url.port?url.href:null;}catch{return null;}
}

export function planetNineRows(coverage:Record<string,unknown>|null):Record<string,unknown>[] {
  if(!coverage)return [];
  for(const key of ['rows','exposures','observations','results']){const rows=coverage[key];if(Array.isArray(rows))return rows.filter((r):r is Record<string,unknown>=>Boolean(r)&&typeof r==='object'&&!Array.isArray(r));}
  return [];
}
