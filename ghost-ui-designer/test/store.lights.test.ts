import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';

describe('store: luces globales múltiples', () => {
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

  it('empieza con una sola luz (la principal)', () => {
    expect(useStore.getState().scene.lights).toHaveLength(1);
  });

  it('setLight(0, ...) cambia la principal sin tocar el resto de la escena', () => {
    useStore.getState().setLight(0, { angleDeg: 45 });
    expect(useStore.getState().scene.lights[0].angleDeg).toBe(45);
    expect(useStore.getState().scene.lights[0].intensity).toBe(0.7);
  });

  it('addLight suma una luz nueva, del lado opuesto y tintada', () => {
    useStore.getState().addLight();
    const { lights } = useStore.getState().scene;
    expect(lights).toHaveLength(2);
    expect(lights[1].angleDeg).toBe(300); // 120 + 180
    expect(lights[1].color).toBeTruthy();
  });

  it('setLight(i, ...) con i>0 solo cambia esa luz adicional', () => {
    useStore.getState().addLight();
    useStore.getState().addLight();
    useStore.getState().setLight(2, { color: '#ff0000' });
    const { lights } = useStore.getState().scene;
    expect(lights[1].color).not.toBe('#ff0000');
    expect(lights[2].color).toBe('#ff0000');
  });

  it('removeLight quita una luz adicional por índice', () => {
    useStore.getState().addLight();
    useStore.getState().addLight();
    useStore.getState().removeLight(1);
    expect(useStore.getState().scene.lights).toHaveLength(2);
  });

  it('removeLight no deja la escena sin ninguna luz', () => {
    useStore.getState().removeLight(0);
    expect(useStore.getState().scene.lights).toHaveLength(1);
  });

  it('setScene migra un proyecto viejo con `light` (singular) a `lights: [light]`', () => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'Viejo', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      // proyecto guardado antes de las luces múltiples: sin campo `lights`.
      light: { angleDeg: 200, intensity: 0.5 },
      assets: { textures: [], filmstrips: [] },
      params: [],
      controls: [],
    } as never);
    expect(useStore.getState().scene.lights).toEqual([{ angleDeg: 200, intensity: 0.5 }]);
  });
});
