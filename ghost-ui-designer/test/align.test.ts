import { describe, expect, it } from 'vitest';
import { alignRects, distributeRects, matchSizeRects, normalizeMarquee, rectsIntersect, snapRect } from '../src/app/align';

describe('alignRects', () => {
  const rects = [
    { x: 10, y: 10, w: 20, h: 40 },
    { x: 100, y: 50, w: 60, h: 10 },
    { x: 50, y: 200, w: 10, h: 10 },
  ];
  it('un solo rect no cambia nada', () => {
    expect(alignRects([rects[0]], 'left')).toEqual([{}]);
  });
  it('left: todos al borde izquierdo del grupo', () => {
    const p = alignRects(rects, 'left');
    expect(p.map((x) => x.x)).toEqual([10, 10, 10]);
  });
  it('right: el borde derecho de cada uno coincide con el borde derecho del grupo', () => {
    // bbox derecho = max(10+20, 100+60, 50+10) = 160
    const p = alignRects(rects, 'right');
    p.forEach((patch, i) => expect(patch.x! + rects[i].w).toBe(160));
  });
  it('hcenter: el centro de cada uno coincide con el centro del grupo', () => {
    const p = alignRects(rects, 'hcenter');
    const box = { x: 10, w: 150 }; // bbox x:10..160
    const centerBox = box.x + box.w / 2;
    p.forEach((patch, i) => expect(patch.x! + rects[i].w / 2).toBeCloseTo(centerBox, 0));
  });
  it('top/bottom/vmiddle son el equivalente vertical', () => {
    const top = alignRects(rects, 'top');
    expect(top.map((x) => x.y)).toEqual([10, 10, 10]);
    const bottom = alignRects(rects, 'bottom');
    // bbox bottom = max(10+40, 50+10, 200+10) = 210
    bottom.forEach((patch, i) => expect(patch.y! + rects[i].h).toBe(210));
  });
});

describe('distributeRects', () => {
  it('con menos de 3 rects no hace nada', () => {
    const r = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 0, w: 10, h: 10 }];
    expect(distributeRects(r, 'h')).toEqual([{}, {}]);
  });
  it('reparte huecos iguales entre los extremos (eje horizontal)', () => {
    // extremos en x=0 (w=10) y x=100 (w=10); uno en medio de tamaño 20.
    const r = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 40, y: 0, w: 20, h: 10 },
      { x: 100, y: 0, w: 10, h: 10 },
    ];
    const p = distributeRects(r, 'h');
    // espacio libre entre borde der. del primero (10) y borde izq. del último (100) = 90
    // menos el tamaño del medio (20) = 70, entre 2 huecos = 35 cada uno.
    expect(p[1].x).toBe(10 + 35);
    expect(p[0]).toEqual({});
    expect(p[2]).toEqual({});
  });
  it('deja huecos visualmente iguales entre bordes consecutivos', () => {
    const r = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 30, y: 0, w: 10, h: 10 },
      { x: 60, y: 0, w: 10, h: 10 },
      { x: 100, y: 0, w: 10, h: 10 },
    ];
    const p = distributeRects(r, 'h');
    const x1 = p[1].x!, x2 = p[2].x!;
    const gapA = x1 - (0 + 10);
    const gapB = x2 - (x1 + 10);
    const gapC = 100 - (x2 + 10);
    // Con posiciones en px enteros, un reparto no exacto puede diferir en 1px
    // entre huecos (igual que Illustrator/Photoshop); no más que eso.
    expect(Math.abs(gapA - gapB)).toBeLessThanOrEqual(1);
    expect(Math.abs(gapB - gapC)).toBeLessThanOrEqual(1);
  });
  it('funciona en el eje vertical', () => {
    const r = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 0, y: 45, w: 10, h: 10 },
      { x: 0, y: 100, w: 10, h: 10 },
    ];
    const p = distributeRects(r, 'v');
    expect(p[1].y).toBeCloseTo(50, 0);
    expect(p[0].y).toBeUndefined();
  });
});

describe('matchSizeRects', () => {
  const rects = [
    { x: 0, y: 0, w: 50, h: 60 },
    { x: 10, y: 10, w: 10, h: 10 },
    { x: 20, y: 20, w: 200, h: 5 },
  ];
  it('un solo rect no cambia nada', () => {
    expect(matchSizeRects([rects[0]], 'both')).toEqual([{}]);
  });
  it('iguala al primero (referencia); el primero nunca cambia', () => {
    const p = matchSizeRects(rects, 'both');
    expect(p[0]).toEqual({});
    expect(p[1]).toEqual({ w: 50, h: 60 });
    expect(p[2]).toEqual({ w: 50, h: 60 });
  });
  it('solo ancho o solo alto cuando se pide', () => {
    expect(matchSizeRects(rects, 'w')[1]).toEqual({ w: 50 });
    expect(matchSizeRects(rects, 'h')[1]).toEqual({ h: 60 });
  });
});

describe('snapRect', () => {
  it('se pega a una guía vertical si está dentro del umbral', () => {
    const r = { x: 103, y: 50, w: 20, h: 20 }; // borde izq en 103, guía en 100
    const out = snapRect(r, { h: [], v: [100] }, [], 6);
    expect(out.x).toBe(100);
    expect(out.y).toBe(50);
  });
  it('no se pega si está fuera del umbral', () => {
    const r = { x: 120, y: 50, w: 20, h: 20 };
    const out = snapRect(r, { h: [], v: [100] }, [], 6);
    expect(out.x).toBe(120);
  });
  it('se pega al centro de otro control', () => {
    // otro control: x=0,w=100 -> centro en 50. Este control w=20, su centro
    // debe caer en 50 -> x = 50 - 10 = 40.
    const r = { x: 44, y: 0, w: 20, h: 20 };
    const other = { x: 0, y: 0, w: 100, h: 20 };
    const out = snapRect(r, { h: [], v: [] }, [other], 6);
    expect(out.x).toBe(40);
  });
  it('se pega al borde derecho de otro control', () => {
    const other = { x: 0, y: 0, w: 60, h: 20 }; // borde derecho en 60
    const r = { x: 62, y: 0, w: 20, h: 20 }; // borde izq en 62
    const out = snapRect(r, { h: [], v: [] }, [other], 6);
    expect(out.x).toBe(60);
  });
  it('ejes independientes: puede pegar X sin pegar Y', () => {
    const out = snapRect({ x: 101, y: 500, w: 10, h: 10 }, { h: [50], v: [100] }, [], 6);
    expect(out.x).toBe(100);
    expect(out.y).toBe(500);
  });
});

describe('rectsIntersect / normalizeMarquee (selección por arrastre)', () => {
  it('detecta solape', () => {
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });
  it('detecta que NO se tocan', () => {
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false);
  });
  it('un rect completamente dentro de otro también cuenta', () => {
    expect(rectsIntersect({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(true);
  });
  it('normaliza sin importar la dirección del arrastre', () => {
    expect(normalizeMarquee(50, 50, 10, 10)).toEqual({ x: 10, y: 10, w: 40, h: 40 });
    expect(normalizeMarquee(10, 10, 50, 50)).toEqual({ x: 10, y: 10, w: 40, h: 40 });
  });
});
