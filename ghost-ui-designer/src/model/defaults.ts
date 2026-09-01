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

/** Pila de capas pseudo-3D de un knob (look Canvas Audio), rasterizable a filmstrip. */
export function defaultKnobLayers(): Layer[] {
  return [
    layer('Base', {
      fill: '#2a2a30',
      effects: [
        fx('dropShadow', { distance: 5, blur: 10, color: 'rgba(0,0,0,0.55)', useLight: true }),
        fx('bevel', { size: 3, highlight: 'rgba(255,255,255,0.35)', shadow: 'rgba(0,0,0,0.5)' }),
      ],
    }),
    layer('Ring', {
      inset: 0.06,
      fill: '#3a3a42',
      effects: [
        fx('gradientOverlay', { type: 'linear', from: 'rgba(255,255,255,0.18)', to: 'rgba(0,0,0,0.28)' }),
        fx('bevel', { size: 4 }),
      ],
    }),
    layer('Cap', {
      inset: 0.2,
      fill: '#4a4a54',
      effects: [
        fx('gradientOverlay', { type: 'radial', from: 'rgba(255,255,255,0.22)', to: 'rgba(0,0,0,0.15)' }),
        fx('bevel', { size: 6 }),
        fx('innerShadow', { distance: 2, blur: 5, color: 'rgba(0,0,0,0.5)' }),
        fx('noise', { amount: 0.05 }),
      ],
    }),
    layer('Indicator', {
      shape: 'roundRect',
      cornerRadius: 3,
      rectNorm: { x: 0.47, y: 0.12, w: 0.06, h: 0.28 },
      fill: '#e8e8ee',
      anim: { mode: 'rotate', minDeg: -135, maxDeg: 135 },
      effects: [fx('glow', { blur: 4, color: 'rgba(180,210,255,0.5)' })],
    }),
  ];
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
