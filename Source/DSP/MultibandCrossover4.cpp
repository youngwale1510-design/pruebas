/*
    GhostBand - MultibandCrossover4.cpp

    Implementation of the 4-band LR4 crossover with allpass phase
    compensation. See MultibandCrossover4.h for the topology and the flat-sum
    proof.

    ASCII-only source for FL Studio compatibility.
*/

#include "MultibandCrossover4.h"

#include <algorithm>

namespace ghostband
{

static inline float clampf (float v, float lo, float hi) noexcept
{
    return v < lo ? lo : (v > hi ? hi : v);
}

void MultibandCrossover4::prepare (double sampleRate, int /*maxBlockSize*/)
{
    fs = sampleRate;

    const double rampSeconds = 0.03; // 30 ms glide, click-free cutoff moves
    smF1.reset (sampleRate, rampSeconds);
    smF2.reset (sampleRate, rampSeconds);
    smF3.reset (sampleRate, rampSeconds);

    smF1.setCurrentAndTarget (100.0f);
    smF2.setCurrentAndTarget (1000.0f);
    smF3.setCurrentAndTarget (10000.0f);

    reset();
    updateCoefficients (100.0f, 1000.0f, 10000.0f);
}

void MultibandCrossover4::reset()
{
    xoverMid.reset();
    xoverLow.reset();
    xoverHigh.reset();
    apLowBranch.reset();
    apHighBranch.reset();
}

void MultibandCrossover4::setCrossoverFrequencies (float f1, float f2, float f3)
{
    const float nyq  = (float) (fs * 0.5);
    const float minF = 20.0f;
    const float maxF = std::min (nyq * 0.98f, 20000.0f);

    f1 = clampf (f1, minF, maxF);
    f2 = clampf (f2, minF, maxF);
    f3 = clampf (f3, minF, maxF);

    // Enforce strict ordering f1 < f2 < f3 with a small ratio gap so the
    // crossovers never collapse onto each other.
    const float gap = 1.05f;
    if (f2 < f1 * gap) f2 = f1 * gap;
    if (f3 < f2 * gap) f3 = f2 * gap;
    f2 = std::min (f2, maxF);
    f3 = std::min (f3, maxF);

    smF1.setTarget (f1);
    smF2.setTarget (f2);
    smF3.setTarget (f3);
}

void MultibandCrossover4::updateCoefficients (float f1, float f2, float f3)
{
    const float sr = (float) fs;

    xoverMid.setCutoff  (f2, sr);
    xoverLow.setCutoff  (f1, sr);
    xoverHigh.setCutoff (f3, sr);

    // Compensating allpasses: lower branch gets the f3 allpass, upper branch
    // gets the f1 allpass. Total summed response becomes AP(f1)*AP(f2)*AP(f3).
    apLowBranch.setCutoff  (f3, sr);
    apHighBranch.setCutoff (f1, sr);
}

void MultibandCrossover4::processBlock (const float* input, float* const* bands, int numSamples)
{
    for (int n = 0; n < numSamples; ++n)
    {
        const bool smoothing = smF1.isSmoothing() || smF2.isSmoothing() || smF3.isSmoothing();

        const float f1 = smF1.getNextValue();
        const float f2 = smF2.getNextValue();
        const float f3 = smF3.getNextValue();

        if (smoothing)
            updateCoefficients (f1, f2, f3);

        const float x = input[n];

        // Level 1: split at f2.
        const auto mid = xoverMid.process (x);

        // Branch compensation (allpass), then level-2 splits.
        const float lowBranch  = apLowBranch.process  (mid.low);
        const float highBranch = apHighBranch.process (mid.high);

        const auto lo = xoverLow.process  (lowBranch);  // split at f1
        const auto hi = xoverHigh.process (highBranch); // split at f3

        bands[Low][n]     = lo.low;
        bands[LowMid][n]  = lo.high;
        bands[HighMid][n] = hi.low;
        bands[High][n]    = hi.high;
    }
}

} // namespace ghostband
