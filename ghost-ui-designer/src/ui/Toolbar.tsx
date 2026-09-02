import { useStore } from '../app/store';
import { exportBundle, exportControlFilmstripPng } from '../app/exportBundle';

export function Toolbar() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const addKnob = useStore((s) => s.addKnob);
  const setScene = useStore((s) => s.setScene);
  const setPreview = useStore((s) => s.setPreview);

  const preview = async () => {
    const cpp = await window.ghost.previewCpp(scene, null);
    setPreview(cpp);
  };

  const saveProject = () => window.ghost.saveProject(scene);

  const openProject = async () => {
    const res = await window.ghost.openProject();
    if (res) setScene(res.scene);
  };

  const doExport = async () => {
    const res = await exportBundle(scene);
    if (res) {
      alert(
        `Bundle ${res.merged ? 'actualizado (round-trip)' : 'generado'} en:\n${res.dir}\n` +
          `(.cpp + _resources.h + resources/*.png)`,
      );
    }
  };

  const exportFilmstrip = async () => {
    const id = selectedId ?? scene.controls[0]?.id;
    if (!id) { alert('Selecciona un control primero.'); return; }
    const p = await exportControlFilmstripPng(scene, id);
    if (p) alert('Filmstrip guardado:\n' + p);
  };

  return (
    <div className="toolbar">
      <strong>Ghost UI Designer</strong>
      <button onClick={addKnob}>+ Knob</button>
      <button onClick={preview}>Vista previa C++</button>
      <button onClick={exportFilmstrip}>Exportar filmstrip</button>
      <button onClick={doExport}>Exportar bundle</button>
      <span className="spacer" />
      <button onClick={openProject}>Abrir</button>
      <button onClick={saveProject}>Guardar</button>
    </div>
  );
}
