// Alinear/distribuir/igualar tamaño entre varios controles, y ajustar a
// reglas/guías al arrastrar. Todo puro (sin store, sin DOM) para poder
// testearlo sin levantar la app.

export interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';

/** Caja que envuelve todos los rects (el "grupo" contra el que se alinea). */
function boundingBox(rects: RectLike[]): RectLike {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Devuelve, por cada rect (mismo orden que la entrada), el parche {x} o {y}
 * que lo alinea contra la caja que envuelve a todo el grupo — como
 * "Alinear" en Photoshop/Illustrator con varios objetos seleccionados.
 * Con un solo rect no hay nada que alinear (devuelve {}).
 */
export function alignRects(rects: RectLike[], kind: AlignKind): Array<{ x?: number; y?: number }> {
  if (rects.length < 2) return rects.map(() => ({}));
  const box = boundingBox(rects);
  return rects.map((r) => {
    switch (kind) {
      case 'left': return { x: box.x };
      case 'hcenter': return { x: Math.round(box.x + box.w / 2 - r.w / 2) };
      case 'right': return { x: box.x + box.w - r.w };
      case 'top': return { y: box.y };
      case 'vmiddle': return { y: Math.round(box.y + box.h / 2 - r.h / 2) };
      case 'bottom': return { y: box.y + box.h - r.h };
    }
  });
}

/**
 * Reparte el espacio sobrante en partes iguales entre los rects intermedios
 * (los dos extremos del eje elegido se quedan fijos). Necesita 3+ rects; con
 * menos no hay "intermedios" que mover (devuelve {} para todos).
 */
export function distributeRects(rects: RectLike[], axis: 'h' | 'v'): Array<{ x?: number; y?: number }> {
  const n = rects.length;
  if (n < 3) return rects.map(() => ({}));
  const order = rects
    .map((r, i) => ({ i, start: axis === 'h' ? r.x : r.y, size: axis === 'h' ? r.w : r.h }))
    .sort((a, b) => a.start - b.start);
  const first = order[0];
  const last = order[n - 1];
  // Espacio libre entre el borde derecho/inferior del primero y el borde
  // izquierdo/superior del último, repartido en huecos IGUALES entre los
  // n-1 tramos (primero->medio1, medio1->medio2, ..., últimoMedio->último).
  const availableSpace = last.start - (first.start + first.size);
  const sumMiddleSizes = order.slice(1, n - 1).reduce((sum, o) => sum + o.size, 0);
  const gap = (availableSpace - sumMiddleSizes) / (n - 1);
  const patches: Array<{ x?: number; y?: number }> = rects.map(() => ({}));
  let cursor = first.start + first.size + gap; // sin redondear, para no arrastrar error
  for (let k = 1; k < n - 1; k++) {
    const o = order[k];
    const pos = Math.round(cursor);
    patches[o.i] = axis === 'h' ? { x: pos } : { y: pos };
    cursor += o.size + gap;
  }
  return patches;
}

export type MatchDim = 'w' | 'h' | 'both';

/** Iguala el ancho/alto/ambos de todos los rects al del PRIMERO (la referencia). */
export function matchSizeRects(rects: RectLike[], dim: MatchDim): Array<{ w?: number; h?: number }> {
  if (rects.length < 2) return rects.map(() => ({}));
  const ref = rects[0];
  return rects.map((_, i) => {
    if (i === 0) return {};
    const patch: { w?: number; h?: number } = {};
    if (dim === 'w' || dim === 'both') patch.w = ref.w;
    if (dim === 'h' || dim === 'both') patch.h = ref.h;
    return patch;
  });
}

export interface Guides {
  h: number[]; // líneas horizontales: Y constante
  v: number[]; // líneas verticales: X constante
}

/**
 * Ajusta (x,y) al valor cercano (dentro de `threshold` px) de una guía o del
 * borde/centro de otro control, en cada eje por separado. Snapea los bordes
 * izq/centro/der del rect que se mueve contra cada candidato del eje X, e
 * igual arriba/medio/abajo en Y. Puro: no muta nada, solo calcula.
 */
export function snapRect(
  rect: RectLike,
  guides: Guides,
  others: RectLike[],
  threshold = 6,
): { x: number; y: number } {
  const xCandidates = [...guides.v];
  const yCandidates = [...guides.h];
  for (const o of others) {
    xCandidates.push(o.x, o.x + o.w / 2, o.x + o.w);
    yCandidates.push(o.y, o.y + o.h / 2, o.y + o.h);
  }

  const snapAxis = (pos: number, size: number, candidates: number[]): number => {
    const edges = [pos, pos + size / 2, pos + size]; // izq/centro/der (o arriba/medio/abajo)
    let best = pos;
    let bestDist = threshold + 1;
    for (const edge of edges) {
      for (const c of candidates) {
        const d = Math.abs(edge - c);
        if (d < bestDist) {
          bestDist = d;
          best = pos + (c - edge);
        }
      }
    }
    return bestDist <= threshold ? best : pos;
  };

  return {
    x: snapAxis(rect.x, rect.w, xCandidates),
    y: snapAxis(rect.y, rect.h, yCandidates),
  };
}
