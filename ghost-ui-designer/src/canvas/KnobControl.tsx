import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Control, LightSource } from '../model/scene';

interface Props {
  control: Control;
  light: LightSource;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}

/**
 * Render MVP de un knob con look pseudo-3D básico (bisel + sombra según la luz
 * global). En fases posteriores esto se sustituye por el motor de capas/efectos.
 */
export function KnobControl({ control, light, selected, onSelect, onMove }: Props) {
  const { x, y, w, h } = control.rect;
  const r = Math.min(w, h) / 2 - 4;
  const cx = w / 2;
  const cy = h / 2 - 6;

  // Vector de la luz global -> offset de sombra e iluminación del bisel.
  const rad = (light.angleDeg * Math.PI) / 180;
  const sx = Math.cos(rad) * 3 * light.intensity;
  const sy = Math.sin(rad) * 3 * light.intensity;

  const onDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onMove(Math.round(e.target.x()), Math.round(e.target.y()));
  };

  return (
    <Group
      x={x}
      y={y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
    >
      {selected && (
        <Rect
          width={w}
          height={h}
          stroke="#4c9aff"
          dash={[4, 3]}
          strokeWidth={1}
        />
      )}
      {/* sombra proyectada */}
      <Circle x={cx + sx} y={cy + sy} radius={r} fill="rgba(0,0,0,0.35)" />
      {/* cuerpo con "bisel" (anillo exterior claro / interior oscuro) */}
      <Circle x={cx} y={cy} radius={r} fill="#3a3a40" />
      <Circle
        x={cx}
        y={cy}
        radius={r}
        stroke="#6a6a72"
        strokeWidth={2}
        shadowColor="#000"
      />
      <Circle x={cx} y={cy} radius={r * 0.7} fill="#2b2b30" />
      {/* highlight direccional */}
      <Circle
        x={cx - sx}
        y={cy - sy}
        radius={r * 0.7}
        fillRadialGradientStartPoint={{ x: -r * 0.3, y: -r * 0.3 }}
        fillRadialGradientEndRadius={r}
        fillRadialGradientColorStops={[0, 'rgba(255,255,255,0.25)', 1, 'rgba(255,255,255,0)']}
      />
      {/* indicador */}
      <Line
        points={[cx, cy, cx, cy - r * 0.65]}
        stroke="#e6e6ea"
        strokeWidth={2}
        lineCap="round"
      />
      <Text
        text={control.name}
        width={w}
        y={h - 14}
        align="center"
        fontSize={11}
        fill="#c9c9d0"
      />
    </Group>
  );
}
