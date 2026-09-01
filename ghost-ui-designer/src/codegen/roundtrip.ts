// Round-trip de alto nivel: fusiona la escena en un .cpp existente preservando el
// código escrito a mano, y reconstruye una escena parcial desde un .cpp.

import { SceneDocument } from '../model/scene';
import { generateFreshEditor, generateLayoutBody } from './iplug2/generate';
import { parseSource } from './iplug2/parse';

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

/** Lee un .cpp y devuelve los controles reconstruidos (para seguir editando). */
export function readSceneFromSource(source: string) {
  return parseSource(source);
}
