// Análisis de dependencias entre statements de C++ usando un parser DE VERDAD
// (tree-sitter, vía WASM — corre en el proceso de Electron sin necesitar un
// compilador). Esto es lo que hace falta para poder mover UN SOLO elemento
// escrito a mano (p.ej. "el Scope") antes/después de la zona de Ghost sin
// romper la compilación: hay que arrastrar con él cualquier declaración o
// mutación previa de una variable que use (`bounds`, `b`, etc.), pero SOLO
// esas — no todo el bloque completo.
//
// El algoritmo es deliberadamente conservador (puede incluir de más, nunca de
// menos): caminando hacia atrás desde el statement objetivo, cualquier
// statement anterior en el MISMO bloque que mencione una variable que ya
// necesitamos se suma al conjunto, y sus propias variables se vuelven
// "necesarias" también. Como es más grave romper la compilación que mover un
// par de líneas de más, ante la duda se incluye.

import path from 'node:path';
import { Parser, Language, Node as TSNode } from 'web-tree-sitter';
import { RE } from '../markers';

let cppLang: Language | null = null;

/** Carga (una sola vez) el runtime de tree-sitter + la gramática de C++. */
async function loadCpp(): Promise<Language> {
  if (cppLang) return cppLang;

  // `web-tree-sitter` intenta ubicar su propio `tree-sitter.wasm` "al lado"
  // del JS que lo ejecuta (mirando `import.meta.url`). Eso funciona en un
  // proyecto normal, pero acá el `.ts` de Electron se empaqueta en un solo
  // `dist-electron/main.js` con Rollup — el wasm real sigue en
  // `node_modules/web-tree-sitter/`, no al lado del bundle. Sin decirle
  // dónde buscar, `Parser.init()` falla en silencio (o revienta) y CUALQUIER
  // exportación que intente mover un elemento (`moveElementInLayout`) se cae.
  // Se le pasa `locateFile` apuntando a la ubicación real en disco.
  //
  // OJO: no se puede usar `require.resolve('web-tree-sitter/tree-sitter.wasm')`
  // — el `exports` del package.json de esta versión no expone ese subpath (y
  // el que sí declara, `web-tree-sitter.wasm`, no existe como archivo). Por
  // eso se resuelve el propio paquete (que sí es un export válido) y se arma
  // la ruta al `.wasm` real a mano desde su carpeta.
  const wasmDir = path.dirname(require.resolve('web-tree-sitter'));
  await Parser.init({ locateFile: (file: string) => path.join(wasmDir, file) });

  const wasmPath = require.resolve('tree-sitter-cpp/tree-sitter-cpp.wasm');
  cppLang = await Language.load(wasmPath);
  return cppLang;
}

export interface StatementSpan {
  start: number;
  end: number;
  text: string;
}

/** Identificadores "libres" que un nodo referencia: NO cuenta lo que va
 *  después de `.`/`->` (miembros/métodos, ej. `ReduceFromTop` en `b.Reduce...`)
 *  ni nombres de tipo (`IRECT`, `IGDuckScopeControl`...), porque esos no son
 *  variables locales cuya declaración haya que arrastrar. */
function freeIdentifiers(node: TSNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: TSNode) => {
    if (n.type === 'identifier') {
      ids.add(n.text);
      return; // un identifier no tiene hijos relevantes
    }
    // No bajar a los nombres de campo/miembro ni de tipo: no son variables.
    if (n.type === 'field_identifier' || n.type === 'type_identifier') return;
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i);
      if (c) walk(c);
    }
  };
  walk(node);
  return ids;
}

/** Nombres que un statement DECLARA (nuevas variables), para saber cuándo un
 *  statement anterior "satisface" la necesidad de una variable. Busca
 *  cualquier `declaration` dentro del nodo (normalmente es el propio nodo,
 *  p.ej. `IRECT b = bounds;`) y toma el identificador de cada declarator. */
function declaredNames(node: TSNode): Set<string> {
  const names = new Set<string>();
  const collectFromDeclaration = (decl: TSNode) => {
    for (let i = 0; i < decl.childCount; i++) {
      const c = decl.child(i);
      if (!c) continue;
      if (c.type === 'identifier') { names.add(c.text); continue; }
      if (c.type === 'init_declarator') {
        const id = c.childForFieldName('declarator');
        if (id && id.type === 'identifier') names.add(id.text);
      }
    }
  };
  const walk = (n: TSNode) => {
    if (n.type === 'declaration') collectFromDeclaration(n);
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i);
      if (c) walk(c);
    }
  };
  walk(node);
  return names;
}

/** Statements top-level directos de un bloque `{ ... }` (compound_statement),
 *  en orden de aparición, cada uno con su rango de bytes y texto. */
function blockStatements(compound: TSNode, source: string): { node: TSNode; span: StatementSpan }[] {
  const out: { node: TSNode; span: StatementSpan }[] = [];
  for (let i = 0; i < compound.childCount; i++) {
    const c = compound.child(i);
    if (!c || c.type === '{' || c.type === '}') continue;
    out.push({ node: c, span: { start: c.startIndex, end: c.endIndex, text: source.slice(c.startIndex, c.endIndex) } });
  }
  return out;
}

/**
 * Busca, en un árbol ya parseado, el nodo que corresponde a `anchor`. Dos
 * formas de anclar, en este orden:
 *  1) Como IDENTIFICADOR exacto (p.ej. el tag `kCtrlTagScope` que se pasa
 *     como último argumento de `AttachControl`) — es lo más fiable porque un
 *     identificador no puede aparecer "a medias" en otro lado.
 *  2) Si no hay ningún identificador con ese texto (el control no tiene tag,
 *     algo muy común en código escrito a mano), como FRAGMENTO LITERAL: se
 *     busca ese texto tal cual en el archivo (p.ej. el propio
 *     `new IGDuckScopeControl(scopeRect)`) y se usa el nodo que hay en esa
 *     posición. Esto es lo que permite reordenar también elementos sin tag.
 */
function findAnchorNode(root: TSNode, source: string, anchor: string): TSNode | null {
  let anchorNode: TSNode | null = null;
  const walk = (n: TSNode) => {
    if (anchorNode) return;
    if (n.type === 'identifier' && n.text === anchor) {
      anchorNode = n;
      return;
    }
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i);
      if (c) walk(c);
      if (anchorNode) return;
    }
  };
  walk(root);

  if (!anchorNode) {
    const idx = source.indexOf(anchor);
    if (idx !== -1) {
      anchorNode = root.descendantForIndex(idx, idx + anchor.length);
    }
  }
  return anchorNode;
}

interface Closure {
  siblings: { node: TSNode; span: StatementSpan }[];
  included: Set<number>;
  /** Nombres que la cerradura necesitaba pero para los que NUNCA encontró una
   *  declaración anterior en el mismo bloque — p.ej. porque esa declaración
   *  ya se movió a otro lado en un paso previo del mismo export. Si esto no
   *  está vacío, la cerradura está INCOMPLETA: moverla dejaría al propio
   *  contenido movido usando una variable que no existe en su nueva
   *  posición. Nunca hay que mover/borrar algo así. */
  unresolved: Set<string>;
}

interface AnchoredStatements {
  siblings: { node: TSNode; span: StatementSpan }[];
  targetIdxs: number[];
}

/**
 * Ubica, dentro del mismo bloque `{ ... }`, el statement top-level de cada
 * uno de `anchors`. Si alguno no se encuentra, o si no todos caen en el
 * mismo bloque (un movimiento/borrado conjunto no tiene sentido entre
 * funciones distintas), devuelve null.
 */
async function findAnchorStatements(source: string, anchors: string[]): Promise<AnchoredStatements | null> {
  const lang = await loadCpp();
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(source);
  if (!tree) return null;

  let siblings: { node: TSNode; span: StatementSpan }[] | null = null;
  const targetIdxs: number[] = [];

  for (const anchor of anchors) {
    const anchorNode = findAnchorNode(tree.rootNode, source, anchor);
    if (!anchorNode) return null;

    // Sube hasta el statement top-level (hijo directo de un compound_statement).
    let stmt: TSNode = anchorNode;
    while (stmt.parent && stmt.parent.type !== 'compound_statement') {
      stmt = stmt.parent;
    }
    const compound = stmt.parent;
    if (!compound) return null;

    const sibs = blockStatements(compound, source);
    const idx = sibs.findIndex((s) => s.node.equals(stmt));
    if (idx === -1) return null;

    if (siblings === null) {
      siblings = sibs;
    } else if (siblings.length !== sibs.length || siblings[0]?.span.start !== sibs[0]?.span.start) {
      // Los anchors están en bloques distintos — un movimiento/borrado
      // conjunto no tiene sentido acá (no es el mismo lambda/función).
      return null;
    }
    targetIdxs.push(idx);
  }
  if (!siblings) return null;
  return { siblings, targetIdxs };
}

/**
 * Calcula el conjunto mínimo (conservador) de statements que hay que mover
 * junto con los que contienen cada uno de `anchors` para no romper la
 * compilación: los statements objetivo, más cualquier statement ANTERIOR (en
 * el mismo bloque) que declare o mencione una variable que algún objetivo —
 * o algo ya incluido — necesite. Solo tiene sentido para MOVER (el objetivo
 * sigue existiendo después, así que sus propias dependencias hay que
 * conservarlas) — para BORRAR se usa un análisis más simple, ver
 * `removeElementFromSource`.
 */
async function computeClosureForAnchors(source: string, anchors: string[]): Promise<Closure | null> {
  const found = await findAnchorStatements(source, anchors);
  if (!found) return null;
  const { siblings, targetIdxs } = found;

  // Universo de nombres que EN ALGÚN MOMENTO se declaran en este bloque
  // (variables locales de verdad, tipo `b`/`bounds`/`scopeRect`). Cualquier
  // otro identificador (el parámetro `pGraphics` de la lambda, miembros de la
  // clase como `mScope`, constantes globales como `kCtrlTagScope`) YA está
  // disponible sin importar dónde termine el statement — no hay que
  // "perseguir" una declaración anterior para esos, o se arrastraría de más
  // (pGraphics aparece en TODAS las líneas).
  const declarableUniverse = new Set<string>();
  for (const { node } of siblings) for (const n of declaredNames(node)) declarableUniverse.add(n);

  const included = new Set<number>(targetIdxs);
  const needed = new Set<string>();
  for (const idx of targetIdxs) {
    for (const id of freeIdentifiers(siblings[idx].node)) {
      if (declarableUniverse.has(id)) needed.add(id);
    }
  }
  // No perseguir nombres que los propios statements objetivo declaran (poco
  // común pero por si acaso) — no aportan nada buscando hacia atrás.
  for (const idx of targetIdxs) for (const n of declaredNames(siblings[idx].node)) needed.delete(n);

  const maxTarget = Math.max(...targetIdxs);
  for (let i = maxTarget - 1; i >= 0; i--) {
    if (included.has(i)) {
      // Ya incluido (es otro de los anchors pedidos, u otro que ya se sumó):
      // sus propios usos también hay que satisfacerlos buscando más atrás.
      for (const id of freeIdentifiers(siblings[i].node)) if (declarableUniverse.has(id)) needed.add(id);
      for (const id of declaredNames(siblings[i].node)) needed.delete(id);
      continue;
    }
    const { node } = siblings[i];
    const decl = declaredNames(node);
    const uses = freeIdentifiers(node);
    const relevant = [...decl, ...uses].some((name) => needed.has(name));
    if (!relevant) continue;
    included.add(i);
    for (const id of uses) if (declarableUniverse.has(id)) needed.add(id);
    // Los nombres que ESTE statement declara ya quedan "satisfechos": no hace
    // falta seguir buscando una declaración anterior para ellos.
    for (const id of decl) needed.delete(id);
  }

  // Lo que siga en `needed` a esta altura es una variable que la cerradura
  // usa pero cuya declaración NUNCA apareció antes en el bloque (se buscó
  // hasta el principio). Puede pasar si esa declaración ya se movió a otro
  // lado en un paso anterior del mismo export — la cerradura quedaría
  // incompleta y moverla/borrarla la dejaría rota en su nueva posición.
  return { siblings, included, unresolved: needed };
}

/**
 * Si alguno de los statements que se moverían DECLARA una variable que otro
 * statement del mismo bloque — antes, en medio o después, se mueva o no —
 * también usa o vuelve a declarar, moverla la deja "huérfana" ahí: ese otro
 * código dejaría de compilar (`'b': identificador no declarado`). Es
 * justamente el caso real de GhostDuck: `b` se declara una vez y la van
 * mutando/leyendo el header, el kick indicator, el scope Y el código de
 * después — mover solo el statement del scope (que arrastra la declaración
 * de `b` porque la necesita) deja sin `b` a todo lo que se queda donde está.
 * Devuelve el primer nombre así de "compartido", o null si mover es seguro.
 */
function findUnsharableName(closure: Closure): string | null {
  const { siblings, included } = closure;
  const declaredByClosure = new Set<string>();
  for (const i of included) for (const n of declaredNames(siblings[i].node)) declaredByClosure.add(n);
  if (declaredByClosure.size === 0) return null;

  for (let i = 0; i < siblings.length; i++) {
    if (included.has(i)) continue;
    const { node } = siblings[i];
    for (const n of freeIdentifiers(node)) if (declaredByClosure.has(n)) return n;
    for (const n of declaredNames(node)) if (declaredByClosure.has(n)) return n;
  }
  return null;
}

/**
 * Calcula el conjunto mínimo (conservador) de statements que hay que mover
 * junto con el que contiene `anchor` para no romper la compilación (ver
 * `computeClosureForAnchors`). Devuelve los rangos en el orden en que
 * aparecen en el archivo (listos para extraer y volver a pegar en otro lado
 * tal cual).
 */
export async function dependencyClosure(source: string, anchor: string): Promise<StatementSpan[] | null> {
  const closure = await computeClosureForAnchors(source, [anchor]);
  if (!closure) return null;
  return [...closure.included].sort((a, b) => a - b).map((i) => closure.siblings[i].span);
}

export type MoveDirection = 'before' | 'after';

export interface MoveResult {
  source: string;
  /** false si el ancla no se encontró, si ya estaba del lado pedido, o si el
   *  movimiento no era seguro (ver `blockedReason`) — en todos esos casos no
   *  se tocó nada. */
  changed: boolean;
  /** Por qué NO se movió a pesar de haberse encontrado el ancla: una variable
   *  que también usa/declara otro código que se queda donde está (ver
   *  `findUnsharableName`). Ausente cuando `changed` es true o cuando
   *  simplemente no hacía falta moverlo. */
  blockedReason?: string;
}

/**
 * Mueve TODOS los elementos identificados por `anchors` (p.ej. varios tags
 * de control) JUNTOS, con todo lo que necesiten entre todos (ver
 * `computeClosureForAnchors`), a quedar ANTES de `// [GHOST:LAYOUT BEGIN]` o
 * DESPUÉS de `// [GHOST:LAYOUT END]`, según `direction`. El resto del
 * archivo no se toca. Moverlos juntos (en vez de uno por uno) es lo que
 * permite mover, por ejemplo, el Scope Y el Kick Indicator cuando ambos
 * comparten una misma variable (`b`) que nadie más usa: por separado cada
 * uno se vería bloqueado porque el otro (que se quedaría donde está)
 * también la necesita, pero moviéndolos a la vez ninguno se queda atrás. Si
 * aun así arrastraría una variable que otro código (que sí se queda) también
 * necesita, NO se mueve nada — se prefiere dejarlo como estaba a entregar un
 * .cpp que no compila.
 */
export async function moveElementsInLayout(source: string, anchors: string[], direction: MoveDirection): Promise<MoveResult> {
  const beginMatch = source.match(RE.layoutBegin);
  const endMatch = source.match(RE.layoutEnd);
  if (!beginMatch || !endMatch || beginMatch.index === undefined || endMatch.index === undefined) {
    return { source, changed: false };
  }

  const closure = await computeClosureForAnchors(source, anchors);
  if (!closure) return { source, changed: false };

  if (closure.unresolved.size > 0) {
    const [name] = closure.unresolved;
    return {
      source,
      changed: false,
      blockedReason: `no se encontró antes, en el mismo bloque, dónde se declara "${name}" (¿ya se movió en otro paso de este export?); moverlo así podría dejarlo roto.`,
    };
  }

  const unsharable = findUnsharableName(closure);
  if (unsharable) {
    return {
      source,
      changed: false,
      blockedReason: `"${unsharable}" también la usa otro código que se queda donde está; moverlo lo rompería.`,
    };
  }

  const spans = [...closure.included].sort((a, b) => a - b).map((i) => closure.siblings[i].span);
  if (spans.length === 0) return { source, changed: false };

  const firstStart = spans[0].start;
  const lastEnd = spans[spans.length - 1].end;
  const currentlyBefore = lastEnd <= beginMatch.index;
  const currentlyAfter = firstStart >= endMatch.index;
  if ((direction === 'before' && currentlyBefore) || (direction === 'after' && currentlyAfter)) {
    return { source, changed: false }; // ya está del lado pedido
  }

  // Arma el bloque a reinsertar SOLO con los spans de la cerradura, cada uno
  // tal cual — NO con todo lo que hay entre el primero y el último: entre
  // medio puede haber statements no relacionados (p.ej. el texto del header)
  // que deben quedarse donde estaban.
  const block = spans.map((s) => s.text).join('\n');

  // Saca cada span de su posición actual (dejando el resto intacto).
  let withoutBlock = '';
  let cursor = 0;
  for (const sp of spans) {
    withoutBlock += source.slice(cursor, sp.start);
    cursor = sp.end;
  }
  withoutBlock += source.slice(cursor);

  // Los índices de los marcadores corren según cuánto de lo sacado estaba
  // antes de cada uno.
  const shiftFor = (idx: number): number =>
    spans.reduce((acc, sp) => (sp.end <= idx ? acc + (sp.end - sp.start) : acc), 0);
  const beginIdx = beginMatch.index - shiftFor(beginMatch.index);
  const endIdx = endMatch.index - shiftFor(endMatch.index);

  let out: string;
  if (direction === 'before') {
    // Justo antes de la línea del marcador BEGIN.
    const lineStart = withoutBlock.lastIndexOf('\n', beginIdx) + 1;
    out = withoutBlock.slice(0, lineStart) + block.trimEnd() + '\n\n' + withoutBlock.slice(lineStart);
  } else {
    // Justo después de la línea del marcador END.
    const lineEnd = withoutBlock.indexOf('\n', endIdx);
    const insertAt = lineEnd === -1 ? withoutBlock.length : lineEnd + 1;
    out = withoutBlock.slice(0, insertAt) + '\n' + block.trimEnd() + '\n' + withoutBlock.slice(insertAt);
  }

  return { source: out, changed: true };
}

/** Mueve UN SOLO elemento — ver `moveElementsInLayout` para el caso general
 *  (mover varios juntos, útil cuando comparten una variable). */
export async function moveElementInLayout(source: string, anchor: string, direction: MoveDirection): Promise<MoveResult> {
  return moveElementsInLayout(source, [anchor], direction);
}

export interface RemoveResult {
  source: string;
  /** false si el ancla no se encontró o si borrarlo no era seguro (ver `blockedReason`). */
  changed: boolean;
  /** Por qué NO se borró: una variable que también usa/declara otro código
   *  que se quedaría (ver `findUnsharableName`). */
  blockedReason?: string;
}

/**
 * Borra del archivo el ÚNICO statement identificado por `anchor` — p.ej. el
 * texto de un header que ya no hace falta porque se rediseñó en Ghost. A
 * diferencia de mover, borrar NO arrastra nada hacia atrás: como el
 * statement desaparece, sus propias dependencias (lo que él necesitaba) ya
 * no le hacen falta a nadie por su culpa. El único riesgo es al revés: si
 * ESTE statement declara una variable que OTRO código (que se queda) también
 * usa o vuelve a declarar, borrarlo lo dejaría sin ella — en ese caso no se
 * borra nada, igual que con el movimiento, y se devuelve el motivo.
 */
export async function removeElementFromSource(source: string, anchor: string): Promise<RemoveResult> {
  const found = await findAnchorStatements(source, [anchor]);
  if (!found) return { source, changed: false };
  const { siblings, targetIdxs } = found;
  const targetIdx = targetIdxs[0];

  const declaredByTarget = declaredNames(siblings[targetIdx].node);
  if (declaredByTarget.size > 0) {
    for (let i = 0; i < siblings.length; i++) {
      if (i === targetIdx) continue;
      const { node } = siblings[i];
      for (const n of freeIdentifiers(node)) {
        if (declaredByTarget.has(n)) {
          return {
            source,
            changed: false,
            blockedReason: `"${n}" también la usa otro código que se quedaría; no se puede borrar sin romperlo.`,
          };
        }
      }
      for (const n of declaredNames(node)) {
        if (declaredByTarget.has(n)) {
          return {
            source,
            changed: false,
            blockedReason: `"${n}" también la usa otro código que se quedaría; no se puede borrar sin romperlo.`,
          };
        }
      }
    }
  }

  const span = siblings[targetIdx].span;
  const out = source.slice(0, span.start) + source.slice(span.end);
  return { source: out, changed: true };
}
