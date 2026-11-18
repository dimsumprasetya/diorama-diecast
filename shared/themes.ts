/**
 * TEMA SIAP PAKAI — titik awal desain customer.
 * Box standar 10×5×5 cm = 6,4 × 3,2 × 3,2 m dunia nyata.
 *   - Lantai: x dari -3,2 (kiri) s/d 3,2 (kanan), z dari -1,6 (belakang) s/d 1,6 (depan)
 *   - Dinding belakang: u dari -3,2 s/d 3,2;  dinding kiri/kanan: u dari -1,6 s/d 1,6
 *   - v = tinggi sisi bawah aset dari lantai (0 s/d 3,2)
 * Cara termudah membuat tema baru: susun di configurator, klik "Bagikan", lalu salin isinya ke sini.
 */
import type { PanelId } from './catalog.ts';

type ThemeItem =
  | { id: string; mount: 'floor'; x: number; z: number; rot: number; scale: number; color?: string; text?: string }
  | { id: string; mount: 'wall'; wall: 'back' | 'left' | 'right'; u: number; v: number; scale: number; color?: string; text?: string };

export type ThemeDef = {
  id: string;
  name: string;
  desc: string;
  design: {
    panels: Record<PanelId, { bg: string; color?: string }>;
    grime: string;
    items: ThemeItem[];
    options: { led: boolean; baseText: string };
  };
};

export const THEMES: ThemeDef[] = [
  {
    id: 'midnight-alley',
    name: 'Midnight Alley',
    desc: 'Gang belakang kota Jepang: rolling door, neon, aspal basah',
    design: {
      panels: { back: { bg: 'shutters' }, left: { bg: 'concrete-wall' }, right: { bg: 'brick-old' }, floor: { bg: 'asphalt-wet' } },
      grime: 'light',
      options: { led: false, baseText: '' },
      items: [
        { id: 'cables', mount: 'wall', wall: 'back', u: 0, v: 1.95, scale: 1 },
        { id: 'lightbox', mount: 'wall', wall: 'back', u: -1.75, v: 2.42, scale: 0.9, color: '#e8452c', text: 'ラーメン' },
        { id: 'neon-sign', mount: 'wall', wall: 'back', u: 0.05, v: 2.5, scale: 0.6, color: '#ffd23b', text: '24時間' },
        { id: 'lightbox', mount: 'wall', wall: 'back', u: 1.8, v: 2.42, scale: 0.9, color: '#7c3aed', text: '居酒屋' },
        { id: 'graffiti-tag', mount: 'wall', wall: 'back', u: -1.7, v: 0.95, scale: 0.95, color: '#111111', text: 'HSCALE' },
        { id: 'graffiti-piece', mount: 'wall', wall: 'back', u: 1.75, v: 0.85, scale: 0.7, color: '#c86bff', text: 'JDM' },
        { id: 'pipes', mount: 'wall', wall: 'left', u: -1.15, v: 0, scale: 1 },
        { id: 'meter-box', mount: 'wall', wall: 'left', u: 0.1, v: 1.25, scale: 1 },
        { id: 'vertical-sign', mount: 'wall', wall: 'left', u: 1.0, v: 1.4, scale: 1, color: '#e8452c', text: '居酒屋' },
        { id: 'wall-lamp', mount: 'wall', wall: 'right', u: 0.15, v: 0.4, scale: 1, color: '#ffd59a' },
        { id: 'ac-unit', mount: 'wall', wall: 'right', u: -1.0, v: 2.2, scale: 1 },
        { id: 'puddle', mount: 'floor', x: -2.2, z: 0.9, rot: 15, scale: 1, color: '#ff3b6b' },
        { id: 'puddle', mount: 'floor', x: 2.3, z: -0.6, rot: -20, scale: 1.1, color: '#33d6ff' },
        { id: 'puddle', mount: 'floor', x: 0.7, z: 1.2, rot: 5, scale: 0.7, color: '#c86bff' },
        { id: 'manhole', mount: 'floor', x: -1.7, z: -0.85, rot: 0, scale: 1 },
      ],
    },
  },
  {
    id: 'home-garage',
    name: 'Garasi Rumah',
    desc: 'Dinding kayu, AC, lantai keramik & marka kuning',
    design: {
      panels: { back: { bg: 'wood-wall' }, left: { bg: 'plaster', color: '#e8e4da' }, right: { bg: 'plaster', color: '#e8e4da' }, floor: { bg: 'tiles' } },
      grime: 'none',
      options: { led: false, baseText: '' },
      items: [
        { id: 'ac-unit', mount: 'wall', wall: 'back', u: 2.2, v: 2.15, scale: 1 },
        { id: 'window', mount: 'wall', wall: 'back', u: -1.7, v: 1.4, scale: 1, color: '#ecebe6' },
        { id: 'parking-lines', mount: 'floor', x: 0, z: 0.05, rot: 90, scale: 1, color: '#f0c419' },
        { id: 'pegboard', mount: 'wall', wall: 'left', u: 0, v: 1.1, scale: 1 },
        { id: 'tire-stack', mount: 'floor', x: -2.75, z: -1.15, rot: 0, scale: 1 },
        { id: 'tool-cabinet', mount: 'floor', x: 2.65, z: -1.33, rot: 0, scale: 1, color: '#c62d2d' },
      ],
    },
  },
  {
    id: 'race-garage',
    name: 'Bengkel Racing',
    desc: 'Seng biru, neon GARAGE, lantai epoxy & bekas ban',
    design: {
      panels: { back: { bg: 'corrugated', color: '#5c6f7e' }, left: { bg: 'brick-white' }, right: { bg: 'brick-white' }, floor: { bg: 'epoxy' } },
      grime: 'none',
      options: { led: false, baseText: '' },
      items: [
        { id: 'neon-sign', mount: 'wall', wall: 'back', u: 0.3, v: 2.35, scale: 1, color: '#33d6ff', text: 'GARAGE' },
        { id: 'poster', mount: 'wall', wall: 'back', u: -2.4, v: 1.3, scale: 1, color: '#d9442b' },
        { id: 'poster', mount: 'wall', wall: 'back', u: -1.65, v: 1.3, scale: 1, color: '#f0c419' },
        { id: 'pegboard', mount: 'wall', wall: 'right', u: 0, v: 1.0, scale: 1 },
        { id: 'hazard-stripe', mount: 'floor', x: 0, z: 1.35, rot: 0, scale: 1 },
        { id: 'tire-marks', mount: 'floor', x: 0.4, z: -0.1, rot: 0, scale: 1 },
        { id: 'tire-stack', mount: 'floor', x: -2.75, z: -1.2, rot: 0, scale: 1 },
        { id: 'oil-drum', mount: 'floor', x: 2.8, z: -1.25, rot: 0, scale: 1, color: '#b8322a' },
      ],
    },
  },
  {
    id: 'blank',
    name: 'Kanvas Kosong',
    desc: 'Mulai dari nol, tembok polos & lantai beton',
    design: {
      panels: { back: { bg: 'plaster', color: '#e8e4da' }, left: { bg: 'plaster', color: '#e8e4da' }, right: { bg: 'plaster', color: '#e8e4da' }, floor: { bg: 'concrete' } },
      grime: 'none',
      options: { led: false, baseText: '' },
      items: [],
    },
  },
  {
    id: 'own-design',
    name: 'Desain Sendiri',
    desc: 'Upload gambar/foto sendiri untuk dinding',
    design: {
      panels: { back: { bg: 'upload' }, left: { bg: 'upload' }, right: { bg: 'upload' }, floor: { bg: 'concrete' } },
      grime: 'none',
      options: { led: false, baseText: '' },
      items: [],
    },
  },
];
