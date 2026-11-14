import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import styles from './PlanetCriteriaPanel.module.css';

interface Source {url:string;label?:string}
type Status='met'|'not_met'|'unknown'|'not_applicable';
interface Criterion {id:'orbits_sun'|'equilibrium_shape'|'orbital_dominance';status:Status;basis:string;reason_key:string;source:Source}
export interface PlanetCriterionObject {
  object_id:string;name:string;official_classification:'planet'|'dwarf_planet'|'dwarf_candidate';
  criteria:Criterion[];
  orbit:{semimajor_axis_au:number;eccentricity:number;perihelion_au:number;aphelion_au:number;epoch_tdb_jd:number;source:Source};
  mass:{earth_masses:number|null;status:string;source:Source|null};
  system_mass?:{earth_masses:number;uncertainty_earth?:number|null;definition:string;source:Source};
  clearing:{minimum_mass_earth:number;pi:number|null;status:string;model_classification:'meets_model'|'below_model'|'unknown'};
  limitations:string[];
}
export interface PlanetCriteriaCatalogue {
  schema_version:string;algorithm_version:string;source_manifest_sha256:string;
  model:{id:string;coefficient_earth_mass:number;semimajor_exponent:number;host_mass_solar:number;clearing_time_gyr:number;hill_zone_factor:number;formula:string;source:Source;limitations:string[]};
  objects:Record<string,PlanetCriterionObject>;
}
const supported=new Set(['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto','ceres','haumea','makemake','eris','sedna','quaoar','orcus','gonggong']);
export const hasPlanetCriteria=(id:string)=>supported.has(id);

function OrbitDiagram({object}:{object:PlanetCriterionObject}){
  const {t,i18n}=useTranslation();const {semimajor_axis_au:a,eccentricity:e,perihelion_au:q,aphelion_au:Q}=object.orbit;
  if(!Number.isFinite(a)||a<=0||!Number.isFinite(e)||e<0||e>=1)return null;
  const rx=220,ry=rx*Math.sqrt(1-e*e),sun=-rx*e;
  const format=(value:number)=>value.toLocaleString(i18n.language,{maximumSignificantDigits:5});
  return <figure className={styles.orbit} data-testid="criteria-orbit-diagram" data-semimajor-au={a} data-eccentricity={e} data-sun-focus-x={sun}>
    <svg viewBox="-280 -255 560 525" role="img" aria-label={t('criteriaOrbitDiagram')}>
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill="none" stroke="#90bada" strokeWidth="2"/>
      <line x1="-240" y1="0" x2="240" y2="0" stroke="#3a526b" strokeDasharray="4 5"/>
      <circle cx={sun} cy="0" r="6" fill="#ffda85"/><text x={sun} y="-16" textAnchor="middle" fill="#ffda85">{t('criteriaSun')}</text>
      <circle cx="0" cy="0" r="3" fill="#b5c5d9"/><text x="0" y="21" textAnchor="middle">{t('criteriaCenter')}</text>
      <path d={`M0 33 V43 H${rx} V33`} fill="none" stroke="#ffb181" strokeWidth="2"/><text x={rx/2} y="65" textAnchor="middle" fill="#ffb181">a = {format(a)} au</text>
      <line x1={-rx} y1="-55" x2={sun} y2="-55" stroke="#96d4c4"/><text x={(-rx+sun)/2} y="-68" textAnchor="middle" fill="#96d4c4">q</text>
      <line x1={sun} y1="-100" x2={rx} y2="-100" stroke="#9ea6df"/><text x={(sun+rx)/2} y="-113" textAnchor="middle" fill="#b9bff1">Q</text>
    </svg>
    <figcaption>{t('criteriaOrbitDiagram')}<br/>{t('criteriaSemimajorNote')}</figcaption>
    <dl><div><dt>{t('criteriaPerihelion')}</dt><dd>{format(q)} au</dd></div><div><dt>{t('criteriaAphelion')}</dt><dd>{format(Q)} au</dd></div></dl>
  </figure>;
}

export default function PlanetCriteriaPanel({objectId,name,catalogue,loading,error,onRetry}:{objectId:string;name:string;catalogue?:PlanetCriteriaCatalogue;loading:boolean;error:boolean;onRetry:()=>void}){
  const {t,i18n}=useTranslation();const [expanded,setExpanded]=useState(false);const dialog=useRef<HTMLDivElement>(null);
  const object=catalogue?.objects[objectId];const applicable=hasPlanetCriteria(objectId);
  useEffect(()=>{setExpanded(false);},[objectId]);
  useEffect(()=>{if(!expanded)return;const previous=document.querySelector<HTMLElement>('[data-testid="open-planet-criteria"]');const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);if(event.key==='Tab'){const items=dialog.current?.querySelectorAll<HTMLElement>('button,a[href],summary');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);previous?.focus();};},[expanded]);
  const number=(value:number)=>value.toLocaleString(i18n.language,{maximumSignificantDigits:5});
  const massLine=object?t('criteriaMinimumMass',{minimum:number(object.clearing.minimum_mass_earth),current:object.mass.earth_masses===null?t('criteriaMassUnknown'):`${number(object.mass.earth_masses)} M⊕`}):'';
  function rows(full:boolean){return object?.criteria.map(row=><div key={row.id} className={styles.criterion} data-testid={`criterion-${row.id}`} data-status={row.status}>
    <div><strong>{t(`criteria_${row.id}`)}</strong><span className={styles.badge} data-status={row.status}>{row.status==='met'?'✓':row.status==='not_met'?'×':'—'} {t(`criteriaStatus_${row.status}`)}</span></div>
    {row.id==='orbital_dominance'&&<><p className={styles.mass} data-testid="criteria-minimum-mass">{massLine}</p><p className={styles.modelLabel}>{t('criteriaModelLabel')} · {t('criteriaEarthMassUnit')}</p>{object.system_mass&&<p data-testid="criteria-system-mass">{t('criteriaSystemMass',{mass:number(object.system_mass.earth_masses)})}<br/>{t('criteriaSystemMassNote')}{full&&<a href={object.system_mass.source.url} target="_blank" rel="noreferrer"> {t('source')} ↗</a>}</p>}</>}
    {full&&<p>{t(`criteriaReason_${row.reason_key}`)} <a href={row.source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a></p>}
  </div>);}
  return <section className={styles.card} data-testid="planet-criteria-card" data-object-id={objectId}>
    <h2>{t('criteriaTitle')}</h2>
    {!applicable?<p data-testid="criteria-not-applicable">{t('criteriaNotApplicable')}</p>:error?<p role="alert">{t('criteriaError')} <button onClick={onRetry}>{t('retry')}</button></p>:loading||!object?<p role="status">{t('loading')}</p>:<>
      {rows(false)}<button data-testid="open-planet-criteria" onClick={()=>setExpanded(true)}>{t('criteriaExpand')} ↗</button>
    </>}
    {expanded&&object&&catalogue&&createPortal(<div className={styles.backdrop}><div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="planet-criteria-title" data-testid="planet-criteria-dialog" data-object-id={objectId}>
      <header><div><small>{t('criteriaClassLabel')} · <span data-testid="criteria-official-class">{t(`criteriaClass_${object.official_classification}`)}</span></small><h1 id="planet-criteria-title">{name} · {t('criteriaTitle')}</h1></div><button autoFocus onClick={()=>setExpanded(false)}>{t('close')} ×</button></header>
      <div className={styles.body}><section>{rows(true)}<p className={styles.notice}>{t('criteriaDefinitionNote')}</p>
        <section className={styles.calculation} data-testid="criteria-clearing-model"><h2>{t('criteriaModelLabel')}</h2><p className={styles.mass}>{massLine}</p><code>m_clear ≈ {catalogue.model.coefficient_earth_mass} (a / au)<sup>9/8</sup> M⊕</code><p>{t('criteriaModelNote')}</p><p className={styles.notice}>{t('criteriaEccentricNote',{eccentricity:number(object.orbit.eccentricity)})}</p>
          <dl><div><dt>{t('criteriaSemimajor')}</dt><dd data-testid="criteria-semimajor">{number(object.orbit.semimajor_axis_au)} au</dd></div><div><dt>{t('criteriaPi')}</dt><dd data-testid="criteria-pi">{object.clearing.pi===null?t('criteriaMassUnknown'):number(object.clearing.pi)} · {t(`criteria_${object.clearing.model_classification==='unknown'?'model_unknown':object.clearing.model_classification}`)}</dd></div><div><dt>{t('criteriaElementsEpoch')}</dt><dd>JD {object.orbit.epoch_tdb_jd} TDB <a href={object.orbit.source.url} target="_blank" rel="noreferrer">{t('source')} ↗</a></dd></div></dl>
          {object.mass.source&&<a href={object.mass.source.url} target="_blank" rel="noreferrer">{t('source')} · {object.mass.source.label??'JPL'} ↗</a>}<p><a href={catalogue.model.source.url} target="_blank" rel="noreferrer">{catalogue.model.source.label??'Margot'} ↗</a></p>
        </section><details><summary>{t('displayAssumptions')}</summary>{[...catalogue.model.limitations,...object.limitations].map((note,index)=><p key={index} lang="en">{note}</p>)}<p className={styles.hash}>SHA256 {catalogue.source_manifest_sha256}</p></details>
      </section><OrbitDiagram object={object}/></div>
    </div></div>,document.body)}
  </section>;
}
