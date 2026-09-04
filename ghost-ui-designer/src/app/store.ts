import { create } from 'zustand';
import { Control, Effect, EffectType, Layer, SceneDocument } from '../model/scene';
import { emptyScene, makeId, defaultKnob, defaultParam, defaultSlideSwitch, defaultToggleSwitch, defaultLed, defaultBackground, defaultLabel, defaultImage } from '../model/defaults';
import { AlignKind, Guides, MatchDim, alignRects, distributeRects, matchSizeRects, snapRect } from './align';
import { MaterialId, applyMaterial } from '../model/materials';
import { ParamDef } from '../model/scene';
import { KnobConfig, defaultKnobConfig } from '../model/knobConfig';

interface AppState {
  scene: SceneDocument;
  selectedId: string | null;
  /** Selección múltiple (para alinear/distribuir/igualar tamaño). `selectedId`
   *  siempre es igual al último elemento de esta lista, o null si está vacía. */
  selectedIds: string[];
  previewCpp: string;
  previewValue: number; // 0..1, para previsualizar el giro de los controles
  /** Guías de regla (solo en el editor; no se guardan en el proyecto). */
  guides: Guides;

  /** Selecciona un único control (limpia el resto de la selección). null = deselecciona. */
  select: (id: string | null) => void;
  /** Suma o quita `id` de la selección (clic con Shift), sin tocar el resto. */
  toggleSelect: (id: string) => void;
  alignSelected: (kind: AlignKind) => void;
  distributeSelected: (axis: 'h' | 'v') => void;
  matchSizeSelected: (dim: MatchDim) => void;
  addGuide: (orientation: 'h' | 'v', pos: number) => void;
  removeGuide: (orientation: 'h' | 'v', pos: number) => void;
  clearGuides: () => void;
  /** Posición ajustada a guías/otros controles (imán); usado al arrastrar. */
  snapMove: (id: string, x: number, y: number) => { x: number; y: number };
  /** Imagen libre (logo, sello…): movible y redimensionable, no ligada al lienzo. */
  addImage: () => void;
  addKnob: () => void;
  /** Añade un switch (deslizante o de palanca) con N pasos y su parámetro enum. */
  addSwitch: (kind: 'slide' | 'toggle' | 'led', steps?: number) => void;
  /** Fondo del plugin (una sola vez, al fondo de la pila). */
  addBackground: () => void;
  /** Etiqueta de texto. */
  addLabel: () => void;
  /** Copia el estilo (capas + margen/marcas) del control indicado. */
  copyStyle: (controlId: string) => void;
  /** Pega el estilo copiado en un control, o en todos los del mismo tipo.
   *  `includeSize` también copia el ancho/alto del control de origen. */
  pasteStyle: (controlId: string, toAllOfType?: boolean, includeSize?: boolean) => void;
  /** Estilo copiado (portapapeles interno). */
  styleClipboard: { layers: Layer[]; props: Control['props']; size: { w: number; h: number }; sourceType: Control['type'] } | null;
  /** Muestra los sliders de cada efecto en el panel lateral. */
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  setMaterial: (controlId: string, layerId: string, material: MaterialId, fill?: string) => void;
  updateParam: (id: string, patch: Partial<ParamDef>) => void;
  /** Cambia el nº de pasos de un switch (frames del filmstrip + rango del parámetro). */
  setSteps: (controlId: string, steps: number) => void;
  updateControl: (id: string, patch: Partial<Control>) => void;
  moveControl: (id: string, x: number, y: number) => void;
  setKnob3d: (id: string, cfg: KnobConfig | undefined) => void;
  setLight: (patch: Partial<SceneDocument['light']>) => void;
  /** Cambia tamaño/color de fondo del lienzo del plugin (PLUG_WIDTH/HEIGHT). */
  setCanvas: (patch: Partial<SceneDocument['canvas']>) => void;
  updateLayer: (controlId: string, layerId: string, patch: Partial<Layer>) => void;
  addLayer: (controlId: string, layer: Layer) => void;
  removeLayer: (controlId: string, layerId: string) => void;
  toggleEffect: (controlId: string, layerId: string, type: EffectType) => void;
  addEffect: (controlId: string, layerId: string, type: EffectType, params?: Effect['params']) => void;
  removeEffect: (controlId: string, layerId: string, effectId: string) => void;
  updateEffect: (controlId: string, layerId: string, effectId: string, params: Effect['params']) => void;
  setPreviewValue: (v: number) => void;
  setScene: (scene: SceneDocument) => void;
  /** Carga controles leídos de un .cpp: completa capas por tipo y crea los parámetros que falten. */
  importControls: (controls: Control[], pluginName: string) => void;
  setPreview: (cpp: string) => void;
}

/** Aplica una transformación a una capa concreta de un control. */
function editLayer(
  scene: SceneDocument,
  controlId: string,
  layerId: string,
  fn: (l: Layer) => Layer,
): SceneDocument {
  return {
    ...scene,
    controls: scene.controls.map((c) =>
      c.id === controlId
        ? { ...c, layers: c.layers.map((l) => (l.id === layerId ? fn(l) : l)) }
        : c,
    ),
  };
}

export const useStore = create<AppState>((set, get) => ({
  scene: emptyScene('GhostBand'),
  selectedId: null,
  selectedIds: [],
  guides: { h: [], v: [] },
  previewCpp: '',
  previewValue: 0.5,
  styleClipboard: null,
  advanced: false,
  setAdvanced: (v: boolean) => set({ advanced: v }),

  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  toggleSelect: (id) =>
    set((s) => {
      const on = s.selectedIds.includes(id);
      const ids = on ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id];
      return { selectedIds: ids, selectedId: ids.length ? ids[ids.length - 1] : null };
    }),

  alignSelected: (kind) =>
    set((s) => {
      const targets = s.scene.controls.filter((c) => s.selectedIds.includes(c.id));
      if (targets.length < 2) return {};
      const patches = alignRects(targets.map((c) => c.rect), kind);
      return {
        scene: {
          ...s.scene,
          controls: s.scene.controls.map((c) => {
            const i = targets.findIndex((t) => t.id === c.id);
            if (i === -1) return c;
            return { ...c, rect: { ...c.rect, ...patches[i] } };
          }),
        },
      };
    }),

  distributeSelected: (axis) =>
    set((s) => {
      const targets = s.scene.controls.filter((c) => s.selectedIds.includes(c.id));
      if (targets.length < 3) return {};
      const patches = distributeRects(targets.map((c) => c.rect), axis);
      return {
        scene: {
          ...s.scene,
          controls: s.scene.controls.map((c) => {
            const i = targets.findIndex((t) => t.id === c.id);
            if (i === -1) return c;
            return { ...c, rect: { ...c.rect, ...patches[i] } };
          }),
        },
      };
    }),

  matchSizeSelected: (dim) =>
    set((s) => {
      // El orden importa: la referencia es el PRIMER control seleccionado
      // (el primer clic), como el "objeto clave" de Illustrator.
      const targets = s.selectedIds
        .map((id) => s.scene.controls.find((c) => c.id === id))
        .filter((c): c is Control => !!c);
      if (targets.length < 2) return {};
      const patches = matchSizeRects(targets.map((c) => c.rect), dim);
      return {
        scene: {
          ...s.scene,
          controls: s.scene.controls.map((c) => {
            const i = targets.findIndex((t) => t.id === c.id);
            if (i === -1) return c;
            return { ...c, rect: { ...c.rect, ...patches[i] } };
          }),
        },
      };
    }),

  addGuide: (orientation, pos) =>
    set((s) => ({
      guides: {
        ...s.guides,
        [orientation]: [...s.guides[orientation], Math.round(pos)],
      },
    })),

  removeGuide: (orientation, pos) =>
    set((s) => ({
      guides: {
        ...s.guides,
        [orientation]: s.guides[orientation].filter((p) => p !== pos),
      },
    })),

  clearGuides: () => set({ guides: { h: [], v: [] } }),

  snapMove: (id, x, y) => {
    const s = get();
    const target = s.scene.controls.find((c) => c.id === id);
    if (!target) return { x, y };
    const others = s.scene.controls.filter((c) => c.id !== id).map((c) => c.rect);
    return snapRect({ ...target.rect, x, y }, s.guides, others);
  },

  addImage: () =>
    set((s) => {
      const n = s.scene.controls.filter((c) => c.name.startsWith('Imagen')).length + 1;
      const img = defaultImage(makeId('img'), `Imagen ${n}`);
      img.rect.x = 20 + ((n - 1) % 4) * 30;
      img.rect.y = 20 + ((n - 1) % 4) * 30;
      return { scene: { ...s.scene, controls: [...s.scene.controls, img] }, selectedId: img.id, selectedIds: [img.id] };
    }),

  addKnob: () =>
    set((s) => {
      const n = s.scene.controls.length + 1;
      const pid = `param${n}`;
      const knob = defaultKnob(makeId('knob'), `Knob ${n}`, pid);
      knob.rect.x = 20 + ((n - 1) % 4) * 100;
      knob.rect.y = 20 + Math.floor((n - 1) / 4) * 130;
      return {
        scene: {
          ...s.scene,
          params: [...s.scene.params, defaultParam(pid, `Param ${n}`)],
          controls: [...s.scene.controls, knob],
        },
        selectedId: knob.id,
        selectedIds: [knob.id],
      };
    }),

  addBackground: () =>
    set((s) => {
      if (s.scene.controls.some((c) => c.name === 'Fondo')) return {};
      const bg = defaultBackground(makeId('bg'), s.scene.canvas.width, s.scene.canvas.height);
      return { scene: { ...s.scene, controls: [bg, ...s.scene.controls] }, selectedId: bg.id, selectedIds: [bg.id] };
    }),

  addLabel: () =>
    set((s) => {
      const l = defaultLabel(makeId('label'));
      l.rect.x = 20 + (s.scene.controls.length % 4) * 100;
      l.rect.y = 20 + Math.floor(s.scene.controls.length / 4) * 40;
      return { scene: { ...s.scene, controls: [...s.scene.controls, l] }, selectedId: l.id, selectedIds: [l.id] };
    }),

  copyStyle: (controlId) =>
    set((s) => {
      const c = s.scene.controls.find((x) => x.id === controlId);
      if (!c) return {};
      // Se copia la apariencia, nunca la identidad: ni id, ni rect, ni parámetro.
      const { pad, bodyInset, frames, orientation } = c.props;
      const props: Control['props'] = {};
      if (pad !== undefined) props.pad = pad;
      if (bodyInset !== undefined) props.bodyInset = bodyInset;
      if (frames !== undefined) props.frames = frames;
      if (orientation !== undefined) props.orientation = orientation;
      return {
        styleClipboard: {
          layers: JSON.parse(JSON.stringify(c.layers)) as Layer[],
          props,
          size: { w: c.rect.w, h: c.rect.h },
          sourceType: c.type,
        },
      };
    }),

  pasteStyle: (controlId, toAllOfType = false, includeSize = false) =>
    set((s) => {
      const clip = s.styleClipboard;
      if (!clip) return {};
      const target = s.scene.controls.find((x) => x.id === controlId);
      if (!target) return {};
      const ids = toAllOfType
        ? s.scene.controls.filter((x) => x.type === target.type).map((x) => x.id)
        : [controlId];
      return {
        scene: {
          ...s.scene,
          controls: s.scene.controls.map((c) => {
            if (!ids.includes(c.id)) return c;
            // Los switches conservan sus pasos; el resto hereda los frames del origen.
            const props: Control['props'] = { ...c.props, ...clip.props };
            if (c.type === 'IBSwitchControl') props.frames = c.props.frames;
            const rect = includeSize ? { ...c.rect, w: clip.size.w, h: clip.size.h } : c.rect;
            return {
              ...c,
              rect,
              layers: JSON.parse(JSON.stringify(clip.layers)).map((l: Layer) => ({ ...l, id: makeId('lyr') })),
              props,
            };
          }),
        },
      };
    }),

  addSwitch: (kind, steps = 2) =>
    set((s) => {
      const n = s.scene.controls.length + 1;
      const pid = `param${n}`;
      const make = kind === 'slide' ? defaultSlideSwitch : kind === 'led' ? defaultLed : defaultToggleSwitch;
      const sw = make(makeId(kind), `${kind === 'slide' ? 'Switch' : kind === 'led' ? 'LED' : 'Palanca'} ${n}`, pid, steps);
      sw.rect.x = 20 + ((n - 1) % 4) * 100;
      sw.rect.y = 20 + Math.floor((n - 1) / 4) * 130;
      const param: ParamDef = { id: pid, name: `Param ${n}`, type: 'enum', min: 0, max: steps - 1, default: 0 };
      return {
        scene: { ...s.scene, params: [...s.scene.params, param], controls: [...s.scene.controls, sw] },
        selectedId: sw.id,
        selectedIds: [sw.id],
      };
    }),

  setMaterial: (controlId, layerId, material, fill) =>
    set((s) => ({
      scene: editLayer(s.scene, controlId, layerId, (l) => ({
        ...l,
        fill: fill ?? l.fill,
        effects: applyMaterial(l.effects, material),
      })),
    })),

  updateParam: (id, patch) =>
    set((s) => ({
      scene: { ...s.scene, params: s.scene.params.map((p) => (p.id === id ? { ...p, ...patch } : p)) },
    })),

  setSteps: (controlId, steps) =>
    set((s) => {
      const n = Math.max(2, Math.min(16, Math.round(steps) || 2));
      const c = s.scene.controls.find((x) => x.id === controlId);
      if (!c) return {};
      return {
        scene: {
          ...s.scene,
          controls: s.scene.controls.map((x) => (x.id === controlId ? { ...x, props: { ...x.props, frames: n } } : x)),
          params: s.scene.params.map((p) => (p.id === c.paramId ? { ...p, type: 'enum', min: 0, max: n - 1 } : p)),
        },
      };
    }),

  updateControl: (id, patch) =>
    set((s) => ({
      scene: {
        ...s.scene,
        controls: s.scene.controls.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      },
    })),

  moveControl: (id, x, y) =>
    set((s) => ({
      scene: {
        ...s.scene,
        controls: s.scene.controls.map((c) =>
          c.id === id ? { ...c, rect: { ...c.rect, x, y } } : c,
        ),
      },
    })),

  setKnob3d: (id, cfg) =>
    set((s) => ({
      scene: {
        ...s.scene,
        controls: s.scene.controls.map((c) =>
          c.id === id ? { ...c, knob3d: cfg, type: cfg ? 'IBKnobControl' : c.type } : c,
        ),
      },
    })),

  setLight: (patch) =>
    set((s) => ({ scene: { ...s.scene, light: { ...s.scene.light, ...patch } } })),

  setCanvas: (patch) =>
    set((s) => ({ scene: { ...s.scene, canvas: { ...s.scene.canvas, ...patch } } })),

  updateLayer: (controlId, layerId, patch) =>
    set((s) => ({ scene: editLayer(s.scene, controlId, layerId, (l) => ({ ...l, ...patch })) })),

  addLayer: (controlId, layer) =>
    set((s) => ({
      scene: {
        ...s.scene,
        controls: s.scene.controls.map((c) =>
          c.id === controlId ? { ...c, layers: [...c.layers, layer] } : c,
        ),
      },
    })),

  removeLayer: (controlId, layerId) =>
    set((s) => ({
      scene: {
        ...s.scene,
        controls: s.scene.controls.map((c) =>
          c.id === controlId ? { ...c, layers: c.layers.filter((l) => l.id !== layerId) } : c,
        ),
      },
    })),

  toggleEffect: (controlId, layerId, type) =>
    set((s) => ({
      scene: editLayer(s.scene, controlId, layerId, (l) =>
        l.effects.some((e) => e.type === type)
          ? { ...l, effects: l.effects.filter((e) => e.type !== type) }
          : { ...l, effects: [...l.effects, { id: makeId('fx'), type, enabled: true, params: {} }] },
      ),
    })),

  addEffect: (controlId, layerId, type, params = {}) =>
    set((s) => ({
      scene: editLayer(s.scene, controlId, layerId, (l) => ({
        ...l, effects: [...l.effects, { id: makeId('fx'), type, enabled: true, params }],
      })),
    })),

  removeEffect: (controlId, layerId, effectId) =>
    set((s) => ({
      scene: editLayer(s.scene, controlId, layerId, (l) => ({
        ...l, effects: l.effects.filter((e) => e.id !== effectId),
      })),
    })),

  updateEffect: (controlId, layerId, effectId, params) =>
    set((s) => ({
      scene: editLayer(s.scene, controlId, layerId, (l) => ({
        ...l,
        effects: l.effects.map((e) => (e.id === effectId ? { ...e, params: { ...e.params, ...params } } : e)),
      })),
    })),

  setPreviewValue: (v) => set({ previewValue: Math.max(0, Math.min(1, v)) }),
  setScene: (scene) => set({ scene, selectedId: null, selectedIds: [] }),
  importControls: (controls, pluginName) =>
    set((s) => {
      const params = [...s.scene.params];
      const prepared = controls.map((c) => {
        if (c.paramId && !params.some((p) => p.id === c.paramId)) params.push(defaultParam(c.paramId, c.paramId));
        if (c.layers.length > 0) return c;
        // Control recién marcado (sin payload de diseño): plantilla según el tipo,
        // convertido a bitmap para poder reestilizarlo al 100 %.
        if (c.type === 'IVKnobControl' || c.type === 'IBKnobControl') {
          const k = defaultKnob(c.id, c.name, c.paramId);
          return { ...k, rect: c.rect, props: { ...k.props, ...c.props } };
        }
        if (c.type === 'IVToggleControl' || c.type === 'IVButtonControl' || c.type === 'IBSwitchControl') {
          const sw = defaultSlideSwitch(c.id, c.name, c.paramId, 2);
          return { ...sw, rect: c.rect, props: { ...sw.props, ...c.props } };
        }
        return c;
      });
      return {
        scene: { ...s.scene, meta: { ...s.scene.meta, pluginName }, params, controls: prepared },
        selectedId: prepared[0]?.id ?? null,
        selectedIds: prepared[0] ? [prepared[0].id] : [],
      };
    }),
  setPreview: (cpp) => set({ previewCpp: cpp }),
}));

export { defaultKnobConfig };
