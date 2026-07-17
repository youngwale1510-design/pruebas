/*
    GhostBand - PluginEditor.cpp

    ASCII-only source for FL Studio compatibility.
*/

#include "PluginEditor.h"

namespace ghostband
{

GhostBandAudioProcessorEditor::GhostBandAudioProcessorEditor (GhostBandAudioProcessor& p)
    : AudioProcessorEditor (&p), proc (p), xoverDisplay (p.apvts)
{
    setLookAndFeel (&lnf);

    titleLabel.setText ("GHOSTBAND", juce::dontSendNotification);
    titleLabel.setFont (juce::Font (20.0f, juce::Font::bold));
    titleLabel.setColour (juce::Label::textColourId, Colours::accent);
    addAndMakeVisible (titleLabel);

    // Preset menu (host programs).
    for (int i = 0; i < proc.getNumPrograms(); ++i)
        presetBox.addItem (proc.getProgramName (i), i + 1);
    presetBox.setSelectedId (proc.getCurrentProgram() + 1, juce::dontSendNotification);
    presetBox.onChange = [this]
    {
        const int idx = presetBox.getSelectedId() - 1;
        if (idx >= 0)
            proc.setCurrentProgram (idx);
    };
    addAndMakeVisible (presetBox);

    // Master output.
    outputKnob.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    outputKnob.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 60, 14);
    addAndMakeVisible (outputKnob);
    outputAtt = std::make_unique<SliderAtt> (proc.apvts, "output", outputKnob);
    outputKnob.setNumDecimalPlacesToDisplay (1);
    outputLabel.setText ("OUTPUT", juce::dontSendNotification);
    outputLabel.setJustificationType (juce::Justification::centred);
    outputLabel.setFont (juce::Font (10.0f));
    outputLabel.setColour (juce::Label::textColourId, Colours::textDim);
    addAndMakeVisible (outputLabel);

    addAndMakeVisible (xoverDisplay);

    const char* names[4] = { "LOW", "LOW-MID", "HIGH-MID", "HIGH" };
    for (int b = 0; b < 4; ++b)
    {
        strips[(size_t) b] = std::make_unique<BandStrip> (
            proc.apvts, b, names[b], [this, b] { return proc.getBandGrDb (b); });
        addAndMakeVisible (*strips[(size_t) b]);
    }

    makeBusSlider (0, "busMain", "MAIN");
    makeBusSlider (1, "busR1",   "R1");
    makeBusSlider (2, "busR2",   "R2");

    setSize (940, 648);
}

GhostBandAudioProcessorEditor::~GhostBandAudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void GhostBandAudioProcessorEditor::makeBusSlider (int i, const juce::String& id, const juce::String& text)
{
    busSliders[i].setSliderStyle (juce::Slider::LinearHorizontal);
    busSliders[i].setTextBoxStyle (juce::Slider::TextBoxRight, false, 48, 16);
    addAndMakeVisible (busSliders[i]);
    busAtt[i] = std::make_unique<SliderAtt> (proc.apvts, id, busSliders[i]);
    busSliders[i].setNumDecimalPlacesToDisplay (1);

    busLabels[i].setText (text, juce::dontSendNotification);
    busLabels[i].setJustificationType (juce::Justification::centredRight);
    busLabels[i].setFont (juce::Font (11.0f, juce::Font::bold));
    busLabels[i].setColour (juce::Label::textColourId, Colours::text);
    addAndMakeVisible (busLabels[i]);
}

void GhostBandAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (Colours::bg);

    // Bus section background.
    auto busArea = getLocalBounds().removeFromBottom (52).reduced (8, 4);
    g.setColour (Colours::panel);
    g.fillRoundedRectangle (busArea.toFloat(), 4.0f);
    g.setColour (Colours::panelEdge);
    g.drawRoundedRectangle (busArea.toFloat().reduced (0.5f), 4.0f, 1.0f);
    g.setColour (Colours::textDim);
    g.setFont (juce::Font (10.0f, juce::Font::bold));
    g.drawText ("PARALLEL BUSES", busArea.removeFromTop (14), juce::Justification::centred, false);
}

void GhostBandAudioProcessorEditor::resized()
{
    auto area = getLocalBounds();

    // Header.
    auto header = area.removeFromTop (66).reduced (10, 6);
    titleLabel.setBounds (header.removeFromLeft (170).withSizeKeepingCentre (170, 28));
    auto outArea = header.removeFromRight (84);
    outputLabel.setBounds (outArea.removeFromTop (12));
    outputKnob.setBounds (outArea);
    header.removeFromRight (14);
    presetBox.setBounds (header.removeFromRight (210).withSizeKeepingCentre (210, 26));

    // Crossover display.
    xoverDisplay.setBounds (area.removeFromTop (120).reduced (8, 4));

    // Bus section (bottom).
    auto busArea = area.removeFromBottom (52).reduced (12, 8);
    busArea.removeFromTop (14); // title
    const int colW = busArea.getWidth() / 3;
    for (int i = 0; i < 3; ++i)
    {
        auto col = busArea.removeFromLeft (colW).reduced (6, 0);
        busLabels[i].setBounds (col.removeFromLeft (40));
        busSliders[i].setBounds (col);
    }

    // Band strips.
    auto strarea = area.reduced (8, 4);
    const int sw = strarea.getWidth() / 4;
    for (int b = 0; b < 4; ++b)
        strips[(size_t) b]->setBounds (strarea.removeFromLeft (sw).reduced (4, 0));
}

} // namespace ghostband
