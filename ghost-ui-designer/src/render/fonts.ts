// Registro de fuentes personalizadas (FontFace) para que el compositor 2D las
// pueda usar. Las de Google Fonts (index.html) ya llegan cargadas por el
// navegador; esto es solo para las que el usuario IMPORTA (.ttf/.otf/.woff/
// .woff2), que viajan embebidas en el .ghostui como data URI — funcionan sin
// internet, a diferencia de un CDN de fuentes.

import { FontAsset } from '../model/scene';

const registered = new Set<string>();

/** Registra (si hace falta) y espera a que cargue una fuente custom. Idempotente. */
export async function ensureFontLoaded(asset: FontAsset): Promise<void> {
  if (registered.has(asset.id)) return;
  const face = new FontFace(asset.family, `url(${asset.dataUri})`);
  await face.load();
  document.fonts.add(face);
  registered.add(asset.id);
}

/** Registra todas las fuentes custom de la escena (al abrir un proyecto, o tras importar una). */
export async function ensureSceneFontsLoaded(fonts: FontAsset[] | undefined): Promise<void> {
  if (!fonts || fonts.length === 0) return;
  await Promise.all(fonts.map((f) => ensureFontLoaded(f).catch(() => {})));
}

/** Fuentes ya disponibles sin importar nada (del sistema, o cargadas en index.html). */
export const PRESET_FONTS: { label: string; family: string }[] = [
  { label: 'IBM Plex Sans', family: '"IBM Plex Sans", system-ui, sans-serif' },
  { label: 'IBM Plex Mono', family: '"IBM Plex Mono", ui-monospace, monospace' },
  { label: 'Saira', family: '"Saira", system-ui, sans-serif' },
  { label: 'Oswald (condensada)', family: '"Oswald", system-ui, sans-serif' },
  { label: 'Bebas Neue (display)', family: '"Bebas Neue", system-ui, sans-serif' },
  { label: 'Space Mono', family: '"Space Mono", ui-monospace, monospace' },
  { label: 'Sistema (sans)', family: 'system-ui, sans-serif' },
  { label: 'Sistema (monoespaciada)', family: 'ui-monospace, monospace' },
  { label: 'Georgia (serif)', family: 'Georgia, "Times New Roman", serif' },
  { label: 'Impact / Arial Black', family: '"Arial Black", Impact, sans-serif' },
];
