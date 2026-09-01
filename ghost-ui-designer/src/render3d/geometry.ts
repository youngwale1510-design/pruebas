// Geometría pura del knob 3D (sin dependencias de three), para poder probarla
// headless. knobMesh.ts convierte estos datos en mallas THREE.

import { KnobConfig, SlotShape } from '../model/knobConfig';

/** Contorno 2D (en unidades mundo) de una forma de radio R. Puntos [x,y]. */
export function shapeOutline(shape: SlotShape, R: number, opts: { lobes?: number; sides?: number } = {}): [number, number][] {
  const pts: [number, number][] = [];
  if (shape === 'scalloped') {
    const lobes = opts.lobes ?? 12, depth = 0.05, steps = 200;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const rr = R * (1 - depth * (0.5 + 0.5 * Math.cos(lobes * t)));
      pts.push([Math.cos(t) * rr, Math.sin(t) * rr]);
    }
  } else if (shape === 'polygon' || shape === 'triangle') {
    const n = shape === 'triangle' ? 3 : (opts.sides ?? 6);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
  } else if (shape === 'roundRect') {
    // aproximación poligonal de un cuadrado con esquinas redondeadas
    const r = R * 0.9, cr = R * 0.28, seg = 6;
    const corners: [number, number][] = [[r - cr, r - cr], [-r + cr, r - cr], [-r + cr, -r + cr], [r - cr, -r + cr]];
    corners.forEach((c, ci) => {
      for (let i = 0; i <= seg; i++) {
        const a = (ci * Math.PI) / 2 + (i / seg) * (Math.PI / 2);
        pts.push([c[0] + Math.cos(a) * cr, c[1] + Math.sin(a) * cr]);
      }
    });
  } else {
    const steps = 96;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push([Math.cos(t) * R, Math.sin(t) * R]);
    }
  }
  return pts;
}

export interface Piece {
  slot: 'base' | 'mid' | 'top';
  shape: SlotShape;
  material: string;
  radius: number;   // fracción del knob (0..1)
  depth: number;    // grosor en z
  z: number;        // z de inicio (apilado)
  spin: boolean;
}

/** Apila las piezas del knob según la config. Función pura. */
export function stackPieces(cfg: KnobConfig): Piece[] {
  const out: Piece[] = [];
  let z = 0;
  out.push({ slot: 'base', shape: cfg.base.shape, material: cfg.base.material, radius: cfg.base.size, depth: 0.32, z, spin: cfg.base.spin });
  z += 0.32;
  if (cfg.mid.shape !== 'none') {
    out.push({ slot: 'mid', shape: cfg.mid.shape, material: cfg.mid.material, radius: cfg.mid.size, depth: 0.26, z, spin: cfg.mid.spin });
    z += 0.26;
  }
  if (cfg.top.type === 'hub' || cfg.top.type === 'button') {
    out.push({ slot: 'top', shape: 'ellipse', material: cfg.top.material, radius: cfg.top.size, depth: 0.16, z, spin: cfg.top.spin });
    z += 0.16;
  }
  return out;
}

/** z de la cara superior (donde va el indicador). */
export function topZ(cfg: KnobConfig): number {
  const pieces = stackPieces(cfg);
  const last = pieces[pieces.length - 1];
  return last.z + last.depth;
}

/** value (0..1) de cada frame del filmstrip. */
export function frameValues(frames: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < frames; i++) out.push(frames <= 1 ? 0 : i / (frames - 1));
  return out;
}

/** Ángulo de rotación (grados) del knob para un valor dado. */
export function knobAngle(value: number, sweepDeg: number): number {
  const t = Math.max(0, Math.min(1, value));
  return -sweepDeg / 2 + sweepDeg * t;
}

/** Dirección de la luz en 3D desde ángulo/elevación de pantalla. */
export function lightPosition(angleDeg: number, elev: number, dist = 3): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  // pantalla: y hacia abajo -> en three invertimos y
  return [Math.cos(a) * dist, -Math.sin(a) * dist, (0.4 + elev * 2.2) * 1.6];
}
