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
                      const juce::String& title, juce::Colour tab,
                      std::function<float()> grReader)
    : apvts (s), index (bandIndex), bandTitle (title), tabColour (tab),
      meter (std::move (grReader), 24.0f, true)
{
    addKnob (gain,    bandId (index, "gain"),    "GAIN");
    addKnob (thresh,  bandId (index, "thresh"),  "THRESH");
    addKnob (ratio,   bandId (index, "ratio"),   "COMP");
    addKnob (knee,    bandId (index, "knee"),    "KNEE");
    addKnob (bite,    bandId (index, "bite"),    "BITE");
    addKnob (attack,  bandId (index, "attack"),  "ATTACK");
    addKnob (release, bandId (index, "release"), "REL");
    knobs = { &gain, &thresh, &ratio, &knee, &bite, &attack, &release };

    for (auto* b : { &inBtn, &muteBtn })
    {
        b->setClickingTogglesState (true);
        addAndMakeVisible (*b);
    }
    inAtt   = std::make_unique<ButtonAtt> (apvts, bandId (index, "in"),   inBtn);
    muteAtt = std::make_unique<ButtonAtt> (apvts, bandId (index, "mute"), muteBtn);

    // Release-mode radio group (REL1 / REL2 / AUTO) bound to the choice param.
    for (auto* b : { &rel1Btn, &rel2Btn, &autoBtn })
    {
        b->setClickingTogglesState (true);
        b->setRadioGroupId (100 + index);
        addAndMakeVisible (*b);
    }
    rel1Btn.onClick = [this] { setRelMode (0); };
    rel2Btn.onClick = [this] { setRelMode (1); };
    autoBtn.onClick = [this] { setRelMode (2); };

    relModeAtt = std::make_unique<juce::ParameterAttachment> (
        *apvts.getParameter (bandId (index, "relmode")),
        [this] (float v)
        {
            const int i = (int) (v + 0.5f);
            rel1Btn.setToggleState (i == 0, juce::dontSendNotification);
            rel2Btn.setToggleState (i == 1, juce::dontSendNotification);
            autoBtn.setToggleState (i == 2, juce::dontSendNotification);
        });
    relModeAtt->sendInitialUpdate();

    routeBox.addItem ("Main", 1);
    routeBox.addItem ("R1", 2);
    routeBox.addItem ("R2", 3);
    addAndMakeVisible (routeBox);
    routeAtt = std::make_unique<ComboAtt> (apvts, bandId (index, "route"), routeBox);

    addAndMakeVisible (meter);
}

void BandStrip::setRelMode (int mode)
{
    if (relModeAtt)
        relModeAtt->setValueAsCompleteGesture ((float) mode);
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

    // Left tab: colored accent bar + band name.
    auto tab = getLocalBounds().reduced (6).removeFromLeft (52);
    g.setColour (tabColour);
    g.fillRoundedRectangle (tab.removeFromLeft (4).toFloat(), 2.0f);
    g.setColour (Colours::text);
    g.setFont (juce::Font (12.0f, juce::Font::bold));
    g.drawFittedText (bandTitle, tab.reduced (2), juce::Justification::centred, 2);

    // "GR" caption above the meter.
    g.setColour (Colours::textDim);
    g.setFont (juce::Font (9.0f));
    g.drawText ("GAIN REDUCTION", grCaption, juce::Justification::centredLeft, false);
}

void BandStrip::resized()
{
    auto area = getLocalBounds().reduced (6);

    area.removeFromLeft (52); // tab (drawn in paint)
    area.removeFromLeft (6);

    // GR meter on the right (horizontal bar with a caption above).
    auto meterArea = area.removeFromRight (184);
    grCaption = meterArea.removeFromTop (12);
    meter.setBounds (meterArea.reduced (2, 4));

    // Controls block: 3 rows x 2 cols -> IN/M, REL1/REL2, AUTO/Route.
    auto controls = area.removeFromRight (172).reduced (4, 5);
    const int rH = controls.getHeight() / 3;
    auto row1 = controls.removeFromTop (rH);
    inBtn.setBounds   (row1.removeFromLeft (row1.getWidth() / 2).reduced (1));
    muteBtn.setBounds (row1.reduced (1));
    auto row2 = controls.removeFromTop (rH);
    rel1Btn.setBounds (row2.removeFromLeft (row2.getWidth() / 2).reduced (1));
    rel2Btn.setBounds (row2.reduced (1));
    auto row3 = controls;
    autoBtn.setBounds  (row3.removeFromLeft (row3.getWidth() / 2).reduced (1));
    routeBox.setBounds (row3.reduced (1));

    // 7 knobs in a horizontal row.
    const int n = (int) knobs.size();
    const int cw = area.getWidth() / n;
    for (int i = 0; i < n; ++i)
    {
        juce::Rectangle<int> cell (area.getX() + i * cw, area.getY(), cw, area.getHeight());
        auto& k = *knobs[(size_t) i];
        k.label.setBounds (cell.removeFromTop (13));
        k.slider.setBounds (cell.reduced (2));
    }
}

} // namespace ghostband
