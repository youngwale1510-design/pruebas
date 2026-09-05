import { useState } from 'react';
import { useStore } from '../app/store';
import { EffectType, Layer, LayerShape } from '../model/scene';
import { makeId } from '../model/defaults';
import { MATERIALS, MaterialId } from '../model/materials';

const SHAPES: [LayerShape, string][] = [
  ['ellipse', 'Círculo'], ['scalloped', 'Estriado'], ['polygon', 'Polígono'],
  ['roundRect', 'Redondeado'], ['rect', 'Rectángulo'], ['wedge', 'Punta'],
];
const EFFECTS: [EffectType, string][] = [
  ['dropShadow', 'sombra'], ['contactShadow', 'contacto'], ['extrude', 'grosor'],
  ['bevel', 'bisel'], ['chamfer', 'chaflán'], ['facet', 'facetas'], ['dish', 'domo'], ['recess', 'hueco'],
  ['env', 'entorno'], ['chrome', 'cromo'], ['cylinder', 'cilindro'],
  ['grooves', 'torneado'], ['brushed', 'cepillado'], ['spun', 'metal'],
  ['knurl', 'moleteado'], ['rim', 'luz borde'], ['sheen', 'brillo ancho'],
  ['specular', 'reflejo'], ['emissive', 'LED'], ['gradientOverlay', 'degradado'], ['noise', 'ruido'],
  ['innerShadow', 'sombra int'], ['glow', 'glow'],
];

type ParamSpec =
  | { key: string; label: string; min: number; max: number; step: number; def: number }
  | { key: string; label: string; color: true; def: string }
  | { key: string; label: string; bool: true; def: boolean };

/** Parámetros editables por tipo de efecto (los reflejos tienen su propio editor). */
const EFFECT_PARAMS: Partial<Record<EffectType, ParamSpec[]>> = {
  dropShadow: [
    { key: 'distance', label: 'Distancia', min: 0, max: 20, step: 0.5, def: 4 },
    { key: 'blur', label: 'Desenfoque', min: 0, max: 40, step: 1, def: 8 },
  ],
  contactShadow: [
    { key: 'size', label: 'Tamaño', min: 0.5, max: 10, step: 0.5, def: 3 },
    { key: 'strength', label: 'Fuerza', min: 0, max: 1, step: 0.05, def: 0.8 },
  ],
  extrude: [{ key: 'height', label: 'Altura (px)', min: 1, max: 16, step: 1, def: 4 }],
  bevel: [{ key: 'size', label: 'Tamaño', min: 0.5, max: 12, step: 0.5, def: 3 }],
  chamfer: [
    { key: 'steps', label: 'Anillos', min: 1, max: 5, step: 1, def: 3 },
    { key: 'width', label: 'Ancho', min: 1, max: 8, step: 0.5, def: 3 },
  ],
  facet: [{ key: 'width', label: 'Ancho de cara', min: 0.1, max: 0.6, step: 0.02, def: 0.32 }],
  dish: [{ key: 'offset', label: 'Desplazamiento', min: 0, max: 1, step: 0.05, def: 0.4 }],
  recess: [
    { key: 'depth', label: 'Profundidad', min: 0, max: 1, step: 0.05, def: 0.6 },
    { key: 'lip', label: 'Labio', min: 0, max: 5, step: 0.2, def: 2.2 },
  ],
  chrome: [
    { key: 'strength', label: 'Fuerza', min: 0, max: 1, step: 0.05, def: 1 },
    { key: 'horizon', label: 'Horizonte', min: 0.2, max: 0.8, step: 0.02, def: 0.5 },
    { key: 'curve', label: 'Curvatura (esfera)', min: 0, max: 1, step: 0.05, def: 1 },
  ],
  cylinder: [
    { key: 'gloss', label: 'Brillo', min: 0, max: 2, step: 0.1, def: 1 },
    { key: 'cap', label: 'Tapa', min: 0, max: 1, step: 0.05, def: 1 },
  ],
  grooves: [{ key: 'step', label: 'Paso', min: 1, max: 8, step: 0.2, def: 2.4 }],
  knurl: [
    { key: 'depth', label: 'Profundidad', min: 0.05, max: 0.4, step: 0.01, def: 0.16 },
    { key: 'strength', label: 'Fuerza', min: 0, max: 1, step: 0.05, def: 0.5 },
  ],
  rim: [{ key: 'size', label: 'Tamaño', min: 0.5, max: 8, step: 0.5, def: 3 }],
  sheen: [
    { key: 'strength', label: 'Fuerza', min: 0, max: 1, step: 0.05, def: 0.35 },
    { key: 'width', label: 'Ancho', min: 0.05, max: 0.6, step: 0.01, def: 0.35 },
    { key: 'pos', label: 'Posición', min: 0, max: 1, step: 0.02, def: 0.3 },
  ],
  emissive: [
    { key: 'color', label: 'Color', color: true, def: '#ff3020' },
    { key: 'strength', label: 'Intensidad', min: 0, max: 1.5, step: 0.05, def: 1 },
    { key: 'radius', label: 'Halo', min: 1, max: 5, step: 0.1, def: 2.2 },
    { key: 'followValue', label: 'Enciende con el valor', bool: true, def: true },
  ],
  noise: [{ key: 'amount', label: 'Cantidad', min: 0, max: 0.4, step: 0.01, def: 0.08 }],
  innerShadow: [
    { key: 'distance', label: 'Distancia', min: 0, max: 12, step: 0.5, def: 3 },
    { key: 'blur', label: 'Desenfoque', min: 0, max: 30, step: 1, def: 6 },
  ],
  glow: [{ key: 'blur', label: 'Desenfoque', min: 0, max: 40, step: 1, def: 12 }],
};

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
  const setMaterial = useStore((s) => s.setMaterial);
  const advanced = useStore((s) => s.advanced);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
        const isOpen = !collapsed[l.id];
        return (
          <fieldset key={l.id}>
            <legend style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer' }}
              onClick={() => setCollapsed((c) => ({ ...c, [l.id]: isOpen }))}>
              <span>{isOpen ? '▾' : '▸'} {l.name}</span>
              <button className="btn" style={{ padding: '1px 7px' }} title="Quitar capa"
                onClick={(ev) => { ev.stopPropagation(); removeLayer(control.id, l.id); }}>✕</button>
            </legend>
            {!isOpen ? null : (<>

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

            {l.kind === 'text' && (() => {
              const t = l.text ?? { content: '', family: '"IBM Plex Sans", system-ui, sans-serif', size: 16, weight: 600, letterSpacing: 1.5, align: 'center' as const, finish: 'engraved' as const };
              const setText = (patch: Partial<typeof t>) => updateLayer(control.id, l.id, { text: { ...t, ...patch } });
              return (
                <>
                  <label className="k3-field" style={{ marginTop: 8 }}>
                    <span>Texto</span>
                    <input type="text" value={t.content} onChange={(e) => setText({ content: e.target.value })} />
                  </label>
                  <div className="row">
                    <label className="k3-field" style={{ flex: 1 }}><span>Tamaño <b>{t.size}px</b></span>
                      <input type="range" min={8} max={48} step={1} value={t.size}
                        onChange={(e) => setText({ size: Number(e.target.value) })} /></label>
                    <label className="k3-field" style={{ flex: 1 }}><span>Grosor <b>{t.weight}</b></span>
                      <input type="range" min={300} max={800} step={100} value={t.weight}
                        onChange={(e) => setText({ weight: Number(e.target.value) })} /></label>
                  </div>
                  <div className="row">
                    <label className="k3-field" style={{ flex: 1 }}><span>Espaciado <b>{t.letterSpacing}px</b></span>
                      <input type="range" min={0} max={6} step={0.5} value={t.letterSpacing}
                        onChange={(e) => setText({ letterSpacing: Number(e.target.value) })} /></label>
                    <label className="k3-field" style={{ flex: 1 }}><span>Alinear</span>
                      <select value={t.align} onChange={(e) => setText({ align: e.target.value as typeof t.align })}>
                        <option value="left">Izquierda</option>
                        <option value="center">Centro</option>
                        <option value="right">Derecha</option>
                      </select></label>
                  </div>
                  <label className="k3-field"><span>Relleno</span>
                    <select value={t.fillMode ?? 'solid'} onChange={(e) => setText({ fillMode: e.target.value as typeof t.fillMode })}>
                      <option value="solid">Sólido (color plano, con acabado)</option>
                      <option value="mask">Máscara (el color/textura de arriba se ve SOLO dentro de las letras)</option>
                    </select></label>
                  {(t.fillMode ?? 'solid') === 'solid' ? (
                    <label className="k3-field"><span>Acabado</span>
                      <select value={t.finish} onChange={(e) => setText({ finish: e.target.value as typeof t.finish })}>
                        <option value="flat">Plano</option>
                        <option value="engraved">Grabado (hundido)</option>
                        <option value="raised">Realzado</option>
                      </select></label>
                  ) : (
                    <p className="hint" style={{ margin: '4px 0 0' }}>
                      Sin acabado (grabado/realzado no aplica a texto máscara). Usa el color o la textura de arriba.
                    </p>
                  )}
                </>
              );
            })()}

            {l.shape !== 'ticks' && l.kind !== 'text' && (
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

            {l.rectNorm && (
              <div className="row">
                {(['x', 'y', 'w', 'h'] as const).map((k) => (
                  <label key={k} className="k3-field" style={{ flex: 1 }}>
                    <span>{k.toUpperCase()} %</span>
                    <input type="number" step={1} value={Math.round(l.rectNorm![k] * 100)}
                      onChange={(e) => updateLayer(control.id, l.id, { rectNorm: { ...l.rectNorm!, [k]: Number(e.target.value) / 100 } })} />
                  </label>
                ))}
              </div>
            )}

            {l.shape !== 'ticks' && l.kind !== 'text' && (<>
            <label className="k3-field" style={{ marginTop: 6 }}>
              <span>Animación con el valor</span>
              <select value={l.anim?.mode ?? 'none'}
                onChange={(ev) => {
                  const m = ev.target.value as NonNullable<typeof l.anim>['mode'];
                  const anim =
                    m === 'rotate' ? { mode: m, minDeg: -150, maxDeg: 150 } :
                    m === 'translate' ? { mode: m, travel: { x: 0.5, y: 0 } } :
                    m === 'lever' ? { mode: m, travel: { x: 0, y: -0.5 }, pivotNorm: { x: 0.5, y: 0.5 } } :
                    { mode: 'none' as const };
                  updateLayer(control.id, l.id, { anim });
                }}>
                <option value="none">Fija</option>
                <option value="rotate">Gira (knob)</option>
                <option value="translate">Se desplaza (switch / slider)</option>
                <option value="lever">Palanca (pivote → punta)</option>
              </select>
            </label>
            {(l.anim?.mode === 'translate' || l.anim?.mode === 'lever') && (
              <div className="row">
                <label className="k3-field" style={{ flex: 1 }}><span>Recorrido X <b>{Math.round((l.anim.travel?.x ?? 0) * 100)}%</b></span>
                  <input type="range" min={-100} max={100} value={Math.round((l.anim.travel?.x ?? 0) * 100)}
                    onChange={(e) => updateLayer(control.id, l.id, { anim: { ...l.anim!, travel: { x: Number(e.target.value) / 100, y: l.anim!.travel?.y ?? 0 } } })} /></label>
                <label className="k3-field" style={{ flex: 1 }}><span>Recorrido Y <b>{Math.round((l.anim.travel?.y ?? 0) * 100)}%</b></span>
                  <input type="range" min={-100} max={100} value={Math.round((l.anim.travel?.y ?? 0) * 100)}
                    onChange={(e) => updateLayer(control.id, l.id, { anim: { ...l.anim!, travel: { x: l.anim!.travel?.x ?? 0, y: Number(e.target.value) / 100 } } })} /></label>
              </div>
            )}
            {l.anim?.mode === 'lever' && (
              <div className="row">
                <label className="k3-field" style={{ flex: 1 }}><span>Pivote X %</span>
                  <input type="number" value={Math.round((l.anim.pivotNorm?.x ?? 0.5) * 100)}
                    onChange={(e) => updateLayer(control.id, l.id, { anim: { ...l.anim!, pivotNorm: { x: Number(e.target.value) / 100, y: l.anim!.pivotNorm?.y ?? 0.5 } } })} /></label>
                <label className="k3-field" style={{ flex: 1 }}><span>Pivote Y %</span>
                  <input type="number" value={Math.round((l.anim.pivotNorm?.y ?? 0.5) * 100)}
                    onChange={(e) => updateLayer(control.id, l.id, { anim: { ...l.anim!, pivotNorm: { x: l.anim!.pivotNorm?.x ?? 0.5, y: Number(e.target.value) / 100 } } })} /></label>
              </div>
            )}

            <label className="k3-field" style={{ marginTop: 6 }}>
              <span>Material (preset)</span>
              <select value="" onChange={(ev) => {
                const m = MATERIALS.find((x) => x.id === (ev.target.value as MaterialId));
                if (m) setMaterial(control.id, l.id, m.id, m.fill);
              }}>
                <option value="">Aplicar material…</option>
                {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
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

            {/* Parámetros de los efectos activos (edición avanzada) */}
            {advanced && l.effects.filter((e) => e.enabled && EFFECT_PARAMS[e.type]).map((e) => (
              <div key={e.id} style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 6, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{EFFECTS.find((x) => x[0] === e.type)?.[1] ?? e.type}</span>
                {EFFECT_PARAMS[e.type]!.map((p) => {
                  if ('color' in p) {
                    const v = typeof e.params[p.key] === 'string' ? (e.params[p.key] as string) : p.def;
                    return (
                      <label key={p.key} className="k3-field"><span>{p.label}</span>
                        <input type="color" value={v.startsWith('#') ? v : p.def}
                          onChange={(ev) => updateEffect(control.id, l.id, e.id, { ...e.params, [p.key]: ev.target.value })} /></label>
                    );
                  }
                  if ('bool' in p) {
                    const v = typeof e.params[p.key] === 'boolean' ? (e.params[p.key] as boolean) : p.def;
                    return (
                      <label key={p.key} className="chk"><input type="checkbox" checked={v}
                        onChange={(ev) => updateEffect(control.id, l.id, e.id, { ...e.params, [p.key]: ev.target.checked })} /><span>{p.label}</span></label>
                    );
                  }
                  const v = typeof e.params[p.key] === 'number' ? (e.params[p.key] as number) : p.def;
                  return (
                    <label key={p.key} className="k3-field"><span>{p.label} <b>{Number.isInteger(p.step) ? v : v.toFixed(2)}</b></span>
                      <input type="range" min={p.min} max={p.max} step={p.step} value={v}
                        onChange={(ev) => updateEffect(control.id, l.id, e.id, { ...e.params, [p.key]: Number(ev.target.value) })} /></label>
                  );
                })}
              </div>
            ))}

            {/* Luces / reflejos extra (cada reflejo con su ángulo) — edición avanzada */}
            {advanced && (
            <div style={{ marginTop: 8 }}>
              <div className="k3-field"><span>Reflejos / luces</span></div>
              {speculars.map((e, i) => {
                const angle = typeof e.params.angleDeg === 'number' ? e.params.angleDeg : scene.lights[0].angleDeg;
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
                onClick={() => addEffect(control.id, l.id, 'specular', { size: 0.45, aspect: 1, angleDeg: (scene.lights[0].angleDeg + 40) % 360 })}>
                + Añadir reflejo
              </button>
            </div>
            )}
            {!advanced && l.effects.some((e) => e.enabled) && (
              <p className="hint" style={{ marginTop: 6 }}>
                Activa "Edición avanzada" en la barra para ajustar cada efecto (tamaño, fuerza, ángulo…).
              </p>
            )}
            </>)}
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
        <button className="btn" onClick={() => addLayer(control.id, {
          id: makeId('lyr'), name: 'Texto', kind: 'text', visible: true, blendMode: 'normal',
          opacity: 1, fill: '#d8dae0', rectNorm: { x: 0, y: 0.75, w: 1, h: 0.2 }, effects: [],
          text: { content: 'LABEL', family: '"IBM Plex Sans", system-ui, sans-serif', size: 12, weight: 600, letterSpacing: 1, align: 'center', finish: 'engraved' },
        })}>+ Texto</button>
      </div>
    </div>
  );
}
