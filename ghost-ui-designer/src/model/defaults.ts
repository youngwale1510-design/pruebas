import {
  Control,
  Effect,
  GHOSTUI_VERSION,
  Layer,
  ParamDef,
  SceneDocument,
} from './scene';

let counter = 0;
/** id corto y estable dentro de una sesión; para el proyecto real usar uuid. */
export function makeId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Date.now().toString(36).slice(-3)}`;
}

export function emptyScene(pluginName = 'MyPlugin'): SceneDocument {
  return {
    version: GHOSTUI_VERSION,
    meta: { pluginName, author: '' },
    canvas: { width: 400, height: 300, bg: '#1e1e22' },
    light: { angleDeg: 120, intensity: 0.7 },
    assets: { textures: [], filmstrips: [] },
    params: [],
    controls: [],
  };
}

export function defaultParam(id: string, name: string): ParamDef {
  return { id, name, type: 'double', min: 0, max: 100, default: 50, unit: '' };
}

function fx(type: Effect['type'], params: Effect['params'] = {}): Effect {
  return { id: makeId('fx'), type, enabled: true, params };
}

function layer(name: string, patch: Partial<Layer>): Layer {
  return {
    id: makeId('lyr'),
    name,
    kind: 'shape',
    visible: true,
    blendMode: 'normal',
    opacity: 1,
    shape: 'ellipse',
    effects: [],
    ...patch,
  };
}

/** Pila de capas de un knob torneado (aluminio con reflejos), rasterizable a filmstrip. */
export function defaultKnobLayers(): Layer[] {
  return [
    layer('Base', {
      shape: 'scalloped',
      lobes: 22,
      fill: '#1c1c20',
      anim: { mode: 'rotate', minDeg: -150, maxDeg: 150 },
      effects: [
        fx('dropShadow', { distance: 6, blur: 14, color: 'rgba(0,0,0,0.6)', useLight: true }),
        fx('contactShadow', { size: 3, strength: 0.7 }),
        fx('bevel', { size: 6 }),
        fx('dish', { offset: 0.5 }),
        fx('knurl', { depth: 0.16, strength: 0.55 }),
        fx('gradientOverlay', { type: 'radial', from: 'rgba(255,255,255,0.06)', to: 'rgba(0,0,0,0.45)' }),
        fx('rim', { size: 3 }),
      ],
    }),
    layer('Cap', {
      inset: 0.22,
      fill: '#b6b9be',
      anim: { mode: 'rotate', minDeg: -150, maxDeg: 150 },
      effects: [
        fx('env', { sky: 'rgba(255,255,255,0.75)', ground: 'rgba(0,0,0,0.6)' }),
        fx('grooves', { step: 2.2 }),
        fx('spun', {}),
        fx('dish', { offset: 0.42 }),
        fx('specular', { size: 0.5, aspect: 2.2 }),
        fx('bevel', { size: 3 }),
        fx('recess', { depth: 0.62, lip: 2.4 }),
        fx('rim', { size: 2 }),
      ],
    }),
    layer('Hub', {
      inset: 0.46,
      fill: '#9a9da2',
      anim: { mode: 'rotate', minDeg: -150, maxDeg: 150 },
      effects: [
        fx('grooves', { step: 1.6 }),
        fx('dish', { offset: 0.4 }),
        fx('recess', { depth: 0.5, lip: 1.6 }),
      ],
    }),
    layer('Indicator', {
      shape: 'roundRect',
      cornerRadius: 3,
      rectNorm: { x: 0.485, y: 0.08, w: 0.03, h: 0.22 }, // arriba: el giro pasa por las 12
      fill: '#1b1b1e',
      anim: { mode: 'rotate', minDeg: -150, maxDeg: 150 },
      effects: [],
    }),
  ];
}

/** Switch deslizante (pista tipo píldora + bola cromada que recorre N posiciones). */
export function defaultSlideSwitch(id: string, name: string, paramId?: string, steps = 2): Control {
  const w = 96, h = 44;
  const d = 0.72 * h; // diámetro de la bola en px
  const bw = d / w, bh = d / h;
  const x0 = 0.08;
  return {
    id,
    type: 'IBSwitchControl',
    name,
    rect: { x: 20, y: 20, w, h },
    paramId,
    props: { frames: steps, orientation: 'vertical' },
    layers: [
      layer('Pista', {
        shape: 'roundRect',
        cornerRadius: 18,
        rectNorm: { x: 0.02, y: 0.06, w: 0.96, h: 0.88 },
        fill: '#121215',
        effects: [
          fx('recess', { depth: 0.8, lip: 2 }),
          fx('innerShadow', { distance: 3, blur: 8, color: 'rgba(0,0,0,0.85)' }),
          fx('gradientOverlay', { type: 'linear', from: 'rgba(255,255,255,0.05)', to: 'rgba(0,0,0,0.35)' }),
          fx('rim', { size: 1.5 }),
        ],
      }),
      layer('Bola', {
        shape: 'ellipse',
        rectNorm: { x: x0, y: (1 - bh) / 2, w: bw, h: bh },
        fill: '#3a3b42',
        anim: { mode: 'translate', travel: { x: 1 - 2 * x0 - bw, y: 0 } },
        effects: [
          fx('dropShadow', { distance: 3, blur: 7, color: 'rgba(0,0,0,0.75)', useLight: true }),
          fx('contactShadow', { size: 2.5, strength: 0.8 }),
          fx('chrome', { strength: 0.8 }),
          fx('dish', { offset: 0.55 }),
          fx('specular', { size: 0.32, aspect: 1.15, strength: 1.2 }),
          fx('bevel', { size: 2 }),
          fx('rim', { size: 2 }),
        ],
      }),
    ],
    effects: [],
  };
}

/** Switch de palanca (bat toggle) visto de frente: tuerca, casquillo y palanca
 *  con remate esférico que viaja de abajo a arriba en N posiciones. */
export function defaultToggleSwitch(id: string, name: string, paramId?: string, steps = 2): Control {
  const w = 64, h = 96;
  const ball = 18; // px
  const tipY0 = 0.78, tipY1 = 0.22;
  return {
    id,
    type: 'IBSwitchControl',
    name,
    rect: { x: 20, y: 20, w, h },
    paramId,
    props: { frames: steps, orientation: 'vertical' },
    layers: [
      layer('Placa', {
        shape: 'roundRect',
        cornerRadius: 6,
        rectNorm: { x: 0.1, y: 0.04, w: 0.8, h: 0.92 },
        fill: '#26272c',
        effects: [
          fx('dropShadow', { distance: 4, blur: 10, color: 'rgba(0,0,0,0.6)', useLight: true }),
          fx('brushed', {}),
          fx('bevel', { size: 2 }),
          fx('gradientOverlay', { type: 'linear', from: 'rgba(255,255,255,0.05)', to: 'rgba(0,0,0,0.3)' }),
          fx('rim', { size: 1.5 }),
        ],
      }),
      layer('Tuerca', {
        shape: 'polygon',
        sides: 6,
        rectNorm: { x: 0.14, y: 0.26, w: 0.72, h: 0.48 },
        fill: '#8e9197',
        effects: [
          fx('dropShadow', { distance: 3, blur: 6, color: 'rgba(0,0,0,0.6)', useLight: true }),
          fx('contactShadow', { size: 3, strength: 0.8 }),
          fx('extrude', { height: 4 }),
          fx('brushed', {}),
          fx('facet', { width: 0.3 }),
          fx('sheen', { width: 0.3, strength: 0.2 }),
          fx('rim', { size: 1.5 }),
        ],
      }),
      layer('Arandela', {
        shape: 'ellipse',
        rectNorm: { x: 0.22, y: 0.32, w: 0.56, h: 0.36 },
        fill: '#a3a6ac',
        effects: [
          fx('contactShadow', { size: 2, strength: 0.7 }),
          fx('extrude', { height: 2 }),
          fx('grooves', { step: 2 }),
          fx('spun', {}),
          fx('chamfer', { steps: 2, width: 2.5 }),
          fx('rim', { size: 1.5 }),
        ],
      }),
      layer('Casquillo', {
        shape: 'ellipse',
        rectNorm: { x: 0.36, y: 0.41, w: 0.28, h: 0.18 },
        fill: '#2a2b30',
        effects: [
          fx('recess', { depth: 0.9, lip: 1.5 }),
          fx('innerShadow', { distance: 2, blur: 5, color: 'rgba(0,0,0,0.9)' }),
        ],
      }),
      layer('Palanca', {
        shape: 'ellipse',
        rectNorm: { x: 0.5 - (ball * 0.55) / w / 2, y: tipY0 - (ball * 0.55) / h / 2, w: (ball * 0.55) / w, h: (ball * 0.55) / h },
        fill: '#b4b7bc',
        anim: { mode: 'lever', travel: { x: 0, y: tipY1 - tipY0 }, pivotNorm: { x: 0.5, y: 0.5 } },
        effects: [
          fx('dropShadow', { distance: 5, blur: 9, color: 'rgba(0,0,0,0.7)', useLight: true }),
          fx('contactShadow', { size: 3, strength: 0.8 }),
          fx('chrome', { strength: 0.6, curve: 0 }),
          fx('cylinder', { cap: 1, gloss: 1 }),
          fx('rim', { size: 1.2 }),
        ],
      }),
      layer('Remate', {
        shape: 'ellipse',
        rectNorm: { x: 0.5 - ball / w / 2, y: tipY0 - ball / h / 2, w: ball / w, h: ball / h },
        fill: '#c3c6cb',
        anim: { mode: 'translate', travel: { x: 0, y: tipY1 - tipY0 } },
        effects: [
          fx('dropShadow', { distance: 3, blur: 6, color: 'rgba(0,0,0,0.7)', useLight: true }),
          fx('contactShadow', { size: 2, strength: 0.6 }),
          fx('chrome', { strength: 0.9 }),
          fx('dish', { offset: 0.5 }),
          fx('specular', { size: 0.35, aspect: 1.2, strength: 1.1 }),
          fx('bevel', { size: 2 }),
          fx('rim', { size: 2 }),
        ],
      }),
    ],
    effects: [],
  };
}

/** LED con bisel cromado: N estados (2 = apagado/encendido; más = intensidades). */
export function defaultLed(id: string, name: string, paramId?: string, steps = 2, color = '#ff3020'): Control {
  return {
    id,
    type: 'IBSwitchControl',
    name,
    rect: { x: 20, y: 20, w: 40, h: 40 },
    paramId,
    props: { frames: steps, orientation: 'vertical' },
    layers: [
      layer('Bisel', {
        shape: 'ellipse',
        inset: 0.1,
        fill: '#9a9da3',
        effects: [
          fx('dropShadow', { distance: 2, blur: 5, color: 'rgba(0,0,0,0.6)', useLight: true }),
          fx('contactShadow', { size: 2, strength: 0.7 }),
          fx('extrude', { height: 2 }),
          fx('chrome', { strength: 0.7 }),
          fx('chamfer', { steps: 2, width: 2 }),
          fx('rim', { size: 1.5 }),
        ],
      }),
      layer('Lente', {
        shape: 'ellipse',
        inset: 0.22,
        fill: '#2a0808',
        effects: [
          fx('recess', { depth: 0.6, lip: 1.5 }),
          fx('emissive', { color, strength: 1, radius: 2.4, followValue: true }),
          fx('rim', { size: 1.5 }),
        ],
      }),
    ],
    effects: [],
  };
}

/** Knob por defecto: control bitmap (opción B) con capas y 61 frames. */
export function defaultKnob(id: string, name: string, paramId?: string): Control {
  return {
    id,
    type: 'IBKnobControl',
    name,
    rect: { x: 20, y: 20, w: 96, h: 96 },
    paramId,
    props: { frames: 61, orientation: 'vertical' },
    layers: defaultKnobLayers(),
    effects: [],
  };
}
