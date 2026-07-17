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

    // Input / Output knobs (left of the crossover graph, MC404-style).
    auto setupGainKnob = [this] (juce::Slider& k, juce::Label& lab, std::unique_ptr<SliderAtt>& att,
                                 const juce::String& id, const juce::String& text)
    {
        k.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        k.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 58, 14);
        addAndMakeVisible (k);
        att = std::make_unique<SliderAtt> (proc.apvts, id, k);
        k.setNumDecimalPlacesToDisplay (1);
        lab.setText (text, juce::dontSendNotification);
        lab.setJustificationType (juce::Justification::centred);
        lab.setFont (juce::Font (10.0f, juce::Font::bold));
        lab.setColour (juce::Label::textColourId, Colours::textDim);
        addAndMakeVisible (lab);
    };
    setupGainKnob (inputKnob,  inputLabel,  inputAtt,  "input",  "INPUT");
    setupGainKnob (outputKnob, outputLabel, outputAtt, "output", "OUTPUT");

    addAndMakeVisible (xoverDisplay);

    const char* names[4] = { "LOW", "LOW-MID", "HIGH-MID", "HIGH" };
    const juce::Colour tabCols[4] = {
        juce::Colour (0xff3a7d38), juce::Colour (0xff4f9a3a),
        juce::Colour (0xff6fb03a), juce::Colour (0xff9ac93a)
    };
    for (int b = 0; b < 4; ++b)
    {
        strips[(size_t) b] = std::make_unique<BandStrip> (
            proc.apvts, b, names[b], tabCols[b], [this, b] { return proc.getBandGrDb (b); });
        addAndMakeVisible (*strips[(size_t) b]);
    }

    makeBusSlider (0, "busMain", "MAIN");
    makeBusSlider (1, "busR1",   "R1");
    makeBusSlider (2, "busR2",   "R2");

    setSize (1000, 668);
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
    auto busArea = getLocalBounds().removeFromBottom (48).reduced (8, 4);
    g.setColour (Colours::panel);
    g.fillRoundedRectangle (busArea.toFloat(), 4.0f);
    g.setColour (Colours::panelEdge);
    g.drawRoundedRectangle (busArea.toFloat().reduced (0.5f), 4.0f, 1.0f);
    g.setColour (Colours::textDim);
    g.setFont (juce::Font (9.0f, juce::Font::bold));
    g.drawText ("PARALLEL BUSES", busArea.removeFromTop (13), juce::Justification::centred, false);
}

void GhostBandAudioProcessorEditor::resized()
{
    auto area = getLocalBounds();

    // Header (thin bar): title + preset menu.
    auto header = area.removeFromTop (40).reduced (12, 6);
    titleLabel.setBounds (header.removeFromLeft (190).withSizeKeepingCentre (190, 28));
    presetBox.setBounds (header.removeFromRight (220).withSizeKeepingCentre (220, 26));

    // Bus section (bottom).
    auto busArea = area.removeFromBottom (48).reduced (12, 6);
    busArea.removeFromTop (13); // title
    const int colW = busArea.getWidth() / 3;
    for (int i = 0; i < 3; ++i)
    {
        auto col = busArea.removeFromLeft (colW).reduced (8, 0);
        busLabels[i].setBounds (col.removeFromLeft (40));
        busSliders[i].setBounds (col);
    }

    // Top section: INPUT/OUTPUT knobs on the left, crossover graph filling.
    auto top = area.removeFromTop (200).reduced (8, 4);
    auto gainCol = top.removeFromLeft (84);
    auto inA = gainCol.removeFromTop (gainCol.getHeight() / 2).reduced (4, 4);
    inputLabel.setBounds (inA.removeFromTop (12));
    inputKnob.setBounds (inA);
    auto outA = gainCol.reduced (4, 4);
    outputLabel.setBounds (outA.removeFromTop (12));
    outputKnob.setBounds (outA);
    top.removeFromLeft (6);
    xoverDisplay.setBounds (top);

    // Band rows (horizontal, MC404-style).
    auto rows = area.reduced (8, 2);
    const int rh = rows.getHeight() / 4;
    for (int b = 0; b < 4; ++b)
        strips[(size_t) b]->setBounds (rows.removeFromTop (rh).reduced (0, 3));
}

} // namespace ghostband
