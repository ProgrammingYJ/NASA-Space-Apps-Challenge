import type {UniverseData} from './UniverseScene';

export const CONFIRMED_PLANET_IDS = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'] as const;
export const SCENE_FILTERS = ['all','confirmed-planets','p9-reference','planets-and-p9'] as const;
export type SceneFilter = typeof SCENE_FILTERS[number];
export type RenderPreset = 'balanced'|'detail';
export type LightingMode = 'inspection'|'solar';
const confirmed = new Set<string>(CONFIRMED_PLANET_IDS);
export const isConfirmedPlanet = (id:string)=>confirmed.has(id);
export const includesP9Reference = (mode:SceneFilter)=>mode==='p9-reference'||mode==='planets-and-p9';
export const includesKnownObject = (mode:SceneFilter,id:string)=>mode==='all'||id==='sun'||mode!=='p9-reference'&&confirmed.has(id);

/** A display subset only. The input and all gravity/observation sources stay intact. */
export function filteredUniverse<T extends UniverseData>(data:T|null,mode:SceneFilter):T|null {
  if(!data||mode==='all')return data;
  return {...data,objects:data.objects.filter(object=>includesKnownObject(mode,object.object_id))};
}
export const renderingBudget = (preset:RenderPreset)=>preset==='detail'?{fps:60,dpr:1.8}:{fps:30,dpr:1.25};
