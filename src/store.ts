import { create } from 'zustand';
import { ITEMS, SHOP, byId, type PanelId } from '../shared/catalog.ts';
import { decodeDesign, defaultDesign, designFromTheme, sanitizeDesign, uid, type Design, type PlacedItem, type PreviewCar } from '../shared/design.ts';
import { clampCar, clampItem } from './lib/placement.ts';
import { dims, type Uploads } from './three/diorama.ts';

export type CameraView = 'reset' | 'front' | 'top' | 'left' | 'right' | 'back';

export type ViewState = { showCars: boolean; showCase: boolean; night: boolean; autoRotate: boolean };

type State = {
  design: Design;
  uploads: Uploads;
  past: Design[];
  future: Design[];
  step: number;
  selected: string | null;
  view: ViewState;
  cameraCmd: { view: CameraView; n: number };
  toast: { text: string; n: number } | null;

  setStep(n: number): void;
  /** Ubah desain + simpan riwayat (undo). */
  commit(fn: (d: Design) => void): void;
  /** Ubah desain tanpa riwayat (saat drag). Panggil beginGesture() sekali di awal. */
  transient(fn: (d: Design) => void): void;
  beginGesture(): void;
  /** Batalkan entri riwayat terakhir jika gesture tidak mengubah apa pun. */
  endGesture(changed: boolean): void;
  undo(): void;
  redo(): void;
  select(uid: string | null): void;
  addItem(id: string, at?: Partial<PlacedItem>): void;
  updateItem(uid: string, patch: Partial<PlacedItem>): void;
  removeItem(uid: string): void;
  duplicate(uid: string): void;
  bringToFront(uid: string): void;
  updateCar(uid: string, patch: Partial<PreviewCar>): void;
  addCar(): void;
  removeCar(uid: string): void;
  setUpload(panel: PanelId, dataUrl: string | null): void;
  loadTheme(id: string): void;
  setView(patch: Partial<ViewState>): void;
  camera(view: CameraView): void;
  notify(text: string): void;
};

const LS_DESIGN = 'hss.design.v2';
const LS_UPLOADS = 'hss.uploads.v2';

function initialDesign(): Design {
  const hash = new URLSearchParams(location.hash.slice(1)).get('d');
  if (hash) {
    const d = decodeDesign(hash);
    if (d) return d;
  }
  try {
    const raw = localStorage.getItem(LS_DESIGN);
    if (raw) return sanitizeDesign(JSON.parse(raw));
  } catch {
    /* abaikan desain lama yang rusak */
  }
  return defaultDesign();
}

function initialUploads(): Uploads {
  try {
    return JSON.parse(localStorage.getItem(LS_UPLOADS) ?? '{}');
  } catch {
    return {};
  }
}

const clone = (d: Design): Design => structuredClone(d);

export const useStore = create<State>((set, get) => ({
  design: initialDesign(),
  uploads: initialUploads(),
  past: [],
  future: [],
  step: 0,
  selected: null,
  view: { showCars: true, showCase: true, night: false, autoRotate: false },
  cameraCmd: { view: 'reset', n: 0 },
  toast: null,

  setStep: (step) => set({ step, selected: null }),

  commit(fn) {
    const prev = get().design;
    const next = clone(prev);
    fn(next);
    set({ design: next, past: [...get().past.slice(-80), prev], future: [] });
  },

  transient(fn) {
    const next = clone(get().design);
    fn(next);
    set({ design: next });
  },

  beginGesture() {
    set({ past: [...get().past.slice(-80), get().design], future: [] });
  },

  endGesture(changed) {
    if (!changed) set({ past: get().past.slice(0, -1) });
  },

  undo() {
    const { past, design, future } = get();
    if (!past.length) return;
    set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], selected: null });
  },

  redo() {
    const { past, design, future } = get();
    if (!future.length) return;
    set({ design: future[0], future: future.slice(1), past: [...past, design], selected: null });
  },

  select: (selected) => set({ selected }),

  addItem(id, at = {}) {
    const def = byId(ITEMS, id);
    if (!def) return;
    const { design } = get();
    if (design.items.length >= SHOP.maxItems) {
      get().notify(`Maksimal ${SHOP.maxItems} aset per diorama`);
      return;
    }
    const D = dims(design);
    const jitter = () => (Math.random() - 0.5) * 0.8;
    const base = {
      uid: uid(),
      id,
      scale: 1,
      ...(def.colors ? { color: def.colors[0] } : {}),
      ...(def.text ? { text: def.text.default } : {}),
    };
    let item: PlacedItem =
      def.mount === 'floor'
        ? { ...base, mount: 'floor', x: jitter() * 2, z: D.d * 0.15 + jitter() * 0.5, rot: 0 }
        : { ...base, mount: 'wall', wall: 'back', u: jitter() * 2, v: def.wallOnFloor ? 0 : def.wallHeight ?? 1.2 };
    item = clampItem({ ...item, ...at } as PlacedItem, D);
    get().commit((d) => void d.items.push(item));
    set({ selected: item.uid });
  },

  updateItem(id, patch) {
    get().commit((d) => {
      const i = d.items.findIndex((x) => x.uid === id);
      if (i >= 0) d.items[i] = clampItem({ ...d.items[i], ...patch } as PlacedItem, dims(d));
    });
  },

  removeItem(id) {
    get().commit((d) => void (d.items = d.items.filter((x) => x.uid !== id)));
    if (get().selected === id) set({ selected: null });
  },

  duplicate(id) {
    const src = get().design.items.find((x) => x.uid === id);
    if (!src) return;
    if (get().design.items.length >= SHOP.maxItems) return get().notify(`Maksimal ${SHOP.maxItems} aset`);
    const copy = clampItem(
      src.mount === 'floor' ? { ...src, uid: uid(), x: src.x + 0.5, z: src.z + 0.3 } : { ...src, uid: uid(), u: src.u + 0.6 },
      dims(get().design),
    );
    get().commit((d) => void d.items.push(copy));
    set({ selected: copy.uid });
  },

  bringToFront(id) {
    get().commit((d) => {
      const i = d.items.findIndex((x) => x.uid === id);
      if (i >= 0) d.items.push(...d.items.splice(i, 1));
    });
  },

  updateCar(id, patch) {
    get().commit((d) => {
      const i = d.cars.findIndex((c) => c.uid === id);
      if (i >= 0) d.cars[i] = clampCar({ ...d.cars[i], ...patch }, dims(d));
    });
  },

  addCar() {
    const d = get().design;
    if (d.cars.length >= 4) return;
    const car = clampCar({ uid: uid(), model: 'sedan', color: '#f4f4f2', x: (Math.random() - 0.5) * 2, z: 0.3, rot: 90 }, dims(d));
    get().commit((x) => void x.cars.push(car));
    set({ selected: car.uid, view: { ...get().view, showCars: true } });
  },

  removeCar(id) {
    get().commit((d) => void (d.cars = d.cars.filter((c) => c.uid !== id)));
    set({ selected: null });
  },

  setUpload(panel, dataUrl) {
    const uploads = { ...get().uploads };
    if (dataUrl) uploads[panel] = dataUrl;
    else delete uploads[panel];
    set({ uploads });
  },

  loadTheme(id) {
    const cars = get().design.cars;
    const next = designFromTheme(id);
    next.cars = cars.length ? cars : next.cars;
    set({ design: next, past: [...get().past, get().design], future: [], selected: null });
  },

  setView: (patch) => set({ view: { ...get().view, ...patch } }),
  camera: (view) => set({ cameraCmd: { view, n: get().cameraCmd.n + 1 } }),
  notify: (text) => set({ toast: { text, n: (get().toast?.n ?? 0) + 1 } }),
}));

// Simpan otomatis ke browser
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let uploadsDirty = false;
useStore.subscribe((s, prev) => {
  if (s.design === prev.design && s.uploads === prev.uploads) return;
  if (s.uploads !== prev.uploads) uploadsDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const cur = useStore.getState();
    try {
      localStorage.setItem(LS_DESIGN, JSON.stringify(cur.design));
    } catch {
      /* penyimpanan penuh */
    }
    if (uploadsDirty) {
      uploadsDirty = false;
      try {
        localStorage.setItem(LS_UPLOADS, JSON.stringify(cur.uploads));
      } catch {
        /* gambar terlalu besar untuk localStorage — tetap jalan tanpa disimpan */
      }
    }
  }, 400);
});
