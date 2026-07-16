# GhostBand - Phase 2: Per-band Compression Engine

ASCII-only sources for FL Studio compatibility.

## Parameter map (mirrors McDSP MC404 labels)

Per band: GAIN, THRESH, COMP (ratio), KNEE, BITE, ATTACK, REL, AUTO (release),
In (bypass) and Mute. Master OUTPUT is a global makeup handled at the plugin
level (Phase 4).

| Param  | Meaning                                   | Units |
|--------|-------------------------------------------|-------|
| GAIN   | Input gain into the band (pre-detection)  | dB    |
| THRESH | Threshold                                 | dB    |
| COMP   | Compression ratio (2.00 = 2:1)            | ratio |
| KNEE   | Soft-knee width (0 = hard knee)           | dB    |
| BITE   | Transient emphasis in the detector        | 0..N  |
| ATTACK | Attack time                               | ms    |
| REL    | Release time                              | ms    |
| AUTO   | Program-dependent (auto) release          | bool  |

## Design (`BandCompressor`)

- Feed-forward compressor, stereo-linked peak detection (post input gain).
- Soft-knee gain computer (Giannoulis/Reiss quadratic knee). KNEE 0 = hard.
- Decoupled smooth ballistics on the gain reduction in dB (click-free).
- BITE: a fast peak envelope minus a slow reference gives the transient
  overshoot; `bite * transient` is added to the detector so the compressor
  reacts harder to attacks (more "bite"/punch on the onset).
- AUTO release: a slow follower of the reduction lengthens the release when
  compression is sustained, snappier on short transients.
- In (bypass): band passes through uncompressed (input gain still applies).
  Mute: band is silenced.
- The core is dependency-free (no JUCE) so it is unit-tested offline.

## Verification (`Tests/CompressorTest.cpp`, always-buildable)

Build without JUCE:

    cmake -B build -DGHOSTBAND_BUILD_JUCE=OFF && cmake --build build && ctest --test-dir build

Results (48 kHz):

1. Static 2:1 ratio: 20 dB over threshold -> output ~ -10 dB. PASS
2. Below threshold -> ~0 dB reduction. PASS
3. BITE: on a transient burst, GR goes from 14.6 dB (bite=0) to 30.2 dB
   (bite=5) -> BITE clearly emphasizes transient detection. PASS
4. In (bypass): audio passes unchanged, output finite. PASS

## Factory presets (`Source/Presets.h`)

- "Factory Default": neutral MC404-style start (100/1000/10000 Hz, 2:1).
- "Lead Vocal - J": exact values read from a shown MC404 lead-vocal setup.
  Crossovers 100/1000/10000 Hz, OUTPUT +3.01 dB, all bands COMP 2.0 / KNEE 0
  / BITE 1.0 / ATTACK 2.5 ms / REL 250 ms; only threshold varies per band
  (Low -45.45, LowMid -23.02, HighMid -23.02, High -12.00). Reproduced as a
  settings recipe (numbers only), labeled as a reference / homage.
