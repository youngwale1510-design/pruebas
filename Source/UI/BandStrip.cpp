/*
    GhostBand - BandStrip.cpp

    ASCII-only source for FL Studio compatibility.
*/

#include "BandStrip.h"
#include "GhostLookAndFeel.h"

namespace ghostband
{

static juce::String bandId (int band, const char* name)
{
    return juce::String ("b") + juce::String (band) + "_" + name;
}

BandStrip::BandStrip (juce::AudioProcessorValueTreeState& s, int bandIndex,
                      const juce::String& title, std::function<float()> grReader)
    : apvts (s), index (bandIndex), bandTitle (title),
      meter (std::move (grReader))
{
    addKnob (gain,    bandId (index, "gain"),    "GAIN");
    addKnob (thresh,  bandId (index, "thresh"),  "THRESH");
    addKnob (ratio,   bandId (index, "ratio"),   "COMP");
    addKnob (knee,    bandId (index, "knee"),    "KNEE");
    addKnob (bite,    bandId (index, "bite"),    "BITE");
    addKnob (attack,  bandId (index, "attack"),  "ATTACK");
    addKnob (release, bandId (index, "release"), "REL");
    knobs = { &gain, &thresh, &ratio, &knee, &bite, &attack, &release };

    for (auto* b : { &inBtn, &muteBtn, &autoBtn })
    {
        b->setClickingTogglesState (true);
        addAndMakeVisible (*b);
    }
    inAtt   = std::make_unique<ButtonAtt> (apvts, bandId (index, "in"),      inBtn);
    muteAtt = std::make_unique<ButtonAtt> (apvts, bandId (index, "mute"),    muteBtn);
    autoAtt = std::make_unique<ButtonAtt> (apvts, bandId (index, "autorel"), autoBtn);

    routeBox.addItem ("Main", 1);
    routeBox.addItem ("R1", 2);
    routeBox.addItem ("R2", 3);
    addAndMakeVisible (routeBox);
    routeAtt = std::make_unique<ComboAtt> (apvts, bandId (index, "route"), routeBox);

    addAndMakeVisible (meter);
}

void BandStrip::addKnob (Knob& k, const juce::String& paramId, const juce::String& text)
{
    k.slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    k.slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 56, 14);
    addAndMakeVisible (k.slider);
    k.att = std::make_unique<SliderAtt> (apvts, paramId, k.slider);
    k.slider.setNumDecimalPlacesToDisplay (1); // after attachment so it sticks

    k.label.setText (text, juce::dontSendNotification);
    k.label.setJustificationType (juce::Justification::centred);
    k.label.setFont (juce::Font (10.0f));
    k.label.setColour (juce::Label::textColourId, Colours::textDim);
    addAndMakeVisible (k.label);
}

void BandStrip::paint (juce::Graphics& g)
{
    auto b = getLocalBounds().toFloat();
    g.setColour (Colours::panel);
    g.fillRoundedRectangle (b, 5.0f);
    g.setColour (Colours::panelEdge);
    g.drawRoundedRectangle (b.reduced (0.5f), 5.0f, 1.0f);

    g.setColour (Colours::accent);
    g.setFont (juce::Font (13.0f, juce::Font::bold));
    g.drawText (bandTitle, getLocalBounds().removeFromTop (22), juce::Justification::centred, false);
}

void BandStrip::resized()
{
    auto area = getLocalBounds().reduced (6);
    area.removeFromTop (22); // title

    // GR meter on the right edge.
    auto meterArea = area.removeFromRight (14);
    meter.setBounds (meterArea.reduced (0, 2));
    area.removeFromRight (4);

    // Bottom row: In / Mute / Auto + Route.
    auto bottom = area.removeFromBottom (46);
    auto btnRow = bottom.removeFromTop (22);
    const int bw = btnRow.getWidth() / 3;
    inBtn.setBounds   (btnRow.removeFromLeft (bw).reduced (1));
    muteBtn.setBounds (btnRow.removeFromLeft (bw).reduced (1));
    autoBtn.setBounds (btnRow.reduced (1));
    routeBox.setBounds (bottom.reduced (1, 2));

    // Knob grid: 2 columns.
    const int cols = 2;
    const int rows = 4; // 7 knobs -> 4 rows (last cell empty)
    const int cw = area.getWidth() / cols;
    const int rh = area.getHeight() / rows;
    for (size_t i = 0; i < knobs.size(); ++i)
    {
        const int r = (int) i / cols;
        const int c = (int) i % cols;
        juce::Rectangle<int> cell (area.getX() + c * cw, area.getY() + r * rh, cw, rh);
        auto& k = *knobs[i];
        k.label.setBounds (cell.removeFromTop (12));
        k.slider.setBounds (cell.reduced (2));
    }
}

} // namespace ghostband
