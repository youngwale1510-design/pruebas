// Construye los assets del bundle en el renderer y delega la escritura a disco al
// proceso principal vía IPC. Cada control bitmap se hornea:
//  - con el pipeline 3D→filmstrip si el control tiene `knob3d` (look realista),
//  - o con el compositor 2D en caso contrario.

import { SceneDocument } from '../model/scene';
import { exportControlFilmstrip, FilmstripPng } from '../render/dom';
import { bitmapFile, collectBitmapResources, controlFrames } from '../codegen/iplug2/resources';
import { Orientation } from '../render/filmstrip';
import { bakeKnobFilmstrip } from '../render3d/bake';
import { preloadTextures } from '../render/textures';

export async function buildFilmstripAssets(scene: SceneDocument): Promise<FilmstripPng[]> {
  const res = collectBitmapResources(scene);
  const byId = new Map(scene.controls.map((c) => [c.id, c]));
  const images = await preloadTextures(scene); // texturas de capas (2D)
  return res.map((r) => {
    const c = byId.get(r.controlId)!;
    // 1) Filmstrip importado por el usuario (Photoshop, Blender, etc.) — máxima prioridad.
    const imported = c.props.filmstripDataUri as string | undefined;
    if (imported) {
      return { controlId: c.id, file: bitmapFile(c.id), frames: r.frames, dataUri: imported };
    }
    // 2) Horneado 3D (opcional).
    if (c.knob3d) {
      const frameSize = Math.max(64, Math.round(Math.max(c.rect.w, c.rect.h)));
      const baked = bakeKnobFilmstrip(c.knob3d, frameSize, 2);
      return { controlId: c.id, file: bitmapFile(c.id), frames: baked.frames, dataUri: baked.dataUri };
    }
    // 3) Compositor 2D (con texturas de capa).
    const orientation = (c.props.orientation as Orientation) ?? 'vertical';
    return exportControlFilmstrip(c, scene, r.frames, orientation, bitmapFile(c.id), images);
  });
}

export async function exportBundle(scene: SceneDocument) {
  const assets = await buildFilmstripAssets(scene);
  return window.ghost.exportBundle(scene, assets);
}

/** Genera el filmstrip de UN control y lo guarda como PNG (diálogo). */
export async function exportControlFilmstripPng(scene: SceneDocument, controlId: string) {
  const c = scene.controls.find((x) => x.id === controlId);
  if (!c) return null;
  const frames = controlFrames(c);
  let dataUri: string;
  const imported = c.props.filmstripDataUri as string | undefined;
  if (imported) {
    dataUri = imported;
  } else if (c.knob3d) {
    const frameSize = Math.max(64, Math.round(Math.max(c.rect.w, c.rect.h)));
    dataUri = bakeKnobFilmstrip(c.knob3d, frameSize, 2).dataUri;
  } else {
    const images = await preloadTextures([c]);
    const orientation = (c.props.orientation as Orientation) ?? 'vertical';
    dataUri = exportControlFilmstrip(c, scene, frames, orientation, bitmapFile(c.id), images).dataUri;
  }
  return window.ghost.saveImage(dataUri, bitmapFile(c.id));
}
