/*
    GhostBand - FlatSumTest.cpp

    Offline verification that the 4-band LR4 crossover reconstructs the input
    with FLAT magnitude when the 4 unprocessed bands are summed. This is the
    critical correctness test for an LR4 crossover with allpass compensation.

    Tests:
      1. Impulse -> sum of 4 bands -> FFT magnitude must be ~0 dB (flat)
         across the spectrum (allpass reconstruction => |sum| = 1).
      2. Energy preserved (Parseval): sum-of-bands energy ~ 1 for a unit
         impulse (an allpass preserves energy).
      3. Real-time cutoff sweep with noise: output stays finite, no click
         spikes (click-free coefficient modulation).

    Note: the summed response is an allpass (flat magnitude, non-linear
    phase), so the reconstruction is NOT sample-identical in time - only the
    magnitude is flat. That is the correct behavior for a zero-latency IIR
    crossover (same family as analog-style multiband compressors).

    ASCII-only source for FL Studio compatibility.
*/

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_dsp/juce_dsp.h>

#include "DSP/MultibandCrossover4.h"

#include <cmath>
#include <iostream>
#include <vector>

using namespace ghostband;

static int failures = 0;

static void check (bool cond, const char* name)
{
    std::cout << (cond ? "[PASS] " : "[FAIL] ") << name << "\n";
    if (! cond)
        ++failures;
}

int main()
{
    const double fs = 48000.0;
    const int    fftOrder = 15;
    const int    N = 1 << fftOrder; // 32768

    MultibandCrossover4 xover;
    xover.prepare (fs, N);
    xover.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);
    xover.reset();

    const int numBands = MultibandCrossover4::numBands;

    std::vector<std::vector<float>> bandBufs (numBands, std::vector<float> (N, 0.0f));
    std::vector<float*> bandPtrs (numBands);
    for (int b = 0; b < numBands; ++b)
        bandPtrs[b] = bandBufs[b].data();

    // ---- Test 1 & 2: impulse response --------------------------------------
    std::vector<float> in (N, 0.0f);
    in[0] = 1.0f;

    xover.processBlock (in.data(), bandPtrs.data(), N);

    std::vector<float> sum (N, 0.0f);
    for (int n = 0; n < N; ++n)
    {
        float s = 0.0f;
        for (int b = 0; b < numBands; ++b)
            s += bandBufs[b][n];
        sum[n] = s;
    }

    // Energy (Parseval): allpass preserves energy => ~1 for a unit impulse.
    double energy = 0.0;
    for (int n = 0; n < N; ++n)
        energy += (double) sum[n] * (double) sum[n];
    std::cout << "Sum-of-bands energy: " << energy << " (expected ~1.0)\n";
    check (std::abs (energy - 1.0) < 1.0e-3, "Energy preserved (Parseval ~1.0)");

    // Magnitude flatness via FFT of the summed impulse response.
    juce::dsp::FFT fft (fftOrder);
    std::vector<float> fftBuf (2 * (size_t) N, 0.0f);
    for (int n = 0; n < N; ++n)
        fftBuf[(size_t) n] = sum[n];

    fft.performRealOnlyForwardTransform (fftBuf.data());

    float maxDevDb = 0.0f;
    for (int k = 1; k < N / 2; ++k) // skip DC and Nyquist edges
    {
        const float re  = fftBuf[(size_t) (2 * k)];
        const float im  = fftBuf[(size_t) (2 * k + 1)];
        const float mag = std::sqrt (re * re + im * im);
        const float dB  = 20.0f * std::log10 (std::max (mag, 1.0e-12f));
        maxDevDb = std::max (maxDevDb, std::abs (dB));
    }
    std::cout << "Max magnitude deviation from 0 dB: " << maxDevDb << " dB\n";
    check (maxDevDb < 0.1f, "Flat magnitude reconstruction (impulse, +/-0.1 dB)");

    // ---- Test 3: real-time cutoff sweep ------------------------------------
    xover.reset();
    xover.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);

    juce::Random rng (1234);
    const int M = 2048;
    std::vector<float> nin (M, 0.0f);
    std::vector<std::vector<float>> nb (numBands, std::vector<float> (M, 0.0f));
    std::vector<float*> np (numBands);
    for (int b = 0; b < numBands; ++b)
        np[b] = nb[b].data();

    bool clean = true;
    for (int blk = 0; blk < 200; ++blk)
    {
        // Sweep the middle crossover between ~500 Hz and ~3 kHz.
        const float lfo = 0.5f + 0.5f * std::sin ((float) blk * 0.05f);
        const float f2  = 500.0f + 2500.0f * lfo;
        xover.setCrossoverFrequencies (100.0f, f2, 10000.0f);

        for (int n = 0; n < M; ++n)
            nin[n] = rng.nextFloat() * 2.0f - 1.0f;

        xover.processBlock (nin.data(), np.data(), M);

        for (int n = 0; n < M; ++n)
        {
            float s = 0.0f;
            for (int b = 0; b < numBands; ++b)
                s += nb[b][n];
            if (! std::isfinite (s) || std::abs (s) > 8.0f)
                clean = false;
        }
    }
    check (clean, "Real-time cutoff sweep: finite, no click spikes");

    std::cout << "\n" << (failures == 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED")
              << " (" << failures << " failure(s))\n";
    return failures == 0 ? 0 : 1;
}
