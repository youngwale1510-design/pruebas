import { useStore } from '../app/store';

/** Tamaño y fondo del lienzo del plugin (PLUG_WIDTH/PLUG_HEIGHT en config.h). */
export function CanvasPanel() {
  const scene = useStore((s) => s.scene);
  const canvas = scene.canvas;
  const setCanvas = useStore((s) => s.setCanvas);
  const addBackground = useStore((s) => s.addBackground);
  const updateLayer = useStore((s) => s.updateLayer);
  const select = useStore((s) => s.select);

  const bg = scene.controls.find((c) => c.name === 'Fondo');
  const bgLayer = bg?.layers[0];

  const updateControl = useStore((s) => s.updateControl);

  const pickImage = async () => {
    const res = await window.ghost.importImage();
    if (!res) return;
    let target = bg;
    if (!target) {
      addBackground();
      target = useStore.getState().scene.controls.find((c) => c.name === 'Fondo');
    }
    if (!target) return;
    updateLayer(target.id, target.layers[0].id, { fillImage: res.dataUri, fillImageMode: 'cover' });
    // El lienzo del plugin toma el tamaño real de la imagen, y el fondo se
    // estira a ese mismo tamaño para no dejar tiras del color plano alrededor.
    if (res.width > 0 && res.height > 0) {
      setCanvas({ width: res.width, height: res.height });
      updateControl(target.id, { rect: { x: 0, y: 0, w: res.width, h: res.height } });
    }
    select(target.id);
  };

  const clearImage = () => {
    if (!bg || !bgLayer) return;
    updateLayer(bg.id, bgLayer.id, { fillImage: undefined });
  };

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
        Color de fondo
        <input type="color" value={canvas.bg} onChange={(e) => setCanvas({ bg: e.target.value })} />
      </label>
      <p className="hint">Esto es PLUG_WIDTH/PLUG_HEIGHT: el tamaño de la ventana del plugin, no el de un control.</p>

      <label style={{ marginTop: 10 }}>Imagen de fondo</label>
      {bgLayer?.fillImage ? (
        <>
          <img
            src={bgLayer.fillImage}
            alt="fondo"
            style={{ width: '100%', maxHeight: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn" onClick={pickImage}>Cambiar imagen…</button>
            <button className="btn" onClick={clearImage}>Quitar imagen</button>
          </div>
        </>
      ) : (
        <button className="btn primary" onClick={pickImage}>Insertar PNG/imagen…</button>
      )}
      <p className="hint">
        Se coloca detrás de todos los controles, a tamaño del lienzo. Selecciona
        "Fondo" en el lienzo para ajustar textura, brillo o quitar efectos en
        "Capas y efectos".
      </p>
    </div>
  );
}
