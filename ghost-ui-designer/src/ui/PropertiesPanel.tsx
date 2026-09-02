import { useStore } from '../app/store';
import { Control, ControlType } from '../model/scene';

const CONTROL_TYPES: ControlType[] = [
  'IVKnobControl',
  'IVSliderControl',
  'IVButtonControl',
  'IVToggleControl',
  'IBKnobControl',
  'IBSwitchControl',
  'IBitmapControl',
];

export function PropertiesPanel() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const update = useStore((s) => s.updateControl);
  const setSteps = useStore((s) => s.setSteps);

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

      {control.type === 'IBSwitchControl' && (
        <label>
          Pasos (posiciones del switch) <b>{Number(control.props.frames ?? 2)}</b>
          <input
            type="range" min={2} max={8} value={Number(control.props.frames ?? 2)}
            onChange={(e) => setSteps(control.id, Number(e.target.value))}
          />
          <span className="hint">Cada paso es un frame del filmstrip; el parámetro pasa a enum 0..{Number(control.props.frames ?? 2) - 1}.</span>
        </label>
      )}

      <label>
        Margen para marcas (encoge el knob) <b>{Math.round(Number(control.props.bodyInset ?? 0) * 100)}%</b>
        <input
          type="range" min={0} max={40} value={Math.round(Number(control.props.bodyInset ?? 0) * 100)}
          onChange={(e) => update(control.id, { props: { ...control.props, bodyInset: Number(e.target.value) / 100 } })}
        />
      </label>

      <h3 style={{ marginTop: 16 }}>Filmstrip propio</h3>
      <p className="hint">
        ¿Ya tienes tu imagen (Photoshop/Blender)? Impórtala como sprite sheet y el
        plugin la usará tal cual.
      </p>
      {control.props.filmstripDataUri ? (
        <>
          <img
            src={control.props.filmstripDataUri as string}
            alt="filmstrip"
            style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 6, border: '1px solid var(--border)', background: '#0e0e11' }}
          />
          <div className="row">
            <label className="small">
              Frames
              <input
                type="number"
                min={1}
                value={Number(control.props.frames ?? 1)}
                onChange={(e) =>
                  update(control.id, { props: { ...control.props, frames: Math.max(1, Number(e.target.value)) } })
                }
              />
            </label>
            <label className="small">
              Orientación
              <select
                value={(control.props.orientation as string) ?? 'vertical'}
                onChange={(e) =>
                  update(control.id, { props: { ...control.props, orientation: e.target.value } })
                }
              >
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </label>
          </div>
          <button
            className="btn"
            onClick={() => {
              const { filmstripDataUri: _drop, ...rest } = control.props;
              update(control.id, { props: rest });
            }}
          >
            Quitar filmstrip
          </button>
        </>
      ) : (
        <button className="btn primary" onClick={importFilmstrip}>
          Importar PNG…
        </button>
      )}
    </div>
  );

  async function importFilmstrip() {
    const res = await window.ghost.importImage();
    if (!res) return;
    // Adivina nº de frames si es una tira vertical alta (alto múltiplo del ancho).
    let frames = 1;
    if (res.width > 0 && res.height > res.width) {
      const guess = Math.round(res.height / res.width);
      if (guess > 1 && Math.abs(res.height / guess - res.width) < 2) frames = guess;
    }
    update(control!.id, {
      type: 'IBKnobControl',
      props: { ...control!.props, filmstripDataUri: res.dataUri, frames, orientation: 'vertical' },
    });
  }
}
