# FXLAB Proto — Sample Browser VST (prototipo UI/UX)

Prototipo web para validar el diseño y la UX de un plugin de *sample browser* tipo VST,
inspirado en FXLAB de Midilatino, **antes** de construir el VST real en JUCE.

No procesa audio real de librería: usa datos mock y genera tonos simples con la
**Web Audio API** como preview. El foco está en el *look & feel* y el feedback interactivo.

## Cómo abrirlo

Es un único archivo autocontenido. Basta con abrir `prototype/index.html` en el navegador
(doble clic, o `open`/`xdg-start`). No requiere build ni servidor.

> El sonido arranca tras el primer clic (política de autoplay del navegador).

## Sonido REAL: cargar y analizar tus audios

Además de los samples mock, puedes cargar **audios reales** y la app los analiza de verdad
en el navegador (sin servidor):

- **Cargar**: botón ↑ de la barra, o **arrastra archivos de audio** sobre la ventana. Aparecen
  en la pestaña **MINE** con un badge `REAL` y su waveform real dibujada del buffer.
- **Detección de tonalidad (key)**: FFT → *chroma* (perfil de clases de altura) → algoritmo
  **Krumhansl-Schmuckler** para estimar tónica y modo (mayor/menor). Ej. `Am`, `C#m`, `G`.
- **Detección de BPM**: envolvente de energía → función de *onset* → **autocorrelación** para
  hallar el tempo dominante (rango 70–180 BPM).
- **Transposición en vivo**: al girar los knobs mientras suena un audio real:
  - **KEY** transpone el sample desde su key detectada hacia la key de sesión.
  - **PITCH** añade semitonos encima.
  - **BPM** estira el tempo hacia el target.
  El chip ámbar `▶ E · 128 BPM` muestra en tiempo real la key y BPM resultantes.

> **Acoplamiento pitch/tempo**: se usa `playbackRate`, así que subir el tono también acelera un
> poco (y viceversa). El pitch-shift / time-stretch independiente es trabajo del VST real en
> JUCE; aquí el objetivo es validar UX y ver el análisis reaccionar.

## Qué se puede probar

- **Header**: nombre del plugin + selector de presets con flechas ‹ › (dummy).
- **Tabs de categorías** con iconos (ALL FX / ACCENT / AMBIENCE / BREAKDOWN / CRASH) que
  filtran la lista.
- **Tarjetas de sample**: waveform generada por seed (SVG), nombre, BPM y key mock,
  toggle **DRY / FX** (cambia timbre del preview) y botón **play/stop**.
- **Búsqueda** en tiempo real por nombre.
- **MAGIC**: elige un sample random dentro de la categoría/búsqueda activa, lo resalta,
  hace scroll y lo reproduce.
- **3 knobs** rotables con drag vertical (también rueda del ratón):
  - **PITCH** (−12…+12 semitonos)
  - **KEY** (ciclo por las 12 notas)
  - **BPM** (60…180, tempo target)
  Afectan el preview vía `playbackRate`/frecuencia como aproximación (no es pitch-shift real).
- **Drag-and-drop de exportación**: arrastra una tarjeta fuera de la lista para simular
  "export" → toast visual + `console.log`.

## Estética

Dark mode con acentos violeta/índigo y cyan, glassmorphism (blur + bordes con glow neón),
tipografía Inter (texto) + Space Mono (datos numéricos), proporción vertical tipo ventana
flotante de plugin.

## Datos mock

20 samples con nombres realistas repartidos en las categorías, cada uno con BPM y key
random pero coherentes. Editables en el array `SAMPLE_NAMES` / `SAMPLES` dentro del HTML.
