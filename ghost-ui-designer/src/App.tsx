import { useEffect } from 'react';
import { Stage } from './canvas/Stage';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { LayersPanel } from './ui/LayersPanel';
import { Knob3DPanel } from './ui/Knob3DPanel';
import { LightPanel } from './ui/LightPanel';
import { CanvasPanel } from './ui/CanvasPanel';
import { AlignPanel } from './ui/AlignPanel';
import { Toolbar } from './ui/Toolbar';
import { useStore } from './app/store';
import { ensureSceneFontsLoaded } from './render/fonts';

export function App() {
  const previewCpp = useStore((s) => s.previewCpp);
  const fonts = useStore((s) => s.scene.assets.fonts);
  const bridgeOk = typeof window !== 'undefined' && !!(window as unknown as { ghost?: unknown }).ghost;

  // Las fuentes custom (.ttf/.otf importadas) viven embebidas en el .ghostui;
  // hay que volver a registrarlas (FontFace) cada vez que se abre un proyecto,
  // porque el registro de fuentes del navegador no persiste entre recargas.
  useEffect(() => {
    ensureSceneFontsLoaded(fonts);
  }, [fonts]);

  // Ctrl+Z / Cmd+Z deshace; Ctrl+Shift+Z, Ctrl+Y o Cmd+Shift+Z rehace. Se
  // ignora mientras se escribe en un input/textarea/select para no pisar el
  // deshacer nativo del navegador dentro de un campo de texto.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        const { undo, redo } = useStore.getState();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }

      // Supr/Backspace borra el/los control(es) seleccionados ENTEROS (no
      // una capa suelta) — antes no había forma de sacar un control completo
      // de la escena, solo capa por capa desde el panel de capas.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedIds, removeSelectedControls } = useStore.getState();
        if (selectedIds.length === 0) return;
        e.preventDefault();
        removeSelectedControls();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      {!bridgeOk && (
        <div className="bridge-warn">
          El puente con Electron (preload) no cargó: importar/exportar/guardar no funcionarán. Reinicia con <code>npm run electron:dev</code>.
        </div>
      )}
      <Toolbar />
      <div className="body">
        <main className="stage-area">
          <Stage />
          {previewCpp && (
            <pre className="cpp-preview">
              <code>{previewCpp}</code>
            </pre>
          )}
        </main>
        <aside className="sidebar">
          <CanvasPanel />
          <AlignPanel />
          <LightPanel />
          <PropertiesPanel />
          <LayersPanel />
          <Knob3DPanel />
        </aside>
      </div>
    </div>
  );
}
