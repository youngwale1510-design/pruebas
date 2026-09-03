import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { syncHeaderEnums, HMARK } from '../src/codegen/iplug2/header';
import { emptyScene, defaultKnob, defaultBackground } from '../src/model/defaults';

const TONESHAPER_H = readFileSync(new URL('../examples/ToneShaper/ToneShaper.h', import.meta.url), 'utf8');

/** El .h tal cual lo entregamos ANTES de este fix: sin marcadores, escrito a
 *  mano. Así probamos el caso real que le pasó al usuario: un header viejo
 *  que hay que adoptar sin perder nada. */
const LEGACY_UNMARKED_H = `#pragma once

#include "IPlug_include_in_plug_hdr.h"
#include "IControls.h"

const int kNumPresets = 1;

// Parámetros del plugin. El diseñador vincula cada control a uno de estos por su symbol.
enum EParams
{
  kGain = 0,   // -> kGain
  kTone,       // -> kTone
  kMode,       // -> kMode  (Warm / Bright)
  kBypass,     // -> kBypass
  kNumParams
};

// Tags de control (el diseñador genera kCtrl_<id>).
enum ECtrlTags
{
  kCtrl_knob_gain = 0,
  kCtrl_knob_tone,
  kCtrl_sw_mode,
  kCtrl_sw_bypass,
  kNumCtrlTags
};

using namespace iplug;
using namespace igraphics;

class ToneShaper final : public Plugin
{
public:
  ToneShaper(const InstanceInfo& info);

#if IPLUG_DSP
  void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;
  void OnReset() override;
  void OnParamChange(int paramIdx) override;
#endif

private:
  double mGain = 1.0;
  double mToneCoeff = 0.5;
  double mZ[2] = {0.0, 0.0};
  int mMode = 0;
  bool mBypass = false;
};
`;

function sceneOf4() {
  const scene = emptyScene('ToneShaper');
  scene.params.push(
    { id: 'gain', name: 'Gain', type: 'double', min: -48, max: 12, default: 0 },
    { id: 'tone', name: 'Tone', type: 'double', min: 0, max: 100, default: 50 },
    { id: 'mode', name: 'Mode', type: 'enum', min: 0, max: 1, default: 0 },
    { id: 'bypass', name: 'Bypass', type: 'bool', min: 0, max: 1, default: 0 },
  );
  ['knob_gain', 'knob_tone', 'sw_mode', 'sw_bypass'].forEach((id) => {
    const k = defaultKnob(id, id, undefined);
    k.id = id;
    scene.controls.push(k);
  });
  return scene;
}

describe('el ToneShaper.h que se entrega ahora YA trae los marcadores', () => {
  it('exportar con un control nuevo lo añade sin duplicar marcadores', () => {
    const scene = sceneOf4();
    scene.controls.push(defaultBackground('bg_7akp', 400, 300));
    const r = syncHeaderEnums(TONESHAPER_H, scene);
    expect(r.tagsChanged).toBe(true);
    expect(r.source).toContain('kCtrl_bg_7akp');
    expect(r.source.split(HMARK.ctrlTagsBegin).length - 1).toBe(1);
  });
});

describe('syncHeaderEnums — el bug real: falta kCtrl_<id> al añadir un control', () => {
  it('un .h sin marcadores (el que ya tienes) se adopta y no pierde nada', () => {
    const scene = sceneOf4();
    const r = syncHeaderEnums(LEGACY_UNMARKED_H, scene);
    expect(r.paramsFound).toBe(true);
    expect(r.tagsFound).toBe(true);
    // Los 4 controles/params ya estaban -> nada nuevo que añadir.
    expect(r.paramsChanged).toBe(true); // primera vez: se añaden los marcadores aunque los nombres no cambien
    expect(r.source).toContain('kGain');
    expect(r.source).toContain('kCtrl_knob_gain');
    expect(r.source).toContain('kCtrl_sw_bypass');
    // El DSP de fuera de los enums sigue intacto.
    expect(r.source).toContain('void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;');
  });

  it('añadir un control nuevo (Fondo) agrega su kCtrl_<id> sin borrar los anteriores', () => {
    const scene = sceneOf4();
    const bg = defaultBackground('bg_7akp', 400, 300);
    scene.controls.push(bg);
    const r = syncHeaderEnums(LEGACY_UNMARKED_H, scene);
    expect(r.tagsChanged).toBe(true);
    expect(r.source).toContain('kCtrl_knob_gain,');
    expect(r.source).toContain('kCtrl_bg_7akp,');
    expect(r.source).toContain('kNumCtrlTags');
    // El orden original se conserva y lo nuevo va al final.
    const idxGain = r.source.indexOf('kCtrl_knob_gain');
    const idxBg = r.source.indexOf('kCtrl_bg_7akp');
    const idxNum = r.source.indexOf('kNumCtrlTags', idxBg);
    expect(idxGain).toBeLessThan(idxBg);
    expect(idxBg).toBeLessThan(idxNum);
  });

  it('idempotente: exportar dos veces seguidas no vuelve a tocar el archivo', () => {
    const scene = sceneOf4();
    scene.controls.push(defaultBackground('bg_7akp', 400, 300));
    const a = syncHeaderEnums(LEGACY_UNMARKED_H, scene).source;
    const b = syncHeaderEnums(a, scene);
    expect(b.paramsChanged).toBe(false);
    expect(b.tagsChanged).toBe(false);
    expect(b.source).toBe(a);
  });

  it('borrar un control en el diseñador NO borra su tag del header (no rompe el DSP)', () => {
    const scene = sceneOf4();
    scene.controls.pop(); // ya no hay sw_bypass en la escena
    const r = syncHeaderEnums(LEGACY_UNMARKED_H, scene);
    expect(r.source).toContain('kCtrl_sw_bypass'); // se conserva
  });

  it('con marcadores ya puestos, una segunda pasada solo añade lo nuevo', () => {
    const scene = sceneOf4();
    const once = syncHeaderEnums(LEGACY_UNMARKED_H, scene).source;
    expect(once).toContain(HMARK.ctrlTagsBegin);
    scene.controls.push(defaultBackground('bg_7akp', 400, 300));
    const twice = syncHeaderEnums(once, scene);
    expect(twice.tagsChanged).toBe(true);
    expect(twice.source).toContain('kCtrl_bg_7akp');
    // Solo un bloque de marcadores, no duplicado.
    expect(twice.source.split(HMARK.ctrlTagsBegin).length - 1).toBe(1);
  });
});
