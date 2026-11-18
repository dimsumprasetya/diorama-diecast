import './env.ts';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIPPING_ZONES, byId } from '../shared/catalog.ts';
import { sanitizeDesign } from '../shared/design.ts';
import { quoteDesign } from '../shared/pricing.ts';
import {
  ORDER_STATUSES, SNAPSHOT_DIR, getOrder, insertOrder, listOrders, setStatus, updateOrder,
  type Customer, type Order, type OrderStatus,
} from './db.ts';
import {
  createSnapTransaction, mapTransactionStatus, midtransEnabled, midtransPublicConfig, parseMidtransOrderId, verifyNotification,
} from './midtrans.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newOrderId(): string {
  for (;;) {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rnd = Array.from(randomBytes(4), (b) => ID_CHARS[b % ID_CHARS.length]).join('');
    const id = `HSS-${ymd}-${rnd}`;
    if (!getOrder(id)) return id;
  }
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, max) : '';
}

export function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (p.startsWith('8')) p = '62' + p;
  return p;
}

function sanitizeCustomer(input: any, zone: string): Customer {
  const c: Customer = {
    name: clean(input?.name, 60),
    phone: normalizePhone(clean(input?.phone, 20)),
    email: clean(input?.email, 100),
    address: clean(input?.address, 300),
    city: clean(input?.city, 60),
    postalCode: clean(input?.postalCode, 10),
    note: clean(input?.note, 800),
  };
  if (c.name.length < 2) throw new HttpError(400, 'Nama wajib diisi');
  if (!/^62\d{8,13}$/.test(c.phone)) throw new HttpError(400, 'Nomor WhatsApp tidak valid');
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new HttpError(400, 'Email tidak valid');
  if (zone !== 'pickup' && (c.address.length < 8 || c.city.length < 2)) throw new HttpError(400, 'Alamat & kota pengiriman wajib diisi');
  return c;
}

function decodeImage(dataUrl: unknown, maxBytes: number): Buffer | null {
  if (typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length > maxBytes ? null : buf;
}

function saveSnapshot(orderId: string, view: 'hero' | 'top', dataUrl: unknown) {
  const buf = decodeImage(dataUrl, 3_000_000);
  if (buf) writeFileSync(path.join(SNAPSHOT_DIR, `${orderId}-${view}.jpg`), buf);
}


const keyEquals = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Rate limit sederhana per IP. */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? 'x';
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) return next(new HttpError(429, 'Terlalu banyak permintaan, coba lagi nanti'));
    list.push(now);
    hits.set(key, list);
    next();
  };
}

// ---------------------------------------------------------------- admin auth

const adminSecret = () => createHash('sha256').update('hss-admin:' + (process.env.ADMIN_PASSWORD ?? '')).digest();

function signAdminToken(): string {
  const exp = String(Date.now() + 1000 * 60 * 60 * 12);
  const sig = createHmac('sha256', adminSecret()).update(exp).digest('base64url');
  return `${exp}.${sig}`;
}

function verifyAdminToken(token: unknown): boolean {
  if (typeof token !== 'string' || !process.env.ADMIN_PASSWORD) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return keyEquals(createHmac('sha256', adminSecret()).update(exp).digest('base64url'), sig);
}

function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.query.t;
  if (!verifyAdminToken(token)) return next(new HttpError(401, 'Silakan login admin'));
  next();
}

// ---------------------------------------------------------------- views

function publicOrder(o: Order) {
  return {
    id: o.id,
    status: o.status,
    createdAt: o.createdAt,
    customer: o.customer,
    design: o.design,
    quote: o.quote,
    total: o.total,
    shippingZone: o.shippingZone,
    paymentMethod: o.paymentMethod,
    paymentUrl: o.status === 'awaiting_payment' ? o.paymentUrl : null,
    paidAt: o.paidAt,
    trackingNumber: o.trackingNumber,
    history: o.history,
  };
}

function adminOrder(o: Order) {
  return { ...publicOrder(o), paymentUrl: o.paymentUrl, paymentInfo: o.paymentInfo, adminNote: o.adminNote, updatedAt: o.updatedAt, paymentAttempt: o.paymentAttempt };
}

const publicBaseUrl = (req: Request) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const orderUrl = (req: Request, o: Order) => `${publicBaseUrl(req)}/pesanan/${o.id}?k=${o.accessKey}`;

async function ensurePaymentLink(req: Request, order: Order): Promise<Order> {
  if (order.paymentMethod !== 'midtrans' || order.status !== 'awaiting_payment' || !midtransEnabled()) return order;
  const createdAt = Number((order.paymentInfo as any)?.snapCreatedAt ?? 0);
  if (order.paymentUrl && Date.now() - createdAt < 1000 * 60 * 60 * 23) return order;
  const attempt = order.paymentAttempt + 1;
  const snap = await createSnapTransaction(order, attempt, orderUrl(req, order));
  return updateOrder(order.id, {
    paymentAttempt: attempt,
    paymentUrl: snap.redirectUrl,
    paymentInfo: { ...(order.paymentInfo ?? {}), snapCreatedAt: Date.now(), snapToken: snap.token },
  })!;
}

function findOrderForCustomer(req: Request): Order {
  const order = getOrder(String(req.params.id));
  if (!order || !keyEquals(order.accessKey, String(req.query.k ?? ''))) throw new HttpError(404, 'Pesanan tidak ditemukan');
  return order;
}

// ---------------------------------------------------------------- app

export function createApp() {
  const app = express();
  // Di belakang 1 reverse proxy (Nginx/Railway/Render). Ubah lewat TRUST_PROXY jika perlu.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

  const api = express.Router();

  api.get('/config', (_req, res) => {
    res.json({ paymentMode: midtransEnabled() ? 'midtrans' : 'manual', midtrans: midtransEnabled() ? midtransPublicConfig() : null });
  });

  api.post('/orders', rateLimit(15, 60 * 60 * 1000), async (req, res, next) => {
    try {
      const { design: rawDesign, customer: rawCustomer, shippingZone, snapshots, approved, paymentMethod } = req.body ?? {};
      if (approved !== true) throw new HttpError(400, 'Desain harus disetujui terlebih dahulu');
      const zone = byId(SHIPPING_ZONES, shippingZone);
      if (!zone) throw new HttpError(400, 'Pilih tujuan pengiriman');
      let design;
      try { design = sanitizeDesign(rawDesign); } catch (e) { throw new HttpError(400, (e as Error).message); }
      const customer = sanitizeCustomer(rawCustomer, zone.id);
      const quote = quoteDesign(design, zone.id);
      const now = new Date().toISOString();
      const order: Order = {
        id: newOrderId(),
        accessKey: randomBytes(16).toString('hex'),
        createdAt: now,
        updatedAt: now,
        status: 'awaiting_payment',
        customer,
        design,
        quote,
        total: quote.total,
        shippingZone: zone.id,
        paymentMethod: paymentMethod === 'tokopedia' ? 'tokopedia' : midtransEnabled() ? 'midtrans' : 'manual',
        paymentAttempt: 0,
        paymentUrl: null,
        paymentInfo: null,
        paidAt: null,
        trackingNumber: '',
        adminNote: '',
        history: [{ at: now, status: 'awaiting_payment', note: 'Desain disetujui customer' }],
      };
      insertOrder(order);
      saveSnapshot(order.id, 'hero', snapshots?.hero);
      saveSnapshot(order.id, 'top', snapshots?.top);

      let saved = order;
      let paymentError: string | null = null;
      try { saved = await ensurePaymentLink(req, order); } catch (e) { paymentError = (e as Error).message; console.error(e); }
      res.status(201).json({ order: publicOrder(saved), accessKey: saved.accessKey, paymentError });
    } catch (e) { next(e); }
  });

  api.get('/orders/:id', (req, res, next) => {
    try { res.json({ order: publicOrder(findOrderForCustomer(req)) }); } catch (e) { next(e); }
  });

  api.post('/orders/:id/pay', rateLimit(30, 60 * 60 * 1000), async (req, res, next) => {
    try {
      const order = await ensurePaymentLink(req, findOrderForCustomer(req));
      res.json({ order: publicOrder(order) });
    } catch (e) { next(e); }
  });

  api.get('/orders/:id/snapshot/:view', (req, res, next) => {
    try {
      const view = req.params.view === 'top' ? 'top' : 'hero';
      const order = getOrder(String(req.params.id));
      const allowed = order && (verifyAdminToken(req.query.t) || keyEquals(order.accessKey, String(req.query.k ?? '')));
      if (!allowed) throw new HttpError(404, 'Tidak ditemukan');
      const file = path.join(SNAPSHOT_DIR, `${order!.id}-${view}.jpg`);
      if (!existsSync(file)) throw new HttpError(404, 'Tidak ada gambar');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(file);
    } catch (e) { next(e); }
  });

  // Webhook Midtrans — set di Dashboard Midtrans → Settings → Payment → Notification URL:
  //   https://domain-anda/api/payments/midtrans/notification
  api.post('/payments/midtrans/notification', (req, res) => {
    const n = req.body ?? {};
    if (!verifyNotification(n)) return res.status(403).json({ error: 'invalid signature' });
    const order = getOrder(parseMidtransOrderId(String(n.order_id)));
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (Math.round(Number(n.gross_amount)) !== order.total) {
      console.warn(`[midtrans] nominal tidak cocok untuk ${order.id}: ${n.gross_amount} vs ${order.total}`);
      return res.status(400).json({ error: 'amount mismatch' });
    }
    const mapped = mapTransactionStatus(n);
    const info = {
      ...(order.paymentInfo ?? {}),
      transactionStatus: n.transaction_status,
      paymentType: n.payment_type,
      transactionId: n.transaction_id,
      midtransOrderId: n.order_id,
      notifiedAt: new Date().toISOString(),
    };
    if (mapped === 'paid' && order.status === 'awaiting_payment') {
      setStatus(order.id, 'paid', `Pembayaran diterima (${n.payment_type ?? 'midtrans'})`, { paymentInfo: info, paidAt: new Date().toISOString(), paymentUrl: null });
    } else if (mapped === 'failed' && order.status === 'awaiting_payment') {
      // Biarkan customer mencoba bayar lagi dengan link baru
      updateOrder(order.id, { paymentInfo: info, paymentUrl: null });
    } else {
      updateOrder(order.id, { paymentInfo: info });
    }
    res.json({ ok: true });
  });

  // ---- admin
  api.post('/admin/login', rateLimit(10, 15 * 60 * 1000), (req, res, next) => {
    const pw = String(req.body?.password ?? '');
    const expected = process.env.ADMIN_PASSWORD ?? '';
    if (!expected) return next(new HttpError(503, 'ADMIN_PASSWORD belum diatur di server (.env)'));
    if (!keyEquals(createHash('sha256').update(pw).digest('hex'), createHash('sha256').update(expected).digest('hex'))) {
      return next(new HttpError(401, 'Password salah'));
    }
    res.json({ token: signAdminToken() });
  });

  api.get('/admin/orders', requireAdmin, (req, res) => {
    const status = typeof req.query.status === 'string' && ORDER_STATUSES.includes(req.query.status as OrderStatus) ? req.query.status : undefined;
    res.json({
      orders: listOrders(status).map((o) => ({
        id: o.id, status: o.status, createdAt: o.createdAt, total: o.total, customer: { name: o.customer.name, phone: o.customer.phone, city: o.customer.city },
        size: o.design.size, itemCount: o.design.items.length, paymentMethod: o.paymentMethod,
      })),
    });
  });

  api.get('/admin/orders/:id', requireAdmin, (req, res, next) => {
    const order = getOrder(String(req.params.id));
    if (!order) return next(new HttpError(404, 'Pesanan tidak ditemukan'));
    res.json({ order: adminOrder(order), customerUrl: orderUrl(req, order) });
  });

  api.patch('/admin/orders/:id', requireAdmin, (req, res, next) => {
    const order = getOrder(String(req.params.id));
    if (!order) return next(new HttpError(404, 'Pesanan tidak ditemukan'));
    const { status, trackingNumber, adminNote, note } = req.body ?? {};
    let next_ = order;
    if (typeof trackingNumber === 'string' || typeof adminNote === 'string') {
      next_ = updateOrder(order.id, {
        ...(typeof trackingNumber === 'string' ? { trackingNumber: clean(trackingNumber, 60) } : {}),
        ...(typeof adminNote === 'string' ? { adminNote: clean(adminNote, 2000) } : {}),
      })!;
    }
    if (status !== undefined) {
      if (!ORDER_STATUSES.includes(status)) return next(new HttpError(400, 'Status tidak valid'));
      if (status !== order.status) {
        next_ = setStatus(order.id, status, clean(note, 200) || 'Diubah oleh admin', status === 'paid' && !order.paidAt ? { paidAt: new Date().toISOString() } : {})!;
      }
    }
    res.json({ order: adminOrder(next_) });
  });

  app.use('/api', api);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ada')));

  // Frontend hasil build
  if (existsSync(path.join(DIST, 'index.html'))) {
    app.use(express.static(DIST, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : err?.type === 'entity.too.large' ? 413 : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 && !(err instanceof HttpError) ? 'Terjadi kesalahan server' : err.message });
  });

  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, () => {
    console.log(`H-Scale Studio server jalan di http://localhost:${port}`);
    console.log(`Mode pembayaran: ${midtransEnabled() ? `Midtrans (${process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'PRODUCTION' : 'sandbox'})` : 'transfer manual'}`);
    if (!process.env.ADMIN_PASSWORD) console.warn('⚠ ADMIN_PASSWORD belum diatur — halaman /admin tidak bisa dipakai.');
  });
}
