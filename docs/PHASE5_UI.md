# GhostBand - Phase 5: UI

ASCII-only sources for FL Studio compatibility.

## Style

Hybrid: dark theme with green accents (a nod to the MC404) and a clean,
functional layout. All controls are bound to the APVTS via attachments.

## Components (`Source/UI/`)

- `GhostLookAndFeel.h`   : dark/green palette + custom rotary knob drawing.
- `GrMeter.h`           : vertical gain-reduction meter, polls the processor
                          at 30 Hz (per-band `getBandGrDb`).
- `CrossoverDisplay.h`  : top graphic; 4 bands on a log frequency scale with
                          the 3 crossover points as draggable handles bound to
                          x1/x2/x3.
- `BandStrip.h/.cpp`    : one band strip: title, the 7 MC404-style knobs
                          (Gain/Thresh/Comp/Knee/Bite/Attack/Rel), In/Mute/Auto
                          buttons, Route selector, and a GR meter.

`PluginEditor.h/.cpp` assembles: header (title + preset menu + master Output),
crossover display, 4 band strips, and the 3 parallel bus levels.

## Notes

- Parameter text formatting is driven by each parameter's NormalisableRange
  interval (e.g. thresh 0.01, most others 0.1, release/freq 1.0), so the
  readouts are clean (2.0, -45.45, 250, ...).
- Presets are exposed as host programs and selectable from the header menu.
- The "Made with JUCE" splash at the bottom-right only appears in unlicensed
  (GPL/personal) JUCE builds; it is absent with a commercial JUCE license.

## Headless verification

`Tests/RenderUi.cpp` (target `GhostBandRender`, JUCE build only) renders the
editor to a PNG with the software renderer, so the layout can be checked
without a display:

    cmake --build build --target GhostBandRender
    xvfb-run -a build/GhostBandRender_artefacts/GhostBandRender out.png
