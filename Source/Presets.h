/*
    GhostBand - Presets.h

    Plain, dependency-free description of a full plugin state (crossovers +
    per-band compressor settings + output), plus the factory presets.

    Routing values: 0 = Main bus, 1 = R1 (parallel), 2 = R2 (parallel).

    ASCII-only source for FL Studio compatibility.

    NOTE on "Lead Vocal - J": these are the exact values read from a published
    screenshot of a McDSP MC404 instance on a lead vocal. Reproduced here as a
    settings recipe (numbers only), not as any McDSP code. Labeled as an
    homage / reference starting point.
*/

#pragma once

namespace ghostband
{

struct BandSettings
{
    float inputGainDb;  // GAIN
    float thresholdDb;  // THRESH
    float ratio;        // COMP
    float kneeDb;       // KNEE
    float bite;         // BITE
    float attackMs;     // ATTACK
    float releaseMs;    // REL
    int   releaseMode;  // 0 = REL1, 1 = REL2, 2 = AUTO
    int   routing;      // 0 = Main, 1 = R1, 2 = R2
    bool  compIn;       // In (compression engaged)
    bool  muted;        // Mute
};

struct GhostBandPreset
{
    const char*  name;
    float        xover1Hz;   // X1
    float        xover2Hz;   // X2
    float        xover3Hz;   // X3
    float        outputDb;   // master OUTPUT (makeup)
    BandSettings bands[4];   // Low, LowMid, HighMid, High
};

// -----------------------------------------------------------------------------
// Factory default: MC404-style neutral starting point.
// -----------------------------------------------------------------------------
inline const GhostBandPreset& factoryDefaultPreset()
{
    static const GhostBandPreset p = {
        "Factory Default",
        100.0f, 1000.0f, 10000.0f, 0.0f,
        {
            //  gain  thresh  ratio knee  bite  atk    rel    relmode route in     mute
            {  0.0f, -24.0f,  2.0f, 0.0f, 0.0f, 2.5f, 250.0f, 0,     0,    true,  false },
            {  0.0f, -24.0f,  2.0f, 0.0f, 0.0f, 2.5f, 250.0f, 0,     0,    true,  false },
            {  0.0f, -24.0f,  2.0f, 0.0f, 0.0f, 2.5f, 250.0f, 0,     0,    true,  false },
            {  0.0f, -24.0f,  2.0f, 0.0f, 0.0f, 2.5f, 250.0f, 0,     0,    true,  false },
        }
    };
    return p;
}

// -----------------------------------------------------------------------------
// "Lead Vocal - J": exact values from the shown MC404 setup.
//   Crossovers 100 / 1000 / 10000 Hz, OUTPUT +3.01 dB.
//   All bands: COMP 2.0, KNEE 0, BITE 1.0, ATTACK 2.5 ms, REL 250 ms.
//   Only the threshold differs per band (lows compressed hardest).
// -----------------------------------------------------------------------------
inline const GhostBandPreset& leadVocalJPreset()
{
    static const GhostBandPreset p = {
        "Lead Vocal - J",
        100.0f, 1000.0f, 10000.0f, 3.01f,
        {
            //  gain  thresh   ratio knee  bite  atk    rel    relmode route in     mute
            {  0.0f, -45.45f,  2.0f, 0.0f, 1.0f, 2.5f, 250.0f, 0,     0,    true,  false }, // Low
            {  0.0f, -23.02f,  2.0f, 0.0f, 1.0f, 2.5f, 250.0f, 0,     0,    true,  false }, // LowMid
            {  0.0f, -23.02f,  2.0f, 0.0f, 1.0f, 2.5f, 250.0f, 0,     0,    true,  false }, // HighMid
            {  0.0f, -12.00f,  2.0f, 0.0f, 1.0f, 2.5f, 250.0f, 0,     0,    true,  false }, // High
        }
    };
    return p;
}

} // namespace ghostband
