/**
 * Logo H-Scale Studio (digambar ulang sebagai SVG dari logo asli):
 * huruf H dengan potongan putih diagonal di kaki kiri (berujung di sudut atas palang)
 * dan penggaris merah di sisi kanan kaki kanan.
 */

export const BRAND_RED = '#e32636';
const RULER_RED = '#9b1c2a';

/** Bentuk H dalam viewBox 55×63 (proporsi sama dengan logo asli). */
const H_PATH = 'M0 0H15V63H0Z M40 0H55V63H40Z M15 24.5H40V39H15Z';
const CUT = 'M-3 44.5 L21 20.5';

function Ruler() {
  const ticks = [];
  for (let i = 0; i < 21; i++) {
    const len = i % 5 === 0 ? 6.5 : 3.6;
    ticks.push(<rect key={i} x={54.2 - len} y={1.6 + i * 2.95} width={len} height={1} fill={RULER_RED} />);
  }
  return (
    <g>
      <rect x={53.7} y={1} width={1.1} height={61} fill={RULER_RED} />
      {ticks}
    </g>
  );
}

function HShape() {
  return (
    <>
      <path d={H_PATH} fill="#0b0b0b" />
      <path d={CUT} stroke="#fff" strokeWidth={4.2} />
      <Ruler />
    </>
  );
}

/** Huruf H saja (untuk header). Taruh di atas latar putih. */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={(size * 63) / 55} viewBox="0 0 55 63" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <HShape />
    </svg>
  );
}

/** Lencana bulat lengkap seperti logo asli. */
export function LogoBadge({ size = 160 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="H-Scale Studio — Precision & Craftsmanship">
      <circle cx={100} cy={100} r={95} fill="#fff" stroke="#0b0b0b" strokeWidth={7} />
      <g transform="translate(74.7 38) scale(0.92)">
        <HShape />
      </g>
      <text x={100} y={124} textAnchor="middle" fontFamily="Montserrat, 'Arial Black', sans-serif" fontWeight={900} fontSize={29} letterSpacing={-0.5} fill="#0b0b0b">
        H-SCALE
      </text>
      <text x={100} y={149} textAnchor="middle" fontFamily="Montserrat, 'Arial Black', sans-serif" fontWeight={800} fontSize={25} fill="#0b0b0b">
        STUDIO
      </text>
      <text x={100} y={165} textAnchor="middle" fontFamily="Montserrat, Arial, sans-serif" fontWeight={600} fontSize={6.6} textLength={112} lengthAdjust="spacingAndGlyphs" fill="#0b0b0b">
        PRECISION &amp; CRAFTSMANSHIP
      </text>
    </svg>
  );
}
