import { describe, expect, it } from 'vitest';
import {
  shapeOutline, stackPieces, topZ, frameValues, knobAngle, lightPosition,
} from '../src/render3d/geometry';
import { defaultKnobConfig, applyQuickstart, KNOB_QUICKSTARTS } from '../src/model/knobConfig';
import { controlFrames } from '../src/codegen/iplug2/resources';
import { defaultKnob } from '../src/model/defaults';

describe('geometría 3D del knob', () => {
  it('shapeOutline: círculo y polígonos con el nº de puntos esperado', () => {
    expect(shapeOutline('ellipse', 1).length).toBe(96);
    expect(shapeOutline('triangle', 1).length).toBe(3);
    expect(shapeOutline('polygon', 1, { sides: 6 }).length).toBe(6);
    // todos los puntos dentro del radio
    for (const [x, y] of shapeOutline('scalloped', 1)) {
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('stackPieces apila en z sin solaparse y respeta "ninguno"', () => {
    const cfg = defaultKnobConfig();
    const pieces = stackPieces(cfg);
    expect(pieces.map((p) => p.slot)).toEqual(['base', 'mid', 'top']);
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i].z).toBeCloseTo(pieces[i - 1].z + pieces[i - 1].depth);
    }
    cfg.mid.shape = 'none';
    expect(stackPieces(cfg).map((p) => p.slot)).toEqual(['base', 'top']);
    expect(topZ(cfg)).toBeGreaterThan(0);
  });

  it('frameValues cubre 0..1 y knobAngle usa el barrido', () => {
    expect(frameValues(1)).toEqual([0]);
    const v = frameValues(5);
    expect(v[0]).toBe(0); expect(v[4]).toBe(1); expect(v[2]).toBeCloseTo(0.5);
    expect(knobAngle(0, 300)).toBe(-150);
    expect(knobAngle(1, 300)).toBe(150);
    expect(knobAngle(0.5, 300)).toBeCloseTo(0);
  });

  it('lightPosition invierte Y (pantalla) y sube con la elevación', () => {
    const a = lightPosition(0, 0);   // derecha, rasante
    expect(a[0]).toBeCloseTo(3);
    const hi = lightPosition(0, 1);  // más alta
    expect(hi[2]).toBeGreaterThan(a[2]);
    const down = lightPosition(90, 0.5); // ángulo 90 (abajo en pantalla) -> y negativa
    expect(down[1]).toBeLessThan(0);
  });
});

describe('config del knob y codegen', () => {
  it('quickstarts rellenan la config', () => {
    const cfg = applyQuickstart(defaultKnobConfig(), 'Cromo');
    expect(cfg.mid.material).toBe('chrome');
    expect(Object.keys(KNOB_QUICKSTARTS)).toContain('Chicken');
  });

  it('controlFrames prioriza los frames del knob 3D', () => {
    const c = defaultKnob('knob_x', 'X');
    expect(controlFrames(c)).toBe(61); // por props
    c.knob3d = { ...defaultKnobConfig(), frames: 96 };
    expect(controlFrames(c)).toBe(96);
  });
});
