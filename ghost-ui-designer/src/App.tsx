import { Stage } from './canvas/Stage';
import { PropertiesPanel } from './ui/PropertiesPanel';
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
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
