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
    '// Inclúyelo desde config.h:  #include "<Plugin>_resources.h"',
    '// Los PNG van en resources/img/ y hay que declararlos en resources/main.rc',
    '// (ver <Plugin>_resources.rc.txt).',
    '// Sin #pragma once: este archivo también lo lee rc.exe (compilador de recursos).',
    '#ifndef GHOST_RESOURCES_H',
    '#define GHOST_RESOURCES_H',
    ...lines,
    '#endif',
    '// [GHOST:RESOURCES END]',
    '', // rc.exe exige salto de línea final (RC1004 si falta)
  ].join('\n');
}

/** Líneas para pegar en resources/main.rc (Windows embebe los PNG como recursos).
 *  Convención iPlug2: `NOMBRE_FN PNG NOMBRE_FN` (el nombre viene del #define). */
export function generateResourcesRc(scene: SceneDocument): string {
  const res = collectBitmapResources(scene);
  const plain = res.map((r) => `${r.resId} PNG ${r.resId}`);
  // Dentro de un bloque TEXTINCLUDE cada línea es una CADENA con \r\n, y la
  // última lleva \0. Fuera del bloque van tal cual, sin comillas.
  const quoted = res.map(
    (r, i) => `    "${r.resId} PNG ${r.resId}${i === res.length - 1 ? '\\0' : '\\r\\n'}"`,
  );
  return [
    '=== 1) OBLIGATORIO: al FINAL de resources/main.rc ===',
    '// Pega estas líneas junto a la declaración suelta `ROBOTO_FN TTF ROBOTO_FN`',
    '// que hay al final del archivo (fuera de cualquier BEGIN/END). Sin comillas:',
    '',
    ...plain,
    '',
    '=== 2) OPCIONAL: dentro del bloque `3 TEXTINCLUDE` ===',
    '// Ese bloque solo lo usa el editor de recursos de Visual Studio. Si lo tocas,',
    '// TODAS las líneas deben ir entre comillas; sustituye la línea que termina en',
    '// "...ROBOTO_FN\\0" por "...ROBOTO_FN\\r\\n" y añade debajo, antes de END:',
    '',
    ...quoted,
    '',
    '// Los PNG van en resources/img/ (ya está en las rutas del compilador de',
    '// recursos de iPlug2, ver common-win.props).',
    '',
    '// NOTA: si tu resources/main.rc está junto al .cpp exportado, Ghost ya',
    '// intenta añadir estas líneas él solo (ver syncResourcesRc) — este .txt es',
    '// el respaldo para cuando no lo encuentra o para pegarlo a mano.',
    '',
  ].join('\n');
}

export const RCMARK = {
  begin: '// [GHOST:RESOURCES BEGIN]',
  end: '// [GHOST:RESOURCES END]',
};

export interface RcSyncResult {
  source: string;
  changed: boolean;
}

/**
 * Añade a resources/main.rc las líneas `NOMBRE_FN PNG NOMBRE_FN` que falten
 * para los controles bitmap de la escena. Nunca quita ni reordena nada: solo
 * suma. La primera vez crea un bloque marcado (`// [GHOST:RESOURCES ...]`)
 * pegado justo después de la primera declaración `... TTF ...` que encuentre
 * (el mismo lugar donde ya se pedía pegarlo a mano); si no hay ninguna, lo
 * agrega al final del archivo. Si no hay ningún control bitmap en la escena
 * (nada que declarar), no toca el archivo.
 */
export function syncResourcesRc(existingSource: string, scene: SceneDocument): RcSyncResult {
  const wantedLines = collectBitmapResources(scene).map((r) => `${r.resId} PNG ${r.resId}`);

  const beginIdx = existingSource.indexOf(RCMARK.begin);
  const endIdx = beginIdx === -1 ? -1 : existingSource.indexOf(RCMARK.end, beginIdx);

  let existingLines: string[];
  let prefix: string;
  let suffix: string;

  if (beginIdx !== -1 && endIdx !== -1) {
    existingLines = existingSource
      .slice(beginIdx + RCMARK.begin.length, endIdx)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    prefix = existingSource.slice(0, beginIdx).replace(/\n$/, '');
    suffix = existingSource.slice(endIdx + RCMARK.end.length).replace(/^\n/, '');
  } else {
    existingLines = [];
    // OJO: un .rc típico tiene la MISMA declaración dos veces — una suelta,
    // sin comillas (`ROBOTO_FN TTF ROBOTO_FN`), y otra dentro del bloque
    // `TEXTINCLUDE`, entre comillas y con `\0`/`\r\n` al final (para el editor
    // de recursos de Visual Studio). El bloque TEXTINCLUDE suele ir ANTES en
    // el archivo, así que un match "primera línea con TTF" sin más cae ahí, y
    // el resultado queda pegado dentro del string en vez de después de la
    // declaración suelta. Se descartan las líneas con comillas para evitarlo.
    const fontLine = existingSource.match(/^(?!.*").*\bTTF\b.*$/m);
    if (fontLine && fontLine.index !== undefined) {
      const insertAt = fontLine.index + fontLine[0].length;
      prefix = existingSource.slice(0, insertAt);
      suffix = existingSource.slice(insertAt);
    } else {
      prefix = existingSource.replace(/\s*$/, '');
      suffix = '';
    }
  }

  const merged = [...existingLines];
  for (const l of wantedLines) if (!merged.includes(l)) merged.push(l);

  if (merged.length === 0) return { source: existingSource, changed: false }; // nada que declarar
  const changed = beginIdx === -1 || merged.length !== existingLines.length;
  if (!changed) return { source: existingSource, changed: false };

  const body = `\n${RCMARK.begin}\n` + merged.join('\n') + `\n${RCMARK.end}\n`;
  return { source: prefix + body + suffix, changed: true };
}
