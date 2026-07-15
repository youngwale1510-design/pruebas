cmake_minimum_required(VERSION 3.22)

project(GhostBand VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---------------------------------------------------------------------------
# JUCE (fetched at configure time). Pin a JUCE 7+ tag.
# ---------------------------------------------------------------------------
include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        7.0.12
    GIT_SHALLOW    ON)
FetchContent_MakeAvailable(JUCE)

# ---------------------------------------------------------------------------
# Phase 1 test target: offline flat-sum (null) test for the crossover.
# This is header-only DSP + a small console app, so it builds without the
# plugin sources below.
# ---------------------------------------------------------------------------
juce_add_console_app(GhostBandTests
    PRODUCT_NAME "GhostBandTests")

target_sources(GhostBandTests PRIVATE
    Tests/FlatSumTest.cpp
    Source/DSP/MultibandCrossover4.cpp)

target_include_directories(GhostBandTests PRIVATE Source)

target_compile_definitions(GhostBandTests PRIVATE
    JUCE_STANDALONE_APPLICATION=0)

target_link_libraries(GhostBandTests PRIVATE
    juce::juce_audio_basics
    juce::juce_dsp                 # used only for FFT-based magnitude check
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags)

# ---------------------------------------------------------------------------
# Plugin target (VST3 + Standalone). Sources land in later phases.
# Kept here so the project structure is explicit. The referenced plugin
# .cpp files are added in the next steps (Fase 2+).
# ---------------------------------------------------------------------------
# juce_add_plugin(GhostBand
#     COMPANY_NAME        "GhostAudio"
#     PLUGIN_MANUFACTURER_CODE Ghst
#     PLUGIN_CODE         Gbnd
#     FORMATS             VST3 Standalone
#     PRODUCT_NAME        "GhostBand"
#     IS_SYNTH            FALSE
#     NEEDS_MIDI_INPUT    FALSE
#     COPY_PLUGIN_AFTER_BUILD TRUE)
#
# target_sources(GhostBand PRIVATE
#     Source/PluginProcessor.cpp
#     Source/PluginEditor.cpp
#     Source/DSP/MultibandCrossover4.cpp)
#
# target_include_directories(GhostBand PRIVATE Source)
#
# target_link_libraries(GhostBand PRIVATE
#     juce::juce_audio_utils
#     juce::juce_dsp
#     juce::juce_recommended_config_flags
#     juce::juce_recommended_warning_flags)
