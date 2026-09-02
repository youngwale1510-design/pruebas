import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Control, ParamDef, SceneDocument, GHOSTUI_VERSION } from '../src/model/scene';
import { generateManagedRegion } from '../src/codegen/iplug2/generate';
import { writeSceneToSource, readSceneFromSource } from '../src/codegen/roundtrip';

function ctrl(id: string, type: Control['type'], name: string, paramId: string, rect: Control['rect']): Control {
  return { id, type, name, rect, paramId, props: {}, layers: [], effects: [] };
}
function param(id: string, name: string, type: ParamDef['type'], min: number, max: number, def: number): ParamDef {
  return { id, name, type, min, max, default: def };
}

/** Escena del ToneShaper: 2 knobs + interruptor de modo + bypass. */
function toneShaperScene(): SceneDocument {
  return {
    version: GHOSTUI_VERSION,
    meta: { pluginName: 'ToneShaper', author: 'GhostAudio' },
    canvas: { width: 400, height: 300, bg: '#20232a' },
    light: { angleDeg: 120, intensity: 0.7 },
    assets: { textures: [], filmstrips: [] },
    params: [
      param('gain', 'Gain', 'double', -48, 12, 0),
      param('tone', 'Tone', 'double', 0, 100, 50),
      param('mode', 'Mode', 'enum', 0, 1, 0),
      param('bypass', 'Bypass', 'bool', 0, 1, 0),
    ],
    controls: [
      ctrl('knob_gain', 'IVKnobControl', 'Gain', 'gain', { x: 40, y: 60, w: 90, h: 110 }),
      ctrl('knob_tone', 'IVKnobControl', 'Tone', 'tone', { x: 160, y: 60, w: 90, h: 110 }),
      ctrl('sw_mode', 'IVToggleControl', 'Mode', 'mode', { x: 290, y: 70, w: 70, h: 40 }),
      ctrl('sw_bypass', 'IVToggleControl', 'Bypass', 'bypass', { x: 290, y: 130, w: 70, h: 40 }),
    ],
  };
}

// Plantilla del .cpp: DSP + constructor escritos a mano; la GUI se inserta en
// __GHOST_REGION__. Todo lo de fuera de los marcadores debe preservarse.
const TEMPLATE = (region: string) => `#include "ToneShaper.h"
#include "IPlug_include_in_plug_src.h"
#include "IControls.h"

ToneShaper::ToneShaper(const InstanceInfo& info)
: Plugin(info, MakeConfig(kNumParams, kNumPresets))
{
  GetParam(kGain)->InitGain("Gain", 0.0, -48.0, 12.0);
  GetParam(kTone)->InitPercentage("Tone", 50.0);
  GetParam(kMode)->InitEnum("Mode", 0, {"Warm", "Bright"});
  GetParam(kBypass)->InitBool("Bypass", false);

#if IPLUG_EDITOR
  mMakeGraphicsFunc = [&]() {
    return MakeGraphics(*this, PLUG_WIDTH, PLUG_HEIGHT, PLUG_FPS, GetScaleForScreen(PLUG_WIDTH, PLUG_HEIGHT));
  };

  mLayoutFunc = [&](IGraphics* pGraphics) {
    pGraphics->AttachCornerResizer(EUIResizerMode::Scale, false);
    pGraphics->AttachPanelBackground(COLOR_GRAY);
    pGraphics->LoadFont("Roboto-Regular", ROBOTO_FN);
    const IRECT b = pGraphics->GetBounds();

    // --- Zona gestionada por Ghost UI Designer (no editar a mano dentro) ---
${region}
    // --- Fin de la zona gestionada ---
  };
#endif
}

#if IPLUG_DSP
void ToneShaper::OnParamChange(int paramIdx)
{
  mGain = DBToAmp(GetParam(kGain)->Value());
  const double t = GetParam(kTone)->Value() / 100.0;
  mToneCoeff = 0.05 + 0.9 * t;
  mMode = GetParam(kMode)->Int();
  mBypass = GetParam(kBypass)->Bool();
}

void ToneShaper::OnReset()
{
  mZ[0] = mZ[1] = 0.0;
}

void ToneShaper::ProcessBlock(sample** inputs, sample** outputs, int nFrames)
{
  const int nChans = NOutChansConnected();
  for (int c = 0; c < nChans; c++)
  {
    const int zi = c % 2;
    for (int s = 0; s < nFrames; s++)
    {
      const sample x = inputs[c][s];
      if (mBypass) { outputs[c][s] = x; continue; }
      mZ[zi] += mToneCoeff * (x - mZ[zi]);
      const sample lp = mZ[zi];
      const sample shaped = (mMode == 0) ? lp : (x + (x - lp)); // Warm / Bright
      outputs[c][s] = shaped * mGain;
    }
  }
}
#endif
`;

describe('ejemplo ToneShaper (flujo end-to-end iPlug2)', () => {
  const scene = toneShaperScene();
  const region = generateManagedRegion(scene);
  const cpp = TEMPLATE(region);

  it('genera un .cpp con los 4 controles marcados y lo escribe al ejemplo', () => {
    const out = fileURLToPath(new URL('../examples/ToneShaper/ToneShaper.cpp', import.meta.url));
    writeFileSync(out, cpp, 'utf8');
    expect(cpp).toContain('IVKnobControl');
    expect(cpp).toContain('IVToggleControl');
    expect(cpp).toContain('kCtrl_knob_gain');
  });

  it('el diseñador reconstruye los 4 controles desde el .cpp', () => {
    const parsed = readSceneFromSource(cpp);
    expect(parsed.found).toBe(true);
    expect(parsed.controls.map((c) => c.id)).toEqual(['knob_gain', 'knob_tone', 'sw_mode', 'sw_bypass']);
    expect(parsed.controls.map((c) => c.type)).toEqual(['IVKnobControl', 'IVKnobControl', 'IVToggleControl', 'IVToggleControl']);
    expect(parsed.controls.map((c) => c.paramId)).toEqual(['gain', 'tone', 'mode', 'bypass']);
  });

  it('al reestilizar (regenerar) se preserva el DSP escrito a mano', () => {
    // El usuario mueve un knob y cambia un tipo de control en el editor.
    const restyled = structuredClone(scene);
    restyled.controls[0].rect.x = 24;
    restyled.controls[0].type = 'IBKnobControl'; // knob 3D/bitmap
    const { source, merged } = writeSceneToSource(restyled, cpp);

    expect(merged).toBe(true);
    // DSP intacto:
    expect(source).toContain('void ToneShaper::ProcessBlock');
    expect(source).toContain('mZ[zi] += mToneCoeff');
    expect(source).toContain('GetParam(kGain)->InitGain');
    // Cambios de GUI aplicados (IBKnobControl usa coordenadas x,y):
    expect(source).toContain('IBKnobControl(24, 60,');
    // Y sigue siendo legible de vuelta:
    expect(readSceneFromSource(source).controls[0].rect.x).toBe(24);
  });
});
