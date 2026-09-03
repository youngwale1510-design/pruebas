import { Stage } from './canvas/Stage';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { LayersPanel } from './ui/LayersPanel';
import { Knob3DPanel } from './ui/Knob3DPanel';
import { LightPanel } from './ui/LightPanel';
import { CanvasPanel } from './ui/CanvasPanel';
import { Toolbar } from './ui/Toolbar';
import { useStore } from './app/store';

export function App() {
  const previewCpp = useStore((s) => s.previewCpp);
  const bridgeOk = typeof window !== 'undefined' && !!(window as unknown as { ghost?: unknown }).ghost;

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
          <LightPanel />
          <PropertiesPanel />
          <LayersPanel />
          <Knob3DPanel />
        </aside>
      </div>
    </div>
  );
}
