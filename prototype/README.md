# FXLAB Proto — Sample Browser VST (prototipo UI/UX)

Prototipo web para validar el diseño y la UX de un plugin de *sample browser* tipo VST,
inspirado en FXLAB de Midilatino, **antes** de construir el VST real en JUCE.

No procesa audio real de librería: usa datos mock y genera tonos simples con la
**Web Audio API** como preview. El foco está en el *look & feel* y el feedback interactivo.

## Cómo abrirlo

Es un único archivo autocontenido. Basta con abrir `prototype/index.html` en el navegador
(doble clic, o `open`/`xdg-start`). No requiere build ni servidor.

> El sonido arranca tras el primer clic (política de autoplay del navegador).

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
