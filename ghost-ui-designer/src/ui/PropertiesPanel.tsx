import { useStore } from '../app/store';
import { Control, ControlType } from '../model/scene';

const CONTROL_TYPES: ControlType[] = [
  'IVKnobControl',
  'IVSliderControl',
  'IVButtonControl',
  'IBKnobControl',
  'IBitmapControl',
];

export function PropertiesPanel() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const update = useStore((s) => s.updateControl);

  const control = scene.controls.find((c) => c.id === selectedId);
  if (!control) return <div className="panel">Selecciona un control</div>;

  const setRect = (k: keyof Control['rect'], v: number) =>
    update(control.id, { rect: { ...control.rect, [k]: v } });

  return (
    <div className="panel">
      <h3>Propiedades</h3>
      <label>
        Nombre
        <input
          value={control.name}
          onChange={(e) => update(control.id, { name: e.target.value })}
        />
      </label>
      <label>
        Tipo
        <select
          value={control.type}
          onChange={(e) => update(control.id, { type: e.target.value as ControlType })}
        >
          {CONTROL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        Parámetro
        <select
          value={control.paramId ?? ''}
          onChange={(e) =>
            update(control.id, { paramId: e.target.value || undefined })
          }
        >
          <option value="">(ninguno)</option>
          {scene.params.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        {(['x', 'y', 'w', 'h'] as const).map((k) => (
          <label key={k} className="small">
            {k.toUpperCase()}
            <input
              type="number"
              value={control.rect[k]}
              onChange={(e) => setRect(k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
