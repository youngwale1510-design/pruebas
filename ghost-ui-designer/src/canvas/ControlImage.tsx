import { useEffect, useMemo, useState } from 'react';
import { Image as KonvaImage, Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Control, SceneDocument } from '../model/scene';
import { renderControlToCanvas } from '../render/dom';
import { frameSize } from '../render/renderControl';
import { ImageCache, preloadTextures } from '../render/textures';

interface Props {
  control: Control;
  scene: SceneDocument;
  /** valor 0..1 con el que se previsualiza el control en el editor. */
  value: number;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onMove: (x: number, y: number) => void;
}

/**
 * Muestra el control en el lienzo. Si el control tiene un filmstrip IMPORTADO
 * (hecho en Photoshop, Blender, etc.) dibuja el frame correspondiente; si no,
 * usa el compositor 2D (mismo motor que hornea el filmstrip).
 */
export function ControlImage({ control, scene, value, selected, onSelect, onMove }: Props) {
  const { x, y, w, h } = control.rect;
  const { pad } = frameSize(control);
  const stripUri = control.props.filmstripDataUri as string | undefined;
  const frames = Number(control.props.frames ?? 1) || 1;
  const orientation = (control.props.orientation as string) ?? 'vertical';

  const [stripImg, setStripImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!stripUri) { setStripImg(null); return; }
    const img = new Image();
    img.onload = () => setStripImg(img);
    img.src = stripUri;
  }, [stripUri]);

  // Precarga de texturas de las capas.
  const [textures, setTextures] = useState<ImageCache>({});
  const texKey = control.layers.map((l) => l.fillImage ?? '').join('|');
  useEffect(() => {
    let alive = true;
    preloadTextures([control]).then((c) => { if (alive) setTextures(c); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texKey]);

  // Canvas del frame actual (filmstrip importado) o del compositor 2D.
  const canvas = useMemo(() => {
    if (stripUri && stripImg) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      const ctx = c.getContext('2d')!;
      const idx = frames <= 1 ? 0 : Math.round(value * (frames - 1));
      const fw = orientation === 'horizontal' ? stripImg.width / frames : stripImg.width;
      const fh = orientation === 'horizontal' ? stripImg.height : stripImg.height / frames;
      const sx = orientation === 'horizontal' ? fw * idx : 0;
      const sy = orientation === 'horizontal' ? 0 : fh * idx;
      ctx.drawImage(stripImg, sx, sy, fw, fh, 0, 0, c.width, c.height);
      return c;
    }
    return renderControlToCanvas(control, scene, value, textures);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripUri, stripImg, frames, orientation, JSON.stringify(control.layers), w, h, control.props.pad, value, JSON.stringify(scene.light), textures]);

  const onDragEnd = (e: KonvaEventObject<DragEvent>) =>
    onMove(Math.round(e.target.x() + pad), Math.round(e.target.y() + pad));

  // El canvas del filmstrip importado no lleva margen (pad solo aplica al
  // compositor 2D); el resto usa el tamaño real del frame (rect + 2*pad) para
  // no deformar la pieza al encajarla en un rect más chico.
  const cw = stripUri && stripImg ? w : canvas.width;
  const ch = stripUri && stripImg ? h : canvas.height;

  const handleSelect = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const additive = !!(e.evt && 'shiftKey' in e.evt && (e.evt as MouseEvent).shiftKey);
    onSelect(additive);
  };

  return (
    <Group x={x - pad} y={y - pad} draggable onClick={handleSelect} onTap={handleSelect} onDragEnd={onDragEnd}>
      <KonvaImage image={canvas} width={cw} height={ch} />
      {selected && (
        // Selección alrededor de TODO lo visible (incluida la sombra en el
        // margen), no solo del rect nominal: si el marco fuera más chico que
        // la sombra, se vería como si la recortara.
        <Rect x={0} y={0} width={cw} height={ch} stroke="#4c9aff" dash={[4, 3]} strokeWidth={1} />
      )}
    </Group>
  );
}
