/*
    GhostBand - PluginProcessor.h

    JUCE AudioProcessor wrapper. Thin layer over GhostBandEngine: owns the
    AudioProcessorValueTreeState (all parameters) and, each block, pushes the
    current parameter values into the engine and processes audio.

    UI is Phase 5; for now createEditor() returns the JUCE generic editor so
    the plugin is fully usable (all knobs + preset menu) without custom UI.

    ASCII-only source for FL Studio compatibility.
*/

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include "DSP/GhostBandEngine.h"

namespace ghostband
{

// Parameter id helpers (kept stable for host automation / saved state).
juce::String bandParamId (int band, const char* name);

class GhostBandAudioProcessor : public juce::AudioProcessor
{
public:
    GhostBandAudioProcessor();
    ~GhostBandAudioProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "GhostBand"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    // Factory presets exposed as host programs.
    int getNumPrograms() override { return 2; }
    int getCurrentProgram() override { return currentProgram; }
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // Per-band gain reduction (positive dB) for UI meters. Written on the
    // audio thread, read on the message thread.
    float getBandGrDb (int band) const noexcept
    {
        return (band >= 0 && band < 4) ? bandGrDb[band].load (std::memory_order_relaxed) : 0.0f;
    }

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void pushParametersToEngine();
    void applyPreset (const struct GhostBandPreset& preset);
    void setParam (const juce::String& id, float rawValue);

    GhostBandEngine engine;
    int currentProgram = 0;
    std::atomic<float> bandGrDb[4] { { 0.0f }, { 0.0f }, { 0.0f }, { 0.0f } };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (GhostBandAudioProcessor)
};

} // namespace ghostband
