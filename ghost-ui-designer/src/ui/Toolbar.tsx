import { useState } from 'react';
import { useStore } from '../app/store';
import { exportBundle, exportControlFilmstripPng } from '../app/exportBundle';

export function Toolbar() {
  const scene = useStore((s) => s.scene);
  const selectedId = useStore((s) => s.selectedId);
  const addKnob = useStore((s) => s.addKnob);
  const addSwitch = useStore((s) => s.addSwitch);
  const addBackground = useStore((s) => s.addBackground);
  const addLabel = useStore((s) => s.addLabel);
  const addImage = useStore((s) => s.addImage);
  const updateControl = useStore((s) => s.updateControl);
  const updateLayer = useStore((s) => s.updateLayer);
  const select = useStore((s) => s.select);
  const copyStyle = useStore((s) => s.copyStyle);
  const pasteStyle = useStore((s) => s.pasteStyle);
  const styleClipboard = useStore((s) => s.styleClipboard);
  const advanced = useStore((s) => s.advanced);
  const setAdvanced = useStore((s) => s.setAdvanced);
  const setScene = useStore((s) => s.setScene);
  const importControls = useStore((s) => s.importControls);
  const setPreview = useStore((s) => s.setPreview);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const addRefBox = useStore((s) => s.addRefBox);

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
    const res = await window.ghost.importCpp(undefined, scene.canvas.width, scene.canvas.height);
    if (!res) return;
    if (!res.found) {
      alert('Ese .cpp no tiene marcadores // [GHOST:LAYOUT ...]. Pide el plugin con la GUI marcada o añade los marcadores.');
      return;
    }
    const name = res.path.replace(/\\/g, '/').split('/').pop()!.replace(/\.(cpp|cc|cxx|h|hpp)$/i, '');
    importControls(res.controls, name, res.refBoxes);
    const lines = [`${res.controls.length} controles cargados desde ${name}.`];
    if (res.refBoxes.length > 0) {
      lines.push(
        '',
        `También se agregaron ${res.refBoxes.length} caja(s) de referencia (cuadros punteados) para lo que Ghost no diseña`,
        '(texto fijo, visualizadores, controles sin parámetro…). Revisa su posición/tamaño en el lienzo.',
      );
    }
    lines.push('', 'Al exportar el bundle, elige la carpeta del proyecto iPlug2 y se actualizará solo la región marcada.');
    alert(lines.join('\n'));
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
    if (res.configChanged) {
      lines.push('', `Se ajustó PLUG_WIDTH/PLUG_HEIGHT en config.h a ${scene.canvas.width}×${scene.canvas.height} (tamaño del lienzo). Recompila.`);
    } else if (!res.configFound) {
      lines.push(
        '',
        'Aviso: no se encontró config.h junto al .cpp exportado.',
        `Pon a mano PLUG_WIDTH ${scene.canvas.width} / PLUG_HEIGHT ${scene.canvas.height} — si no, la ventana`,
        'del plugin se queda con el tamaño viejo y solo se ve una esquina del diseño.',
      );
    }
    if (res.rcChanged) {
      lines.push('', 'Se añadieron a resources/main.rc las líneas PNG que faltaban. Recompila.');
    } else if (!res.rcFound) {
      lines.push(
        '',
        'Aviso: no se encontró resources/main.rc junto al bundle exportado.',
        'Pega a mano las líneas de <Plugin>_resources.rc.txt — si no, Windows no',
        'embebe los filmstrip nuevos y el plugin arranca sin ellos.',
      );
    }
    alert(lines.join('\n'));
  };

  const [includeSize, setIncludeSize] = useState(false);

  const insertImage = async () => {
    addImage();
    const img = useStore.getState().scene.controls.at(-1);
    if (!img) return;
    const res = await window.ghost.importImage();
    if (!res) return;
    let w = img.rect.w, h = img.rect.h;
    if (res.width > 0 && res.height > 0) {
      w = 120;
      h = Math.max(20, Math.min(400, Math.round(120 * (res.height / res.width))));
    }
    updateControl(img.id, { rect: { ...img.rect, w, h } });
    updateLayer(img.id, img.layers[0].id, { fillImage: res.dataUri, fillImageMode: 'cover' });
    select(img.id);
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
      <button disabled={!canUndo} onClick={undo} title="Deshacer (Ctrl+Z)">↶ Deshacer</button>
      <button disabled={!canRedo} onClick={redo} title="Rehacer (Ctrl+Shift+Z / Ctrl+Y)">↷ Rehacer</button>
      <span className="toolbar-sep" />
      <button onClick={addKnob}>+ Knob</button>
      <button onClick={() => addSwitch('slide')}>+ Switch</button>
      <button onClick={() => addSwitch('toggle')}>+ Palanca</button>
      <button onClick={() => addSwitch('led')}>+ LED</button>
      <button onClick={() => addSwitch('ledButton')} title="Pulsador iluminado (con cuerpo pulsable): al hacer clic en el plugin, prende/apaga lo que controle">
        + Botón LED
      </button>
      <button onClick={addBackground}>+ Fondo</button>
      <button onClick={addLabel}>+ Texto</button>
      <button onClick={insertImage}>+ Imagen</button>
      <button onClick={addRefBox} title="Cuadro punteado, solo visual, para marcar dónde va algo que Ghost no diseña (un visualizador, un control hecho a mano, etc.) y respetar su espacio. No se exporta al .cpp.">
        + Referencia
      </button>
      <span className="toolbar-sep" />
      <button disabled={!selectedId} onClick={() => selectedId && copyStyle(selectedId)} title="Copiar el estilo (capas, efectos, materiales) del control seleccionado">
        Copiar estilo
      </button>
      <button disabled={!selectedId || !styleClipboard} onClick={() => selectedId && pasteStyle(selectedId, false, includeSize)} title="Aplicar el estilo copiado a este control">
        Pegar estilo
      </button>
      <button disabled={!selectedId || !styleClipboard} onClick={() => selectedId && pasteStyle(selectedId, true, includeSize)} title="Aplicar el estilo copiado a todos los controles del mismo tipo">
        Pegar en todos
      </button>
      <label className="chk" style={{ margin: 0 }} title="Al pegar, también copiar el ancho/alto (W×H) del control de origen">
        <input type="checkbox" checked={includeSize} onChange={(e) => setIncludeSize(e.target.checked)} />
        <span>incluir tamaño</span>
      </label>
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
