# ToneShaper — ejemplo end-to-end (iPlug2)

Plugin mínimo para validar TODO el flujo de trabajo:

> **Yo te doy un plugin funcional → tú lo reestilizas en Ghost UI Designer → exportas → compilas.**
> Tu DSP y tu lógica quedan intactos; solo cambia el look.

## Qué hace

- **2 knobs**: `Gain` (dB) y `Tone` (0–100 %).
- **Interruptor de modo**: `Mode` = Warm / Bright.
- **Bypass**: pasa la señal sin procesar.
- DSP simple: ganancia + filtro de un polo (Warm = suaviza, Bright = realza agudos).

## Archivos

| Archivo | Qué es | ¿Lo toca el diseñador? |
|---|---|---|
| `ToneShaper.h` | Clase, parámetros (`EParams`), tags de control | No |
| `ToneShaper.cpp` | Constructor + **GUI entre marcadores `// [GHOST:…]`** + DSP | Solo la región marcada |
| `config.h` | Metadatos del plugin (iPlug2) | No |

En `ToneShaper.cpp`, todo lo que está **fuera** de `// [GHOST:LAYOUT BEGIN] … // [GHOST:LAYOUT END]`
(el `ProcessBlock`, el `OnParamChange`, los `GetParam(...)->Init...`) se **preserva** al reestilizar.

## Flujo de reestilizado (round-trip)

1. Abre `ToneShaper.cpp` en Ghost UI Designer.
2. El diseñador reconstruye los 4 controles (los lee de los marcadores + payload embebido).
3. Cambia estética: knobs 3D, materiales, tamaños, fondo, posiciones…
4. **Exportar bundle** → sobrescribe la región marcada de `ToneShaper.cpp` y escribe
   `resources/*.png` (filmstrips) + el header de recursos. El DSP no se toca.
5. Recompila.

> El `.cpp` de este ejemplo lo **genera el propio codegen del diseñador**
> (ver `test/exampleToneShaper.test.ts`), así que el round-trip está garantizado.

## Compilar (colocándolo en iPlug2)

iPlug2 es gratuito y de licencia permisiva (por eso migramos desde JUCE).

```bash
# 1) Clona iPlug2
git clone https://github.com/iPlug2/iPlug2.git
cd iPlug2 && ./download-iplug-sdks.sh   # (o .bat en Windows)

# 2) Crea un proyecto a partir del ejemplo IPlugEffect
cd Examples
python duplicate.py IPlugEffect ToneShaper GhostAudio

# 3) Sustituye los archivos generados por los de esta carpeta
cp /ruta/a/ghost-ui-designer/examples/ToneShaper/ToneShaper.h  ToneShaper/
cp /ruta/a/ghost-ui-designer/examples/ToneShaper/ToneShaper.cpp ToneShaper/
cp /ruta/a/ghost-ui-designer/examples/ToneShaper/config.h       ToneShaper/

# 4) Copia los recursos que exporte el diseñador (filmstrips, fuentes)
#    a ToneShaper/resources/ y declara sus #define en config.h
```

Luego abre el proyecto (Xcode / Visual Studio) o usa el CMake de iPlug2 y compila
el target `APP` para probarlo standalone, o `VST3`/`AU`.

> Nota: `duplicate.py` genera los proyectos de IDE, los `resources/` y los wrappers
> por plataforma. Estos tres archivos son la **fuente de verdad** de tu plugin
> (DSP + parámetros + GUI marcada); el resto lo aporta la plantilla de iPlug2.
