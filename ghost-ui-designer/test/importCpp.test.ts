import { describe, expect, it } from 'vitest';
import { useStore } from '../src/app/store';
import { readSceneFromSource } from '../src/codegen/roundtrip';
import { readFileSync } from 'node:fs';

describe('Abrir .cpp', () => {
  it('carga los controles de ToneShaper.cpp con plantillas por tipo y crea los parámetros', () => {
    const src = readFileSync(new URL('../examples/ToneShaper/ToneShaper.cpp', import.meta.url), 'utf8');
    const { found, controls } = readSceneFromSource(src);
    expect(found).toBe(true);
    useStore.getState().importControls(controls, 'ToneShaper');
    const s = useStore.getState().scene;
    expect(s.meta.pluginName).toBe('ToneShaper');
    expect(s.controls.map((c) => c.id)).toEqual(['knob_gain', 'knob_tone', 'sw_mode', 'sw_bypass']);
    expect(s.params.map((p) => p.id)).toEqual(['gain', 'tone', 'mode', 'bypass']);
    const knob = s.controls[0], sw = s.controls[2];
    expect(knob.type).toBe('IBKnobControl');
    expect(knob.layers.length).toBeGreaterThan(0);
    expect(knob.rect).toEqual({ x: 40, y: 60, w: 90, h: 110 });
    expect(sw.type).toBe('IBSwitchControl');
    expect(sw.props.frames).toBe(2);
  });
});
