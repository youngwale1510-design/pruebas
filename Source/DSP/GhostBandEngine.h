/*
    GhostBand - GhostBandEngine.h

    Full DSP chain for the plugin, dependency-free (no JUCE) so it can be
    unit-tested offline:

        input (stereo)
          -> LR4 4-band crossover (per channel)
          -> per-band compressor (stereo-linked)
          -> routing: each band sums into one of 3 buses (Main / R1 / R2)
          -> the 3 buses are mixed with independent levels
          -> master output gain

    This is what enables real parallel multiband compression: e.g. route the
    low bands (heavily compressed) to R1 and keep the highs clean on Main,
    then blend the bus levels.

    The JUCE AudioProcessor is a thin wrapper that maps parameters onto this
    engine and calls process().

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <vector>

#include "MultibandCrossover4.h"
#include "BandCompressor.h"

namespace ghostband
{

class GhostBandEngine
{
public:
    enum { numBands = 4, numBuses = 3 };
    enum Bus { Main = 0, R1 = 1, R2 = 2 };

    void prepare (double sampleRate, int maxBlockSize);
    void reset();

    // ---- Global controls ---------------------------------------------------
    void setCrossoverFrequencies (float f1, float f2, float f3);
    void setOutputGainDb (float db) noexcept;
    void setBusGainDb (int bus, float db) noexcept;   // bus 0..2

    // ---- Per-band access ---------------------------------------------------
    BandCompressor& band (int i) noexcept { return comps[i]; }
    void setBandRouting (int band, int bus) noexcept; // bus 0..2

    // Metering.
    float getBandGainReductionDb (int i) const noexcept { return comps[i].getGainReductionDb(); }

    // Process a stereo pair in place.
    void process (float* left, float* right, int numSamples);

private:
    double fs = 44100.0;
    int    maxBlock = 0;

    MultibandCrossover4 xoverL, xoverR;
    BandCompressor      comps[numBands];

    int   routing[numBands] = { Main, Main, Main, Main };
    float busGain[numBuses] = { 1.0f, 1.0f, 1.0f };
    float outputGain = 1.0f;

    // Working buffers (allocated in prepare()).
    std::vector<float> bandL[numBands], bandR[numBands];
    std::vector<float> busL[numBuses],  busR[numBuses];
};

} // namespace ghostband
