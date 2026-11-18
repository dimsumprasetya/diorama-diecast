import * as THREE from 'three';
import { ITEMS, byId } from '../../shared/catalog.ts';
import type { Design, FloorItem, PlacedItem, PreviewCar, WallItem, WallSide } from '../../shared/design.ts';
import { carSize } from '../three/builders.ts';
import { dims, wallFrame, type Dims } from '../three/diorama.ts';

export const SNAP = 0.05;
export const ROT_STEP = 15;

const snap = (v: number, step = SNAP) => Math.round(v / step) * step;
const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/** Setengah ukuran tapak (setelah diputar). */
function halfExtents(w: number, d: number, rotDeg: number) {
  const a = THREE.MathUtils.degToRad(rotDeg);
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { hx: (w / 2) * c + (d / 2) * s, hz: (w / 2) * s + (d / 2) * c };
}

export function itemFootprint(item: PlacedItem): [number, number, number] {
  const def = byId(ITEMS, item.id)!;
  const k = item.scale ?? 1;
  return [def.size[0] * k, def.size[1] * k, def.size[2] * k];
}

export function clampFloor<T extends { x: number; z: number; rot: number }>(it: T, w: number, d: number, D: Dims): T {
  const { hx, hz } = halfExtents(w, d, it.rot);
  return { ...it, x: clamp(snap(it.x), -D.w / 2 + hx, D.w / 2 - hx), z: clamp(snap(it.z), -D.d / 2 + hz, D.d / 2 - hz) };
}

export function clampItem(it: PlacedItem, D: Dims): PlacedItem {
  const [w, h, d] = itemFootprint(it);
  if (it.mount === 'floor') return clampFloor(it as FloorItem, w, d, D);
  const def = byId(ITEMS, it.id)!;
  const len = wallFrame(it.wall, D).length;
  const hw = w / 2;
  return {
    ...it,
    u: clamp(snap(it.u), -len / 2 + hw, len / 2 - hw),
    v: def.wallOnFloor ? 0 : clamp(snap(it.v), 0, D.h - h),
  } as WallItem;
}

export function clampCar(c: PreviewCar, D: Dims): PreviewCar {
  const [w, , d] = carSize(c.model);
  return clampFloor(c, w, d, D);
}

/** Titik di lantai/dinding yang ditunjuk oleh ray kamera. */
export function hitSurface(ray: THREE.Ray, design: Design, mount: 'floor' | 'wall', preferWall?: WallSide):
  | { mount: 'floor'; x: number; z: number }
  | { mount: 'wall'; wall: WallSide; u: number; v: number }
  | null {
  const D = dims(design);
  if (mount === 'floor') {
    const p = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!p) return null;
    return { mount: 'floor', x: p.x, z: p.z };
  }
  let best: { wall: WallSide; u: number; v: number; dist: number } | null = null;
  const sides: WallSide[] = preferWall ? [preferWall] : ['back', 'left', 'right'];
  for (const side of sides) {
    const f = wallFrame(side, D);
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rotY);
    if (!preferWall && ray.direction.dot(normal) >= 0) continue;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, f.origin);
    const p = ray.intersectPlane(plane, new THREE.Vector3());
    if (!p) continue;
    const u = p.clone().sub(f.origin).dot(f.uDir);
    const v = p.y;
    const inside = Math.abs(u) <= f.length / 2 + 0.3 && v >= -0.3 && v <= D.h + 0.3;
    if (!inside && !preferWall) continue;
    const dist = ray.origin.distanceTo(p);
    if (!best || dist < best.dist) best = { wall: side, u, v, dist };
  }
  return best ? { mount: 'wall', wall: best.wall, u: best.u, v: best.v } : null;
}
