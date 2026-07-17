cmake_minimum_required(VERSION 3.22)

project(GhostBand VERSION 0.2.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(GHOSTBAND_BUILD_JUCE "Fetch JUCE and build the plugin + JUCE tests" ON)

# ---------------------------------------------------------------------------
# Dependency-free unit tests (no JUCE). Build with just a C++17 compiler:
#   cmake -B build -DGHOSTBAND_BUILD_JUCE=OFF && cmake --build build
# ---------------------------------------------------------------------------
set(GHOSTBAND_DSP_SOURCES
    Source/DSP/BandCompressor.cpp
    Source/DSP/MultibandCrossover4.cpp
    Source/DSP/GhostBandEngine.cpp)

add_executable(GhostBandCompressorTest
    Tests/CompressorTest.cpp
    Source/DSP/BandCompressor.cpp)
target_include_directories(GhostBandCompressorTest PRIVATE Source)

add_executable(GhostBandEngineTest
    Tests/EngineRoutingTest.cpp
    ${GHOSTBAND_DSP_SOURCES})
target_include_directories(GhostBandEngineTest PRIVATE Source)

enable_testing()
add_test(NAME CompressorTest COMMAND GhostBandCompressorTest)
add_test(NAME EngineRoutingTest COMMAND GhostBandEngineTest)

if(NOT GHOSTBAND_BUILD_JUCE)
    return()
endif()

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
# Crossover flat-sum test (uses juce_dsp FFT).
# ---------------------------------------------------------------------------
juce_add_console_app(GhostBandTests PRODUCT_NAME "GhostBandTests")

target_sources(GhostBandTests PRIVATE
    Tests/FlatSumTest.cpp
    Source/DSP/MultibandCrossover4.cpp)

target_include_directories(GhostBandTests PRIVATE Source)

target_link_libraries(GhostBandTests PRIVATE
    juce::juce_audio_basics
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags)

add_test(NAME FlatSumTest COMMAND GhostBandTests)

# ---------------------------------------------------------------------------
# Plugin target (VST3 + Standalone). UI is Phase 5 (generic editor for now).
# ---------------------------------------------------------------------------
juce_add_plugin(GhostBand
    COMPANY_NAME        "GhostAudio"
    PLUGIN_MANUFACTURER_CODE Ghst
    PLUGIN_CODE         Gbnd
    FORMATS             VST3 Standalone
    PRODUCT_NAME        "GhostBand"
    IS_SYNTH            FALSE
    NEEDS_MIDI_INPUT    FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE)

target_sources(GhostBand PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/UI/BandStrip.cpp
    ${GHOSTBAND_DSP_SOURCES})

target_include_directories(GhostBand PRIVATE Source)

target_compile_definitions(GhostBand PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0)

target_link_libraries(GhostBand PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags)

# ---------------------------------------------------------------------------
# Headless UI render helper (dev-only; verifies editor layout to a PNG).
# ---------------------------------------------------------------------------
juce_add_console_app(GhostBandRender PRODUCT_NAME "GhostBandRender")
target_sources(GhostBandRender PRIVATE
    Tests/RenderUi.cpp
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/UI/BandStrip.cpp
    ${GHOSTBAND_DSP_SOURCES})
target_include_directories(GhostBandRender PRIVATE Source)
target_compile_definitions(GhostBandRender PRIVATE
    JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0
    JUCE_STANDALONE_APPLICATION=1)
target_link_libraries(GhostBandRender PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_gui_extra
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags)
