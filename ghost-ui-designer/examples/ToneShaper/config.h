#pragma once

// Metadatos del plugin (formato iPlug2). Ajusta IDs/manufacturer a los tuyos.
#define PLUG_NAME "ToneShaper"
#define PLUG_MFR "GhostAudio"
#define PLUG_VERSION_HEX 0x00010000
#define PLUG_VERSION_STR "1.0.0"
#define PLUG_UNIQUE_ID 'TnSh'
#define PLUG_MFR_ID 'Ghst'
#define PLUG_URL_STR "https://example.com"
#define PLUG_EMAIL_STR "hello@example.com"
#define PLUG_COPYRIGHT_STR "Copyright 2026 GhostAudio"
#define PLUG_CLASS_NAME ToneShaper

#define BUNDLE_NAME "ToneShaper"
#define BUNDLE_MFR "GhostAudio"
#define BUNDLE_DOMAIN "com"

#define SHARED_RESOURCES_SUBPATH "ToneShaper"

#define PLUG_CHANNEL_IO "1-1 2-2"
#define PLUG_LATENCY 0
#define PLUG_TYPE 0
#define PLUG_DOES_MIDI_IN 0
#define PLUG_DOES_MIDI_OUT 0
#define PLUG_DOES_MPE 0
#define PLUG_DOES_STATE_CHUNKS 0
#define PLUG_HAS_UI 1
#define PLUG_WIDTH 400
#define PLUG_HEIGHT 300
#define PLUG_FPS 60
#define PLUG_SHARED_RESOURCES 0
#define PLUG_HOST_RESIZE 0

#define AUV2_ENTRY ToneShaper_Entry
#define AUV2_ENTRY_STR "ToneShaper_Entry"
#define AUV2_FACTORY ToneShaper_Factory
#define AUV2_VIEW_CLASS ToneShaper_View
#define AUV2_VIEW_CLASS_STR "ToneShaper_View"

#define AAX_TYPE_IDS 'ITP1'
#define AAX_PLUG_MFR_STR "GhostAudio"
#define AAX_PLUG_NAME_STR "ToneShaper\nITP1"
#define AAX_PLUG_CATEGORY_STR "Effect"
#define AAX_DOES_AUDIOSUITE 0

#define VST3_SUBCATEGORY "Fx"

#define APP_NUM_CHANNELS 2
#define APP_N_VECTOR_WAIT 0
#define APP_MULT 1
#define APP_COPY_AUV3 0
#define APP_SIGNAL_VECTOR_SIZE 64

// Recursos (fuentes/bitmaps). Los filmstrips horneados por el diseñador se
// declararán aquí (p.ej. #define KNOBGAIN_FN "knob_gain.png").
#define ROBOTO_FN "Roboto-Regular.ttf"
#include "ToneShaper_resources.h"
