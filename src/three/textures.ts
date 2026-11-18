import * as THREE from 'three';

/**
 * Tekstur prosedural (digambar di <canvas>) supaya tidak perlu file gambar.
 * Setiap tekstur punya `realSize` = ukuran dunia nyata (meter) yang diwakili 1 ubin tekstur,
 * sehingga ukuran bata/ubin selalu proporsional dengan skala diorama.
 */

type TexSet = { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture; realSize: number | [number, number] };

const S = 512;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value-noise yang bisa diulang tanpa sambungan (tileable). Hasil 0..1 */
function fbm(size: number, period: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  const r = rng(seed);
  for (let o = 0; o < octaves; o++) {
    const p = period << o;
    const grid = new Float32Array(p * p);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * p;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const y1 = (y0 + 1) % p;
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * p;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const x1 = (x0 + 1) % p;
        const a = grid[y0 * p + x0] + (grid[y0 * p + x1] - grid[y0 * p + x0]) * sx;
        const b = grid[y1 * p + x0] + (grid[y1 * p + x1] - grid[y1 * p + x0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function canvas(size = S) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d')! };
}

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Isi canvas dengan warna dasar dimodulasi noise. */
function paintNoise(ctx: CanvasRenderingContext2D, base: string, noise: Float32Array, strength: number, size = S) {
  const img = ctx.createImageData(size, size);
  const [r, g, b] = hex(base);
  for (let i = 0; i < size * size; i++) {
    const k = 1 + (noise[i] - 0.5) * strength;
    img.data[i * 4] = Math.min(255, r * k);
    img.data[i * 4 + 1] = Math.min(255, g * k);
    img.data[i * 4 + 2] = Math.min(255, b * k);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function speckle(ctx: CanvasRenderingContext2D, r: () => number, count: number, colors: string[], maxR: number, size = S) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = 0.25 + r() * 0.6;
    const s = 0.5 + r() * maxR;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

function vary(color: string, r: () => number, amount: number) {
  const [cr, cg, cb] = hex(color);
  const k = 1 + (r() - 0.5) * amount;
  return `rgb(${Math.min(255, cr * k) | 0},${Math.min(255, cg * k) | 0},${Math.min(255, cb * k) | 0})`;
}

function tex(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pola bata/paving: baris berselang (running bond). */
function bondPattern(opts: { cols: number; rows: number; mortar: number; brick: string; mortarColor: string; variation: number; seed: number; noise?: number }): { color: HTMLCanvasElement; height: HTMLCanvasElement } {
  const { c, ctx } = canvas();
  const h = canvas();
  const r = rng(opts.seed);
  const n = fbm(S, 8, 4, opts.seed + 1);
  paintNoise(ctx, opts.mortarColor, n, 0.3);
  h.ctx.fillStyle = '#000';
  h.ctx.fillRect(0, 0, S, S);
  const bw = S / opts.cols;
  const bh = S / opts.rows;
  for (let row = 0; row < opts.rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col <= opts.cols; col++) {
      const x = col * bw + off + opts.mortar / 2;
      const y = row * bh + opts.mortar / 2;
      ctx.fillStyle = vary(opts.brick, r, opts.variation);
      ctx.fillRect(x, y, bw - opts.mortar, bh - opts.mortar);
      h.ctx.fillStyle = '#fff';
      h.ctx.fillRect(x, y, bw - opts.mortar, bh - opts.mortar);
    }
  }
  // noise di atas bata
  const img = ctx.getImageData(0, 0, S, S);
  const n2 = fbm(S, 32, 3, opts.seed + 2);
  for (let i = 0; i < S * S; i++) {
    const k = 1 + (n2[i] - 0.5) * (opts.noise ?? 0.35);
    img.data[i * 4] *= k;
    img.data[i * 4 + 1] *= k;
    img.data[i * 4 + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
  return { color: c, height: h.c };
}

const builders: Record<string, () => TexSet> = {
  asphalt() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#3c3d40', fbm(S, 6, 5, 11), 0.45);
    speckle(ctx, rng(12), 5000, ['#6b6b6b', '#222', '#8a8a86'], 2);
    return { map: tex(c), bump: tex(c, false), realSize: 2 };
  },
  concrete() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#a19f99', fbm(S, 4, 5, 21), 0.35);
    speckle(ctx, rng(22), 1500, ['#8a8882', '#b9b7b0'], 1.5);
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    ctx.fillRect(0, 0, S, 3);
    ctx.fillRect(0, 0, 3, S);
    const h = canvas();
    h.ctx.fillStyle = '#fff';
    h.ctx.fillRect(0, 0, S, S);
    h.ctx.fillStyle = '#000';
    h.ctx.fillRect(0, 0, S, 3);
    h.ctx.fillRect(0, 0, 3, S);
    return { map: tex(c), bump: tex(h.c, false), realSize: 3 };
  },
  epoxy() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#70777c', fbm(S, 3, 4, 31), 0.15);
    speckle(ctx, rng(32), 9000, ['#d9dcdf', '#30343a', '#9aa1a6'], 1.6);
    return { map: tex(c), realSize: 2 };
  },
  tiles() {
    const { c, ctx } = canvas();
    const h = canvas();
    const r = rng(41);
    const n = fbm(S, 8, 3, 42);
    paintNoise(ctx, '#958f86', n, 0.2);
    h.ctx.fillStyle = '#000';
    h.ctx.fillRect(0, 0, S, S);
    const t = S / 2;
    const g = 5;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = vary('#dcd7cd', r, 0.06);
        ctx.fillRect(x * t + g / 2, y * t + g / 2, t - g, t - g);
        h.ctx.fillStyle = '#fff';
        h.ctx.fillRect(x * t + g / 2, y * t + g / 2, t - g, t - g);
      }
    speckle(ctx, r, 900, ['#c9c3b8', '#e8e4dc'], 2);
    return { map: tex(c), bump: tex(h.c, false), realSize: 1.2 };
  },
  paving() {
    const p = bondPattern({ cols: 6, rows: 12, mortar: 4, brick: '#8d8b86', mortarColor: '#4a4844', variation: 0.22, seed: 51 });
    return { map: tex(p.color), bump: tex(p.height, false), realSize: 1.2 };
  },
  wood() {
    const { c, ctx } = canvas();
    const h = canvas();
    const r = rng(61);
    const planks = 8;
    const ph = S / planks;
    h.ctx.fillStyle = '#000';
    h.ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < planks; i++) {
      const segs = 1 + Math.floor(r() * 2);
      let x = -r() * S * 0.5;
      for (let s = 0; s <= segs + 1; s++) {
        const len = S / segs + r() * 60;
        ctx.fillStyle = vary('#9b6a3f', r, 0.35);
        ctx.fillRect(x + 1, i * ph + 1, len - 2, ph - 2);
        h.ctx.fillStyle = '#fff';
        h.ctx.fillRect(x + 1, i * ph + 1, len - 2, ph - 2);
        for (let k = 0; k < 14; k++) {
          ctx.strokeStyle = `rgba(60,35,15,${0.08 + r() * 0.15})`;
          ctx.lineWidth = 0.6 + r();
          ctx.beginPath();
          const yy = i * ph + 3 + r() * (ph - 6);
          ctx.moveTo(x, yy);
          ctx.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.6, yy + (r() - 0.5) * 6, x + len, yy);
          ctx.stroke();
        }
        x += len;
      }
    }
    return { map: tex(c), bump: tex(h.c, false), realSize: 1.2 };
  },
  grass() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#4f7a32', fbm(S, 4, 5, 71), 0.55);
    const r = rng(72);
    for (let i = 0; i < 14000; i++) {
      const x = r() * S;
      const y = r() * S;
      ctx.strokeStyle = ['#6c9a3e', '#3e6526', '#86ad4c', '#2f4f1f'][Math.floor(r() * 4)];
      ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return { map: tex(c), bump: tex(c, false), realSize: 1.5 };
  },
  dirt() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#7a5a3c', fbm(S, 4, 5, 81), 0.6);
    speckle(ctx, rng(82), 3500, ['#5b4029', '#9c7a58', '#a89a88', '#3f2d1d'], 3);
    return { map: tex(c), bump: tex(c, false), realSize: 2 };
  },

  // --- dinding
  'brick-red'() {
    const p = bondPattern({ cols: 4, rows: 12, mortar: 5, brick: '#9b4630', mortarColor: '#b8b0a2', variation: 0.3, seed: 91 });
    return { map: tex(p.color), bump: tex(p.height, false), realSize: 0.9 };
  },
  'brick-white'() {
    const p = bondPattern({ cols: 4, rows: 12, mortar: 5, brick: '#e9e6df', mortarColor: '#bdb8ae', variation: 0.06, seed: 101, noise: 0.12 });
    return { map: tex(p.color), bump: tex(p.height, false), realSize: 0.9 };
  },
  'concrete-wall'() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#9d9c98', fbm(S, 4, 5, 111), 0.3);
    const h = canvas();
    h.ctx.fillStyle = '#fff';
    h.ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(50,50,50,0.5)';
    h.ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, 2);
    ctx.fillRect(0, S / 2, S, 2);
    ctx.fillRect(0, 0, 2, S);
    h.ctx.fillRect(0, 0, S, 2);
    h.ctx.fillRect(0, S / 2, S, 2);
    h.ctx.fillRect(0, 0, 2, S);
    for (const [x, y] of [[0.2, 0.25], [0.8, 0.25], [0.2, 0.75], [0.8, 0.75]]) {
      ctx.fillStyle = '#55534f';
      ctx.beginPath();
      ctx.arc(x * S, y * S, 7, 0, Math.PI * 2);
      ctx.fill();
      h.ctx.beginPath();
      h.ctx.arc(x * S, y * S, 7, 0, Math.PI * 2);
      h.ctx.fill();
    }
    return { map: tex(c), bump: tex(h.c, false), realSize: 2.4 };
  },
  plaster() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#f4f4f2', fbm(S, 8, 5, 121), 0.12);
    return { map: tex(c), bump: tex(c, false), realSize: 2 };
  },
  corrugated() {
    const { c, ctx } = canvas();
    const img = ctx.createImageData(S, S);
    const n = fbm(S, 4, 4, 131);
    const waves = 8;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = 0.78 + 0.22 * Math.sin((x / S) * Math.PI * 2 * waves);
        const k = v * (0.92 + n[y * S + x] * 0.16) * 255;
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c), bump: tex(c, false), realSize: 0.6 };
  },
  'wood-wall'() {
    const { c, ctx } = canvas();
    const h = canvas();
    const r = rng(141);
    const planks = 6;
    const ph = S / planks;
    h.ctx.fillStyle = '#000';
    h.ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < planks; i++) {
      ctx.fillStyle = vary('#7d5532', r, 0.4);
      ctx.fillRect(0, i * ph + 2, S, ph - 4);
      h.ctx.fillStyle = '#fff';
      h.ctx.fillRect(0, i * ph + 2, S, ph - 4);
      for (let k = 0; k < 20; k++) {
        ctx.strokeStyle = `rgba(40,22,10,${0.1 + r() * 0.2})`;
        ctx.beginPath();
        const yy = i * ph + 4 + r() * (ph - 8);
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(S * 0.3, yy + (r() - 0.5) * 8, S * 0.7, yy + (r() - 0.5) * 8, S, yy);
        ctx.stroke();
      }
    }
    return { map: tex(c), bump: tex(h.c, false), realSize: 1.2 };
  },


  'brick-old'() {
    const p = bondPattern({ cols: 4, rows: 12, mortar: 5, brick: '#8e4430', mortarColor: '#a59c8e', variation: 0.35, seed: 171, noise: 0.45 });
    const ctx = p.color.getContext('2d')!;
    const hctx = p.height.getContext('2d')!;
    // sisa plester yang mengelupas
    const n = fbm(S, 4, 5, 172);
    const img = ctx.getImageData(0, 0, S, S);
    const himg = hctx.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) {
      const v = n[i];
      if (v > 0.56) {
        const k = 0.85 + (v - 0.56) * 0.6;
        img.data[i * 4] = 168 * k;
        img.data[i * 4 + 1] = 160 * k;
        img.data[i * 4 + 2] = 148 * k;
        himg.data[i * 4] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = 255;
      } else if (v > 0.53) {
        img.data[i * 4] *= 0.55;
        img.data[i * 4 + 1] *= 0.55;
        img.data[i * 4 + 2] *= 0.55;
      }
    }
    ctx.putImageData(img, 0, 0);
    hctx.putImageData(himg, 0, 0);
    return { map: tex(p.color), bump: tex(p.height, false), realSize: 1.4 };
  },
  'tile-wall'() {
    const p = bondPattern({ cols: 3, rows: 6, mortar: 4, brick: '#eeeeea', mortarColor: '#a9a9a3', variation: 0.04, seed: 181, noise: 0.06 });
    return { map: tex(p.color), bump: tex(p.height, false), realSize: 0.9 };
  },
  shutters() {
    // satu unit rolling door (lebar 2,13 m) + dinding beton di atasnya, diulang ke samping
    const W = 512;
    const H = 768;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const hc = document.createElement('canvas');
    hc.width = W;
    hc.height = H;
    const h = hc.getContext('2d')!;
    const r = rng(191);
    const n = fbm(256, 4, 4, 192);
    const nc = document.createElement('canvas');
    nc.width = nc.height = 256;
    paintNoise(nc.getContext('2d')!, '#8f8c86', n, 0.5, 256);
    ctx.drawImage(nc, 0, 0, W, H);
    h.fillStyle = '#888';
    h.fillRect(0, 0, W, H);
    const top = H * 0.2;
    const pillar = W * 0.06;
    // kotak gulungan
    ctx.fillStyle = '#5f6266';
    ctx.fillRect(pillar, top, W - pillar * 2, H * 0.06);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(pillar, top + H * 0.06, W - pillar * 2, 4);
    const y0 = top + H * 0.06;
    const slat = 9;
    for (let y = y0; y < H - 14; y += slat) {
      const g = ctx.createLinearGradient(0, y, 0, y + slat);
      const base = 150 + Math.floor(r() * 18);
      g.addColorStop(0, `rgb(${base + 40},${base + 42},${base + 44})`);
      g.addColorStop(0.6, `rgb(${base},${base + 2},${base + 4})`);
      g.addColorStop(1, `rgb(${base - 60},${base - 58},${base - 56})`);
      ctx.fillStyle = g;
      ctx.fillRect(pillar + 6, y, W - pillar * 2 - 12, slat);
      h.fillStyle = '#fff';
      h.fillRect(pillar + 6, y + 1, W - pillar * 2 - 12, slat - 3);
      h.fillStyle = '#333';
      h.fillRect(pillar + 6, y + slat - 2, W - pillar * 2 - 12, 2);
    }
    // rel samping
    ctx.fillStyle = '#4b4e52';
    ctx.fillRect(pillar, y0, 8, H - y0);
    ctx.fillRect(W - pillar - 8, y0, 8, H - y0);
    // bar bawah & handle
    ctx.fillStyle = '#3a3c40';
    ctx.fillRect(pillar + 6, H - 16, W - pillar * 2 - 12, 10);
    ctx.fillStyle = '#c9c9c4';
    ctx.fillRect(W / 2 - 20, H - 50, 40, 6);
    // karat & rembesan
    for (let i = 0; i < 26; i++) {
      const x = pillar + r() * (W - pillar * 2);
      const len = 30 + r() * 160;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, 'rgba(110,60,30,0.45)');
      g.addColorStop(1, 'rgba(110,60,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y0, 2 + r() * 5, len);
    }
    return { map: tex(c), bump: tex(hc, false), realSize: [2.13, 3.2] };
  },
  'asphalt-wet'() {
    const { c, ctx } = canvas();
    paintNoise(ctx, '#2b2d31', fbm(S, 6, 5, 201), 0.5);
    speckle(ctx, rng(202), 4000, ['#55575c', '#18191b', '#6d6f73'], 1.8);
    // pantulan basah
    const n = fbm(S, 3, 4, 203);
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) {
      const w = Math.max(0, n[i] - 0.55) * 1.6;
      img.data[i * 4] = img.data[i * 4] * (1 - w) + 70 * w;
      img.data[i * 4 + 1] = img.data[i * 4 + 1] * (1 - w) + 78 * w;
      img.data[i * 4 + 2] = img.data[i * 4 + 2] * (1 - w) + 98 * w;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c), bump: tex(c, false), realSize: 2.4 };
  },

  // --- lain-lain
  grime() {
    const { c, ctx } = canvas();
    const n = fbm(S, 4, 5, 161);
    const n2 = fbm(S, 16, 3, 162);
    const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const a = Math.max(0, n[i] - 0.45) * 2.2 + Math.max(0, n2[i] - 0.6) * 1.2;
      img.data[i * 4] = 52;
      img.data[i * 4 + 1] = 38;
      img.data[i * 4 + 2] = 24;
      img.data[i * 4 + 3] = Math.min(255, a * 255);
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c), realSize: 4 };
  },
};

const cache = new Map<string, TexSet>();

export function getTexSet(name: string): TexSet {
  let t = cache.get(name);
  if (!t) {
    t = (builders[name] ?? builders.concrete)();
    cache.set(name, t);
  }
  return t;
}

const repeatCache = new Map<string, { map: THREE.Texture; bump?: THREE.Texture }>();

/** Tekstur dengan repeat disesuaikan agar ukuran pola sesuai dunia nyata. */
export function texturesFor(name: string, widthM: number, heightM: number): { map: THREE.Texture; bump?: THREE.Texture } {
  const set = getTexSet(name);
  const [sw, sh] = Array.isArray(set.realSize) ? set.realSize : [set.realSize, set.realSize];
  const rx = Math.max(0.01, widthM / sw);
  const ry = Math.max(0.01, heightM / sh);
  const key = `${name}:${rx.toFixed(3)}:${ry.toFixed(3)}`;
  let hit = repeatCache.get(key);
  if (!hit) {
    const map = set.map.clone();
    map.repeat.set(rx, ry);
    map.needsUpdate = true;
    let bump: THREE.Texture | undefined;
    if (set.bump) {
      bump = set.bump.clone();
      bump.repeat.set(rx, ry);
      bump.needsUpdate = true;
    }
    hit = { map, bump };
    repeatCache.set(key, hit);
  }
  return hit;
}

/** Tekstur teks (neon sign, plakat nama). */
export function textTexture(text: string, opts: { color: string; bg?: string; glow?: boolean; font?: string; width?: number; height?: number }): THREE.CanvasTexture {
  const w = opts.width ?? 512;
  const h = opts.height ?? 160;
  const { c, ctx } = (() => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return { c: cv, ctx: cv.getContext('2d')! };
  })();
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
  } else ctx.clearRect(0, 0, w, h);
  let size = h * 0.62;
  const family = opts.font ?? '"Chakra Petch", "Arial Black", sans-serif';
  ctx.font = `700 ${size}px ${family}`;
  const maxW = w * 0.9;
  const measured = ctx.measureText(text).width;
  if (measured > maxW) {
    size *= maxW / measured;
    ctx.font = `700 ${size}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.glow) {
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = h * 0.12;
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = opts.color;
    ctx.strokeText(text, w / 2, h / 2);
    ctx.shadowBlur = h * 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2);
  } else {
    ctx.fillStyle = opts.color;
    ctx.fillText(text, w / 2, h / 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
