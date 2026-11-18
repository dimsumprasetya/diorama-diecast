import { useEffect, useMemo, useState } from 'react';
import { SHIPPING_ZONES, SHOP } from '../../shared/catalog.ts';
import { formatRupiah, quoteDesign } from '../../shared/pricing.ts';
import { api, type AppConfig } from '../lib/api.ts';
import { navigate } from '../router.ts';
import { IS_PREVIEW } from '../preview.ts';
import { useStore } from '../store.ts';
import { renderDioramaPhoto } from '../three/offscreen.ts';
import { Icon } from './Icon.tsx';

const LS_CUSTOMER = 'hss.customer';
const LS_ORDERS = 'hss.orders';

type Customer = { name: string; phone: string; email: string; address: string; city: string; postalCode: string; note: string };

export function Checkout() {
  const design = useStore((s) => s.design);
  const [zone, setZone] = useState('jawa');
  const quote = useMemo(() => quoteDesign(design, zone), [design, zone]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [method, setMethod] = useState<'direct' | 'tokopedia'>('direct');
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [c, setC] = useState<Customer>(() => {
    try {
      return { name: '', phone: '', email: '', address: '', city: '', postalCode: '', note: '', ...JSON.parse(localStorage.getItem(LS_CUSTOMER) ?? '{}') };
    } catch {
      return { name: '', phone: '', email: '', address: '', city: '', postalCode: '', note: '' };
    }
  });

  useEffect(() => {
    if (IS_PREVIEW) return setConfig({ paymentMode: 'manual', midtrans: null });
    api<AppConfig>('/config').then(setConfig).catch(() => setConfig({ paymentMode: 'manual', midtrans: null }));
  }, []);

  useEffect(() => {
    let alive = true;
    setPhoto(null);
    renderDioramaPhoto(design, { width: 960, height: 600 }).then((u) => alive && setPhoto(u));
    return () => {
      alive = false;
    };
  }, [design]);

  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (IS_PREVIEW) return;
    if (!approved) return setError('Centang persetujuan desain terlebih dahulu.');
    setBusy(true);
    try {
      localStorage.setItem(LS_CUSTOMER, JSON.stringify({ ...c, note: '' }));
      const [hero, front] = await Promise.all([
        renderDioramaPhoto(design, { width: 1400, height: 900, cars: true }),
        renderDioramaPhoto(design, { width: 1400, height: 800, cars: false, view: 'front' }),
      ]);
      const res = await api<{ order: { id: string; paymentUrl: string | null }; accessKey: string; paymentError: string | null }>('/orders', {
        body: { design, customer: c, shippingZone: zone, approved, paymentMethod: method, snapshots: { hero, top: front } },
      });
      const link = `/pesanan/${res.order.id}?k=${res.accessKey}`;
      try {
        const list = JSON.parse(localStorage.getItem(LS_ORDERS) ?? '[]');
        localStorage.setItem(LS_ORDERS, JSON.stringify([{ id: res.order.id, link, at: Date.now() }, ...list].slice(0, 20)));
      } catch {
        /* abaikan */
      }
      if (res.order.paymentUrl) location.href = res.order.paymentUrl;
      else navigate(link);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="checkout" onSubmit={submit}>
      <div className="snapshot">{photo ? <img src={photo} alt="Preview diorama" /> : <span className="shimmer" />}</div>


      <div className="summary">
        {quote.lines.map((l) => (
          <div key={l.key} className="sum-row">
            <span>
              {l.label}
              {l.qty > 1 && <em> ×{l.qty}</em>}
              {l.detail && <small>{l.detail}</small>}
            </span>
            <b>{l.total ? formatRupiah(l.total) : 'Gratis'}</b>
          </div>
        ))}
        <div className="sum-row">
          <span>
            Ongkos kirim
            <select value={zone} onChange={(e) => setZone(e.target.value)} className="select">
              {SHIPPING_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </span>
          <b>{quote.shipping ? formatRupiah(quote.shipping) : 'Gratis'}</b>
        </div>
        <div className="sum-total">
          <span>Total bayar</span>
          <b>{formatRupiah(quote.total)}</b>
        </div>
        <p className="muted small">Estimasi produksi {SHOP.productionTime} setelah pembayaran diterima.</p>
      </div>

      <fieldset className="form">
        <legend>Data pengiriman</legend>
        <label>
          Nama lengkap
          <input required minLength={2} value={c.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label>
          No. WhatsApp
          <input required inputMode="tel" placeholder="08xxxxxxxxxx" value={c.phone} onChange={set('phone')} autoComplete="tel" />
        </label>
        <label>
          Email <span className="muted">(opsional)</span>
          <input type="email" value={c.email} onChange={set('email')} autoComplete="email" />
        </label>
        {zone !== 'pickup' && (
          <>
            <label>
              Alamat lengkap
              <textarea required rows={2} value={c.address} onChange={set('address')} autoComplete="street-address" />
            </label>
            <div className="row2">
              <label>
                Kota/Kab.
                <input required value={c.city} onChange={set('city')} autoComplete="address-level2" />
              </label>
              <label>
                Kode pos
                <input inputMode="numeric" value={c.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
              </label>
            </div>
          </>
        )}
        <label>
          Catatan untuk kami <span className="muted">(opsional)</span>
          <textarea rows={2} value={c.note} onChange={set('note')} placeholder="Mis. mobil yang akan dipajang, request detail tambahan…" />
        </label>
      </fieldset>

      <fieldset className="form">
        <legend>Cara bayar</legend>
        <label className={`pay-opt ${method === 'direct' ? 'on' : ''}`}>
          <input type="radio" name="pay" checked={method === 'direct'} onChange={() => setMethod('direct')} />
          <span>
            <b>{config?.paymentMode === 'midtrans' ? 'Bayar langsung' : 'Transfer bank'}</b>
            <small>
              {config?.paymentMode === 'midtrans'
                ? 'QRIS, GoPay, ShopeePay, Virtual Account, kartu kredit'
                : `Transfer ke rekening ${SHOP.bankAccounts.map((b) => b.bank).join('/')}, lalu konfirmasi via WhatsApp`}
            </small>
          </span>
        </label>
        <label className={`pay-opt ${method === 'tokopedia' ? 'on' : ''}`}>
          <input type="radio" name="pay" checked={method === 'tokopedia'} onChange={() => setMethod('tokopedia')} />
          <span>
            <b>Checkout via Tokopedia</b>
            <small>Dapat kode desain, lalu beli produk custom kami di Tokopedia & tulis kodenya di catatan</small>
          </span>
        </label>
      </fieldset>

      <label className="approve">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        <span>
          Saya sudah memeriksa desain ini dan <b>menyetujuinya untuk diproduksi</b>. Saya paham hasil cetak & rakitan handmade bisa sedikit berbeda dari preview 3D, dan mobil
          contoh tidak termasuk.
        </span>
      </label>

      {error && <div className="alert error">{error}</div>}

      {IS_PREVIEW && <div className="alert warn">Ini versi preview. Pemesanan & pembayaran aktif setelah website di-hosting.</div>}
      <button className="btn primary big" type="submit" disabled={IS_PREVIEW || busy}>
        {busy ? 'Memproses…' : (
          <>
            <Icon name="check" /> Setuju & {method === 'tokopedia' ? 'Buat Kode Desain' : `Bayar ${formatRupiah(quote.total)}`}
          </>
        )}
      </button>
    </form>
  );
}
