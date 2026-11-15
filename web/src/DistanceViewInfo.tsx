import type {DistanceView,Vec3} from './sceneMath';
import type {UniverseBody} from './UniverseScene';
import type {Locale} from './types';
import {distanceViewCopy} from './DistanceViewCopy';
import styles from './DistanceViewInfo.module.css';

const AU_KM=149597870.7;
function separation(a:Vec3|undefined,b:Vec3|undefined):number|null {
  if(!a||!b||![...a,...b].every(Number.isFinite))return null;
  return Math.hypot(...a.map((value,index)=>value-b[index]));
}
export default function DistanceViewInfo({view,bodies,epoch,language,labels,onOverview,onViewSystem,viewSystemLabel}:{view:DistanceView;bodies:UniverseBody[];epoch:string;language:Locale;labels:Record<string,string>;onOverview:()=>void;onViewSystem?:()=>void;viewSystemLabel?:string}){
  const copy=distanceViewCopy(language),local=view.algorithm_version==='parent-linear-distance-v1';
  const earth=bodies.find(body=>body.object_id==='earth'),moon=bodies.find(body=>body.object_id==='moon-301'),venus=bodies.find(body=>body.object_id==='venus');
  const moonDistance=separation(earth?.position_au,moon?.position_au),venusDistance=separation(earth?.position_au,venus?.position_au);
  const ratio=moonDistance!==null&&moonDistance>0&&venusDistance!==null?venusDistance/moonDistance:null;
  const km=(value:number|null)=>value===null?copy.unknown:`${(value*AU_KM).toLocaleString(language,{maximumFractionDigits:0})} km`;
  const reference=bodies.find(body=>body.object_id===view.origin_object_id);
  return <section className={styles.info} data-testid="distance-view-info">
    <strong>{copy.title}</strong>
    <p>{local?copy.localNotice:view.algorithm_version==='legacy-expanded-v1'?copy.legacyNotice:copy.overview}</p>
    {local&&<>
      {view.origin_object_id==='earth'&&<dl>
        <div><dt>{copy.earthMoon}</dt><dd data-testid="earth-moon-distance-au" data-value-au={moonDistance??''}>{km(moonDistance)}</dd></div>
        <div><dt>{copy.earthVenus}</dt><dd data-testid="earth-venus-distance-au" data-value-au={venusDistance??''}>{km(venusDistance)}</dd></div>
        <div><dt>{copy.ratio}</dt><dd data-testid="distance-ratio" data-value={ratio??''}>{ratio===null?copy.unknown:ratio.toLocaleString(language,{maximumFractionDigits:2})}</dd></div>
      </dl>}
      <p>{copy.localLayersNotice}</p>
      <details><summary>{copy.source}</summary><p>{copy.origin}: {labels[view.origin_object_id??'']??view.origin_object_id}</p><p>{copy.currentEpoch}: {epoch}</p><p>{copy.approximationNotice}</p>
      {reference?.source?.url&&<a href={reference.source.url} target="_blank" rel="noreferrer">JPL ↗</a>}</details>
      {onViewSystem&&<button data-testid="distance-frame-system" onClick={onViewSystem}>{viewSystemLabel}</button>}
      <button data-testid="return-distance-overview" onClick={onOverview}>{copy.returnOverview}</button>
    </>}
  </section>;
}
