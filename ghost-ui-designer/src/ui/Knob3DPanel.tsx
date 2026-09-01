import { useStore } from '../app/store';
import { Knob3DView } from '../canvas/Knob3DView';
import {
  KnobConfig, KnobMaterial, SlotShape, MidShape, TopType, IndicatorType,
  defaultKnobConfig, applyQuickstart, KNOB_QUICKSTARTS,
} from '../model/knobConfig';

const MATERIALS: [KnobMaterial, string][] = [
  ['turned', 'Aluminio torneado'], ['brushed', 'Aluminio cepillado'], ['chrome', 'Cromo espejo'],
  ['brass', 'Latón/Oro'], ['darkmetal', 'Metal oscuro'], ['blackgloss', 'Negro brillante'],
  ['glossy', 'Plástico brillante'], ['matte', 'Plástico mate'],
];
const BASE_SHAPES: [SlotShape, string][] = [['ellipse', 'Círculo'], ['scalloped', 'Estriado'], ['triangle', 'Triángulo'], ['polygon', 'Hexágono'], ['roundRect', 'Cuadrado']];
const MID_SHAPES: [MidShape, string][] = [['ellipse', 'Círculo'], ['scalloped', 'Estriado'], ['polygon', 'Hexágono'], ['none', 'Ninguno']];
const TOPS: [TopType, string][] = [['none', 'Ninguno'], ['hub', 'Cubo central'], ['button', 'Botón'], ['chicken', 'Punta chicken-head']];
const INDICATORS: [IndicatorType, string][] = [['line', 'Línea'], ['dot', 'Punto'], ['none', 'Ninguno']];

function Sel<T extends string>({ label, options, value, onChange }: {
  label: string; options: [T, string][]; value: T; onChange: (v: T) => void;
}) {
  return (
    <label className="k3-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Rng({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="k3-field">
      <span>{label} <b>{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Knob3DPanel() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const setKnob3d = useStore((s) => s.setKnob3d);

  const control = scene.controls.find((c) => c.id === selectedId);
  if (!control) return null;
  const cfg = control.knob3d;

  const patch = (fn: (c: KnobConfig) => void) => {
    const next = structuredClone(cfg!) as KnobConfig;
    fn(next);
    setKnob3d(control.id, next);
  };

  if (!cfg) {
    return (
      <div className="panel">
        <h3>Knob 3D</h3>
        <p className="hint">Renderizado 3D real (metal con reflejos) horneado a filmstrip.</p>
        <button className="btn primary" onClick={() => setKnob3d(control.id, defaultKnobConfig())}>
          Activar knob 3D
        </button>
      </div>
    );
  }

  return (
    <div className="panel k3">
      <h3>Knob 3D</h3>
      <div className="k3-preview"><Knob3DView config={cfg} /></div>

      <div className="k3-quick">
        {Object.keys(KNOB_QUICKSTARTS).map((name) => (
          <button key={name} onClick={() => setKnob3d(control.id, applyQuickstart(cfg, name))}>{name}</button>
        ))}
      </div>

      <fieldset><legend>Abajo (base)</legend>
        <Sel label="Forma" options={BASE_SHAPES} value={cfg.base.shape} onChange={(v) => patch((c) => { c.base.shape = v; c.base.spin = v !== 'ellipse'; })} />
        <Sel label="Material" options={MATERIALS} value={cfg.base.material} onChange={(v) => patch((c) => { c.base.material = v; })} />
        <Rng label="Tamaño" min={0.5} max={1} step={0.01} value={cfg.base.size} onChange={(v) => patch((c) => { c.base.size = v; })} />
      </fieldset>

      <fieldset><legend>Enmedio (cuerpo)</legend>
        <Sel label="Forma" options={MID_SHAPES} value={cfg.mid.shape} onChange={(v) => patch((c) => { c.mid.shape = v; })} />
        <Sel label="Material" options={MATERIALS} value={cfg.mid.material} onChange={(v) => patch((c) => { c.mid.material = v; })} />
        <Rng label="Tamaño" min={0.2} max={0.95} step={0.01} value={cfg.mid.size} onChange={(v) => patch((c) => { c.mid.size = v; })} />
      </fieldset>

      <fieldset><legend>Arriba (tope)</legend>
        <Sel label="Pieza" options={TOPS} value={cfg.top.type} onChange={(v) => patch((c) => { c.top.type = v; })} />
        <Sel label="Material" options={MATERIALS} value={cfg.top.material} onChange={(v) => patch((c) => { c.top.material = v; })} />
        <Rng label="Tamaño" min={0.08} max={0.9} step={0.01} value={cfg.top.size} onChange={(v) => patch((c) => { c.top.size = v; })} />
      </fieldset>

      <fieldset><legend>Indicador</legend>
        <Sel label="Estilo" options={INDICATORS} value={cfg.indicator.type} onChange={(v) => patch((c) => { c.indicator.type = v; })} />
        <Rng label="Largo" min={0.1} max={0.45} step={0.01} value={cfg.indicator.len} onChange={(v) => patch((c) => { c.indicator.len = v; })} />
        <Rng label="Ancho" min={0.02} max={0.16} step={0.005} value={cfg.indicator.width} onChange={(v) => patch((c) => { c.indicator.width = v; })} />
      </fieldset>

      <fieldset><legend>Luz global</legend>
        <Rng label="Ángulo" min={0} max={359} step={1} value={cfg.light.angleDeg} onChange={(v) => patch((c) => { c.light.angleDeg = v; })} />
        <Rng label="Intensidad" min={0} max={1} step={0.01} value={cfg.light.intensity} onChange={(v) => patch((c) => { c.light.intensity = v; })} />
        <Rng label="Altura" min={0} max={1} step={0.01} value={cfg.light.elev} onChange={(v) => patch((c) => { c.light.elev = v; })} />
      </fieldset>

      <fieldset><legend>Filmstrip</legend>
        <Rng label="Barrido" min={180} max={340} step={1} value={cfg.sweepDeg} onChange={(v) => patch((c) => { c.sweepDeg = v; })} />
        <Rng label="Frames" min={9} max={129} step={2} value={cfg.frames} onChange={(v) => patch((c) => { c.frames = v; })} />
      </fieldset>

      <button className="btn" onClick={() => setKnob3d(control.id, undefined)}>Quitar knob 3D</button>
    </div>
  );
}
