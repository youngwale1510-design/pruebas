/*
    GhostBand - LinkwitzRiley4.h

    A 4th-order Linkwitz-Riley crossover (single split point) built as two
    cascaded 2nd-order Butterworth sections (LR4 = Butterworth^2), using the
    TPT SVF primitive.

    Key LR4 property that makes flat summing possible:
        LR4_LP(z) + LR4_HP(z) = 2nd-order allpass  =>  |LP + HP| = 1
    i.e. summing the low and high outputs of ONE split gives perfectly flat
    magnitude, with NO polarity inversion (unlike LR2, which needs it).

    This class handles a single audio channel. For stereo, use one instance
    per channel so the filter states stay independent.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include "TptSvf.h"

namespace ghostband
{

class LinkwitzRiley4
{
public:
    struct Bands
    {
        float low;
        float high;
    };

    void reset() noexcept
    {
        lp[0].reset(); lp[1].reset();
        hp[0].reset(); hp[1].reset();
    }

    // Set the crossover frequency (Hz). Both the LP and HP cascades share the
    // same coefficients (Butterworth Q), but keep independent state.
    void setCutoff (float cutoffHz, float sampleRate) noexcept
    {
        constexpr float pi = 3.14159265358979323846f;
        constexpr float k  = 1.41421356237f; // Butterworth Q = 1/sqrt(2)
        const float g = std::tan (pi * cutoffHz / sampleRate);

        lp[0].setCoefficients (g, k);
        lp[1].setCoefficients (g, k);
        hp[0].setCoefficients (g, k);
        hp[1].setCoefficients (g, k);
    }

    // Split one sample into low and high bands.
    Bands process (float x) noexcept
    {
        // LR4 low  = two cascaded Butterworth lowpass sections
        const float low  = lp[1].process (lp[0].process (x).lp).lp;
        // LR4 high = two cascaded Butterworth highpass sections
        const float high = hp[1].process (hp[0].process (x).hp).hp;
        return { low, high };
    }

private:
    TptSvf lp[2]; // lowpass cascade
    TptSvf hp[2]; // highpass cascade
};

} // namespace ghostband
