import { useState } from 'react';
import { Layer, Line, Rect, Stage as KonvaStage, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useStore } from '../app/store';
import { ControlImage } from './ControlImage';
import { normalizeMarquee, rectsIntersect } from '../app/align';

const RULER = 20; // grosor de la regla, en px de pantalla
const TICK_COLOR = '#5a5f6b';
const GUIDE_COLOR = '#57b6c9';
const MARQUEE_MIN_DRAG = 3; // por debajo de esto, un "arrastre" se trata como clic

/** Reglas superior/izquierda en PORCENTAJE del lienzo (10 marcas, 0..100%). */
function Rulers({ width, height }: { width: number; height: number }) {
  const N = 10;
  const hTicks = [];
  for (let i = 0; i <= N; i++) {
    const x = (width * i) / N;
    hTicks.push(
      <Line key={`h${i}`} points={[RULER + x, RULER - 6, RULER + x, RULER]} stroke={TICK_COLOR} strokeWidth={1} />,
    );
    hTicks.push(<Text key={`ht${i}`} x={RULER + x + 2} y={2} text={`${i * 10}%`} fontSize={9} fill={TICK_COLOR} />);
  }
  const vTicks = [];
  for (let i = 0; i <= N; i++) {
    const y = (height * i) / N;
    vTicks.push(
      <Line key={`v${i}`} points={[RULER - 6, RULER + y, RULER, RULER + y]} stroke={TICK_COLOR} strokeWidth={1} />,
    );
    vTicks.push(<Text key={`vt${i}`} x={2} y={RULER + y + 2} text={`${i * 10}%`} fontSize={9} fill={TICK_COLOR} />);
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

/** ¿Es un modificador de selección múltiple? Shift (estándar) o Ctrl/Cmd
 *  (alternativa, para quien viene de otras apps donde Ctrl es lo habitual). */
function isAdditiveEvent(evt: MouseEvent | undefined): boolean {
  return !!evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey);
}

export function Stage() {
  const scene = useStore((s) => s.scene);
  const selectedIds = useStore((s) => s.selectedIds);
  const select = useStore((s) => s.select);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const selectMany = useStore((s) => s.selectMany);
  const moveControl = useStore((s) => s.moveControl);
  const snapMove = useStore((s) => s.snapMove);
  const previewValue = useStore((s) => s.previewValue);
  const guides = useStore((s) => s.guides);
  const addGuide = useStore((s) => s.addGuide);
  const removeGuide = useStore((s) => s.removeGuide);

  const [dragGuide, setDragGuide] = useState<{ orientation: 'h' | 'v'; pos: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; additive: boolean } | null>(null);
  const [dragLabel, setDragLabel] = useState<{ x: number; y: number; text: string } | null>(null);
  const [liveRect, setLiveRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selectedId = useStore((s) => s.selectedId);
  const selectedControl = scene.controls.find((c) => c.id === selectedId) ?? null;

  const { width, height, bg } = scene.canvas;

  const onMove = (id: string, x: number, y: number) => {
    const snapped = snapMove(id, x, y);
    moveControl(id, snapped.x, snapped.y);
    setDragLabel(null);
    setLiveRect(null);
  };

  const onDragLive = (id: string, x: number, y: number) => {
    const pctX = Math.round((x / width) * 1000) / 10;
    const pctY = Math.round((y / height) * 1000) / 10;
    setDragLabel({ x, y, text: `X ${Math.round(x)}px (${pctX}%)  Y ${Math.round(y)}px (${pctY}%)` });
    const c = scene.controls.find((k) => k.id === id);
    if (c) setLiveRect({ x, y, w: c.rect.w, h: c.rect.h });
  };

  // El HUD muestra la posición/tamaño en vivo mientras arrastras; si no hay
  // arrastre en curso, muestra los valores actuales del control seleccionado.
  const hud = liveRect ?? (selectedControl ? selectedControl.rect : null);
  const hudPct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

  return (
    <div className="canvas-wrap" style={{ padding: 0 }}>
      <KonvaStage
        width={width + RULER}
        height={height + RULER}
        onMouseDown={(e) => {
          if (e.target !== e.target.getStage()) return;
          const stage = e.target.getStage();
          const pos = stage?.getPointerPosition();
          if (!pos) return;
          setMarquee({
            x0: pos.x - RULER,
            y0: pos.y - RULER,
            x1: pos.x - RULER,
            y1: pos.y - RULER,
            additive: isAdditiveEvent(e.evt),
          });
        }}
        onMouseMove={(e) => {
          const stage = e.target.getStage();
          const pos = stage?.getPointerPosition();
          if (!pos) return;
          if (dragGuide) {
            setDragGuide({ ...dragGuide, pos: dragGuide.orientation === 'v' ? pos.x - RULER : pos.y - RULER });
          }
          if (marquee) {
            setMarquee({ ...marquee, x1: pos.x - RULER, y1: pos.y - RULER });
          }
        }}
        onMouseUp={() => {
          if (dragGuide) {
            if (dragGuide.pos > 0) addGuide(dragGuide.orientation, dragGuide.pos);
            setDragGuide(null);
          }
          if (marquee) {
            const dx = Math.abs(marquee.x1 - marquee.x0);
            const dy = Math.abs(marquee.y1 - marquee.y0);
            if (dx < MARQUEE_MIN_DRAG && dy < MARQUEE_MIN_DRAG) {
              if (!marquee.additive) select(null);
            } else {
              const box = normalizeMarquee(marquee.x0, marquee.y0, marquee.x1, marquee.y1);
              const ids = scene.controls.filter((c) => rectsIntersect(box, c.rect)).map((c) => c.id);
              selectMany(ids, marquee.additive);
            }
            setMarquee(null);
          }
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
              onDragLive={(x, y) => onDragLive(c.id, x, y)}
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
          {marquee && (
            <Rect
              {...normalizeMarquee(marquee.x0, marquee.y0, marquee.x1, marquee.y1)}
              fill="rgba(76,154,255,0.12)"
              stroke="#4c9aff"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}
          {dragLabel && (
            <>
              <Rect x={dragLabel.x + 12} y={dragLabel.y - 22} width={180} height={18} fill="#101114" cornerRadius={3} opacity={0.9} />
              <Text x={dragLabel.x + 16} y={dragLabel.y - 19} text={dragLabel.text} fontSize={11} fill="#e8e9ec" />
            </>
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
        Arrastra sobre el lienzo para seleccionar varios (o Shift/Ctrl+clic) · arrastra desde la regla para crear una guía
      </p>
      {hud && (
        <div className="coord-hud">
          <span>X <b>{Math.round(hud.x)}px</b> <i>{hudPct(hud.x, width)}%</i></span>
          <span>Y <b>{Math.round(hud.y)}px</b> <i>{hudPct(hud.y, height)}%</i></span>
          <span>W <b>{Math.round(hud.w)}px</b> <i>{hudPct(hud.w, width)}%</i></span>
          <span>H <b>{Math.round(hud.h)}px</b> <i>{hudPct(hud.h, height)}%</i></span>
        </div>
      )}
    </div>
  );
}
