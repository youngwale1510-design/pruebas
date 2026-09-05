// Contrato compartido entre main y renderer para los canales IPC.
import type { Control, RefBox, SceneDocument } from '../src/model/scene';

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
   *  marcadores del .cpp — o, si el layout está en C++ plano (sin marcadores
   *  de Ghost), los reconstruye automáticamente: controles editables donde
   *  reconoce un knob/switch con parámetro, y cajas de referencia (`refBoxes`)
   *  para todo lo demás (texto fijo, visualizadores...). `fallbackWidth/Height`
   *  son el tamaño de lienzo a usar si no se encuentra un config.h junto al
   *  .cpp con PLUG_WIDTH/PLUG_HEIGHT. `null` si el usuario cancela. */
  importCpp(
    path?: string,
    fallbackWidth?: number,
    fallbackHeight?: number,
  ): Promise<{ path: string; found: boolean; controls: Control[]; refBoxes: RefBox[] } | null>;
  /** Vista previa del C++ generado (sin escribir a disco). */
  previewCpp(scene: SceneDocument, existingSource: string | null): Promise<string>;
  /**
   * Exporta el bundle completo a un directorio elegido por el usuario:
   * <plugin>.cpp (round-trip), <plugin>_resources.h y resources/<control>.png.
   */
  exportBundle(
    scene: SceneDocument,
    assets: FilmstripPng[],
  ): Promise<{
    dir: string;
    merged: boolean;
    headerFound: boolean;
    headerChanged: boolean;
    configFound: boolean;
    configChanged: boolean;
    /** true si se encontró resources/main.rc junto al bundle exportado. */
    rcFound: boolean;
    /** true si se le añadieron líneas PNG nuevas (ver `syncResourcesRc`). */
    rcChanged: boolean;
  } | null>;
  /** Abre una imagen del disco (textura o filmstrip) y la devuelve embebida como
   *  data URI + sus dimensiones. */
  importImage(): Promise<{ name: string; dataUri: string; width: number; height: number } | null>;
  /** Abre una fuente (.ttf/.otf/.woff/.woff2) y la devuelve embebida como data URI. */
  importFont(): Promise<{ name: string; dataUri: string } | null>;
  /** Guarda un PNG (data URI) al disco vía diálogo. Devuelve la ruta o null. */
  saveImage(dataUri: string, suggestedName: string): Promise<string | null>;
  /** Área útil de la pantalla principal (sin barra de tareas), para acotar el
   *  tamaño máximo ("100%") del lienzo del plugin. */
  getScreenSize(): Promise<{ width: number; height: number }>;
}

export const IPC = {
  saveProject: 'ghost:saveProject',
  openProject: 'ghost:openProject',
  exportCpp: 'ghost:exportCpp',
  importCpp: 'ghost:importCpp',
  previewCpp: 'ghost:previewCpp',
  exportBundle: 'ghost:exportBundle',
  importImage: 'ghost:importImage',
  importFont: 'ghost:importFont',
  saveImage: 'ghost:saveImage',
  getScreenSize: 'ghost:getScreenSize',
} as const;
