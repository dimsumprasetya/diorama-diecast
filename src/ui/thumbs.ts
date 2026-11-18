import { useEffect, useState } from 'react';
import { designFromTheme } from '../../shared/design.ts';
import { carThumb, itemThumb, peekThumb, renderDioramaPhoto } from '../three/offscreen.ts';
import { getTexSet } from '../three/textures.ts';

/** Antrean: render 1 gambar per frame supaya UI tidak macet. */
const queue: (() => void | Promise<void>)[] = [];
let running = false;
function enqueue(fn: () => void | Promise<void>) {
  queue.push(fn);
  if (running) return;
  running = true;
  const tick = async () => {
    const f = queue.shift();
    if (!f) {
      running = false;
      return;
    }
    try {
      await f();
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function useQueued(key: string, make: () => string | Promise<string>, initial?: string) {
  const [url, setUrl] = useState<string | undefined>(initial);
  useEffect(() => {
    if (initial) {
      setUrl(initial);
      return;
    }
    let alive = true;
    setUrl(undefined);
    enqueue(async () => {
      if (!alive) return;
      const u = await make();
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

export function useItemThumb(id: string, color?: string, text?: string) {
  const key = `${id}|${color ?? ''}|${text ?? ''}`;
  return useQueued(key, () => itemThumb(id, color, text), peekThumb(key));
}

export function useCarThumb(model: string, color: string) {
  const key = `car|${model}|${color}`;
  return useQueued(key, () => carThumb(model, color), peekThumb(key));
}

const themeCache = new Map<string, string>();
export function useThemePreview(id: string) {
  return useQueued(
    `theme|${id}`,
    async () => {
      const u = await renderDioramaPhoto(designFromTheme(id), {}, { width: 480, height: 300 });
      themeCache.set(id, u);
      return u;
    },
    themeCache.get(id),
  );
}

const swatchCache = new Map<string, string>();
/** Contoh kecil motif print untuk tombol pilihan. */
export function bgSwatch(id: string, color?: string): string {
  const key = `${id}|${color ?? ''}`;
  const hit = swatchCache.get(key);
  if (hit) return hit;
  const S = 96;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const set = getTexSet(id);
  const img = set.map.image as HTMLCanvasElement;
  const [rw, rh] = Array.isArray(set.realSize) ? set.realSize : [set.realSize, set.realSize];
  const area = Array.isArray(set.realSize) ? Math.max(rw, rh) : 1.6;
  const tw = (S * rw) / area;
  const th = (S * rh) / area;
  for (let y = 0; y < S; y += th) for (let x = 0; x < S; x += tw) ctx.drawImage(img, x, y, tw, th);
  if (color) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, S, S);
  }
  const url = c.toDataURL('image/jpeg', 0.85);
  swatchCache.set(key, url);
  return url;
}
