# Beisu — Spec técnica (Ghost Plugins)

Generador de armónicos para sub-bajo. Se usa en paralelo sobre una copia del
bajo original (o directo sobre el track de bajo si LOWCUT = 0) para que el
sub se traduzca en equipos pequeños (celulares, laptops, bocinas Bluetooth).

Principio: los equipos pequeños no reproducen fundamentales por debajo de
~100-150Hz. Se generan armónicos superiores (fundamental faltante /
"missing fundamental") que sí caben en su rango, y se deja pasar solo esos
armónicos en la salida (HPF).

## Controles expuestos al usuario (solo 3, todos knobs)

1. **LOWCUT** — HPF en la salida, post-generación de armónicos.
   - Rango: 0Hz a 500Hz.
   - Pendiente fija interna: 24 dB/oct (no editable por el usuario).
   - En 0Hz no corta nada → permite usar el plugin directo sobre el track
     de bajo sin duplicar, si el usuario así lo decide.

2. **ARMOUNT** (Harmonics Amount) — 0% a 100%.
   - Escala la intensidad general de generación armónica (rectificación +
     saturación) del modo activo, sin alterar el balance relativo entre
     armónicos que define cada modo.

3. **MODE** — knob rotativo de 3 posiciones: `808` / `SINE` / `MODAL`.
   - Cambia toda la receta interna de golpe (balance armónico, tipo de
     generación, pitch tracking, release del envelope follower).

No hay bypass separado expuesto en el diseño actual — pendiente decidir si
se agrega una 4ª posición "OFF" al selector de modo o un control aparte.

## Recetas internas fijas por modo (NO expuestas al usuario)

### 808 (con pitch tracking activo)
- Detección de pitch en tiempo real + envelope follower, para que los
  armónicos generados sigan el glide característico del 808.
- Generación: rectificación de onda completa (2º armónico, coherente en
  fase) + soft-clip asimétrico (3er armónico moderado).
- Balance armónico: ~60% 2º / 30% 3er / 10% 4º-5º.
- Punto de arranque sugerido de LOWCUT al seleccionar este modo: ~150-200Hz.
- Release del envelope follower: ~150-300ms (caída típica de un 808).

### SINE
- Sin pitch tracking (tono más estable).
- Generación más agresiva: rectificación de onda completa fuerte (2º
  armónico dominante) + waveshaping simétrico suave (3er armónico), porque
  la señal no trae textura propia.
- Balance armónico: ~70% 2º / 20% 3er / 10% superiores.
- Punto de arranque sugerido de LOWCUT: ~100-150Hz.

### MODAL (bajo tipo analógico/Moog)
- Sin generación agresiva nueva — realce dinámico (saturación suave
  dependiente de envolvente) sobre armónicos que ya existen en la señal,
  enfocado en 200-500Hz.
- Balance armónico: ~40% par / 40% impar / 20% superiores, con ganancia
  base menor que los otros dos modos para no ensuciar el carácter
  analógico original.
- Punto de arranque sugerido de LOWCUT: ~200-300Hz.
- Sin pitch tracking.

Nota de implementación: el "punto de arranque sugerido" de LOWCUT al
cambiar de modo es un valor por default que se puede mostrar/animar en la
UI, pero el usuario conserva control manual del knob en todo momento.

## Cadena de señal

```
Input (señal completa, sin filtrar)
  -> Envelope follower + (pitch detector si modo = 808)
  -> Generador de armónicos (receta según MODE, intensidad según ARMOUNT)
  -> HPF de salida, 24 dB/oct, frecuencia = LOWCUT
  -> Output
```

## UI / Estética

- Chasis: rojo oscuro (`#7A1220`) con marco de filigrana ornamental dorada
  (`#C9A24B`), diseño de fondo hecho a mano por el usuario (asset final
  pendiente de integrar — el mockup usa una aproximación vectorial).
- Knobs: negros, knurled (textura de agarre), tope plateado cepillado,
  indicador de posición como línea blanca (no dot).
- Layout: LOWCUT arriba-izquierda, ARMOUNT arriba-derecha, MODE centrado
  más abajo, del mismo tamaño de línea de diseño que los otros dos pero
  puede ser ligeramente más pequeño (tipo palanca/selector).
- Logo "Beisu" en serif itálica dorada, centrado en la parte inferior del
  chasis.
- Tornillos decorativos en las 4 esquinas del área del filigrana (estética
  de pedal de guitarra boutique).

## Plataforma

- Framework: iPlug2 (C++).
- Formatos objetivo: VST3 y AU como mínimo (confirmar si se agrega AAX).
- Nombre de proyecto/clase: `Beisu`.
