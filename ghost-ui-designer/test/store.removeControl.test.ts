import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';
import { Control } from '../src/model/scene';

const ctrl = (id: string): Control => ({
  id, type: 'IVKnobControl', name: id, rect: { x: 0, y: 0, w: 10, h: 10 }, props: {}, layers: [], effects: [],
});

describe('store: borrar un control ENTERO (no una capa suelta)', () => {
  beforeEach(() => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'T', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      lights: [{ angleDeg: 120, intensity: 0.7 }],
      assets: { textures: [], filmstrips: [], fonts: [] },
      params: [],
      controls: [ctrl('a'), ctrl('b'), ctrl('c')],
      refBoxes: [],
    });
  });

  it('removeControl saca el control de la escena por completo (no deja rastro)', () => {
    useStore.getState().select('b');
    useStore.getState().removeControl('b');
    expect(useStore.getState().scene.controls.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('removeControl limpia la selección si el control borrado estaba seleccionado', () => {
    useStore.getState().select('b');
    useStore.getState().removeControl('b');
    expect(useStore.getState().selectedId).toBeNull();
    expect(useStore.getState().selectedIds).toEqual([]);
  });

  it('removeControl no toca la selección si el borrado es otro control', () => {
    useStore.getState().select('a');
    useStore.getState().removeControl('b');
    expect(useStore.getState().selectedId).toBe('a');
  });

  it('removeSelectedControls borra TODOS los seleccionados a la vez', () => {
    useStore.getState().selectMany(['a', 'c'], false);
    useStore.getState().removeSelectedControls();
    expect(useStore.getState().scene.controls.map((c) => c.id)).toEqual(['b']);
    expect(useStore.getState().selectedIds).toEqual([]);
    expect(useStore.getState().selectedId).toBeNull();
  });

  it('removeSelectedControls sin nada seleccionado no hace nada', () => {
    useStore.getState().select(null);
    useStore.getState().removeSelectedControls();
    expect(useStore.getState().scene.controls).toHaveLength(3);
  });

  it('se puede deshacer con undo (mismo historial que el resto de acciones)', () => {
    useStore.getState().removeControl('b');
    expect(useStore.getState().scene.controls.map((c) => c.id)).toEqual(['a', 'c']);
    useStore.getState().undo();
    expect(useStore.getState().scene.controls.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
