export type Vec3 = [number, number, number];
export interface CameraState {
  position: Vec3;
  target: Vec3;
  representation_version: 'solar-display-v1';
}

export const REPRESENTATION_VERSION = 'solar-display-v1';
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (v: Vec3, factor: number): Vec3 => [v[0] * factor, v[1] * factor, v[2] * factor];
export const magnitude = (v: Vec3) => Math.hypot(...v);
export function normalized(v: Vec3): Vec3 {
  const length = magnitude(v);
  return length > 1e-12 ? scale(v, 1 / length) : [0, 0.3713906763541037, 0.9284766908852594];
}

/** Radial display compression preserves direction; the output is not AU. */
export function displayPosition(positionAu: Vec3): Vec3 {
  const distanceAu = magnitude(positionAu);
  if (distanceAu === 0) return [0, 0, 0];
  const factor = 18 * Math.log1p(distanceAu) / distanceAu;
  return [positionAu[0] * factor, positionAu[2] * factor, -positionAu[1] * factor];
}

export function displayDirection(eclipticUnit: Vec3): Vec3 {
  return normalized([eclipticUnit[0], eclipticUnit[2], -eclipticUnit[1]]);
}

/** Transform every supplied guide vertex; nonlinear radial compression is not an ellipse transform. */
export function displayOrbitPoints(pointsAu: Vec3[]): Vec3[] {
  if(pointsAu.length<3||pointsAu.some(point=>!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)))return [];
  return pointsAu.map(displayPosition);
}

/** Deliberately exaggerated for navigation, independent of distance compression. */
export function displayRadius(radiusKm: number, isSun = false): number {
  if (isSun) return 2.65;
  return Math.min(1.65, Math.max(0.32, 0.4 + 0.43 * Math.log1p(Math.max(0, radiusKm) / 6371)));
}

export function focusDistance(radius: number, verticalFovDeg: number, aspect: number): number {
  const limitingHalfFov = Math.atan(Math.tan(verticalFovDeg * Math.PI / 360) * Math.min(1, Math.max(0.2, aspect)));
  return Math.max(radius * 3.5, radius / Math.sin(limitingHalfFov) * 1.8, 2.5);
}

export interface FocusTransition {
  from: CameraState;
  to: CameraState;
  startedAt: number;
  duration: number;
  objectId: string;
  directionOnly?: boolean;
}

export function makeFocus(
  current: CameraState,
  objectId: string,
  center: Vec3,
  radius: number,
  fov: number,
  aspect: number,
  startedAt: number,
  reducedMotion: boolean,
  directionOnly = false,
): FocusTransition {
  const offset = normalized(subtract(current.position, current.target));
  const target = directionOnly ? add(current.position, scale(displayDirection(center), 80)) : center;
  const position = directionOnly ? [...current.position] as Vec3 : add(center, scale(offset, focusDistance(radius, fov, aspect)));
  const travel = magnitude(subtract(current.position, position));
  return {
    from: { ...current, position: [...current.position], target: [...current.target] },
    to: { position, target, representation_version: REPRESENTATION_VERSION },
    startedAt,
    duration: reducedMotion ? 0 : directionOnly ? 1100 : Math.min(1500, Math.max(650, 550 + travel * 5)),
    objectId,
    directionOnly,
  };
}

export function sampleFocus(transition: FocusTransition, time: number): {camera: CameraState; done: boolean} {
  const raw = transition.duration === 0 ? 1 : Math.max(0, Math.min(1, (time - transition.startedAt) / transition.duration));
  if (raw === 1) return {camera:{...transition.to,position:[...transition.to.position],target:[...transition.to.target]},done:true};
  const eased = raw * raw * raw * (raw * (raw * 6 - 15) + 10);
  const lerp = (a: Vec3, b: Vec3): Vec3 => add(a, scale(subtract(b, a), eased));
  let target=lerp(transition.from.target,transition.to.target);
  if(transition.directionOnly){
    const from=subtract(transition.from.target,transition.from.position);const to=subtract(transition.to.target,transition.to.position);
    const a=normalized(from);const b=normalized(to);const dot=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
    const cross=(u:Vec3,v:Vec3):Vec3=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    let axis=cross(a,b);if(magnitude(axis)<1e-8)axis=cross(a,Math.abs(a[0])<.9?[1,0,0]:[0,1,0]);axis=normalized(axis);
    const angle=Math.acos(dot)*eased;
    const direction=add(scale(a,Math.cos(angle)),scale(cross(axis,a),Math.sin(angle)));
    const distance=Math.max(.05,magnitude(from)+(magnitude(to)-magnitude(from))*eased);
    target=add(lerp(transition.from.position,transition.to.position),scale(direction,distance));
  }
  return {
    camera: { position: lerp(transition.from.position, transition.to.position), target, representation_version: REPRESENTATION_VERSION },
    done: raw === 1,
  };
}

export function validCamera(value: CameraState | null | undefined): value is CameraState {
  if (!value || value.representation_version !== REPRESENTATION_VERSION) return false;
  if (!Array.isArray(value.position) || !Array.isArray(value.target) || value.position.length!==3 || value.target.length!==3) return false;
  if (![...value.position, ...value.target].every(Number.isFinite)) return false;
  const distance = magnitude(subtract(value.position, value.target));
  return distance >= 0.05 && distance < 10000 && magnitude(value.position) < 10000;
}
