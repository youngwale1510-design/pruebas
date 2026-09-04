import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../src/app/store';

function reset() {
  useStore.setState({
    scene: useStore.getState().scene,
    selectedId: null,
    selectedIds: [],
    guides: { h: [], v: [] },
    styleClipboard: null,
  });
}

describe('store: selección múltiple y alinear', () => {
  beforeEach(() => {
    useStore.getState().setScene({
      version: 1,
      meta: { pluginName: 'T', author: '' },
      canvas: { width: 400, height: 300, bg: '#111' },
      light: { angleDeg: 120, intensity: 0.7 },
      assets: { textures: [], filmstrips: [] },
      params: [],
      controls: [],
    });
    reset();
  });

  it('toggleSelect suma y quita de la selección', () => {
    useStore.getState().toggleSelect('a');
    expect(useStore.getState().selectedIds).toEqual(['a']);
    useStore.getState().toggleSelect('b');
    expect(useStore.getState().selectedIds).toEqual(['a', 'b']);
    useStore.getState().toggleSelect('a');
    expect(useStore.getState().selectedIds).toEqual(['b']);
  });

  it('select reemplaza toda la selección por un único id', () => {
    useStore.getState().toggleSelect('a');
    useStore.getState().toggleSelect('b');
    useStore.getState().select('c');
    expect(useStore.getState().selectedIds).toEqual(['c']);
    expect(useStore.getState().selectedId).toBe('c');
  });

  it('alignSelected mueve los controles seleccionados (2+), no toca los demás', () => {
    useStore.getState().addKnob(); // knob_1 en (20,20)
    useStore.getState().addKnob(); // knob_2 en (120,20)
    const [k1, k2] = useStore.getState().scene.controls;
    useStore.setState({ selectedIds: [k1.id, k2.id] });
    useStore.getState().alignSelected('left');
    const after = useStore.getState().scene.controls;
    expect(after[0].rect.x).toBe(after[1].rect.x);
  });

  it('con menos de 2 seleccionados, alignSelected no hace nada', () => {
    useStore.getState().addKnob();
    const before = useStore.getState().scene.controls[0].rect.x;
    useStore.getState().select(useStore.getState().scene.controls[0].id);
    useStore.getState().alignSelected('left');
    expect(useStore.getState().scene.controls[0].rect.x).toBe(before);
  });

  it('matchSizeSelected usa el primer seleccionado como referencia', () => {
    useStore.getState().addKnob();
    useStore.getState().addKnob();
    const [k1, k2] = useStore.getState().scene.controls;
    useStore.getState().updateControl(k1.id, { rect: { ...k1.rect, w: 200, h: 210 } });
    useStore.setState({ selectedIds: [k1.id, k2.id] });
    useStore.getState().matchSizeSelected('both');
    const after = useStore.getState().scene.controls;
    expect(after[1].rect.w).toBe(200);
    expect(after[1].rect.h).toBe(210);
    expect(after[0].rect.w).toBe(200); // el de referencia no cambia
  });

  it('guías: añadir/quitar', () => {
    useStore.getState().addGuide('v', 100);
    expect(useStore.getState().guides.v).toEqual([100]);
    useStore.getState().removeGuide('v', 100);
    expect(useStore.getState().guides.v).toEqual([]);
  });

  it('snapMove pega a una guía dentro del umbral', () => {
    useStore.getState().addKnob();
    const k = useStore.getState().scene.controls[0];
    useStore.getState().addGuide('v', 200);
    const snapped = useStore.getState().snapMove(k.id, 203, 50);
    expect(snapped.x).toBe(200);
  });

  it('addImage crea un control movible/redimensionable, no ligado al lienzo', () => {
    useStore.getState().addImage();
    const img = useStore.getState().scene.controls.at(-1)!;
    expect(img.type).toBe('IBitmapControl');
    expect(img.rect.w).toBeGreaterThan(0);
    expect(useStore.getState().selectedId).toBe(img.id);
  });

  it('pasteStyle con includeSize=true copia también W/H; sin ella, no', () => {
    useStore.getState().addKnob();
    useStore.getState().addKnob();
    const [src, dst] = useStore.getState().scene.controls;
    useStore.getState().updateControl(src.id, { rect: { ...src.rect, w: 150, h: 160 } });
    useStore.getState().copyStyle(src.id);
    useStore.getState().pasteStyle(dst.id, false, false);
    expect(useStore.getState().scene.controls[1].rect.w).toBe(dst.rect.w); // sin cambios
    useStore.getState().pasteStyle(dst.id, false, true);
    expect(useStore.getState().scene.controls[1].rect.w).toBe(150);
    expect(useStore.getState().scene.controls[1].rect.h).toBe(160);
  });
});
