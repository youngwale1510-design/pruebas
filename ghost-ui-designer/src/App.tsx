import { Stage } from './canvas/Stage';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { LayersPanel } from './ui/LayersPanel';
import { Knob3DPanel } from './ui/Knob3DPanel';
import { LightPanel } from './ui/LightPanel';
import { Toolbar } from './ui/Toolbar';
import { useStore } from './app/store';

export function App() {
  const previewCpp = useStore((s) => s.previewCpp);

  return (
    <div className="app">
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
          <LightPanel />
          <PropertiesPanel />
          <LayersPanel />
          <Knob3DPanel />
        </aside>
      </div>
    </div>
  );
}
