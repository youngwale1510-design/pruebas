#include "ToneShaper.h"
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
// [GHOST:LAYOUT BEGIN v=1]
// [GHOST:CONTROL BEGIN id=knob_gain]
  // [GHOST:DATA]eyJpZCI6Imtub2JfZ2FpbiIsInR5cGUiOiJJVktub2JDb250cm9sIiwibmFtZSI6IkdhaW4iLCJyZWN0Ijp7IngiOjQwLCJ5Ijo2MCwidyI6OTAsImgiOjExMH0sInBhcmFtSWQiOiJnYWluIiwicHJvcHMiOnt9LCJsYXllcnMiOltdLCJlZmZlY3RzIjpbXX0=
  pGraphics->AttachControl(new IVKnobControl(IRECT(40, 60, 130, 170), kGain, "Gain"), kCtrl_knob_gain);
// [GHOST:CONTROL END id=knob_gain]
// [GHOST:CONTROL BEGIN id=knob_tone]
  // [GHOST:DATA]eyJpZCI6Imtub2JfdG9uZSIsInR5cGUiOiJJVktub2JDb250cm9sIiwibmFtZSI6IlRvbmUiLCJyZWN0Ijp7IngiOjE2MCwieSI6NjAsInciOjkwLCJoIjoxMTB9LCJwYXJhbUlkIjoidG9uZSIsInByb3BzIjp7fSwibGF5ZXJzIjpbXSwiZWZmZWN0cyI6W119
  pGraphics->AttachControl(new IVKnobControl(IRECT(160, 60, 250, 170), kTone, "Tone"), kCtrl_knob_tone);
// [GHOST:CONTROL END id=knob_tone]
// [GHOST:CONTROL BEGIN id=sw_mode]
  // [GHOST:DATA]eyJpZCI6InN3X21vZGUiLCJ0eXBlIjoiSVZUb2dnbGVDb250cm9sIiwibmFtZSI6Ik1vZGUiLCJyZWN0Ijp7IngiOjI5MCwieSI6NzAsInciOjcwLCJoIjo0MH0sInBhcmFtSWQiOiJtb2RlIiwicHJvcHMiOnt9LCJsYXllcnMiOltdLCJlZmZlY3RzIjpbXX0=
  pGraphics->AttachControl(new IVToggleControl(IRECT(290, 70, 360, 110), kMode, "Mode"), kCtrl_sw_mode);
// [GHOST:CONTROL END id=sw_mode]
// [GHOST:CONTROL BEGIN id=sw_bypass]
  // [GHOST:DATA]eyJpZCI6InN3X2J5cGFzcyIsInR5cGUiOiJJVlRvZ2dsZUNvbnRyb2wiLCJuYW1lIjoiQnlwYXNzIiwicmVjdCI6eyJ4IjoyOTAsInkiOjEzMCwidyI6NzAsImgiOjQwfSwicGFyYW1JZCI6ImJ5cGFzcyIsInByb3BzIjp7fSwibGF5ZXJzIjpbXSwiZWZmZWN0cyI6W119
  pGraphics->AttachControl(new IVToggleControl(IRECT(290, 130, 360, 170), kBypass, "Bypass"), kCtrl_sw_bypass);
// [GHOST:CONTROL END id=sw_bypass]
  // Selector de tamaño (100% / 75% / 50%) — generado por Ghost UI Designer.
  {
    const int sw = 34, sh = 16, pad = 4;
    const int x100 = pGraphics->Width() - pad - sw;
    const int x75 = (x100 - pad - sw) > 0 ? (x100 - pad - sw) : 0;
    const int x50 = (x75 - pad - sw) > 0 ? (x75 - pad - sw) : 0;
    const IVStyle ghostSizeMenuStyle = DEFAULT_STYLE.WithShowValue(false);
  pGraphics->AttachControl(new IVButtonControl(IRECT(x100, 4, x100 + sw, 4 + sh), [pGraphics](IControl*) { pGraphics->Resize(PLUG_WIDTH, PLUG_HEIGHT, 1.f); }, "100%", ghostSizeMenuStyle));
  pGraphics->AttachControl(new IVButtonControl(IRECT(x75, 4, x75 + sw, 4 + sh), [pGraphics](IControl*) { pGraphics->Resize(PLUG_WIDTH, PLUG_HEIGHT, .75f); }, "75%", ghostSizeMenuStyle));
  pGraphics->AttachControl(new IVButtonControl(IRECT(x50, 4, x50 + sw, 4 + sh), [pGraphics](IControl*) { pGraphics->Resize(PLUG_WIDTH, PLUG_HEIGHT, .5f); }, "50%", ghostSizeMenuStyle));
  }
// [GHOST:LAYOUT END]
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
