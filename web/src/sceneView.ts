import type {UniverseData} from './UniverseScene';

export const CONFIRMED_PLANET_IDS = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'] as const;
export const SCENE_FILTERS = ['all','confirmed-planets','p9-reference','planets-and-p9'] as const;
export type SceneFilter = typeof SCENE_FILTERS[number];
export type RenderPreset = 'balanced'|'detail';
export type LightingMode = 'inspection'|'solar';
const confirmed = new Set<string>(CONFIRMED_PLANET_IDS);
export const isConfirmedPlanet = (id:string)=>confirmed.has(id);
// Legacy enum values remain accepted in stored evidence. The two TOP 5 views
// now show actual catalogue objects selected by the descriptive a/e/i rule.
export const includesP9Reference = (mode:SceneFilter)=>mode==='p9-reference'||mode==='planets-and-p9';
const noTopFive:ReadonlySet<string>=new Set<string>();
const directionOnlyIds=new Set(['epsilon-indi-b','barnards-star','wise0855','rw-aurigae','r-draconis']);
export const includesKnownObject = (mode:SceneFilter,id:string,topFiveIds:ReadonlySet<string>=noTopFive)=>
  mode==='all'||id==='sun'||(mode==='planets-and-p9'?!directionOnlyIds.has(id)&&(!id.startsWith('sbdb-')||topFiveIds.has(id)):mode==='p9-reference'?topFiveIds.has(id):confirmed.has(id));

/** A display subset only. The input and all gravity/observation sources stay intact. */
export function filteredUniverse<T extends UniverseData>(data:T|null,mode:SceneFilter,topFiveIds:ReadonlySet<string>=noTopFive):T|null {
  if(!data||mode==='all')return data;
  if(mode==='planets-and-p9')return {...data,objects:data.objects.filter(object=>object.kind!=='direction')};
  return {...data,objects:data.objects.filter(object=>includesKnownObject(mode,object.object_id,topFiveIds))};
}
export const renderingBudget = (preset:RenderPreset)=>preset==='detail'?{fps:60,dpr:1.8}:{fps:30,dpr:1.25};
