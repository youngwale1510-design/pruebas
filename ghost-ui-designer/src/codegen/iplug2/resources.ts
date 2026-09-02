// Generación del manifiesto de recursos bitmap (opción B: look Canvas Audio vía
// filmstrips rasterizados). Deriva ids/nombres de fichero estables desde el control.

import { Control, SceneDocument } from '../../model/scene';

const BITMAP_TYPES = new Set(['IBKnobControl', 'IBSwitchControl', 'IBitmapControl']);

export function isBitmapControl(c: Control): boolean {
  return BITMAP_TYPES.has(c.type);
}

/** id de control -> macro de recurso iPlug2, p.ej. "knob_gain" -> "KNOBGAIN_FN". */
export function bitmapResId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() + '_FN';
}

/** id de control -> nombre de fichero del filmstrip. */
export function bitmapFile(id: string): string {
  return `${id}.png`;
}

/** Nº de frames del filmstrip de un control (prioriza el knob 3D; default 61). */
export function controlFrames(c: Control): number {
  if (c.knob3d && c.knob3d.frames > 0) return Math.round(c.knob3d.frames);
  const f = c.props.frames;
  return typeof f === 'number' && f > 0 ? Math.round(f) : 61;
}

export interface BitmapResource {
  controlId: string;
  resId: string;
  file: string;
  frames: number;
}

/** Lista de recursos bitmap requeridos por la escena. */
export function collectBitmapResources(scene: SceneDocument): BitmapResource[] {
  return scene.controls.filter(isBitmapControl).map((c) => ({
    controlId: c.id,
    resId: bitmapResId(c.id),
    file: bitmapFile(c.id),
    frames: controlFrames(c),
  }));
}

/** Cabecera de recursos con los #define de cada bitmap (para incluir en el proyecto). */
export function generateResourcesHeader(scene: SceneDocument): string {
  const res = collectBitmapResources(scene);
  const lines = res.map((r) => `#define ${r.resId} "${r.file}"`);
  return [
    '// [GHOST:RESOURCES BEGIN] — generado por Ghost UI Designer',
    '#pragma once',
    ...lines,
    '// [GHOST:RESOURCES END]',
  ].join('\n');
}
