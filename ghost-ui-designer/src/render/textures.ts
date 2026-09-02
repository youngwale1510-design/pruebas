// Precarga de texturas (data URIs) usadas como relleno de capas, para poder
// dibujarlas de forma síncrona en el compositor. Entorno navegador.

import { SceneDocument, Control } from '../model/scene';

export type ImageCache = Record<string, HTMLImageElement>;

function collectUris(controls: Control[]): string[] {
  const set = new Set<string>();
  for (const c of controls) {
    for (const l of c.layers) if (l.fillImage) set.add(l.fillImage);
  }
  return [...set];
}

function loadOne(uri: string): Promise<[string, HTMLImageElement] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve([uri, img]);
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

/** Carga todas las texturas de la escena (o de una lista de controles). */
export async function preloadTextures(input: SceneDocument | Control[]): Promise<ImageCache> {
  const controls = Array.isArray(input) ? input : input.controls;
  const results = await Promise.all(collectUris(controls).map(loadOne));
  const cache: ImageCache = {};
  for (const r of results) if (r) cache[r[0]] = r[1];
  return cache;
}

/** Dibuja una imagen cubriendo (cover) un rect, centrada. */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number },
) {
  const s = Math.max(box.w / img.width, box.h / img.height);
  const dw = img.width * s, dh = img.height * s;
  const dx = box.x + (box.w - dw) / 2, dy = box.y + (box.h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}
