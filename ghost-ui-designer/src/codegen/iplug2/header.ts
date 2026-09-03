// Mantiene sincronizados los enums EParams/ECtrlTags del .h con la escena.
//
// El .cpp tiene una región marcada (LAYOUT) que el diseñador reescribe entera.
// El .h es distinto: es el archivo donde vive el DSP a mano, así que solo se
// tocan los CUERPOS de estos dos enums, nunca el resto del archivo. Si el .h
// ya tiene marcadores `// [GHOST:PARAMS...]` / `// [GHOST:CTRLTAGS...]` se
// respeta ese bloque; si no los tiene (un .h escrito a mano, como el primer
// plugin que te entregamos), se adoptan las líneas del `enum EParams { ... }`
// / `enum ECtrlTags { ... }` que ya existan y se les añaden marcadores la
// primera vez. En ambos casos SOLO SE AÑADE: un tag o parámetro que ya no
// esté en la escena (se borró un control) nunca se elimina del enum, para no
// romper DSP que aún lo referencie.

import { SceneDocument } from '../../model/scene';
import { ctrlTag, paramTag } from './generate';

export const HMARK = {
  paramsBegin: '// [GHOST:PARAMS BEGIN]',
  paramsEnd: '// [GHOST:PARAMS END]',
  ctrlTagsBegin: '// [GHOST:CTRLTAGS BEGIN]',
  ctrlTagsEnd: '// [GHOST:CTRLTAGS END]',
} as const;

/** Nombres de entrada de un cuerpo de enum, en orden, sin el último (kNumX). */
function parseEnumBody(body: string, lastName: string): string[] {
  const names: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (m && m[1] !== lastName) names.push(m[1]);
  }
  return names;
}

interface MergeOpts {
  markBegin: string;
  markEnd: string;
  enumName: string; // 'EParams' | 'ECtrlTags'
  wantedNames: string[]; // nombres que la escena necesita, en su orden
  lastName: string; // 'kNumParams' | 'kNumCtrlTags'
}

interface MergeResult {
  source: string;
  changed: boolean;
  /** false si no se encontró el enum en absoluto (ni marcado ni a mano): el .h no se tocó. */
  found: boolean;
}

function mergeEnum(source: string, opts: MergeOpts): MergeResult {
  const { markBegin, markEnd, enumName, wantedNames, lastName } = opts;
  const beginIdx = source.indexOf(markBegin);
  const endIdx = beginIdx === -1 ? -1 : source.indexOf(markEnd, beginIdx);

  let existingNames: string[];
  let prefix: string;
  let suffix: string;

  if (beginIdx !== -1 && endIdx !== -1) {
    existingNames = parseEnumBody(source.slice(beginIdx + markBegin.length, endIdx), lastName);
    prefix = source.slice(0, beginIdx);
    suffix = source.slice(endIdx + markEnd.length);
  } else {
    const re = new RegExp(`enum\\s+${enumName}\\s*\\r?\\n?\\s*\\{`, 'm');
    const m = source.match(re);
    if (!m || m.index == null) return { source, changed: false, found: false };
    const bodyStart = m.index + m[0].length;
    const closeIdx = source.indexOf('}', bodyStart);
    if (closeIdx === -1) return { source, changed: false, found: false };
    existingNames = parseEnumBody(source.slice(bodyStart, closeIdx), lastName);
    prefix = source.slice(0, bodyStart);
    suffix = source.slice(closeIdx);
  }

  const merged = [...existingNames];
  for (const n of wantedNames) if (!merged.includes(n)) merged.push(n);

  const changed = beginIdx === -1 || merged.length !== existingNames.length;
  const body =
    `\n${markBegin}\n` +
    merged.map((n) => `  ${n},`).join('\n') +
    (merged.length ? '\n' : '') +
    `  ${lastName}\n${markEnd}\n`;

  // `prefix`/`suffix` pueden ya traer el salto de línea que puso una pasada
  // anterior justo pegado al marcador; se recorta para que `body` (que ya
  // lleva el suyo) no lo duplique y crezca una línea en blanco en cada export.
  prefix = prefix.replace(/\n$/, '');
  suffix = suffix.replace(/^\n/, '');

  return { source: prefix + body + suffix, changed, found: true };
}

export interface HeaderSyncResult {
  source: string;
  paramsFound: boolean;
  paramsChanged: boolean;
  tagsFound: boolean;
  tagsChanged: boolean;
}

/**
 * Añade al `enum EParams` los parámetros de la escena y al `enum ECtrlTags`
 * los kCtrl_<id> de sus controles, sin tocar nada más del archivo. Nunca
 * quita entradas existentes. Idempotente: exportar dos veces seguidas sin
 * cambios en la escena no modifica el archivo.
 */
export function syncHeaderEnums(existingSource: string, scene: SceneDocument): HeaderSyncResult {
  const params = mergeEnum(existingSource, {
    markBegin: HMARK.paramsBegin,
    markEnd: HMARK.paramsEnd,
    enumName: 'EParams',
    wantedNames: scene.params.map((p) => paramTag(p.id)),
    lastName: 'kNumParams',
  });
  const tags = mergeEnum(params.source, {
    markBegin: HMARK.ctrlTagsBegin,
    markEnd: HMARK.ctrlTagsEnd,
    enumName: 'ECtrlTags',
    wantedNames: scene.controls.map((c) => ctrlTag(c.id)),
    lastName: 'kNumCtrlTags',
  });
  return {
    source: tags.source,
    paramsFound: params.found,
    paramsChanged: params.changed,
    tagsFound: tags.found,
    tagsChanged: tags.changed,
  };
}
