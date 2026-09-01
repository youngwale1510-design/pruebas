import { useMemo } from 'react';
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
 * Muestra el control usando el MISMO compositor Canvas2D que genera el filmstrip.
 * Así el editor es pixel-idéntico al plugin (opción B).
 */
export function ControlImage({ control, scene, value, selected, onSelect, onMove }: Props) {
  const { x, y, w, h } = control.rect;

  // Rerender cuando cambie geometría/capas/luz/valor.
  const canvas = useMemo(
    () => renderControlToCanvas(control, scene, value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(control.layers), w, h, value, JSON.stringify(scene.light)],
  );

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
