import {modelDateMs} from './longTermMath';
import type {Bounds} from './timelineMath';
export const MODEL_TIME_RATES=[1,6,24,72,8766,87660,876600] as const;
export type ModelTimeRate=typeof MODEL_TIME_RATES[number];
export type TimePreference='auto'|'ephemeris'|'simulation';
export type TimeSource='ephemeris'|'simulation';
export type TimeResolution={ok:true;source:TimeSource}|{ok:false;reason:'invalid'|'unsupported'|'source_unavailable'};
const contains=(bounds:Bounds|null,ms:number)=>bounds!==null&&ms>=bounds.start&&ms<=bounds.end;
/** Source selection uses source-specific calendar labels, not a UTC/TDB conversion. */
export function resolveModelTime(ms:number,preference:TimePreference,precise:Bounds|null,fitted:Bounds|null):TimeResolution {
  if(!Number.isFinite(ms))return {ok:false,reason:'invalid'};
  if(preference!=='simulation'&&contains(precise,ms))return {ok:true,source:'ephemeris'};
  if(preference!=='ephemeris'&&contains(fitted,ms))return {ok:true,source:'simulation'};
  if((preference==='simulation'&&!fitted)||(preference==='ephemeris'&&!precise)||(preference==='auto'&&(!precise||!fitted)))return {ok:false,reason:'source_unavailable'};
  return {ok:false,reason:'unsupported'};
}
export function modelTimeBounds(preference:TimePreference,precise:Bounds|null,fitted:Bounds|null):Bounds|null {
  if(preference==='ephemeris')return precise;if(preference==='simulation')return fitted;
  if(!precise)return fitted;if(!fitted)return precise;
  return {start:Math.min(precise.start,fitted.start),end:Math.max(precise.end,fitted.end)};
}
export function calendarInputText(ms:number){return new Date(ms).toISOString().replace(/\.\d{3}Z$/,'');}
/** Signed proleptic Gregorian year, including astronomical year zero. */
export function parseCalendarInput(value:string):number {
  const match=/^([+-]?\d{1,6})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if(!match)throw new Error('invalid_model_time');
  const [,year,month,day,hour='0',minute='0',second='0']=match;
  const h=Number(hour),m=Number(minute),s=Number(second);
  if(h>23||m>59||s>59)throw new Error('invalid_model_time');
  return modelDateMs(Number(year),Number(month),Number(day))+(h*3600+m*60+s)*1000;
}
export function advanceModelTime(ms:number,elapsedMs:number,rate:ModelTimeRate,bounds:Bounds){
  if(![ms,elapsedMs,bounds.start,bounds.end].every(Number.isFinite)||bounds.end<=bounds.start||!MODEL_TIME_RATES.includes(rate))throw new Error('invalid_model_clock');
  const next=Math.min(bounds.end,Math.max(bounds.start,ms)+Math.max(0,Math.min(100,elapsedMs))*rate*3600);
  return {ms:next,ended:next===bounds.end};
}
