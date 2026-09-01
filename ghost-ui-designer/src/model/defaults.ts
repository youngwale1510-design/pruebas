import {
  Control,
  GHOSTUI_VERSION,
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

export function defaultKnob(id: string, name: string, paramId?: string): Control {
  return {
    id,
    type: 'IVKnobControl',
    name,
    rect: { x: 20, y: 20, w: 80, h: 100 },
    paramId,
    props: {},
    layers: [],
    effects: [],
  };
}
