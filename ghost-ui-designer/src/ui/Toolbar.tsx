import { useStore } from '../app/store';

export function Toolbar() {
  const scene = useStore((s) => s.scene);
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

  const exportCpp = async () => {
    // En una versión completa se recuerda la ruta; aquí se pide al guardar proyecto.
    const p = await window.ghost.saveProject(scene);
    if (p) {
      const cppPath = p.replace(/\.ghostui$/, '.cpp');
      const { merged } = await window.ghost.exportCpp(scene, cppPath);
      alert(`C++ ${merged ? 'actualizado (round-trip)' : 'generado'}: ${cppPath}`);
    }
  };

  return (
    <div className="toolbar">
      <strong>Ghost UI Designer</strong>
      <button onClick={addKnob}>+ Knob</button>
      <button onClick={preview}>Vista previa C++</button>
      <button onClick={exportCpp}>Exportar C++</button>
      <span className="spacer" />
      <button onClick={openProject}>Abrir</button>
      <button onClick={saveProject}>Guardar</button>
    </div>
  );
}
