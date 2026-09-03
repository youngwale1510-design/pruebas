import { describe, expect, it } from 'vitest';
import { emptyScene, defaultKnob, defaultParam, defaultToggleSwitch } from '../src/model/defaults';
import { writeSceneToSource, readSceneFromSource } from '../src/codegen/roundtrip';
import { parseControlsFromBody } from '../src/codegen/iplug2/parse';
import { generateResourcesRc } from '../src/codegen/iplug2/resources';

function sceneWithKnob() {
  const scene = emptyScene('GhostBand');
  scene.params.push(defaultParam('gain', 'Gain'));
  const knob = defaultKnob('knob_gain', 'Gain', 'gain');
  knob.type = 'IVKnobControl';
  knob.rect = { x: 30, y: 40, w: 90, h: 110 };
  scene.controls.push(knob);
  return scene;
}

describe('round-trip iPlug2', () => {
  it('genera desde cero y vuelve a leer el mismo control', () => {
    const scene = sceneWithKnob();
    const { source, merged } = writeSceneToSource(scene, null);
    expect(merged).toBe(false);
    expect(source).toContain('IVKnobControl');
    expect(source).toContain('IRECT(30, 40, 120, 150)');

    const parsed = readSceneFromSource(source);
    expect(parsed.found).toBe(true);
    expect(parsed.controls).toHaveLength(1);
    const c = parsed.controls[0];
    expect(c.id).toBe('knob_gain');
    expect(c.type).toBe('IVKnobControl');
    expect(c.paramId).toBe('gain');
    expect(c.rect).toEqual({ x: 30, y: 40, w: 90, h: 110 });
    // Las capas pseudo-3D sobreviven al round-trip por el payload embebido.
    expect(c.layers.length).toBeGreaterThan(0);
    expect(c.layers.some((l) => l.anim?.mode === 'rotate')).toBe(true);
  });

  it('preserva el código escrito a mano fuera de la región', () => {
    const scene = sceneWithKnob();
    const first = writeSceneToSource(scene, null).source;

    // Simula edición manual del usuario dentro del mLayoutFunc, fuera de la región.
    const handEdited = first.replace(
      'const IRECT b = pGraphics->GetBounds();',
      'const IRECT b = pGraphics->GetBounds();\n  pGraphics->AttachControl(new ITextControl(b, "HECHO A MANO"));',
    );
    expect(handEdited).toContain('HECHO A MANO');

    // El usuario mueve el knob en el editor y regenera.
    scene.controls[0].rect.x = 200;
    const { source, merged } = writeSceneToSource(scene, handEdited);

    expect(merged).toBe(true);
    // Se preservó el código a mano...
    expect(source).toContain('HECHO A MANO');
    // ...y se actualizó el bloque gestionado.
    expect(source).toContain('IRECT(200, 40, 290, 150)');
    expect(source).not.toContain('IRECT(30, 40, 120, 150)');

    // Y sigue siendo legible de vuelta.
    const parsed = readSceneFromSource(source);
    expect(parsed.controls[0].rect.x).toBe(200);
  });

  it('reconstruye múltiples controles y respeta el orden', () => {
    const scene = emptyScene();
    ['a', 'b', 'c'].forEach((k, i) => {
      const knob = defaultKnob(`knob_${k}`, k.toUpperCase(), k);
      knob.rect.x = i * 100;
      scene.controls.push(knob);
    });
    const { source } = writeSceneToSource(scene, null);
    const parsed = readSceneFromSource(source);
    expect(parsed.controls.map((c) => c.id)).toEqual([
      'knob_a',
      'knob_b',
      'knob_c',
    ]);
  });

  it('el payload sobrevive a caracteres problemáticos en el nombre', () => {
    const scene = emptyScene();
    const knob = defaultKnob('knob_x', 'Weird "*/ name\n con salto', 'x');
    scene.controls.push(knob);
    const { source } = writeSceneToSource(scene, null);
    const [c] = parseControlsFromBody(source);
    expect(c.name).toBe('Weird "*/ name\n con salto');
  });

  it('idempotencia: regenerar sin cambios produce el mismo archivo', () => {
    const scene = sceneWithKnob();
    const a = writeSceneToSource(scene, null).source;
    const b = writeSceneToSource(scene, a).source;
    const c = writeSceneToSource(scene, b).source;
    expect(c).toBe(b);
  });
});

describe('payload sin imágenes embebidas', () => {
  it('no mete data URIs (filmstrip/texturas) en el .cpp y marca que existían', () => {
    const scene = emptyScene();
    const knob = defaultKnob('knob_img', 'Img', 'x');
    const big = 'data:image/png;base64,' + 'A'.repeat(200_000);
    knob.props.filmstripDataUri = big;
    knob.layers[0].fillImage = big;
    scene.controls.push(knob);
    const { source } = writeSceneToSource(scene, null);
    expect(source.length).toBeLessThan(20_000);
    expect(source).not.toContain('AAAAAAAAAA');
    const [c] = parseControlsFromBody(source);
    expect(c.props.filmstripDataUri).toBeUndefined();
    expect(c.props.filmstripEmbedded).toBe(true);
    expect(c.layers[0].fillImage).toBeUndefined();
    expect(c.layers[0].fillImageEmbedded).toBe(true);
  });
});

describe('switches en el codegen', () => {
  it('IBSwitchControl con N frames y recurso bitmap, y sobrevive al round-trip', () => {
    const scene = emptyScene();
    scene.params.push({ id: 'mode', name: 'Mode', type: 'enum', min: 0, max: 2, default: 0 });
    scene.controls.push(defaultToggleSwitch('sw_mode', 'Mode', 'mode', 3));
    const { source } = writeSceneToSource(scene, null);
    expect(source).toContain('new IBSwitchControl(20, 20, pGraphics->LoadBitmap(SWMODE_FN, 3), kMode)');
    const parsed = readSceneFromSource(source);
    expect(parsed.controls[0].type).toBe('IBSwitchControl');
    expect(parsed.controls[0].props.frames).toBe(3);
    expect(parsed.controls[0].layers.some((l) => l.anim?.mode === 'lever')).toBe(true);
  });
});

describe('recursos para main.rc', () => {
  it('genera una línea PNG por control bitmap', () => {
    const scene = emptyScene();
    scene.controls.push(defaultKnob('knob_gain', 'Gain', 'gain'));
    scene.controls.push(defaultToggleSwitch('sw_mode', 'Mode', 'mode', 2));
    const rc = generateResourcesRc(scene);
    expect(rc).toContain('KNOBGAIN_FN PNG KNOBGAIN_FN');
    expect(rc).toContain('SWMODE_FN PNG SWMODE_FN');
  });
});
