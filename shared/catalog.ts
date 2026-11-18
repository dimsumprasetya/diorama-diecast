/**
 * KATALOG & HARGA — H-Scale Studio
 * ------------------------------------------------------------------
 * Satu-satunya file yang perlu Anda ubah untuk mengatur:
 *   - info toko (nomor WA, rekening, link Tokopedia)
 *   - ukuran box, pilihan print dinding & lantai
 *   - stiker/aset print & aksesoris 3D beserta harganya
 *   - opsi tambahan & ongkos kirim
 *
 * Semua harga dalam Rupiah. Ukuran aset (`size`) ditulis dalam METER dunia nyata
 * dan otomatis diperkecil ke skala 1:64 (contoh: pintu rolling 2,8 m → 4,4 cm).
 *
 * Setelah mengubah file ini: `npm run build` lalu jalankan ulang server.
 */

export const SHOP = {
  name: 'H-Scale Studio',
  tagline: 'Custom Diorama Box 1:64',
  /** Nomor WhatsApp toko, format 62xxxxxxxxxx. GANTI. */
  whatsapp: '6281234567890',
  tokopediaUrl: 'https://www.tokopedia.com/h-scale-studio',
  /** Link produk "[PO] REQUEST CUSTOM" di Tokopedia — untuk customer yang mau checkout lewat Tokopedia. GANTI. */
  tokopediaCustomProductUrl: 'https://www.tokopedia.com/h-scale-studio/product',
  productionTime: '5–7 hari kerja',
  /** Rekening untuk mode transfer manual (dipakai jika Midtrans belum diaktifkan). GANTI. */
  bankAccounts: [{ bank: 'BCA', number: '0000000000', holder: 'H-Scale Studio' }],
  /** Batas jumlah aset per diorama. */
  maxItems: 60,
};

/** Semua produk skala 1:64. 1 meter dunia nyata = 1,5625 cm di diorama. */
export const SCALE_DENOM = 64;

// ---------------------------------------------------------------- Ukuran box

export type BoxSizeDef = {
  id: string;
  label: string;
  /** Ukuran bagian dalam (area print) dalam cm: lebar, dalam, tinggi. */
  w: number;
  d: number;
  h: number;
  cars: string;
  price: number;
  /** false = disembunyikan dari customer */
  enabled: boolean;
};

export const BOX_SIZES: BoxSizeDef[] = [
  { id: 'single', label: 'Standar', w: 10, d: 5, h: 5, cars: '1 mobil', price: 49000, enabled: true },
  // Contoh ukuran lain — ubah `enabled: true` jika Anda menjualnya.
  { id: 'double', label: 'Double', w: 20, d: 5, h: 5, cars: '2 mobil', price: 89000, enabled: false },
];

// ---------------------------------------------------------------- Print panel

export type PanelId = 'back' | 'left' | 'right' | 'floor';

export const PANELS: { id: PanelId; label: string }[] = [
  { id: 'back', label: 'Dinding Belakang' },
  { id: 'left', label: 'Dinding Kiri' },
  { id: 'right', label: 'Dinding Kanan' },
  { id: 'floor', label: 'Lantai' },
];

export type BackgroundDef = {
  id: string;
  label: string;
  price: number;
  /** warna bisa dipilih customer */
  colorable?: boolean;
};

/** Pilihan print dinding. 'upload' = customer upload gambar sendiri, 'clear' = akrilik bening tanpa print. */
export const WALL_BACKGROUNDS: BackgroundDef[] = [
  { id: 'brick-red', label: 'Bata Merah', price: 0 },
  { id: 'brick-white', label: 'Bata Putih', price: 0 },
  { id: 'brick-old', label: 'Bata Usang', price: 0 },
  { id: 'concrete-wall', label: 'Beton Ekspos', price: 0 },
  { id: 'plaster', label: 'Tembok Cat', price: 0, colorable: true },
  { id: 'corrugated', label: 'Seng Gelombang', price: 0, colorable: true },
  { id: 'wood-wall', label: 'Papan Kayu', price: 0 },
  { id: 'tile-wall', label: 'Keramik Putih', price: 0 },
  { id: 'shutters', label: 'Deretan Rolling Door', price: 0 },
  { id: 'upload', label: 'Gambar Sendiri', price: 0 },
  { id: 'clear', label: 'Bening (tanpa print)', price: 0 },
];

export const FLOOR_BACKGROUNDS: BackgroundDef[] = [
  { id: 'asphalt-wet', label: 'Aspal Basah', price: 0 },
  { id: 'asphalt', label: 'Aspal', price: 0 },
  { id: 'concrete', label: 'Beton Cor', price: 0 },
  { id: 'epoxy', label: 'Epoxy Garasi', price: 0 },
  { id: 'tiles', label: 'Keramik Garasi', price: 0 },
  { id: 'paving', label: 'Paving Block', price: 0 },
  { id: 'wood', label: 'Lantai Kayu', price: 0 },
  { id: 'grass', label: 'Rumput', price: 0 },
  { id: 'dirt', label: 'Tanah', price: 0 },
  { id: 'upload', label: 'Gambar Sendiri', price: 0 },
];

export const PAINT_COLORS = ['#e8e4da', '#b9c4c9', '#d9c39a', '#9fb39a', '#c97b5a', '#5c6f7e', '#3b3d42', '#f1d36b', '#8a3b3b', '#2f4858'];

// ---------------------------------------------------------------- Aset

export type ItemCategory = 'neon' | 'dinding' | 'grafiti' | 'lantai' | 'props';

export const CATEGORIES: { id: ItemCategory; label: string; icon: string; hint: string }[] = [
  { id: 'neon', label: 'Neon & Papan', icon: '✨', hint: 'Print di dinding' },
  { id: 'dinding', label: 'Elemen Dinding', icon: '🧱', hint: 'Print di dinding' },
  { id: 'grafiti', label: 'Grafiti', icon: '🎨', hint: 'Print di dinding' },
  { id: 'lantai', label: 'Marka Lantai', icon: '🛣️', hint: 'Print di lantai' },
  { id: 'props', label: 'Aksesoris 3D', icon: '🛢️', hint: 'Miniatur fisik' },
];

export type ItemDef = {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  /** 'decal' = bagian dari print, 'prop' = miniatur 3D fisik. */
  kind: 'decal' | 'prop';
  /** 'wall' = di dinding, 'floor' = di lantai. */
  mount: 'wall' | 'floor';
  /** Ukuran dunia nyata [lebar, tinggi, tebal] dalam meter. Untuk stiker lantai: [lebar, -, panjang]. */
  size: [number, number, number];
  colors?: string[];
  /** Teks custom. `presets` = contoh teks yang bisa diklik. */
  text?: { max: number; default: string; presets?: string[] };
  /** Item dinding: tinggi default dari lantai (m). */
  wallHeight?: number;
  /** Item dinding: selalu menempel lantai (mis. pintu rolling). */
  wallOnFloor?: boolean;
  /** Stiker bisa diperbesar/diperkecil oleh customer. */
  resizable?: boolean;
};

const NEON = ['#ff3b6b', '#33d6ff', '#ffd23b', '#7dff6a', '#c86bff', '#ff8a2b'];

export const ITEMS: ItemDef[] = [
  // --- Neon & Papan
  { id: 'neon-sign', name: 'Neon Sign', category: 'neon', kind: 'decal', mount: 'wall', price: 2000, size: [1.9, 0.6, 0], wallHeight: 2.3, colors: NEON, resizable: true, text: { max: 12, default: 'GARAGE', presets: ['GARAGE', 'OPEN 24H', 'JDM', 'ラーメン', '居酒屋', '24時間'] } },
  { id: 'lightbox', name: 'Papan Nama Toko', category: 'neon', kind: 'decal', mount: 'wall', price: 2000, size: [2.6, 0.7, 0], wallHeight: 2.35, colors: ['#e8452c', '#1f6fd1', '#f2b705', '#1e9e5a', '#7c3aed', '#111111'], resizable: true, text: { max: 14, default: 'ラーメン', presets: ['ラーメン', '居酒屋', 'BENGKEL', 'TUNING SHOP', 'CAR WASH'] } },
  { id: 'vertical-sign', name: 'Papan Vertikal', category: 'neon', kind: 'decal', mount: 'wall', price: 2000, size: [0.45, 1.6, 0], wallHeight: 1.3, colors: ['#e8452c', '#1f6fd1', '#f2b705', '#111111'], resizable: true, text: { max: 5, default: '居酒屋', presets: ['居酒屋', '寿司', '24H', 'BAR'] } },

  // --- Elemen Dinding
  { id: 'shutter', name: 'Pintu Rolling', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [2.6, 2.7, 0], wallOnFloor: true, colors: ['#a9adb3', '#7d8a7a', '#6e7f99', '#a0704f'] },
  { id: 'steel-door', name: 'Pintu Besi', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [1.0, 2.1, 0], wallOnFloor: true, colors: ['#5d6b74', '#8a3b3b', '#3b5d46', '#c9c5b8'] },
  { id: 'window', name: 'Jendela', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [1.3, 1.0, 0], wallHeight: 1.3, colors: ['#ecebe6', '#2a2a2a', '#7a5534'] },
  { id: 'ac-unit', name: 'AC Outdoor', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [0.85, 0.6, 0], wallHeight: 2.1 },
  { id: 'wall-lamp', name: 'Lampu + Sorot Cahaya', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [1.6, 2.6, 0], wallHeight: 0.4, colors: ['#ffd59a', '#cfe8ff', '#ff9ec7'] },
  { id: 'pipes', name: 'Pipa Dinding', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [0.5, 3.2, 0], wallOnFloor: true },
  { id: 'meter-box', name: 'Kotak Listrik', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [0.6, 0.9, 0], wallHeight: 1.2 },
  { id: 'cables', name: 'Kabel Semrawut', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [6.4, 0.9, 0], wallHeight: 2.3, resizable: true },
  { id: 'vent', name: 'Kipas Exhaust', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [0.6, 0.6, 0], wallHeight: 2.2 },
  { id: 'poster', name: 'Poster Racing', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [0.6, 0.85, 0], wallHeight: 1.3, colors: ['#d9442b', '#2c5aa0', '#f0c419', '#1e1e22'], resizable: true },
  { id: 'pegboard', name: 'Papan Perkakas', category: 'dinding', kind: 'decal', mount: 'wall', price: 0, size: [1.6, 1.0, 0], wallHeight: 1.0 },

  // --- Grafiti
  { id: 'graffiti-tag', name: 'Grafiti Tag', category: 'grafiti', kind: 'decal', mount: 'wall', price: 2000, size: [1.6, 0.7, 0], wallHeight: 0.9, colors: ['#111111', '#f2f2f2', '#ff3b6b', '#33d6ff', '#c86bff', '#ffd23b'], resizable: true, text: { max: 12, default: 'HSCALE' } },
  { id: 'graffiti-piece', name: 'Grafiti Bubble', category: 'grafiti', kind: 'decal', mount: 'wall', price: 2000, size: [2.4, 1.0, 0], wallHeight: 0.7, colors: ['#ff3b6b', '#33d6ff', '#7dff6a', '#ffd23b', '#c86bff', '#ff8a2b'], resizable: true, text: { max: 8, default: 'JDM' } },
  { id: 'sticker-bomb', name: 'Stiker Tempel', category: 'grafiti', kind: 'decal', mount: 'wall', price: 0, size: [1.0, 0.8, 0], wallHeight: 1.0, resizable: true },

  // --- Marka Lantai
  { id: 'puddle', name: 'Genangan Neon', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [1.6, 0, 1.0], colors: ['#ff3b6b', '#33d6ff', '#c86bff', '#7dff6a'], resizable: true },
  { id: 'parking-lines', name: 'Marka Parkir', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [2.6, 0, 3.2], colors: ['#f2f2f2', '#f0c419'] },
  { id: 'arrow', name: 'Panah Jalan', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [0.6, 0, 1.8], colors: ['#f2f2f2', '#f0c419'], resizable: true },
  { id: 'floor-text', name: 'Tulisan Lantai', category: 'lantai', kind: 'decal', mount: 'floor', price: 2000, size: [2.0, 0, 0.7], colors: ['#f2f2f2', '#f0c419'], resizable: true, text: { max: 8, default: 'STOP', presets: ['STOP', 'SLOW', 'P', 'JDM', '止まれ'] } },
  { id: 'crosswalk', name: 'Zebra Cross', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [3.0, 0, 1.4] },
  { id: 'hazard-stripe', name: 'Garis Kuning-Hitam', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [3.0, 0, 0.3], resizable: true },
  { id: 'manhole', name: 'Tutup Gorong-gorong', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [0.8, 0, 0.8] },
  { id: 'oil-stain', name: 'Noda Oli', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [1.0, 0, 0.8], resizable: true },
  { id: 'tire-marks', name: 'Bekas Ban', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [3.2, 0, 1.0], resizable: true },
  { id: 'drain', name: 'Saluran Air', category: 'lantai', kind: 'decal', mount: 'floor', price: 0, size: [3.0, 0, 0.3] },

  // --- Aksesoris 3D (miniatur fisik)
  { id: 'tire-stack', name: 'Tumpukan Ban', category: 'props', kind: 'prop', mount: 'floor', price: 6000, size: [0.7, 1.0, 0.7] },
  { id: 'oil-drum', name: 'Drum Oli', category: 'props', kind: 'prop', mount: 'floor', price: 5000, size: [0.6, 0.9, 0.6], colors: ['#2f5fa8', '#b8322a', '#e0b021', '#3d7a43', '#3a3a3a'] },
  { id: 'tool-cabinet', name: 'Lemari Perkakas', category: 'props', kind: 'prop', mount: 'floor', price: 10000, size: [0.75, 1.05, 0.45], colors: ['#c62d2d', '#1e1e22', '#2c5aa0', '#e3a21a'] },
  { id: 'floor-jack', name: 'Dongkrak Buaya', category: 'props', kind: 'prop', mount: 'floor', price: 5000, size: [0.4, 0.3, 1.1], colors: ['#c62d2d', '#2c5aa0'] },
  { id: 'compressor', name: 'Kompresor Angin', category: 'props', kind: 'prop', mount: 'floor', price: 8000, size: [0.9, 0.8, 0.4], colors: ['#c62d2d', '#e3a21a', '#2c5aa0'] },
  { id: 'jerrycan', name: 'Jeriken', category: 'props', kind: 'prop', mount: 'floor', price: 3000, size: [0.35, 0.45, 0.18], colors: ['#c62d2d', '#2f7a3d', '#e3a21a'] },
  { id: 'cone', name: 'Traffic Cone', category: 'props', kind: 'prop', mount: 'floor', price: 3000, size: [0.36, 0.7, 0.36] },
  { id: 'barrier', name: 'Water Barrier', category: 'props', kind: 'prop', mount: 'floor', price: 5000, size: [1.5, 0.8, 0.5], colors: ['#d9442b', '#f2f2f2', '#f08a1c'] },
  { id: 'bollard', name: 'Bollard', category: 'props', kind: 'prop', mount: 'floor', price: 2500, size: [0.2, 0.9, 0.2], colors: ['#f0c419', '#3a3a3a', '#d9442b'] },
  { id: 'trash-bin', name: 'Tong Sampah', category: 'props', kind: 'prop', mount: 'floor', price: 4000, size: [0.55, 1.0, 0.55], colors: ['#2f7a3d', '#2c5aa0', '#e3a21a', '#3a3a3a'] },
  { id: 'vending', name: 'Mesin Minuman', category: 'props', kind: 'prop', mount: 'floor', price: 12000, size: [1.0, 1.9, 0.8], colors: ['#c62d2d', '#2c5aa0', '#f2f2f2'] },
  { id: 'pallet', name: 'Palet & Kardus', category: 'props', kind: 'prop', mount: 'floor', price: 6000, size: [1.2, 1.0, 1.0] },
  { id: 'plant-pot', name: 'Pot Tanaman', category: 'props', kind: 'prop', mount: 'floor', price: 4000, size: [0.5, 1.0, 0.5] },
  { id: 'bench', name: 'Bangku', category: 'props', kind: 'prop', mount: 'floor', price: 6000, size: [1.6, 0.85, 0.6] },
  { id: 'mechanic', name: 'Figur Mekanik', category: 'props', kind: 'prop', mount: 'floor', price: 10000, size: [0.55, 1.75, 0.3], colors: ['#2c5aa0', '#c62d2d', '#e07b1c', '#3a3a3a'] },
  { id: 'person', name: 'Figur Pengunjung', category: 'props', kind: 'prop', mount: 'floor', price: 10000, size: [0.55, 1.7, 0.3], colors: ['#f2f2f2', '#1e1e22', '#d9442b', '#6aa0d8'] },
];

// ---------------------------------------------------------------- Mobil contoh (hanya preview, tidak dijual)

export const CAR_MODELS = [
  { id: 'sport', label: 'Sport Coupe', size: [4.4, 1.25, 1.9] as [number, number, number] },
  { id: 'sedan', label: 'Sedan JDM', size: [4.6, 1.42, 1.8] as [number, number, number] },
  { id: 'suv', label: 'SUV 4x4', size: [4.7, 1.85, 1.95] as [number, number, number] },
];

export const CAR_COLORS = ['#c81e1e', '#f4f4f2', '#141416', '#a8adb4', '#1f4fb5', '#6b2fb3', '#ef6c12', '#1f7a4a'];

// ---------------------------------------------------------------- Opsi tambahan

export const OPTIONS = {
  /** Set enabled: false jika tidak menjual opsi ini. */
  led: { enabled: true, label: 'Lampu LED di tutup box', price: 25000, desc: 'Strip LED putih hangat, kabel USB' },
  baseText: { enabled: true, label: 'Tulisan di base', price: 5000, max: 24, desc: 'Cetak putih di sisi depan base hitam' },
  grime: [
    { id: 'none', label: 'Bersih' },
    { id: 'light', label: 'Sedikit Kotor' },
    { id: 'heavy', label: 'Usang & Kotor' },
  ],
};

// ---------------------------------------------------------------- Ongkos kirim

export const SHIPPING_ZONES = [
  { id: 'pickup', label: 'Ambil sendiri', price: 0 },
  { id: 'jawa', label: 'Pulau Jawa', price: 15000 },
  { id: 'sumatra-bali', label: 'Sumatra, Bali & NTB', price: 25000 },
  { id: 'kalsul', label: 'Kalimantan & Sulawesi', price: 35000 },
  { id: 'timur', label: 'Maluku, NTT & Papua', price: 55000 },
];

// ---------------------------------------------------------------- Helpers

export const byId = <T extends { id: string }>(list: T[], id: unknown): T | undefined => list.find((x) => x.id === id);

export const enabledSizes = () => BOX_SIZES.filter((s) => s.enabled);

/** cm diorama → meter dunia nyata */
export const cmToReal = (cm: number) => (cm * SCALE_DENOM) / 100;
/** meter dunia nyata → cm diorama */
export const realToCm = (m: number) => (m * 100) / SCALE_DENOM;

/** Ukuran bagian dalam box dalam meter dunia nyata (dipakai 3D). */
export function boxReal(sizeId: string): { w: number; d: number; h: number } {
  const b = byId(BOX_SIZES, sizeId) ?? BOX_SIZES[0];
  return { w: cmToReal(b.w), d: cmToReal(b.d), h: cmToReal(b.h) };
}
