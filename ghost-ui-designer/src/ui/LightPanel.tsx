import { useStore } from '../app/store';
import { LightSource } from '../model/scene';

function LightFields({ index, light }: { index: number; light: LightSource }) {
  const setLight = useStore((s) => s.setLight);
  const elev = light.elev ?? 0.5;
  const fill = light.fill ?? 0;
  const set = (patch: Partial<LightSource>) => setLight(index, patch);

  return (
    <>
      <label>
        Ángulo <b>{Math.round(light.angleDeg)}°</b>
        <input type="range" min={0} max={359} value={light.angleDeg} onChange={(e) => set({ angleDeg: Number(e.target.value) })} />
      </label>
      <label>
        Intensidad <b>{light.intensity.toFixed(2)}</b>
        <input
          type="range" min={0} max={100} value={Math.round(light.intensity * 100)}
          onChange={(e) => set({ intensity: Number(e.target.value) / 100 })}
        />
      </label>
      <label>
        Altura <b>{elev.toFixed(2)}</b>
        <input type="range" min={0} max={100} value={Math.round(elev * 100)} onChange={(e) => set({ elev: Number(e.target.value) / 100 })} />
      </label>
      {index === 0 ? (
        <label>
          Relleno (luz opuesta) <b>{fill.toFixed(2)}</b>
          <input type="range" min={0} max={100} value={Math.round(fill * 100)} onChange={(e) => set({ fill: Number(e.target.value) / 100 })} />
        </label>
      ) : (
        <label>
          Color
          <div className="row">
            <input type="color" value={light.color ?? '#57b6c9'} onChange={(e) => set({ color: e.target.value })} />
          </div>
        </label>
      )}
    </>
  );
}

/** Luces globales del editor 2D: la principal (índice 0) orienta biseles,
 *  domos y sombras de todos los controles, igual que antes. Cualquier luz
 *  adicional se suma como un reflejo de borde tintado, encima de todo. */
export function LightPanel() {
  const lights = useStore((s) => s.scene.lights);
  const addLight = useStore((s) => s.addLight);
  const removeLight = useStore((s) => s.removeLight);
  const previewValue = useStore((s) => s.previewValue);
  const setPreviewValue = useStore((s) => s.setPreviewValue);

  return (
    <div className="panel k3">
      <h3>Luz global</h3>
      <fieldset>
        <legend>Principal</legend>
        <LightFields index={0} light={lights[0]} />
      </fieldset>
      {lights.slice(1).map((light, i) => (
        <fieldset key={i + 1}>
          <legend>Luz {i + 2}</legend>
          <LightFields index={i + 1} light={light} />
          <button className="btn" style={{ marginTop: 6 }} onClick={() => removeLight(i + 1)}>Quitar esta luz</button>
        </fieldset>
      ))}
      <button className="btn" onClick={addLight} title="Suma un reflejo de borde tintado, con su propio ángulo/color, encima de todos los controles">
        + Añadir luz
      </button>
      <label style={{ marginTop: 10, display: 'block' }}>
        Valor (previsualización) <b>{Math.round(previewValue * 100)}%</b>
        <input type="range" min={0} max={100} value={Math.round(previewValue * 100)} onChange={(e) => setPreviewValue(Number(e.target.value) / 100)} />
      </label>
    </div>
  );
}
