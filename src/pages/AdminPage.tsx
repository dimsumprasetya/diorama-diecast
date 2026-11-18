import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOX_SIZES, FLOOR_BACKGROUNDS, ITEMS, PANELS, SHOP, WALL_BACKGROUNDS, byId, type PanelId } from '../../shared/catalog.ts';
import { formatRupiah } from '../../shared/pricing.ts';
import { api, ApiError, STATUS_LABEL, waLink } from '../lib/api.ts';
import { downloadDataUrl } from '../lib/image.ts';
import type { Uploads } from '../three/diorama.ts';
import { renderPanelPrint, type PrintFile } from '../three/offscreen.ts';
import { Icon } from '../ui/Icon.tsx';
import { OrderViewer, StatusTimeline, formatDate, type PublicOrder } from './OrderPage.tsx';

type AdminOrder = PublicOrder & { adminNote: string; paymentInfo: Record<string, unknown> | null; updatedAt: string; paymentAttempt: number };
type Row = { id: string; status: string; createdAt: string; total: number; customer: { name: string; phone: string; city: string }; size: string; itemCount: number; paymentMethod: string };

const TOKEN_KEY = 'hss.admin';
const PAY_LABEL: Record<string, string> = { midtrans: 'Midtrans', manual: 'Transfer', tokopedia: 'Tokopedia' };

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  };
  if (!token) return <Login onToken={(t) => (sessionStorage.setItem(TOKEN_KEY, t), setToken(t))} />;
  return (
    <div className="page admin">
      <header className="topbar simple">
        <a className="brand" href="/admin" onClick={(e) => (e.preventDefault(), setSelected(null))}>
          <span className="brand-mark">H</span>
          <span className="brand-text">
            <b>{SHOP.name.toUpperCase()}</b>
            <small>Admin Pesanan</small>
          </span>
        </a>
        <div className="topbar-actions">
          <a className="btn sm ghost" href="/" target="_blank" rel="noreferrer">
            Buka Builder
          </a>
          <button className="btn sm" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>
      {selected ? <OrderDetail id={selected} token={token} onBack={() => setSelected(null)} onAuthError={logout} /> : <OrderList token={token} onOpen={setSelected} onAuthError={logout} />}
    </div>
  );
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="page center">
      <form
        className="card narrow"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          try {
            const r = await api<{ token: string }>('/admin/login', { body: { password: pw } });
            onToken(r.token);
          } catch (e2) {
            setErr((e2 as Error).message);
          }
        }}
      >
        <div className="brand-mark big">H</div>
        <h2>Admin {SHOP.name}</h2>
        <label className="form">
          Password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        {err && <div className="alert error">{err}</div>}
        <button className="btn primary wide" type="submit">
          Masuk
        </button>
      </form>
    </div>
  );
}

function OrderList({ token, onOpen, onAuthError }: { token: string; onOpen: (id: string) => void; onAuthError: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    api<{ orders: Row[] }>('/admin/orders', { token })
      .then((r) => setRows(r.orders))
      .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthError() : alert(e.message)));
  }, [token, onAuthError]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows?.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);
  const shown = rows?.filter((r) => !filter || r.status === filter) ?? [];
  return (
    <div className="admin-list">
      <div className="chips">
        <button className={`chip ${!filter ? 'on' : ''}`} onClick={() => setFilter('')}>
          Semua ({rows?.length ?? 0})
        </button>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {v} ({counts[k] ?? 0})
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="muted">Memuat…</p>
      ) : shown.length === 0 ? (
        <div className="card">
          <p className="muted">Belum ada pesanan{filter ? ' dengan status ini' : ''}.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Tanggal</th>
                <th>Customer</th>
                <th>Isi</th>
                <th>Bayar</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)}>
                  <td className="mono">{r.id}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    {r.customer.name}
                    <small>{r.customer.city}</small>
                  </td>
                  <td>
                    {byId(BOX_SIZES, r.size)?.label} · {r.itemCount} aset
                  </td>
                  <td>{PAY_LABEL[r.paymentMethod] ?? r.paymentMethod}</td>
                  <td className="num">{formatRupiah(r.total)}</td>
                  <td>
                    <span className={`status s-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderDetail({ id, token, onBack, onAuthError }: { id: string; token: string; onBack: () => void; onAuthError: () => void }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [customerUrl, setCustomerUrl] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [resi, setResi] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [prints, setPrints] = useState<PrintFile[] | null>(null);
  const [printing, setPrinting] = useState(false);

  const apply = (o: AdminOrder) => {
    setOrder(o);
    setStatus(o.status);
    setResi(o.trackingNumber);
    setAdminNote(o.adminNote);
  };
  const load = useCallback(() => {
    api<{ order: AdminOrder; customerUrl: string }>(`/admin/orders/${id}`, { token })
      .then((r) => {
        apply(r.order);
        setCustomerUrl(r.customerUrl);
      })
      .catch((e) => (e instanceof ApiError && e.status === 401 ? onAuthError() : alert(e.message)));
  }, [id, token, onAuthError]);
  useEffect(load, [load]);

  const uploads = useMemo<Uploads>(() => {
    const u: Uploads = {};
    for (const p of order?.uploadPanels ?? []) u[p as PanelId] = `/api/orders/${id}/upload/${p}?t=${encodeURIComponent(token)}`;
    return u;
  }, [order?.uploadPanels, id, token]);

  if (!order) return <p className="muted pad">Memuat…</p>;
  const d = order.design;

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const r = await api<{ order: AdminOrder }>(`/admin/orders/${id}`, { method: 'PATCH', body, token });
      apply(r.order);
      setNote('');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const makePrints = async () => {
    setPrinting(true);
    try {
      const out: PrintFile[] = [];
      for (const p of PANELS) {
        const f = await renderPanelPrint(d, uploads, p.id);
        if (f) out.push(f);
      }
      setPrints(out);
    } finally {
      setPrinting(false);
    }
  };

  const props = d.items.filter((it) => byId(ITEMS, it.id)?.kind === 'prop');
  const propGroups = new Map<string, number>();
  props.forEach((p) => propGroups.set(`${p.id}|${p.color ?? ''}`, (propGroups.get(`${p.id}|${p.color ?? ''}`) ?? 0) + 1));
  const box = byId(BOX_SIZES, d.size)!;
  const bgLabel = (p: PanelId) => byId(p === 'floor' ? FLOOR_BACKGROUNDS : WALL_BACKGROUNDS, d.panels[p].bg)?.label ?? d.panels[p].bg;

  return (
    <div className="admin-detail">
      <div className="admin-col">
        <button className="btn sm ghost" onClick={onBack}>
          <Icon name="left" size={16} /> Semua pesanan
        </button>
        <section className="card">
          <div className="eyebrow">{PAY_LABEL[order.paymentMethod]} · dibuat {formatDate(order.createdAt)}</div>
          <h2 className="order-id">{order.id}</h2>
          <StatusTimeline status={order.status} history={order.history} />
          <div className="field">
            <label>Ubah status</label>
            <div className="row">
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input className="input" placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn sm primary" disabled={saving || status === order.status} onClick={() => save({ status, note })}>
                Simpan
              </button>
            </div>
          </div>
          <div className="field">
            <label>No. resi pengiriman</label>
            <div className="row">
              <input className="input" value={resi} onChange={(e) => setResi(e.target.value)} placeholder="JNE/J&T/…" />
              <button className="btn sm" disabled={saving || resi === order.trackingNumber} onClick={() => save({ trackingNumber: resi })}>
                Simpan
              </button>
            </div>
          </div>
          <div className="field">
            <label>Catatan internal</label>
            <textarea className="input" rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            <button className="btn sm" disabled={saving || adminNote === order.adminNote} onClick={() => save({ adminNote })}>
              Simpan catatan
            </button>
          </div>
        </section>

        <section className="card">
          <h3>Customer</h3>
          <p>
            <b>{order.customer.name}</b>
            <br />
            <a href={waLink(order.customer.phone, `Halo ${order.customer.name}, ini ${SHOP.name} soal pesanan ${order.id}.\n${customerUrl}`)} target="_blank" rel="noreferrer">
              WA +{order.customer.phone}
            </a>
            {order.customer.email && (
              <>
                <br />
                {order.customer.email}
              </>
            )}
          </p>
          <p className="muted">
            {order.shippingZone === 'pickup' ? 'Ambil sendiri' : `${order.customer.address}, ${order.customer.city} ${order.customer.postalCode}`}
          </p>
          {order.customer.note && <p className="note">“{order.customer.note}”</p>}
          <div className="row">
            <CopyLink url={customerUrl} />
          </div>
        </section>

        <section className="card">
          <h3>Lembar produksi</h3>
          <ul className="bom">
            <li>
              <b>Box {box.label}</b> {box.w}×{box.d}×{box.h} cm
            </li>
            {PANELS.map((p) => (
              <li key={p.id}>
                {p.label}: <b>{bgLabel(p.id)}</b>
                {d.panels[p.id].color && <span className="dot" style={{ background: d.panels[p.id].color }} />}
                {d.panels[p.id].bg === 'upload' && order.uploadPanels.includes(p.id) && (
                  <a href={uploads[p.id]} download={`${order.id}-${p.id}-asli.jpg`}>
                    {' '}
                    (gambar asli)
                  </a>
                )}
              </li>
            ))}
            <li>Weathering: {d.grime}</li>
            {d.options.led && <li>✔ Lampu LED</li>}
            {d.options.baseText && (
              <li>
                Tulisan base: <b>“{d.options.baseText}”</b>
              </li>
            )}
          </ul>
          {propGroups.size > 0 && (
            <>
              <h4>Miniatur 3D</h4>
              <ul className="bom">
                {[...propGroups].map(([k, n]) => {
                  const [pid, color] = k.split('|');
                  return (
                    <li key={k}>
                      {n}× {byId(ITEMS, pid)?.name} {color && <span className="dot" style={{ background: color }} />}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <h4>File cetak (300 DPI, bleed 2 mm)</h4>
          <p className="muted small">Gambar dinding & lantai lengkap dengan stiker, siap print. Miniatur 3D & mobil tidak ikut.</p>
          <button className="btn primary sm" onClick={makePrints} disabled={printing}>
            <Icon name="download" size={16} /> {printing ? 'Membuat file…' : prints ? 'Buat ulang' : 'Buat file cetak'}
          </button>
          {prints && (
            <div className="prints">
              {prints.map((f) => (
                <div key={f.panel} className="print-file">
                  <img src={f.dataUrl} alt="" />
                  <span>
                    <b>{PANELS.find((p) => p.id === f.panel)?.label}</b>
                    <small>
                      {f.widthCm.toFixed(1)}×{f.heightCm.toFixed(1)} cm · {f.widthPx}×{f.heightPx}px
                    </small>
                  </span>
                  <button className="btn sm" onClick={() => downloadDataUrl(f.dataUrl, `${order.id}-${f.panel}.png`)}>
                    <Icon name="download" size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h3>Harga</h3>
          {order.quote.lines.map((l) => (
            <div key={l.key} className="sum-row">
              <span>
                {l.label}
                {l.qty > 1 && <em> ×{l.qty}</em>}
              </span>
              <b>{formatRupiah(l.total)}</b>
            </div>
          ))}
          <div className="sum-row">
            <span>Ongkir ({order.quote.shippingLabel})</span>
            <b>{formatRupiah(order.quote.shipping)}</b>
          </div>
          <div className="sum-total">
            <span>Total</span>
            <b>{formatRupiah(order.total)}</b>
          </div>
          {order.paymentInfo && (
            <details>
              <summary className="muted small">Info pembayaran</summary>
              <pre className="pre">{JSON.stringify(order.paymentInfo, null, 2)}</pre>
            </details>
          )}
        </section>
      </div>
      <div className="admin-view">
        <OrderViewer design={d} uploads={uploads} />
        <div className="snapshots">
          <img src={`/api/orders/${id}/snapshot/hero?t=${encodeURIComponent(token)}`} alt="Foto desain" />
          <img src={`/api/orders/${id}/snapshot/top?t=${encodeURIComponent(token)}`} alt="Tampak depan" />
        </div>
      </div>
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn sm ghost"
      onClick={async () => {
        await navigator.clipboard?.writeText(url).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      <Icon name={ok ? 'check' : 'link'} size={15} /> {ok ? 'Link disalin' : 'Salin link status untuk customer'}
    </button>
  );
}
