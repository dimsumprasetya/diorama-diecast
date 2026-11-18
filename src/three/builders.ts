import * as THREE from 'three';
import { CAR_MODELS } from '../../shared/catalog.ts';
import { glass, glowMat, mat, metal, rubber } from './materials.ts';

/**
 * Model 3D prosedural (dibangun dari bentuk dasar), ukuran dalam METER dunia nyata.
 * Titik asal di tengah-bawah tapak, sisi depan menghadap +Z.
 *
 * Ingin pakai model asli (.glb hasil scan / modeling)? Lihat README bagian "Mengganti model 3D".
 */

type V3 = [number, number, number];

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(...pos);
  me.rotation.set(...rot);
  me.castShadow = true;
  me.receiveShadow = true;
  return me;
}

/** Box dengan y = posisi bawah. */
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, [x, y + h / 2, z]);
/** Silinder tegak dengan y = posisi bawah. */
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, [x, y + h / 2, z]);

let tireGeo: THREE.LatheGeometry | null = null;
/** Ban: sumbu putar = Y, tinggi 1 (diskalakan). */
function tireGeometry() {
  if (!tireGeo) {
    const pts: THREE.Vector2[] = [];
    const inner = 0.55;
    const outer = 1;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      pts.push(new THREE.Vector2(inner + (outer - inner) * (0.5 + 0.5 * Math.sin(a)) * 0.98 + 0.02 * Math.sin(a), -0.5 * Math.cos(a)));
    }
    tireGeo = new THREE.LatheGeometry(pts, 28);
  }
  return tireGeo;
}

function tire(radius: number, width: number, pos: V3, rot: V3 = [0, 0, 0]) {
  const t = mesh(tireGeometry(), rubber(), pos, rot);
  t.scale.set(radius, width, radius);
  return t;
}

function wheel(radius: number, width: number, pos: V3, rimColor = '#c9cdd2') {
  const g = new THREE.Group();
  g.add(tire(radius, width, [0, 0, 0]));
  g.add(cyl(radius * 0.56, radius * 0.56, width * 0.8, metal(rimColor), 0, -width * 0.4, 0, 16));
  g.position.set(...pos);
  g.rotation.x = Math.PI / 2;
  return g;
}

function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

// ---------------------------------------------------------------- item builders

type Opts = { color?: string; text?: string };

const B: Record<string, (o: Opts) => THREE.Group> = {
  'tire-stack'() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const t = tire(0.33, 0.22, [Math.sin(i * 2.1) * 0.02, 0.11 + i * 0.225, Math.cos(i * 1.7) * 0.02]);
      g.add(t);
    }
    return g;
  },

  'oil-drum'({ color = '#2f5fa8' }) {
    const m = mat(color, 0.45, 0.4);
    const g = group(cyl(0.29, 0.29, 0.88, m, 0, 0, 0, 24));
    for (const y of [0.29, 0.59]) {
      const ring = mesh(new THREE.TorusGeometry(0.292, 0.012, 6, 32), m, [0, y, 0], [Math.PI / 2, 0, 0]);
      g.add(ring);
    }
    g.add(cyl(0.27, 0.27, 0.01, mat('#2a2a2a', 0.6, 0.5), 0, 0.88, 0, 24));
    g.add(cyl(0.035, 0.035, 0.02, metal(), 0.15, 0.88, 0.05, 10));
    g.add(cyl(0.293, 0.293, 0.16, mat('#f1f1ec', 0.6), 0, 0.37, 0, 24));
    return g;
  },

  'tool-cabinet'({ color = '#c62d2d' }) {
    const m = mat(color, 0.35, 0.3);
    const g = group(box(0.75, 0.95, 0.45, m, 0, 0.08, 0));
    g.add(box(0.77, 0.04, 0.47, mat('#1e1e1e', 0.5, 0.3), 0, 1.01, 0));
    for (let i = 0; i < 6; i++) {
      const y = 0.14 + i * 0.14;
      g.add(box(0.7, 0.115, 0.01, m, 0, y, 0.228));
      g.add(box(0.4, 0.015, 0.02, metal('#d0d3d6'), 0, y + 0.08, 0.235));
    }
    for (const [x, z] of [[-0.3, -0.17], [0.3, -0.17], [-0.3, 0.17], [0.3, 0.17]]) g.add(cyl(0.04, 0.04, 0.08, rubber(), x, 0, z, 10));
    return g;
  },



  'floor-jack'({ color = '#c62d2d' }) {
    const m = mat(color, 0.35, 0.4);
    const g = group(box(0.3, 0.13, 0.75, m, 0, 0.05, 0));
    g.add(cyl(0.09, 0.09, 0.04, metal(), 0, 0.2, 0.3, 16));
    g.add(box(0.06, 0.1, 0.3, m, 0, 0.12, 0.2));
    for (const [x, z] of [[-0.13, 0.3], [0.13, 0.3], [-0.15, -0.3], [0.15, -0.3]]) {
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), rubber(), [x, 0.05, z], [0, 0, Math.PI / 2]));
    }
    const handle = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), metal('#b0b4b8'), [0, 0.38, -0.62], [-0.85, 0, 0]);
    g.add(handle);
    return g;
  },

  compressor({ color = '#c62d2d' }) {
    const m = mat(color, 0.35, 0.4);
    const g = new THREE.Group();
    g.add(mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 16), m, [0, 0.27, 0], [0, 0, Math.PI / 2]));
    g.add(box(0.3, 0.22, 0.22, mat('#2a2a2a', 0.5, 0.4), -0.05, 0.42, 0));
    g.add(cyl(0.05, 0.05, 0.03, mat('#f1f1ec', 0.3), 0.2, 0.44, 0.08, 14));
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), rubber(), [0.3, 0.09, 0.15], [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), rubber(), [0.3, 0.09, -0.15], [Math.PI / 2, 0, 0]));
    g.add(box(0.05, 0.1, 0.25, mat('#2a2a2a', 0.5), -0.33, 0, 0));
    return g;
  },

  jerrycan({ color = '#c62d2d' }) {
    const m = mat(color, 0.5, 0.2);
    const g = group(box(0.33, 0.4, 0.17, m, 0, 0, 0));
    g.add(box(0.06, 0.05, 0.1, m, -0.1, 0.4, 0));
    g.add(box(0.06, 0.05, 0.1, m, 0.06, 0.4, 0));
    g.add(box(0.22, 0.03, 0.08, m, -0.02, 0.44, 0));
    g.add(cyl(0.025, 0.025, 0.06, mat('#222', 0.5), 0.13, 0.4, 0, 10));
    return g;
  },


  cone() {
    const orange = mat('#f26a1b', 0.5);
    const white = mat('#f3f3f0', 0.3);
    const g = group(box(0.36, 0.03, 0.36, mat('#1b1b1b', 0.8), 0, 0, 0));
    g.add(cyl(0.025, 0.14, 0.66, orange, 0, 0.03, 0, 20));
    g.add(cyl(0.07, 0.093, 0.1, white, 0, 0.38, 0, 20));
    g.add(cyl(0.105, 0.125, 0.08, white, 0, 0.15, 0, 20));
    return g;
  },

  barrier({ color = '#d9442b' }) {
    const s = new THREE.Shape();
    s.moveTo(-0.25, 0);
    s.lineTo(0.25, 0);
    s.lineTo(0.2, 0.25);
    s.lineTo(0.11, 0.33);
    s.lineTo(0.1, 0.8);
    s.lineTo(-0.1, 0.8);
    s.lineTo(-0.11, 0.33);
    s.lineTo(-0.2, 0.25);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.46, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    geo.translate(0, 0, -0.73);
    const m = mesh(geo, mat(color, 0.55, 0), [0, 0, 0], [0, Math.PI / 2, 0]);
    const g = group(m);
    g.add(box(1.2, 0.08, 0.205, mat('#f2f2f2', 0.3), 0, 0.6, 0));
    return g;
  },



  bollard({ color = '#f0c419' }) {
    const m = mat(color, 0.4, 0.3);
    const g = group(cyl(0.09, 0.09, 0.82, m, 0, 0, 0, 16));
    g.add(mesh(new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, [0, 0.82, 0]));
    g.add(cyl(0.092, 0.092, 0.06, mat('#f2f2f2', 0.2), 0, 0.62, 0, 16));
    return g;
  },





  bush() {
    const g = new THREE.Group();
    const leaves = [mat('#3f7d2d', 0.85, 0, { flatShading: true }), mat('#2f6524', 0.85, 0, { flatShading: true })];
    const blobs: [number, number, number, number][] = [[0, 0.35, 0, 0.38], [0.25, 0.28, 0.1, 0.28], [-0.22, 0.27, -0.08, 0.3], [0.05, 0.25, -0.25, 0.25]];
    blobs.forEach(([x, y, z, r], i) => g.add(mesh(new THREE.IcosahedronGeometry(r, 1), leaves[i % 2], [x, y, z])));
    return g;
  },

  'plant-pot'() {
    const g = group(cyl(0.22, 0.16, 0.42, mat('#b5603a', 0.8), 0, 0, 0, 16));
    g.add(cyl(0.2, 0.2, 0.02, mat('#4a3422', 0.95), 0, 0.39, 0, 16));
    const leaf = mat('#3f8a35', 0.7, 0, { flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const l = mesh(new THREE.ConeGeometry(0.06, 0.55, 4), leaf, [Math.cos(a) * 0.07, 0.65, Math.sin(a) * 0.07], [Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]);
      g.add(l);
    }
    return g;
  },


  bench() {
    const wood = mat('#9b6b3d', 0.75);
    const iron = mat('#2a2d31', 0.5, 0.5);
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(box(1.6, 0.04, 0.12, wood, 0, 0.44, -0.15 + i * 0.15));
    for (let i = 0; i < 2; i++) {
      const s = box(1.6, 0.1, 0.03, wood, 0, 0, 0);
      s.position.set(0, 0.62 + i * 0.14, -0.27);
      s.rotation.x = -0.15;
      g.add(s);
    }
    for (const x of [-0.7, 0.7]) {
      g.add(box(0.05, 0.44, 0.5, iron, x, 0, 0));
      g.add(box(0.05, 0.4, 0.05, iron, x, 0.44, -0.27));
    }
    return g;
  },

  pallet() {
    const wood = mat('#c2a477', 0.85);
    const kraft = mat('#b88a55', 0.9);
    const tape = mat('#d9c49a', 0.4);
    const g = new THREE.Group();
    for (const z of [-0.45, 0, 0.45]) g.add(box(1.2, 0.08, 0.1, wood, 0, 0, z));
    for (let i = 0; i < 6; i++) g.add(box(0.15, 0.03, 1.0, wood, -0.5 + i * 0.2, 0.08, 0));
    g.add(box(0.55, 0.4, 0.45, kraft, -0.28, 0.11, -0.22));
    g.add(box(0.56, 0.01, 0.08, tape, -0.28, 0.51, -0.22));
    g.add(box(0.5, 0.35, 0.45, kraft, 0.3, 0.11, 0.2));
    g.add(box(0.51, 0.01, 0.08, tape, 0.3, 0.46, 0.2));
    const top = box(0.45, 0.38, 0.4, mat('#a87d4c', 0.9), -0.2, 0.51, -0.18);
    top.rotation.y = 0.2;
    g.add(top);
    return g;
  },

  'trash-bin'({ color = '#2f7a3d' }) {
    const m = mat(color, 0.6, 0.1);
    const g = group(cyl(0.26, 0.22, 0.88, m, 0, 0, 0, 20));
    g.add(mesh(new THREE.SphereGeometry(0.27, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2b2b2b', 0.6), [0, 0.88, 0], [0, 0, 0]));
    g.children[1].scale.y = 0.35;
    return g;
  },

  vending({ color = '#c62d2d' }) {
    const m = mat(color, 0.35, 0.2);
    const g = group(box(0.95, 1.85, 0.75, m, 0, 0, 0));
    g.add(box(0.62, 1.2, 0.02, glowMat('#dff6ff', '#9fc8d8', 0.9), -0.1, 0.45, 0.375));
    const bottles = ['#d9442b', '#2c5aa0', '#f0c419', '#3d7a43', '#f2f2f2'];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 5; c++) g.add(box(0.07, 0.18, 0.02, mat(bottles[(r + c) % bottles.length], 0.4), -0.34 + c * 0.12, 0.55 + r * 0.27, 0.385));
    g.add(box(0.16, 0.4, 0.02, mat('#2a2a2a', 0.4), 0.35, 0.9, 0.38));
    g.add(box(0.6, 0.15, 0.02, mat('#1a1a1a', 0.4), -0.1, 0.18, 0.38));
    return g;
  },

  mechanic({ color = '#2c5aa0' }) {
    return figure(color, color, '#c62d2d');
  },

  person({ color = '#f2f2f2' }) {
    return figure('#34507a', color, null);
  },







};

function figure(pants: string, shirt: string, cap: string | null) {
  const skin = mat('#c99572', 0.7);
  const pm = mat(pants, 0.75);
  const sm = mat(shirt, 0.75);
  const g = new THREE.Group();
  g.add(box(0.13, 0.82, 0.15, pm, -0.08, 0, 0));
  g.add(box(0.13, 0.82, 0.15, pm, 0.08, 0, 0));
  g.add(box(0.36, 0.56, 0.2, sm, 0, 0.82, 0));
  const armL = box(0.1, 0.55, 0.11, sm, 0, -0.55, 0);
  const aL = new THREE.Group();
  aL.add(armL);
  aL.position.set(-0.24, 1.36, 0);
  aL.rotation.z = -0.08;
  aL.rotation.x = 0.2;
  const aR = aL.clone();
  aR.position.x = 0.24;
  aR.rotation.z = 0.08;
  aR.rotation.x = -0.25;
  g.add(aL, aR);
  g.add(box(0.12, 0.08, 0.12, skin, 0, 1.38, 0));
  g.add(mesh(new THREE.SphereGeometry(0.115, 16, 12), skin, [0, 1.55, 0]));
  g.add(box(0.14, 0.12, 0.25, mat('#2b2b2b', 0.6), 0, -0.0, 0.03));
  if (cap) {
    g.add(mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap, 0.6), [0, 1.58, 0]));
    g.add(box(0.16, 0.02, 0.12, mat(cap, 0.6), 0, 1.58, 0.12));
  } else {
    g.add(mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2a1d14', 0.8), [0, 1.57, -0.01]));
  }
  return g;
}

// ---------------------------------------------------------------- cars (preview only)

type CarSpec = {
  L: number;
  W: number;
  ride: number;
  wheelR: number;
  wheelX: number;
  /** garis atas bodi dari depan (x=+0.5) ke belakang (x=-0.5), x dalam fraksi panjang */
  upper: [number, number][];
  /** kaca/kabin: [kaki kaca depan, atap depan, atap belakang, kaki kaca belakang] */
  cabin: [number, number][];
  spoiler?: boolean;
  rack?: boolean;
};

const CARS: Record<string, CarSpec> = {
  sport: {
    L: 4.4, W: 1.86, ride: 0.2, wheelR: 0.33, wheelX: 0.33,
    upper: [[0.5, 0.3], [0.5, 0.5], [0.47, 0.6], [0.3, 0.7], [-0.3, 0.76], [-0.47, 0.73], [-0.5, 0.62], [-0.5, 0.3]],
    cabin: [[0.27, 0.71], [0.07, 1.16], [-0.12, 1.16], [-0.34, 0.76]],
    spoiler: true,
  },
  sedan: {
    L: 4.6, W: 1.78, ride: 0.22, wheelR: 0.32, wheelX: 0.31,
    upper: [[0.5, 0.32], [0.5, 0.58], [0.46, 0.68], [0.3, 0.78], [-0.34, 0.83], [-0.47, 0.8], [-0.5, 0.66], [-0.5, 0.32]],
    cabin: [[0.29, 0.79], [0.1, 1.37], [-0.16, 1.37], [-0.33, 0.83]],
  },
  suv: {
    L: 4.7, W: 1.92, ride: 0.34, wheelR: 0.39, wheelX: 0.31,
    upper: [[0.5, 0.45], [0.5, 0.82], [0.46, 0.96], [0.36, 1.03], [-0.5, 1.05], [-0.5, 0.45]],
    cabin: [[0.34, 1.02], [0.17, 1.72], [-0.46, 1.74], [-0.49, 1.04]],
    rack: true,
  },
};

function extrude(shape: THREE.Shape, width: number, m: THREE.Material, bevel = 0.04) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  return mesh(geo, m);
}

function polyShape(pts: [number, number][]) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Kaca miring (kaca depan/belakang) di antara dua titik profil. */
function slopeGlass(a: [number, number], b: [number, number], width: number, outward: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const g = mesh(new THREE.BoxGeometry(len * 0.9, 0.02, width), glass());
  g.position.set((a[0] + b[0]) / 2 + (dy / len) * outward, (a[1] + b[1]) / 2 - (dx / len) * outward, 0);
  g.rotation.z = Math.atan2(dy, dx);
  return g;
}

const protoCache = new Map<string, THREE.Group>();

export function buildCar(model: string, color: string): THREE.Group {
  const key = `car:${model}:${color}`;
  let proto = protoCache.get(key);
  if (!proto) {
    const c = CARS[model] ?? CARS.sport;
    const { L, W } = c;
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06 });
    const g = new THREE.Group();

    // bodi bawah dengan lengkung spakbor
    const archR = c.wheelR + 0.07;
    const wx = c.wheelX * L;
    const body = new THREE.Shape();
    body.moveTo(-L / 2, c.ride);
    for (const cx of [-wx, wx]) {
      body.lineTo(cx - archR, c.ride);
      body.lineTo(cx - archR, c.wheelR);
      body.absarc(cx, c.wheelR, archR, Math.PI, 0, true);
      body.lineTo(cx + archR, c.ride);
    }
    body.lineTo(L / 2, c.ride);
    for (const [x, y] of c.upper) body.lineTo(x * L, y);
    body.closePath();
    g.add(extrude(body, W, paint, 0.05));

    // kabin: rangka cat + kaca samping + kaca depan/belakang
    const cab = c.cabin.map(([x, y]) => [x * L, y] as [number, number]);
    const cabW = W * 0.84;
    g.add(extrude(polyShape(cab), cabW, paint, 0.03));
    const cx = cab.reduce((a, p) => a + p[0], 0) / cab.length;
    const cy = cab.reduce((a, p) => a + p[1], 0) / cab.length;
    const win = cab.map(([x, y]) => [cx + (x - cx) * 0.84, cy + (y - cy) * 0.78 + 0.02] as [number, number]);
    g.add(extrude(polyShape(win), cabW + 0.03, glass(), 0.0001));
    g.add(slopeGlass(cab[0], cab[1], cabW * 0.86, 0.035));
    g.add(slopeGlass(cab[2], cab[3], cabW * 0.86, 0.035));

    // roda
    const zW = W / 2 - 0.15;
    for (const x of [-wx, wx]) for (const z of [-zW, zW]) {
      const w = wheel(c.wheelR, 0.24, [x, c.wheelR, z]);
      if (z < 0) w.rotation.x = -Math.PI / 2;
      g.add(w);
    }

    // lampu
    const head = new THREE.MeshStandardMaterial({ color: '#f4f4ef', emissive: '#fff6dd', emissiveIntensity: 0.5, roughness: 0.1 });
    const tail = new THREE.MeshStandardMaterial({ color: '#8a0c0c', emissive: '#ff1a1a', emissiveIntensity: 0.5, roughness: 0.2 });
    const frontY = c.upper[1][1] - 0.07;
    const rearY = c.upper[c.upper.length - 2][1] - 0.08;
    for (const z of [-1, 1]) {
      g.add(box(0.05, 0.08, 0.34, head, L / 2 + 0.02, frontY - 0.04, z * (W / 2 - 0.3)));
      g.add(box(0.05, 0.08, 0.38, tail, -L / 2 - 0.02, rearY - 0.04, z * (W / 2 - 0.3)));
      // spion
      g.add(box(0.12, 0.08, 0.1, paint, cab[0][0] - 0.05, cab[0][1] + 0.02, z * (W / 2 + 0.03)));
    }
    g.add(box(0.06, 0.12, W * 0.7, mat('#121212', 0.6), L / 2 + 0.01, c.ride + 0.02, 0));
    g.add(box(L * 0.92, 0.1, W * 0.86, mat('#151515', 0.8), 0, c.ride - 0.04, 0));
    if (c.spoiler) {
      const rx = c.upper[c.upper.length - 3][0] * L;
      const ry = c.upper[c.upper.length - 3][1];
      g.add(box(0.06, 0.16, 0.08, mat('#151515', 0.5), rx + 0.15, ry, -W * 0.3));
      g.add(box(0.06, 0.16, 0.08, mat('#151515', 0.5), rx + 0.15, ry, W * 0.3));
      g.add(box(0.32, 0.04, W * 0.92, paint, rx + 0.12, ry + 0.16, 0));
    }
    if (c.rack) {
      const ry = c.cabin[2][1] + 0.03;
      for (const z of [-0.62, 0.62]) g.add(box(L * 0.55, 0.04, 0.05, mat('#1a1a1a', 0.5, 0.4), -L * 0.15, ry, z));
    }

    // depan mobil menghadap +X → putar agar menghadap +Z seperti item lain
    g.rotation.y = -Math.PI / 2;
    proto = new THREE.Group();
    proto.add(g);
    protoCache.set(key, proto);
  }
  return proto.clone();
}

export function carSize(model: string): [number, number, number] {
  const def = CAR_MODELS.find((c) => c.id === model) ?? CAR_MODELS[0];
  // setelah diputar: panjang mobil ada di sumbu Z
  return [def.size[2], def.size[1], def.size[0]];
}

/** Bangun item (hasilnya clone dari prototipe, geometry & material dipakai bersama). */
export function buildItem(id: string, opts: Opts = {}): THREE.Group {
  const key = `${id}:${opts.color ?? ''}:${opts.text ?? ''}`;
  let proto = protoCache.get(key);
  if (!proto) {
    const fn = B[id];
    proto = fn ? fn(opts) : group(box(0.5, 0.5, 0.5, mat('#ff00ff')));
    protoCache.set(key, proto);
  }
  const c = proto.clone();
  c.userData = { ...proto.userData };
  return c;
}
