import { useEffect, useMemo, useState } from 'react';
import { Image as KonvaImage, Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Control, SceneDocument } from '../model/scene';
import { renderControlToCanvas } from '../render/dom';

interface Props {
  control: Control;
  scene: SceneDocument;
  /** valor 0..1 con el que se previsualiza el control en el editor. */
  value: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}

/**
 * Muestra el control en el lienzo. Si el control tiene un filmstrip IMPORTADO
 * (hecho en Photoshop, Blender, etc.) dibuja el frame correspondiente; si no,
 * usa el compositor 2D (mismo motor que hornea el filmstrip).
 */
export function ControlImage({ control, scene, value, selected, onSelect, onMove }: Props) {
  const { x, y, w, h } = control.rect;
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
    return renderControlToCanvas(control, scene, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripUri, stripImg, frames, orientation, JSON.stringify(control.layers), w, h, value, JSON.stringify(scene.light)]);

  const onDragEnd = (e: KonvaEventObject<DragEvent>) =>
    onMove(Math.round(e.target.x()), Math.round(e.target.y()));

  return (
    <Group x={x} y={y} draggable onClick={onSelect} onTap={onSelect} onDragEnd={onDragEnd}>
      <KonvaImage image={canvas} width={w} height={h} />
      {selected && (
        <Rect width={w} height={h} stroke="#4c9aff" dash={[4, 3]} strokeWidth={1} />
      )}
    </Group>
  );
}
