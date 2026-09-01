// Configuración de un knob por partes (base / cuerpo / tope / indicador), material
// y tamaños. Es lo que consume el pipeline 3D→filmstrip para hornear el control.
// Todo aquí es data pura y serializable (se guarda en el .ghostui junto al control).

export type SlotShape = 'ellipse' | 'scalloped' | 'polygon' | 'triangle' | 'roundRect';
export type MidShape = SlotShape | 'none';
export type TopType = 'none' | 'hub' | 'button' | 'chicken';
export type IndicatorType = 'none' | 'line' | 'dot';

export type KnobMaterial =
  | 'turned'      // aluminio torneado
  | 'brushed'     // aluminio cepillado
  | 'chrome'      // cromo espejo
  | 'brass'       // latón / oro
  | 'darkmetal'   // metal oscuro
  | 'blackgloss'  // plástico negro brillante
  | 'glossy'      // plástico brillante de color
  | 'matte';      // plástico mate

export interface KnobLight {
  angleDeg: number;   // dirección en el plano de pantalla (0=derecha, 90=abajo)
  intensity: number;  // 0..1
  elev: number;       // 0..1 (rasante..cenital)
}

export interface KnobConfig {
  base: { shape: SlotShape; material: KnobMaterial; size: number; spin: boolean };
  mid: { shape: MidShape; material: KnobMaterial; size: number; spin: boolean };
  top: { type: TopType; material: KnobMaterial; size: number; spin: boolean };
  indicator: { type: IndicatorType; len: number; width: number };
  light: KnobLight;
  sweepDeg: number;   // barrido total del indicador
  frames: number;     // nº de frames del filmstrip
}

export function defaultKnobConfig(): KnobConfig {
  return {
    base: { shape: 'scalloped', material: 'darkmetal', size: 1, spin: true },
    mid: { shape: 'ellipse', material: 'turned', size: 0.52, spin: false },
    top: { type: 'hub', material: 'turned', size: 0.12, spin: false },
    indicator: { type: 'line', len: 0.28, width: 0.06 },
    light: { angleDeg: 115, intensity: 0.75, elev: 0.5 },
    sweepDeg: 300,
    frames: 81,
  };
}

/** Puntos de partida (rellenan la configuración). */
export const KNOB_QUICKSTARTS: Record<string, Partial<KnobConfig>> = {
  Torneado: {
    base: { shape: 'scalloped', material: 'darkmetal', size: 1, spin: true },
    mid: { shape: 'ellipse', material: 'turned', size: 0.52, spin: false },
    top: { type: 'hub', material: 'turned', size: 0.12, spin: false },
    indicator: { type: 'line', len: 0.28, width: 0.06 }, sweepDeg: 300,
  },
  Cepillado: {
    base: { shape: 'ellipse', material: 'darkmetal', size: 1, spin: false },
    mid: { shape: 'ellipse', material: 'brushed', size: 0.68, spin: false },
    top: { type: 'none', material: 'brushed', size: 0.12, spin: false },
    indicator: { type: 'line', len: 0.3, width: 0.055 }, sweepDeg: 270,
  },
  Cromo: {
    base: { shape: 'scalloped', material: 'darkmetal', size: 1, spin: true },
    mid: { shape: 'ellipse', material: 'chrome', size: 0.52, spin: false },
    top: { type: 'hub', material: 'chrome', size: 0.12, spin: false },
    indicator: { type: 'line', len: 0.28, width: 0.06 }, sweepDeg: 300,
  },
  Plastico: {
    base: { shape: 'ellipse', material: 'blackgloss', size: 1, spin: false },
    mid: { shape: 'ellipse', material: 'glossy', size: 0.72, spin: false },
    top: { type: 'none', material: 'glossy', size: 0.12, spin: false },
    indicator: { type: 'line', len: 0.3, width: 0.06 }, sweepDeg: 270,
  },
  Chicken: {
    base: { shape: 'ellipse', material: 'blackgloss', size: 0.76, spin: false },
    mid: { shape: 'none', material: 'blackgloss', size: 0.56, spin: false },
    top: { type: 'chicken', material: 'blackgloss', size: 0.84, spin: true },
    indicator: { type: 'line', len: 0.34, width: 0.05 }, sweepDeg: 300,
  },
};

export function applyQuickstart(base: KnobConfig, name: string): KnobConfig {
  const q = KNOB_QUICKSTARTS[name];
  return q ? { ...base, ...structuredClone(q) } as KnobConfig : base;
}
