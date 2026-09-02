import { create } from 'zustand';
import { Control, SceneDocument } from '../model/scene';
import { emptyScene, makeId, defaultKnob, defaultParam } from '../model/defaults';
import { KnobConfig, defaultKnobConfig } from '../model/knobConfig';

interface AppState {
  scene: SceneDocument;
  selectedId: string | null;
  previewCpp: string;

  select: (id: string | null) => void;
  addKnob: () => void;
  updateControl: (id: string, patch: Partial<Control>) => void;
  moveControl: (id: string, x: number, y: number) => void;
  setKnob3d: (id: string, cfg: KnobConfig | undefined) => void;
  setLight: (patch: Partial<SceneDocument['light']>) => void;
  setScene: (scene: SceneDocument) => void;
  setPreview: (cpp: string) => void;
}

export const useStore = create<AppState>((set) => ({
  scene: emptyScene('GhostBand'),
  selectedId: null,
  previewCpp: '',

  select: (id) => set({ selectedId: id }),

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

  setScene: (scene) => set({ scene, selectedId: null }),
  setPreview: (cpp) => set({ previewCpp: cpp }),
}));

export { defaultKnobConfig };
