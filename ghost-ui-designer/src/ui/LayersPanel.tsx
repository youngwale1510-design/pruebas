import { useStore } from '../app/store';
import { EffectType, Layer, LayerShape } from '../model/scene';
import { makeId } from '../model/defaults';

const SHAPES: [LayerShape, string][] = [
  ['ellipse', 'Círculo'], ['scalloped', 'Estriado'], ['polygon', 'Polígono'],
  ['roundRect', 'Redondeado'], ['rect', 'Rectángulo'], ['wedge', 'Punta'],
];
const EFFECTS: [EffectType, string][] = [
  ['dropShadow', 'sombra'], ['bevel', 'bisel'], ['dish', 'domo'], ['recess', 'hueco'],
  ['env', 'entorno'], ['grooves', 'torneado'], ['brushed', 'cepillado'], ['spun', 'metal'],
  ['knurl', 'moleteado'], ['rim', 'luz borde'],
  ['specular', 'reflejo'], ['gradientOverlay', 'degradado'], ['noise', 'ruido'],
  ['innerShadow', 'sombra int'], ['glow', 'glow'],
];

export function LayersPanel() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const updateLayer = useStore((s) => s.updateLayer);
  const addLayer = useStore((s) => s.addLayer);
  const removeLayer = useStore((s) => s.removeLayer);
  const updateControl = useStore((s) => s.updateControl);
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
        const t = l.ticks ?? { count: 11, style: 'dot' as const, radius: 0.92, spanDeg: 270, size: 3 };
        const setTicks = (patch: Partial<typeof t>) =>
          updateLayer(control.id, l.id, { ticks: { ...t, ...patch } });
        return (
          <fieldset key={l.id}>
            <legend style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{l.name}</span>
              <button className="btn" style={{ padding: '1px 7px' }} title="Quitar capa"
                onClick={() => removeLayer(control.id, l.id)}>✕</button>
            </legend>

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

            {l.shape !== 'ticks' && (
            <label className="k3-field" style={{ marginTop: 8 }}>
              <span>Forma</span>
              <select value={l.shape ?? 'ellipse'} onChange={(e) => updateLayer(control.id, l.id, { shape: e.target.value as LayerShape })}>
                {SHAPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            )}

            {l.shape === 'scalloped' && (
              <label className="k3-field">
                <span>Nº de estrías <b>{l.lobes ?? 12}</b></span>
                <input type="range" min={6} max={48} step={1} value={l.lobes ?? 12}
                  onChange={(e) => updateLayer(control.id, l.id, { lobes: Number(e.target.value) })} />
              </label>
            )}
            {l.shape === 'polygon' && (
              <label className="k3-field">
                <span>Nº de lados <b>{l.sides ?? 6}</b></span>
                <input type="range" min={3} max={12} step={1} value={l.sides ?? 6}
                  onChange={(e) => updateLayer(control.id, l.id, { sides: Number(e.target.value) })} />
              </label>
            )}
            {l.shape === 'ticks' && (
              <>
                <label className="k3-field"><span>Nº de marcas <b>{t.count}</b></span>
                  <input type="range" min={2} max={48} step={1} value={t.count}
                    onChange={(e) => setTicks({ count: Number(e.target.value) })} /></label>
                <label className="k3-field"><span>Estilo</span>
                  <select value={t.style} onChange={(e) => setTicks({ style: e.target.value as 'dot' | 'line' })}>
                    <option value="dot">Puntos</option>
                    <option value="line">Líneas</option>
                  </select></label>
                <label className="k3-field"><span>Radio <b>{Math.round(t.radius * 100)}%</b></span>
                  <input type="range" min={0.5} max={1} step={0.01} value={t.radius}
                    onChange={(e) => setTicks({ radius: Number(e.target.value) })} /></label>
                <label className="k3-field"><span>Arco <b>{t.spanDeg}°</b></span>
                  <input type="range" min={90} max={360} step={5} value={t.spanDeg}
                    onChange={(e) => setTicks({ spanDeg: Number(e.target.value) })} /></label>
                <label className="k3-field"><span>Tamaño <b>{t.size}px</b></span>
                  <input type="range" min={1} max={10} step={0.5} value={t.size}
                    onChange={(e) => setTicks({ size: Number(e.target.value) })} /></label>
              </>
            )}

            {l.shape !== 'ticks' && l.rectNorm == null && (
              <label className="k3-field">
                <span>Tamaño <b>{Math.round((1 - 2 * (l.inset ?? 0)) * 100)}%</b></span>
                <input type="range" min={0} max={0.48} step={0.01} value={l.inset ?? 0}
                  onChange={(e) => updateLayer(control.id, l.id, { inset: Number(e.target.value) })} />
              </label>
            )}

            {l.shape !== 'ticks' && (<>
            <label className="chk" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={l.anim?.mode === 'rotate'}
                onChange={(ev) => updateLayer(control.id, l.id, { anim: ev.target.checked ? { mode: 'rotate', minDeg: -150, maxDeg: 150 } : { mode: 'none' } })} />
              <span>Gira con el valor</span>
            </label>

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
              {speculars.map((e, i) => {
                const angle = typeof e.params.angleDeg === 'number' ? e.params.angleDeg : scene.light.angleDeg;
                const size = typeof e.params.size === 'number' ? e.params.size : 0.45;
                const aspect = typeof e.params.aspect === 'number' ? e.params.aspect : 1;
                return (
                  <div key={e.id} style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 6, marginTop: 6 }}>
                    <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Reflejo {i + 1}</span>
                      <button className="btn" onClick={() => removeEffect(control.id, l.id, e.id)} title="Quitar">✕</button>
                    </div>
                    <label className="k3-field"><span>Ángulo <b>{Math.round(angle)}°</b></span>
                      <input type="range" min={0} max={359} value={angle}
                        onChange={(ev) => updateEffect(control.id, l.id, e.id, { angleDeg: Number(ev.target.value) })} /></label>
                    <label className="k3-field"><span>Tamaño <b>{size.toFixed(2)}</b></span>
                      <input type="range" min={0.1} max={1.2} step={0.02} value={size}
                        onChange={(ev) => updateEffect(control.id, l.id, e.id, { size: Number(ev.target.value) })} /></label>
                    <label className="k3-field"><span>Forma (alargado) <b>{aspect.toFixed(1)}×</b></span>
                      <input type="range" min={1} max={5} step={0.1} value={aspect}
                        onChange={(ev) => updateEffect(control.id, l.id, e.id, { aspect: Number(ev.target.value) })} /></label>
                  </div>
                );
              })}
              <button className="btn" style={{ marginTop: 4 }}
                onClick={() => addEffect(control.id, l.id, 'specular', { size: 0.45, aspect: 1, angleDeg: (scene.light.angleDeg + 40) % 360 })}>
                + Añadir reflejo
              </button>
            </div>
            </>)}
          </fieldset>
        );
      })}

      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <button className="btn" onClick={() => addLayer(control.id, {
          id: makeId('lyr'), name: 'Capa', kind: 'shape', visible: true, blendMode: 'normal',
          opacity: 1, shape: 'ellipse', inset: 0.1, fill: '#3a3a42', effects: [],
        })}>+ Capa</button>
        <button className="btn" onClick={() => { if (!Number(control.props.bodyInset ?? 0)) updateControl(control.id, { props: { ...control.props, bodyInset: 0.14 } }); addLayer(control.id, {
          id: makeId('lyr'), name: 'Marcas', kind: 'shape', visible: true, blendMode: 'normal',
          opacity: 1, shape: 'ticks', fill: '#c9c9d0', effects: [],
          ticks: { count: 11, style: 'dot', radius: 0.94, spanDeg: 270, size: 3 },
        }); }}>+ Marcas</button>
      </div>
    </div>
  );
}
