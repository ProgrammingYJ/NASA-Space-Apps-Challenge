import {useEffect,useMemo,useRef,useState} from 'react';
import type {OuterTnoRow} from './OuterTnoPanel';
import {tnoCataloguePage} from './tnoSelection';
import {tnoSelectionCopy} from './TnoSelectionCopy';
import styles from './UniverseShell.module.css';

export default function TnoCatalogueBrowser({rows,language,overlapping,onChoose,onClose}:{rows:readonly OuterTnoRow[];language:string;overlapping:boolean;onChoose:(id:string)=>void;onClose:()=>void}){
  const copy=tnoSelectionCopy(language),[query,setQuery]=useState(''),[page,setPage]=useState(0);
  const search=useRef<HTMLInputElement>(null);
  useEffect(()=>{const previous=document.activeElement;search.current?.focus();return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
  const results=useMemo(()=>tnoCataloguePage(rows,query,page),[rows,query,page]);
  return <section className={styles.tnoBrowser} role="region" aria-label={overlapping?copy.overlap:copy.catalogue} data-testid="tno-catalogue-browser" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
    <div className={styles.tnoBrowserHeader}><strong>{overlapping?copy.overlap:copy.catalogue}</strong><button onClick={onClose} aria-label={copy.close}>×</button></div>
    <p>{overlapping?copy.pickNote:copy.markerNote}</p><label className={styles.tnoBrowserSearch}>{copy.search}<input ref={search} type="search" value={query} data-testid="tno-catalogue-search" onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
    <p role="status" data-testid="tno-catalogue-count">{copy.matches}: {results.total.toLocaleString(language)} / {rows.length.toLocaleString(language)}</p>
    <div className={styles.tnoBrowserList} data-testid="tno-catalogue-list">{results.rows.map(row=><button key={row.object_id} data-testid={`tno-row-${row.object_id}`} onClick={()=>onChoose(row.object_id)}><strong>{row.name}</strong><span className={styles.tnoCandidateMeta}>{row.object_id}{row.known_object_id&&` · ${copy.native}`}{!row.orbit&&` · ${copy.missingOrbit}`}</span></button>)}{!results.total&&<p>{copy.empty}</p>}</div>
    <div className={styles.tnoBrowserPager}><button disabled={!results.page} onClick={()=>setPage(results.page-1)}>{copy.previous}</button><label>{copy.page}<select data-testid="tno-catalogue-page" aria-label={copy.choosePage} value={results.page} onChange={event=>setPage(Number(event.target.value))}>{Array.from({length:results.pages},(_,index)=><option key={index} value={index}>{index+1} / {results.pages}</option>)}</select></label><button disabled={results.page+1>=results.pages} onClick={()=>setPage(results.page+1)}>{copy.next}</button></div>
  </section>;
}
