import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';

describe('store: deshacer/rehacer', () => {
  beforeEach(() => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'T', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      lights: [{ angleDeg: 120, intensity: 0.7 }],
      assets: { textures: [], filmstrips: [] },
      params: [],
      controls: [],
    });
  });

  it('deshace el último cambio de escena', () => {
    useStore.getState().addKnob();
    expect(useStore.getState().scene.controls).toHaveLength(1);
    expect(useStore.getState().canUndo).toBe(true);
    useStore.getState().undo();
    expect(useStore.getState().scene.controls).toHaveLength(0);
  });

  it('rehace lo deshecho', () => {
    useStore.getState().addKnob();
    useStore.getState().undo();
    expect(useStore.getState().canRedo).toBe(true);
    useStore.getState().redo();
    expect(useStore.getState().scene.controls).toHaveLength(1);
  });

  it('un cambio nuevo tras deshacer borra el "rehacer" (rama nueva)', () => {
    useStore.getState().addKnob();
    useStore.getState().addKnob();
    useStore.getState().undo(); // vuelve a 1 knob
    expect(useStore.getState().scene.controls).toHaveLength(1);
    useStore.getState().addLabel(); // nueva acción tras deshacer
    expect(useStore.getState().canRedo).toBe(false);
    useStore.getState().redo(); // no debe hacer nada
    expect(useStore.getState().scene.controls).toHaveLength(2);
  });

  it('deshacer varias veces seguidas retrocede paso a paso', () => {
    useStore.getState().addKnob();
    useStore.getState().addKnob();
    useStore.getState().addKnob();
    expect(useStore.getState().scene.controls).toHaveLength(3);
    useStore.getState().undo();
    expect(useStore.getState().scene.controls).toHaveLength(2);
    useStore.getState().undo();
    expect(useStore.getState().scene.controls).toHaveLength(1);
    useStore.getState().undo();
    expect(useStore.getState().scene.controls).toHaveLength(0);
    expect(useStore.getState().canUndo).toBe(false);
  });

  it('sin historial, deshacer/rehacer no rompen nada', () => {
    expect(useStore.getState().canUndo).toBe(false);
    useStore.getState().undo();
    useStore.getState().redo();
    expect(useStore.getState().scene.controls).toHaveLength(0);
  });
});
