import { useEffect, useMemo, useRef, useState } from 'react';
import { CAR_COLORS, CAR_MODELS, ITEMS, SHOP, byId } from '../../shared/catalog.ts';
import { encodeDesign, type PlacedItem } from '../../shared/design.ts';
import { formatRupiah, quoteDesign } from '../../shared/pricing.ts';
import { ROT_STEP, hitSurface } from '../lib/placement.ts';
import { Stage, stageRay } from '../scene/Stage.tsx';
import { useStore } from '../store.ts';
import { IS_EMBED, IS_PREVIEW } from '../preview.ts';
import { Checkout } from './Checkout.tsx';
import { Icon } from './Icon.tsx';
import { AssetsStep, ExtrasStep, PanelsStep, ThemeStep } from './steps.tsx';
import { useCarThumb, useItemThumb } from './thumbs.ts';

export const STEPS = [
  { label: 'Tema', title: 'Pilih Tema', hint: 'Mulai dari tema siap pakai. Semua bisa diubah setelahnya.' },
  { label: 'Wall', title: 'Print Dinding & Lantai', hint: 'Pilih motif print untuk tiap dinding dan lantai.' },
  { label: 'Aset', title: 'Tempel Aset', hint: 'Klik aset untuk menambah, lalu geser langsung di preview 3D.' },
  { label: 'Ekstra', title: 'Lampu, Teks & Mobil Contoh', hint: 'Tambahan opsional, plus atur mobil contoh untuk preview.' },
  { label: 'Pesan', title: 'Cek & Pesan', hint: 'Periksa desain, isi data pengiriman, lalu bayar.' },
];

export function Configurator() {
  const design = useStore((s) => s.design);
  const view = useStore((s) => s.view);
  const step = useStore((s) => s.step);
  const cameraCmd = useStore((s) => s.cameraCmd);
  const quote = useMemo(() => quoteDesign(design), [design]);
  useShortcuts();

  const onDrop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData('text/x-hss-item');
    const def = byId(ITEMS, id);
    if (!def) return;
    e.preventDefault();
    const ray = stageRay.current?.(e.clientX, e.clientY);
    const st = useStore.getState();
    const hit = ray ? hitSurface(ray, st.design, def.mount) : null;
    if (hit?.mount === 'floor') st.addItem(id, { x: hit.x, z: hit.z });
    else if (hit?.mount === 'wall') st.addItem(id, { wall: hit.wall, u: hit.u, v: hit.v - (def.size[1] / 2) } as Partial<PlacedItem>);
    else st.addItem(id);
  };

  return (
    <div className="app">
      <TopBar total={quote.production} />
      <aside className="panel">
        <StepTabs />
        <div className="panel-head">
          <div className="eyebrow">Langkah {step + 1} dari {STEPS.length}</div>
          <h1>{STEPS[step].title}</h1>
          <p className="muted">{STEPS[step].hint}</p>
        </div>
        <div className="panel-body">
          {step === 0 && <ThemeStep />}
          {step === 1 && <PanelsStep />}
          {step === 2 && <AssetsStep />}
          {step === 3 && <ExtrasStep />}
          {step === 4 && <Checkout />}
        </div>
        <StepFooter />
      </aside>
      <main className="viewport" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <Stage design={design} view={view} interactive cameraCmd={cameraCmd} />
        <div className="hud-hint">
          <span>Drag = putar</span>
          <span>Scroll/cubit = zoom</span>
          <span>Klik aset = pilih & geser</span>
        </div>
        <SelectionPanel />
        <ViewControls />
        <Toast />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- top bar

function TopBar({ total }: { total: number }) {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const share = async () => {
    const st = useStore.getState();
    const url = `${location.origin}${location.pathname}#d=${encodeDesign(st.design)}`;
    try {
      await navigator.clipboard.writeText(url);
      st.notify('Link desain disalin — kirim ke teman!');
    } catch {
      st.notify('Browser menolak menyalin link. Salin dari address bar setelah membuka ulang halaman.');
      history.replaceState(null, '', `#d=${encodeDesign(st.design)}`);
    }
  };
  return (
    <header className="topbar">
      <a className="brand" href="./" aria-label={SHOP.name}>
        <span className="brand-mark">H</span>
        <span className="brand-text">
          <b>{SHOP.name.toUpperCase()}</b>
          <small>Diorama Builder 1:64</small>
        </span>
      </a>
      <div className="topbar-actions">
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => useStore.getState().undo()}>
          <Icon name="undo" />
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => useStore.getState().redo()}>
          <Icon name="redo" />
        </button>
        {!IS_EMBED && (
          <button className="icon-btn" title="Bagikan link desain" onClick={share}>
            <Icon name="link" />
          </button>
        )}
      </div>
      {IS_PREVIEW && <span className="preview-chip" title="Versi preview: pemesanan belum aktif">PREVIEW</span>}
      <div className="price-chip" title="Harga diorama (belum termasuk ongkir)">
        <small>TOTAL</small>
        <PriceTicker value={total} />
      </div>
    </header>
  );
}

function PriceTicker({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    setBump(true);
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
      else setBump(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <b className={bump ? 'bump' : ''}>{formatRupiah(shown)}</b>;
}

function StepTabs() {
  const step = useStore((s) => s.step);
  return (
    <nav className="steps" aria-label="Langkah">
      {STEPS.map((s, i) => (
        <button key={s.label} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => useStore.getState().setStep(i)}>
          <span className="step-num">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
          <span className="step-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}

function StepFooter() {
  const step = useStore((s) => s.step);
  if (step === STEPS.length - 1) return null;
  const go = (n: number) => {
    useStore.getState().setStep(n);
    document.querySelector('.panel-body')?.scrollTo({ top: 0 });
  };
  return (
    <div className="panel-foot">
      <button className="btn ghost" disabled={step === 0} onClick={() => go(step - 1)}>
        <Icon name="left" /> Kembali
      </button>
      <button className="btn primary" onClick={() => go(step + 1)}>
        {step === STEPS.length - 2 ? 'Cek & Pesan' : 'Lanjut'} <Icon name="right" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- kontrol tampilan

function ViewControls() {
  const view = useStore((s) => s.view);
  const led = useStore((s) => s.design.options.led);
  const { setView, camera } = useStore.getState();
  return (
    <div className="viewbar">
      <button className={`vb ${view.showCars ? 'on' : ''}`} onClick={() => setView({ showCars: !view.showCars })} title="Tampilkan/sembunyikan mobil contoh">
        <Icon name="car" /> <span>Mobil {view.showCars ? 'ON' : 'OFF'}</span>
      </button>
      <button className={`vb ${view.night ? 'on' : ''}`} onClick={() => setView({ night: !view.night })} title={led ? 'Mode malam (LED menyala)' : 'Mode malam — tambahkan LED di langkah Ekstra'}>
        <Icon name={view.night ? 'moon' : 'sun'} /> <span>{view.night ? 'Malam' : 'Siang'}</span>
      </button>
      <button className={`vb ${view.showCase ? 'on' : ''}`} onClick={() => setView({ showCase: !view.showCase })} title="Tampilkan/sembunyikan kotak akrilik">
        <Icon name="box" /> <span>Akrilik</span>
      </button>
      <span className="vb-sep" />
      <button className="vb" onClick={() => camera('front')} title="Lihat dari depan">
        <Icon name="front" /> <span>Depan</span>
      </button>
      <button className="vb" onClick={() => camera('top')} title="Lihat dari atas">
        <Icon name="top" /> <span>Atas</span>
      </button>
      <button className="vb" onClick={() => camera('reset')} title="Sudut default">
        <Icon name="eye" /> <span>3D</span>
      </button>
      <button className={`vb ${view.autoRotate ? 'on' : ''}`} onClick={() => setView({ autoRotate: !view.autoRotate })} title="Putar otomatis">
        <Icon name="orbit" /> <span>Putar</span>
      </button>
    </div>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return <div className={`toast ${visible ? 'show' : ''}`} role="status">{toast?.text}</div>;
}

// ---------------------------------------------------------------- panel seleksi

function SelectionPanel() {
  const selected = useStore((s) => s.selected);
  const item = useStore((s) => s.design.items.find((x) => x.uid === s.selected));
  const car = useStore((s) => s.design.cars.find((x) => x.uid === s.selected));
  if (!selected || (!item && !car)) return null;
  return (
    <div className="inspector" onPointerDown={(e) => e.stopPropagation()}>
      {item ? <ItemInspector item={item} /> : <CarInspector uid={car!.uid} />}
    </div>
  );
}

const WALL_LABEL = { back: 'Belakang', left: 'Kiri', right: 'Kanan' } as const;

function ItemInspector({ item }: { item: PlacedItem }) {
  const def = byId(ITEMS, item.id)!;
  const thumb = useItemThumb(def.id);
  const st = useStore.getState();
  const gesture = useRef(false);
  const startGesture = () => {
    if (!gesture.current) {
      st.beginGesture();
      gesture.current = true;
    }
  };
  const endGesture = () => {
    if (gesture.current) {
      useStore.getState().endGesture(true);
      gesture.current = false;
    }
  };
  const live = (patch: Partial<PlacedItem>) => {
    startGesture();
    useStore.getState().transient((d) => {
      const i = d.items.findIndex((x) => x.uid === item.uid);
      if (i >= 0) d.items[i] = { ...d.items[i], ...patch } as PlacedItem;
    });
  };
  return (
    <>
      <div className="insp-head">
        <div className="insp-thumb">{thumb && <img src={thumb} alt="" />}</div>
        <div>
          <div className="insp-title">{def.name}</div>
          <div className="insp-meta">
            <span className={`tag ${def.kind}`}>{def.kind === 'prop' ? 'Miniatur 3D' : def.mount === 'wall' ? 'Print dinding' : 'Print lantai'}</span>
            <span>{def.price ? formatRupiah(def.price) : 'Gratis'}</span>
          </div>
        </div>
        <button className="icon-btn sm" onClick={() => st.select(null)} aria-label="Tutup">
          <Icon name="x" size={16} />
        </button>
      </div>

      {def.text && (
        <div className="field">
          <label>Teks ({Array.from(item.text ?? '').length}/{def.text.max})</label>
          <input
            value={item.text ?? ''}
            maxLength={def.text.max * 2}
            onFocus={startGesture}
            onBlur={() => {
              endGesture();
              if (!item.text?.trim()) st.updateItem(item.uid, { text: def.text!.default });
            }}
            onChange={(e) => live({ text: Array.from(e.target.value).slice(0, def.text!.max).join('') })}
          />
          {def.text.presets && (
            <div className="chips">
              {def.text.presets.map((p) => (
                <button key={p} className={`chip ${item.text === p ? 'on' : ''}`} onClick={() => st.updateItem(item.uid, { text: p })}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {def.colors && (
        <div className="field">
          <label>Warna</label>
          <div className="swatches">
            {def.colors.map((c) => (
              <button key={c} className={`swatch ${item.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => st.updateItem(item.uid, { color: c })} aria-label={c} />
            ))}
          </div>
        </div>
      )}

      {def.resizable && (
        <div className="field">
          <label>Ukuran {Math.round((item.scale ?? 1) * 100)}%</label>
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.05}
            value={item.scale ?? 1}
            onPointerDown={startGesture}
            onPointerUp={() => {
              endGesture();
              st.updateItem(item.uid, {});
            }}
            onChange={(e) => live({ scale: Number(e.target.value) })}
          />
        </div>
      )}

      {item.mount === 'wall' ? (
        <div className="field">
          <label>Pindah ke dinding</label>
          <div className="chips">
            {(['left', 'back', 'right'] as const).map((w) => (
              <button key={w} className={`chip ${item.wall === w ? 'on' : ''}`} onClick={() => st.updateItem(item.uid, { wall: w, u: 0 } as Partial<PlacedItem>)}>
                {WALL_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="field">
          <label>Putar ({Math.round(item.rot)}°)</label>
          <div className="row">
            <button className="btn sm" onClick={() => st.updateItem(item.uid, { rot: item.rot - ROT_STEP } as Partial<PlacedItem>)}>
              <Icon name="rotccw" size={16} /> {ROT_STEP}°
            </button>
            <button className="btn sm" onClick={() => st.updateItem(item.uid, { rot: item.rot + 90 } as Partial<PlacedItem>)}>
              90°
            </button>
            <button className="btn sm" onClick={() => st.updateItem(item.uid, { rot: item.rot + ROT_STEP } as Partial<PlacedItem>)}>
              {ROT_STEP}° <Icon name="rotcw" size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="insp-actions">
        <button className="btn sm" onClick={() => st.duplicate(item.uid)} title="Duplikat">
          <Icon name="copy" size={16} /> Duplikat
        </button>
        {def.kind === 'decal' && (
          <button className="btn sm" onClick={() => st.bringToFront(item.uid)} title="Taruh paling atas">
            <Icon name="layers" size={16} /> Ke depan
          </button>
        )}
        <button className="btn sm danger" onClick={() => st.removeItem(item.uid)} title="Hapus (Delete)">
          <Icon name="trash" size={16} /> Hapus
        </button>
      </div>
    </>
  );
}

function CarModelButton({ model, color, active, onClick }: { model: string; color: string; active: boolean; onClick: () => void }) {
  const thumb = useCarThumb(model, color);
  const label = CAR_MODELS.find((m) => m.id === model)?.label;
  return (
    <button className={`car-opt ${active ? 'on' : ''}`} onClick={onClick} title={label}>
      {thumb ? <img src={thumb} alt="" /> : <span className="ph" />}
      <small>{label}</small>
    </button>
  );
}

export function CarInspector({ uid, compact }: { uid: string; compact?: boolean }) {
  const car = useStore((s) => s.design.cars.find((c) => c.uid === uid));
  const st = useStore.getState();
  if (!car) return null;
  return (
    <>
      {!compact && (
        <div className="insp-head">
          <div>
            <div className="insp-title">Mobil Contoh</div>
            <div className="insp-meta">
              <span className="tag preview">Hanya preview</span>
              <span>Tidak termasuk pesanan</span>
            </div>
          </div>
          <button className="icon-btn sm" onClick={() => st.select(null)} aria-label="Tutup">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      <div className="field">
        <label>Model</label>
        <div className="car-opts">
          {CAR_MODELS.map((m) => (
            <CarModelButton key={m.id} model={m.id} color={car.color} active={car.model === m.id} onClick={() => st.updateCar(car.uid, { model: m.id })} />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Warna</label>
        <div className="swatches">
          {CAR_COLORS.map((c) => (
            <button key={c} className={`swatch ${car.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => st.updateCar(car.uid, { color: c })} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="insp-actions">
        <button className="btn sm" onClick={() => st.updateCar(car.uid, { rot: car.rot + 180 })}>
          <Icon name="rotcw" size={16} /> Balik arah
        </button>
        <button className="btn sm" onClick={() => st.updateCar(car.uid, { rot: car.rot + ROT_STEP })}>
          {ROT_STEP}°
        </button>
        <button className="btn sm danger" onClick={() => st.removeCar(car.uid)}>
          <Icon name="trash" size={16} /> Hapus
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- shortcut keyboard

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (e.key === 'Escape') return st.select(null);
      const sel = st.selected;
      if (!sel) return;
      const item = st.design.items.find((x) => x.uid === sel);
      const car = st.design.cars.find((x) => x.uid === sel);
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (item) st.removeItem(sel);
        else if (car) st.removeCar(sel);
      } else if (e.key === 'r' || e.key === 'R') {
        const d = e.shiftKey ? -ROT_STEP : ROT_STEP;
        if (item?.mount === 'floor') st.updateItem(sel, { rot: item.rot + d } as Partial<PlacedItem>);
        if (car) st.updateCar(sel, { rot: car.rot + d });
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (item?.mount === 'floor') st.updateItem(sel, { x: item.x + dx, z: item.z + dy } as Partial<PlacedItem>);
        else if (item?.mount === 'wall') st.updateItem(sel, { u: item.u + dx, v: item.v - dy } as Partial<PlacedItem>);
        else if (car) st.updateCar(sel, { x: car.x + dx, z: car.z + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
