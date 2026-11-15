/** These CSS-pixel marks locate source-derived centres, never resolved disks or photometry. */
export const BODY_MARKER_ENTER_DIAMETER_PX=3;
export const BODY_MARKER_EXIT_DIAMETER_PX=4;

/** Perspective projected diameter uses camera-forward depth, not radial eye distance. */
export function projectedBodyDiameterPx(radius:number,viewDepth:number,height:number,verticalFovDeg:number):number|null{
  if(![radius,viewDepth,height,verticalFovDeg].every(Number.isFinite)||radius<=0||viewDepth<=0||height<=0||verticalFovDeg<=0||verticalFovDeg>=180)return null;
  const diameter=radius*height/(viewDepth*Math.tan(verticalFovDeg*Math.PI/360));
  return Number.isFinite(diameter)?diameter:null;
}

/** A small hysteresis band avoids a flickering glyph at the resolved/unresolved transition. */
export function needsBodyPositionMarker(diameterPx:number|null,previouslyVisible=false):boolean{
  return diameterPx!==null&&Number.isFinite(diameterPx)&&diameterPx>=0&&diameterPx<(previouslyVisible?BODY_MARKER_EXIT_DIAMETER_PX:BODY_MARKER_ENTER_DIAMETER_PX);
}
