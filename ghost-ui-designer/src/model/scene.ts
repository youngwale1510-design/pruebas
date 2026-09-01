// Modelo de datos del árbol de escena de Ghost UI Designer.
// Este tipo es EXACTAMENTE lo que se serializa al archivo de proyecto .ghostui
// y también lo que se embebe (por control) en los marcadores del .cpp.

export const GHOSTUI_VERSION = 1 as const;

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten';

export type EffectType =
  | 'dropShadow'
  | 'innerShadow'
  | 'bevel'
  | 'gradientOverlay'
  | 'noise'
  | 'glow';

export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  /** Parámetros específicos del efecto (offset, blur, color, ángulo, etc.). */
  params: Record<string, number | string | boolean>;
}

export type LayerKind = 'shape' | 'image' | 'texture' | 'text' | 'filmstrip';

export interface ColorAdjust {
  hue: number; // -180..180
  saturation: number; // -100..100
  brightness: number; // -100..100
  contrast: number; // -100..100
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  blendMode: BlendMode;
  opacity: number; // 0..1
  /** Relleno: color hex, id de textura embebida (asset:<id>) o gradiente. */
  fill?: string;
  /** id de máscara (otra capa o asset) — opcional. */
  maskAssetId?: string;
  color?: Partial<ColorAdjust>;
  effects: Effect[];
}

/** Tipos de control nativos de iPlug2 soportados por el codegen. */
export type ControlType =
  | 'IVKnobControl'
  | 'IVSliderControl'
  | 'IVButtonControl'
  | 'IBKnobControl'
  | 'IBitmapControl';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Control {
  id: string; // estable; usado en el marcador y en kCtrl_<id>
  type: ControlType;
  name: string; // etiqueta visible del control
  rect: Rect;
  /** id del parámetro vinculado (ver ParamDef). undefined = kNoParameter. */
  paramId?: string;
  /** Propiedades del control (bitmap/filmstrip asociado, estilo, nº de frames…). */
  props: Record<string, number | string | boolean>;
  layers: Layer[];
  effects: Effect[];
}

export interface ParamDef {
  id: string; // p.ej. "gain"  -> genera kGain
  name: string; // "Gain"
  type: 'double' | 'int' | 'bool' | 'enum';
  min: number;
  max: number;
  default: number;
  unit?: string;
}

export interface TextureAsset {
  id: string;
  name: string;
  /** data URI base64 autocontenido, p.ej. "data:image/png;base64,...". */
  dataUri: string;
  tileable: boolean;
}

export interface FilmstripAsset {
  id: string;
  name: string;
  dataUri: string;
  frames: number;
  orientation: 'horizontal' | 'vertical';
}

export interface LightSource {
  angleDeg: number; // dirección de la luz global (0 = derecha, 90 = abajo)
  intensity: number; // 0..1
}

export interface SceneDocument {
  version: number;
  meta: { pluginName: string; author: string };
  canvas: { width: number; height: number; bg: string };
  light: LightSource;
  assets: { textures: TextureAsset[]; filmstrips: FilmstripAsset[] };
  params: ParamDef[];
  controls: Control[];
}
