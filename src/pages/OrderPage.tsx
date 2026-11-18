import { useCallback, useEffect, useState } from 'react';
import { SHOP } from '../../shared/catalog.ts';
import type { Design } from '../../shared/design.ts';
import { formatRupiah, type Quote } from '../../shared/pricing.ts';
import { api, STATUS_LABEL, waLink } from '../lib/api.ts';
import { Stage } from '../scene/Stage.tsx';
import type { CameraView, ViewState } from '../store.ts';
import { Icon } from '../ui/Icon.tsx';

export type PublicOrder = {
  id: string;
  status: string;
  createdAt: string;
  customer: { name: string; phone: string; email: string; address: string; city: string; postalCode: string; note: string };
  design: Design;
  quote: Quote;
  total: number;
  shippingZone: string;
  paymentMethod: 'midtrans' | 'manual' | 'tokopedia';
  paymentUrl: string | null;
  paidAt: string | null;
  trackingNumber: string;
  history: { at: string; status: string; note?: string }[];
};

const FLOW = ['awaiting_payment', 'paid', 'in_production', 'shipped', 'completed'];

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Viewer 3D read-only (dipakai halaman pesanan & admin). */
export function OrderViewer({ design }: { design: Design }) {
  const [view, setView] = useState<ViewState>({ showCars: true, showCase: true, night: false, autoRotate: true });
  const [cmd, setCmd] = useState<{ view: CameraView; n: number }>({ view: 'reset', n: 0 });
  const cam = (v: CameraView) => setCmd((c) => ({ view: v, n: c.n + 1 }));
  return (
    <div className="viewer">
      <Stage design={design} view={view} cameraCmd={cmd} />
      <div className="viewbar">
        <button className={`vb ${view.showCars ? 'on' : ''}`} onClick={() => setView({ ...view, showCars: !view.showCars })}>
          <Icon name="car" /> <span>Mobil {view.showCars ? 'ON' : 'OFF'}</span>
        </button>
        <button className={`vb ${view.night ? 'on' : ''}`} onClick={() => setView({ ...view, night: !view.night })}>
          <Icon name={view.night ? 'moon' : 'sun'} /> <span>{view.night ? 'Malam' : 'Siang'}</span>
        </button>
        <button className={`vb ${view.showCase ? 'on' : ''}`} onClick={() => setView({ ...view, showCase: !view.showCase })}>
          <Icon name="box" /> <span>Akrilik</span>
        </button>
        <button className="vb" onClick={() => cam('front')}>
          <Icon name="front" /> <span>Depan</span>
        </button>
        <button className="vb" onClick={() => cam('top')}>
          <Icon name="top" /> <span>Atas</span>
        </button>
        <button className={`vb ${view.autoRotate ? 'on' : ''}`} onClick={() => setView({ ...view, autoRotate: !view.autoRotate })}>
          <Icon name="orbit" /> <span>Putar</span>
        </button>
      </div>
    </div>
  );
}

export function StatusTimeline({ status, history }: { status: string; history: PublicOrder['history'] }) {
  if (status === 'cancelled') return <div className="alert error">Pesanan ini dibatalkan.</div>;
  const idx = FLOW.indexOf(status);
  return (
    <ol className="timeline">
      {FLOW.map((s, i) => {
        const h = [...history].reverse().find((x) => x.status === s);
        return (
          <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
            <span className="tl-dot">{i < idx ? <Icon name="check" size={12} /> : i + 1}</span>
            <span>
              <b>{STATUS_LABEL[s]}</b>
              {h && <small>{formatDate(h.at)}</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CopyBtn({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn sm"
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      <Icon name={ok ? 'check' : 'copy'} size={15} /> {ok ? 'Tersalin' : label}
    </button>
  );
}

function PaymentBox({ order, accessKey, onUpdate }: { order: PublicOrder; accessKey: string; onUpdate: (o: PublicOrder) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pageUrl = location.href;
  if (order.status !== 'awaiting_payment') return null;

  if (order.paymentMethod === 'tokopedia') {
    return (
      <section className="card pay">
        <h3>Lanjutkan di Tokopedia</h3>
        <ol className="steps-list">
          <li>
            Salin kode desain: <code className="code">{order.id}</code> <CopyBtn text={order.id} />
          </li>
          <li>Buka produk custom kami di Tokopedia, lalu checkout.</li>
          <li>
            Tulis kode <b>{order.id}</b> di kolom <b>catatan</b> pesanan Tokopedia.
          </li>
        </ol>
        <p className="muted small">
          Total desain ini {formatRupiah(order.quote.production)}. Jika ada selisih dengan harga produk di Tokopedia (karena add-on), admin akan menghubungi lewat chat Tokopedia.
        </p>
        <div className="row">
          <a className="btn primary" href={SHOP.tokopediaCustomProductUrl} target="_blank" rel="noreferrer">
            <Icon name="store" /> Buka Tokopedia
          </a>
          <a className="btn" href={waLink(SHOP.whatsapp, `Halo ${SHOP.name}, saya pesan via Tokopedia dengan kode desain ${order.id}.\n${pageUrl}`)} target="_blank" rel="noreferrer">
            <Icon name="chat" /> WhatsApp
          </a>
        </div>
      </section>
    );
  }

  if (order.paymentMethod === 'manual') {
    return (
      <section className="card pay">
        <h3>Transfer {formatRupiah(order.total)}</h3>
        {SHOP.bankAccounts.map((b) => (
          <div key={b.number} className="bank">
            <span>
              <b>{b.bank}</b> {b.number}
              <small>a.n. {b.holder}</small>
            </span>
            <CopyBtn text={b.number} />
          </div>
        ))}
        <p className="muted small">Setelah transfer, kirim bukti transfer lewat WhatsApp. Pesanan diproses setelah pembayaran kami konfirmasi.</p>
        <a
          className="btn primary"
          href={waLink(SHOP.whatsapp, `Halo ${SHOP.name}, saya sudah transfer ${formatRupiah(order.total)} untuk pesanan ${order.id} a.n. ${order.customer.name}.\n${pageUrl}`)}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="chat" /> Konfirmasi via WhatsApp
        </a>
      </section>
    );
  }

  const pay = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await api<{ order: PublicOrder }>(`/orders/${order.id}/pay?k=${accessKey}`, { method: 'POST' });
      onUpdate(res.order);
      if (res.order.paymentUrl) location.href = res.order.paymentUrl;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card pay">
      <h3>Selesaikan pembayaran</h3>
      <p className="muted small">QRIS, e-wallet, Virtual Account, atau kartu kredit. Halaman ini otomatis ter-update setelah pembayaran berhasil.</p>
      {err && <div className="alert error">{err}</div>}
      <button className="btn primary big" onClick={pay} disabled={busy}>
        {busy ? 'Membuka…' : `Bayar ${formatRupiah(order.total)}`}
      </button>
    </section>
  );
}

export default function OrderPage({ id, accessKey }: { id: string; accessKey: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ order: PublicOrder }>(`/orders/${id}?k=${encodeURIComponent(accessKey)}`)
      .then((r) => setOrder(r.order))
      .catch((e) => setError(e.message));
  }, [id, accessKey]);

  useEffect(load, [load]);
  useEffect(() => {
    if (order?.status !== 'awaiting_payment' || order.paymentMethod !== 'midtrans') return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [order?.status, order?.paymentMethod, load]);

  if (error)
    return (
      <div className="page center">
        <div className="card narrow">
          <h2>Pesanan tidak ditemukan</h2>
          <p className="muted">Pastikan link yang dibuka lengkap (termasuk bagian ?k=...).</p>
          <a className="btn primary" href="/">
            Kembali ke Builder
          </a>
        </div>
      </div>
    );
  if (!order) return <div className="boot"><div className="boot-logo">H</div></div>;

  return (
    <div className="page">
      <header className="topbar simple">
        <a className="brand" href="/">
          <span className="brand-mark">H</span>
          <span className="brand-text">
            <b>{SHOP.name.toUpperCase()}</b>
            <small>Status Pesanan</small>
          </span>
        </a>
      </header>
      <div className="order-layout">
        <div className="order-side">
          <section className="card">
            <div className="eyebrow">Kode pesanan</div>
            <h2 className="order-id">
              {order.id} <CopyBtn text={order.id} label="" />
            </h2>
            <p className="muted small">Dibuat {formatDate(order.createdAt)} · simpan link halaman ini untuk cek status.</p>
            <StatusTimeline status={order.status} history={order.history} />
            {order.trackingNumber && (
              <div className="resi">
                No. resi: <b>{order.trackingNumber}</b> <CopyBtn text={order.trackingNumber} />
              </div>
            )}
          </section>
          <PaymentBox order={order} accessKey={accessKey} onUpdate={setOrder} />
          <section className="card">
            <h3>Rincian</h3>
            {order.quote.lines.map((l) => (
              <div key={l.key} className="sum-row">
                <span>
                  {l.label}
                  {l.qty > 1 && <em> ×{l.qty}</em>}
                </span>
                <b>{l.total ? formatRupiah(l.total) : 'Gratis'}</b>
              </div>
            ))}
            <div className="sum-row">
              <span>Ongkir ({order.quote.shippingLabel})</span>
              <b>{order.quote.shipping ? formatRupiah(order.quote.shipping) : 'Gratis'}</b>
            </div>
            <div className="sum-total">
              <span>Total</span>
              <b>{formatRupiah(order.total)}</b>
            </div>
          </section>
          <a className="btn ghost wide" href={waLink(SHOP.whatsapp, `Halo ${SHOP.name}, saya mau tanya pesanan ${order.id}.`)} target="_blank" rel="noreferrer">
            <Icon name="chat" /> Tanya admin via WhatsApp
          </a>
        </div>
        <OrderViewer design={order.design} />
      </div>
    </div>
  );
}
