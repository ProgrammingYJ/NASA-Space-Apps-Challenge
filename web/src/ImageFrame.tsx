import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Frame} from './types';
import styles from './Workbench.module.css';
export function ImageFrame({frame,contrast,label,onSelect,selected,objectLabel='ε Indi B'}:{frame:Frame;contrast:number;label:string;onSelect:()=>void;selected:boolean;objectLabel?:string}){
  const canvas=useRef<HTMLCanvasElement>(null);const {t}=useTranslation();const [pixel,setPixel]=useState<{x:number;y:number}|null>(null);
  useEffect(()=>{const ctx=canvas.current?.getContext('2d');if(!ctx)return;const {width,height,IMAGE}=frame.cutout;const finite=IMAGE.flat().filter((v):v is number=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);const lo=finite[Math.floor(finite.length*.02)]??0;const hi=finite[Math.floor(finite.length*.99)]??1;const span=hi-lo||1;const data=ctx.createImageData(width,height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=IMAGE[y][x];const i=(y*width+x)*4;const value=v===null?null:Math.max(0,Math.min(1,(Math.asinh(8*Math.max(0,(v-lo)/span)*contrast)/Math.asinh(8))));const grey=value===null?0:Math.round(value*255);data.data[i]=v===null?24:grey;data.data[i+1]=v===null?29:grey;data.data[i+2]=v===null?42:grey;data.data[i+3]=255;}ctx.putImageData(data,0,0);},[frame,contrast]);
  const cx=(frame.prediction.x-frame.cutout.native_origin.x+.5)/frame.cutout.width*100;const cy=(frame.cutout.height-(frame.prediction.y-frame.cutout.native_origin.y+.5))/frame.cutout.height*100;
  const val=(v:number|null|undefined)=>v===null||v===undefined?t('missing'):Number.isInteger(v)?v:v.toPrecision(7);
  return <article className={`${styles.frame} ${selected?styles.frameSelected:''}`} data-testid={`frame-${label}`}>
    <button className={styles.frameHead} onClick={onSelect} aria-pressed={selected}><span className={styles.frameLabel}>{label}</span><span><strong>{frame.metadata.release} · {frame.observation_id}</strong><small>{frame.metadata.date_avg} {frame.metadata.timesys}</small></span><span className={styles.actual}>{t('actual')}</span></button>
    <div className={styles.imageStage} style={{aspectRatio:`${frame.cutout.width}/${frame.cutout.height}`}} onPointerMove={event=>{const rect=event.currentTarget.getBoundingClientRect();setPixel({x:Math.min(frame.cutout.width-1,Math.max(0,Math.floor((event.clientX-rect.left)/rect.width*frame.cutout.width))),y:Math.min(frame.cutout.height-1,Math.max(0,frame.cutout.height-1-Math.floor((event.clientY-rect.top)/rect.height*frame.cutout.height)))});}} onPointerLeave={()=>setPixel(null)}>
      <canvas ref={canvas} width={frame.cutout.width} height={frame.cutout.height} role="img" aria-label={`${t('actual')} ${frame.observation_id} ${frame.metadata.date_avg}; ${t('unit')} ${frame.metadata.unit}`} />
      <div className={styles.crosshair} style={{left:`${cx}%`,top:`${cy}%`}} aria-hidden="true"><i/><b/></div>
      <span className={styles.imageAnnotation}>{t('prediction')} · {objectLabel}</span><span className={styles.scale}>{frame.cutout.width} × {frame.cutout.height} px</span>
    </div>
    <div className={styles.pixelReadout}>{pixel?<><span>({pixel.x+frame.cutout.native_origin.x}, {pixel.y+frame.cutout.native_origin.y})</span><span>IMAGE {val(frame.cutout.IMAGE[pixel.y][pixel.x])} {frame.metadata.unit}</span><span>FLAGS {frame.cutout.FLAGS[pixel.y][pixel.x]}</span><span>VARIANCE {val(frame.cutout.VARIANCE[pixel.y][pixel.x])}</span><span>ZODI {val(frame.cutout.ZODI[pixel.y][pixel.x])}</span></>:<span>{t('pixelHint')}</span>}</div>
  </article>;
}
