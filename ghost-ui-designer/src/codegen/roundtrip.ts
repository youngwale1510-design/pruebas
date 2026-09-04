// Round-trip de alto nivel: fusiona la escena en un .cpp existente preservando el
// código escrito a mano, y reconstruye una escena parcial desde un .cpp.

import { Control, RefBox, SceneDocument } from '../model/scene';
import { generateFreshEditor, generateLayoutBody } from './iplug2/generate';
import { parseSource } from './iplug2/parse';
import { scanLegacyLayout } from './iplug2/legacyParse';

export interface WriteResult {
  source: string;
  /** true si se reemplazó una región existente; false si se generó desde cero. */
  merged: boolean;
}

/**
 * Escribe la escena en el .cpp:
 *  - Si el archivo ya tiene región gestionada, reemplaza SOLO su cuerpo (el código
 *    fuera de los marcadores se preserva byte a byte).
 *  - Si no la tiene (archivo vacío o sin marcadores), genera un editor mínimo.
 */
export function writeSceneToSource(
  scene: SceneDocument,
  existingSource: string | null,
): WriteResult {
  if (existingSource && existingSource.trim().length > 0) {
    const region = parseSource(existingSource);
    if (region.found) {
      const newBody = generateLayoutBody(scene);
      const source = `${region.prefix}${newBody}\n${region.suffix}`;
      return { source, merged: true };
    }
  }
  return { source: generateFreshEditor(scene), merged: false };
}

export interface ReadSceneResult {
  found: boolean;
  controls: Control[];
  /** Cajas de referencia detectadas automáticamente (ver `legacyParse`):
   *  elementos fijos (texto, visualizadores...) que Ghost no gestiona. */
  refBoxes: RefBox[];
}

/**
 * Lee un .cpp y devuelve los controles reconstruidos (para seguir editando).
 * Si la región marcada ya tiene controles en el formato de Ghost (`// [GHOST:
 * CONTROL ...]`), se usan tal cual. Si no (el layout está vacío o trae
 * código C++ escrito a mano/por otra IA), se intenta reconstruirlo
 * automáticamente: los `AttachControl` reconocibles (knob/switch con un
 * parámetro) se vuelven controles editables, y todo lo demás (texto fijo,
 * visualizadores custom) se vuelve una caja de referencia.
 * `plugW`/`plugH` son el tamaño real del plugin (para resolver las cuentas de
 * IRECT); si no se conocen, se usa 400×300 como mejor esfuerzo.
 */
export function readSceneFromSource(source: string, plugW?: number, plugH?: number): ReadSceneResult {
  const region = parseSource(source);
  if (region.controls.length > 0) {
    return { found: region.found, controls: region.controls, refBoxes: [] };
  }
  const legacy = scanLegacyLayout(source, plugW ?? 400, plugH ?? 300);
  return { found: region.found, controls: legacy.controls, refBoxes: legacy.refBoxes };
}
