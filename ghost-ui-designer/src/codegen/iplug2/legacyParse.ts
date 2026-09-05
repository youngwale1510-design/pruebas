// Lectura "best-effort" de layouts iPlug2 escritos a mano (o por otra IA) que
// todavía NO usan el formato de marcadores de Ghost (// [GHOST:CONTROL ...]).
//
// Se dispara solo cuando el .cpp tiene la región // [GHOST:LAYOUT ...] pero
// ningún bloque CONTROL con payload (parseControlsFromBody devolvió 0), es
// decir: el archivo trae controles reales escritos en C++ plano (o elementos
// fijos como un scope/visualizador) que Ghost todavía no reconoce como suyos.
//
// Interpreta un subconjunto de la aritmética de IRECT de iPlug2 (Reduce/Get
// From*, GetPadded, SubRect*, GetGridCell, GetMid*Padded) para resolver la
// posición real en píxeles de cada `AttachControl(new Tipo(rect, ...), tag)`:
//   - Si el tipo y sus argumentos calzan con un control que Ghost sabe generar
//     (IVKnobControl/IBKnobControl con un parámetro, IVToggleControl/
//     IVButtonControl/IBSwitchControl con un parámetro) se reconstruye como un
//     Control editable de verdad.
//   - Cualquier otra cosa (texto fijo, un visualizador custom, un control sin
//     parámetro reconocible) se convierte en una RefBox: un cuadro de
//     referencia puramente visual para que el usuario respete su espacio.
//
// Es deliberadamente tolerante: cualquier expresión que no se reconoce se
// resuelve al lienzo completo en vez de fallar, y todo el escaneo está
// envuelto en un try/catch — en el peor caso no encuentra nada, nunca revienta
// la importación.

import { Control, RefBox } from '../../model/scene';
import { makeId } from '../../model/defaults';

interface RectV { L: number; T: number; R: number; B: number }

const KNOB_TYPES = new Set(['IVKnobControl', 'IBKnobControl']);
const SWITCH_TYPES = new Set(['IVToggleControl', 'IVButtonControl', 'IBSwitchControl']);

function toRect(r: RectV) {
  return { x: Math.round(r.L), y: Math.round(r.T), w: Math.round(r.R - r.L), h: Math.round(r.B - r.T) };
}

function parseNum(s: string): number {
  const m = s.trim().match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

function unquote(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** "kThreshold" -> "threshold" (inverso best-effort de paramTag en generate.ts). */
function paramIdFromTag(tag: string): string {
  const rest = tag.replace(/^k/, '');
  return rest.length > 0 ? rest[0].toLowerCase() + rest.slice(1) : tag;
}

/** "kCtrlTagKickIndicator" -> "Kick Indicator" (etiqueta legible para la referencia). */
function humanizeTag(tag: string): string {
  const t = tag.replace(/^k/, '').replace(/^CtrlTag/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return t || tag;
}

/** Encuentra el paréntesis/corchete/llave que cierra el que abre en `openIdx`,
 *  ignorando lo que haya dentro de cadenas "...". */
function matchClose(s: string, openIdx: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Divide por comas de nivel superior (respeta paréntesis/corchetes/llaves y cadenas). */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === '\\' && i + 1 < s.length) { i++; cur += s[i]; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; cur += c; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; cur += c; continue; }
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim().length > 0) parts.push(cur);
  return parts.map((p) => p.trim());
}

/** Métodos de IRECT que NO mutan (devuelven un sub-rect nuevo). */
function applyPure(r: RectV, method: string, args: number[]): RectV {
  switch (method) {
    case 'GetPadded':
      if (args.length >= 4) { const [l, t, rr, b] = args; return { L: r.L - l, T: r.T - t, R: r.R + rr, B: r.B + b }; }
      { const [p] = args; return { L: r.L - p, T: r.T - p, R: r.R + p, B: r.B + p }; }
    case 'GetFromTop': return { L: r.L, T: r.T, R: r.R, B: Math.min(r.T + args[0], r.B) };
    case 'GetFromBottom': return { L: r.L, T: Math.max(r.B - args[0], r.T), R: r.R, B: r.B };
    case 'GetFromLeft': return { L: r.L, T: r.T, R: Math.min(r.L + args[0], r.R), B: r.B };
    case 'GetFromRight': return { L: Math.max(r.R - args[0], r.L), T: r.T, R: r.R, B: r.B };
    case 'GetMidVPadded': { const midY = (r.T + r.B) / 2; return { L: r.L, T: midY - args[0], R: r.R, B: midY + args[0] }; }
    case 'GetMidHPadded': { const midX = (r.L + r.R) / 2; return { L: midX - args[0], T: r.T, R: midX + args[0], B: r.B }; }
    case 'SubRectVertical': { const [n, i] = args; const step = (r.B - r.T) / n; return { L: r.L, T: r.T + i * step, R: r.R, B: r.T + (i + 1) * step }; }
    case 'SubRectHorizontal': { const [n, i] = args; const step = (r.R - r.L) / n; return { L: r.L + i * step, T: r.T, R: r.L + (i + 1) * step, B: r.B }; }
    case 'GetGridCell': {
      const [idx, nRows, nCols] = args;
      const row = Math.floor(idx / nCols);
      const col = idx % nCols;
      const cw = (r.R - r.L) / nCols;
      const ch = (r.B - r.T) / nRows;
      const x0 = r.L + col * cw;
      const y0 = r.T + row * ch;
      return { L: x0, T: y0, R: x0 + cw, B: y0 + ch };
    }
    default:
      return r; // método desconocido: mejor no tocar el rect que reventar
  }
}

/** Reduce* SÍ mutan: devuelven la porción removida, y `.rect` es lo que le queda al original. */
function applyReduce(r: RectV, method: string, args: number[]): { rect: RectV; removed: RectV } {
  const h = args[0] ?? 0;
  switch (method) {
    case 'ReduceFromTop': { const newT = Math.min(r.T + h, r.B); return { rect: { L: r.L, T: newT, R: r.R, B: r.B }, removed: { L: r.L, T: r.T, R: r.R, B: newT } }; }
    case 'ReduceFromBottom': { const newB = Math.max(r.B - h, r.T); return { rect: { L: r.L, T: r.T, R: r.R, B: newB }, removed: { L: r.L, T: newB, R: r.R, B: r.B } }; }
    case 'ReduceFromLeft': { const newL = Math.min(r.L + h, r.R); return { rect: { L: newL, T: r.T, R: r.R, B: r.B }, removed: { L: r.L, T: r.T, R: newL, B: r.B } }; }
    case 'ReduceFromRight': { const newR = Math.max(r.R - h, r.L); return { rect: { L: r.L, T: r.T, R: newR, B: r.B }, removed: { L: newR, T: r.T, R: r.R, B: r.B } }; }
    default: return { rect: r, removed: r };
  }
}

/** Evalúa una expresión de lectura (nunca muta variables): identificador
 *  conocido o `pGraphics->GetBounds()`, seguido de una cadena de `.Metodo(args)`. */
function evalExpr(expr: string, vars: Record<string, RectV>, canvas: RectV): RectV {
  const s = expr.trim();
  let base: RectV;
  let rest: string;

  const boundsRe = /^(?:[A-Za-z_]\w*\s*->\s*)?GetBounds\s*\(\s*\)/;
  const bm = s.match(boundsRe);
  if (bm) {
    base = canvas;
    rest = s.slice(bm[0].length);
  } else {
    const im = s.match(/^[A-Za-z_]\w*/);
    if (im && vars[im[0]] !== undefined) {
      base = vars[im[0]];
      rest = s.slice(im[0].length);
    } else {
      return canvas; // no reconocido: mejor el lienzo completo que romper la importación
    }
  }

  rest = rest.trim();
  while (rest.startsWith('.')) {
    const mm = rest.match(/^\.([A-Za-z_]\w*)\s*\(/);
    if (!mm) break;
    const openIdx = mm[0].length - 1;
    const closeIdx = matchClose(rest, openIdx);
    if (closeIdx === -1) break;
    const argsText = rest.slice(openIdx + 1, closeIdx);
    const args = splitTopLevel(argsText).map(parseNum).filter((n) => !Number.isNaN(n));
    base = applyPure(base, mm[1], args);
    rest = rest.slice(closeIdx + 1).trim();
  }
  return base;
}

const BARE_REDUCE_RE = /^([A-Za-z_]\w*)\.(ReduceFrom(?:Top|Bottom|Left|Right))\s*\(([^()]*)\)\s*$/;

/**
 * Evalúa el lado derecho de una declaración `IRECT nombre = <rhs>;`. El caso
 * especial es `IRECT header = b.ReduceFromTop(44.f);`: ReduceFrom* MUTA `b` (le
 * quita la franja) y el valor asignado a `header` es justo la franja quitada
 * — muy distinto de leerla sin mutar, que es lo que hace `evalExpr` para todo
 * lo demás (encadenados de GetFromX, SubRectVertical, GetGridCell, etc., que
 * sí son de solo lectura).
 */
function evalDeclRHS(rhs: string, vars: Record<string, RectV>, canvas: RectV): RectV {
  const m = rhs.trim().match(BARE_REDUCE_RE);
  if (m) {
    const [, name, method, argsText] = m;
    const cur = vars[name];
    if (cur) {
      const args = splitTopLevel(argsText).map(parseNum).filter((n) => !Number.isNaN(n));
      const { rect, removed } = applyReduce(cur, method, args);
      vars[name] = rect;
      return removed;
    }
  }
  return evalExpr(rhs, vars, canvas);
}

function handleAttachControl(
  inner: string,
  vars: Record<string, RectV>,
  canvas: RectV,
  controls: Control[],
  refBoxes: RefBox[],
): void {
  const topArgs = splitTopLevel(inner);
  if (topArgs.length === 0) return;

  // "mScope = new IGDuckScopeControl(...)" -> quita la asignación al miembro.
  const ctorExpr = topArgs[0].replace(/^\s*\w+\s*=\s*(?!=)/, '').trim();
  const newMatch = ctorExpr.match(/new\s+([A-Za-z_]\w*)\s*\(/);
  if (!newMatch || newMatch.index === undefined) return;

  const typeName = newMatch[1];
  const ctorOpen = newMatch.index + newMatch[0].length - 1;
  const ctorClose = matchClose(ctorExpr, ctorOpen);
  if (ctorClose === -1) return;

  const ctorArgs = splitTopLevel(ctorExpr.slice(ctorOpen + 1, ctorClose));
  if (ctorArgs.length === 0) return;

  const rect = toRect(evalExpr(ctorArgs[0], vars, canvas));
  if (rect.w <= 0 || rect.h <= 0) return;

  const tagArg = topArgs[1] && /^[A-Za-z_]\w*$/.test(topArgs[1].trim()) ? topArgs[1].trim() : undefined;
  const paramArg = ctorArgs[1] && /^k[A-Za-z]\w*$/.test(ctorArgs[1].trim()) ? ctorArgs[1].trim() : undefined;

  if ((KNOB_TYPES.has(typeName) || SWITCH_TYPES.has(typeName)) && paramArg) {
    const paramId = paramIdFromTag(paramArg);
    const label = ctorArgs[2] ? unquote(ctorArgs[2]) : paramId;
    controls.push({
      id: makeId(KNOB_TYPES.has(typeName) ? 'knob' : 'sw'),
      type: typeName as Control['type'],
      name: label || paramId,
      rect,
      paramId,
      props: {},
      layers: [],
      effects: [],
    });
    return;
  }

  const strArg = ctorArgs.slice(1).find((a) => a.trim().startsWith('"'));
  const label = strArg ? unquote(strArg) : tagArg ? humanizeTag(tagArg) : typeName;

  // Ancla para poder reordenar esto luego (ver `cppDeps.ts`): si hay un tag de
  // control (`kCtrlTagScope`) se usa ese, porque un identificador no puede
  // confundirse con nada más. Si NO hay tag (muy común: `AttachControl(new
  // Tipo(rect))` sin más), se usa el propio constructor tal cual aparece en
  // el archivo (p.ej. `new IGDuckScopeControl(scopeRect)`) como fragmento
  // literal — no es tan robusto como un tag, pero sigue permitiendo mover el
  // elemento en vez de dejarlo sin ninguna forma de identificarlo.
  const sourceTag = tagArg ?? ctorExpr.slice(newMatch.index, ctorClose + 1);
  refBoxes.push({ id: makeId('ref'), label: label.slice(0, 40), rect, sourceTag });
}

/**
 * Escanea el .cpp buscando `AttachControl(new Tipo(rect, ...), tag?)` escrito
 * a mano y reconstruye lo que encuentra: controles editables (knob/switch con
 * parámetro reconocido) y cajas de referencia (todo lo demás: texto fijo,
 * visualizadores custom, controles sin parámetro).
 */
export function scanLegacyLayout(source: string, plugW: number, plugH: number): { controls: Control[]; refBoxes: RefBox[] } {
  try {
    const canvas: RectV = { L: 0, T: 0, R: plugW, B: plugH };
    const vars: Record<string, RectV> = {};
    const controls: Control[] = [];
    const refBoxes: RefBox[] = [];

    const re = /(?:(?:const\s+)?IRECT\s+(\w+)\s*=\s*)|(?:(\w+)\.(ReduceFrom(?:Top|Bottom|Left|Right))\s*\()|(?:AttachControl\s*\()/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      if (m[1]) {
        const name = m[1];
        const rhsStart = re.lastIndex;
        const semiIdx = source.indexOf(';', rhsStart);
        if (semiIdx === -1) break;
        vars[name] = evalDeclRHS(source.slice(rhsStart, semiIdx), vars, canvas);
        re.lastIndex = semiIdx + 1;
      } else if (m[2]) {
        const name = m[2];
        const method = m[3];
        const openIdx = re.lastIndex - 1;
        const closeIdx = matchClose(source, openIdx);
        if (closeIdx === -1) break;
        const args = splitTopLevel(source.slice(openIdx + 1, closeIdx)).map(parseNum).filter((n) => !Number.isNaN(n));
        if (vars[name]) vars[name] = applyReduce(vars[name], method, args).rect;
        re.lastIndex = closeIdx + 1;
      } else {
        const openIdx = re.lastIndex - 1;
        const closeIdx = matchClose(source, openIdx);
        if (closeIdx === -1) break;
        handleAttachControl(source.slice(openIdx + 1, closeIdx), vars, canvas, controls, refBoxes);
        re.lastIndex = closeIdx + 1;
      }
    }

    return { controls, refBoxes };
  } catch {
    return { controls: [], refBoxes: [] };
  }
}
