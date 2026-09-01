import { Layer, Rect, Stage as KonvaStage } from 'react-konva';
import { useStore } from '../app/store';
import { KnobControl } from './KnobControl';

export function Stage() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const moveControl = useStore((s) => s.moveControl);

  const { width, height, bg } = scene.canvas;

  return (
    <div className="canvas-wrap">
      <KonvaStage
        width={width}
        height={height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null);
        }}
      >
        <Layer>
          <Rect width={width} height={height} fill={bg} />
          {scene.controls.map((c) => (
            <KnobControl
              key={c.id}
              control={c}
              light={scene.light}
              selected={c.id === selectedId}
              onSelect={() => select(c.id)}
              onMove={(x, y) => moveControl(c.id, x, y)}
            />
          ))}
        </Layer>
      </KonvaStage>
    </div>
  );
}
