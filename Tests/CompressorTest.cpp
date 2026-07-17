/*
    GhostBand - CompressorTest.cpp

    Offline unit test for BandCompressor. Dependency-free (no JUCE), so it
    builds and runs with just a C++17 compiler.

    Checks:
      1. Static compression ratio accuracy (2:1).
      2. No reduction below threshold.
      3. BITE increases gain reduction on transients.
      4. In (bypass) passes audio unchanged, output stays finite.

    ASCII-only source for FL Studio compatibility.
*/

#include "DSP/BandCompressor.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

using namespace ghostband;

static float peakOf (const std::vector<float>& v, int from, int to)
{
    float p = 0.0f;
    for (int i = from; i < to; ++i)
        p = std::max (p, std::fabs (v[i]));
    return p;
}

int main()
{
    const double fs = 48000.0;
    bool allPass = true;

    // ---- Test 1: static ratio accuracy -------------------------------------
    {
        BandCompressor c;
        c.prepare (fs);
        c.setThresholdDb (-20.0f); c.setRatio (2.0f); c.setKneeDb (0.0f);
        c.setBite (0.0f); c.setAttackMs (1.0f); c.setReleaseMs (100.0f);
        c.reset();

        const int N = 48000;
        std::vector<float> L (N), R (N);
        const double w = 2.0 * M_PI * 1000.0 / fs;
        for (int n = 0; n < N; ++n) L[n] = R[n] = (float) std::sin (w * n); // 0 dBFS

        c.processBlock (L.data(), R.data(), N);
        const float outDb = 20.0f * std::log10 (peakOf (L, N - 4800, N));
        const bool ok = std::fabs (outDb - (-10.0f)) < 0.5f; // 20 dB over, 2:1 -> -10 dB
        std::printf ("[%s] static 2:1 ratio: out peak %.2f dB (expected -10.0)\n",
                     ok ? "PASS" : "FAIL", outDb);
        allPass &= ok;
    }

    // ---- Test 2: below threshold => no reduction ---------------------------
    {
        BandCompressor c;
        c.prepare (fs);
        c.setThresholdDb (-6.0f); c.setRatio (4.0f); c.setBite (0.0f);
        c.setAttackMs (5.0f); c.setReleaseMs (100.0f);
        c.reset();

        const int N = 24000;
        std::vector<float> L (N), R (N);
        const double w = 2.0 * M_PI * 1000.0 / fs;
        for (int n = 0; n < N; ++n) L[n] = R[n] = 0.1f * (float) std::sin (w * n); // -20 dB

        c.processBlock (L.data(), R.data(), N);
        const bool ok = c.getGainReductionDb() < 0.05f;
        std::printf ("[%s] below threshold: GR %.4f dB\n", ok ? "PASS" : "FAIL",
                     c.getGainReductionDb());
        allPass &= ok;
    }

    // ---- Test 3: BITE increases reduction on transients --------------------
    {
        auto runBurst = [&] (float bite) -> float
        {
            BandCompressor c;
            c.prepare (fs);
            c.setThresholdDb (-30.0f); c.setRatio (4.0f); c.setKneeDb (0.0f);
            c.setBite (bite); c.setAttackMs (1.0f); c.setReleaseMs (150.0f);
            c.reset();

            const int N = 8000;
            std::vector<float> L (N, 0.0f), R (N, 0.0f);
            const double w = 2.0 * M_PI * 1000.0 / fs;
            for (int n = 0; n < N; ++n) { const float s = 0.03f * (float) std::sin (w * n); L[n] = R[n] = s; }
            for (int n = 4000; n < 4050; ++n) L[n] = R[n] = 1.0f; // transient burst

            float maxGr = 0.0f;
            for (int n = 0; n < N; ++n) { c.processBlock (&L[n], &R[n], 1); maxGr = std::max (maxGr, c.getGainReductionDb()); }
            return maxGr;
        };

        const float grNoBite = runBurst (0.0f);
        const float grBite   = runBurst (5.0f);
        const bool ok = grBite > grNoBite + 1.0f;
        std::printf ("[%s] BITE transient: bite=0 -> %.2f dB, bite=5 -> %.2f dB\n",
                     ok ? "PASS" : "FAIL", grNoBite, grBite);
        allPass &= ok;
    }

    // ---- Test 4: In (bypass) passes audio, finite output -------------------
    {
        BandCompressor c;
        c.prepare (fs);
        c.setThresholdDb (-40.0f); c.setRatio (8.0f); c.setBite (2.0f);
        c.setCompIn (false);
        c.reset();

        const int N = 1000;
        std::vector<float> L (N), R (N);
        for (int n = 0; n < N; ++n) L[n] = R[n] = 0.5f;

        c.processBlock (L.data(), R.data(), N);
        const bool ok = std::fabs (L[N - 1] - 0.5f) < 1.0e-4f && std::isfinite (L[N - 1]);
        std::printf ("[%s] bypass: out %.4f (expected 0.5)\n", ok ? "PASS" : "FAIL", L[N - 1]);
        allPass &= ok;
    }

    // ---- Test 5: REL 2 (dual-stage) releases slower than REL 1 -------------
    {
        auto releaseHalfTime = [&] (int mode) -> int
        {
            BandCompressor c;
            c.prepare (fs);
            c.setThresholdDb (-30.0f); c.setRatio (4.0f); c.setKneeDb (0.0f);
            c.setBite (0.0f); c.setAttackMs (1.0f); c.setReleaseMs (100.0f);
            c.setReleaseMode (mode);
            c.reset();

            const int N = 20000;
            std::vector<float> L (N), R (N);
            const double w = 2.0 * M_PI * 1000.0 / fs;
            for (int n = 0; n < N; ++n) L[n] = R[n] = (float) std::sin (w * n);
            c.processBlock (L.data(), R.data(), N);
            const float steady = c.getGainReductionDb();

            int count = 0;
            for (int n = 0; n < (int) fs; ++n)
            {
                float l = 0.0f, r = 0.0f;
                c.processBlock (&l, &r, 1);
                ++count;
                if (c.getGainReductionDb() < steady * 0.5f) break;
            }
            return count;
        };

        const int t1 = releaseHalfTime (0); // REL 1
        const int t2 = releaseHalfTime (1); // REL 2
        const bool ok = t2 > t1;
        std::printf ("[%s] REL2 dual-stage slower than REL1: t1=%d, t2=%d samples\n",
                     ok ? "PASS" : "FAIL", t1, t2);
        allPass &= ok;
    }

    std::printf ("\n%s\n", allPass ? "ALL COMPRESSOR TESTS PASSED" : "SOME TESTS FAILED");
    return allPass ? 0 : 1;
}
