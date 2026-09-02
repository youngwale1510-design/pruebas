import { useStore } from '../app/store';
import { EffectType, Layer, LayerShape } from '../model/scene';

const SHAPES: [LayerShape, string][] = [
  ['ellipse', 'Círculo'], ['scalloped', 'Estriado'], ['polygon', 'Polígono'],
  ['roundRect', 'Redondeado'], ['rect', 'Rectángulo'], ['wedge', 'Punta'],
];
const EFFECTS: [EffectType, string][] = [
  ['dropShadow', 'sombra'], ['bevel', 'bisel'], ['dish', 'domo'], ['recess', 'hueco'],
  ['env', 'entorno'], ['grooves', 'torneado'], ['brushed', 'cepillado'], ['spun', 'metal'],
  ['specular', 'reflejo'], ['gradientOverlay', 'degradado'], ['noise', 'ruido'],
  ['innerShadow', 'sombra int'], ['glow', 'glow'],
];

export function LayersPanel() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const updateLayer = useStore((s) => s.updateLayer);
  const toggleEffect = useStore((s) => s.toggleEffect);
  const addEffect = useStore((s) => s.addEffect);
  const removeEffect = useStore((s) => s.removeEffect);
  const updateEffect = useStore((s) => s.updateEffect);

  const control = scene.controls.find((c) => c.id === selectedId);
  if (!control) return null;

  const importTexture = async (layerId: string) => {
    const res = await window.ghost.importImage();
    if (res) updateLayer(control.id, layerId, { fillImage: res.dataUri, fillImageMode: 'cover' });
  };

  return (
    <div className="panel k3">
      <h3>Capas y efectos</h3>
      {control.layers.map((l: Layer) => {
        const speculars = l.effects.filter((e) => e.type === 'specular');
        return (
          <fieldset key={l.id}>
            <legend>{l.name}</legend>

            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={typeof l.fill === 'string' && l.fill.startsWith('#') ? l.fill : '#333333'}
                onChange={(e) => updateLayer(control.id, l.id, { fill: e.target.value })}
                title="Color de relleno"
              />
              {l.fillImage ? (
                <button className="btn" onClick={() => updateLayer(control.id, l.id, { fillImage: undefined })}>
                  Quitar textura
                </button>
              ) : (
                <button className="btn" onClick={() => importTexture(l.id)}>Textura…</button>
              )}
            </div>

            {l.fillImage && (
              <img src={l.fillImage} alt="" style={{ maxWidth: '100%', maxHeight: 70, borderRadius: 5, marginTop: 6, border: '1px solid var(--border)' }} />
            )}

            <label className="k3-field" style={{ marginTop: 8 }}>
              <span>Forma</span>
              <select value={l.shape ?? 'ellipse'} onChange={(e) => updateLayer(control.id, l.id, { shape: e.target.value as LayerShape })}>
                {SHAPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>

            {l.rectNorm == null && (
              <label className="k3-field">
                <span>Tamaño <b>{Math.round((1 - 2 * (l.inset ?? 0)) * 100)}%</b></span>
                <input type="range" min={0} max={0.48} step={0.01} value={l.inset ?? 0}
                  onChange={(e) => updateLayer(control.id, l.id, { inset: Number(e.target.value) })} />
              </label>
            )}

            <div className="chips" style={{ marginTop: 6 }}>
              {EFFECTS.map(([type, label]) => {
                const on = l.effects.some((e) => e.type === type);
                return (
                  <button key={type} type="button" className="chip" aria-pressed={on}
                    onClick={() => toggleEffect(control.id, l.id, type)}>{label}</button>
                );
              })}
            </div>

            {/* Luces / reflejos extra (cada reflejo con su ángulo) */}
            <div style={{ marginTop: 8 }}>
              <div className="k3-field"><span>Reflejos / luces</span></div>
              {speculars.map((e, i) => (
                <div key={e.id} className="row" style={{ alignItems: 'center', gap: 6 }}>
                  <input type="range" min={0} max={359}
                    value={typeof e.params.angleDeg === 'number' ? e.params.angleDeg : scene.light.angleDeg}
                    onChange={(ev) => updateEffect(control.id, l.id, e.id, { angleDeg: Number(ev.target.value) })}
                    title={`Ángulo reflejo ${i + 1}`} style={{ flex: 1 }} />
                  <button className="btn" onClick={() => removeEffect(control.id, l.id, e.id)} title="Quitar">✕</button>
                </div>
              ))}
              <button className="btn" style={{ marginTop: 4 }}
                onClick={() => addEffect(control.id, l.id, 'specular', { size: 0.45, angleDeg: (scene.light.angleDeg + 40) % 360 })}>
                + Añadir reflejo
              </button>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
