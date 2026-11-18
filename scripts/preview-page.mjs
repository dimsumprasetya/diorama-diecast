// Ubah dist-preview/index.html jadi halaman tanpa <html>/<head>/<body>,
// supaya bisa dipublikasikan sebagai halaman preview (Artifact claude.ai).
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'dist-preview/index.html';
const html = readFileSync(file, 'utf8');
const assets = [...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="\.\/assets\/[^"]+"[^>]*>(?:<\/script>)?/g)].map((m) => m[0]);
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)?.[0] ?? '';
const boot = '<div id="root"><div class="boot"><div class="boot-logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="88" height="88" aria-hidden="true"><circle cx="32" cy="32" r="29.5" fill="#fff" stroke="#0b0b0b" stroke-width="4"/><g transform="translate(14.95 12.47) scale(0.62)"><path d="M0 0H15V63H0Z M40 0H55V63H40Z M15 24.5H40V39H15Z" fill="#0b0b0b"/><path d="M-3 44.5 L21 20.5" stroke="#fff" stroke-width="4.2"/><rect x="53.7" y="1" width="1.1" height="61" fill="#9b1c2a"/><rect x="47.7" y="1.6" width="6.5" height="1" fill="#9b1c2a"/><rect x="50.6" y="4.55" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="7.5" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="10.45" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="13.4" width="3.6" height="1" fill="#9b1c2a"/><rect x="47.7" y="16.35" width="6.5" height="1" fill="#9b1c2a"/><rect x="50.6" y="19.3" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="22.25" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="25.2" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="28.15" width="3.6" height="1" fill="#9b1c2a"/><rect x="47.7" y="31.1" width="6.5" height="1" fill="#9b1c2a"/><rect x="50.6" y="34.05" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="37.0" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="39.95" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="42.9" width="3.6" height="1" fill="#9b1c2a"/><rect x="47.7" y="45.85" width="6.5" height="1" fill="#9b1c2a"/><rect x="50.6" y="48.8" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="51.75" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="54.7" width="3.6" height="1" fill="#9b1c2a"/><rect x="50.6" y="57.65" width="3.6" height="1" fill="#9b1c2a"/><rect x="47.7" y="60.6" width="6.5" height="1" fill="#9b1c2a"/></g></svg></div><div class="boot-text">H-Scale Studio · Diorama Builder</div></div></div>';

writeFileSync(
  file,
  `<title>H-Scale Diorama Builder</title>
<meta name="description" content="Rancang diorama box 1:64: pilih tema, print dinding & lantai, tempel aset, lihat 3D-nya langsung." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${fonts}
${assets.join('\n')}
<style>html, body { background: #0b0b0b; }</style>
${boot}
`,
);
console.log('preview page:', assets.length, 'asset tags');
