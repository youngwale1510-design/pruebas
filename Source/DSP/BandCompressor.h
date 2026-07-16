/*
    GhostBand - BandCompressor.h

    Per-band feed-forward compressor. One instance drives one crossover band
    (stereo-linked detection). Parameter names mirror the McDSP MC404 layout
    so the workflow is familiar: GAIN / THRESH / COMP / KNEE / BITE / ATTACK /
    REL, plus AUTO release and an In (bypass) / Mute switch.

    Design notes:
      - Decoupled, smooth peak detector operating on the gain-reduction in dB
        (click-free, well-behaved attack/release).
      - Soft-knee gain computer (Giannoulis/Reiss form). KNEE = 0 -> hard knee.
      - BITE: a secondary FAST envelope that measures the transient overshoot
        (fast level above the running level) and adds it to the detector, so
        the compressor "sees" transients harder -> more attack bite / punch.
      - AUTO release: program-dependent release (longer when reduction is
        sustained, snappier on short transients).

    This core is dependency-free (no JUCE) so it can be unit-tested offline.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <cmath>

namespace ghostband
{

class BandCompressor
{
public:
    void prepare (double sampleRate) noexcept;
    void reset() noexcept;

    // ---- Parameters (raw target values; smoothed internally) --------------
    void setInputGainDb (float db) noexcept   { targetInputGainDb = db; }
    void setThresholdDb (float db) noexcept   { targetThresholdDb = db; }
    void setRatio       (float r)  noexcept   { targetRatio = (r < 1.0f ? 1.0f : r); } // COMP
    void setKneeDb      (float db) noexcept   { targetKneeDb = (db < 0.0f ? 0.0f : db); }
    void setBite        (float b)  noexcept   { targetBite = (b < 0.0f ? 0.0f : b); }
    void setAttackMs    (float ms) noexcept;
    void setReleaseMs   (float ms) noexcept;
    void setAutoRelease (bool on)  noexcept   { autoRelease = on; }

    // In = compression engaged. When false, the band audio passes through
    // uncompressed (input gain still applies). Mute silences the band.
    void setCompIn (bool on)  noexcept { compIn = on; }
    void setMuted  (bool on)  noexcept { muted = on; }

    // Process a stereo pair in place with stereo-linked detection.
    // For mono, pass the same pointer for left and right.
    void processBlock (float* left, float* right, int numSamples) noexcept;

    // Most recent gain reduction (positive dB) for metering.
    float getGainReductionDb() const noexcept { return currentGrDb; }

private:
    float computeStaticGrDb (float levelDb) const noexcept; // >= 0 reduction
    void  updateSmoothedParams() noexcept;

    double fs = 44100.0;

    // Smoothed parameter state (one-pole per-sample smoothing).
    float inputGainDb = 0.0f, thresholdDb = 0.0f, ratio = 2.0f, kneeDb = 0.0f, bite = 0.0f;
    float targetInputGainDb = 0.0f, targetThresholdDb = 0.0f, targetRatio = 2.0f;
    float targetKneeDb = 0.0f, targetBite = 0.0f;
    float paramSmoothCoeff = 0.0f; // set in prepare()

    // Ballistics.
    float attackMs = 2.5f, releaseMs = 250.0f;
    float attackCoeff = 0.0f, releaseCoeff = 0.0f;
    bool  autoRelease = false;

    // Envelope state.
    float grEnvDb = 0.0f;   // smoothed gain reduction (dB, >= 0)
    float fastEnv = 0.0f;   // fast linear peak follower (for BITE)
    float slowEnv = 0.0f;   // slow linear peak follower (for BITE reference)
    float autoRelState = 0.0f; // slow follower of reduction, for auto release

    // Bite follower coefficients.
    float biteFastCoeff = 0.0f, biteSlowCoeff = 0.0f;

    bool compIn = true;
    bool muted  = false;

    float currentGrDb = 0.0f;
};

} // namespace ghostband
