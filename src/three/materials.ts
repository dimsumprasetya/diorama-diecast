import * as THREE from 'three';

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Material standar yang di-cache (dipakai bersama oleh banyak objek). */
export function mat(color: string, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}|${Object.keys(extra).length ? JSON.stringify(extra) : ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    cache.set(key, m);
  }
  return m;
}

/** Permukaan yang tampak bercahaya (layar, panel lampu). */
export function glowMat(color: string, base = '#e8e6dc', intensity = 0.8): THREE.MeshStandardMaterial {
  return mat(base, 0.3, 0, { emissive: new THREE.Color(color), emissiveIntensity: intensity });
}

export const glass = () => mat('#1d2a33', 0.08, 0.6, { transparent: true, opacity: 0.85 });
export const metal = (color = '#9aa0a6') => mat(color, 0.35, 0.8);
export const rubber = () => mat('#18181a', 0.9, 0);
