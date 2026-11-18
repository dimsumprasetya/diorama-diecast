import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ITEMS, byId, cmToReal, type PanelId } from '../../shared/catalog.ts';
import type { Design } from '../../shared/design.ts';
import { buildCar, buildItem } from './builders.ts';
import { buildDecal, decalMaterial } from './decals.ts';
import { LAYER, buildStatic, dims, panelMaterial, waitForUploads, wallFrame, type Uploads } from './diorama.ts';
import { texturesFor } from './textures.ts';

/**
 * Satu WebGLRenderer tersembunyi untuk: ikon aset, preview tema, foto pesanan, dan file cetak.
 */
let renderer: THREE.WebGLRenderer | null = null;
let envTex: THREE.Texture | null = null;

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return renderer;
}

function litScene(): THREE.Scene {
  getRenderer();
  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a3a44', 1.1));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(4, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
  scene.add(sun);
  return scene;
}

// ---------------------------------------------------------------- ikon aset

const thumbCache = new Map<string, string>();
export const peekThumb = (key: string) => thumbCache.get(key);

export function itemThumb(id: string, color?: string, text?: string): string {
  const key = `${id}|${color ?? ''}|${text ?? ''}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const def = byId(ITEMS, id)!;
  const S = 160;
  let url: string;
  if (def.kind === 'decal') {
    const src = decalMaterial(id, color, text).map!.image as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    const k = Math.min((S * 0.86) / src.width, (S * 0.86) / src.height);
    const w = src.width * k;
    const h = src.height * k;
    if (def.mount === 'floor' || ['cables', 'wall-lamp', 'graffiti-tag', 'graffiti-piece', 'pipes'].includes(id)) {
      ctx.fillStyle = def.mount === 'floor' ? '#3a3c41' : '#8d8a84';
      ctx.beginPath();
      ctx.roundRect((S - w) / 2 - 4, (S - h) / 2 - 4, w + 8, h + 8, 8);
      ctx.fill();
    }
    ctx.drawImage(src, (S - w) / 2, (S - h) / 2, w, h);
    url = c.toDataURL('image/png');
  } else {
    url = renderObject(buildItem(id, { color }), S, S, new THREE.Vector3(1, 0.75, 1.3));
  }
  thumbCache.set(key, url);
  return url;
}

export function carThumb(model: string, color: string): string {
  const key = `car|${model}|${color}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  const url = renderObject(buildCar(model, color), 160, 110, new THREE.Vector3(1.4, 0.6, 1));
  thumbCache.set(key, url);
  return url;
}

function renderObject(obj: THREE.Object3D, w: number, h: number, dir: THREE.Vector3): string {
  const r = getRenderer();
  r.setSize(w, h, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.setClearColor(0x000000, 0);
  const scene = litScene();
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.01, 100);
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02;
  cam.position.copy(sphere.center).addScaledVector(dir.clone().normalize(), dist);
  cam.lookAt(sphere.center);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/png');
}

// ---------------------------------------------------------------- foto diorama

/** Foto diorama dari depan-samping (untuk preview tema & lampiran pesanan). */
export async function renderDioramaPhoto(design: Design, uploads: Uploads, opts: { width: number; height: number; cars?: boolean; view?: 'hero' | 'front' } = { width: 1200, height: 800 }): Promise<string> {
  const r = getRenderer();
  const scene = litScene();
  const obj = buildStatic(design, uploads, { cars: opts.cars ?? true, showCase: true });
  scene.add(obj);
  await waitForUploads();
  const D = dims(design);
  r.setSize(opts.width, opts.height, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.setClearColor('#16181d', 1);
  const cam = new THREE.PerspectiveCamera(30, opts.width / opts.height, 0.05, 200);
  const target = new THREE.Vector3(0, D.h * 0.42, 0);
  const span = Math.max(D.w, D.h * (opts.width / opts.height)) * 1.18;
  const dist = span / 2 / Math.tan(THREE.MathUtils.degToRad(15)) / (opts.width / opts.height);
  const dir = opts.view === 'front' ? new THREE.Vector3(0, 0.18, 1) : new THREE.Vector3(-0.36, 0.38, 1);
  cam.position.copy(target).addScaledVector(dir.normalize(), dist);
  cam.lookAt(target);
  r.render(scene, cam);
  return r.domElement.toDataURL('image/jpeg', 0.88);
}

// ---------------------------------------------------------------- file cetak

const basicCache = new Map<THREE.Material, THREE.MeshBasicMaterial>();

/** Ganti material jadi "unlit" supaya warna cetak sama persis dengan gambar asli. */
function toBasic(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    let b = basicCache.get(src);
    if (!b) {
      b = new THREE.MeshBasicMaterial({ map: src.map ?? null, color: src.color ?? new THREE.Color('#fff'), transparent: src.transparent, opacity: src.opacity, depthWrite: false, side: THREE.DoubleSide });
      basicCache.set(src, b);
    }
    m.material = b;
  });
}

export type PrintFile = { panel: PanelId; dataUrl: string; widthPx: number; heightPx: number; widthCm: number; heightCm: number };

/**
 * Render satu panel (dinding/lantai) jadi gambar siap cetak, termasuk stiker di panel tsb.
 * `bleedCm` = kelebihan gambar di tiap sisi untuk toleransi potong.
 */
export async function renderPanelPrint(design: Design, uploads: Uploads, panel: PanelId, dpi = 300, bleedCm = 0.2): Promise<PrintFile | null> {
  const D = dims(design);
  const isFloor = panel === 'floor';
  const W = isFloor ? D.w : wallFrame(panel, D).length;
  const H = isFloor ? D.d : D.h;
  const b = cmToReal(bleedCm);
  const bgMat = panelMaterial(panel, design.panels[panel], W + b * 2, H + b * 2, uploads[panel]);
  const panelDecals = design.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => byId(ITEMS, it.id)?.kind === 'decal' && (isFloor ? it.mount === 'floor' : it.mount === 'wall' && it.wall === panel));
  if (!bgMat && panelDecals.length === 0) return null;
  await waitForUploads();

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  let order = 0;
  const addPlane = (m: THREE.Material, w: number, h: number) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(0, H / 2, 0);
    p.renderOrder = order++;
    root.add(p);
  };
  if (bgMat) addPlane(bgMat, W + b * 2, H + b * 2);
  if (design.grime !== 'none' && bgMat) {
    const t = texturesFor('grime', W + b * 2, H + b * 2);
    addPlane(new THREE.MeshBasicMaterial({ map: t.map, transparent: true, opacity: design.grime === 'heavy' ? 0.95 : 0.5 }), W + b * 2, H + b * 2);
  }
  for (const { it, i } of panelDecals) {
    const g = buildDecal(it.id, { color: it.color, text: it.text, scale: it.scale });
    if (it.mount === 'floor') {
      // lantai: putar ke bidang XY (atas gambar = belakang box)
      g.rotation.set(Math.PI / 2, 0, 0);
      const holder = new THREE.Group();
      holder.add(g);
      holder.rotation.z = THREE.MathUtils.degToRad(it.rot);
      holder.position.set(it.x, H / 2 - it.z, LAYER.decal + i * 0.001);
      holder.traverse((o) => (o.renderOrder = order + i));
      root.add(holder);
    } else {
      g.position.set(it.u, it.v, LAYER.decal + i * 0.001);
      g.traverse((o) => (o.renderOrder = order + i));
      root.add(g);
    }
  }
  toBasic(root);

  const cam = new THREE.OrthographicCamera(-W / 2 - b, W / 2 + b, H + b, -b, -10, 10);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);

  const widthCm = (W * 100) / 64 + bleedCm * 2;
  const heightCm = (H * 100) / 64 + bleedCm * 2;
  const widthPx = Math.round((widthCm / 2.54) * dpi);
  const heightPx = Math.round((heightCm / 2.54) * dpi);
  const r = getRenderer();
  r.setSize(widthPx, heightPx, false);
  r.toneMapping = THREE.NoToneMapping;
  r.setClearColor('#ffffff', 1);
  r.render(scene, cam);
  const dataUrl = r.domElement.toDataURL('image/png');
  return { panel, dataUrl, widthPx, heightPx, widthCm, heightCm };
}
