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

// Los controles "bitmap" de iPlug2 (IBKnobControl/IBSwitchControl) tienen un
// constructor con FIRMA DISTINTA a la de sus primos "vector": en vez de un
// solo IRECT reciben `(x, y, bitmap, paramIdx)` — dos floats sueltos. Sin
// distinguir esto, `ctorArgs[0]` (que sería "x", un número) se intentaba leer
// como si fuera todo un rect, y como no calzaba con nada se devolvía el
// lienzo completo — por eso los knobs de MBC4 (que usan justo esta firma)
// salían todos en la esquina superior izquierda.
const XY_BITMAP_TYPES = new Set(['IBKnobControl', 'IBSwitchControl']);

function toRect(r: RectV) {
  return { x: Math.round(r.L), y: Math.round(r.T), w: Math.round(r.R - r.L), h: Math.round(r.B - r.T) };
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

interface CompositeParam { paramId: string; paramExpr: string; label: string }

/**
 * Algunos plugins direccionan un parámetro con una FUNCIÓN en vez de un tag
 * suelto — típico de layouts "por banda/canal" ya desenrollados a mano:
 * `BandParam(0, kOffGain)` en vez de `kGain`. A diferencia de un tag simple
 * (`paramIdFromTag`), acá no hay forma de derivar un id legible del texto sin
 * más contexto — así que se sintetiza uno estable a partir del índice y del
 * offset, y se GUARDA LA EXPRESIÓN TAL CUAL (`paramExpr`) para que, si el
 * usuario la edita en Ghost y vuelve a exportar, se reemita exactamente
 * igual (`BandParam(0, kOffGain)`), no un tag inventado que no existiría en
 * el .h del usuario.
 */
function matchCompositeParam(expr: string): CompositeParam | null {
  const m = expr.trim().match(/^([A-Za-z_]\w*)\s*\(\s*(\d+)\s*,\s*(k[A-Za-z]\w*)\s*\)$/);
  if (!m) return null;
  const [, fn, idxStr, offsetTag] = m;
  const offsetName = offsetTag.replace(/^kOff/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return {
    paramId: `${fn.toLowerCase()}_${idxStr}_${offsetName.toLowerCase().replace(/\s+/g, '')}`,
    paramExpr: expr.trim(),
    label: `Band ${Number(idxStr) + 1} ${offsetName}`,
  };
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
    // GetReducedFromX (a diferencia de ReduceFromX) NO muta nada: devuelve lo
    // que QUEDARÍA después de quitar la franja, sin tocar el rect original.
    // Es la mitad "de solo lectura" del mismo par que ReduceFromX — el estilo
    // `x = x.GetReducedFromLeft(n)` (reasignación funcional) logra el mismo
    // efecto que `x.ReduceFromLeft(n)` (mutación in-place) pero por fuera.
    case 'GetReducedFromTop': return { L: r.L, T: Math.min(r.T + args[0], r.B), R: r.R, B: r.B };
    case 'GetReducedFromBottom': return { L: r.L, T: r.T, R: r.R, B: Math.max(r.B - args[0], r.T) };
    case 'GetReducedFromLeft': return { L: Math.min(r.L + args[0], r.R), T: r.T, R: r.R, B: r.B };
    case 'GetReducedFromRight': return { L: r.L, T: r.T, R: Math.max(r.R - args[0], r.L), B: r.B };
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

type NumVars = Record<string, number>;

type Value = { kind: 'rect'; v: RectV } | { kind: 'num'; v: number };

/** Nombres de los métodos de IRECT que devuelven un NÚMERO (ancho/alto/centro)
 *  en vez de un sub-rect — terminan la cadena de encadenados en algo escalar,
 *  típicamente usado dentro de una cuenta como `inCell.MW() - 39.f`. */
function scalarRectMethod(r: RectV, method: string): number | null {
  switch (method) {
    case 'W': return r.R - r.L;
    case 'H': return r.B - r.T;
    case 'MW': return (r.L + r.R) / 2;
    case 'MH': return (r.T + r.B) / 2;
    default: return null;
  }
}

/**
 * Evalúa un valor (rect O número) al principio de `s`: un identificador
 * conocido (rect o número), `pGraphics->GetBounds()`, o un literal numérico,
 * seguido de una cadena de `.Metodo(args)` — cada método puede devolver otro
 * rect (GetFromX, GetPadded...) o, si es W/H/MW/MH, un número que termina la
 * cadena. Devuelve también `rest`: lo que quedó sin consumir, para que quien
 * llama pueda seguir leyendo operadores aritméticos (+, -, *, /) detrás.
 */
function evalValue(s: string, vars: Record<string, RectV>, numVars: NumVars, canvas: RectV): { value: Value; rest: string } {
  s = s.trim();

  const boundsRe = /^(?:[A-Za-z_]\w*\s*->\s*)?GetBounds\s*\(\s*\)/;
  const bm = s.match(boundsRe);
  let value: Value;
  let rest: string;

  if (bm) {
    value = { kind: 'rect', v: canvas };
    rest = s.slice(bm[0].length);
  } else {
    const numLit = s.match(/^\d+(\.\d*)?f?/);
    const im = s.match(/^[A-Za-z_]\w*/);
    if (im && vars[im[0]] !== undefined) {
      value = { kind: 'rect', v: vars[im[0]] };
      rest = s.slice(im[0].length);
    } else if (im && numVars[im[0]] !== undefined) {
      value = { kind: 'num', v: numVars[im[0]] };
      rest = s.slice(im[0].length);
    } else if (numLit) {
      value = { kind: 'num', v: parseFloat(numLit[0]) };
      rest = s.slice(numLit[0].length);
    } else {
      // No reconocido: mejor el lienzo completo (o 0) que romper la importación.
      return { value: { kind: 'rect', v: canvas }, rest: '' };
    }
  }

  rest = rest.trim();
  while (value.kind === 'rect' && rest.startsWith('.')) {
    const mm = rest.match(/^\.([A-Za-z_]\w*)\s*\(/);
    if (!mm) break;
    const openIdx = mm[0].length - 1;
    const closeIdx = matchClose(rest, openIdx);
    if (closeIdx === -1) break;
    const argsText = rest.slice(openIdx + 1, closeIdx);
    const args = splitTopLevel(argsText)
      .filter((a) => a.trim().length > 0)
      .map((a) => evalNumeric(a, vars, numVars, canvas));
    const scalar = scalarRectMethod(value.v, mm[1]);
    value = scalar !== null ? { kind: 'num', v: scalar } : { kind: 'rect', v: applyPure(value.v, mm[1], args) };
    rest = rest.slice(closeIdx + 1).trim();
  }
  return { value, rest };
}

/** Evalúa una expresión ARITMÉTICA (+, -, *, /) de valores numéricos, donde
 *  cada término puede ser un literal, una constante (`constexpr float X`) o
 *  un encadenado que TERMINA en un método escalar de IRECT (W/H/MW/MH) —
 *  p.ej. `knobRow.W() * 0.5f` o `inCell.MW() - 39.f`. Si el término es en
 *  realidad un rect (nadie lo redujo a número), se descarta como 0: no tiene
 *  sentido sumar/restar un rect entero. */
function evalNumeric(expr: string, vars: Record<string, RectV>, numVars: NumVars, canvas: RectV): number {
  let rem = expr.trim();

  const asNum = (v: Value): number => (v.kind === 'num' ? v.v : 0);

  function parseFactor(): number {
    let neg = false;
    while (rem.startsWith('-') || rem.startsWith('+')) {
      if (rem.startsWith('-')) neg = !neg;
      rem = rem.slice(1).trim();
    }
    // Subexpresión entre paréntesis, p.ej. `(650.f - headerHeight) / 4.f`.
    // Sin esto, cualquier constante `constexpr float` calculada así (muy
    // común para derivar tamaños a partir de otras constantes) evaluaba a 0
    // en silencio — y con eso, cualquier reducción que la usara "no reducía
    // nada", dejando todo apilado en el mismo lugar.
    if (rem.startsWith('(')) {
      const closeIdx = matchClose(rem, 0);
      if (closeIdx !== -1) {
        const inner = rem.slice(1, closeIdx);
        const val = evalNumeric(inner, vars, numVars, canvas);
        rem = rem.slice(closeIdx + 1).trim();
        return neg ? -val : val;
      }
    }
    const { value, rest } = evalValue(rem, vars, numVars, canvas);
    rem = rest.trim();
    const n = asNum(value);
    return neg ? -n : n;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (rem.startsWith('*') || rem.startsWith('/')) {
      const op = rem[0];
      rem = rem.slice(1).trim();
      const rhs = parseFactor();
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  }
  function parseExpr(): number {
    let v = parseTerm();
    while (rem.startsWith('+') || rem.startsWith('-')) {
      const op = rem[0];
      rem = rem.slice(1).trim();
      const rhs = parseTerm();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  const result = parseExpr();
  return Number.isFinite(result) ? result : 0;
}

/** Evalúa una expresión de lectura (nunca muta variables) que se espera
 *  resuelva a un RECT: identificador conocido o `pGraphics->GetBounds()`,
 *  seguido de una cadena de `.Metodo(args)`. */
function evalExpr(expr: string, vars: Record<string, RectV>, numVars: NumVars, canvas: RectV): RectV {
  const { value } = evalValue(expr, vars, numVars, canvas);
  return value.kind === 'rect' ? value.v : canvas;
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
function evalDeclRHS(rhs: string, vars: Record<string, RectV>, numVars: NumVars, canvas: RectV): RectV {
  const m = rhs.trim().match(BARE_REDUCE_RE);
  if (m) {
    const [, name, method, argsText] = m;
    const cur = vars[name];
    if (cur) {
      const args = splitTopLevel(argsText)
        .filter((a) => a.trim().length > 0)
        .map((a) => evalNumeric(a, vars, numVars, canvas));
      const { rect, removed } = applyReduce(cur, method, args);
      vars[name] = rect;
      return removed;
    }
  }
  return evalExpr(rhs, vars, numVars, canvas);
}

/**
 * Los constructores `IBKnobControl(x, y, bitmap, param)`/`IBSwitchControl(...)`
 * casi siempre posicionan el control centrado en un punto, restándole la
 * mitad de su propio tamaño: `celda.MW() - 39.f` (mitad de un knob de 78px).
 * Si detecta ese patrón en x y/o y, recupera el tamaño EXACTO (39*2=78) en
 * vez de adivinar — y solo cae a un tamaño por defecto razonable si no.
 */
function inferXYControlSize(xExpr: string, yExpr: string): { w: number; h: number } {
  const DEFAULT = 80;
  const mx = xExpr.match(/\.M[WH]\s*\(\s*\)\s*-\s*(\d+(?:\.\d+)?)/);
  const my = yExpr.match(/\.M[WH]\s*\(\s*\)\s*-\s*(\d+(?:\.\d+)?)/);
  const w = mx ? Math.round(parseFloat(mx[1]) * 2) : DEFAULT;
  const h = my ? Math.round(parseFloat(my[1]) * 2) : DEFAULT;
  return { w, h };
}

function handleAttachControl(
  inner: string,
  vars: Record<string, RectV>,
  numVars: NumVars,
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

  // IBKnobControl/IBSwitchControl reciben (x, y, bitmap, param) — dos floats
  // sueltos, no un IRECT — a diferencia de sus primos "vector"
  // (IVKnobControl/IVToggleControl/...) que sí reciben un rect entero.
  const rect = XY_BITMAP_TYPES.has(typeName) && ctorArgs.length >= 2
    ? (() => {
        const x = evalNumeric(ctorArgs[0], vars, numVars, canvas);
        const y = evalNumeric(ctorArgs[1], vars, numVars, canvas);
        const { w, h } = inferXYControlSize(ctorArgs[0], ctorArgs[1]);
        return { x: Math.round(x), y: Math.round(y), w, h };
      })()
    : toRect(evalExpr(ctorArgs[0], vars, numVars, canvas));
  if (rect.w <= 0 || rect.h <= 0) return;

  const tagArg = topArgs[1] && /^[A-Za-z_]\w*$/.test(topArgs[1].trim()) ? topArgs[1].trim() : undefined;
  // El parámetro cae en un índice distinto según la firma: (rect, param, ...)
  // para los controles "vector", (x, y, bitmap, param) para los "bitmap".
  const paramIdx = XY_BITMAP_TYPES.has(typeName) ? 3 : 1;
  const labelIdx = paramIdx + 1;
  const rawParamArg = ctorArgs[paramIdx]?.trim();
  const bareParamArg = rawParamArg && /^k[A-Za-z]\w*$/.test(rawParamArg) ? rawParamArg : undefined;
  // Sin tag suelto: puede ser un parámetro "compuesto" (`BandParam(0, kOffGain)`).
  const composite = !bareParamArg && rawParamArg ? matchCompositeParam(rawParamArg) : null;

  if ((KNOB_TYPES.has(typeName) || SWITCH_TYPES.has(typeName)) && (bareParamArg || composite)) {
    const paramId = composite ? composite.paramId : paramIdFromTag(bareParamArg!);
    const label = ctorArgs[labelIdx] ? unquote(ctorArgs[labelIdx]) : composite ? composite.label : paramId;
    controls.push({
      id: makeId(KNOB_TYPES.has(typeName) ? 'knob' : 'sw'),
      type: typeName as Control['type'],
      name: label || paramId,
      rect,
      paramId,
      ...(composite ? { paramExpr: composite.paramExpr } : {}),
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
    const numVars: NumVars = {};
    const controls: Control[] = [];
    const refBoxes: RefBox[] = [];

    // Reconoce, en este orden de prioridad en cada posición:
    //  1) `IRECT nombre = ...;`            declaración de rect
    //  2) `(const)? float nombre = ...;`   constante numérica (constexpr o no)
    //  3) `nombre.ReduceFromX(...)`        mutación in-place (estilo GhostDuck)
    //  4) `nombre = ...;`                  REASIGNACIÓN funcional (estilo MBC4:
    //     `header = header.GetReducedFromLeft(...)`) — solo cuenta si `nombre`
    //     ya es un rect conocido; si no, se ignora sin más (podría ser
    //     cualquier otra cosa, un contador de for, un miembro...).
    //  5) `AttachControl(`                 el control en sí.
    const re =
      /(?:(?:const\s+)?IRECT\s+(\w+)\s*=\s*)|(?:(?:constexpr\s+|const\s+)?float\s+(\w+)\s*=\s*)|(?:(\w+)\.(ReduceFrom(?:Top|Bottom|Left|Right))\s*\()|(?:(\w+)\s*=\s*(?!=))|(?:AttachControl\s*\()/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      if (m[1]) {
        const name = m[1];
        const rhsStart = re.lastIndex;
        const semiIdx = source.indexOf(';', rhsStart);
        if (semiIdx === -1) break;
        vars[name] = evalDeclRHS(source.slice(rhsStart, semiIdx), vars, numVars, canvas);
        re.lastIndex = semiIdx + 1;
      } else if (m[2]) {
        const name = m[2];
        const rhsStart = re.lastIndex;
        const semiIdx = source.indexOf(';', rhsStart);
        if (semiIdx === -1) break;
        numVars[name] = evalNumeric(source.slice(rhsStart, semiIdx), vars, numVars, canvas);
        re.lastIndex = semiIdx + 1;
      } else if (m[3]) {
        const name = m[3];
        const method = m[4];
        const openIdx = re.lastIndex - 1;
        const closeIdx = matchClose(source, openIdx);
        if (closeIdx === -1) break;
        const args = splitTopLevel(source.slice(openIdx + 1, closeIdx))
          .filter((a) => a.trim().length > 0)
          .map((a) => evalNumeric(a, vars, numVars, canvas));
        if (vars[name]) vars[name] = applyReduce(vars[name], method, args).rect;
        re.lastIndex = closeIdx + 1;
      } else if (m[5]) {
        // Reasignación (`nombre = ...;`): solo importa si `nombre` YA es un
        // rect conocido — si no, puede ser cualquier cosa (`int band = 0` de
        // un for, un miembro, etc.) y se deja pasar sin tocar `lastIndex` a
        // mano (el regex ya avanzó solo).
        const name = m[5];
        if (vars[name] !== undefined) {
          const rhsStart = re.lastIndex;
          const semiIdx = source.indexOf(';', rhsStart);
          if (semiIdx === -1) break;
          vars[name] = evalExpr(source.slice(rhsStart, semiIdx), vars, numVars, canvas);
          re.lastIndex = semiIdx + 1;
        }
      } else {
        const openIdx = re.lastIndex - 1;
        const closeIdx = matchClose(source, openIdx);
        if (closeIdx === -1) break;
        handleAttachControl(source.slice(openIdx + 1, closeIdx), vars, numVars, canvas, controls, refBoxes);
        re.lastIndex = closeIdx + 1;
      }
    }

    return { controls, refBoxes };
  } catch {
    return { controls: [], refBoxes: [] };
  }
}
