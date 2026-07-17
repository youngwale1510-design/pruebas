/*
    GhostBand - PluginEditor.h

    Custom editor (Phase 5): dark theme with green accents. Header with preset
    menu + master output, a crossover display, 4 band strips, and the 3
    parallel bus levels.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <array>
#include <memory>

#include "PluginProcessor.h"
#include "UI/GhostLookAndFeel.h"
#include "UI/CrossoverDisplay.h"
#include "UI/BandStrip.h"

namespace ghostband
{

class GhostBandAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit GhostBandAudioProcessorEditor (GhostBandAudioProcessor&);
    ~GhostBandAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    using SliderAtt = juce::AudioProcessorValueTreeState::SliderAttachment;

    void makeBusSlider (int i, const juce::String& id, const juce::String& text);

    GhostBandAudioProcessor& proc;
    GhostLookAndFeel lnf;

    juce::Label titleLabel;
    juce::ComboBox presetBox;

    juce::Slider outputKnob;
    juce::Label  outputLabel;
    std::unique_ptr<SliderAtt> outputAtt;

    CrossoverDisplay xoverDisplay;

    std::array<std::unique_ptr<BandStrip>, 4> strips;

    juce::Slider busSliders[3];
    juce::Label  busLabels[3];
    std::unique_ptr<SliderAtt> busAtt[3];

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (GhostBandAudioProcessorEditor)
};

} // namespace ghostband
