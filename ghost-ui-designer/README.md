# Ghost UI Designer

Editor visual WYSIWYG ("Photoshop para plugins iPlug2") que diseña la GUI de un
plugin de audio y genera/actualiza el C++ de iPlug2 con **round-trip**.

Ver [`DESIGN.md`](./DESIGN.md) para la arquitectura, el modelo de datos y el formato
de marcadores.

## Estado

### Fase 1 — round-trip (validado primero, lo más riesgoso)
- ✅ Modelo de datos del árbol de escena (`src/model/`)
- ✅ Generación de C++ iPlug2 con marcadores + payload embebido (`src/codegen/`)
- ✅ Parser que reconstruye la escena desde un `.cpp` y **preserva el código escrito
  a mano** fuera de los marcadores
- ✅ Shell Electron + React + Konva + IPC (proyecto, preview, IO)

### Fase 2 — motor de render + look Canvas Audio (opción B)
- ✅ **Motor de render Canvas2D compartido** (`src/render/`): pila de capas no
  destructiva + efectos (drop/inner shadow, bevel, gradient overlay, noise, glow)
  + **luz global** que orienta biseles y sombras.
- ✅ El editor pinta cada control con el **mismo compositor** que rasteriza el
  filmstrip → el editor es **pixel-idéntico** al plugin final (`ControlImage`).
- ✅ **Rasterización a filmstrip** (N frames girando con el valor) y **codegen
  opción B**: controles bitmap (`IBKnobControl`) + `<plugin>_resources.h`.
- ✅ **Export de bundle**: `.cpp` (round-trip) + header de recursos + `resources/*.png`.
- ✅ Pruebas headless — 14/14 (round-trip, luz, geometría de capa, filmstrip, recursos).

### Fase 3 — pipeline 3D → filmstrip (realismo)
- ✅ **Constructor por partes** del knob (`src/model/knobConfig.ts`): base / cuerpo /
  tope / indicador, con forma, material, tamaño y giro por slot + luz global.
- ✅ **Render 3D real con Three.js** (`src/render3d/`): geometría extruida por pieza,
  materiales físicos (metal/plástico/cromo/latón), reflejos de entorno de estudio,
  luz global como `DirectionalLight` y sombra de contacto.
- ✅ **Horneado 3D → filmstrip** (`bake.ts`): renderiza N frames girando (con
  supersampling) a un sprite sheet PNG, que el export usa para `IBKnobControl`.
- ✅ **Preview 3D en vivo** (`Knob3DView`) + panel editable (`Knob3DPanel`), con el
  MISMO motor que hornea → editor idéntico al plugin.
- ✅ Geometría/apilado/frames/luz como funciones puras testeadas (20/20 tests).

> El render 3D necesita WebGL: se ve al ejecutar la app (`npm run electron:dev`),
> no en los tests headless. Three.js se empaqueta localmente (sin depender de CDN).

### Pendiente (siguientes fases)
HDRI real importable para reflejos, texturas normal/roughness (torneado/cepillado
reales), tapa abombada por lathe, más tipos de control (slider/botón), y export PNG
del diseño completo con alfa.

> Verificación headless: `npm test` y `npx tsc -p tsconfig.core.json --noEmit`
> cubren el núcleo (modelo + codegen + render) sin necesidad de la GUI.

## Desarrollo

```bash
npm install         # instala electron, react, konva, etc.
npm test            # ejecuta las pruebas de round-trip (solo requiere vitest)
npm run dev         # arranca Vite (renderer)
npm run electron:dev  # build + arranca la app de escritorio
```

> El núcleo de codegen/round-trip (`src/model`, `src/codegen`, `test`) no depende de
> React/Electron y se puede probar de forma aislada con `npm test`.
