/*
    GhostBand - EngineRoutingTest.cpp

    Offline unit test for GhostBandEngine (dependency-free, no JUCE).

    Checks:
      1. Bypass passthrough: all comps In=off, all bands -> Main, output 0 dB
         => output equals allpass(input) => energy preserved (flat sum works
         through the full engine).
      2. Routing isolation: send the Low band to a bus whose level is muted
         (-inf) => a low-frequency tone is removed from the output.
      3. Per-band Mute: muting the High band removes a high tone.
      4. Parallel identity: routing one band to R1 (gain 1) vs all on Main
         gives the same output energy (buses sum correctly).

    ASCII-only source for FL Studio compatibility.
*/

#include "DSP/GhostBandEngine.h"

#include <cmath>
#include <cstdio>
#include <vector>

using namespace ghostband;

static double rms (const std::vector<float>& v)
{
    double e = 0.0;
    for (float s : v) e += (double) s * s;
    return std::sqrt (e / (double) v.size());
}

static void makeSine (std::vector<float>& v, double f, double fs)
{
    const double w = 2.0 * M_PI * f / fs;
    for (size_t n = 0; n < v.size(); ++n) v[n] = (float) std::sin (w * (double) n);
}

static void makeNoise (std::vector<float>& v, unsigned seed)
{
    unsigned s = seed;
    for (auto& x : v) { s = s * 1664525u + 1013904223u; x = ((float) (s >> 8) / 8388608.0f) - 1.0f; }
}

// Run the engine over a full signal in blocks of 'block' samples.
static void runEngine (GhostBandEngine& e, std::vector<float>& L, std::vector<float>& R, int block)
{
    const int N = (int) L.size();
    for (int i = 0; i < N; i += block)
    {
        const int n = std::min (block, N - i);
        e.process (&L[(size_t) i], &R[(size_t) i], n);
    }
}

int main()
{
    const double fs = 48000.0;
    const int    block = 512;
    const int    N = 48000;
    bool allPass = true;

    // ---- Test 1: bypass passthrough (energy preserved) ---------------------
    {
        GhostBandEngine e;
        e.prepare (fs, block);
        e.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);
        e.setOutputGainDb (0.0f);
        for (int b = 0; b < 4; ++b) { e.band (b).setCompIn (false); e.setBandRouting (b, GhostBandEngine::Main); }
        e.setBusGainDb (0, 0.0f);

        std::vector<float> L (N), R (N), inRef;
        makeNoise (L, 12345); R = L; inRef = L;
        runEngine (e, L, R, block);

        // Skip the first block to let filter transients settle.
        std::vector<float> outTail (L.begin() + block, L.end());
        std::vector<float> inTail  (inRef.begin() + block, inRef.end());
        const double dB = 20.0 * std::log10 (rms (outTail) / rms (inTail));
        const bool ok = std::fabs (dB) < 0.1;
        std::printf ("[%s] bypass passthrough: out/in = %+.4f dB\n", ok ? "PASS" : "FAIL", dB);
        allPass &= ok;
    }

    // ---- Test 2a: routing plumbing (all bands -> muted bus => silence) ------
    {
        GhostBandEngine e;
        e.prepare (fs, block);
        e.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);
        e.setOutputGainDb (0.0f);
        for (int b = 0; b < 4; ++b) { e.band (b).setCompIn (false); e.setBandRouting (b, GhostBandEngine::R2); }
        e.setBusGainDb (0, 0.0f);
        e.setBusGainDb (2, -120.0f); // everything routed to a muted bus

        std::vector<float> L (N), R (N);
        makeNoise (L, 555); R = L;
        runEngine (e, L, R, block);
        std::vector<float> tail (L.begin() + block, L.end());
        const double dB = 20.0 * std::log10 (rms (tail) + 1e-12);
        const bool ok = dB < -80.0;
        std::printf ("[%s] routing plumbing: all bands -> muted bus = %.1f dB\n", ok ? "PASS" : "FAIL", dB);
        allPass &= ok;
    }

    // ---- Test 2b: routing isolation (interior band -> muted bus) -----------
    {
        GhostBandEngine e;
        e.prepare (fs, block);
        e.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);
        e.setOutputGainDb (0.0f);
        for (int b = 0; b < 4; ++b) e.band (b).setCompIn (false);
        // LowMid band (100..1000, center ~316 Hz) -> R2, others -> Main.
        e.setBandRouting (1, GhostBandEngine::R2);
        e.setBandRouting (0, GhostBandEngine::Main);
        e.setBandRouting (2, GhostBandEngine::Main);
        e.setBandRouting (3, GhostBandEngine::Main);
        e.setBusGainDb (0, 0.0f);
        e.setBusGainDb (2, -120.0f); // R2 muted

        std::vector<float> L (N), R (N), inRef;
        makeSine (L, 316.0, fs); R = L; inRef = L; // interior of LowMid
        runEngine (e, L, R, block);

        std::vector<float> outTail (L.begin() + 8 * block, L.end());
        std::vector<float> inTail  (inRef.begin() + 8 * block, inRef.end());
        const double dB = 20.0 * std::log10 (rms (outTail) / rms (inTail) + 1e-12);
        const bool ok = dB < -34.0; // ~40 dB neighbor rejection removes the tone
        std::printf ("[%s] routing isolation: 316 Hz (LowMid) through muted bus = %.1f dB\n", ok ? "PASS" : "FAIL", dB);
        allPass &= ok;
    }

    // ---- Test 3: per-band Mute (interior band) -----------------------------
    {
        GhostBandEngine e;
        e.prepare (fs, block);
        e.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);
        e.setOutputGainDb (0.0f);
        for (int b = 0; b < 4; ++b) { e.band (b).setCompIn (false); e.setBandRouting (b, GhostBandEngine::Main); }
        e.setBusGainDb (0, 0.0f);
        e.band (2).setMuted (true); // mute HighMid band (1000..10000)

        std::vector<float> L (N), R (N), inRef;
        makeSine (L, 3162.0, fs); R = L; inRef = L; // interior of HighMid
        runEngine (e, L, R, block);

        std::vector<float> outTail (L.begin() + 8 * block, L.end());
        std::vector<float> inTail  (inRef.begin() + 8 * block, inRef.end());
        const double dB = 20.0 * std::log10 (rms (outTail) / rms (inTail) + 1e-12);
        const bool ok = dB < -34.0;
        std::printf ("[%s] band mute: 3162 Hz with HighMid muted = %.1f dB\n", ok ? "PASS" : "FAIL", dB);
        allPass &= ok;
    }

    // ---- Test 4: parallel identity (R1 gain 1 == Main) ---------------------
    {
        auto energyWith = [&] (bool routeLowToR1) -> double
        {
            GhostBandEngine e;
            e.prepare (fs, block);
            e.setCrossoverFrequencies (100.0f, 1000.0f, 10000.0f);
            e.setOutputGainDb (0.0f);
            for (int b = 0; b < 4; ++b) { e.band (b).setCompIn (false); e.setBandRouting (b, GhostBandEngine::Main); }
            if (routeLowToR1) e.setBandRouting (0, GhostBandEngine::R1);
            e.setBusGainDb (0, 0.0f);
            e.setBusGainDb (1, 0.0f); // R1 unity

            std::vector<float> L (N), R (N);
            makeNoise (L, 777); R = L;
            runEngine (e, L, R, block);
            std::vector<float> tail (L.begin() + block, L.end());
            return rms (tail);
        };
        const double a = energyWith (false);
        const double b = energyWith (true);
        const double dB = 20.0 * std::log10 (b / a);
        const bool ok = std::fabs (dB) < 0.01;
        std::printf ("[%s] parallel identity: R1(unity) vs Main = %+.5f dB\n", ok ? "PASS" : "FAIL", dB);
        allPass &= ok;
    }

    std::printf ("\n%s\n", allPass ? "ALL ENGINE TESTS PASSED" : "SOME TESTS FAILED");
    return allPass ? 0 : 1;
}
