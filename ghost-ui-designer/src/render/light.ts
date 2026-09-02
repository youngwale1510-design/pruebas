// Resolución de la fuente de luz global a vectores usados por sombras y biseles.
// Funciones puras (sin canvas) para poder probarlas headless.

import { LightSource } from '../model/scene';

export interface LightVectors {
  /** Vector unitario apuntando DESDE la luz HACIA la escena (dirección de sombra). */
  dx: number;
  dy: number;
  intensity: number;
}

export function resolveLight(light: LightSource): LightVectors {
  const rad = (light.angleDeg * Math.PI) / 180;
  return {
    dx: Math.cos(rad),
    dy: Math.sin(rad),
    intensity: Math.max(0, Math.min(1, light.intensity)),
  };
}

/** Offset de sombra proyectada, en píxeles, para una distancia dada. */
export function shadowOffset(light: LightSource, distance: number) {
  const v = resolveLight(light);
  return { x: v.dx * distance * v.intensity, y: v.dy * distance * v.intensity };
}

/** Gira el vector de luz un delta (grados). Para contrarrotar la luz cuando una
 *  pieza gira: la forma rota, pero la iluminación queda fija en el mundo. */
export function rotateLight(light: LightVectors, degDelta: number): LightVectors {
  const a = Math.atan2(light.dy, light.dx) + (degDelta * Math.PI) / 180;
  return { ...light, dx: Math.cos(a), dy: Math.sin(a) };
}

/** Mapea value(0..1) al ángulo (grados) de una capa animada por rotación. */
export function rotationForValue(
  value: number,
  minDeg = -135,
  maxDeg = 135,
): number {
  const t = Math.max(0, Math.min(1, value));
  return minDeg + (maxDeg - minDeg) * t;
}
