import * as THREE from 'three';
import { FLOOR_BACKGROUNDS, ITEMS, WALL_BACKGROUNDS, boxReal, byId, cmToReal, type PanelId } from '../../shared/catalog.ts';
import type { Design, PlacedItem, WallSide } from '../../shared/design.ts';
import { buildCar, buildItem } from './builders.ts';
import { buildDecal } from './decals.ts';
import { mat } from './materials.ts';
import { textTexture, texturesFor } from './textures.ts';

/** Semua satuan 3D = meter dunia nyata (skala 1:64 → 1 m = 1,5625 cm). */

export type Dims = {
  w: number;
  d: number;
  h: number;
  baseMargin: number;
  baseThick: number;
  acrylic: number;
  lidOver: number;
  lidThick: number;
  panelThick: number;
};

export function dims(design: Pick<Design, 'size'>): Dims {
  const b = boxReal(design.size);
  return {
    ...b,
    baseMargin: cmToReal(0.8),
    baseThick: cmToReal(0.5),
    acrylic: cmToReal(0.2),
    lidOver: cmToReal(0.5),
    lidThick: cmToReal(0.3),
    panelThick: cmToReal(0.08),
  };
}

export type WallFrame = { origin: THREE.Vector3; rotY: number; uDir: THREE.Vector3; length: number };

/** Sistem koordinat tiap dinding: u = posisi mendatar dilihat dari dalam box (kiri → kanan). */
export function wallFrame(side: WallSide, d: Pick<Dims, 'w' | 'd'>): WallFrame {
  if (side === 'left') return { origin: new THREE.Vector3(-d.w / 2, 0, 0), rotY: Math.PI / 2, uDir: new THREE.Vector3(0, 0, -1), length: d.d };
  if (side === 'right') return { origin: new THREE.Vector3(d.w / 2, 0, 0), rotY: -Math.PI / 2, uDir: new THREE.Vector3(0, 0, 1), length: d.d };
  return { origin: new THREE.Vector3(0, 0, -d.d / 2), rotY: 0, uDir: new THREE.Vector3(1, 0, 0), length: d.w };
}

/** Jarak tiap lapisan stiker dari permukaan (supaya tidak saling tembus). */
export const LAYER = { grime: 0.006, decal: 0.012, step: 0.003 };

/** Terapkan posisi item ke objek 3D. `layer` = urutan stiker (yang belakangan di atas). */
export function placeObject(obj: THREE.Object3D, item: PlacedItem, d: Dims, layer = 0) {
  const def = byId(ITEMS, item.id);
  const lift = def?.kind === 'decal' ? LAYER.decal + layer * LAYER.step : 0;
  if (item.mount === 'floor') {
    obj.position.set(item.x, lift, item.z);
    obj.rotation.set(0, THREE.MathUtils.degToRad(item.rot), 0);
  } else {
    const f = wallFrame(item.wall, d);
    obj.position.copy(f.origin).addScaledVector(f.uDir, item.u);
    obj.position.y = item.v;
    obj.rotation.set(0, f.rotY, 0);
    obj.translateZ(lift);
  }
}

export function buildPlaced(item: PlacedItem): THREE.Group {
  const def = byId(ITEMS, item.id);
  if (def?.kind === 'decal') return buildDecal(item.id, { color: item.color, text: item.text, scale: item.scale });
  return buildItem(item.id, { color: item.color });
}

// ---------------------------------------------------------------- panel print

const ROUGH: Record<string, number> = { 'asphalt-wet': 0.22, epoxy: 0.32, tiles: 0.35, 'tile-wall': 0.3 };

const panelMatCache = new Map<string, THREE.MeshStandardMaterial>();

/** Material print panel; null = bening (tanpa print). */
export function panelMaterial(panel: PanelId, spec: { bg: string; color?: string }, w: number, h: number): THREE.MeshStandardMaterial | null {
  const list = panel === 'floor' ? FLOOR_BACKGROUNDS : WALL_BACKGROUNDS;
  const bg = byId(list, spec.bg) ?? list[0];
  if (bg.id === 'clear') return null;
  const key = `${panel}|${bg.id}|${spec.color ?? ''}|${w.toFixed(3)}|${h.toFixed(3)}`;
  let m = panelMatCache.get(key);
  if (m) return m;
  const t = texturesFor(bg.id, w, h);
  m = new THREE.MeshStandardMaterial({
    map: t.map,
    ...(t.bump ? { bumpMap: t.bump, bumpScale: 1.2 } : {}),
    color: bg.colorable ? spec.color ?? '#ffffff' : '#ffffff',
    roughness: ROUGH[bg.id] ?? 0.85,
    metalness: bg.id === 'asphalt-wet' ? 0.15 : 0,
  });
  panelMatCache.set(key, m);
  return m;
}

const GRIME_OPACITY: Record<string, number> = { none: 0, light: 0.5, heavy: 0.95 };

function grimeMaterial(level: string, w: number, h: number) {
  const t = texturesFor('grime', w, h);
  return new THREE.MeshBasicMaterial({ map: t.map, transparent: true, opacity: GRIME_OPACITY[level] ?? 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

const sideMat = () => mat('#d8d6d0', 0.9);

// ---------------------------------------------------------------- box shell

export type Shell = {
  group: THREE.Group;
  /** mesh permukaan untuk raycast saat menaruh aset */
  surfaces: { floor: THREE.Object3D; walls: Partial<Record<WallSide, THREE.Object3D>> };
  /** grup tiap dinding (panel + efek usang) — disembunyikan saat kamera di belakangnya */
  wallGroups: Record<WallSide, THREE.Group>;
  caseGroup: THREE.Group;
  ledStrip: THREE.Object3D | null;
};

export function buildShell(design: Design): Shell {
  const D = dims(design);
  const g = new THREE.Group();

  // base akrilik hitam
  // ukuran luar kotak akrilik: area print + tebal panel (belakang/kiri/kanan) + tebal akrilik
  const A = D.acrylic;
  const P = D.panelThick;
  const outerW = D.w + (P + A) * 2;
  const outerD = D.d + P + A * 2;
  const cz = -P / 2;
  const bw = outerW + D.baseMargin * 2;
  const bd = outerD + D.baseMargin * 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(bw, D.baseThick, bd), new THREE.MeshPhysicalMaterial({ color: '#08080a', roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }));
  base.position.set(0, -D.baseThick / 2, cz);
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  // tulisan di base
  if (design.options.baseText.trim()) {
    // rasio gambar teks = rasio bidang tulisan, supaya huruf tidak melebar/gepeng
    const planeW = bw * 0.8;
    const planeH = D.baseThick * 0.7;
    const texH = 96;
    const texW = Math.min(4096, Math.round((texH * planeW) / planeH));
    const tex = textTexture(design.options.baseText.trim(), { color: '#f2f2ee', width: texW, height: texH, font: 'Montserrat, "Arial Black", sans-serif' });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    plate.position.set(0, -D.baseThick / 2, cz + bd / 2 + 0.002);
    g.add(plate);
  }

  // lantai
  const floorMat = panelMaterial('floor', design.panels.floor, D.w, D.d) ?? mat('#111', 0.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(D.w, D.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  floor.receiveShadow = true;
  floor.userData.surface = 'floor';
  g.add(floor);
  if (design.grime !== 'none') {
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(D.w, D.d), grimeMaterial(design.grime, D.w, D.d));
    gr.rotation.x = -Math.PI / 2;
    gr.position.y = LAYER.grime;
    gr.raycast = () => {};
    g.add(gr);
  }

  // dinding (print)
  const walls: Partial<Record<WallSide, THREE.Object3D>> = {};
  const wallGroups = {} as Record<WallSide, THREE.Group>;
  for (const side of ['back', 'left', 'right'] as WallSide[]) {
    const f = wallFrame(side, D);
    const wg = new THREE.Group();
    wg.position.copy(f.origin);
    wg.rotation.y = f.rotY;
    const m = panelMaterial(side, design.panels[side], f.length, D.h);
    let surface: THREE.Mesh;
    if (m) {
      const side_ = sideMat();
      surface = new THREE.Mesh(new THREE.BoxGeometry(f.length, D.h, D.panelThick), [side_, side_, side_, side_, m, side_]);
      surface.position.set(0, D.h / 2, -D.panelThick / 2);
      surface.receiveShadow = true;
      surface.castShadow = true;
      if (design.grime !== 'none') {
        const gr = new THREE.Mesh(new THREE.PlaneGeometry(f.length, D.h), grimeMaterial(design.grime, f.length, D.h));
        gr.position.set(0, D.h / 2, LAYER.grime);
        gr.raycast = () => {};
        wg.add(gr);
      }
    } else {
      // bening: bidang tak terlihat, tetap bisa ditempeli stiker
      surface = new THREE.Mesh(new THREE.PlaneGeometry(f.length, D.h), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      surface.position.set(0, D.h / 2, 0);
    }
    surface.userData.surface = side;
    wg.add(surface);
    g.add(wg);
    walls[side] = surface;
    wallGroups[side] = wg;
  }

  // kotak akrilik bening
  const caseGroup = new THREE.Group();
  const acrylicMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: '#dfe9ef', transparent: true, opacity: 0.5 });
  const addPane = (w: number, h: number, t: number, x: number, y: number, z: number) => {
    const geo = new THREE.BoxGeometry(w, h, t);
    const pane = new THREE.Mesh(geo, acrylicMat);
    pane.position.set(x, y, z);
    pane.renderOrder = 10;
    pane.raycast = () => {};
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    edges.position.copy(pane.position);
    edges.raycast = () => {};
    caseGroup.add(pane, edges);
  };
  addPane(outerW, D.h, A, 0, D.h / 2, D.d / 2 + A / 2);
  addPane(outerW, D.h, A, 0, D.h / 2, -D.d / 2 - P - A / 2);
  addPane(A, D.h, outerD - A * 2, -D.w / 2 - P - A / 2, D.h / 2, cz);
  addPane(A, D.h, outerD - A * 2, D.w / 2 + P + A / 2, D.h / 2, cz);
  addPane(outerW + D.lidOver * 2, D.lidThick, outerD + D.lidOver * 2, 0, D.h + D.lidThick / 2, cz);
  g.add(caseGroup);

  // strip LED di bawah tutup
  let ledStrip: THREE.Object3D | null = null;
  if (design.options.led) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(D.w * 0.92, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#fff1cf', emissiveIntensity: 1.6 }));
    strip.position.set(0, D.h - 0.02, D.d / 2 - 0.15);
    strip.raycast = () => {};
    g.add(strip);
    ledStrip = strip;
  }

  return { group: g, surfaces: { floor, walls }, wallGroups, caseGroup, ledStrip };
}

/** Diorama lengkap tanpa interaksi (untuk thumbnail tema & gambar pesanan). */
export function buildStatic(design: Design, opts: { cars?: boolean; showCase?: boolean } = {}): THREE.Group {
  const D = dims(design);
  const shell = buildShell(design);
  shell.caseGroup.visible = opts.showCase ?? true;
  const g = shell.group;
  design.items.forEach((it, i) => {
    const o = buildPlaced(it);
    placeObject(o, it, D, i);
    g.add(o);
  });
  if (opts.cars ?? true) {
    for (const c of design.cars) {
      const car = buildCar(c.model, c.color);
      car.position.set(c.x, 0, c.z);
      car.rotation.y = THREE.MathUtils.degToRad(c.rot);
      g.add(car);
    }
  }
  return g;
}
