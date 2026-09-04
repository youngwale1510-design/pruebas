import { useStore } from '../app/store';

/** Alinear/distribuir/igualar tamaño entre varios controles (Shift+clic en el
 *  lienzo para seleccionar más de uno). Solo aparece con 2+ seleccionados. */
export function AlignPanel() {
  const selectedIds = useStore((s) => s.selectedIds);
  const alignSelected = useStore((s) => s.alignSelected);
  const distributeSelected = useStore((s) => s.distributeSelected);
  const matchSizeSelected = useStore((s) => s.matchSizeSelected);

  if (selectedIds.length < 2) return null;

  return (
    <div className="panel">
      <h3>Alinear ({selectedIds.length} seleccionados)</h3>
      <div className="row" style={{ gap: 4 }}>
        <button className="btn" title="Izquierda" onClick={() => alignSelected('left')}>⇤</button>
        <button className="btn" title="Centrar horizontal" onClick={() => alignSelected('hcenter')}>↔</button>
        <button className="btn" title="Derecha" onClick={() => alignSelected('right')}>⇥</button>
        <button className="btn" title="Arriba" onClick={() => alignSelected('top')}>⇧</button>
        <button className="btn" title="Centrar vertical" onClick={() => alignSelected('vmiddle')}>↕</button>
        <button className="btn" title="Abajo" onClick={() => alignSelected('bottom')}>⇩</button>
      </div>
      {selectedIds.length >= 3 && (
        <div className="row" style={{ gap: 4, marginTop: 6 }}>
          <button className="btn" onClick={() => distributeSelected('h')}>Distribuir ↔</button>
          <button className="btn" onClick={() => distributeSelected('v')}>Distribuir ↕</button>
        </div>
      )}
      <div className="row" style={{ gap: 4, marginTop: 6 }}>
        <button className="btn" onClick={() => matchSizeSelected('w')}>Igualar ancho</button>
        <button className="btn" onClick={() => matchSizeSelected('h')}>Igualar alto</button>
        <button className="btn" onClick={() => matchSizeSelected('both')}>Igualar ambos</button>
      </div>
      <p className="hint">La referencia (tamaño/borde a los que se ajustan los demás) es el primero que seleccionaste.</p>
    </div>
  );
}
