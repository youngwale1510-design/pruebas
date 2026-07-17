/*
    GhostBand - GhostLookAndFeel.h

    Dark theme with green accents (a nod to the MC404) and a clean, custom
    rotary knob. Header-only.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace ghostband
{

namespace Colours
{
    const juce::Colour bg        (0xff12160f); // near-black green
    const juce::Colour panel     (0xff1b2118);
    const juce::Colour panelEdge (0xff2c3626);
    const juce::Colour accent    (0xff5fd15a); // MC404-ish green
    const juce::Colour accentDim (0xff3a7d38);
    const juce::Colour text      (0xffcfd8c8);
    const juce::Colour textDim   (0xff7d8a72);
    const juce::Colour meterGr   (0xffe0b23a);
}

class GhostLookAndFeel : public juce::LookAndFeel_V4
{
public:
    GhostLookAndFeel()
    {
        setColour (juce::ResizableWindow::backgroundColourId, Colours::bg);
        setColour (juce::Slider::textBoxTextColourId, Colours::text);
        setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        setColour (juce::Label::textColourId, Colours::text);
        setColour (juce::ComboBox::backgroundColourId, Colours::panel);
        setColour (juce::ComboBox::textColourId, Colours::text);
        setColour (juce::ComboBox::outlineColourId, Colours::panelEdge);
        setColour (juce::ComboBox::arrowColourId, Colours::accent);
        setColour (juce::PopupMenu::backgroundColourId, Colours::panel);
        setColour (juce::PopupMenu::highlightedBackgroundColourId, Colours::accentDim);
        setColour (juce::TextButton::buttonColourId, Colours::panel);
        setColour (juce::TextButton::buttonOnColourId, Colours::accentDim);
        setColour (juce::TextButton::textColourOnId, juce::Colours::white);
        setColour (juce::TextButton::textColourOffId, Colours::textDim);
    }

    void drawRotarySlider (juce::Graphics& g, int x, int y, int width, int height,
                           float pos, float startAngle, float endAngle,
                           juce::Slider&) override
    {
        const auto bounds = juce::Rectangle<int> (x, y, width, height).toFloat().reduced (4.0f);
        const float radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) * 0.5f;
        const auto centre = bounds.getCentre();
        const float thickness = radius * 0.28f;
        const float angle = startAngle + pos * (endAngle - startAngle);

        // Track.
        juce::Path track;
        track.addCentredArc (centre.x, centre.y, radius - thickness * 0.5f, radius - thickness * 0.5f,
                             0.0f, startAngle, endAngle, true);
        g.setColour (Colours::panelEdge);
        g.strokePath (track, juce::PathStrokeType (thickness, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

        // Value arc.
        juce::Path arc;
        arc.addCentredArc (centre.x, centre.y, radius - thickness * 0.5f, radius - thickness * 0.5f,
                           0.0f, startAngle, angle, true);
        g.setColour (Colours::accent);
        g.strokePath (arc, juce::PathStrokeType (thickness, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

        // Knob body.
        const float bodyR = radius - thickness - 2.0f;
        g.setColour (Colours::panel);
        g.fillEllipse (centre.x - bodyR, centre.y - bodyR, bodyR * 2.0f, bodyR * 2.0f);
        g.setColour (Colours::panelEdge);
        g.drawEllipse (centre.x - bodyR, centre.y - bodyR, bodyR * 2.0f, bodyR * 2.0f, 1.0f);

        // Pointer.
        juce::Path pointer;
        const float pl = bodyR * 0.9f;
        pointer.startNewSubPath (centre.x, centre.y);
        pointer.lineTo (centre.x + pl * std::cos (angle - juce::MathConstants<float>::halfPi),
                        centre.y + pl * std::sin (angle - juce::MathConstants<float>::halfPi));
        g.setColour (Colours::accent);
        g.strokePath (pointer, juce::PathStrokeType (2.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    }
};

} // namespace ghostband
