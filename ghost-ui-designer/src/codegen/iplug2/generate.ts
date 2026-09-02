// Generación de C++ iPlug2 a partir del árbol de escena.
// Produce (a) el cuerpo de la región gestionada (los AttachControl con marcadores)
// y (b) helpers para tags de parámetros/controles.

import { GHOSTUI_VERSION, Control, ParamDef, SceneDocument } from '../../model/scene';
import { encodeControlData, MARK } from '../markers';
import { bitmapResId, controlFrames } from './resources';

/** "gain" -> "kGain" (tag de parámetro estilo iPlug2). */
export function paramTag(id: string): string {
  return 'k' + id.replace(/(^|[_-])(\w)/g, (_, __, c: string) => c.toUpperCase());
}

/** id de control -> "kCtrl_<id>". */
export function ctrlTag(id: string): string {
  return `kCtrl_${id}`;
}

function irect(c: Control): string {
  const { x, y, w, h } = c.rect;
  return `IRECT(${x}, ${y}, ${x + w}, ${y + h})`;
}

function attachLine(c: Control): string {
  const rect = irect(c);
  const tag = c.paramId ? paramTag(c.paramId) : 'kNoParameter';
  const label = JSON.stringify(c.name);
  switch (c.type) {
    case 'IVKnobControl':
      return `  pGraphics->AttachControl(new IVKnobControl(${rect}, ${tag}, ${label}), ${ctrlTag(c.id)});`;
    case 'IVSliderControl':
      return `  pGraphics->AttachControl(new IVSliderControl(${rect}, ${tag}, ${label}), ${ctrlTag(c.id)});`;
    case 'IVButtonControl':
      return `  pGraphics->AttachControl(new IVButtonControl(${rect}, SplashClickActionFunc, ${label}), ${ctrlTag(c.id)});`;
    case 'IVToggleControl':
      return `  pGraphics->AttachControl(new IVToggleControl(${rect}, ${tag}, ${label}), ${ctrlTag(c.id)});`;
    case 'IBKnobControl': {
      // Opción B: filmstrip rasterizado desde el editor (look Canvas Audio).
      const res = bitmapResId(c.id);
      const frames = controlFrames(c);
      return `  pGraphics->AttachControl(new IBKnobControl(${c.rect.x}, ${c.rect.y}, pGraphics->LoadBitmap(${res}, ${frames}), ${tag}), ${ctrlTag(c.id)});`;
    }
    case 'IBitmapControl': {
      const res = bitmapResId(c.id);
      const frames = controlFrames(c);
      return `  pGraphics->AttachControl(new IBitmapControl(${c.rect.x}, ${c.rect.y}, pGraphics->LoadBitmap(${res}, ${frames}), ${tag}), ${ctrlTag(c.id)});`;
    }
    default:
      return `  // TODO: tipo de control no soportado: ${c.type}`;
  }
}

/** Bloque marcado de un control (con payload para round-trip). */
export function generateControlBlock(c: Control): string {
  return [
    MARK.controlBegin(c.id),
    `  ${encodeControlData(c)}`,
    attachLine(c),
    MARK.controlEnd(c.id),
  ].join('\n');
}

/** Cuerpo completo de la región gestionada (entre LAYOUT BEGIN/END, exclusivo). */
export function generateLayoutBody(scene: SceneDocument): string {
  return scene.controls.map(generateControlBlock).join('\n');
}

/** Región gestionada completa, incluyendo los marcadores LAYOUT BEGIN/END. */
export function generateManagedRegion(scene: SceneDocument): string {
  return [
    MARK.layoutBegin(GHOSTUI_VERSION),
    generateLayoutBody(scene),
    MARK.layoutEnd,
  ].join('\n');
}

/** Fragmento de enum de tags de parámetros (para insertar en el header). */
export function generateParamEnum(params: ParamDef[]): string {
  const items = params.map((p) => `  ${paramTag(p.id)},`).join('\n');
  return `enum EParams\n{\n${items}\n  kNumParams\n};`;
}

/** Editor mínimo autocontenido cuando se genera desde cero (sin .cpp previo). */
export function generateFreshEditor(scene: SceneDocument): string {
  return `mLayoutFunc = [&](IGraphics* pGraphics) {
  pGraphics->AttachCornerResizer(EUIResizerMode::Scale, false);
  pGraphics->AttachPanelBackground(COLOR_GRAY);
  pGraphics->LoadFont("Roboto-Regular", ROBOTO_FN);
  const IRECT b = pGraphics->GetBounds();
${generateManagedRegion(scene)}
};`;
}
