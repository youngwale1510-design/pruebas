/*
    GhostBand - Allpass2.h

    2nd-order allpass used for phase compensation between crossover branches
    in the 4-band tree. Its phase response matches exactly the (LP + HP) sum
    of an LR4 split at the same frequency, which is what makes the full 4-band
    reconstruction sum to a pure allpass (flat magnitude).

    Implemented as the allpass output of the TPT SVF with Butterworth Q,
    so it is guaranteed phase-matched to LinkwitzRiley4 at the same cutoff.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include "TptSvf.h"

namespace ghostband
{

class Allpass2
{
public:
    void reset() noexcept { svf.reset(); }

    void setCutoff (float cutoffHz, float sampleRate) noexcept
    {
        constexpr float pi = 3.14159265358979323846f;
        constexpr float k  = 1.41421356237f; // match LR4 Butterworth Q
        svf.setCoefficients (std::tan (pi * cutoffHz / sampleRate), k);
    }

    float process (float x) noexcept
    {
        return svf.process (x).ap;
    }

private:
    TptSvf svf;
};

} // namespace ghostband
