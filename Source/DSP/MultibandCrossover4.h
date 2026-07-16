/*
    GhostBand - MultibandCrossover4.h

    4-band Linkwitz-Riley (LR4) crossover with allpass phase compensation,
    so that summing the 4 unprocessed bands reconstructs the input with FLAT
    magnitude across the whole spectrum (the critical LR4 crossover test).

    Topology (2-level tree with compensation):

                          in
                           |
                    LR4 @ f2 (mid split)
                    /                \
                 low2                high2
                  |                    |
             AP @ f3 (comp)       AP @ f1 (comp)
                  |                    |
              LR4 @ f1              LR4 @ f3
              /      \              /      \
            Low    LowMid       HighMid   High

    Because all filters are LTI they commute, so applying the compensating
    allpass to the whole branch (before the split) is equivalent to applying
    it to each resulting band. The total transfer function of the summed
    bands is AP(f1) * AP(f2) * AP(f3) = pure allpass => flat magnitude.

    This class processes a SINGLE channel. For stereo use one instance per
    channel. Crossover frequencies are smoothed internally (multiplicative /
    log-domain smoothing) so real-time changes are click-free.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include "LinkwitzRiley4.h"
#include "Allpass2.h"
#include "LogSmoother.h"

namespace ghostband
{

class MultibandCrossover4
{
public:
    enum { numBands = 4 };

    // Band indices for clarity at call sites.
    enum BandIndex { Low = 0, LowMid = 1, HighMid = 2, High = 3 };

    void prepare (double sampleRate, int maxBlockSize);
    void reset();

    // f1 < f2 < f3 (Hz). Safe to call per block; values are smoothed.
    void setCrossoverFrequencies (float f1, float f2, float f3);

    // Split 'input' (numSamples) into 4 band buffers.
    // 'bands' must point to numBands writable channels of length numSamples;
    // bands[Low], bands[LowMid], bands[HighMid], bands[High].
    void processBlock (const float* input, float* const* bands, int numSamples);

private:
    // Recompute filter coefficients from the current smoothed frequencies.
    void updateCoefficients (float f1, float f2, float f3);

    double fs = 44100.0;

    LogSmoother smF1;
    LogSmoother smF2;
    LogSmoother smF3;

    LinkwitzRiley4 xoverMid;   // split at f2
    LinkwitzRiley4 xoverLow;   // split at f1 (lower branch)
    LinkwitzRiley4 xoverHigh;  // split at f3 (upper branch)

    Allpass2 apLowBranch;      // allpass at f3, applied to the lower branch
    Allpass2 apHighBranch;     // allpass at f1, applied to the upper branch
};

} // namespace ghostband
