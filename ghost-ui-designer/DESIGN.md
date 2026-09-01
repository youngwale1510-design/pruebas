# Ghost UI Designer — Diseño

Editor visual WYSIWYG ("Photoshop para plugins iPlug2"). Diseña la GUI de un plugin
de audio y genera/actualiza el C++ de iPlug2 con **round-trip** real.

- **Stack:** Electron + React + Vite + TypeScript. Konva.js como motor de escena/capas.
- **Objetivo de codegen:** iPlug2 (`IGraphics`, `IVKnobControl`, `mLayoutFunc`, …).
- **Fuente de verdad:** el archivo de proyecto `.ghostui` (JSON). Además, cada bloque
  generado en el `.cpp` embebe su payload para poder reconstruir desde el `.cpp` solo.

## Estructura de carpetas

```
ghost-ui-designer/
  DESIGN.md
  package.json / tsconfig*.json / vite.config.ts
  electron/            proceso principal (IO de proyecto y de .cpp)
    main.ts  preload.ts
  src/
    model/             modelo de datos (árbol de escena, efectos, controles)
      scene.ts  defaults.ts
    codegen/
      markers.ts       formato de marcadores + encode/decode del payload
      roundtrip.ts     extraer / fusionar la región gestionada dentro del .cpp
      iplug2/
        generate.ts    scene  -> C++
        parse.ts       C++    -> scene (vía marcadores)
    canvas/            render Konva (Stage, KnobControl, efectos)
    ui/                paneles (capas, propiedades, materiales)
    app/               estado global (store) y wiring
  test/                pruebas de round-trip (vitest, headless)
```

## Modelo de datos (árbol de escena)

`SceneDocument` es lo que se serializa a `.ghostui` (ver `src/model/scene.ts`).

```
SceneDocument
├─ version, meta (nombre plugin, autor)
├─ canvas { width, height, bg }
├─ light  { angleDeg, intensity }        ← fuente de luz global (bevels/sombras coherentes)
├─ assets { textures[], filmstrips[] }    ← embebidos en base64, sin rutas externas
├─ params[]  { id, name, type, min, max, default }   ← parámetros del plugin
└─ controls[]  (árbol; un control = grupo de capas)
     Control { id, type, name, rect{x,y,w,h}, paramId?, props{}, layers[], effects[] }
       Layer  { id, name, kind, blendMode, opacity, fill, mask?, effects[] }
       Effect { id, type, enabled, params{} }   ← dropShadow, innerShadow, bevel,
                                                   gradientOverlay, noise, glow
```

Efectos y capas son **no destructivos** (stack reordenable por capa y por control).
La luz global (`light`) alimenta el ángulo por defecto de bevels y sombras.

## Formato de proyecto `.ghostui`

JSON UTF-8 = `SceneDocument` serializado. Texturas y filmstrips van embebidos como
data URIs base64 dentro de `assets`, de modo que el proyecto es autocontenido y
reabrirlo no pierde fidelidad.

## Formato de marcadores en el `.cpp` (round-trip)

La región gestionada vive dentro de `mLayoutFunc`. Todo lo que está **fuera** de la
región se preserva intacto; solo se regenera lo de **dentro**.

```cpp
mLayoutFunc = [&](IGraphics* pGraphics) {
  // ... código escrito a mano (se preserva) ...

  // [GHOST:LAYOUT BEGIN v=1]        ← inicio de la región gestionada
  // [GHOST:CONTROL BEGIN id=knob_gain]
  // [GHOST:DATA]<base64 del JSON del control>
  pGraphics->AttachControl(new IVKnobControl(IRECT(...), kGain, "Gain"), kCtrl_knob_gain);
  // [GHOST:CONTROL END id=knob_gain]
  // [GHOST:LAYOUT END]

  // ... más código escrito a mano (se preserva) ...
};
```

- **`[GHOST:DATA]`** lleva el JSON del control en **base64** (evita romper con `*/`,
  comillas o saltos de línea), y es lo que permite reconstruir el árbol desde el `.cpp`.
- El parser localiza `LAYOUT BEGIN/END`, decodifica cada `CONTROL`/`DATA` y reconstruye
  la escena; guarda `prefix`/`suffix` (el código de fuera) para que la regeneración
  reemplace **solo** la región, en su sitio.
- Si no existe la región en un `.cpp`, el generador la inserta en el `mLayoutFunc`
  (o crea el editor mínimo si el archivo está vacío).

## MVP (orden de construcción)

1. **Round-trip** (lo más riesgoso, primero): modelo + generate + parse + merge, con
   pruebas headless. ← *esta entrega*
2. Canvas Konva con un knob editable + panel de propiedades.
3. Motor de efectos/capas (drop shadow, bevel, gradient, noise, glow) + luz global.
4. Texturas/materiales, filmstrips, más tipos de control, export PNG con alfa.
