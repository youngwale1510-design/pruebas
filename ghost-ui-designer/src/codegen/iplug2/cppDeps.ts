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

import { Parser, Language, Node as TSNode } from 'web-tree-sitter';
import { RE } from '../markers';

let cppLang: Language | null = null;

/** Carga (una sola vez) el runtime de tree-sitter + la gramática de C++. */
async function loadCpp(): Promise<Language> {
  if (cppLang) return cppLang;
  await Parser.init();
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
 * Busca, en todo `source`, el statement que contiene un `identifier` cuyo
 * texto sea exactamente `anchor` (p.ej. el tag `kCtrlTagScope` que se pasa
 * como último argumento de `AttachControl`). Devuelve ese statement y todos
 * sus "hermanos" (statements del mismo bloque), en orden.
 */
async function findStatementByAnchor(source: string, anchor: string) {
  const lang = await loadCpp();
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(source);
  if (!tree) return null;

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
  walk(tree.rootNode);
  if (!anchorNode) return null;

  // Sube hasta el statement top-level (hijo directo de un compound_statement).
  let stmt: TSNode = anchorNode;
  while (stmt.parent && stmt.parent.type !== 'compound_statement') {
    stmt = stmt.parent;
  }
  const compound = stmt.parent;
  if (!compound) return null;

  const siblings = blockStatements(compound, source);
  const targetIdx = siblings.findIndex((s) => s.node.equals(stmt));
  if (targetIdx === -1) return null;

  return { siblings, targetIdx };
}

/**
 * Calcula el conjunto mínimo (conservador) de statements que hay que mover
 * junto con el que contiene `anchor` para no romper la compilación: el propio
 * statement, más cualquier statement ANTERIOR (en el mismo bloque) que
 * declare o mencione una variable que el objetivo — o algo ya incluido —
 * necesite. Devuelve los rangos en el orden en que aparecen en el archivo
 * (listos para extraer y volver a pegar en otro lado tal cual).
 */
export async function dependencyClosure(source: string, anchor: string): Promise<StatementSpan[] | null> {
  const found = await findStatementByAnchor(source, anchor);
  if (!found) return null;
  const { siblings, targetIdx } = found;

  // Universo de nombres que EN ALGÚN MOMENTO se declaran en este bloque
  // (variables locales de verdad, tipo `b`/`bounds`/`scopeRect`). Cualquier
  // otro identificador (el parámetro `pGraphics` de la lambda, miembros de la
  // clase como `mScope`, constantes globales como `kCtrlTagScope`) YA está
  // disponible sin importar dónde termine el statement — no hay que
  // "perseguir" una declaración anterior para esos, o se arrastraría de más
  // (pGraphics aparece en TODAS las líneas).
  const declarableUniverse = new Set<string>();
  for (const { node } of siblings) for (const n of declaredNames(node)) declarableUniverse.add(n);

  const included = new Set<number>([targetIdx]);
  const needed = new Set<string>();
  for (const id of freeIdentifiers(siblings[targetIdx].node)) {
    if (declarableUniverse.has(id)) needed.add(id);
  }
  // No perseguir nombres que el propio statement objetivo declara (poco común
  // pero por si acaso) — no aportan nada buscando hacia atrás.
  for (const n of declaredNames(siblings[targetIdx].node)) needed.delete(n);

  for (let i = targetIdx - 1; i >= 0; i--) {
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

  return [...included].sort((a, b) => a - b).map((i) => siblings[i].span);
}

export type MoveDirection = 'before' | 'after';

export interface MoveResult {
  source: string;
  /** false si el ancla no se encontró, o si ya estaba del lado pedido (no se tocó nada). */
  changed: boolean;
}

/**
 * Mueve el elemento (identificado por `anchor`, p.ej. un tag `kCtrlTagScope`)
 * junto con todo lo que necesite (ver `dependencyClosure`) a quedar ANTES de
 * `// [GHOST:LAYOUT BEGIN]` o DESPUÉS de `// [GHOST:LAYOUT END]`, según
 * `direction`. El resto del archivo no se toca.
 */
export async function moveElementInLayout(source: string, anchor: string, direction: MoveDirection): Promise<MoveResult> {
  const beginMatch = source.match(RE.layoutBegin);
  const endMatch = source.match(RE.layoutEnd);
  if (!beginMatch || !endMatch || beginMatch.index === undefined || endMatch.index === undefined) {
    return { source, changed: false };
  }

  const spans = await dependencyClosure(source, anchor);
  if (!spans || spans.length === 0) return { source, changed: false };

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
