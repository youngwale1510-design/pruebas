/*
    GhostBand - GhostBandEngine.cpp

    Implementation of the full DSP chain. See header for the signal flow.

    ASCII-only source for FL Studio compatibility.
*/

#include "GhostBandEngine.h"

#include <cmath>
#include <cstring>

namespace ghostband
{

static inline float dbToLin (float db) noexcept { return std::pow (10.0f, db * 0.05f); }

void GhostBandEngine::prepare (double sampleRate, int maxBlockSize)
{
    fs = sampleRate;
    maxBlock = maxBlockSize;

    xoverL.prepare (sampleRate, maxBlockSize);
    xoverR.prepare (sampleRate, maxBlockSize);

    for (auto& c : comps)
        c.prepare (sampleRate);

    for (int b = 0; b < numBands; ++b)
    {
        bandL[b].assign ((size_t) maxBlockSize, 0.0f);
        bandR[b].assign ((size_t) maxBlockSize, 0.0f);
    }
    for (int s = 0; s < numBuses; ++s)
    {
        busL[s].assign ((size_t) maxBlockSize, 0.0f);
        busR[s].assign ((size_t) maxBlockSize, 0.0f);
    }

    reset();
}

void GhostBandEngine::reset()
{
    xoverL.reset();
    xoverR.reset();
    for (auto& c : comps)
        c.reset();
}

void GhostBandEngine::setCrossoverFrequencies (float f1, float f2, float f3)
{
    xoverL.setCrossoverFrequencies (f1, f2, f3);
    xoverR.setCrossoverFrequencies (f1, f2, f3);
}

void GhostBandEngine::setInputGainDb (float db) noexcept
{
    inputGain = dbToLin (db);
}

void GhostBandEngine::setOutputGainDb (float db) noexcept
{
    outputGain = dbToLin (db);
}

void GhostBandEngine::setBusGainDb (int bus, float db) noexcept
{
    if (bus >= 0 && bus < numBuses)
        busGain[bus] = dbToLin (db);
}

void GhostBandEngine::setBandRouting (int band, int bus) noexcept
{
    if (band >= 0 && band < numBands && bus >= 0 && bus < numBuses)
        routing[band] = bus;
}

void GhostBandEngine::process (float* left, float* right, int numSamples)
{
    // Guard against a block larger than we prepared for.
    if (numSamples > maxBlock)
        numSamples = maxBlock;

    // 0) Global input gain.
    if (inputGain != 1.0f)
    {
        for (int i = 0; i < numSamples; ++i) { left[i] *= inputGain; right[i] *= inputGain; }
    }

    // 1) Split each channel into 4 bands.
    float* bandPtrsL[numBands];
    float* bandPtrsR[numBands];
    for (int b = 0; b < numBands; ++b)
    {
        bandPtrsL[b] = bandL[b].data();
        bandPtrsR[b] = bandR[b].data();
    }
    xoverL.processBlock (left,  bandPtrsL, numSamples);
    xoverR.processBlock (right, bandPtrsR, numSamples);

    // 2) Compress each band (stereo-linked).
    for (int b = 0; b < numBands; ++b)
        comps[b].processBlock (bandPtrsL[b], bandPtrsR[b], numSamples);

    // 3) Clear buses, then route each band into its assigned bus.
    for (int s = 0; s < numBuses; ++s)
    {
        std::memset (busL[s].data(), 0, (size_t) numSamples * sizeof (float));
        std::memset (busR[s].data(), 0, (size_t) numSamples * sizeof (float));
    }
    for (int b = 0; b < numBands; ++b)
    {
        const int bus = routing[b];
        float* dL = busL[bus].data();
        float* dR = busR[bus].data();
        const float* sL = bandPtrsL[b];
        const float* sR = bandPtrsR[b];
        for (int n = 0; n < numSamples; ++n)
        {
            dL[n] += sL[n];
            dR[n] += sR[n];
        }
    }

    // 4) Mix the 3 buses with independent levels, then master output.
    const float g0 = busGain[0], g1 = busGain[1], g2 = busGain[2];
    const float* mL0 = busL[0].data(); const float* mL1 = busL[1].data(); const float* mL2 = busL[2].data();
    const float* mR0 = busR[0].data(); const float* mR1 = busR[1].data(); const float* mR2 = busR[2].data();
    for (int n = 0; n < numSamples; ++n)
    {
        left[n]  = (mL0[n] * g0 + mL1[n] * g1 + mL2[n] * g2) * outputGain;
        right[n] = (mR0[n] * g0 + mR1[n] * g1 + mR2[n] * g2) * outputGain;
    }
}

} // namespace ghostband
