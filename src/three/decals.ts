import * as THREE from 'three';
import { ITEMS, byId, type ItemDef } from '../../shared/catalog.ts';

/**
 * Stiker/aset print: digambar di <canvas> lalu ditempel sebagai bidang datar di dinding/lantai.
 * Karena datar, hasilnya sama persis dengan yang dicetak (lihat print.ts).
 */

const PX_PER_M = 320;
const MAX_PX = 2048;

export const FONT_JP = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';
const F_SIGN = `"Chakra Petch", ${FONT_JP}`;
const F_TAG = `"Permanent Marker", ${FONT_JP}`;
const F_BUBBLE = `Bungee, ${FONT_JP}`;

type O = { color: string; text: string; r: () => number };
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, o: O) => void;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Terangkan (k>0) atau gelapkan (k<0) warna hex. */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Atur ukuran font supaya teks muat di kotak. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, maxW: number, maxH: number) {
  let size = maxH;
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) size *= maxW / w;
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

/** Efek cat aus: hapus bintik-bintik kecil. */
function wear(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, r: () => number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < w * h * amount * 0.002; i++) {
    ctx.globalAlpha = 0.3 + r() * 0.7;
    const s = 1 + r() * 3;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.restore();
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, r: () => number, wobble = 0.25) {
  const n = 18;
  const ph = [r() * 6, r() * 6, r() * 6];
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 2 + ph[0]) * 0.5 + Math.sin(a * 3 + ph[1]) * 0.35 + Math.sin(a * 5 + ph[2]) * 0.2);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  const mid = (i: number): [number, number] => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  ctx.moveTo(...mid(0));
  for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(pts[i % n][0], pts[i % n][1], ...mid(i));
  ctx.closePath();
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.1;
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = size * 0.15;
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = shade(color, 0.55);
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = shade(color, 0.85);
  ctx.fillText(text, x, y);
}

const DRAW: Record<string, Draw> = {
  // ------------------------------------------------ neon & papan
  'neon-sign'(ctx, w, h, { color, text }) {
    rrect(ctx, h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08, h * 0.12);
    ctx.fillStyle = 'rgba(12,12,18,0.6)';
    ctx.fill();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = h * 0.12;
    ctx.strokeStyle = shade(color, 0.3);
    ctx.lineWidth = h * 0.03;
    rrect(ctx, h * 0.1, h * 0.1, w - h * 0.2, h - h * 0.2, h * 0.08);
    ctx.stroke();
    ctx.restore();
    const size = fit(ctx, text, '700', F_SIGN, w * 0.78, h * 0.5);
    neonText(ctx, text, w / 2, h / 2 + size * 0.04, size, color);
  },

  lightbox(ctx, w, h, { color, text }) {
    rrect(ctx, 0, 0, w, h, h * 0.06);
    ctx.fillStyle = '#26282c';
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(color, 0.35));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -0.25));
    ctx.fillStyle = g;
    ctx.fillRect(h * 0.07, h * 0.07, w - h * 0.14, h - h * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(h * 0.07, h * 0.07, w - h * 0.14, h * 0.05);
    const size = fit(ctx, text, '900', F_SIGN, w * 0.84, h * 0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.08;
    ctx.strokeStyle = shade(color, -0.5);
    ctx.strokeText(text, w / 2, h / 2 + size * 0.04);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  },

  'vertical-sign'(ctx, w, h, { color, text }) {
    rrect(ctx, 0, 0, w, h, w * 0.08);
    ctx.fillStyle = '#26282c';
    ctx.fill();
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, shade(color, -0.2));
    g.addColorStop(0.5, shade(color, 0.25));
    g.addColorStop(1, shade(color, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.1, w * 0.1, w * 0.8, h - w * 0.2);
    const chars = Array.from(text);
    const cell = (h - w * 0.3) / Math.max(1, chars.length);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      fit(ctx, ch, '900', F_SIGN, w * 0.66, Math.min(cell * 0.85, w * 0.7));
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ch, w / 2, w * 0.15 + cell * (i + 0.5));
    });
  },

  // ------------------------------------------------ elemen dinding
  shutter(ctx, w, h, { color, r }) {
    const housing = h * 0.1;
    ctx.fillStyle = shade(color, -0.45);
    ctx.fillRect(0, 0, w, housing);
    ctx.fillStyle = shade(color, -0.25);
    ctx.fillRect(0, housing * 0.15, w, housing * 0.2);
    const rail = w * 0.035;
    ctx.fillStyle = shade(color, -0.55);
    ctx.fillRect(0, housing, rail, h - housing);
    ctx.fillRect(w - rail, housing, rail, h - housing);
    const slat = Math.max(6, h / 42);
    for (let y = housing; y < h - slat; y += slat) {
      const g = ctx.createLinearGradient(0, y, 0, y + slat);
      g.addColorStop(0, shade(color, 0.3));
      g.addColorStop(0.6, color);
      g.addColorStop(1, shade(color, -0.45));
      ctx.fillStyle = g;
      ctx.fillRect(rail, y, w - rail * 2, slat);
    }
    ctx.fillStyle = shade(color, -0.6);
    ctx.fillRect(rail, h - slat * 1.2, w - rail * 2, slat * 1.2);
    ctx.fillStyle = '#d9d9d4';
    ctx.fillRect(w / 2 - w * 0.04, h - slat * 3.2, w * 0.08, slat * 0.6);
    for (let i = 0; i < 14; i++) {
      const x = rail + r() * (w - rail * 2);
      const len = h * (0.1 + r() * 0.4);
      const g = ctx.createLinearGradient(0, housing, 0, housing + len);
      g.addColorStop(0, 'rgba(105,58,28,0.5)');
      g.addColorStop(1, 'rgba(105,58,28,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, housing, 2 + r() * 6, len);
    }
  },

  'steel-door'(ctx, w, h, { color }) {
    ctx.fillStyle = '#3b3d41';
    ctx.fillRect(0, 0, w, h);
    const f = w * 0.06;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, shade(color, -0.15));
    g.addColorStop(0.5, shade(color, 0.12));
    g.addColorStop(1, shade(color, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(f, f, w - f * 2, h - f);
    ctx.strokeStyle = shade(color, -0.35);
    ctx.lineWidth = w * 0.02;
    ctx.strokeRect(w * 0.18, h * 0.1, w * 0.64, h * 0.32);
    ctx.strokeRect(w * 0.18, h * 0.52, w * 0.64, h * 0.4);
    ctx.fillStyle = '#cfd2d6';
    ctx.fillRect(w * 0.76, h * 0.48, w * 0.12, h * 0.025);
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.08);
    ctx.fillStyle = '#c62d2d';
    fit(ctx, 'STAFF ONLY', '700', F_SIGN, w * 0.36, h * 0.05);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STAFF ONLY', w / 2, h * 0.24);
  },

  window(ctx, w, h, { color }) {
    const f = Math.min(w, h) * 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h * 0.94);
    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, '#5f7f99');
    g.addColorStop(0.5, '#253645');
    g.addColorStop(1, '#3d5468');
    ctx.fillStyle = g;
    ctx.fillRect(f, f, w - f * 2, h * 0.94 - f * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(w * 0.25, f);
    ctx.lineTo(w * 0.45, f);
    ctx.lineTo(w * 0.2, h * 0.94 - f);
    ctx.lineTo(f, h * 0.94 - f);
    ctx.lineTo(f, h * 0.5);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(w / 2 - f * 0.4, f, f * 0.8, h * 0.94 - f * 2);
    ctx.fillStyle = shade(color.startsWith('#') ? color : '#888888', -0.2);
    ctx.fillRect(-1, h * 0.92, w + 2, h * 0.08);
  },

  'ac-unit'(ctx, w, h) {
    rrect(ctx, 0, 0, w, h, h * 0.05);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f1f0eb');
    g.addColorStop(1, '#cfcdc6');
    ctx.fillStyle = g;
    ctx.fill();
    const cx = w * 0.36;
    const cy = h / 2;
    const rad = h * 0.38;
    ctx.fillStyle = '#2b2d30';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b6f75';
    ctx.lineWidth = h * 0.012;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (rad * i) / 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos((i * Math.PI) / 4) * rad, cy + Math.sin((i * Math.PI) / 4) * rad);
      ctx.lineTo(cx - Math.cos((i * Math.PI) / 4) * rad, cy - Math.sin((i * Math.PI) / 4) * rad);
      ctx.stroke();
    }
    ctx.fillStyle = '#b9b7b0';
    for (let y = h * 0.15; y < h * 0.85; y += h * 0.06) ctx.fillRect(w * 0.72, y, w * 0.2, h * 0.02);
    ctx.fillStyle = '#9a9890';
    ctx.fillRect(w * 0.9, h * 0.75, w * 0.04, h * 0.25);
  },

  'wall-lamp'(ctx, w, h, { color }) {
    const top = h * 0.12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w / 2 - w * 0.06, top);
    ctx.lineTo(w / 2 + w * 0.06, top);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, hexA(color, 0.75));
    g.addColorStop(0.5, hexA(color, 0.28));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const hg = ctx.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.5, 'rgba(0,0,0,1)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    const halo = ctx.createRadialGradient(w / 2, top, 0, w / 2, top, w * 0.3);
    halo.addColorStop(0, hexA(color, 0.9));
    halo.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, top * 2.5);
    ctx.fillStyle = '#2a2d31';
    ctx.fillRect(w / 2 - w * 0.015, 0, w * 0.03, top * 0.5);
    ctx.beginPath();
    ctx.moveTo(w / 2 - w * 0.04, top * 0.45);
    ctx.lineTo(w / 2 + w * 0.04, top * 0.45);
    ctx.lineTo(w / 2 + w * 0.08, top);
    ctx.lineTo(w / 2 - w * 0.08, top);
    ctx.fill();
  },

  pipes(ctx, w, h, { r }) {
    const pipe = (x: number, pw: number, base: string) => {
      const g = ctx.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
      g.addColorStop(0, shade(base, -0.45));
      g.addColorStop(0.35, shade(base, 0.35));
      g.addColorStop(1, shade(base, -0.55));
      ctx.fillStyle = g;
      ctx.fillRect(x - pw / 2, 0, pw, h);
      for (let y = h * 0.12; y < h; y += h * 0.25) {
        ctx.fillStyle = '#3b3d40';
        ctx.fillRect(x - pw * 0.7, y, pw * 1.4, h * 0.02);
        const rg = ctx.createLinearGradient(0, y, 0, y + h * 0.12);
        rg.addColorStop(0, 'rgba(110,60,30,0.6)');
        rg.addColorStop(1, 'rgba(110,60,30,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(x - pw * 0.3 + r() * pw * 0.3, y, pw * 0.2, h * 0.12);
      }
    };
    pipe(w * 0.3, w * 0.34, '#8d9094');
    pipe(w * 0.76, w * 0.16, '#6f7a7f');
  },

  'meter-box'(ctx, w, h) {
    ctx.fillStyle = '#4c5054';
    ctx.fillRect(w * 0.44, 0, w * 0.12, h * 0.2);
    ctx.fillRect(w * 0.47, h * 0.8, w * 0.06, h * 0.2);
    rrect(ctx, w * 0.05, h * 0.15, w * 0.9, h * 0.68, w * 0.05);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#9da1a3');
    g.addColorStop(0.5, '#c4c7c8');
    g.addColorStop(1, '#8c9092');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#20262b';
    ctx.fillRect(w * 0.2, h * 0.24, w * 0.6, h * 0.24);
    ctx.fillStyle = '#e8e8e2';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.36, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c419';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.55);
    ctx.lineTo(w * 0.6, h * 0.7);
    ctx.lineTo(w * 0.4, h * 0.7);
    ctx.fill();
    ctx.fillStyle = '#111';
    fit(ctx, '!', '900', F_SIGN, w * 0.1, h * 0.1);
    ctx.textAlign = 'center';
    ctx.fillText('!', w / 2, h * 0.685);
  },

  cables(ctx, w, h, { r }) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y1 = h * (0.05 + r() * 0.3);
      const y2 = h * (0.05 + r() * 0.3);
      const sag = h * (0.3 + r() * 0.55);
      ctx.strokeStyle = i % 3 ? '#121212' : '#2b2b2b';
      ctx.lineWidth = 2 + r() * 4;
      ctx.beginPath();
      ctx.moveTo(-10, y1);
      ctx.quadraticCurveTo(w * (0.3 + r() * 0.4), sag, w + 10, y2);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = w * (0.15 + r() * 0.7);
      ctx.strokeStyle = '#151515';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.3);
      ctx.bezierCurveTo(x + 20, h * 0.5, x - 20, h * 0.7, x + 5, h);
      ctx.stroke();
      ctx.fillStyle = '#3d4044';
      ctx.fillRect(x - 10, h * 0.25, 20, 26);
    }
  },

  vent(ctx, w, h) {
    ctx.fillStyle = '#9ea2a5';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d1f22';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9ccce';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((i * Math.PI) / 2 + 0.3);
      ctx.beginPath();
      ctx.ellipse(w * 0.18, 0, w * 0.18, w * 0.07, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,40,0.6)';
    ctx.lineWidth = w * 0.015;
    for (let y = h * 0.1; y < h; y += h * 0.1) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, y);
      ctx.lineTo(w * 0.94, y);
      ctx.stroke();
    }
  },

  poster(ctx, w, h, { color }) {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, w, h);
    const m = w * 0.04;
    ctx.fillStyle = color;
    ctx.fillRect(m, m, w - m * 2, h - m * 2);
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.moveTo(m, h * 0.74);
    ctx.lineTo(w - m, h * 0.35);
    ctx.lineTo(w - m, h * 0.47);
    ctx.lineTo(m, h * 0.86);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    fit(ctx, String(10 + (hashStr(color) % 80)), 'italic 900', F_SIGN, w * 0.8, h * 0.38);
    ctx.fillText(String(10 + (hashStr(color) % 80)), w / 2, h * 0.45);
    ctx.fillStyle = '#f4f1ea';
    fit(ctx, 'RACING', '700', F_SIGN, w * 0.7, h * 0.1);
    ctx.fillText('RACING', w / 2, h * 0.94);
  },

  pegboard(ctx, w, h, { r }) {
    ctx.fillStyle = '#cfae7f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a5f3c';
    const step = h / 14;
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) ctx.fillRect(x, y, step * 0.2, step * 0.2);
    const tools = ['#b9bec4', '#c62d2d', '#e0b021', '#2c5aa0', '#9aa0a6'];
    for (let i = 0; i < 8; i++) {
      const x = w * (0.08 + i * 0.07);
      const len = h * (0.25 + (i % 3) * 0.08);
      ctx.fillStyle = tools[i % tools.length];
      ctx.fillRect(x, h * 0.12, w * 0.018, len);
      ctx.beginPath();
      ctx.arc(x + w * 0.009, h * 0.12, w * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5b3b22';
    ctx.fillRect(w * 0.7, h * 0.15, w * 0.03, h * 0.35);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(w * 0.64, h * 0.12, w * 0.15, h * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = tools[(i + 1) % tools.length];
      ctx.fillRect(w * (0.84 + i * 0.04), h * 0.15, w * 0.02, h * 0.12);
      ctx.fillStyle = '#c9cdd2';
      ctx.fillRect(w * (0.845 + i * 0.04), h * 0.27, w * 0.008, h * 0.15);
    }
    ctx.fillStyle = '#c62d2d';
    ctx.fillRect(w * 0.1, h * 0.7, w * 0.35, h * 0.2);
    ctx.fillStyle = '#7a1c1c';
    ctx.fillRect(w * 0.1, h * 0.77, w * 0.35, h * 0.02);
    void r;
  },

  // ------------------------------------------------ grafiti
  'graffiti-tag'(ctx, w, h, { color, text, r }) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.08);
    const size = fit(ctx, text, '400', F_TAG, w * 0.85, h * 0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = hexA(color, 0.6);
    ctx.shadowBlur = size * 0.08;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = 0;
    const tw = ctx.measureText(text).width;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = -tw / 2 + r() * tw;
      const len = size * (0.2 + r() * 0.6);
      ctx.lineWidth = 1.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, size * 0.2);
      ctx.lineTo(x, size * 0.2 + len);
      ctx.stroke();
    }
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.moveTo(-tw / 2, size * 0.42);
    ctx.quadraticCurveTo(0, size * 0.62, tw / 2 + size * 0.2, size * 0.3);
    ctx.stroke();
    ctx.restore();
  },

  'graffiti-piece'(ctx, w, h, { color, text, r }) {
    const other = ['#33d6ff', '#ffd23b', '#ff3b6b', '#7dff6a'].find((c) => c !== color) ?? '#ffffff';
    for (let i = 0; i < 6; i++) {
      const g = ctx.createRadialGradient(w * (0.15 + r() * 0.7), h * (0.3 + r() * 0.4), 0, w * 0.5, h * 0.5, w * 0.35);
      g.addColorStop(0, hexA(other, 0.45));
      g.addColorStop(1, hexA(other, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    const size = fit(ctx, text, '400', F_BUBBLE, w * 0.8, h * 0.62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const x = w / 2;
    const y = h / 2;
    for (let d = 10; d > 0; d--) {
      ctx.fillStyle = '#141414';
      ctx.fillText(text, x + d * size * 0.012, y + d * size * 0.012);
    }
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = '#141414';
    ctx.strokeText(text, x, y);
    ctx.lineWidth = size * 0.08;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, shade(color, 0.5));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) star(ctx, w * (0.1 + r() * 0.8), h * (0.15 + r() * 0.7), size * (0.06 + r() * 0.06));
  },

  'sticker-bomb'(ctx, w, h, { r }) {
    const labels = ['JDM', '1:64', 'TURBO', 'DRIFT', 'RACE', '★', 'TOKYO', 'OSAKA', '走り屋', 'LOW', 'HSCALE'];
    const colors = ['#ff3b6b', '#33d6ff', '#ffd23b', '#111111', '#f2f2f2', '#7dff6a', '#ff8a2b', '#c86bff'];
    for (let i = 0; i < 16; i++) {
      const sw = w * (0.18 + r() * 0.22);
      const sh = sw * (0.4 + r() * 0.5);
      ctx.save();
      ctx.translate(w * (0.12 + r() * 0.76), h * (0.12 + r() * 0.76));
      ctx.rotate((r() - 0.5) * 0.8);
      const c = colors[Math.floor(r() * colors.length)];
      rrect(ctx, -sw / 2 - 3, -sh / 2 - 3, sw + 6, sh + 6, sh * 0.2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      rrect(ctx, -sw / 2, -sh / 2, sw, sh, sh * 0.18);
      ctx.fillStyle = c;
      ctx.fill();
      const t = labels[Math.floor(r() * labels.length)];
      fit(ctx, t, '900', F_SIGN, sw * 0.85, sh * 0.7);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c === '#f2f2f2' || c === '#ffd23b' || c === '#7dff6a' ? '#111' : '#fff';
      ctx.fillText(t, 0, sh * 0.04);
      ctx.restore();
    }
  },

  // ------------------------------------------------ lantai
  puddle(ctx, w, h, { color, r }) {
    const seed = Math.floor(r() * 1e9);
    const shape = () => blob(ctx, w / 2, h / 2, w * 0.42, h * 0.38, rng(seed), 0.3);
    shape();
    ctx.save();
    ctx.clip();
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45);
    g.addColorStop(0, 'rgba(14,16,24,0.92)');
    g.addColorStop(1, 'rgba(30,34,46,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = `blur(${Math.round(w * 0.025)}px)`;
    const hues = [color, '#33d6ff', '#ffd23b', '#c86bff', '#ff3b6b'].filter((c, i, a) => a.indexOf(c) === i);
    for (let i = 0; i < 4; i++) {
      const x = w * (0.18 + r() * 0.64);
      const sw = w * (0.05 + r() * 0.09);
      const lg = ctx.createLinearGradient(0, 0, 0, h);
      const c = hues[i % hues.length];
      lg.addColorStop(0, hexA(c, 0.15));
      lg.addColorStop(0.5, hexA(c, 0.6));
      lg.addColorStop(1, hexA(c, 0.1));
      ctx.fillStyle = lg;
      ctx.fillRect(x - sw / 2, 0, sw, h);
    }
    ctx.filter = 'none';
    ctx.restore();
    shape();
    ctx.strokeStyle = 'rgba(200,215,235,0.18)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.stroke();
  },

  'parking-lines'(ctx, w, h, { color, r }) {
    const t = w * (0.12 / 2.6);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, t, h);
    ctx.fillRect(w - t, 0, t, h);
    ctx.fillRect(0, 0, w, t);
    wear(ctx, w, h, 1, r);
  },

  arrow(ctx, w, h, { color, r }) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h * 0.35);
    ctx.lineTo(w * 0.68, h * 0.35);
    ctx.lineTo(w * 0.68, h);
    ctx.lineTo(w * 0.32, h);
    ctx.lineTo(w * 0.32, h * 0.35);
    ctx.lineTo(0, h * 0.35);
    ctx.closePath();
    ctx.fill();
    wear(ctx, w, h, 1, r);
  },

  'floor-text'(ctx, w, h, { color, text, r }) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 1.25);
    fit(ctx, text, '900', F_SIGN, w * 0.92, h * 0.7);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
    wear(ctx, w, h, 1.2, r);
  },

  crosswalk(ctx, w, h, { r }) {
    ctx.fillStyle = '#f2f2f2';
    const bar = w / 10;
    for (let i = 0; i < 5; i++) ctx.fillRect(i * bar * 2 + bar * 0.5, 0, bar, h);
    wear(ctx, w, h, 1.5, r);
  },

  'hazard-stripe'(ctx, w, h, { r }) {
    ctx.fillStyle = '#f0c419';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151515';
    for (let x = -h; x < w + h; x += h * 1.4) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h * 0.7, h);
      ctx.lineTo(x + h * 1.4, 0);
      ctx.lineTo(x + h * 0.7, 0);
      ctx.fill();
    }
    wear(ctx, w, h, 0.8, r);
  },

  manhole(ctx, w, h) {
    const c = w / 2;
    ctx.fillStyle = '#2a2b2d';
    ctx.beginPath();
    ctx.arc(c, c, w * 0.49, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4b4d50';
    ctx.lineWidth = w * 0.03;
    for (const k of [0.44, 0.3, 0.16]) {
      ctx.beginPath();
      ctx.arc(c, c, w * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = w * 0.015;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * w * 0.16, c + Math.sin(a) * w * 0.16);
      ctx.lineTo(c + Math.cos(a) * w * 0.44, c + Math.sin(a) * w * 0.44);
      ctx.stroke();
    }
    ctx.fillStyle = '#18191a';
    ctx.beginPath();
    ctx.arc(c, c, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
    void h;
  },

  'oil-stain'(ctx, w, h, { r }) {
    for (let i = 0; i < 5; i++) {
      blob(ctx, w * (0.3 + r() * 0.4), h * (0.3 + r() * 0.4), w * (0.1 + r() * 0.25), h * (0.1 + r() * 0.25), r, 0.35);
      ctx.fillStyle = `rgba(20,14,8,${0.25 + r() * 0.3})`;
      ctx.fill();
    }
    blob(ctx, w * 0.5, h * 0.5, w * 0.18, h * 0.15, r, 0.3);
    ctx.strokeStyle = 'rgba(120,80,200,0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
  },

  'tire-marks'(ctx, w, h, { r }) {
    for (const off of [0.32, 0.68]) {
      for (let k = 0; k < 14; k++) {
        ctx.strokeStyle = `rgba(15,15,15,${0.06 + r() * 0.08})`;
        ctx.lineWidth = h * 0.012;
        const y = h * off + (k - 7) * h * 0.012;
        ctx.beginPath();
        ctx.moveTo(w * 0.02, y + h * 0.1);
        ctx.bezierCurveTo(w * 0.35, y - h * 0.15, w * 0.65, y + h * 0.18, w * 0.98, y - h * 0.05);
        ctx.stroke();
      }
    }
  },

  drain(ctx, w, h) {
    ctx.fillStyle = '#3c3e41';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111214';
    ctx.fillRect(h * 0.15, h * 0.15, w - h * 0.3, h * 0.7);
    ctx.fillStyle = '#56595d';
    for (let x = h * 0.25; x < w - h * 0.2; x += h * 0.28) ctx.fillRect(x, h * 0.15, h * 0.1, h * 0.7);
  },
};

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

/** Ukuran stiker dalam meter [lebar, tinggi-atau-panjang]. */
export function decalSize(def: ItemDef, scale = 1): [number, number] {
  return [def.size[0] * scale, (def.mount === 'floor' ? def.size[2] : def.size[1]) * scale];
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const GLOWING = new Set(['neon-sign', 'lightbox', 'vertical-sign', 'wall-lamp']);

export function decalMaterial(id: string, color?: string, text?: string): THREE.MeshStandardMaterial {
  const def = byId(ITEMS, id)!;
  const c = color ?? def.colors?.[0] ?? '#ffffff';
  const t = text ?? def.text?.default ?? '';
  const key = `${id}|${c}|${t}`;
  let m = matCache.get(key);
  if (m) return m;
  const [wm, hm] = decalSize(def);
  const k = Math.min(1, MAX_PX / (Math.max(wm, hm) * PX_PER_M));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.round(wm * PX_PER_M * k));
  canvas.height = Math.max(16, Math.round(hm * PX_PER_M * k));
  const ctx = canvas.getContext('2d')!;
  (DRAW[id] ?? DRAW.poster)(ctx, canvas.width, canvas.height, { color: c, text: t, r: rng(hashStr(key)) });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const glossy = id === 'puddle';
  m = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    roughness: glossy ? 0.06 : 0.82,
    metalness: glossy ? 0.35 : 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    ...(GLOWING.has(id) ? { emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: id === 'wall-lamp' ? 0.25 : 0.4 } : {}),
  });
  matCache.set(key, m);
  return m;
}

const planeGeo = new THREE.PlaneGeometry(1, 1);

/**
 * Bangun stiker sebagai Group.
 * - dinding: bidang tegak, sisi bawah di y=0, menghadap +Z
 * - lantai: bidang rebah, bagian atas gambar ke arah -Z (belakang)
 */
export function buildDecal(id: string, opts: { color?: string; text?: string; scale?: number } = {}): THREE.Group {
  const def = byId(ITEMS, id)!;
  const [w, h] = decalSize(def, opts.scale ?? 1);
  const mesh = new THREE.Mesh(planeGeo, decalMaterial(id, opts.color, opts.text));
  mesh.scale.set(w, h, 1);
  mesh.receiveShadow = true;
  const g = new THREE.Group();
  if (def.mount === 'floor') mesh.rotation.x = -Math.PI / 2;
  else mesh.position.y = h / 2;
  g.add(mesh);
  return g;
}
