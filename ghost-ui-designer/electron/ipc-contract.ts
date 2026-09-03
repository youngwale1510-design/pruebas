// Contrato compartido entre main y renderer para los canales IPC.
import type { Control, SceneDocument } from '../src/model/scene';

/** PNG de filmstrip generado en el renderer (identidad visual garantizada). */
export interface FilmstripPng {
  controlId: string;
  file: string;
  frames: number;
  dataUri: string;
}

export interface GhostApi {
  /** Guarda la escena a un .ghostui (JSON). Devuelve la ruta o null si se cancela. */
  saveProject(scene: SceneDocument, suggestedPath?: string): Promise<string | null>;
  /** Abre un .ghostui y devuelve la escena. */
  openProject(): Promise<{ path: string; scene: SceneDocument } | null>;
  /** Genera/actualiza el .cpp en `path` preservando el código escrito a mano. */
  exportCpp(scene: SceneDocument, path: string): Promise<{ merged: boolean; headerFound: boolean; headerChanged: boolean }>;
  /** Abre un diálogo (o usa `path`) y reconstruye los controles desde los
   *  marcadores del .cpp. `null` si el usuario cancela. */
  importCpp(path?: string): Promise<{ path: string; found: boolean; controls: Control[] } | null>;
  /** Vista previa del C++ generado (sin escribir a disco). */
  previewCpp(scene: SceneDocument, existingSource: string | null): Promise<string>;
  /**
   * Exporta el bundle completo a un directorio elegido por el usuario:
   * <plugin>.cpp (round-trip), <plugin>_resources.h y resources/<control>.png.
   */
  exportBundle(
    scene: SceneDocument,
    assets: FilmstripPng[],
  ): Promise<{ dir: string; merged: boolean; headerFound: boolean; headerChanged: boolean } | null>;
  /** Abre una imagen del disco (textura o filmstrip) y la devuelve embebida como
   *  data URI + sus dimensiones. */
  importImage(): Promise<{ name: string; dataUri: string; width: number; height: number } | null>;
  /** Guarda un PNG (data URI) al disco vía diálogo. Devuelve la ruta o null. */
  saveImage(dataUri: string, suggestedName: string): Promise<string | null>;
}

export const IPC = {
  saveProject: 'ghost:saveProject',
  openProject: 'ghost:openProject',
  exportCpp: 'ghost:exportCpp',
  importCpp: 'ghost:importCpp',
  previewCpp: 'ghost:previewCpp',
  exportBundle: 'ghost:exportBundle',
  importImage: 'ghost:importImage',
  saveImage: 'ghost:saveImage',
} as const;
