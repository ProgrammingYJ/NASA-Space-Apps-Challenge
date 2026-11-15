export interface PlatformIdentity {
  userAgent?:string;
  platform?:string;
  maxTouchPoints?:number;
  userAgentData?:{mobile?:boolean};
}

/** Capability policy for this PC-only release, independent of viewport width. */
export function isMobilePlatform(identity:PlatformIdentity):boolean {
  if(identity.userAgentData?.mobile===true)return true;
  const agent=identity.userAgent??'';
  if(/Android|iPhone|iPad|iPod|IEMobile|Windows Phone|Mobile/i.test(agent))return true;
  // iPadOS may request a desktop-class Safari agent and identify as MacIntel.
  return (identity.platform==='MacIntel'||/Macintosh/i.test(agent))&&(identity.maxTouchPoints??0)>1;
}
