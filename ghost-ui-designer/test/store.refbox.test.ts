import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';

describe('store: cajas de referencia', () => {
  beforeEach(() => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'T', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      lights: [{ angleDeg: 120, intensity: 0.7 }],
      assets: { textures: [], filmstrips: [] },
      params: [],
      controls: [],
      refBoxes: [],
    });
  });

  it('addRefBox crea una caja y la selecciona', () => {
    useStore.getState().addRefBox();
    const { scene, selectedRefBoxId } = useStore.getState();
    expect(scene.refBoxes).toHaveLength(1);
    expect(selectedRefBoxId).toBe(scene.refBoxes![0].id);
  });

  it('moveRefBox actualiza x/y de la caja indicada', () => {
    useStore.getState().addRefBox();
    const id = useStore.getState().scene.refBoxes![0].id;
    useStore.getState().moveRefBox(id, 55, 66);
    const box = useStore.getState().scene.refBoxes!.find((b) => b.id === id)!;
    expect(box.rect.x).toBe(55);
    expect(box.rect.y).toBe(66);
  });

  it('resizeRefBox actualiza w/h con un mínimo de 10px', () => {
    useStore.getState().addRefBox();
    const id = useStore.getState().scene.refBoxes![0].id;
    useStore.getState().resizeRefBox(id, 200, 3);
    const box = useStore.getState().scene.refBoxes!.find((b) => b.id === id)!;
    expect(box.rect.w).toBe(200);
    expect(box.rect.h).toBe(10);
  });

  it('renameRefBox cambia la etiqueta', () => {
    useStore.getState().addRefBox();
    const id = useStore.getState().scene.refBoxes![0].id;
    useStore.getState().renameRefBox(id, 'Scope');
    expect(useStore.getState().scene.refBoxes!.find((b) => b.id === id)!.label).toBe('Scope');
  });

  it('removeRefBox la quita de la escena y limpia la selección', () => {
    useStore.getState().addRefBox();
    const id = useStore.getState().scene.refBoxes![0].id;
    useStore.getState().removeRefBox(id);
    expect(useStore.getState().scene.refBoxes).toHaveLength(0);
    expect(useStore.getState().selectedRefBoxId).toBeNull();
  });

  it('importControls SUMA las refBoxes detectadas a las que ya hubiera', () => {
    useStore.getState().addRefBox(); // ya había una puesta a mano
    useStore.getState().importControls(
      [],
      'GhostDuck',
      [{ id: 'ref_auto1', label: 'Scope', rect: { x: 10, y: 60, w: 380, h: 140 } }],
    );
    const labels = useStore.getState().scene.refBoxes!.map((b) => b.label);
    expect(labels).toEqual(['Referencia 1', 'Scope']);
  });

  it('setScene normaliza proyectos viejos sin refBoxes a []', () => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'Viejo', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      lights: [{ angleDeg: 120, intensity: 0.7 }],
      assets: { textures: [], filmstrips: [] },
      params: [],
      controls: [],
    });
    expect(useStore.getState().scene.refBoxes).toEqual([]);
  });
});
