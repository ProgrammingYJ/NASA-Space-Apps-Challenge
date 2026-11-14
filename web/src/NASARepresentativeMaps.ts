import type {AppearanceEntry} from './planetAppearance';

/** NASA VTAD model textures, kept separate from the unchanged OPAL observations. */
export const NASA_REPRESENTATIVE_MAPS={
  "uranus": {
    "texture_url": "/textures/uranus-vtad-cf72fd1f5a8f.png",
    "sha256": "cf72fd1f5a8fd2ca14d268503db7f94b57adab8be3b80b3a1dc460644c97be28",
    "bytes": 30807,
    "pixel_dimensions": [
      1024,
      512
    ],
    "source_url": "https://science.nasa.gov/resource/uranus-3d-model/",
    "glb_source_url": "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/u/Uranus_1_51118.glb",
    "credit": "NASA Visualization Technology Applications and Development (VTAD)"
  },
  "neptune": {
    "texture_url": "/textures/neptune-vtad-471826354bab.png",
    "sha256": "471826354bab45d381ba552503ac138c779e3ae539b5f14206c42426195077cd",
    "bytes": 443257,
    "pixel_dimensions": [
      1024,
      512
    ],
    "source_url": "https://science.nasa.gov/resource/neptune-3d-model/",
    "glb_source_url": "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/n/Neptune_1_49528.glb",
    "credit": "NASA Visualization Technology Applications and Development (VTAD)"
  }
} as const;

export function representativeAppearance(entry:AppearanceEntry,id:string):AppearanceEntry;
export function representativeAppearance(entry:AppearanceEntry|undefined,id:string):AppearanceEntry|undefined;
export function representativeAppearance(entry:AppearanceEntry|undefined,id:string):AppearanceEntry|undefined{
  if(!entry||!Object.hasOwn(NASA_REPRESENTATIVE_MAPS,id))return entry;
  const asset=NASA_REPRESENTATIVE_MAPS[id as keyof typeof NASA_REPRESENTATIVE_MAPS];
  const result:AppearanceEntry={...entry,kind:'illustration',texture_url:asset.texture_url,pixel_dimensions:[...asset.pixel_dimensions],source:{url:asset.source_url,label:'NASA VTAD representative 3D model texture'},credit:asset.credit,limitations:['representative_visualization_not_an_observation','not_a_measured_complete_atmospheric_map','not_a_photograph_at_model_epoch','representative_texture_longitude_phase_not_validated','original_OPAL_observation_map_preserved_separately']};
  delete result.texture_region_px;delete result.lat_bounds_deg;delete result.texture_flip_x;delete result.map_color_type;delete result.color_composite;
  return result;
}
