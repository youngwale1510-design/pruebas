# GhostBand - Phase 1: LR4 Crossover Engine

ASCII-only note: all source files avoid accented/special characters for FL
Studio compatibility. This doc is Markdown (docs only), kept ASCII anyway.

## Goal

Split the input into 4 bands (Low, LowMid, HighMid, High) using 4th-order
Linkwitz-Riley (LR4) crossovers at 3 adjustable cut points (defaults 100 Hz,
1000 Hz, 10000 Hz), such that summing the 4 unprocessed bands reconstructs the
input with FLAT magnitude across the spectrum. Cutoffs are adjustable in real
time without clicks / zipper noise.

## Class structure

- `TptSvf`            : 2nd-order TPT state-variable filter (LP/BP/HP/AP). Core
                       primitive. Click-free under coefficient modulation.
- `LinkwitzRiley4`    : one LR4 split (LP + HP) = two cascaded Butterworth
                       2nd-order sections (LR4 = Butterworth^2).
- `Allpass2`          : 2nd-order allpass, phase-matched to an LR4 split, for
                       branch compensation.
- `MultibandCrossover4`: assembles the 4-band tree with allpass compensation.

## Why allpass compensation is required

LR4 property (single split): `LP + HP = 2nd-order allpass`, so `|LP + HP| = 1`
(flat magnitude, no polarity inversion).

A naive 3-split tree does NOT sum flat: crossover regions get several dB of
ripple because branch phases do not align. Fix: compensating allpass filters.

Topology:

```
                      in
                       |
                LR4 @ f2 (mid split)
                /                \
             low2                high2
              |                    |
         AP @ f3 (comp)       AP @ f1 (comp)
              |                    |
          LR4 @ f1              LR4 @ f3
          /      \              /      \
        Low    LowMid       HighMid   High
```

Summed transfer function (filters are LTI, so they commute):

```
Low + LowMid   = (LP1+HP1)*AP3*LP2 = AP1*AP3*LP2
HighMid + High = (LP3+HP3)*AP1*HP2 = AP3*AP1*HP2
--------------------------------------------------
total = AP1*AP3*(LP2+HP2) = AP1*AP3*AP2 = pure allpass  => flat magnitude
```

## Important: "identical" reconstruction

Because the summed response is an ALLPASS (flat magnitude, non-linear phase /
group delay), the reconstruction is NOT sample-for-sample identical in the time
domain. It equals the input passed through an allpass. Sample-identical
reconstruction would require linear-phase (FIR) crossovers, which add latency
and pre-ringing - undesirable for a punchy mix compressor. So the correct
acceptance test is MAGNITUDE flatness, not time-domain equality.

## Flat-sum verification (Tests/FlatSumTest.cpp)

1. Impulse test: feed a unit impulse, sum the 4 bands into h[n]. FFT h[n];
   the magnitude must be ~0 dB (flat) across all bins within tolerance
   (target: within +/- 0.1 dB). This proves flat magnitude reconstruction.
2. Broadband null-ish test: feed white noise, compare RMS of (sum of bands)
   vs RMS of an allpass-of-input reference; they must match closely.
3. Control test: run with compensation disabled to demonstrate the multi-dB
   crossover ripple that compensation removes (documents WHY the design is
   needed).
4. Real-time safety: sweep the cutoffs while streaming noise and confirm no
   NaNs/Infs and no discontinuity spikes (click-free check).

Pass criteria: (1) flat within +/- 0.1 dB and (2) RMS match within ~0.01 dB.
