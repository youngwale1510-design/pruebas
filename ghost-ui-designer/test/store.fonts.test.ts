import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';

describe('store: fuentes importadas', () => {
  beforeEach(() => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'T', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      lights: [{ angleDeg: 120, intensity: 0.7 }],
      assets: { textures: [], filmstrips: [], fonts: [] },
      params: [],
      controls: [],
      refBoxes: [],
    });
  });

  it('addFontAsset la suma a scene.assets.fonts sin tocar el resto', () => {
    useStore.getState().addFontAsset({ id: 'font_1', name: 'Custom.ttf', family: 'Ghost-abc', dataUri: 'data:font/ttf;base64,AAAA' });
    const fonts = useStore.getState().scene.assets.fonts;
    expect(fonts).toHaveLength(1);
    expect(fonts![0].family).toBe('Ghost-abc');
  });

  it('addFontAsset funciona aunque el proyecto sea viejo y no traiga `fonts`', () => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'Viejo', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      lights: [{ angleDeg: 120, intensity: 0.7 }],
      assets: { textures: [], filmstrips: [] },
      params: [],
      controls: [],
    });
    useStore.getState().addFontAsset({ id: 'font_1', name: 'Custom.ttf', family: 'Ghost-abc', dataUri: 'data:font/ttf;base64,AAAA' });
    expect(useStore.getState().scene.assets.fonts).toHaveLength(1);
  });
});
