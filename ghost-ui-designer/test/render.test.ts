import { describe, expect, it } from 'vitest';
import { resolveLight, rotationForValue, shadowOffset } from '../src/render/light';
import { layerBox } from '../src/render/renderControl';
import {
  filmstripLayout,
  frameOrigin,
  valueForFrame,
} from '../src/render/filmstrip';
import {
  bitmapResId,
  bitmapFile,
  collectBitmapResources,
  controlFrames,
  generateResourcesHeader,
} from '../src/codegen/iplug2/resources';
import { emptyScene, defaultKnob, defaultKnobLayers } from '../src/model/defaults';

describe('luz global', () => {
  it('vector de luz y offset de sombra', () => {
    const v = resolveLight({ angleDeg: 0, intensity: 1 });
    expect(v.dx).toBeCloseTo(1);
    expect(v.dy).toBeCloseTo(0);
    const off = shadowOffset({ angleDeg: 90, intensity: 1 }, 10);
    expect(off.x).toBeCloseTo(0);
    expect(off.y).toBeCloseTo(10);
  });

  it('rotación por valor mapea el barrido', () => {
    expect(rotationForValue(0)).toBe(-135);
    expect(rotationForValue(1)).toBe(135);
    expect(rotationForValue(0.5)).toBeCloseTo(0);
  });
});

describe('geometría de capa', () => {
  it('rectNorm tiene prioridad sobre inset', () => {
    const box = layerBox(100, 100, {
      id: 'x', name: 'x', kind: 'shape', visible: true, blendMode: 'normal',
      opacity: 1, effects: [], rectNorm: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, inset: 0.3,
    });
    expect(box).toEqual({ x: 10, y: 20, w: 50, h: 50 });
  });

  it('inset simétrico usa la dimensión menor', () => {
    const box = layerBox(200, 100, {
      id: 'x', name: 'x', kind: 'shape', visible: true, blendMode: 'normal',
      opacity: 1, effects: [], inset: 0.1,
    });
    expect(box).toEqual({ x: 10, y: 10, w: 180, h: 80 });
  });
});

describe('filmstrip', () => {
  it('layout vertical y horizontal', () => {
    const v = filmstripLayout(4, 80, 60, 'vertical');
    expect(v.sheetW).toBe(80);
    expect(v.sheetH).toBe(240);
    const h = filmstripLayout(4, 80, 60, 'horizontal');
    expect(h.sheetW).toBe(320);
    expect(h.sheetH).toBe(60);
  });

  it('origen de frame y valor por frame', () => {
    const layout = filmstripLayout(3, 50, 50, 'vertical');
    expect(frameOrigin(layout, 2)).toEqual({ x: 0, y: 100 });
    expect(valueForFrame(0, 3)).toBe(0);
    expect(valueForFrame(2, 3)).toBe(1);
    expect(valueForFrame(1, 3)).toBeCloseTo(0.5);
  });
});

describe('recursos bitmap (opción B)', () => {
  it('deriva id/fichero/frames', () => {
    expect(bitmapResId('knob_gain')).toBe('KNOBGAIN_FN');
    expect(bitmapFile('knob_gain')).toBe('knob_gain.png');
    expect(controlFrames(defaultKnob('k', 'K'))).toBe(61);
  });

  it('cabecera de recursos lista solo controles bitmap', () => {
    const scene = emptyScene();
    scene.controls.push(defaultKnob('knob_a', 'A')); // IBKnobControl
    const vec = defaultKnob('knob_b', 'B');
    vec.type = 'IVKnobControl';
    scene.controls.push(vec);
    const res = collectBitmapResources(scene);
    expect(res.map((r) => r.controlId)).toEqual(['knob_a']);
    const header = generateResourcesHeader(scene);
    expect(header).toContain('#define KNOBA_FN "knob_a.png"');
    expect(header).not.toContain('knob_b');
  });

  it('el knob por defecto trae capas con indicador rotatorio', () => {
    const layers = defaultKnobLayers();
    expect(layers.length).toBe(4);
    expect(layers.find((l) => l.name === 'Indicator')?.anim?.mode).toBe('rotate');
  });
});

describe('sentido de giro del indicador', () => {
  // Misma convención que renderLayer: canvas con Y hacia abajo, ctx.rotate(+θ) = horario.
  function indicatorPos(value: number) {
    const ind = defaultKnobLayers().find((l) => l.name === 'Indicator')!;
    const r = ind.rectNorm!;
    const cx = r.x + r.w / 2 - 0.5;
    const cy = r.y + r.h / 2 - 0.5;
    const th = (rotationForValue(value, ind.anim!.minDeg, ind.anim!.maxDeg) * Math.PI) / 180;
    return { x: cx * Math.cos(th) - cy * Math.sin(th), y: cx * Math.sin(th) + cy * Math.cos(th) };
  }
  it('value 0 → abajo-izquierda, 0.5 → arriba, 1 → abajo-derecha (horario por las 12)', () => {
    const a = indicatorPos(0), m = indicatorPos(0.5), b = indicatorPos(1);
    expect(a.x).toBeLessThan(0); expect(a.y).toBeGreaterThan(0);
    expect(Math.abs(m.x)).toBeLessThan(0.01); expect(m.y).toBeLessThan(0);
    expect(b.x).toBeGreaterThan(0); expect(b.y).toBeGreaterThan(0);
  });
});
