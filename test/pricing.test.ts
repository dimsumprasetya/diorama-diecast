import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOX_SIZES, ITEMS, OPTIONS, SHIPPING_ZONES } from '../shared/catalog.ts';
import { designFromTheme, sanitizeDesign } from '../shared/design.ts';
import { quoteDesign } from '../shared/pricing.ts';
import { THEMES } from '../shared/themes.ts';

test('semua tema valid & lolos validasi', () => {
  for (const t of THEMES) {
    const d = sanitizeDesign(JSON.parse(JSON.stringify(designFromTheme(t.id))));
    assert.equal(d.items.length, t.design.items.length, t.id);
  }
});

test('harga = box + aset + opsi + ongkir', () => {
  const d = designFromTheme('blank');
  d.items = [];
  d.options = { led: true, baseText: 'Halo' };
  const box = BOX_SIZES.find((b) => b.id === d.size)!;
  const cone = ITEMS.find((i) => i.id === 'cone')!;
  d.items.push({ uid: 'a', id: 'cone', mount: 'floor', x: 0, z: 0, rot: 0, scale: 1 });
  d.items.push({ uid: 'b', id: 'cone', mount: 'floor', x: 1, z: 0, rot: 0, scale: 1 });
  const zone = SHIPPING_ZONES.find((z) => z.id === 'jawa')!;
  const q = quoteDesign(d, 'jawa');
  assert.equal(q.production, box.price + cone.price * 2 + OPTIONS.led.price + OPTIONS.baseText.price);
  assert.equal(q.total, q.production + zone.price);
});

test('validasi menolak aset tak dikenal & ukuran box nonaktif', () => {
  const d = designFromTheme('blank') as any;
  assert.throws(() => sanitizeDesign({ ...d, items: [{ id: 'emas-batangan', mount: 'floor' }] }), /tidak dikenal/);
  const disabled = BOX_SIZES.find((b) => !b.enabled);
  if (disabled) assert.throws(() => sanitizeDesign({ ...d, size: disabled.id }), /Ukuran box/);
});

test('validasi membersihkan input', () => {
  const d = designFromTheme('blank') as any;
  d.items = [{ id: 'neon-sign', mount: 'wall', wall: 'back', u: 0, v: 1, scale: 99, text: '<script>ABCDEFGHIJKLMNOP', color: '#000000' }];
  d.options = { led: 'ya', baseText: 'x'.repeat(200) };
  const s = sanitizeDesign(d);
  const it = s.items[0];
  assert.equal(it.scale, 2.5);
  assert.ok(!it.text!.includes('<'));
  assert.equal(Array.from(it.text!).length, 12);
  assert.equal(it.color, ITEMS.find((i) => i.id === 'neon-sign')!.colors![0]);
  assert.equal(s.options.led, true);
  assert.equal(s.options.baseText.length, OPTIONS.baseText.max);
});
