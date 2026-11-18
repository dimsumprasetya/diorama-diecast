/** true untuk versi preview tanpa server (GitHub Pages / halaman claude.ai): pemesanan nonaktif. */
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === '1';

/** true khusus halaman preview di claude.ai: link desain (#d=…) tidak bisa dibuka dari sana, jadi tombol bagikan disembunyikan. */
export const IS_EMBED = import.meta.env.VITE_EMBED === '1';
