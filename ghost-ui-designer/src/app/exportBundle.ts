// Construye los assets del bundle en el renderer (rasterización pixel-idéntica al
// editor) y delega la escritura a disco al proceso principal vía IPC.

import { SceneDocument } from '../model/scene';
import { exportControlFilmstrip, FilmstripPng } from '../render/dom';
import { bitmapFile, collectBitmapResources } from '../codegen/iplug2/resources';
import { Orientation } from '../render/filmstrip';

export function buildFilmstripAssets(scene: SceneDocument): FilmstripPng[] {
  const res = collectBitmapResources(scene);
  const byId = new Map(scene.controls.map((c) => [c.id, c]));
  return res.map((r) => {
    const c = byId.get(r.controlId)!;
    const orientation = (c.props.orientation as Orientation) ?? 'vertical';
    return exportControlFilmstrip(c, scene, r.frames, orientation, bitmapFile(c.id));
  });
}

export async function exportBundle(scene: SceneDocument) {
  const assets = buildFilmstripAssets(scene);
  return window.ghost.exportBundle(scene, assets);
}
