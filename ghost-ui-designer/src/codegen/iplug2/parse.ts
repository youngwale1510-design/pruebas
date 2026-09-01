// Parseo de C++ iPlug2: localiza la región gestionada y reconstruye los controles
// desde los payloads embebidos en los marcadores.

import { Control } from '../../model/scene';
import { decodeControlData, RE } from '../markers';

export interface ParsedRegion {
  /** true si el .cpp contenía una región gestionada (LAYOUT BEGIN/END). */
  found: boolean;
  /** texto anterior a la región (incluye la línea LAYOUT BEGIN). */
  prefix: string;
  /** texto posterior a la región (incluye la línea LAYOUT END). */
  suffix: string;
  /** cuerpo entre BEGIN y END, exclusivo. */
  body: string;
  controls: Control[];
}

/**
 * Extrae la región gestionada de un archivo .cpp.
 * `prefix` termina justo tras el salto de línea de LAYOUT BEGIN;
 * `suffix` empieza en la línea LAYOUT END. Así, para regenerar basta con
 * `prefix + nuevoCuerpo + "\n" + suffix`.
 */
export function parseSource(source: string): ParsedRegion {
  const begin = source.match(RE.layoutBegin);
  const end = source.match(RE.layoutEnd);

  if (!begin || !end || begin.index === undefined || end.index === undefined) {
    return { found: false, prefix: source, suffix: '', body: '', controls: [] };
  }

  const beginLineEnd = source.indexOf('\n', begin.index);
  const bodyStart = beginLineEnd === -1 ? source.length : beginLineEnd + 1;
  const bodyEnd = end.index;

  const prefix = source.slice(0, bodyStart);
  const body = source.slice(bodyStart, bodyEnd);
  const suffix = source.slice(bodyEnd);

  const controls = parseControlsFromBody(body);
  return { found: true, prefix, suffix, body, controls };
}

/** Reconstruye los controles a partir de los bloques CONTROL del cuerpo. */
export function parseControlsFromBody(body: string): Control[] {
  const controls: Control[] = [];
  RE.controlBlock.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.controlBlock.exec(body)) !== null) {
    const control = decodeControlData(m[0]);
    if (control) controls.push(control);
  }
  return controls;
}
