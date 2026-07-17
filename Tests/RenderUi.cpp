/*
    GhostBand - RenderUi.cpp

    Headless render of the editor to a PNG, so the UI layout can be verified
    without a display. Not part of the shipped plugin.

    ASCII-only source for FL Studio compatibility.
*/

#include <juce_gui_basics/juce_gui_basics.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include <memory>

#include "PluginProcessor.h"
#include "PluginEditor.h"

int main (int argc, char* argv[])
{
    juce::ScopedJuceInitialiser_GUI guiInit;

    ghostband::GhostBandAudioProcessor proc;
    proc.prepareToPlay (48000.0, 512);
    proc.setCurrentProgram (1); // Lead Vocal - J, so knobs show real values

    std::unique_ptr<juce::AudioProcessorEditor> editor (proc.createEditor());
    editor->setBounds (0, 0, editor->getWidth(), editor->getHeight());

    auto image = editor->createComponentSnapshot (editor->getLocalBounds());

    const juce::String path = (argc > 1) ? juce::String (argv[1]) : juce::String ("/tmp/ghostband_ui.png");
    juce::File out (path);
    out.deleteFile();
    if (auto stream = out.createOutputStream())
    {
        juce::PNGImageFormat png;
        png.writeImageToStream (image, *stream);
    }

    juce::Logger::writeToLog ("rendered " + juce::String (image.getWidth()) + "x" + juce::String (image.getHeight()));
    return 0;
}
