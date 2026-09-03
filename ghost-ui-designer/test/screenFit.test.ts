import { describe, expect, it } from 'vitest';
import { fitWithinScreen } from '../src/app/screenFit';

describe('fitWithinScreen — el 100% nunca supera lo que cabe en pantalla', () => {
  it('deja el tamaño igual si ya cabe', () => {
    expect(fitWithinScreen(800, 600, { width: 1600, height: 900 })).toEqual({ width: 800, height: 600 });
  });

  it('escala hacia abajo conservando proporción cuando una imagen es más grande que la pantalla', () => {
    // Imagen 4000x2000 (2:1) en una pantalla de 1600x900 -> el ancho manda.
    const r = fitWithinScreen(4000, 2000, { width: 1600, height: 900 });
    expect(r.width).toBe(1600);
    expect(r.height).toBe(800); // conserva la proporción 2:1
  });

  it('cuando el alto es el que sobra, el alto manda', () => {
    // 1000x2000 (1:2) en 1600x900 -> el alto es el límite.
    const r = fitWithinScreen(1000, 2000, { width: 1600, height: 900 });
    expect(r.height).toBe(900);
    expect(r.width).toBe(450);
  });

  it('nunca deja 0 ni negativos', () => {
    const r = fitWithinScreen(1, 1, { width: 1600, height: 900 });
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});
