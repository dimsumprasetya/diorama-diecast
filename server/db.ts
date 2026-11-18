import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Design } from '../shared/design.ts';
import type { Quote } from '../shared/pricing.ts';

// node:sqlite masih ditandai "experimental" oleh Node — sembunyikan peringatan itu saja.
const originalEmit = process.emitWarning;
process.emitWarning = ((warning: string | Error, ...args: any[]) => {
  const msg = typeof warning === 'string' ? warning : warning?.message;
  if (msg?.includes('SQLite')) return;
  return (originalEmit as any).call(process, warning, ...args);
}) as typeof process.emitWarning;
const { DatabaseSync } = await import('node:sqlite');

export type OrderStatus = 'awaiting_payment' | 'paid' | 'in_production' | 'shipped' | 'completed' | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = ['awaiting_payment', 'paid', 'in_production', 'shipped', 'completed', 'cancelled'];

export type Customer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  note: string;
};

export type Order = {
  id: string;
  accessKey: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  customer: Customer;
  design: Design;
  quote: Quote;
  total: number;
  shippingZone: string;
  paymentMethod: 'midtrans' | 'manual' | 'tokopedia';
  paymentAttempt: number;
  paymentUrl: string | null;
  paymentInfo: Record<string, unknown> | null;
  paidAt: string | null;
  trackingNumber: string;
  adminNote: string;
  history: { at: string; status: OrderStatus; note?: string }[];
};

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
mkdirSync(SNAPSHOT_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'orders.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    access_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL,
    customer TEXT NOT NULL,
    design TEXT NOT NULL,
    quote TEXT NOT NULL,
    total INTEGER NOT NULL,
    shipping_zone TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_attempt INTEGER NOT NULL DEFAULT 0,
    payment_url TEXT,
    payment_info TEXT,
    paid_at TEXT,
    tracking_number TEXT NOT NULL DEFAULT '',
    admin_note TEXT NOT NULL DEFAULT '',
    history TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
`);

function rowToOrder(r: any): Order {
  return {
    id: r.id,
    accessKey: r.access_key,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    status: r.status,
    customer: JSON.parse(r.customer),
    design: JSON.parse(r.design),
    quote: JSON.parse(r.quote),
    total: r.total,
    shippingZone: r.shipping_zone,
    paymentMethod: r.payment_method,
    paymentAttempt: r.payment_attempt,
    paymentUrl: r.payment_url,
    paymentInfo: r.payment_info ? JSON.parse(r.payment_info) : null,
    paidAt: r.paid_at,
    trackingNumber: r.tracking_number,
    adminNote: r.admin_note,
    history: JSON.parse(r.history),
  };
}

export function insertOrder(o: Order): void {
  db.prepare(`INSERT INTO orders (id, access_key, created_at, updated_at, status, customer, design, quote, total,
      shipping_zone, payment_method, payment_attempt, payment_url, payment_info, paid_at, tracking_number, admin_note, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    o.id, o.accessKey, o.createdAt, o.updatedAt, o.status, JSON.stringify(o.customer), JSON.stringify(o.design),
    JSON.stringify(o.quote), o.total, o.shippingZone, o.paymentMethod, o.paymentAttempt, o.paymentUrl,
    o.paymentInfo ? JSON.stringify(o.paymentInfo) : null, o.paidAt, o.trackingNumber, o.adminNote, JSON.stringify(o.history),
  );
}

export function getOrder(id: string): Order | null {
  const r = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return r ? rowToOrder(r) : null;
}

export function listOrders(status?: string): Order[] {
  const rows = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 500').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500').all();
  return rows.map(rowToOrder);
}

export function updateOrder(id: string, patch: Partial<Pick<Order,
  'status' | 'paymentAttempt' | 'paymentUrl' | 'paymentInfo' | 'paidAt' | 'trackingNumber' | 'adminNote' | 'history'>>): Order | null {
  const current = getOrder(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  db.prepare(`UPDATE orders SET status = ?, payment_attempt = ?, payment_url = ?, payment_info = ?, paid_at = ?,
      tracking_number = ?, admin_note = ?, history = ?, updated_at = ? WHERE id = ?`).run(
    next.status, next.paymentAttempt, next.paymentUrl, next.paymentInfo ? JSON.stringify(next.paymentInfo) : null,
    next.paidAt, next.trackingNumber, next.adminNote, JSON.stringify(next.history), next.updatedAt, id,
  );
  return next;
}

/** Ubah status + catat di riwayat. */
export function setStatus(id: string, status: OrderStatus, note?: string, extra: Parameters<typeof updateOrder>[1] = {}): Order | null {
  const current = getOrder(id);
  if (!current) return null;
  const history = current.status === status && !note ? current.history : [...current.history, { at: new Date().toISOString(), status, ...(note ? { note } : {}) }];
  return updateOrder(id, { ...extra, status, history });
}
