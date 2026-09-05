import { describe, expect, it } from 'vitest';
import { syncResourcesRc, RCMARK } from '../src/codegen/iplug2/resources';
import { emptyScene, defaultKnob } from '../src/model/defaults';

const sceneWithKnob = () => {
  const scene = emptyScene('MyPlugin');
  scene.controls = [defaultKnob('knob_gain', 'Gain', 'gain')];
  return scene;
};

// resources/main.rc típico de un proyecto iPlug2 recién creado: sin ningún
// PNG declarado todavía, con la línea suelta de la fuente al final.
const FRESH_RC = `#include "resource.h"

STRINGTABLE
BEGIN
  IDS_BUNDLE_NAME "MyPlugin"
END

ROBOTO_FN TTF ROBOTO_FN
`;

// resources/main.rc REAL de iPlug2: trae un bloque TEXTINCLUDE con la MISMA
// declaración entre comillas (para el editor de recursos de Visual Studio)
// ANTES, en el archivo, que la línea suelta sin comillas. Si el escaneo de
// "la primera línea con TTF" no distingue una de otra, el bloque de Ghost
// termina pegado dentro del string del TEXTINCLUDE en vez de junto a la
// declaración suelta de más abajo.
const RC_WITH_TEXTINCLUDE = `#include "resource.h"

3 TEXTINCLUDE
BEGIN
    "resource.h\\0"
END

3 TEXTINCLUDE
BEGIN
    "ROBOTO_FN TTF ROBOTO_FN\\0"
END

STRINGTABLE
BEGIN
  IDS_BUNDLE_NAME "MyPlugin"
END

ROBOTO_FN TTF ROBOTO_FN
`;

describe('syncResourcesRc: añade a resources/main.rc los PNG que falten', () => {
  it('primera vez: crea el bloque marcado pegado tras la línea TTF', () => {
    const r = syncResourcesRc(FRESH_RC, sceneWithKnob());
    expect(r.changed).toBe(true);
    expect(r.source).toContain(RCMARK.begin);
    expect(r.source).toContain('KNOBGAIN_FN PNG KNOBGAIN_FN');
    // se pegó DESPUÉS de la línea TTF, no antes ni reemplazándola.
    const ttfIdx = r.source.indexOf('ROBOTO_FN TTF ROBOTO_FN');
    const blockIdx = r.source.indexOf(RCMARK.begin);
    expect(ttfIdx).toBeGreaterThanOrEqual(0);
    expect(blockIdx).toBeGreaterThan(ttfIdx);
  });

  it('sin controles bitmap: no toca el archivo', () => {
    const r = syncResourcesRc(FRESH_RC, emptyScene('Vacio'));
    expect(r.changed).toBe(false);
    expect(r.source).toBe(FRESH_RC);
  });

  it('segunda pasada sin cambios: no vuelve a tocar el archivo (idempotente)', () => {
    const first = syncResourcesRc(FRESH_RC, sceneWithKnob());
    const second = syncResourcesRc(first.source, sceneWithKnob());
    expect(second.changed).toBe(false);
    expect(second.source).toBe(first.source);
  });

  it('nunca quita una línea existente, aunque el control ya no esté en la escena', () => {
    const withKnob = syncResourcesRc(FRESH_RC, sceneWithKnob());
    const emptyAfter = syncResourcesRc(withKnob.source, emptyScene('MyPlugin'));
    expect(emptyAfter.changed).toBe(false);
    expect(emptyAfter.source).toContain('KNOBGAIN_FN PNG KNOBGAIN_FN');
  });

  it('agrega un control nuevo a un bloque ya existente sin duplicar el viejo', () => {
    const scene = sceneWithKnob();
    const withKnob = syncResourcesRc(FRESH_RC, scene);
    scene.controls.push(defaultKnob('knob_tone', 'Tone', 'tone'));
    const withBoth = syncResourcesRc(withKnob.source, scene);
    expect(withBoth.changed).toBe(true);
    expect(withBoth.source.match(/KNOBGAIN_FN PNG KNOBGAIN_FN/g)).toHaveLength(1);
    expect(withBoth.source).toContain('KNOBTONE_FN PNG KNOBTONE_FN');
  });

  it('con TEXTINCLUDE: pega tras la declaración SUELTA, no dentro del string entre comillas', () => {
    const r = syncResourcesRc(RC_WITH_TEXTINCLUDE, sceneWithKnob());
    expect(r.changed).toBe(true);

    const quotedIdx = r.source.indexOf('"ROBOTO_FN TTF ROBOTO_FN\\0"');
    const bareIdx = r.source.indexOf('\nROBOTO_FN TTF ROBOTO_FN\n');
    const blockIdx = r.source.indexOf(RCMARK.begin);

    expect(quotedIdx).toBeGreaterThanOrEqual(0);
    expect(bareIdx).toBeGreaterThanOrEqual(0);
    // El bloque debe quedar DESPUÉS de la línea suelta, no metido entre la
    // línea entre comillas y el END del TEXTINCLUDE.
    expect(blockIdx).toBeGreaterThan(bareIdx);
    // Y el string entre comillas debe seguir intacto: nada de Ghost se metió
    // entre esa línea y el END de SU bloque TEXTINCLUDE.
    const endAfterQuoted = r.source.indexOf('END', quotedIdx);
    expect(r.source.slice(quotedIdx, endAfterQuoted)).not.toContain(RCMARK.begin);
  });

  it('sin línea TTF: agrega el bloque al final del archivo', () => {
    const r = syncResourcesRc('#include "resource.h"\n', sceneWithKnob());
    expect(r.changed).toBe(true);
    expect(r.source.trim().endsWith(RCMARK.end)).toBe(true);
  });
});
