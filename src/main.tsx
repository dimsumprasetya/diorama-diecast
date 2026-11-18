import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

/** Tunggu font (dipakai untuk menggambar neon, grafiti, teks Jepang) — maksimal 3,5 detik. */
async function loadFonts() {
  if (!document.fonts) return;
  const fonts = [
    document.fonts.load('700 40px "Chakra Petch"'),
    document.fonts.load('800 40px Montserrat'),
    document.fonts.load('900 40px Montserrat'),
    document.fonts.load('400 40px "Permanent Marker"'),
    document.fonts.load('400 40px Bungee'),
    document.fonts.load('900 40px "Noto Sans JP"', 'ラーメン居酒屋時間寿司走り屋止まれ'),
    document.fonts.load('700 40px "Noto Sans JP"', 'ラーメン居酒屋時間'),
  ];
  await Promise.race([Promise.allSettled(fonts), new Promise((r) => setTimeout(r, 3500))]);
}

loadFonts().then(() => createRoot(document.getElementById('root')!).render(<App />));
