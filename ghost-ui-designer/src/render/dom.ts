// Utilidades de render específicas del entorno navegador (editor / export en el
// renderer). Mantienen el pintado en el mismo motor Canvas2D que el rasterizador,
// de modo que lo que ves en el editor es idéntico a lo que se exporta.

import { Control, SceneDocument } from '../model/scene';
import { frameSize, renderControlFrame } from './renderControl';
import { renderFilmstrip, Orientation } from './filmstrip';
import { ImageCache } from './textures';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Renderiza un frame del control a un canvas (para mostrar en el editor). */
export function renderControlToCanvas(
  control: Control,
  scene: SceneDocument,
  value: number,
  images?: ImageCache,
): HTMLCanvasElement {
  const fs = frameSize(control);
  const canvas = makeCanvas(fs.w, fs.h);
  const ctx = canvas.getContext('2d')!;
  renderControlFrame(ctx, control, scene, value, images);
  return canvas;
}

export interface FilmstripPng {
  controlId: string;
  file: string;
  frames: number;
  dataUri: string; // "data:image/png;base64,..."
}

/** Genera el PNG del filmstrip de un control bitmap. */
export function exportControlFilmstrip(
  control: Control,
  scene: SceneDocument,
  frames: number,
  orientation: Orientation,
  file: string,
  images?: ImageCache,
): FilmstripPng {
  const { canvas } = renderFilmstrip(control, scene, frames, orientation, makeCanvas, images);
  return { controlId: control.id, file, frames, dataUri: canvas.toDataURL('image/png') };
}
