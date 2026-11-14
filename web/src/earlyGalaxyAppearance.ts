import {seededRandom} from './historySceneMath';
import type {Vec3} from './sceneMath';

export const EARLY_GALAXY_RENDER_VERSION='cosmic-diversity-v1';
export const EARLY_GALAXY_SEED=473821;
export type EarlyGalaxyFamily='clumpy'|'compact'|'elongated'|'small_disk'|'disturbed_pair';
export type LaterGalaxyFamily='disk'|'spheroid'|'irregular'|'disturbed_pair';
const EARLY_FAMILIES:EarlyGalaxyFamily[]=['clumpy','compact','elongated','small_disk','disturbed_pair'];
const LATER_FAMILIES:LaterGalaxyFamily[]=['disk','spheroid','irregular','disturbed_pair'];

export interface ConceptualGalaxy {
  id:string;seed:number;node:Vec3;radius:number;orientation:Vec3;
  earlyFamily:EarlyGalaxyFamily;laterFamily:LaterGalaxyFamily;
  diskStartGyr:number;diskEndGyr:number;maturityStartGyr:number;maturityEndGyr:number;
}
export interface EarlyGalaxyField {
  seed:number;pointsPerModel:number;models:ConceptualGalaxy[];
  early:Float32Array;young:Float32Array;mature:Float32Array;
  earlyColors:Float32Array;matureColors:Float32Array;
}
export interface EarlyGalaxyFrame {
  activeFamilies:Record<string,number>;
  transitionProgress:number[];
  diskProgress:number[];
  sizeRange:[number,number];
  fingerprint:string;
}
const smooth=(start:number,end:number,time:number)=>{const x=Math.max(0,Math.min(1,(time-start)/(end-start)));return x*x*(3-2*x);};

function rotate(v:Vec3,euler:Vec3):Vec3 {
  const [a,b,c]=euler;let [x,y,z]=v;
  [y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];
  [x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];
  return [x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c),z];
}

/** Seeded illustration families, not a population sample, intrinsic deprojection or dynamical simulation. */
export function createEarlyGalaxyField(count=35,pointsPerModel=360,seed=EARLY_GALAXY_SEED):EarlyGalaxyField {
  if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(pointsPerModel)||pointsPerModel<24||pointsPerModel>1000)throw new Error('invalid_conceptual_field_size');
  const random=seededRandom(seed),models:ConceptualGalaxy[]=[];
  const length=count*pointsPerModel*3;
  const early=new Float32Array(length),young=new Float32Array(length),mature=new Float32Array(length),earlyColors=new Float32Array(length),matureColors=new Float32Array(length);
  for(let modelIndex=0;modelIndex<count;modelIndex++){
    const modelSeed=Math.floor(random()*4294967296),r=seededRandom(modelSeed);
    const earlyFamily=EARLY_FAMILIES[modelIndex%EARLY_FAMILIES.length],laterFamily=LATER_FAMILIES[Math.floor(r()*LATER_FAMILIES.length)];
    const model:ConceptualGalaxy={id:`conceptual-${modelIndex}`,seed:modelSeed,node:[(random()-.5)*220,(random()-.5)*75,(random()-.5)*155],radius:2.6+r()*5.7,orientation:[r()*Math.PI*2,r()*Math.PI*2,r()*Math.PI*2],earlyFamily,laterFamily,diskStartGyr:.7+r()*.7,diskEndGyr:1.6+r()*.9,maturityStartGyr:1.5+r()*2.8,maturityEndGyr:5.2+r()*6.5};
    models.push(model);
    const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(1e-9,r())))*Math.cos(r()*2*Math.PI);
    const arms=1+Math.floor(r()*3),pitch=1.5+r()*2.3,phase=r()*Math.PI*2;
    const clumpCenters:Vec3[]=Array.from({length:3+Math.floor(r()*3)},()=>[(r()-.5)*1.3,(r()-.5)*.9,(r()-.5)*.45]);
    const cloudPoint=(family:EarlyGalaxyFamily|LaterGalaxyFamily,index:number):Vec3=>{
      if(family==='compact'||family==='spheroid')return [gaussian()*.23,gaussian()*(family==='compact'?.2:.32),gaussian()*.2];
      if(family==='elongated')return [gaussian()*.55,gaussian()*.095,gaussian()*.1];
      if(family==='disturbed_pair'){
        if(index%5===0){const u=r();return [(u-.5)*1.4,.25*Math.sin(u*Math.PI*1.5)+gaussian()*.04,gaussian()*.09];}
        const side=index%3===0?1:-1;return [side*.44+gaussian()*(side>0?.14:.24),side*.12+gaussian()*.19,gaussian()*.18];
      }
      if(family==='small_disk'||family==='disk'){
        const radius=Math.pow(r(),.7);let angle=r()*Math.PI*2;
        if(family==='disk'&&index%4!==0)angle=(index%arms)*Math.PI*2/arms+Math.log(.2+radius)*pitch+phase+gaussian()*.17;
        return [Math.cos(angle)*radius,Math.sin(angle)*radius,gaussian()*(family==='small_disk'?.045:.055)];
      }
      const center=clumpCenters[index%clumpCenters.length];const spread=family==='irregular'?.2:.105;
      return [center[0]+gaussian()*spread,center[1]+gaussian()*spread,center[2]+gaussian()*spread*.8];
    };
    for(let point=0;point<pointsPerModel;point++){
      // A disk's precursor is compact; this illustration never introduces a disk before 0.7 Gyr.
      const first=cloudPoint(earlyFamily==='small_disk'?'compact':earlyFamily,point),middle=earlyFamily==='small_disk'?cloudPoint('small_disk',point):first,last=cloudPoint(laterFamily,point);
      const offset=(modelIndex*pointsPerModel+point)*3;
      for(const [array,value] of [[early,first],[young,middle],[mature,last]] as [Float32Array,Vec3][]){const turned=rotate(value,model.orientation);for(let axis=0;axis<3;axis++)array[offset+axis]=turned[axis]*model.radius;}
      const brightness=.68+r()*.5,pink=point%23===0;
      earlyColors.set(pink?[brightness,.42*brightness,.74*brightness]:[.53*brightness,.73*brightness,brightness],offset);
      const warm=laterFamily==='spheroid'||Math.hypot(last[0],last[1])<.22;
      matureColors.set(warm?[brightness,.83*brightness,.62*brightness]:[.56*brightness,.74*brightness,brightness],offset);
    }
  }
  return {seed,pointsPerModel,models,early,young,mature,earlyColors,matureColors};
}

/** Writes existing GPU buffers from age alone: seeking backwards reproduces exactly the same field. */
export function sampleEarlyGalaxyField(field:EarlyGalaxyField,inputAge:number,positions:Float32Array,colors:Float32Array):EarlyGalaxyFrame {
  if(positions.length!==field.early.length||colors.length!==field.early.length)throw new Error('conceptual_buffer_size_mismatch');
  const age=Number.isFinite(inputAge)?Math.max(0,Math.min(13.8,inputAge)):0;
  const activeFamilies:Record<string,number>={},transitionProgress:number[]=[],diskProgress:number[]=[];let smallest=Infinity,largest=0;
  for(let modelIndex=0;modelIndex<field.models.length;modelIndex++){
    const model=field.models[modelIndex],disk=model.earlyFamily==='small_disk'?smooth(model.diskStartGyr,model.diskEndGyr,age):0,maturity=smooth(model.maturityStartGyr,model.maturityEndGyr,age);
    const growth=.6+.4*smooth(.28,model.maturityEndGyr,age),brightness=.62+.38*smooth(.28,model.maturityStartGyr,age);
    transitionProgress.push(maturity);diskProgress.push(disk);smallest=Math.min(smallest,model.radius*growth);largest=Math.max(largest,model.radius*growth);
    const family=maturity>.5?model.laterFamily:model.earlyFamily==='small_disk'?(disk>.3?'small_disk':'compact'):model.earlyFamily;
    if(age>=.28)activeFamilies[family]=(activeFamilies[family]??0)+1;
    for(let point=0;point<field.pointsPerModel;point++){
      const offset=(modelIndex*field.pointsPerModel+point)*3;
      for(let axis=0;axis<3;axis++){
        const index=offset+axis,initial=field.early[index]+(field.young[index]-field.early[index])*disk;
        positions[index]=model.node[axis]+(initial+(field.mature[index]-initial)*maturity)*growth;
        colors[index]=(field.earlyColors[index]+(field.matureColors[index]-field.earlyColors[index])*maturity)*brightness;
      }
    }
  }
  // This diagnostic hashes sampled, already-written vertex values; it is not a scientific data hash.
  let hash=2166136261;for(let i=0;i<positions.length;i+=13){hash=Math.imul(hash^Math.round(positions[i]*10000),16777619);hash=Math.imul(hash^Math.round(colors[i]*10000),16777619);}
  return {activeFamilies,transitionProgress,diskProgress,sizeRange:[smallest,largest],fingerprint:(hash>>>0).toString(16).padStart(8,'0')};
}
