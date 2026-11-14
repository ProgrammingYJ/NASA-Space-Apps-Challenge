import {it,expect} from 'vitest';
import {modelDateMs} from './longTermMath';
import {resolveModelTime,modelTimeBounds,parseCalendarInput,calendarInputText,advanceModelTime} from './modelTime';
const precise={start:modelDateMs(2026,11,13),end:modelDateMs(2026,11,16)},fitted={start:modelDateMs(-2999),end:modelDateMs(3000)};
it('prefers actual Horizons samples only inside their inclusive acquired range and selects the fitted source elsewhere',()=>{
  for(const ms of [precise.start,precise.end,modelDateMs(2026,11,14)])expect(resolveModelTime(ms,'auto',precise,fitted)).toEqual({ok:true,source:'ephemeris'});
  for(const ms of [precise.start-1,precise.end+1,modelDateMs(2026,1,1),modelDateMs(2026,12,31),modelDateMs(0),fitted.start,fitted.end])expect(resolveModelTime(ms,'auto',precise,fitted)).toEqual({ok:true,source:'simulation'});
  for(const ms of [fitted.start-1,fitted.end+1])expect(resolveModelTime(ms,'auto',precise,fitted)).toEqual({ok:false,reason:'unsupported'});
  expect(resolveModelTime(precise.start,'simulation',precise,fitted)).toEqual({ok:true,source:'simulation'});
  expect(resolveModelTime(precise.start-1,'ephemeris',precise,fitted)).toEqual({ok:false,reason:'unsupported'});
  expect(resolveModelTime(precise.start-1,'auto',precise,null)).toEqual({ok:false,reason:'source_unavailable'});
  expect(resolveModelTime(NaN,'auto',precise,fitted)).toEqual({ok:false,reason:'invalid'});
  expect(modelTimeBounds('auto',precise,fitted)).toEqual(fitted);expect(modelTimeBounds('ephemeris',precise,fitted)).toEqual(precise);expect(modelTimeBounds('simulation',precise,null)).toBeNull();
});
it('parses signed years, year zero and real leap days without JS Date year 0..99 coercion',()=>{
  for(const year of [-2999,0,99,2026,2500,3000]){const ms=modelDateMs(year);expect(parseCalendarInput(calendarInputText(ms))).toBe(ms);}
  expect(parseCalendarInput('0000-02-29T23:59:59')).toBe(modelDateMs(0,2,29)+86399000);
  expect(parseCalendarInput('2026-11-15T00:00')).toBe(modelDateMs(2026,11,15));
  for(const text of ['', '2026-02-29','2026-13-1','2026-11-14T24:00','2026-11-14T00:60','1e3-1-1','2026-11-14Z'])expect(()=>parseCalendarInput(text)).toThrow();
});
it('advances across the source boundary with one calendar clock and bounds late or negative frame intervals',()=>{
  const step=advanceModelTime(precise.end-3600000,100,24,fitted);expect(step.ms).toBeGreaterThan(precise.end);expect(step.ended).toBe(false);
  expect(resolveModelTime(step.ms,'auto',precise,fitted)).toEqual({ok:true,source:'simulation'});
  expect(advanceModelTime(fitted.end-1,100,876600,fitted)).toEqual({ms:fitted.end,ended:true});
  expect(advanceModelTime(precise.start,-100,6,fitted).ms).toBe(precise.start);
  expect(advanceModelTime(precise.start,10000,6,fitted).ms-precise.start).toBe(2160000);
});
