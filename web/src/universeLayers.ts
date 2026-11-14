import * as THREE from 'three';
import {displayPosition,type Vec3} from './sceneMath';
import {seededRandom} from './historySceneMath';

export interface GalaxyObject {
  object_id:string;
  name:string;
  kind:'galaxy';
  direction_icrs_deg:{ra:number;dec:number};
  distance_mpc:number|null;
  source:{url:string;label:string};
  morphology?:'spiral'|'elliptical'|'irregular'|'interacting'|'lenticular';
  appearance?:GalaxyAppearanceSpec;
  image_url?:string;
  image_source?:{url:string;label:string};
  limitations?:string[];
}
export type GalaxyRenderer='inclined_spiral'|'flocculent_spiral'|'grand_design_spiral'|'elliptical_jet'|'irregular_barred'|'irregular_cloud'|'interacting_pair'|'edge_on_dust_disk'|'dust_lane_elliptical';
export interface GalaxyAppearanceSpec {
  renderer:GalaxyRenderer;
  observed_features:string[];
  source:{url:string;label:string};
  additional_sources?:{url:string;label:string}[];
  inclination_deg?:number|null;
  position_angle_deg?:number|null;
  arms?:number|null;
  orientation_status:'source_projected_appearance'|'illustrative_assumption';
  display_assumptions:string[];
}
export interface GalaxyData {objects:GalaxyObject[];source?:{url:string;label:string};limitations?:string[]}

/** Same fixed J2000 obliquity as the Horizons ecliptic source frame. */
export function icrsToEclipticUnit(raDeg:number,decDeg:number):Vec3|null {
  if(!Number.isFinite(raDeg)||!Number.isFinite(decDeg)||raDeg<0||raDeg>=360||Math.abs(decDeg)>90)return null;
  const ra=raDeg*Math.PI/180,dec=decDeg*Math.PI/180,e=84381.448*Math.PI/(180*3600);
  const x=Math.cos(dec)*Math.cos(ra),y=Math.cos(dec)*Math.sin(ra),z=Math.sin(dec);
  return [x,y*Math.cos(e)+z*Math.sin(e),-y*Math.sin(e)+z*Math.cos(e)];
}

export function galaxyPositionAu(galaxy:Pick<GalaxyObject,'direction_icrs_deg'|'distance_mpc'>):Vec3|null {
  const direction=icrsToEclipticUnit(galaxy.direction_icrs_deg.ra,galaxy.direction_icrs_deg.dec);
  if(!direction||galaxy.distance_mpc===null||!Number.isFinite(galaxy.distance_mpc)||galaxy.distance_mpc<=0)return null;
  const distanceAu=galaxy.distance_mpc*1e6*(648000/Math.PI);
  return direction.map(value=>value*distanceAu) as Vec3;
}

export function kuiperIllustrationPoints(count=650):Vec3[] {
  const random=seededRandom(1949030);const points:Vec3[]=[];
  // This is an explanatory seeded annulus, not a sampled object catalogue or density.
  for(let i=0;i<count;i++){const radius=30+random()*20,angle=random()*Math.PI*2,height=(random()-.5)*1.2;points.push(displayPosition([Math.cos(angle)*radius,Math.sin(angle)*radius,height]));}
  return points;
}

export function createKuiperIllustration():THREE.Group {
  const group=new THREE.Group();group.name='kuiper-belt-explanatory-layer';group.userData.representation='illustrative_annulus_not_individual_positions_or_density';
  const inner=displayPosition([30,0,0])[0],outer=displayPosition([50,0,0])[0];
  const annulus=new THREE.Mesh(new THREE.RingGeometry(inner,outer,180),new THREE.MeshBasicMaterial({color:'#7eacc7',transparent:true,opacity:.025,depthWrite:false,side:THREE.DoubleSide}));annulus.rotation.x=-Math.PI/2;annulus.raycast=()=>{};group.add(annulus);
  const geometry=new THREE.BufferGeometry().setFromPoints(kuiperIllustrationPoints().map(point=>new THREE.Vector3().fromArray(point)));
  const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#9bc9e3',size:.8,sizeAttenuation:false,transparent:true,opacity:.3,depthWrite:false}));points.raycast=()=>{};group.add(points);return group;
}
