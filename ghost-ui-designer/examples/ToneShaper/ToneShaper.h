#pragma once

// Plugin de ejemplo para el flujo Ghost UI Designer:
//   1) DSP + controles funcionales (esto, escrito a mano, NO se toca al reestilizar)
//   2) La GUI vive dentro de marcadores // [GHOST:...] en ToneShaper.cpp
//   3) Abres el .cpp en el diseñador, cambias la estética y exportas: el DSP queda intacto.

#include "IPlug_include_in_plug_hdr.h"
#include "IControls.h"

const int kNumPresets = 1;

// Parámetros del plugin. El diseñador vincula cada control a uno de estos por su symbol.
enum EParams
{
// [GHOST:PARAMS BEGIN]
  kGain,
  kTone,
  kMode,
  kBypass,
  kNumParams
// [GHOST:PARAMS END]
};

// Tags de control (el diseñador genera kCtrl_<id>). Al exportar el bundle, el
// diseñador AÑADE aquí el de cualquier control nuevo (nunca borra los que ya
// había, aunque quites ese control del diseño, para no romper el DSP).
enum ECtrlTags
{
// [GHOST:CTRLTAGS BEGIN]
  kCtrl_knob_gain,
  kCtrl_knob_tone,
  kCtrl_sw_mode,
  kCtrl_sw_bypass,
  kNumCtrlTags
// [GHOST:CTRLTAGS END]
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
  double mGain = 1.0;       // amplitud lineal
  double mToneCoeff = 0.5;  // coef. del filtro de un polo (0..1)
  double mZ[2] = {0.0, 0.0};
  int mMode = 0;            // 0 = Warm, 1 = Bright
  bool mBypass = false;
};
