/*
    GhostBand - BandCompressor.cpp

    Implementation of the per-band feed-forward compressor. See header for the
    design overview. Dependency-free (no JUCE) so it stays unit-testable.

    ASCII-only source for FL Studio compatibility.
*/

#include "BandCompressor.h"

namespace ghostband
{

static inline float onePoleCoeff (float timeSeconds, double fs) noexcept
{
    if (timeSeconds <= 0.0f)
        return 0.0f; // instantaneous
    return std::exp (-1.0f / (timeSeconds * (float) fs));
}

static inline float dbToLin (float db) noexcept { return std::pow (10.0f, db * 0.05f); }

void BandCompressor::prepare (double sampleRate) noexcept
{
    fs = sampleRate;

    // ~5 ms parameter smoothing for click-free control moves.
    paramSmoothCoeff = onePoleCoeff (0.005f, fs);

    setAttackMs (attackMs);
    setReleaseMs (releaseMs);

    // BITE followers: fast peak env releases in ~5 ms, slow reference ~50 ms.
    biteFastCoeff = onePoleCoeff (0.005f, fs);
    biteSlowCoeff = onePoleCoeff (0.050f, fs);

    reset();
}

void BandCompressor::reset() noexcept
{
    inputGainDb = targetInputGainDb;
    thresholdDb = targetThresholdDb;
    ratio       = targetRatio;
    kneeDb      = targetKneeDb;
    bite        = targetBite;

    grEnvDb = 0.0f;
    relStage2 = 0.0f;
    fastEnv = 0.0f;
    slowEnv = 0.0f;
    autoRelState = 0.0f;
    currentGrDb = 0.0f;
}

void BandCompressor::setAttackMs (float ms) noexcept
{
    attackMs = (ms < 0.0f ? 0.0f : ms);
    attackCoeff = onePoleCoeff (attackMs * 0.001f, fs);
}

void BandCompressor::setReleaseMs (float ms) noexcept
{
    releaseMs = (ms < 1.0f ? 1.0f : ms);
    releaseCoeff  = onePoleCoeff (releaseMs * 0.001f, fs);
    releaseCoeff2 = onePoleCoeff (releaseMs * 0.002f, fs); // slower tail for REL2
}

void BandCompressor::updateSmoothedParams() noexcept
{
    const float c = paramSmoothCoeff;
    inputGainDb = c * inputGainDb + (1.0f - c) * targetInputGainDb;
    thresholdDb = c * thresholdDb + (1.0f - c) * targetThresholdDb;
    ratio       = c * ratio       + (1.0f - c) * targetRatio;
    kneeDb      = c * kneeDb       + (1.0f - c) * targetKneeDb;
    bite        = c * bite         + (1.0f - c) * targetBite;
}

float BandCompressor::computeStaticGrDb (float levelDb) const noexcept
{
    const float over = levelDb - thresholdDb;
    const float half = kneeDb * 0.5f;
    const float slope = 1.0f - 1.0f / ratio; // reduction per dB above threshold

    if (kneeDb > 0.0f && over > -half && over < half)
    {
        // Soft-knee region (quadratic interpolation).
        const float t = over + half;
        return slope * (t * t) / (2.0f * kneeDb);
    }

    if (over <= -half)
        return 0.0f;

    return over * slope;
}

void BandCompressor::processBlock (float* left, float* right, int numSamples) noexcept
{
    for (int n = 0; n < numSamples; ++n)
    {
        updateSmoothedParams();

        const float inGain = dbToLin (inputGainDb);
        float l0 = left[n]  * inGain;
        float r0 = right[n] * inGain;

        if (muted)
        {
            left[n] = 0.0f;
            right[n] = 0.0f;
            currentGrDb = 0.0f;
            continue;
        }

        // Stereo-linked peak detection (post input gain).
        const float inst = std::fmax (std::fabs (l0), std::fabs (r0));

        // BITE: fast peak env (instant attack) vs slow reference; the positive
        // overshoot is the transient emphasis added to the detector.
        if (inst > fastEnv) fastEnv = inst;
        else                fastEnv *= biteFastCoeff;
        slowEnv = biteSlowCoeff * slowEnv + (1.0f - biteSlowCoeff) * inst;

        float transient = fastEnv - slowEnv;
        if (transient < 0.0f) transient = 0.0f;

        const float detLin = inst + bite * transient;
        const float levelDb = 20.0f * std::log10 (detLin + 1.0e-9f);

        const float staticGr = computeStaticGrDb (levelDb); // >= 0

        // Ballistics on the gain-reduction envelope (decoupled smooth).
        if (staticGr > grEnvDb)
        {
            grEnvDb   = attackCoeff * grEnvDb + (1.0f - attackCoeff) * staticGr; // attack
            relStage2 = grEnvDb;
        }
        else if (releaseMode == 1)
        {
            // REL 2: dual-stage release -> smoother, more natural tail.
            relStage2 = releaseCoeff  * relStage2 + (1.0f - releaseCoeff)  * staticGr;
            grEnvDb   = releaseCoeff2 * grEnvDb   + (1.0f - releaseCoeff2) * relStage2;
        }
        else if (releaseMode == 2)
        {
            // AUTO: program-dependent release (longer when reduction sustained).
            float relMsEff = releaseMs * (1.0f + autoRelState * 0.5f);
            if (relMsEff > 2000.0f) relMsEff = 2000.0f;
            const float rc = onePoleCoeff (relMsEff * 0.001f, fs);
            grEnvDb   = rc * grEnvDb + (1.0f - rc) * staticGr;
            relStage2 = grEnvDb;
        }
        else
        {
            // REL 1: standard single-stage release.
            grEnvDb   = releaseCoeff * grEnvDb + (1.0f - releaseCoeff) * staticGr;
            relStage2 = grEnvDb;
        }

        // Sustain follower used by AUTO mode.
        autoRelState = 0.9995f * autoRelState + 0.0005f * grEnvDb;

        float gainLin = 1.0f;
        if (compIn)
        {
            gainLin = dbToLin (-grEnvDb);
            currentGrDb = grEnvDb;
        }
        else
        {
            currentGrDb = 0.0f; // In off: passthrough (input gain still applied)
        }

        left[n]  = l0 * gainLin;
        right[n] = r0 * gainLin;
    }
}

} // namespace ghostband
