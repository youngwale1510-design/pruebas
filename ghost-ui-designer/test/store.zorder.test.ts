import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';
import { Control } from '../src/model/scene';

const ctrl = (id: string): Control => ({
  id, type: 'IVKnobControl', name: id, rect: { x: 0, y: 0, w: 10, h: 10 }, props: {}, layers: [], effects: [],
});

describe('store: orden de dibujo (front/back)', () => {
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

  const order = () => useStore.getState().scene.controls.map((c) => c.id);

  it('bringToFront manda el control al final del array (encima de todo)', () => {
    useStore.getState().bringToFront('a');
    expect(order()).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack manda el control al principio del array (detrás de todo)', () => {
    useStore.getState().sendToBack('c');
    expect(order()).toEqual(['c', 'a', 'b']);
  });

  it('bringForward avanza un paso', () => {
    useStore.getState().bringForward('a');
    expect(order()).toEqual(['b', 'a', 'c']);
  });

  it('sendBackward retrocede un paso', () => {
    useStore.getState().sendBackward('c');
    expect(order()).toEqual(['a', 'c', 'b']);
  });

  it('en los extremos, no hace nada (sin romper el orden)', () => {
    useStore.getState().bringForward('c'); // ya está al frente
    expect(order()).toEqual(['a', 'b', 'c']);
    useStore.getState().sendBackward('a'); // ya está al fondo
    expect(order()).toEqual(['a', 'b', 'c']);
    useStore.getState().bringToFront('c');
    expect(order()).toEqual(['a', 'b', 'c']);
    useStore.getState().sendToBack('a');
    expect(order()).toEqual(['a', 'b', 'c']);
  });
});
