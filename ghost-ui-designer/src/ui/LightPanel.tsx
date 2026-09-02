import { useStore } from '../app/store';

/** Luz global del editor 2D: orienta biseles, domos y reflejos de todos los controles. */
export function LightPanel() {
  const light = useStore((s) => s.scene.light);
  const setLight = useStore((s) => s.setLight);

  return (
    <div className="panel">
      <h3>Luz global</h3>
      <label>
        Ángulo <b>{Math.round(light.angleDeg)}°</b>
        <input
          type="range" min={0} max={359} value={light.angleDeg}
          onChange={(e) => setLight({ angleDeg: Number(e.target.value) })}
        />
      </label>
      <label>
        Intensidad <b>{light.intensity.toFixed(2)}</b>
        <input
          type="range" min={0} max={100} value={Math.round(light.intensity * 100)}
          onChange={(e) => setLight({ intensity: Number(e.target.value) / 100 })}
        />
      </label>
    </div>
  );
}
