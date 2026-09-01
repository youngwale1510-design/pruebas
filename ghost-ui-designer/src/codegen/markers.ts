// Formato de marcadores para el round-trip iPlug2.
// Toda la región gestionada vive entre LAYOUT_BEGIN y LAYOUT_END; el código fuera
// se preserva. Cada control es un bloque con su payload JSON embebido en base64.

import { Control } from '../model/scene';

export const MARK = {
  layoutBegin: (v: number) => `// [GHOST:LAYOUT BEGIN v=${v}]`,
  layoutEnd: '// [GHOST:LAYOUT END]',
  controlBegin: (id: string) => `// [GHOST:CONTROL BEGIN id=${id}]`,
  controlEnd: (id: string) => `// [GHOST:CONTROL END id=${id}]`,
  dataPrefix: '// [GHOST:DATA]',
} as const;

// Regex de localización (multilínea). Capturan id y, en DATA, el payload base64.
export const RE = {
  layoutBegin: /\/\/ \[GHOST:LAYOUT BEGIN v=(\d+)\]/,
  layoutEnd: /\/\/ \[GHOST:LAYOUT END\]/,
  controlBlock:
    /\/\/ \[GHOST:CONTROL BEGIN id=([^\]]+)\][\s\S]*?\/\/ \[GHOST:CONTROL END id=\1\]/g,
  data: /\/\/ \[GHOST:DATA\]([A-Za-z0-9+/=]+)/,
} as const;

function toB64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}
function fromB64(s: string): string {
  return Buffer.from(s, 'base64').toString('utf8');
}

/** Serializa un control a la línea de comentario `// [GHOST:DATA]<base64>`. */
export function encodeControlData(control: Control): string {
  return `${MARK.dataPrefix}${toB64(JSON.stringify(control))}`;
}

/** Reconstruye el Control desde el texto de un bloque CONTROL completo. */
export function decodeControlData(blockText: string): Control | null {
  const m = blockText.match(RE.data);
  if (!m) return null;
  try {
    return JSON.parse(fromB64(m[1])) as Control;
  } catch {
    return null;
  }
}
