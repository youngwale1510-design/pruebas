/*
    GhostBand - LogSmoother.h

    Tiny dependency-free parameter smoother that ramps in the log domain
    (multiplicative), which is the natural way to glide a frequency in Hz.
    Used for click-free crossover moves without pulling in JUCE.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <cmath>

namespace ghostband
{

class LogSmoother
{
public:
    void reset (double sampleRate, double rampSeconds) noexcept
    {
        coeff = (rampSeconds <= 0.0) ? 0.0f
                                     : std::exp (-1.0f / (float) (rampSeconds * sampleRate));
    }

    void setCurrentAndTarget (float value) noexcept
    {
        const float lv = std::log (value);
        logCur = logTgt = lv;
        current = value;
    }

    void setTarget (float value) noexcept
    {
        logTgt = std::log (value);
    }

    float getNextValue() noexcept
    {
        logCur = coeff * logCur + (1.0f - coeff) * logTgt;
        current = std::exp (logCur);
        return current;
    }

    bool isSmoothing() const noexcept
    {
        return std::fabs (logCur - logTgt) > 1.0e-6f;
    }

    float getCurrent() const noexcept { return current; }

private:
    float coeff  = 0.0f;
    float logCur = 0.0f;
    float logTgt = 0.0f;
    float current = 0.0f;
};

} // namespace ghostband
