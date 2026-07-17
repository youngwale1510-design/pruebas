/*
    GhostBand - CrossoverDisplay.h

    Top graphic: shows the 4 bands on a log frequency scale, with the 3
    crossover points as draggable vertical handles bound to the x1/x2/x3
    parameters. Header-only.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "GhostLookAndFeel.h"

namespace ghostband
{

class CrossoverDisplay : public juce::Component,
                         private juce::Timer
{
public:
    explicit CrossoverDisplay (juce::AudioProcessorValueTreeState& s) : apvts (s)
    {
        startTimerHz (24);
    }

    ~CrossoverDisplay() override { stopTimer(); }

    void paint (juce::Graphics& g) override
    {
        auto b = getLocalBounds().toFloat();
        g.setColour (Colours::panel);
        g.fillRoundedRectangle (b, 4.0f);
        g.setColour (Colours::panelEdge);
        g.drawRoundedRectangle (b.reduced (0.5f), 4.0f, 1.0f);

        auto area = b.reduced (8.0f);
        const float f1 = getFreq ("x1"), f2 = getFreq ("x2"), f3 = getFreq ("x3");
        const float x1 = freqToX (f1, area), x2 = freqToX (f2, area), x3 = freqToX (f3, area);

        const juce::Colour bandCols[4] = {
            juce::Colour (0xff2f5a2c), juce::Colour (0xff3f7a3a),
            juce::Colour (0xff5a8f3a), juce::Colour (0xff7a9a3a)
        };
        const float edges[5] = { area.getX(), x1, x2, x3, area.getRight() };
        for (int i = 0; i < 4; ++i)
        {
            juce::Rectangle<float> r (edges[i], area.getY(), edges[i + 1] - edges[i], area.getHeight());
            g.setColour (bandCols[i].withAlpha (0.55f));
            g.fillRect (r.reduced (1.0f, 0.0f));
        }

        // Band labels.
        const char* names[4] = { "LOW", "LOW-MID", "HIGH-MID", "HIGH" };
        g.setColour (Colours::text);
        g.setFont (12.0f);
        for (int i = 0; i < 4; ++i)
        {
            juce::Rectangle<float> r (edges[i], area.getY(), edges[i + 1] - edges[i], area.getHeight());
            g.drawText (names[i], r.toNearestInt(), juce::Justification::centredTop, false);
        }

        // Crossover handles + frequency readouts.
        const float xs[3] = { x1, x2, x3 };
        const float fs[3] = { f1, f2, f3 };
        for (int i = 0; i < 3; ++i)
        {
            g.setColour (Colours::accent);
            g.drawLine (xs[i], area.getY(), xs[i], area.getBottom(), 2.0f);
            g.setColour (Colours::text);
            g.setFont (11.0f);
            juce::String label = (fs[i] >= 1000.0f)
                ? juce::String (fs[i] / 1000.0f, 1) + "k"
                : juce::String (juce::roundToInt (fs[i]));
            g.drawText (label, juce::Rectangle<float> (xs[i] - 24.0f, area.getBottom() - 16.0f, 48.0f, 14.0f).toNearestInt(),
                        juce::Justification::centred, false);
        }
    }

    void mouseDown (const juce::MouseEvent& e) override { dragParam = nearestHandle (e.position.x); }
    void mouseDrag (const juce::MouseEvent& e) override
    {
        if (dragParam < 0) return;
        auto area = getLocalBounds().toFloat().reduced (8.0f);
        const float f = xToFreq (juce::jlimit (area.getX(), area.getRight(), e.position.x), area);
        const char* id = (dragParam == 0 ? "x1" : dragParam == 1 ? "x2" : "x3");
        if (auto* p = apvts.getParameter (id))
            p->setValueNotifyingHost (p->convertTo0to1 (f));
    }
    void mouseUp (const juce::MouseEvent&) override { dragParam = -1; }

private:
    void timerCallback() override { repaint(); }

    float getFreq (const char* id) const
    {
        if (auto* a = apvts.getRawParameterValue (id)) return a->load();
        return 1000.0f;
    }

    static float logFreqNorm (float f) { return std::log (f / 20.0f) / std::log (20000.0f / 20.0f); }
    static float freqToX (float f, juce::Rectangle<float> area) { return area.getX() + logFreqNorm (f) * area.getWidth(); }
    static float xToFreq (float x, juce::Rectangle<float> area)
    {
        const float n = (x - area.getX()) / area.getWidth();
        return 20.0f * std::pow (20000.0f / 20.0f, n);
    }

    int nearestHandle (float mouseX)
    {
        auto area = getLocalBounds().toFloat().reduced (8.0f);
        const float xs[3] = { freqToX (getFreq ("x1"), area), freqToX (getFreq ("x2"), area), freqToX (getFreq ("x3"), area) };
        int best = -1; float bestD = 12.0f;
        for (int i = 0; i < 3; ++i)
        {
            const float d = std::abs (mouseX - xs[i]);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    juce::AudioProcessorValueTreeState& apvts;
    int dragParam = -1;
};

} // namespace ghostband
