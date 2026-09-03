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

/** Origen del bitmap: el margen para sombras (`props.pad`) agranda el PNG, así
 *  que el control se ancla desplazado para que la pieza no se mueva. */
function bitmapOrigin(c: Control): { x: number; y: number } {
  const pad = Math.max(0, Math.round(Number(c.props.pad ?? 0) || 0));
  return { x: c.rect.x - pad, y: c.rect.y - pad };
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
      const o = bitmapOrigin(c);
      return `  pGraphics->AttachControl(new IBKnobControl(${o.x}, ${o.y}, pGraphics->LoadBitmap(${res}, ${frames}), ${tag}), ${ctrlTag(c.id)});`;
    }
    case 'IBSwitchControl': {
      // Filmstrip de N estados: switch deslizante, palanca, botón…
      const res = bitmapResId(c.id);
      const frames = controlFrames(c);
      const o = bitmapOrigin(c);
      return `  pGraphics->AttachControl(new IBSwitchControl(${o.x}, ${o.y}, pGraphics->LoadBitmap(${res}, ${frames}), ${tag}), ${ctrlTag(c.id)});`;
    }
    case 'IBitmapControl': {
      const res = bitmapResId(c.id);
      const frames = controlFrames(c);
      const o = bitmapOrigin(c);
      return `  pGraphics->AttachControl(new IBitmapControl(${o.x}, ${o.y}, pGraphics->LoadBitmap(${res}, ${frames}), ${tag}), ${ctrlTag(c.id)});`;
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

/**
 * Selector de tamaño (100% / 75% / 50%) que se añade a TODOS los plugins que
 * exporta el diseñador. Usa `PLUG_WIDTH`/`PLUG_HEIGHT` (el tamaño real del
 * lienzo, ya sincronizado en config.h) y `IGraphics::Resize(w, h, scale)`
 * escalando el mismo layout — el mismo mecanismo que usa el tirador de
 * esquina (`AttachCornerResizer`) que ya trae el plugin, pero con paradas
 * fijas para que el 100% real quepa siempre en pantalla y el usuario pueda
 * volver a él con un clic. No depende de ningún control de la escena, así
 * que no necesita marcador propio: se regenera entero en cada export.
 */
function generateSizeMenu(): string {
  const btn = (label: string, scale: string, x: string) =>
    `  pGraphics->AttachControl(new IVButtonControl(IRECT(${x}, 4, ${x} + sw, 4 + sh), [pGraphics](IControl*) { pGraphics->Resize(PLUG_WIDTH, PLUG_HEIGHT, ${scale}f); }, "${label}", ghostSizeMenuStyle));`;
  return [
    '  // Selector de tamaño (100% / 75% / 50%) — generado por Ghost UI Designer.',
    '  {',
    '    const int sw = 34, sh = 16, pad = 4;',
    '    const int x100 = pGraphics->Width() - pad - sw;',
    '    const int x75 = (x100 - pad - sw) > 0 ? (x100 - pad - sw) : 0;',
    '    const int x50 = (x75 - pad - sw) > 0 ? (x75 - pad - sw) : 0;',
    // Sin texto de "valor" (el botón no representa un parámetro, no aplica);
    // la fuente del label se deja en su default (DEFAULT_FONT) para no
    // depender de con qué nombre registró el .ttf el LoadFont() de tu DSP.
    '    const IVStyle ghostSizeMenuStyle = DEFAULT_STYLE.WithShowValue(false);',
    btn('100%', '1.', 'x100'),
    btn('75%', '.75', 'x75'),
    btn('50%', '.5', 'x50'),
    '  }',
  ].join('\n');
}

/** Cuerpo completo de la región gestionada (entre LAYOUT BEGIN/END, exclusivo). */
export function generateLayoutBody(scene: SceneDocument): string {
  const controls = scene.controls.map(generateControlBlock).join('\n');
  return `${controls}\n${generateSizeMenu()}`;
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
