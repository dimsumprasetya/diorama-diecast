import { BOX_SIZES, FLOOR_BACKGROUNDS, ITEMS, OPTIONS, PANELS, SHIPPING_ZONES, WALL_BACKGROUNDS, byId } from './catalog.ts';
import type { Design } from './design.ts';

export type QuoteLine = {
  key: string;
  label: string;
  detail?: string;
  qty: number;
  unitPrice: number;
  total: number;
};

export type Quote = {
  lines: QuoteLine[];
  /** harga produksi (tanpa ongkir) */
  production: number;
  shipping: number;
  shippingLabel: string;
  total: number;
};

/** Hitung harga. Dipakai di browser (tampilan) DAN di server (harga resmi pesanan). */
export function quoteDesign(design: Design, shippingZone?: string): Quote {
  const lines: QuoteLine[] = [];
  const add = (key: string, label: string, unitPrice: number, qty = 1, detail?: string) => {
    if (qty > 0) lines.push({ key, label, detail, qty, unitPrice, total: unitPrice * qty });
  };

  const size = byId(BOX_SIZES, design.size) ?? BOX_SIZES[0];
  add('box', `Diorama Box ${size.label}`, size.price, 1, `${size.w}×${size.d}×${size.h} cm · akrilik + base hitam + print dinding & lantai`);

  for (const p of PANELS) {
    const list = p.id === 'floor' ? FLOOR_BACKGROUNDS : WALL_BACKGROUNDS;
    const bg = byId(list, design.panels[p.id]?.bg);
    if (bg && bg.price) add(`panel:${p.id}`, `${p.label}: ${bg.label}`, bg.price);
  }

  const counts = new Map<string, number>();
  for (const it of design.items) counts.set(it.id, (counts.get(it.id) ?? 0) + 1);
  for (const def of ITEMS) {
    const qty = counts.get(def.id) ?? 0;
    if (qty) add(`item:${def.id}`, def.name, def.price, qty, def.kind === 'prop' ? 'miniatur 3D' : 'print');
  }

  if (design.options.led && OPTIONS.led.enabled) add('led', OPTIONS.led.label, OPTIONS.led.price);
  if (design.options.baseText.trim() && OPTIONS.baseText.enabled) add('basetext', OPTIONS.baseText.label, OPTIONS.baseText.price, 1, `"${design.options.baseText.trim()}"`);

  const production = lines.reduce((s, l) => s + l.total, 0);
  const zone = shippingZone ? byId(SHIPPING_ZONES, shippingZone) : undefined;
  const shipping = zone?.price ?? 0;
  return { lines, production, shipping, shippingLabel: zone?.label ?? '', total: production + shipping };
}

export function formatRupiah(n: number): string {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}
