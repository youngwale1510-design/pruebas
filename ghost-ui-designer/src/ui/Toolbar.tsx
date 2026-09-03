import { useStore } from '../app/store';
import { exportBundle, exportControlFilmstripPng } from '../app/exportBundle';

export function Toolbar() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const addKnob = useStore((s) => s.addKnob);
  const addSwitch = useStore((s) => s.addSwitch);
  const addBackground = useStore((s) => s.addBackground);
  const addLabel = useStore((s) => s.addLabel);
  const copyStyle = useStore((s) => s.copyStyle);
  const pasteStyle = useStore((s) => s.pasteStyle);
  const styleClipboard = useStore((s) => s.styleClipboard);
  const advanced = useStore((s) => s.advanced);
  const setAdvanced = useStore((s) => s.setAdvanced);
  const setScene = useStore((s) => s.setScene);
  const importControls = useStore((s) => s.importControls);
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

  const openCpp = async () => {
    const res = await window.ghost.importCpp();
    if (!res) return;
    if (!res.found) {
      alert('Ese .cpp no tiene marcadores // [GHOST:LAYOUT ...]. Pide el plugin con la GUI marcada o añade los marcadores.');
      return;
    }
    const name = res.path.replace(/\\/g, '/').split('/').pop()!.replace(/\.(cpp|cc|cxx|h|hpp)$/i, '');
    importControls(res.controls, name);
    alert(`${res.controls.length} controles cargados desde ${name}. Al exportar el bundle, elige la carpeta del proyecto iPlug2 y se actualizará solo la región marcada.`);
  };

  const doExport = async () => {
    const res = await exportBundle(scene);
    if (!res) return;
    const lines = [
      `Bundle ${res.merged ? 'actualizado (round-trip)' : 'generado'} en:`,
      res.dir,
      '(.cpp + _resources.h + resources/*.png)',
    ];
    if (res.headerChanged) {
      lines.push('', 'Se añadieron tags/parámetros nuevos al .h (kCtrl_… / EParams). Recompila.');
    } else if (!res.headerFound) {
      lines.push(
        '',
        'Aviso: no se encontró (o no se pudo leer) el .h junto al .cpp exportado.',
        'Si el plugin tiene controles o parámetros nuevos, añade a mano en el .h',
        'su kCtrl_<id> en ECtrlTags y/o su parámetro en EParams — si no, no compila.',
      );
    }
    alert(lines.join('\n'));
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
      <button onClick={() => addSwitch('slide')}>+ Switch</button>
      <button onClick={() => addSwitch('toggle')}>+ Palanca</button>
      <button onClick={() => addSwitch('led')}>+ LED</button>
      <button onClick={addBackground}>+ Fondo</button>
      <button onClick={addLabel}>+ Texto</button>
      <span className="toolbar-sep" />
      <button disabled={!selectedId} onClick={() => selectedId && copyStyle(selectedId)} title="Copiar el estilo (capas, efectos, materiales) del control seleccionado">
        Copiar estilo
      </button>
      <button disabled={!selectedId || !styleClipboard} onClick={() => selectedId && pasteStyle(selectedId, false)} title="Aplicar el estilo copiado a este control">
        Pegar estilo
      </button>
      <button disabled={!selectedId || !styleClipboard} onClick={() => selectedId && pasteStyle(selectedId, true)} title="Aplicar el estilo copiado a todos los controles del mismo tipo">
        Pegar en todos
      </button>
      <span className="toolbar-sep" />
      <label className="chk" style={{ margin: 0 }}>
        <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
        <span>Edición avanzada</span>
      </label>
      <button onClick={preview}>Vista previa C++</button>
      <button onClick={exportFilmstrip}>Exportar filmstrip</button>
      <button onClick={doExport}>Exportar bundle</button>
      <span className="spacer" />
      <button onClick={openCpp}>Abrir .cpp</button>
      <button onClick={openProject}>Abrir proyecto</button>
      <button onClick={saveProject}>Guardar</button>
    </div>
  );
}
