/** Browser scheduling only. It does not change a solver's physical time step. */
export interface PlaybackClock {lastMs:number;debt:number}
export function advancePlaybackClock(clock:PlaybackClock,nowMs:number,rate:number,maxSteps:number):PlaybackClock&{steps:number} {
  if(!Number.isFinite(clock.lastMs)||clock.lastMs<0||!Number.isFinite(clock.debt)||clock.debt<0||!Number.isFinite(nowMs)||nowMs<0||!Number.isFinite(rate)||rate<0||rate>1e6||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>500)throw new Error('invalid_playback_clock');
  // rAF timestamps mark frame start and can precede performance.now() in an effect.
  const elapsed=Math.max(0,Math.min(100,nowMs-clock.lastMs)),debt=clock.debt+elapsed*rate/1000,steps=Math.min(maxSteps,Math.floor(debt));
  return {lastMs:Math.max(clock.lastMs,nowMs),debt:debt-steps,steps};
}
