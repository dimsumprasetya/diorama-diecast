import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'hss-test-'));
process.env.ADMIN_PASSWORD = 'tes-admin';
delete process.env.MIDTRANS_SERVER_KEY;

const { createApp } = await import('../server/index.ts');
const { designFromTheme } = await import('../shared/design.ts');
const { quoteDesign } = await import('../shared/pricing.ts');

let server: Server;
let base = '';
before(() => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

const customer = { name: 'Budi', phone: '0812-3456-7890', address: 'Jl. Mawar No. 12 Kebayoran', city: 'Jakarta', postalCode: '12160' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('pesanan ditolak tanpa persetujuan desain', async () => {
  const r = await post('/orders', { design: designFromTheme('midnight-alley'), customer, shippingZone: 'jawa' });
  assert.equal(r.status, 400);
});

test('nomor WA tidak valid ditolak', async () => {
  const r = await post('/orders', { design: designFromTheme('blank'), customer: { ...customer, phone: '123' }, shippingZone: 'jawa', approved: true });
  assert.equal(r.status, 400);
});

let orderId = '';
let accessKey = '';

test('buat pesanan: harga dihitung ulang di server', async () => {
  const design = designFromTheme('midnight-alley');
  const r = await post('/orders', { design, customer, shippingZone: 'jawa', approved: true, total: 1 });
  assert.equal(r.status, 201);
  const j = (await r.json()) as any;
  assert.equal(j.order.total, quoteDesign(design, 'jawa').total);
  assert.equal(j.order.paymentMethod, 'manual');
  assert.equal(j.order.customer.phone, '6281234567890');
  orderId = j.order.id;
  accessKey = j.accessKey;
  assert.match(orderId, /^HSS-\d{6}-[A-Z0-9]{4}$/);
});

test('halaman pesanan butuh access key yang benar', async () => {
  assert.equal((await fetch(`${base}/orders/${orderId}?k=salah`)).status, 404);
  const r = await fetch(`${base}/orders/${orderId}?k=${accessKey}`);
  assert.equal(r.status, 200);
  const j = (await r.json()) as any;
  assert.equal(j.order.status, 'awaiting_payment');
  assert.equal(j.order.adminNote, undefined);
});

test('panel "Gambar Sendiri" wajib ada gambarnya, lalu bisa diunduh', async () => {
  const design = designFromTheme('own-design');
  const bad = await post('/orders', { design, customer, shippingZone: 'pickup', approved: true });
  assert.equal(bad.status, 400);
  const ok = await post('/orders', { design, customer, shippingZone: 'pickup', approved: true, paymentMethod: 'tokopedia', uploads: { back: PNG, left: PNG, right: PNG } });
  assert.equal(ok.status, 201);
  const j = (await ok.json()) as any;
  assert.equal(j.order.paymentMethod, 'tokopedia');
  assert.deepEqual(j.order.uploadPanels.sort(), ['back', 'left', 'right']);
  const img = await fetch(`${base}/orders/${j.order.id}/upload/back?k=${j.accessKey}`);
  assert.equal(img.status, 200);
  assert.equal((await fetch(`${base}/orders/${j.order.id}/upload/back?k=x`)).status, 404);
});

test('admin: login, daftar pesanan, ubah status & resi', async () => {
  assert.equal((await post('/admin/login', { password: 'salah' })).status, 401);
  const { token } = (await (await post('/admin/login', { password: 'tes-admin' })).json()) as any;
  assert.ok(token);
  assert.equal((await fetch(`${base}/admin/orders`)).status, 401);
  const list = (await (await fetch(`${base}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
  assert.ok(list.orders.some((o: any) => o.id === orderId));
  const r = await fetch(`${base}/admin/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'in_production', trackingNumber: 'JNE123' }),
  });
  const j = (await r.json()) as any;
  assert.equal(j.order.status, 'in_production');
  assert.equal(j.order.trackingNumber, 'JNE123');
  assert.equal(j.order.history.at(-1).status, 'in_production');
});

test('webhook Midtrans: tanda tangan salah ditolak, yang benar menandai lunas', async () => {
  const r0 = await post('/orders', { design: designFromTheme('blank'), customer, shippingZone: 'jawa', approved: true });
  const { order } = (await r0.json()) as any;
  process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-TEST';
  try {
    const n = { order_id: `${order.id}-P1`, status_code: '200', gross_amount: `${order.total}.00`, transaction_status: 'settlement', payment_type: 'qris' };
    const bad = await post('/payments/midtrans/notification', { ...n, signature_key: 'abc' });
    assert.equal(bad.status, 403);
    const sig = createHash('sha512').update(`${n.order_id}${n.status_code}${n.gross_amount}SB-Mid-server-TEST`).digest('hex');
    const ok = await post('/payments/midtrans/notification', { ...n, signature_key: sig });
    assert.equal(ok.status, 200);
    const { token } = (await (await post('/admin/login', { password: 'tes-admin' })).json()) as any;
    const j = (await (await fetch(`${base}/admin/orders/${order.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
    assert.equal(j.order.status, 'paid');
    assert.ok(j.order.paidAt);
  } finally {
    delete process.env.MIDTRANS_SERVER_KEY;
  }
});
