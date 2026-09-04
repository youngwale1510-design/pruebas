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

export function App() {
  const previewCpp = useStore((s) => s.previewCpp);
  const bridgeOk = typeof window !== 'undefined' && !!(window as unknown as { ghost?: unknown }).ghost;

  // Ctrl+Z / Cmd+Z deshace; Ctrl+Shift+Z, Ctrl+Y o Cmd+Shift+Z rehace. Se
  // ignora mientras se escribe en un input/textarea/select para no pisar el
  // deshacer nativo del navegador dentro de un campo de texto.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      const { undo, redo } = useStore.getState();
      if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
      else undo();
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
