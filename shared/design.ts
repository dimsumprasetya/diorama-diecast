import {
  BOX_SIZES, CAR_COLORS, CAR_MODELS, FLOOR_BACKGROUNDS, ITEMS, OPTIONS, PAINT_COLORS, SHOP, WALL_BACKGROUNDS,
  byId, enabledSizes, type PanelId,
} from './catalog.ts';
import { THEMES } from './themes.ts';

export type WallSide = 'back' | 'left' | 'right';

/** Semua posisi dalam meter dunia nyata, relatif terhadap tengah lantai box. */
export type FloorItem = {
  uid: string;
  id: string;
  mount: 'floor';
  x: number;
  z: number;
  /** derajat */
  rot: number;
  scale: number;
  color?: string;
  text?: string;
};

export type WallItem = {
  uid: string;
  id: string;
  mount: 'wall';
  wall: WallSide;
  /** posisi tengah item sepanjang dinding (m), dilihat dari dalam box: kiri → kanan */
  u: number;
  /** tinggi sisi bawah item dari lantai (m) */
  v: number;
  scale: number;
  color?: string;
  text?: string;
};

export type PlacedItem = FloorItem | WallItem;

export type PreviewCar = { uid: string; model: string; color: string; x: number; z: number; rot: number };

export type PanelSpec = { bg: string; color?: string };

export type Design = {
  version: 2;
  size: string;
  theme: string;
  panels: Record<PanelId, PanelSpec>;
  grime: string;
  items: PlacedItem[];
  options: { led: boolean; baseText: string };
  /** Mobil contoh — hanya untuk preview, tidak ikut diproduksi/dihitung harga. */
  cars: PreviewCar[];
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function designFromTheme(themeId: string): Design {
  const t = byId(THEMES, themeId) ?? THEMES[0];
  const d = JSON.parse(JSON.stringify(t.design)) as Omit<Design, 'version' | 'theme' | 'cars' | 'size'>;
  return {
    version: 2,
    size: enabledSizes()[0]?.id ?? BOX_SIZES[0].id,
    theme: t.id,
    ...d,
    items: d.items.map((it) => ({ ...it, uid: uid() })),
    cars: [{ uid: uid(), model: 'sport', color: '#6b2fb3', x: 0.2, z: 0.25, rot: 90 }],
  };
}

export const defaultDesign = () => designFromTheme(THEMES[0].id);

// ---------------------------------------------------------------- Validasi

const HEX = /^#[0-9a-f]{6}$/i;

function num(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? Array.from(v.replace(/[\u0000-\u001f<>]/g, '')).slice(0, max).join('') : '';
}

function panel(v: any, list: typeof WALL_BACKGROUNDS): PanelSpec {
  const def = byId(list, v?.bg);
  if (!def) throw new Error(`Pilihan print tidak valid: ${String(v?.bg)}`);
  return def.colorable ? { bg: def.id, color: HEX.test(v?.color) ? v.color : PAINT_COLORS[0] } : { bg: def.id };
}

/**
 * Membersihkan & memvalidasi desain yang dikirim dari browser.
 * Dipakai server sebelum menghitung harga, jadi harga tidak bisa dimanipulasi.
 */
export function sanitizeDesign(input: unknown): Design {
  if (!input || typeof input !== 'object') throw new Error('Desain kosong');
  const d = input as Record<string, any>;
  const size = byId(BOX_SIZES, d.size);
  if (!size || !size.enabled) throw new Error('Ukuran box tidak valid');
  const rawItems: unknown[] = Array.isArray(d.items) ? d.items : [];
  if (rawItems.length > SHOP.maxItems) throw new Error(`Maksimal ${SHOP.maxItems} aset`);

  const items: PlacedItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, any>;
    const def = byId(ITEMS, r.id);
    if (!def) throw new Error(`Aset tidak dikenal: ${String(r.id)}`);
    const color = def.colors ? (typeof r.color === 'string' && def.colors.includes(r.color) ? r.color : def.colors[0]) : undefined;
    const text = def.text ? str(r.text, def.text.max).trim() || def.text.default : undefined;
    const base = {
      uid: str(r.uid, 16) || uid(),
      id: def.id,
      scale: def.resizable ? num(r.scale, 0.4, 2.5, 1) : 1,
      ...(color ? { color } : {}),
      ...(text ? { text } : {}),
    };
    if (def.mount === 'floor') {
      items.push({ ...base, mount: 'floor', x: num(r.x, -20, 20), z: num(r.z, -20, 20), rot: num(r.rot, -360, 360) });
    } else {
      const wall = ['back', 'left', 'right'].includes(r.wall) ? (r.wall as WallSide) : 'back';
      items.push({ ...base, mount: 'wall', wall, u: num(r.u, -20, 20), v: num(r.v, 0, 20) });
    }
  }

  const p = (d.panels ?? {}) as Record<string, any>;
  const o = (d.options ?? {}) as Record<string, any>;
  const cars: PreviewCar[] = (Array.isArray(d.cars) ? d.cars : []).slice(0, 4).map((c: any) => ({
    uid: str(c?.uid, 16) || uid(),
    model: byId(CAR_MODELS, c?.model) ? c.model : CAR_MODELS[0].id,
    color: HEX.test(c?.color) ? c.color : CAR_COLORS[0],
    x: num(c?.x, -20, 20),
    z: num(c?.z, -20, 20),
    rot: num(c?.rot, -360, 360),
  }));

  return {
    version: 2,
    size: size.id,
    theme: str(d.theme, 30),
    panels: {
      back: panel(p.back, WALL_BACKGROUNDS),
      left: panel(p.left, WALL_BACKGROUNDS),
      right: panel(p.right, WALL_BACKGROUNDS),
      floor: panel(p.floor, FLOOR_BACKGROUNDS),
    },
    grime: byId(OPTIONS.grime, d.grime) ? d.grime : 'none',
    items,
    options: {
      led: OPTIONS.led.enabled && !!o.led,
      baseText: OPTIONS.baseText.enabled ? str(o.baseText, OPTIONS.baseText.max) : '',
    },
    cars,
  };
}


// ---------------------------------------------------------------- Link berbagi (desain di URL)

export function encodeDesign(d: Design): string {
  const bytes = new TextEncoder().encode(JSON.stringify(d));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDesign(s: string): Design | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitizeDesign(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
