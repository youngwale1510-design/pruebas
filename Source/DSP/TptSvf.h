/*
    GhostBand - TptSvf.h

    Core building block: a 2nd-order Topology-Preserving-Transform (TPT)
    State Variable Filter (Zavalishin / Cytomic form).

    Why TPT instead of a direct-form biquad?
      - Coefficient (cutoff) changes are click-free: the integrator states
        stay well-behaved when 'g' is modulated per sample. Direct-form
        biquads produce zipper noise on real-time coefficient updates.
      - It exposes lowpass, bandpass, highpass AND allpass from a single
        structure, which is exactly what a Linkwitz-Riley crossover with
        allpass phase compensation needs.

    Butterworth 2nd-order section => Q = 1/sqrt(2) => k = 1/Q = sqrt(2).

    NOTE: ASCII-only source (no accented / special characters) for FL Studio
    compatibility.
*/

#pragma once

#include <cmath>

namespace ghostband
{

class TptSvf
{
public:
    struct Outputs
    {
        float lp; // lowpass
        float bp; // bandpass
        float hp; // highpass
        float ap; // allpass (v0 - 2*k*bp)
    };

    void reset() noexcept
    {
        ic1eq = 0.0f;
        ic2eq = 0.0f;
    }

    // Set coefficients directly. 'g' = tan(pi * fc / fs), 'k' = 1 / Q.
    void setCoefficients (float newG, float newK) noexcept
    {
        g = newG;
        k = newK;
        updateDerived();
    }

    // Convenience: set from cutoff in Hz and Q.
    void setCutoff (float cutoffHz, float sampleRate, float q) noexcept
    {
        constexpr float pi = 3.14159265358979323846f;
        g = std::tan (pi * cutoffHz / sampleRate);
        k = 1.0f / q;
        updateDerived();
    }

    // Process one sample; returns all four filter outputs.
    Outputs process (float v0) noexcept
    {
        const float v3 = v0 - ic2eq;
        const float v1 = a1 * ic1eq + a2 * v3;
        const float v2 = ic2eq + a2 * ic1eq + a3 * v3;

        ic1eq = 2.0f * v1 - ic1eq;
        ic2eq = 2.0f * v2 - ic2eq;

        const float lp = v2;
        const float bp = v1;
        const float hp = v0 - k * v1 - v2;
        const float ap = v0 - 2.0f * k * v1;

        return { lp, bp, hp, ap };
    }

private:
    void updateDerived() noexcept
    {
        a1 = 1.0f / (1.0f + g * (g + k));
        a2 = g * a1;
        a3 = g * a2;
    }

    float g  = 0.0f;
    float k  = 1.41421356237f; // sqrt(2), Butterworth default
    float a1 = 0.0f, a2 = 0.0f, a3 = 0.0f;
    float ic1eq = 0.0f, ic2eq = 0.0f;
};

} // namespace ghostband
