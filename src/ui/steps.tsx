import { useRef, useState } from 'react';
import {
  BOX_SIZES, CATEGORIES, FLOOR_BACKGROUNDS, ITEMS, OPTIONS, PAINT_COLORS, PANELS, WALL_BACKGROUNDS,
  byId, enabledSizes, type ItemCategory, type ItemDef, type PanelId,
} from '../../shared/catalog.ts';
import { THEMES } from '../../shared/themes.ts';
import { formatRupiah } from '../../shared/pricing.ts';
import { resizeImage } from '../lib/image.ts';
import { useStore, type CameraView } from '../store.ts';
import { CarInspector } from './Configurator.tsx';
import { Icon } from './Icon.tsx';
import { bgSwatch, useItemThumb, useThemePreview } from './thumbs.ts';

// ---------------------------------------------------------------- 1. Tema

function ThemeCard({ id, name, desc, active }: { id: string; name: string; desc: string; active: boolean }) {
  const img = useThemePreview(id);
  const choose = () => {
    const st = useStore.getState();
    if (st.design.theme === id) return;
    const hadEdits = st.past.length > 0;
    st.loadTheme(id);
    st.camera('reset');
    if (hadEdits) st.notify(`Tema diganti ke ${name}. Tekan Undo untuk kembali.`);
  };
  return (
    <button className={`theme-card ${active ? 'on' : ''}`} onClick={choose}>
      <div className="theme-img">{img ? <img src={img} alt="" /> : <span className="shimmer" />}</div>
      <div className="theme-info">
        <b>{name}</b>
        <small>{desc}</small>
      </div>
      {active && <span className="badge">Dipilih</span>}
    </button>
  );
}

export function ThemeStep() {
  const theme = useStore((s) => s.design.theme);
  const size = useStore((s) => s.design.size);
  const sizes = enabledSizes();
  const box = byId(BOX_SIZES, size)!;
  return (
    <>
      <div className="product-card">
        <div className="product-dim">
          {box.w}×{box.d}×{box.h}
          <small>cm</small>
        </div>
        <ul>
          <li>Kotak akrilik bening + base akrilik hitam</li>
          <li>Print HD dinding belakang, kiri, kanan & lantai</li>
          <li>Muat {box.cars} diecast skala 1:64</li>
        </ul>
      </div>
      {sizes.length > 1 && (
        <div className="field">
          <label>Ukuran box</label>
          <div className="seg">
            {sizes.map((s) => (
              <button key={s.id} className={size === s.id ? 'on' : ''} onClick={() => useStore.getState().commit((d) => void (d.size = s.id))}>
                <b>{s.label}</b>
                <small>
                  {s.w}×{s.d}×{s.h} cm · {formatRupiah(s.price)}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="theme-grid">
        {THEMES.map((t) => (
          <ThemeCard key={t.id} id={t.id} name={t.name} desc={t.desc} active={theme === t.id} />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 2. Dinding & lantai

const PANEL_CAMERA: Record<PanelId, CameraView> = { back: 'front', left: 'left', right: 'right', floor: 'top' };

export function PanelsStep() {
  const [panel, setPanel] = useState<PanelId>('back');
  const spec = useStore((s) => s.design.panels[panel]);
  const grime = useStore((s) => s.design.grime);
  const upload = useStore((s) => s.uploads[panel]);
  const st = useStore.getState();
  const list = panel === 'floor' ? FLOOR_BACKGROUNDS : WALL_BACKGROUNDS;
  const bg = byId(list, spec.bg);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const choosePanel = (p: PanelId) => {
    setPanel(p);
    st.camera(PANEL_CAMERA[p]);
  };
  const setBg = (id: string) =>
    st.commit((d) => {
      const def = byId(list, id)!;
      d.panels[panel] = def.colorable ? { bg: id, color: d.panels[panel].color ?? PAINT_COLORS[0] } : { bg: id };
    });
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      st.setUpload(panel, await resizeImage(f));
      if (spec.bg !== 'upload') setBg('upload');
    } catch (e) {
      st.notify((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const aspect = panel === 'back' || panel === 'floor' ? '2:1 (melebar)' : '1:1 (kotak)';

  return (
    <>
      <div className="panel-tabs">
        {PANELS.map((p) => (
          <button key={p.id} className={panel === p.id ? 'on' : ''} onClick={() => choosePanel(p.id)}>
            <PanelIcon id={p.id} />
            {p.label.replace('Dinding ', '')}
          </button>
        ))}
      </div>

      <div className="bg-grid">
        {list.map((b) => (
          <button key={b.id} className={`bg-opt ${spec.bg === b.id ? 'on' : ''}`} onClick={() => (b.id === 'upload' && !upload ? fileRef.current?.click() : setBg(b.id))}>
            <span className="bg-img">
              {b.id === 'upload' ? (
                upload ? <img src={upload} alt="" /> : <Icon name="upload" size={22} />
              ) : b.id === 'clear' ? (
                <span className="checker" />
              ) : (
                <img src={bgSwatch(b.id, b.colorable ? (spec.bg === b.id ? spec.color : PAINT_COLORS[0]) : undefined)} alt="" />
              )}
            </span>
            <small>{b.label}</small>
            {b.price > 0 && <em>+{formatRupiah(b.price)}</em>}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {bg?.colorable && (
        <div className="field">
          <label>Warna {bg.label.toLowerCase()}</label>
          <div className="swatches">
            {PAINT_COLORS.map((c) => (
              <button key={c} className={`swatch ${spec.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => st.commit((d) => void (d.panels[panel] = { bg: spec.bg, color: c }))} aria-label={c} />
            ))}
          </div>
        </div>
      )}

      {spec.bg === 'upload' && (
        <div className="upload-box">
          {upload ? <img src={upload} alt="Gambar upload" /> : <div className="upload-empty">Belum ada gambar</div>}
          <div>
            <p className="muted small">
              Rasio panel ini {aspect}. Gambar akan dipotong otomatis di bagian tengah. Gunakan gambar minimal 1200 px agar hasil cetak tajam.
            </p>
            <div className="row">
              <button className="btn sm primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Icon name="upload" size={16} /> {busy ? 'Memproses…' : upload ? 'Ganti gambar' : 'Upload gambar'}
              </button>
              {upload && (
                <button className="btn sm" onClick={() => st.setUpload(panel, null)}>
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {panel !== 'floor' && (
        <button
          className="btn sm ghost wide"
          onClick={() => {
            st.commit((d) => {
              for (const w of ['back', 'left', 'right'] as const) d.panels[w] = { ...spec };
            });
            if (spec.bg === 'upload' && upload) for (const w of ['back', 'left', 'right'] as const) st.setUpload(w, upload);
            st.notify('Motif diterapkan ke semua dinding');
          }}
        >
          Terapkan motif ini ke semua dinding
        </button>
      )}

      <div className="field">
        <label>Efek usang (weathering)</label>
        <div className="seg">
          {OPTIONS.grime.map((g) => (
            <button key={g.id} className={grime === g.id ? 'on' : ''} onClick={() => st.commit((d) => void (d.grime = g.id))}>
              <b>{g.label}</b>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function PanelIcon({ id }: { id: PanelId }) {
  const hl = '#ff7a1a';
  const base = 'currentColor';
  return (
    <svg width="30" height="22" viewBox="0 0 30 22" fill="none" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 18 L9 13 L25 13 L26 18 Z" stroke={id === 'floor' ? hl : base} fill={id === 'floor' ? 'rgba(255,122,26,.25)' : 'none'} />
      <path d="M9 13 L9 3 L25 3 L25 13" stroke={id === 'back' ? hl : base} fill={id === 'back' ? 'rgba(255,122,26,.25)' : 'none'} />
      <path d="M4 18 L4 8 L9 3 L9 13 Z" stroke={id === 'left' ? hl : base} fill={id === 'left' ? 'rgba(255,122,26,.25)' : 'none'} />
      <path d="M25 3 L26 8 L26 18 L25 13" stroke={id === 'right' ? hl : base} fill={id === 'right' ? 'rgba(255,122,26,.25)' : 'none'} />
    </svg>
  );
}

// ---------------------------------------------------------------- 3. Aset

function InventoryCard({ def }: { def: ItemDef }) {
  const thumb = useItemThumb(def.id, def.colors?.[0], def.text?.default);
  const count = useStore((s) => s.design.items.filter((x) => x.id === def.id).length);
  return (
    <button
      className={`inv-card ${def.kind}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-hss-item', def.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => useStore.getState().addItem(def.id)}
      title={`Tambah ${def.name}`}
    >
      <span className="inv-img">{thumb ? <img src={thumb} alt="" draggable={false} /> : <span className="shimmer" />}</span>
      <span className="inv-name">{def.name}</span>
      <span className={`inv-price ${def.price ? '' : 'free'}`}>{def.price ? formatRupiah(def.price) : 'Gratis'}</span>
      {count > 0 && <span className="inv-count">×{count}</span>}
    </button>
  );
}

function PlacedRow({ uid }: { uid: string }) {
  const item = useStore((s) => s.design.items.find((x) => x.uid === uid))!;
  const selected = useStore((s) => s.selected === uid);
  const def = byId(ITEMS, item.id)!;
  const thumb = useItemThumb(def.id);
  const where = item.mount === 'floor' ? 'Lantai' : { back: 'Dinding belakang', left: 'Dinding kiri', right: 'Dinding kanan' }[item.wall];
  return (
    <div className={`placed-row ${selected ? 'on' : ''}`} onClick={() => useStore.getState().select(uid)}>
      <span className="placed-img">{thumb && <img src={thumb} alt="" />}</span>
      <span className="placed-name">
        {def.name}
        {item.text ? <em> “{item.text}”</em> : null}
        <small>{where}</small>
      </span>
      <button
        className="icon-btn sm"
        onClick={(e) => {
          e.stopPropagation();
          useStore.getState().removeItem(uid);
        }}
        aria-label="Hapus"
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

export function AssetsStep() {
  const [cat, setCat] = useState<ItemCategory>('neon');
  const uids = useStore((s) => s.design.items.map((x) => x.uid).join(','));
  const items = ITEMS.filter((i) => i.category === cat);
  const catDef = CATEGORIES.find((c) => c.id === cat)!;
  return (
    <>
      <div className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
      <p className="muted small cat-hint">
        {catDef.hint}. {cat === 'props' ? 'Dibuat sebagai miniatur fisik dan ditempel di lantai.' : 'Klik untuk menambah, atau drag langsung ke preview.'}
      </p>
      <div className="inv-grid">
        {items.map((d) => (
          <InventoryCard key={d.id} def={d} />
        ))}
      </div>
      {uids && (
        <details className="placed" open>
          <summary>Aset terpasang ({uids.split(',').length})</summary>
          {uids.split(',').map((u) => (
            <PlacedRow key={u} uid={u} />
          ))}
        </details>
      )}
    </>
  );
}

// ---------------------------------------------------------------- 4. Ekstra

export function ExtrasStep() {
  const options = useStore((s) => s.design.options);
  const cars = useStore((s) => s.design.cars);
  const view = useStore((s) => s.view);
  const st = useStore.getState();
  const [carSel, setCarSel] = useState<string | null>(cars[0]?.uid ?? null);
  const activeCar = cars.find((c) => c.uid === carSel) ?? cars[0];
  return (
    <>
      {OPTIONS.led.enabled && (
        <div className={`option-card ${options.led ? 'on' : ''}`}>
          <div className="option-icon">
            <Icon name="bulb" size={22} />
          </div>
          <div className="option-text">
            <b>{OPTIONS.led.label}</b>
            <small>{OPTIONS.led.desc}</small>
            <button className="link-btn" onClick={() => st.setView({ night: !view.night })}>
              {view.night ? 'Kembali ke mode siang' : 'Coba lihat di mode malam →'}
            </button>
          </div>
          <label className="switch">
            <input type="checkbox" checked={options.led} onChange={(e) => st.commit((d) => void (d.options.led = e.target.checked))} />
            <span />
          </label>
          <span className="option-price">+{formatRupiah(OPTIONS.led.price)}</span>
        </div>
      )}

      {OPTIONS.baseText.enabled && (
        <div className={`option-card ${options.baseText.trim() ? 'on' : ''}`}>
          <div className="option-icon">
            <Icon name="text" size={22} />
          </div>
          <div className="option-text">
            <b>{OPTIONS.baseText.label}</b>
            <small>{OPTIONS.baseText.desc}</small>
            <input
              className="input"
              placeholder="Contoh: @garasi.kamu"
              value={options.baseText}
              maxLength={OPTIONS.baseText.max}
              onFocus={() => {
                st.camera('front');
                st.beginGesture();
              }}
              onChange={(e) => st.transient((d) => void (d.options.baseText = e.target.value))}
              onBlur={() => st.endGesture(true)}
            />
          </div>
          <span className="option-price">+{formatRupiah(OPTIONS.baseText.price)}</span>
        </div>
      )}

      <div className="section-title">
        <span>Mobil contoh</span>
        <label className="switch sm">
          <input type="checkbox" checked={view.showCars} onChange={(e) => st.setView({ showCars: e.target.checked })} />
          <span />
        </label>
      </div>
      <p className="muted small">Hanya untuk melihat tampilan diorama saat diisi mobil — tidak ikut dipesan. Mobil bisa digeser di preview.</p>
      {cars.length > 0 && (
        <div className="chips">
          {cars.map((c, i) => (
            <button key={c.uid} className={`chip ${activeCar?.uid === c.uid ? 'on' : ''}`} onClick={() => setCarSel(c.uid)}>
              <span className="dot" style={{ background: c.color }} /> Mobil {i + 1}
            </button>
          ))}
        </div>
      )}
      {activeCar && view.showCars && <CarInspector uid={activeCar.uid} compact />}
      {cars.length < 4 && (
        <button className="btn sm ghost wide" onClick={() => st.addCar()}>
          <Icon name="plus" size={16} /> Tambah mobil contoh
        </button>
      )}
    </>
  );
}
