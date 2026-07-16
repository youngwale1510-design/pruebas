# GhostBand - Phases 3 & 4: Routing + Integration

ASCII-only sources for FL Studio compatibility.

## Signal flow (`GhostBandEngine`, dependency-free)

    input (stereo)
      -> LR4 4-band crossover (one instance per channel)
      -> per-band compressor (stereo-linked)
      -> routing: each band sums into one of 3 buses (Main / R1 / R2)
      -> the 3 buses are mixed with independent levels
      -> master output gain

This enables real parallel multiband compression: route heavily compressed
low bands to R1, keep the highs clean on Main, then blend the bus levels.

The engine has no JUCE dependency, so the whole chain is unit-tested offline.

## JUCE integration (`PluginProcessor`)

- `AudioProcessorValueTreeState` holds all parameters:
  - Global: 3 crossover frequencies, master Output, 3 bus levels.
  - Per band (x4): Gain, Thresh, Comp (ratio), Knee, Bite, Attack, Release,
    Auto release, Route (Main/R1/R2), In (bypass), Mute.
- Each `processBlock` pushes current parameter values into the engine, then
  processes the stereo buffer in place. Smoothing lives inside the DSP
  (crossover: log-domain glide; compressor: ~5 ms parameter smoothing).
- Factory presets are exposed as host programs:
  - Program 0: "Factory Default"
  - Program 1: "Lead Vocal - J" (exact MC404 values)
- State is saved/restored via the APVTS value tree (XML).
- UI is Phase 5; `createEditor()` returns the JUCE generic editor for now, so
  every parameter and the preset menu are usable already.

## Verification

Offline (no JUCE), wired to ctest:

    cmake -B build -DGHOSTBAND_BUILD_JUCE=OFF && cmake --build build && ctest --test-dir build

- CompressorTest: 4/4 PASS.
- EngineRoutingTest: 5/5 PASS
  - bypass passthrough (full engine): out/in = -0.0001 dB
  - routing plumbing (all bands -> muted bus): -124.8 dB
  - routing isolation (316 Hz LowMid -> muted bus): -34.1 dB
  - band mute (3162 Hz HighMid muted): -36.5 dB
  - parallel identity (R1 unity == Main): -0.00000 dB

Full plugin build (needs JUCE + Linux dev libs: alsa, x11/xrandr, gl,
freetype):

    cmake -B build -DGHOSTBAND_BUILD_JUCE=ON && cmake --build build --target GhostBand_VST3 GhostBand_Standalone

Both VST3 and Standalone build and link cleanly (verified).
