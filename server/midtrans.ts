import { createHash, timingSafeEqual } from 'node:crypto';
import type { Order, OrderStatus } from './db.ts';
import { BOX_SIZES, byId } from '../shared/catalog.ts';

const serverKey = () => process.env.MIDTRANS_SERVER_KEY?.trim() ?? '';
const isProduction = () => process.env.MIDTRANS_IS_PRODUCTION === 'true';

export const midtransEnabled = () => serverKey().length > 0;

export function midtransPublicConfig() {
  return {
    clientKey: process.env.MIDTRANS_CLIENT_KEY?.trim() ?? '',
    isProduction: isProduction(),
  };
}

const snapBase = () => (isProduction() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com');

/** Order ID di Midtrans harus unik per percobaan bayar: HSS-xxxx-P1, HSS-xxxx-P2, ... */
export const midtransOrderId = (orderId: string, attempt: number) => `${orderId}-P${attempt}`;
export const parseMidtransOrderId = (mid: string) => mid.replace(/-P\d+$/, '');

export async function createSnapTransaction(order: Order, attempt: number, finishUrl: string): Promise<{ token: string; redirectUrl: string }> {
  const size = byId(BOX_SIZES, order.design.size);
  const itemName = `Custom Diorama Box 1:64 ${size?.label ?? ''} (${order.id})`.trim().slice(0, 50);
  const items = [{ id: 'diorama', price: order.quote.production, quantity: 1, name: itemName }];
  if (order.quote.shipping > 0) items.push({ id: 'ongkir', price: order.quote.shipping, quantity: 1, name: `Ongkir ${order.quote.shippingLabel}`.slice(0, 50) });

  const body = {
    transaction_details: { order_id: midtransOrderId(order.id, attempt), gross_amount: order.total },
    item_details: items,
    customer_details: {
      first_name: order.customer.name.slice(0, 50),
      phone: order.customer.phone,
      ...(order.customer.email ? { email: order.customer.email } : {}),
      shipping_address: {
        first_name: order.customer.name.slice(0, 50),
        phone: order.customer.phone,
        address: order.customer.address.slice(0, 200),
        city: order.customer.city.slice(0, 50),
        postal_code: order.customer.postalCode.slice(0, 10),
        country_code: 'IDN',
      },
    },
    callbacks: { finish: finishUrl },
    expiry: { unit: 'hours', duration: 24 },
  };

  const res = await fetch(`${snapBase()}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(serverKey() + ':').toString('base64'),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !json.token) {
    const msg = Array.isArray(json.error_messages) ? json.error_messages.join(', ') : res.statusText;
    throw new Error(`Midtrans: ${msg}`);
  }
  return { token: json.token, redirectUrl: json.redirect_url };
}

/** Verifikasi signature notifikasi: SHA512(order_id + status_code + gross_amount + server_key). */
export function verifyNotification(n: Record<string, any>): boolean {
  if (!midtransEnabled()) return false;
  const { order_id, status_code, gross_amount, signature_key } = n;
  if (typeof signature_key !== 'string' || !order_id || !status_code || !gross_amount) return false;
  const expected = createHash('sha512').update(`${order_id}${status_code}${gross_amount}${serverKey()}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature_key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Terjemahkan status transaksi Midtrans ke status pesanan. null = tidak mengubah status. */
export function mapTransactionStatus(n: Record<string, any>): OrderStatus | 'failed' | null {
  const s = n.transaction_status;
  if (s === 'settlement') return 'paid';
  if (s === 'capture') return n.fraud_status === 'accept' || !n.fraud_status ? 'paid' : null;
  if (s === 'deny' || s === 'cancel' || s === 'expire' || s === 'failure') return 'failed';
  return null; // pending, authorize, dll
}
