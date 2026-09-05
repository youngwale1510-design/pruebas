// Modelo de datos del árbol de escena de Ghost UI Designer.
// Este tipo es EXACTAMENTE lo que se serializa al archivo de proyecto .ghostui
// y también lo que se embebe (por control) en los marcadores del .cpp.

import { KnobConfig } from './knobConfig';

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
  | 'glow'
  // materiales avanzados (paridad con el look del demo)
  | 'env'        // reflejo de entorno cielo/suelo
  | 'dish'       // iluminación direccional de la cara (abombado)
  | 'recess'     // pieza hundida: oclusión + sombra de contacto + labio
  | 'spun'       // brillo anisótropo de metal torneado
  | 'grooves'    // surcos concéntricos (torneado)
  | 'brushed'    // metal cepillado
  | 'specular'   // brillo especular nítido
  | 'rim'        // luz de borde / fresnel (el filo atrapa luz alrededor)
  | 'knurl'      // moleteado: cada estría con su brillo/sombra
  // realismo "producto" (grosor, contacto, cilindros, facetas, cromo, LEDs)
  | 'extrude'       // pared lateral: la pieza tiene altura (vista un poco desde arriba)
  | 'contactShadow' // oclusión corta y oscura donde la pieza apoya
  | 'cylinder'      // sombreado transversal de vástago/cápsula + tapa plana
  | 'facet'         // polígono con caras planas, cada una con su tono (tuerca)
  | 'chamfer'       // bisel escalonado en N anillos con borde duro
  | 'chrome'        // cromo: horizonte duro cielo/suelo + reflejo deformado
  | 'emissive'      // LED: núcleo caliente + bloom que tiñe lo de debajo
  | 'sheen';        // banda ancha y suave de luz (paneles, marcos)

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

export type LayerShape = 'ellipse' | 'rect' | 'roundRect' | 'scalloped' | 'polygon' | 'wedge' | 'ticks';

/** Anillo de marcas exteriores (escala del knob): puntos o líneas alrededor. */
export interface TicksConfig {
  count: number;      // nº de marcas
  style: 'dot' | 'line';
  radius: number;     // fracción del radio (0..1) donde se colocan
  spanDeg: number;    // arco total que cubren (p.ej. 270)
  size: number;       // tamaño del punto / largo de la línea (px)
}

/** Texto de una capa (etiquetas, marcas ON/OFF, nombre del plugin…). */
export interface TextStyle {
  content: string;
  /** Familia CSS; usa fuentes del sistema para que el editor y el PNG coincidan. */
  family: string;
  size: number;          // px
  weight: number;        // 100..900
  letterSpacing: number; // px
  align: 'left' | 'center' | 'right';
  /** Acabado: plano, grabado (hundido) o realzado. Respeta la luz global. */
  finish: 'flat' | 'engraved' | 'raised';
  /** 'solid' (por defecto, o si falta): el texto se pinta directo con
   *  `layer.fill`, como hasta ahora. 'mask': las letras se usan como MÁSCARA —
   *  `layer.fill` (o su textura, `layer.fillImage`) solo se ve DENTRO de los
   *  trazos del texto; el resto de la capa queda transparente. */
  fillMode?: 'solid' | 'mask';
}

/** Animación de la capa en función del valor del control (0..1). */
export interface LayerAnim {
  /** none: fija · rotate: gira (knob) · translate: se desplaza (switch deslizante,
   *  slider) · lever: palanca vista de frente, cápsula desde `pivotNorm` hasta
   *  la punta (la punta viaja `travel`; en el punto medio queda de canto). */
  mode: 'none' | 'rotate' | 'translate' | 'lever';
  minDeg?: number; // ángulo en value=0 (por defecto -135)
  maxDeg?: number; // ángulo en value=1 (por defecto  135)
  /** translate/lever: desplazamiento total (fracción del rect del control) entre
   *  value=0 y value=1. La posición en value=0 es la del rectNorm de la capa. */
  travel?: { x: number; y: number };
  /** lever: punto de giro (0..1 del control); por defecto el centro. */
  pivotNorm?: { x: number; y: number };
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
  /** Textura de relleno (data URI PNG importado). Tiene prioridad sobre `fill`. */
  fillImage?: string;
  /** Cómo encajar la textura: cubrir el rect o teselar. */
  fillImageMode?: 'cover' | 'tile';
  /** true si la textura se omitió del payload del .cpp (vive en el .ghostui). */
  fillImageEmbedded?: boolean;
  /** id de máscara (otra capa o asset) — opcional. */
  maskAssetId?: string;
  color?: Partial<ColorAdjust>;
  effects: Effect[];

  // --- Geometría de la capa (relativa al rect del control) ---
  shape?: LayerShape;
  /** Inset por lado como fracción de la dimensión menor (0..0.5). */
  inset?: number;
  /** Rect explícito en coordenadas normalizadas (0..1) del control; tiene
   *  prioridad sobre `inset`. Útil para indicadores/pointers. */
  rectNorm?: { x: number; y: number; w: number; h: number };
  cornerRadius?: number;
  /** nº de lóbulos para 'scalloped'. */
  lobes?: number;
  /** nº de lados para 'polygon'. */
  sides?: number;
  /** configuración de marcas para shape 'ticks'. */
  ticks?: TicksConfig;
  /** contenido y estilo si la capa es de texto (kind 'text'). */
  text?: TextStyle;
  anim?: LayerAnim;
}

/** Tipos de control nativos de iPlug2 soportados por el codegen. */
export type ControlType =
  | 'IVKnobControl'
  | 'IVSliderControl'
  | 'IVButtonControl'
  | 'IVToggleControl'
  | 'IBKnobControl'
  | 'IBSwitchControl' // filmstrip de N estados (switch deslizante, palanca, botón)
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
  /** Configuración del knob 3D (opción B con horneado 3D→filmstrip). Si está
   *  presente, el export hornea el filmstrip con el pipeline 3D. */
  knob3d?: KnobConfig;
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

/**
 * Caja de referencia: anotación puramente visual del editor (nunca se exporta
 * al .cpp ni cuenta como control). Sirve para marcar en el lienzo dónde va un
 * elemento que Ghost no diseña (un visualizador, un control hecho a mano,
 * etc.) para poder respetar su espacio al acomodar los controles reales.
 */
export interface RefBox {
  id: string;
  label: string;
  rect: Rect;
}

export interface LightSource {
  angleDeg: number; // dirección de la luz global (0 = derecha, 90 = abajo)
  intensity: number; // 0..1
  elev?: number; // altura 0..1 (rasante..cenital); por defecto 0.5
  fill?: number; // luz de relleno 0..1: levanta el lado en sombra (evita negro puro)
  /** Tinte de la luz (hex). Solo importa para luces adicionales (`lights[1..]`):
   *  la primera ("principal") sigue siendo la que orienta biseles/domos/sombras
   *  en blanco/gris; las demás se suman como un reflejo de borde (rim) tintado
   *  de este color, encima de todos los controles. */
  color?: string;
}

export interface SceneDocument {
  version: number;
  meta: { pluginName: string; author: string };
  canvas: { width: number; height: number; bg: string };
  /** Luces globales: `lights[0]` (la "principal") orienta biseles/domos/sombras de
   *  todos los controles, igual que antes; cualquier luz adicional se suma como
   *  un reflejo de borde tintado (ver `LightSource.color`). Nunca vacío en
   *  tiempo de ejecución (`renderControlFrame` usa un valor por defecto si lo
   *  estuviera). */
  lights: LightSource[];
  assets: { textures: TextureAsset[]; filmstrips: FilmstripAsset[] };
  params: ParamDef[];
  controls: Control[];
  /** Cajas de referencia (ver `RefBox`); opcional para no romper proyectos
   *  guardados antes de que existiera esta función. */
  refBoxes?: RefBox[];
}
