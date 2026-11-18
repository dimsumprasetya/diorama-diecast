# H-Scale Studio · Diorama Builder 1:64

Web app untuk toko diorama box 1:64. Customer merancang diorama sendiri seperti di game, menyetujui desainnya, membayar, lalu Anda memproduksinya.

**Alur customer:** Pilih tema → atur print dinding & lantai (atau upload gambar sendiri) → tempel aset → tambahan (LED, tulisan di base) → setujui desain → bayar.

## Fitur

**Untuk customer**
- Preview 3D yang bisa diputar, di-zoom, dan dilihat dari depan atau atas. Dinding yang menghalangi kamera otomatis disembunyikan, jadi isi box selalu terlihat.
- Lima tema siap pakai: Midnight Alley, Garasi Rumah, Bengkel Racing, Kanvas Kosong, dan Desain Sendiri.
- Print tiap panel (belakang, kiri, kanan, lantai) bisa dipilih: bata, beton, seng, kayu, rolling door, aspal basah, keramik, dll., atau **upload gambar sendiri**.
- Aset bisa ditambah dengan klik atau di-drag ke preview, lalu digeser langsung di 3D. Aset dinding bisa dipindah ke dinding lain.
  - Neon sign, papan nama toko, dan grafiti **dengan teks custom** (termasuk huruf Jepang).
  - Elemen dinding: rolling door, AC, lampu + sorot cahaya, pipa, kabel, poster, dll.
  - Marka lantai: genangan neon, marka parkir, zebra cross, noda oli, bekas ban, dll.
  - Aksesoris 3D fisik: ban, drum, cone, figur, dll.
- Ukuran, warna, dan putaran aset bisa diatur. Ada undo/redo, desain tersimpan otomatis, dan desain bisa dibagikan lewat link.
- **Mobil contoh ON/OFF** (3 model, 8 warna) yang bisa digeser. Hanya untuk preview dan tidak ikut dihitung harga.
- Mode malam untuk melihat efek lampu LED.
- Harga total ter-update langsung. Checkout ada persetujuan desain, ongkir per wilayah, dan pilihan pembayaran.
- Halaman status pesanan dengan timeline, no. resi, dan preview 3D.

**Untuk Anda (admin, `/admin`)**
- Daftar pesanan dengan filter status. Status bisa diubah (dibayar → diproduksi → dikirim → selesai), plus kolom no. resi dan catatan internal.
- Lembar produksi berisi motif tiap panel, daftar miniatur 3D, LED, dan tulisan base.
- **File cetak siap print 300 DPI** (dengan bleed 2 mm) untuk tiap dinding dan lantai, lengkap dengan stikernya. Ada juga unduhan gambar asli yang di-upload customer.
- Foto desain yang disetujui customer, dan tombol WhatsApp ke customer.

## Menjalankan di komputer

Butuh **Node.js 22.13 atau lebih baru** ([nodejs.org](https://nodejs.org)).

```bash
npm install
cp .env.example .env      # lalu isi ADMIN_PASSWORD
npm run dev
```

Buka http://localhost:5173 untuk builder, dan http://localhost:5173/admin untuk admin.

## Mengatur harga, katalog & info toko

Semua ada di **`shared/catalog.ts`** (ada komentar penjelasan di tiap bagian):

| Yang diatur | Bagian di file |
|---|---|
| Nomor WA, rekening, link Tokopedia, lama produksi | `SHOP` — **wajib diganti** |
| Ukuran box & harga dasar | `BOX_SIZES` (set `enabled: true/false`) |
| Pilihan print dinding/lantai | `WALL_BACKGROUNDS`, `FLOOR_BACKGROUNDS` |
| Aset (nama, harga, warna, teks) | `ITEMS` |
| LED & tulisan base | `OPTIONS` |
| Ongkos kirim | `SHIPPING_ZONES` |

Tema siap pakai ada di **`shared/themes.ts`**. Cara termudah membuat tema baru: susun desainnya di builder, klik tombol 🔗 (bagikan), lalu salin isinya.

Setelah mengubah file: `npm run build`, lalu jalankan ulang server.

> Harga selalu dihitung ulang di server, jadi customer tidak bisa memanipulasi harga dari browser.

## Pembayaran

Customer bisa memilih:

1. **Bayar langsung**
   - Jika Midtrans **belum** diaktifkan: muncul info rekening + tombol konfirmasi WhatsApp. Setelah dana masuk, ubah status pesanan jadi *Dibayar* di `/admin`.
   - Jika Midtrans **aktif**: customer bayar via QRIS, GoPay, ShopeePay, Virtual Account, atau kartu. Status otomatis jadi *Dibayar*.
2. **Checkout via Tokopedia**: customer mendapat kode desain (mis. `HSS-261118-AB12`), lalu membeli produk custom Anda di Tokopedia dan menulis kode itu di catatan pesanan. Anda mencocokkan kodenya di `/admin`.

### Mengaktifkan Midtrans

1. Daftar di [dashboard.midtrans.com](https://dashboard.midtrans.com) dan coba dulu di mode **Sandbox**.
2. Salin *Server Key* & *Client Key* (Settings → Access Keys) ke `.env`:
   ```
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
   MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
   MIDTRANS_IS_PRODUCTION=false
   PUBLIC_URL=https://domain-anda.com
   ```
3. Di dashboard Midtrans → Settings → Payment → **Notification URL**, isi:
   `https://domain-anda.com/api/payments/midtrans/notification`
4. Setelah akun disetujui untuk produksi, ganti ke key production dan set `MIDTRANS_IS_PRODUCTION=true`.

## Online-kan (production)

```bash
npm install
npm run build
npm start            # server di port 3001 (atau PORT di .env)
```

Pilihan hosting:
- **VPS** (mis. IDCloudHost, Biznet Gio, DigitalOcean). Jalankan dengan `pm2 start npm --name diorama -- start`, lalu pasang Nginx + SSL (Let's Encrypt) di depannya.
- **Railway / Render**: wajib pasang **persistent volume/disk** dan arahkan `DATA_DIR` ke sana. Tanpa itu, pesanan hilang setiap kali server restart.

Semua data (database pesanan, foto desain, gambar upload customer) tersimpan di folder `data/`. **Backup folder ini secara rutin.**

## Alur kerja harian

1. Pesanan masuk → buka `/admin` dan cek pembayarannya.
2. Ubah status ke **Dibayar**, lalu **Diproduksi**.
3. Klik **Buat file cetak**, unduh PNG tiap panel, cetak, lalu rakit.
4. Isi **No. resi**, ubah status ke **Dikirim**. Customer bisa melihatnya di link status pesanan mereka.

## Menambah aset baru

- **Stiker print** (dinding/lantai): tambahkan entri di `ITEMS` (`kind: 'decal'`), lalu buat fungsi gambarnya di `DRAW` pada `src/three/decals.ts` (menggambar di canvas 2D).
- **Miniatur 3D**: tambahkan entri di `ITEMS` (`kind: 'prop'`), lalu buat modelnya di `src/three/builders.ts` (dari bentuk dasar three.js).

Semua ukuran ditulis dalam meter dunia nyata dan otomatis diskalakan ke 1:64.

## Struktur

```
shared/     katalog, tema, validasi desain, perhitungan harga (dipakai browser & server)
server/     API Express + database SQLite bawaan Node + Midtrans
src/three/  tekstur, stiker, model 3D, render offscreen (ikon, foto, file cetak)
src/scene/  scene 3D interaktif (React Three Fiber)
src/ui/     configurator (langkah-langkah, inspector, checkout)
src/pages/  halaman status pesanan & admin
test/       tes otomatis (npm test)
```
