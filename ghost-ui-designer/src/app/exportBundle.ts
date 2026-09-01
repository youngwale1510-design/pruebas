// Construye los assets del bundle en el renderer y delega la escritura a disco al
// proceso principal vía IPC. Cada control bitmap se hornea:
//  - con el pipeline 3D→filmstrip si el control tiene `knob3d` (look realista),
//  - o con el compositor 2D en caso contrario.

import { SceneDocument } from '../model/scene';
import { exportControlFilmstrip, FilmstripPng } from '../render/dom';
import { bitmapFile, collectBitmapResources } from '../codegen/iplug2/resources';
import { Orientation } from '../render/filmstrip';
import { bakeKnobFilmstrip } from '../render3d/bake';

export function buildFilmstripAssets(scene: SceneDocument): FilmstripPng[] {
  const res = collectBitmapResources(scene);
  const byId = new Map(scene.controls.map((c) => [c.id, c]));
  return res.map((r) => {
    const c = byId.get(r.controlId)!;
    if (c.knob3d) {
      // Horneado 3D de alta calidad (frameSize por el lado mayor del rect).
      const frameSize = Math.max(64, Math.round(Math.max(c.rect.w, c.rect.h)));
      const baked = bakeKnobFilmstrip(c.knob3d, frameSize, 2);
      return { controlId: c.id, file: bitmapFile(c.id), frames: baked.frames, dataUri: baked.dataUri };
    }
    const orientation = (c.props.orientation as Orientation) ?? 'vertical';
    return exportControlFilmstrip(c, scene, r.frames, orientation, bitmapFile(c.id));
  });
}

export async function exportBundle(scene: SceneDocument) {
  const assets = buildFilmstripAssets(scene);
  return window.ghost.exportBundle(scene, assets);
}
