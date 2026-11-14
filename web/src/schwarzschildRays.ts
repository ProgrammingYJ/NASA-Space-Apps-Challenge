export const SCHWARZSCHILD_RAY_VERSION='schwarzschild-equatorial-null-rk4-v1' as const;
export const PHOTON_SPHERE_RS=1.5;
export const CRITICAL_IMPACT_RS=3*Math.sqrt(3)/2;
export const RAY_SOURCE_URL='https://arxiv.org/html/1103.0585v1';
/** Ideal vacuum shadow against a distant background, for a static observer. */
export function schwarzschildShadowHalfAngle(observerRadiusRs:number):number|null {
  if(!Number.isFinite(observerRadiusRs)||observerRadiusRs<=1)return null;
  const sine=CRITICAL_IMPACT_RS*Math.sqrt(1-1/observerRadiusRs)/observerRadiusRs;
  const acute=Math.asin(Math.min(1,Math.max(0,sine)));
  return observerRadiusRs>=PHOTON_SPHERE_RS?acute:Math.PI-acute;
}
export interface NullRay {impact_rs:number;points:[number,number][];status:'captured'|'escaped'|'truncated';closest_radius_rs:number|null;deflection_rad:number|null;max_invariant_error:number|null}
/**
 * Project derivation from Schwarzschild null first integrals (Belbruno &
 * Pretorius 2011, eqs 1/3/6): u=Rs/r, u''=1.5u²-u and
 * u'²+u²-u³=1/b², with b measured in Rs. Initial u=0 is past null infinity.
 * Coordinate-plane paths only: no time parameter, Kerr spin, emission transfer,
 * accretion image, or apparent observer-sky brightness is calculated.
 */
interface RayOptions {step?:number;maxAngle?:number;plotRadius?:number}
function integrateNullRay(impactRs:number,initialU:number,initialV:number,options:RayOptions,fromInfinity:boolean):NullRay {
  const step=options.step??.001,maxAngle=options.maxAngle??8*Math.PI,plotRadius=options.plotRadius??24;
  if(!Number.isFinite(impactRs)||!Number.isFinite(initialU)||!Number.isFinite(initialV)||!Number.isFinite(step)||step<.0001||step>.02||!Number.isFinite(maxAngle)||maxAngle<=0||maxAngle>40*Math.PI||!Number.isFinite(plotRadius)||plotRadius<3)throw new Error('invalid_schwarzschild_ray');
  const impact=Math.abs(impactRs),side=impactRs<0?-1:1;
  let u=initialU,v=initialV,angle=0,closest=initialU>0?1/initialU:Infinity,error=0;const points:[number,number][]=initialU>0?[[1/initialU,0]]:[];
  const acceleration=(value:number)=>1.5*value*value-value;
  for(let iteration=0;angle<maxAngle;iteration++){
    const oldU=u,oldAngle=angle,h=Math.min(step,impact*.002,maxAngle-angle);
    const k1u=v,k1v=acceleration(u),k2u=v+h*k1v/2,k2v=acceleration(u+h*k1u/2),k3u=v+h*k2v/2,k3v=acceleration(u+h*k2u/2),k4u=v+h*k3v,k4v=acceleration(u+h*k3u);
    u+=h*(k1u+2*k2u+2*k3u+k4u)/6;v+=h*(k1v+2*k2v+2*k3v+k4v)/6;angle+=h;
    if(!Number.isFinite(u)||!Number.isFinite(v))return {impact_rs:impactRs,points,status:'truncated',closest_radius_rs:Number.isFinite(closest)?closest:null,deflection_rad:null,max_invariant_error:null};
    error=Math.max(error,Math.abs(v*v+u*u-u*u*u-1/(impact*impact)));
    if(u<=0&&oldU>0){const root=oldAngle+h*oldU/(oldU-u);return {impact_rs:impactRs,points,status:'escaped',closest_radius_rs:closest,deflection_rad:fromInfinity?root-Math.PI:null,max_invariant_error:error};}
    if(u>0){
      if(u>=1){const horizonAngle=oldAngle+h*(1-oldU)/(u-oldU);points.push([Math.cos(horizonAngle),side*Math.sin(horizonAngle)]);return {impact_rs:impactRs,points,status:'captured',closest_radius_rs:1,deflection_rad:null,max_invariant_error:error};}
      const radius=1/u;closest=Math.min(closest,radius);
      if(radius<=plotRadius&&iteration%3===0)points.push([radius*Math.cos(angle),side*radius*Math.sin(angle)]);
    }
  }
  return {impact_rs:impactRs,points,status:'truncated',closest_radius_rs:Number.isFinite(closest)?closest:null,deflection_rad:null,max_invariant_error:error};
}
export function traceSchwarzschildNullRay(impactRs:number,options:RayOptions={}):NullRay {
  if(!Number.isFinite(impactRs)||(impactRs!==0&&(Math.abs(impactRs)<.0001||Math.abs(impactRs)>1e6)))throw new Error('invalid_schwarzschild_ray');
  if(impactRs===0)return {impact_rs:0,points:[[options.plotRadius??24,0],[1,0]],status:'captured',closest_radius_rs:1,deflection_rad:null,max_invariant_error:0};
  return integrateNullRay(impactRs,0,1/Math.abs(impactRs),options,true);
}
/**
 * Back-traced ray through a static observer's orthonormal sky angle alpha from
 * the inward radial direction. b/Rs=r sin(alpha)/sqrt(1-1/r), then the same
 * null first integral fixes u'. The chart is a coordinate-plane diagram.
 */
export function traceStaticObserverRay(observerRadiusRs:number,alphaRad:number,options:RayOptions={}):NullRay {
  if(!Number.isFinite(observerRadiusRs)||observerRadiusRs<1.01||observerRadiusRs>1e6||!Number.isFinite(alphaRad)||Math.abs(alphaRad)>Math.PI)throw new Error('invalid_static_observer_ray');
  const sine=Math.sin(alphaRad),cosine=Math.cos(alphaRad),plotRadius=options.plotRadius??1500;
  if(Math.abs(sine)<1e-10)return cosine>0?{impact_rs:0,points:[[observerRadiusRs,0],[1,0]],status:'captured',closest_radius_rs:1,deflection_rad:null,max_invariant_error:0}:{impact_rs:0,points:[[observerRadiusRs,0],[Math.max(plotRadius,observerRadiusRs),0]],status:'escaped',closest_radius_rs:observerRadiusRs,deflection_rad:null,max_invariant_error:0};
  const lapse=Math.sqrt(1-1/observerRadiusRs),impact=observerRadiusRs*sine/lapse,v=lapse/observerRadiusRs*cosine/Math.abs(sine);
  return integrateNullRay(impact,1/observerRadiusRs,v,{...options,plotRadius},false);
}
export function schwarzschildRayPath(ray:NullRay){return ray.points.map((point,i)=>(i?'L':'M')+point[0].toFixed(5)+' '+(-point[1]).toFixed(5)).join(' ');}
