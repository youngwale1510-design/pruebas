import { useEffect, useState } from 'react';
import { useStore } from '../app/store';
import { fitWithinScreen, SizeLimit } from '../app/screenFit';

/** Tope por defecto si aún no llegó la respuesta de Electron (o se ejecuta en
 *  el navegador sin `window.ghost`, p.ej. en tests/preview). */
const FALLBACK_MAX: SizeLimit = { width: 1600, height: 900 };

/** Tamaño y fondo del lienzo del plugin (PLUG_WIDTH/PLUG_HEIGHT en config.h).
 *  El "100%" nunca supera lo que cabe en la pantalla del usuario. */
export function CanvasPanel() {
  const scene = useStore((s) => s.scene);
  const canvas = scene.canvas;
  const setCanvas = useStore((s) => s.setCanvas);
  const addBackground = useStore((s) => s.addBackground);
  const updateLayer = useStore((s) => s.updateLayer);
  const updateControl = useStore((s) => s.updateControl);
  const select = useStore((s) => s.select);

  const [screenMax, setScreenMax] = useState<SizeLimit>(FALLBACK_MAX);
  useEffect(() => {
    window.ghost?.getScreenSize?.().then((s) => { if (s) setScreenMax(s); });
  }, []);

  const bg = scene.controls.find((c) => c.name === 'Fondo');
  const bgLayer = bg?.layers[0];

  // Edición manual: cada campo se topa por separado (no conserva proporción
  // entre sí; eso es solo para el ajuste automático al insertar una imagen).
  const setWidth = (w: number) => setCanvas({ width: Math.min(screenMax.width, Math.max(100, w)) });
  const setHeight = (h: number) => setCanvas({ height: Math.min(screenMax.height, Math.max(100, h)) });

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
    // El lienzo toma el tamaño de la imagen, PERO sin superar la pantalla: si
    // la imagen es más grande, se escala hacia abajo conservando proporción
    // (la textura 'cover' la reencaja igual, sin perder calidad visible).
    if (res.width > 0 && res.height > 0) {
      const fit = fitWithinScreen(res.width, res.height, screenMax);
      setCanvas({ width: fit.width, height: fit.height });
      updateControl(target.id, { rect: { x: 0, y: 0, w: fit.width, h: fit.height } });
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
            type="number" min={100} max={screenMax.width} value={canvas.width}
            onChange={(e) => setWidth(Number(e.target.value) || 100)}
          />
        </label>
        <label className="small">
          Alto
          <input
            type="number" min={100} max={screenMax.height} value={canvas.height}
            onChange={(e) => setHeight(Number(e.target.value) || 100)}
          />
        </label>
      </div>
      <label>
        Color de fondo
        <input type="color" value={canvas.bg} onChange={(e) => setCanvas({ bg: e.target.value })} />
      </label>
      <p className="hint">
        PLUG_WIDTH/PLUG_HEIGHT: el tamaño de la ventana del plugin al 100%, no
        el de un control. Tope: {screenMax.width}×{screenMax.height}px (lo que
        cabe en tu pantalla) — el plugin exportado trae botones 100%/75%/50%
        para verlo más chico si aun así no entra en algún monitor.
      </p>

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
