// Rasterización de un control a un filmstrip (sprite sheet) para controles bitmap.
// La geometría es pura (testeable); el pintado usa el compositor compartido.

import { Control, SceneDocument } from '../model/scene';
import { renderControlFrame } from './renderControl';

export type Orientation = 'horizontal' | 'vertical';

export interface FilmstripLayout {
  frames: number;
  frameW: number;
  frameH: number;
  sheetW: number;
  sheetH: number;
  orientation: Orientation;
}

/** Geometría del sprite sheet. Función pura. */
export function filmstripLayout(
  frames: number,
  frameW: number,
  frameH: number,
  orientation: Orientation,
): FilmstripLayout {
  return {
    frames,
    frameW,
    frameH,
    orientation,
    sheetW: orientation === 'horizontal' ? frameW * frames : frameW,
    sheetH: orientation === 'horizontal' ? frameH : frameH * frames,
  };
}

/** Posición (x,y) del frame i dentro del sheet. Función pura. */
export function frameOrigin(layout: FilmstripLayout, i: number) {
  return layout.orientation === 'horizontal'
    ? { x: layout.frameW * i, y: 0 }
    : { x: 0, y: layout.frameH * i };
}

/** value normalizado (0..1) del frame i para un filmstrip de N frames. Puro. */
export function valueForFrame(i: number, frames: number): number {
  return frames <= 1 ? 0 : i / (frames - 1);
}

/**
 * Renderiza el filmstrip a un canvas (entorno con Canvas2D). Devuelve el canvas;
 * el llamador obtiene el PNG con toBlob/toDataURL. `makeCanvas` desacopla el
 * entorno (document.createElement en el editor, OffscreenCanvas, etc.).
 */
export function renderFilmstrip(
  control: Control,
  scene: SceneDocument,
  frames: number,
  orientation: Orientation,
  makeCanvas: (w: number, h: number) => HTMLCanvasElement,
): { canvas: HTMLCanvasElement; layout: FilmstripLayout } {
  const layout = filmstripLayout(frames, control.rect.w, control.rect.h, orientation);
  const canvas = makeCanvas(layout.sheetW, layout.sheetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  for (let i = 0; i < frames; i++) {
    const o = frameOrigin(layout, i);
    ctx.save();
    ctx.translate(o.x, o.y);
    renderControlFrame(ctx, control, scene, valueForFrame(i, frames));
    ctx.restore();
  }
  return { canvas, layout };
}
