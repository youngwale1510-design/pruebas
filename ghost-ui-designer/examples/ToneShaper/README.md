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

## Compilar en Windows (paso a paso)

Necesitas: **Git for Windows**, **Visual Studio 2022 Community** (carga de trabajo
"Desarrollo de escritorio con C++") y **Python 3** (marca "Add to PATH" al instalar).

1. **Descarga iPlug2** (si no lo tienes ya):
   ```
   git clone https://github.com/iPlug2/iPlug2.git
   ```
2. **SDKs y librerías precompiladas.** Abre *Git Bash* (clic derecho en la carpeta
   `iPlug2` → "Git Bash Here") y ejecuta:
   ```bash
   cd Dependencies/IPlug
   ./download-iplug-sdks.sh
   cd ..
   ./download-prebuilt-libs.sh
   ```
3. **Crea el proyecto desde la plantilla** (en PowerShell o CMD, dentro de `iPlug2\Examples`):
   ```
   python duplicate.py IPlugEffect ToneShaper GhostAudio
   ```
   Esto genera `iPlug2\Examples\ToneShaper\` con el `.sln`, los `resources/` y los wrappers.
4. **Copia estos tres archivos** encima de los generados:
   ```
   copy ToneShaper.h    iPlug2\Examples\ToneShaper\
   copy ToneShaper.cpp  iPlug2\Examples\ToneShaper\
   copy config.h        iPlug2\Examples\ToneShaper\
   ```
5. **Compila y ejecuta.** Abre `iPlug2\Examples\ToneShaper\ToneShaper.sln` en Visual Studio.
   Clic derecho en `ToneShaper-app` → *Establecer como proyecto de inicio*, plataforma **x64**,
   y **F5**. Se abre el plugin standalone con la GUI "fea" de partida.
   Para el VST3: proyecto de inicio `ToneShaper-vst3` (compila a `C:\Program Files\Common Files\VST3`,
   abre Visual Studio como administrador o da permisos a esa carpeta).

## Reestilizar y recompilar (round-trip)

1. En Ghost UI Designer: **Abrir** → `iPlug2\Examples\ToneShaper\ToneShaper.cpp`.
2. Cambia lo que quieras (materiales, luces, switches, LEDs…).
3. **Exportar bundle** → elige la carpeta `iPlug2\Examples\ToneShaper`. Se escriben:
   - `ToneShaper.cpp` (solo se regenera la región entre marcadores; el DSP queda igual)
   - `ToneShaper_resources.h` (los `#define XXX_FN "xxx.png"`)
   - `ToneShaper_resources.rc.txt` (líneas para `main.rc`)
   - `resources/img/*.png` (los filmstrips)
4. En `config.h` añade al final: `#include "ToneShaper_resources.h"`.
5. En `resources/main.rc` pega las líneas de `ToneShaper_resources.rc.txt`
   **al final del archivo**, junto a la declaración suelta `ROBOTO_FN TTF ROBOTO_FN`
   (la que está fuera de cualquier `BEGIN`/`END`), sin comillas. Windows embebe así
   los PNG en el ejecutable.

   > `ROBOTO_FN TTF ROBOTO_FN` aparece **dos** veces. La otra está dentro de
   > `3 TEXTINCLUDE ... BEGIN/END`, un bloque que solo usa el editor de recursos de
   > Visual Studio y donde **cada línea tiene que ir entre comillas** y terminar en
   > `\r\n` (la última en `\0`). Pegar ahí las líneas sin comillas da error de
   > sintaxis. Lo más simple es no tocar ese bloque; el `.rc.txt` trae las dos
   > versiones por si lo necesitas.
6. Vuelve a Visual Studio y F5. Solo los pasos 4 y 5 son necesarios la primera vez;
   después basta con exportar y recompilar.

## Compilar en macOS / Linux (resumen)

Mismos scripts en un terminal normal y `python3 duplicate.py …`; luego abre el
`.xcodeproj` (macOS) o usa el CMake de iPlug2 (Linux).
