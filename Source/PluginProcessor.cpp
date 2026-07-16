/*
    GhostBand - PluginProcessor.cpp

    See header. Thin JUCE wrapper mapping APVTS parameters onto GhostBandEngine.

    ASCII-only source for FL Studio compatibility.
*/

#include "PluginProcessor.h"
#include "Presets.h"

namespace ghostband
{

static const char* kBandNames[4] = { "low", "lowmid", "highmid", "high" };

juce::String bandParamId (int band, const char* name)
{
    return juce::String ("b") + juce::String (band) + "_" + name;
}

static juce::NormalisableRange<float> freqRange (float lo, float hi, float centre)
{
    juce::NormalisableRange<float> r (lo, hi);
    r.setSkewForCentre (centre);
    return r;
}

static juce::NormalisableRange<float> skewRange (float lo, float hi, float centre)
{
    juce::NormalisableRange<float> r (lo, hi);
    r.setSkewForCentre (centre);
    return r;
}

//==============================================================================
juce::AudioProcessorValueTreeState::ParameterLayout GhostBandAudioProcessor::createLayout()
{
    using P = juce::AudioProcessorParameterGroup;
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    auto floatP = [] (const juce::String& id, const juce::String& nm,
                      juce::NormalisableRange<float> range, float def,
                      const juce::String& unit)
    {
        return std::make_unique<juce::AudioParameterFloat> (
            juce::ParameterID { id, 1 }, nm, range, def,
            juce::AudioParameterFloatAttributes().withLabel (unit));
    };

    // ---- Global ------------------------------------------------------------
    layout.add (floatP ("x1", "Crossover 1", freqRange (20.0f, 500.0f, 100.0f),   100.0f,   "Hz"));
    layout.add (floatP ("x2", "Crossover 2", freqRange (200.0f, 5000.0f, 1000.0f), 1000.0f, "Hz"));
    layout.add (floatP ("x3", "Crossover 3", freqRange (2000.0f, 20000.0f, 10000.0f), 10000.0f, "Hz"));
    layout.add (floatP ("output",  "Output",   juce::NormalisableRange<float> (-24.0f, 24.0f), 0.0f, "dB"));
    layout.add (floatP ("busMain", "Bus Main", juce::NormalisableRange<float> (-60.0f, 12.0f), 0.0f, "dB"));
    layout.add (floatP ("busR1",   "Bus R1",   juce::NormalisableRange<float> (-60.0f, 12.0f), 0.0f, "dB"));
    layout.add (floatP ("busR2",   "Bus R2",   juce::NormalisableRange<float> (-60.0f, 12.0f), 0.0f, "dB"));

    // ---- Per band ----------------------------------------------------------
    for (int b = 0; b < 4; ++b)
    {
        const juce::String pretty = juce::String ("Band ") + juce::String (b + 1);
        auto id = [b] (const char* n) { return bandParamId (b, n); };

        layout.add (floatP (id ("gain"),    pretty + " Gain",    juce::NormalisableRange<float> (-24.0f, 24.0f),  0.0f,  "dB"));
        layout.add (floatP (id ("thresh"),  pretty + " Thresh",  juce::NormalisableRange<float> (-60.0f, 0.0f),  -24.0f, "dB"));
        layout.add (floatP (id ("ratio"),   pretty + " Comp",    skewRange (1.0f, 20.0f, 4.0f),                   2.0f,  ":1"));
        layout.add (floatP (id ("knee"),    pretty + " Knee",    juce::NormalisableRange<float> (0.0f, 24.0f),    0.0f,  "dB"));
        layout.add (floatP (id ("bite"),    pretty + " Bite",    juce::NormalisableRange<float> (0.0f, 10.0f),    0.0f,  ""));
        layout.add (floatP (id ("attack"),  pretty + " Attack",  skewRange (0.1f, 100.0f, 10.0f),                 2.5f,  "ms"));
        layout.add (floatP (id ("release"), pretty + " Release", skewRange (10.0f, 1000.0f, 150.0f),              250.0f, "ms"));

        layout.add (std::make_unique<juce::AudioParameterBool> (
            juce::ParameterID { id ("autorel"), 1 }, pretty + " Auto Rel", false));
        layout.add (std::make_unique<juce::AudioParameterChoice> (
            juce::ParameterID { id ("route"), 1 }, pretty + " Route",
            juce::StringArray { "Main", "R1", "R2" }, 0));
        layout.add (std::make_unique<juce::AudioParameterBool> (
            juce::ParameterID { id ("in"), 1 }, pretty + " In", true));
        layout.add (std::make_unique<juce::AudioParameterBool> (
            juce::ParameterID { id ("mute"), 1 }, pretty + " Mute", false));
    }

    juce::ignoreUnused ((P*) nullptr);
    return layout;
}

//==============================================================================
GhostBandAudioProcessor::GhostBandAudioProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "PARAMETERS", createLayout())
{
}

//==============================================================================
void GhostBandAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    engine.prepare (sampleRate, samplesPerBlock);
    pushParametersToEngine();
    engine.reset();
}

bool GhostBandAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto in  = layouts.getMainInputChannelSet();
    const auto out = layouts.getMainOutputChannelSet();

    if (in != out)
        return false;
    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;

    return true;
}

void GhostBandAudioProcessor::pushParametersToEngine()
{
    auto raw = [this] (const juce::String& id) -> float
    {
        if (auto* a = apvts.getRawParameterValue (id))
            return a->load();
        return 0.0f;
    };

    engine.setCrossoverFrequencies (raw ("x1"), raw ("x2"), raw ("x3"));
    engine.setOutputGainDb (raw ("output"));
    engine.setBusGainDb (0, raw ("busMain"));
    engine.setBusGainDb (1, raw ("busR1"));
    engine.setBusGainDb (2, raw ("busR2"));

    for (int b = 0; b < 4; ++b)
    {
        auto& c = engine.band (b);
        c.setInputGainDb (raw (bandParamId (b, "gain")));
        c.setThresholdDb (raw (bandParamId (b, "thresh")));
        c.setRatio       (raw (bandParamId (b, "ratio")));
        c.setKneeDb      (raw (bandParamId (b, "knee")));
        c.setBite        (raw (bandParamId (b, "bite")));
        c.setAttackMs    (raw (bandParamId (b, "attack")));
        c.setReleaseMs   (raw (bandParamId (b, "release")));
        c.setAutoRelease (raw (bandParamId (b, "autorel")) > 0.5f);
        c.setCompIn      (raw (bandParamId (b, "in"))   > 0.5f);
        c.setMuted       (raw (bandParamId (b, "mute")) > 0.5f);
        engine.setBandRouting (b, (int) raw (bandParamId (b, "route")));
    }
}

void GhostBandAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const int totalIn  = getTotalNumInputChannels();
    const int totalOut = getTotalNumOutputChannels();
    for (int i = totalIn; i < totalOut; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    if (buffer.getNumChannels() == 0)
        return;

    pushParametersToEngine();

    const int n = buffer.getNumSamples();
    float* L = buffer.getWritePointer (0);
    float* R = buffer.getNumChannels() > 1 ? buffer.getWritePointer (1) : L;

    engine.process (L, R, n);
}

//==============================================================================
juce::AudioProcessorEditor* GhostBandAudioProcessor::createEditor()
{
    return new juce::GenericAudioProcessorEditor (*this);
}

//==============================================================================
void GhostBandAudioProcessor::setParam (const juce::String& id, float rawValue)
{
    if (auto* p = apvts.getParameter (id))
        p->setValueNotifyingHost (p->convertTo0to1 (rawValue));
}

void GhostBandAudioProcessor::applyPreset (const GhostBandPreset& p)
{
    setParam ("x1", p.xover1Hz);
    setParam ("x2", p.xover2Hz);
    setParam ("x3", p.xover3Hz);
    setParam ("output", p.outputDb);
    setParam ("busMain", 0.0f);
    setParam ("busR1", 0.0f);
    setParam ("busR2", 0.0f);

    for (int b = 0; b < 4; ++b)
    {
        const auto& s = p.bands[b];
        setParam (bandParamId (b, "gain"),    s.inputGainDb);
        setParam (bandParamId (b, "thresh"),  s.thresholdDb);
        setParam (bandParamId (b, "ratio"),   s.ratio);
        setParam (bandParamId (b, "knee"),    s.kneeDb);
        setParam (bandParamId (b, "bite"),    s.bite);
        setParam (bandParamId (b, "attack"),  s.attackMs);
        setParam (bandParamId (b, "release"), s.releaseMs);
        setParam (bandParamId (b, "autorel"), s.autoRelease ? 1.0f : 0.0f);
        setParam (bandParamId (b, "route"),   (float) s.routing);
        setParam (bandParamId (b, "in"),      s.compIn ? 1.0f : 0.0f);
        setParam (bandParamId (b, "mute"),    s.muted ? 1.0f : 0.0f);
    }

    juce::ignoreUnused (kBandNames);
}

void GhostBandAudioProcessor::setCurrentProgram (int index)
{
    currentProgram = juce::jlimit (0, getNumPrograms() - 1, index);
    applyPreset (currentProgram == 1 ? leadVocalJPreset() : factoryDefaultPreset());
}

const juce::String GhostBandAudioProcessor::getProgramName (int index)
{
    return index == 1 ? leadVocalJPreset().name : factoryDefaultPreset().name;
}

//==============================================================================
void GhostBandAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void GhostBandAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

} // namespace ghostband

//==============================================================================
// Plugin entry point.
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new ghostband::GhostBandAudioProcessor();
}
