// Ubah dist-preview/index.html jadi halaman tanpa <html>/<head>/<body>,
// supaya bisa dipublikasikan sebagai halaman preview (Artifact claude.ai).
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'dist-preview/index.html';
const html = readFileSync(file, 'utf8');
const assets = [...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="\.\/assets\/[^"]+"[^>]*>(?:<\/script>)?/g)].map((m) => m[0]);
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)?.[0] ?? '';
const boot = '<div id="root"><div class="boot"><div class="boot-logo">H</div><div class="boot-text">Menyiapkan workshop…</div></div></div>';

writeFileSync(
  file,
  `<title>H-Scale Diorama Builder</title>
<meta name="description" content="Rancang diorama box 1:64: pilih tema, print dinding & lantai, tempel aset, lihat 3D-nya langsung." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${fonts}
${assets.join('\n')}
<style>html, body { background: #0d0f12; }</style>
${boot}
`,
);
console.log('preview page:', assets.length, 'asset tags');
