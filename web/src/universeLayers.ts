import * as THREE from 'three';
import {displayPosition,type Vec3} from './sceneMath';
function seededRandom(seed:number){let state=seed>>>0;return()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}

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
