/*
    GhostBand - GrMeter.h

    Vertical gain-reduction meter. Polls a reader function on a timer and
    draws a downward bar (0 dB at top). Header-only.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <juce_gui_basics/juce_gui_basics.h>
#include <functional>

#include "GhostLookAndFeel.h"

namespace ghostband
{

class GrMeter : public juce::Component,
                private juce::Timer
{
public:
    explicit GrMeter (std::function<float()> readerIn, float maxDbIn = 24.0f, bool horizontalIn = false)
        : reader (std::move (readerIn)), maxDb (maxDbIn), horizontal (horizontalIn)
    {
        startTimerHz (30);
    }

    ~GrMeter() override { stopTimer(); }

    void paint (juce::Graphics& g) override
    {
        auto b = getLocalBounds().toFloat();
        g.setColour (Colours::bg);
        g.fillRoundedRectangle (b, 2.0f);
        g.setColour (Colours::panelEdge);
        g.drawRoundedRectangle (b.reduced (0.5f), 2.0f, 1.0f);

        const float norm = juce::jlimit (0.0f, 1.0f, smoothed / maxDb);
        if (norm > 0.001f)
        {
            auto fill = b.reduced (2.0f);
            if (horizontal)
                fill = fill.withWidth (fill.getWidth() * norm);
            else
                fill = fill.withHeight (fill.getHeight() * norm);
            g.setColour (Colours::meterGr);
            g.fillRoundedRectangle (fill, 1.0f);
        }
    }

private:
    void timerCallback() override
    {
        const float v = reader ? reader() : 0.0f;
        // Fast attack, slower visual release.
        if (v > smoothed) smoothed = v;
        else              smoothed += (v - smoothed) * 0.3f;
        repaint();
    }

    std::function<float()> reader;
    float maxDb = 24.0f;
    bool  horizontal = false;
    float smoothed = 0.0f;
};

} // namespace ghostband
