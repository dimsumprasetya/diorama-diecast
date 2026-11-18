/**
 * Logo H-Scale Studio (digambar ulang sebagai SVG): huruf H dengan potongan diagonal
 * dan penggaris merah di kaki kanan.
 */

export const BRAND_RED = '#e32636';

/** Penggaris merah di sisi kanan kaki kanan H (koordinat viewBox mark 60×70). */
function Ruler() {
  const ticks = [];
  for (let i = 0; i < 17; i++) {
    const len = i % 4 === 0 ? 7 : 4;
    ticks.push(<rect key={i} x={59 - len} y={3 + i * 4} width={len} height={1} fill={BRAND_RED} />);
  }
  return (
    <g>
      <rect x={58.6} y={1} width={1.4} height={68} fill={BRAND_RED} />
      {ticks}
    </g>
  );
}

/** Huruf H saja (untuk header & favicon). */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={(size * 70) / 60} viewBox="0 0 60 70" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M0 0H22V70H0Z M38 0H60V70H38Z M22 22H38V48H22Z" fill="currentColor" />
      <path d="M-0.5 57.8 L22.5 20.2" stroke="var(--logo-cut, #fff)" strokeWidth={2.6} />
      <Ruler />
    </svg>
  );
}

/** Lencana bulat lengkap seperti logo asli. */
export function LogoBadge({ size = 160 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="H-Scale Studio — Precision & Craftsmanship">
      <circle cx={100} cy={100} r={95} fill="#fff" stroke="#0b0b0b" strokeWidth={7} />
      <g transform="translate(73 26) scale(0.9)">
        <path d="M0 0H22V70H0Z M38 0H60V70H38Z M22 22H38V48H22Z" fill="#0b0b0b" />
        <path d="M-0.5 57.8 L22.5 20.2" stroke="#fff" strokeWidth={2.6} />
        <Ruler />
      </g>
      <text x={100} y={122} textAnchor="middle" fontFamily="Montserrat, 'Arial Black', sans-serif" fontWeight={900} fontSize={29} letterSpacing={-0.5} fill="#0b0b0b">
        H-SCALE
      </text>
      <text x={100} y={148} textAnchor="middle" fontFamily="Montserrat, 'Arial Black', sans-serif" fontWeight={800} fontSize={25} fill="#0b0b0b">
        STUDIO
      </text>
      <text x={100} y={164} textAnchor="middle" fontFamily="Montserrat, Arial, sans-serif" fontWeight={600} fontSize={6.6} textLength={112} lengthAdjust="spacingAndGlyphs" fill="#0b0b0b">
        PRECISION &amp; CRAFTSMANSHIP
      </text>
    </svg>
  );
}
