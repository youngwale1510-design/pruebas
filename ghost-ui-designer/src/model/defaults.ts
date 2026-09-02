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
      rectNorm: { x: 0.485, y: 0.72, w: 0.03, h: 0.22 },
      fill: '#1b1b1e',
      anim: { mode: 'rotate', minDeg: -150, maxDeg: 150 },
      effects: [],
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
