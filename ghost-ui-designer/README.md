# Ghost UI Designer

Editor visual WYSIWYG ("Photoshop para plugins iPlug2") que diseña la GUI de un
plugin de audio y genera/actualiza el C++ de iPlug2 con **round-trip**.

Ver [`DESIGN.md`](./DESIGN.md) para la arquitectura, el modelo de datos y el formato
de marcadores.

## Estado (MVP — fase 1)

Validado lo más riesgoso primero: el **round-trip de código**.

- ✅ Modelo de datos del árbol de escena (`src/model/`)
- ✅ Generación de C++ iPlug2 con marcadores + payload embebido (`src/codegen/`)
- ✅ Parser que reconstruye la escena desde un `.cpp` y **preserva el código escrito
  a mano** fuera de los marcadores
- ✅ Pruebas headless de round-trip (`test/roundtrip.test.ts`) — 5/5
- ✅ Shell Electron + React + Konva: canvas con knobs arrastrables, panel de
  propiedades, vista previa de C++, guardar/abrir proyecto, exportar C++ (IPC)

### Pendiente (siguientes fases)

Motor de efectos/capas (drop shadow, bevel, gradient, noise, glow) con luz global,
texturas/materiales, filmstrips, más tipos de control y export PNG con alfa.

## Desarrollo

```bash
npm install         # instala electron, react, konva, etc.
npm test            # ejecuta las pruebas de round-trip (solo requiere vitest)
npm run dev         # arranca Vite (renderer)
npm run electron:dev  # build + arranca la app de escritorio
```

> El núcleo de codegen/round-trip (`src/model`, `src/codegen`, `test`) no depende de
> React/Electron y se puede probar de forma aislada con `npm test`.
