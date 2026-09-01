// Contrato compartido entre main y renderer para los canales IPC.
import type { Control, SceneDocument } from '../src/model/scene';

export interface GhostApi {
  /** Guarda la escena a un .ghostui (JSON). Devuelve la ruta o null si se cancela. */
  saveProject(scene: SceneDocument, suggestedPath?: string): Promise<string | null>;
  /** Abre un .ghostui y devuelve la escena. */
  openProject(): Promise<{ path: string; scene: SceneDocument } | null>;
  /** Genera/actualiza el .cpp en `path` preservando el código escrito a mano. */
  exportCpp(scene: SceneDocument, path: string): Promise<{ merged: boolean }>;
  /** Lee un .cpp y reconstruye los controles desde los marcadores. */
  importCpp(path: string): Promise<{ found: boolean; controls: Control[] }>;
  /** Vista previa del C++ generado (sin escribir a disco). */
  previewCpp(scene: SceneDocument, existingSource: string | null): Promise<string>;
}

export const IPC = {
  saveProject: 'ghost:saveProject',
  openProject: 'ghost:openProject',
  exportCpp: 'ghost:exportCpp',
  importCpp: 'ghost:importCpp',
  previewCpp: 'ghost:previewCpp',
} as const;
