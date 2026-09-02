import { describe, expect, it } from 'vitest';
import { parseColor, shade } from '../src/render/color';
import { applyMaterial, materialEffects, MATERIALS, PLACEMENT_EFFECTS } from '../src/model/materials';
import { defaultLed, defaultToggleSwitch } from '../src/model/defaults';
import { writeSceneToSource, readSceneFromSource } from '../src/codegen/roundtrip';
import { emptyScene } from '../src/model/defaults';

describe('color', () => {
  it('parsea hex corto/largo y rgb()', () => {
    expect(parseColor('#f00')).toEqual([255, 0, 0]);
    expect(parseColor('#1c1c20')).toEqual([28, 28, 32]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('nope', [1, 2, 3])).toEqual([1, 2, 3]);
  });
  it('shade oscurece y aclara', () => {
    expect(shade([100, 100, 100], 0.5)).toBe('rgb(50,50,50)');
    expect(shade([100, 100, 100], 1.5)).toBe('rgb(178,178,178)');
  });
});

describe('materiales', () => {
  it('cada preset produce efectos y conserva los de colocación al aplicarse', () => {
    for (const m of MATERIALS) expect(materialEffects(m.id).length).toBeGreaterThan(0);
    const tg = defaultToggleSwitch('t', 't', 'p', 2);
    const nut = tg.layers.find((l) => l.name === 'Tuerca')!;
    const before = nut.effects.filter((e) => PLACEMENT_EFFECTS.includes(e.type)).map((e) => e.id);
    const after = applyMaterial(nut.effects, 'chrome');
    expect(after.filter((e) => PLACEMENT_EFFECTS.includes(e.type)).map((e) => e.id)).toEqual(before);
    expect(after.some((e) => e.type === 'chrome')).toBe(true);
    expect(after.some((e) => e.type === 'facet')).toBe(false);
  });
  it('LED: N estados, emisivo que sigue el valor, y round-trip', () => {
    const led = defaultLed('led_pwr', 'Power', 'pwr', 2, '#30ff60');
    expect(led.props.frames).toBe(2);
    const em = led.layers.flatMap((l) => l.effects).find((e) => e.type === 'emissive')!;
    expect(em.params.followValue).toBe(true);
    expect(em.params.color).toBe('#30ff60');
    const scene = emptyScene();
    scene.controls.push(led);
    const src = writeSceneToSource(scene, null).source;
    expect(src).toContain('IBSwitchControl(20, 20, pGraphics->LoadBitmap(LEDPWR_FN, 2), kPwr)');
    const back = readSceneFromSource(src).controls[0];
    expect(back.layers.flatMap((l) => l.effects).some((e) => e.type === 'emissive')).toBe(true);
  });
});
