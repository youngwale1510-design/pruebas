/*
    GhostBand - BandStrip.h

    One vertical band strip: title + freq range, the 7 MC404-style knobs
    (Gain / Thresh / Comp / Knee / Bite / Attack / Rel), In / Mute / Auto
    buttons, a Route selector, and a gain-reduction meter.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <functional>
#include <memory>
#include <vector>

#include "GrMeter.h"

namespace ghostband
{

class BandStrip : public juce::Component
{
public:
    BandStrip (juce::AudioProcessorValueTreeState& apvts, int bandIndex,
               const juce::String& title, std::function<float()> grReader);

    void paint (juce::Graphics& g) override;
    void resized() override;

private:
    using SliderAtt = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ButtonAtt = juce::AudioProcessorValueTreeState::ButtonAttachment;
    using ComboAtt  = juce::AudioProcessorValueTreeState::ComboBoxAttachment;

    struct Knob
    {
        juce::Slider slider;
        juce::Label  label;
        std::unique_ptr<SliderAtt> att;
    };

    void addKnob (Knob& k, const juce::String& paramId, const juce::String& text);

    juce::AudioProcessorValueTreeState& apvts;
    int index = 0;
    juce::String bandTitle;

    Knob gain, thresh, ratio, knee, bite, attack, release;
    std::vector<Knob*> knobs;

    juce::TextButton inBtn { "IN" }, muteBtn { "M" }, autoBtn { "AUTO" };
    std::unique_ptr<ButtonAtt> inAtt, muteAtt, autoAtt;

    juce::ComboBox routeBox;
    std::unique_ptr<ComboAtt> routeAtt;

    GrMeter meter;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BandStrip)
};

} // namespace ghostband
