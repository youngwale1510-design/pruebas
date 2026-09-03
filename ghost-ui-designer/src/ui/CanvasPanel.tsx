import { useStore } from '../app/store';

/** Tamaño y fondo del lienzo del plugin (PLUG_WIDTH/PLUG_HEIGHT en config.h). */
export function CanvasPanel() {
  const canvas = useStore((s) => s.scene.canvas);
  const setCanvas = useStore((s) => s.setCanvas);

  return (
    <div className="panel">
      <h3>Lienzo (tamaño del plugin)</h3>
      <div className="row">
        <label className="small">
          Ancho
          <input
            type="number" min={100} max={4000} value={canvas.width}
            onChange={(e) => setCanvas({ width: Math.max(100, Number(e.target.value) || 100) })}
          />
        </label>
        <label className="small">
          Alto
          <input
            type="number" min={100} max={4000} value={canvas.height}
            onChange={(e) => setCanvas({ height: Math.max(100, Number(e.target.value) || 100) })}
          />
        </label>
      </div>
      <label>
        Fondo
        <input type="color" value={canvas.bg} onChange={(e) => setCanvas({ bg: e.target.value })} />
      </label>
      <p className="hint">Esto es PLUG_WIDTH/PLUG_HEIGHT: el tamaño de la ventana del plugin, no el de un control.</p>
    </div>
  );
}
