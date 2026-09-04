import { useState } from 'react';
import { Layer, Line, Rect, Stage as KonvaStage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useStore } from '../app/store';
import { ControlImage } from './ControlImage';

const RULER = 20; // grosor de la regla, en px de pantalla
const TICK_COLOR = '#5a5f6b';
const GUIDE_COLOR = '#57b6c9';

/** Reglas superior/izquierda con marcas cada 50px (mismas unidades que el lienzo). */
function Rulers({ width, height }: { width: number; height: number }) {
  const step = 50;
  const hTicks = [];
  for (let x = 0; x <= width; x += step) {
    hTicks.push(
      <Line key={`h${x}`} points={[RULER + x, RULER - 6, RULER + x, RULER]} stroke={TICK_COLOR} strokeWidth={1} />,
    );
    hTicks.push(<Text key={`ht${x}`} x={RULER + x + 2} y={2} text={String(x)} fontSize={9} fill={TICK_COLOR} />);
  }
  const vTicks = [];
  for (let y = 0; y <= height; y += step) {
    vTicks.push(
      <Line key={`v${y}`} points={[RULER - 6, RULER + y, RULER, RULER + y]} stroke={TICK_COLOR} strokeWidth={1} />,
    );
    vTicks.push(
      <Text key={`vt${y}`} x={2} y={RULER + y + 2} text={String(y)} fontSize={9} fill={TICK_COLOR} rotation={0} />,
    );
  }
  return (
    <>
      <Rect x={0} y={0} width={RULER + width} height={RULER} fill="#1b1d22" />
      <Rect x={0} y={0} width={RULER} height={RULER + height} fill="#1b1d22" />
      {hTicks}
      {vTicks}
    </>
  );
}

export function Stage() {
  const scene = useStore((s) => s.scene);
  const selectedIds = useStore((s) => s.selectedIds);
  const select = useStore((s) => s.select);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const moveControl = useStore((s) => s.moveControl);
  const snapMove = useStore((s) => s.snapMove);
  const previewValue = useStore((s) => s.previewValue);
  const guides = useStore((s) => s.guides);
  const addGuide = useStore((s) => s.addGuide);
  const removeGuide = useStore((s) => s.removeGuide);

  const [dragGuide, setDragGuide] = useState<{ orientation: 'h' | 'v'; pos: number } | null>(null);

  const { width, height, bg } = scene.canvas;

  const onMove = (id: string, x: number, y: number) => {
    const snapped = snapMove(id, x, y);
    moveControl(id, snapped.x, snapped.y);
  };

  return (
    <div className="canvas-wrap" style={{ padding: 0 }}>
      <KonvaStage
        width={width + RULER}
        height={height + RULER}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null);
        }}
        onMouseMove={(e) => {
          if (!dragGuide) return;
          const stage = e.target.getStage();
          const pos = stage?.getPointerPosition();
          if (!pos) return;
          setDragGuide({
            ...dragGuide,
            pos: dragGuide.orientation === 'v' ? pos.x - RULER : pos.y - RULER,
          });
        }}
        onMouseUp={() => {
          if (dragGuide && dragGuide.pos > 0) addGuide(dragGuide.orientation, dragGuide.pos);
          setDragGuide(null);
        }}
      >
        <Layer x={RULER} y={RULER}>
          <Rect width={width} height={height} fill={bg} />
          {scene.controls.map((c) => (
            <ControlImage
              key={c.id}
              control={c}
              scene={scene}
              value={previewValue}
              selected={selectedIds.includes(c.id)}
              onSelect={(additive) => (additive ? toggleSelect(c.id) : select(c.id))}
              onMove={(x, y) => onMove(c.id, x, y)}
            />
          ))}
          {guides.v.map((x) => (
            <Line
              key={`gv${x}`}
              points={[x, 0, x, height]}
              stroke={GUIDE_COLOR}
              strokeWidth={1}
              dash={[4, 3]}
              onClick={() => removeGuide('v', x)}
              hitStrokeWidth={8}
            />
          ))}
          {guides.h.map((y) => (
            <Line
              key={`gh${y}`}
              points={[0, y, width, y]}
              stroke={GUIDE_COLOR}
              strokeWidth={1}
              dash={[4, 3]}
              onClick={() => removeGuide('h', y)}
              hitStrokeWidth={8}
            />
          ))}
          {dragGuide && dragGuide.orientation === 'v' && (
            <Line points={[dragGuide.pos, 0, dragGuide.pos, height]} stroke={GUIDE_COLOR} strokeWidth={1} dash={[4, 3]} />
          )}
          {dragGuide && dragGuide.orientation === 'h' && (
            <Line points={[0, dragGuide.pos, width, dragGuide.pos]} stroke={GUIDE_COLOR} strokeWidth={1} dash={[4, 3]} />
          )}
        </Layer>
        <Layer>
          <Rulers width={width} height={height} />
          {/* Zonas de regla: arrastrar desde aquí crea una guía nueva. */}
          <Rect
            x={RULER}
            y={0}
            width={width}
            height={RULER}
            fill="transparent"
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              setDragGuide({ orientation: 'h', pos: 0 });
            }}
          />
          <Rect
            x={0}
            y={RULER}
            width={RULER}
            height={height}
            fill="transparent"
            onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              setDragGuide({ orientation: 'v', pos: 0 });
            }}
          />
        </Layer>
      </KonvaStage>
      <p className="hint" style={{ margin: '6px 0 0', textAlign: 'center' }}>
        Arrastra desde la regla para crear una guía · clic en una guía para quitarla · Shift+clic para seleccionar varios
      </p>
    </div>
  );
}
