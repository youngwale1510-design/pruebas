// Compositor de un control: dibuja su pila de capas con efectos y animación por
// valor. Es la ÚNICA función que produce píxeles, usada tanto por el editor como
// por el rasterizador de filmstrips -> el editor se ve idéntico al plugin.

import { Control, Layer, LightSource, SceneDocument, TextStyle } from '../model/scene';
import { EffectHints, PathFn, applyEffectsAbove, applyEffectsBelow, drawRim } from './effects';
import { LightVectors, resolveLight, rotateLight, rotationForValue } from './light';
import { parseColor } from './color';
import { ImageCache, drawImageCover } from './textures';

/** Luz por defecto si la escena no trae ninguna (proyectos vacíos/corruptos). */
const DEFAULT_LIGHT: LightSource = { angleDeg: 120, intensity: 0.7 };

type Ctx = CanvasRenderingContext2D;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const COMPOSITE: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
};

/** Caja de la capa dentro del control. `rectNorm` tiene prioridad; si no, inset
 *  simétrico. Función pura. */
export function layerBox(w: number, h: number, layer: Layer): Box {
  if (layer.rectNorm) {
    const r = layer.rectNorm;
    return { x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h };
  }
  const inset = (layer.inset ?? 0) * Math.min(w, h);
  return { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2 };
}

/** Desplazamiento (px) de una capa animada por translate/lever para `value`. Puro. */
export function travelOffset(w: number, h: number, layer: Layer, value: number): { dx: number; dy: number } {
  const a = layer.anim;
  if (!a || (a.mode !== 'translate' && a.mode !== 'lever') || !a.travel) return { dx: 0, dy: 0 };
  return { dx: a.travel.x * w * value, dy: a.travel.y * h * value };
}

/** Geometría de una palanca: cápsula desde el pivote hasta la punta. Puro. */
export function leverGeometry(w: number, h: number, layer: Layer, value: number) {
  const box = layerBox(w, h, layer);
  const off = travelOffset(w, h, layer, value);
  const p = layer.anim?.pivotNorm ?? { x: 0.5, y: 0.5 };
  const pivot = { x: p.x * w, y: p.y * h };
  const tip = { x: box.x + box.w / 2 + off.dx, y: box.y + box.h / 2 + off.dy };
  const r = Math.min(box.w, box.h) / 2;
  const bounds: Box = {
    x: Math.min(pivot.x, tip.x) - r,
    y: Math.min(pivot.y, tip.y) - r,
    w: Math.abs(tip.x - pivot.x) + r * 2,
    h: Math.abs(tip.y - pivot.y) + r * 2,
  };
  return { pivot, tip, r, bounds };
}

function traceCapsule(ctx: Ctx, a: { x: number; y: number }, b: { x: number; y: number }, r: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang - Math.PI / 2);
  ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

function tracePath(ctx: Ctx, box: Box, layer: Layer) {
  const shape = layer.shape ?? 'ellipse';
  ctx.beginPath();
  if (shape === 'ellipse') {
    ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  } else if (shape === 'roundRect') {
    const r = layer.cornerRadius ?? 6;
    const { x, y, w, h } = box;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else if (shape === 'scalloped') {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rx = box.w / 2, ry = box.h / 2;
    const lobes = layer.lobes ?? 12, depth = 0.05, steps = 200;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const rr = 1 - depth * (0.5 + 0.5 * Math.cos(lobes * t));
      const px = cx + Math.cos(t) * rx * rr, py = cy + Math.sin(t) * ry * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'polygon') {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rx = box.w / 2, ry = box.h / 2;
    const n = layer.sides ?? 6;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'wedge') {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rx = box.w / 2, ry = box.h / 2;
    ctx.moveTo(cx - rx * 0.5, cy);
    ctx.quadraticCurveTo(cx - rx, cy - ry * 0.2, cx - rx * 0.28, cy - ry * 0.5);
    ctx.lineTo(cx, cy - ry * 1.15);
    ctx.lineTo(cx + rx * 0.28, cy - ry * 0.5);
    ctx.quadraticCurveTo(cx + rx, cy - ry * 0.2, cx + rx * 0.5, cy);
    ctx.quadraticCurveTo(cx + rx * 0.7, cy + ry * 0.75, cx, cy + ry * 0.8);
    ctx.quadraticCurveTo(cx - rx * 0.7, cy + ry * 0.75, cx - rx * 0.5, cy);
    ctx.closePath();
  } else {
    ctx.rect(box.x, box.y, box.w, box.h);
  }
}

/** Anillo de marcas exteriores (escala del knob). Estáticas por defecto. */
function drawTicks(ctx: Ctx, w: number, h: number, layer: Layer) {
  const t = layer.ticks;
  if (!t) return;
  const cx = w / 2, cy = h / 2;
  const R = (Math.min(w, h) / 2) * (t.radius ?? 0.92);
  const count = Math.max(2, Math.round(t.count ?? 11));
  const spanRad = ((t.spanDeg ?? 270) * Math.PI) / 180;
  const color = layer.fill ?? '#c9c9d0';
  const size = t.size ?? 3;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const frac = count <= 1 ? 0 : i / (count - 1);
    // centradas arriba, hueco abajo (como un knob real)
    const ang = -Math.PI / 2 - spanRad / 2 + spanRad * frac;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    if ((t.style ?? 'dot') === 'line') {
      ctx.lineWidth = Math.max(1, size * 0.5);
      ctx.beginPath();
      ctx.moveTo(cx + cos * R, cy + sin * R);
      ctx.lineTo(cx + cos * (R - size * 1.6), cy + sin * (R - size * 1.6));
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx + cos * R, cy + sin * R, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Dibuja `content` letra por letra respetando `letterSpacing` (no todos los
 *  navegadores lo aplican con `ctx.fillText` directo). `paint(ch, cx)` pinta
 *  un carácter en el x ya resuelto (com dx/dy propios, si hacen falta). */
function forEachChar(
  ctx: Ctx,
  content: string,
  x: number,
  align: TextStyle['align'],
  spacing: number,
  paint: (ch: string, cx: number) => void,
) {
  if (spacing === 0) { paint(content, x); return; }
  const chars = [...content];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { paint(c, cx); cx += widths[i] + spacing; });
  ctx.textAlign = prevAlign;
}

/** Texto de una capa. El acabado grabado/realzado usa la luz global, así que
 *  las etiquetas se integran con el resto del panel. */
function drawTextSolid(ctx: Ctx, w: number, h: number, layer: Layer, light: LightVectors) {
  const t = layer.text!;
  const box = layerBox(w, h, layer);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.font = `${t.weight} ${t.size}px ${t.family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = t.align;
  const x = t.align === 'left' ? box.x : t.align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const y = box.y + box.h / 2;
  const spacing = t.letterSpacing || 0;
  const put = (dx: number, dy: number, color: string) => {
    ctx.fillStyle = color;
    forEachChar(ctx, t.content, x, t.align, spacing, (ch, cx) => ctx.fillText(ch, cx + dx, y + dy));
  };
  const d = Math.max(1, t.size * 0.06);
  const inten = 0.35 + 0.45 * light.intensity;
  if (t.finish === 'engraved') {
    // Hundido: sombra hacia la luz, brillo en el lado opuesto.
    put(light.dx * d, light.dy * d, `rgba(255,255,255,${inten * 0.7})`);
    put(-light.dx * d, -light.dy * d, `rgba(0,0,0,${inten})`);
  } else if (t.finish === 'raised') {
    put(light.dx * d, light.dy * d, `rgba(0,0,0,${inten})`);
    put(-light.dx * d, -light.dy * d, `rgba(255,255,255,${inten * 0.7})`);
  }
  put(0, 0, layer.fill ?? '#e8e9ec');
  ctx.restore();
}

/** Pinta el alfa de las letras de `t` (color irrelevante, solo la forma) —
 *  usado como máscara para recortar un relleno con `destination-in`. */
function paintTextGlyphs(ctx: Ctx, box: Box, t: TextStyle) {
  ctx.font = `${t.weight} ${t.size}px ${t.family}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = t.align;
  ctx.fillStyle = '#000';
  const x = t.align === 'left' ? box.x : t.align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const y = box.y + box.h / 2;
  forEachChar(ctx, t.content, x, t.align, t.letterSpacing || 0, (ch, cx) => ctx.fillText(ch, cx, y));
}

/** Texto "máscara": el relleno de la capa (color o textura) solo se ve DENTRO
 *  de los trazos del texto — el resto de la capa queda transparente. Misma
 *  técnica (`destination-in`) que ya se usa para recortar efectos al alfa
 *  real de una imagen importada. */
function drawTextMask(ctx: Ctx, w: number, h: number, layer: Layer, images?: ImageCache) {
  const t = layer.text!;
  const box = layerBox(w, h, layer);
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w));
  off.height = Math.max(1, Math.round(h));
  const octx = off.getContext('2d')!;

  const tex = layer.fillImage && images ? images[layer.fillImage] : undefined;
  if (tex) {
    if ((layer.fillImageMode ?? 'cover') === 'tile') {
      const pat = octx.createPattern(tex, 'repeat');
      if (pat) { octx.fillStyle = pat; octx.fillRect(box.x, box.y, box.w, box.h); }
    } else {
      drawImageCover(octx, tex, box);
    }
  } else {
    octx.fillStyle = layer.fill ?? '#e8e9ec';
    octx.fillRect(box.x, box.y, box.w, box.h);
  }

  // OJO: con letterSpacing hay VARIOS fillText (uno por carácter). Si se
  // pintaran directo con `destination-in` activo, cada letra recortaría el
  // resultado de la ANTERIOR (la intersección de letras que no se solapan es
  // vacía) y no quedaría nada. Por eso la máscara se arma completa en un
  // canvas aparte (composición normal) y se aplica de una sola vez.
  const mask = document.createElement('canvas');
  mask.width = off.width;
  mask.height = off.height;
  paintTextGlyphs(mask.getContext('2d')!, box, t);
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

function drawText(ctx: Ctx, w: number, h: number, layer: Layer, light: LightVectors, images?: ImageCache) {
  const t = layer.text;
  if (!t || !t.content) return;
  if (t.fillMode === 'mask') drawTextMask(ctx, w, h, layer, images);
  else drawTextSolid(ctx, w, h, layer, light);
}

/** Pinta el reflejo de borde (rim) de una luz ADICIONAL (todo lo que no sea
 *  `scene.lights[0]`): tintado con su color, sumado (`screen`) encima de lo
 *  que ya se pintó. La luz principal sigue siendo la única que orienta
 *  biseles/domos/sombras — esto es puramente un acento de color extra. */
function applyExtraLights(ctx: Ctx, pathFn: PathFn, box: Box, extraLights: LightSource[], rotationDeg: number) {
  for (const ls of extraLights) {
    const gl = resolveLight(ls);
    if (gl.intensity <= 0) continue;
    const L = rotationDeg ? rotateLight(gl, -rotationDeg) : gl;
    const color = parseColor(ls.color, [255, 255, 255]).join(',');
    drawRim(ctx, pathFn, box, { id: 'auto-extra-light', type: 'rim', enabled: true, params: { size: 3, color } }, L);
  }
}

function renderLayer(
  ctx: Ctx,
  w: number,
  h: number,
  layer: Layer,
  value: number,
  light: LightVectors,
  images?: ImageCache,
  extraLights: LightSource[] = [],
) {
  if (!layer.visible) return;
  if (layer.shape === 'ticks') { drawTicks(ctx, w, h, layer); return; }
  if (layer.kind === 'text') { drawText(ctx, w, h, layer, light, images); return; }
  const mode = layer.anim?.mode ?? 'none';
  const rotate = mode === 'rotate';
  const deg = rotate ? rotationForValue(value, layer.anim!.minDeg ?? -135, layer.anim!.maxDeg ?? 135) : 0;

  let box = layerBox(w, h, layer);
  let pathFn = (c: Ctx) => tracePath(c, box, layer);
  const hints: EffectHints = { lobes: layer.lobes ?? 24, sides: layer.sides ?? 6, fill: layer.fill, value };
  if (mode === 'lever') {
    // Palanca de frente: cápsula pivote→punta. En el centro del recorrido la
    // punta coincide con el pivote y solo se ve el remate (apunta a la cámara).
    const g = leverGeometry(w, h, layer, value);
    box = g.bounds;
    pathFn = (c: Ctx) => traceCapsule(c, g.pivot, g.tip, g.r);
    hints.tip = g.tip;
    hints.pivot = g.pivot;
    hints.r = g.r;
    const len = Math.hypot(g.tip.x - g.pivot.x, g.tip.y - g.pivot.y);
    hints.axisRad = len > 0.5 ? Math.atan2(g.tip.y - g.pivot.y, g.tip.x - g.pivot.x) : Math.PI / 2;
  } else if (mode === 'translate') {
    const off = travelOffset(w, h, layer, value);
    box = { ...box, x: box.x + off.dx, y: box.y + off.dy };
  }

  const tex = layer.fillImage && images ? images[layer.fillImage] : undefined;
  // Para una imagen importada, la sombra/glow deben salir de su transparencia
  // REAL, no del rect/forma vectorial que solo delimita el control en el
  // lienzo. `paintTex` dibuja la imagen (recortada a la forma) mientras las
  // sombras están activas, así el canvas las calcula a partir del alfa real.
  const isTile = (layer.fillImageMode ?? 'cover') === 'tile';
  const paintTex: PathFn | undefined = tex
    ? (c: Ctx) => {
        c.save();
        pathFn(c);
        c.clip();
        if (isTile) {
          const pat = c.createPattern(tex, 'repeat');
          if (pat) { c.fillStyle = pat; c.fillRect(box.x, box.y, box.w, box.h); }
        } else {
          drawImageCover(c, tex, box);
        }
        c.restore();
      }
    : undefined;

  // Sombra proyectada / glow en espacio FIJO (no giran con la pieza).
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  applyEffectsBelow(ctx, pathFn, layer.effects, light, box, hints, paintTex);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = COMPOSITE[layer.blendMode] ?? 'source-over';
  // La forma gira; la luz se contrarrota para quedar FIJA en el mundo.
  // Sentido: valor creciente = horario pasando por ARRIBA (como un knob real):
  // value 0 → indicador a las 7, value 1 → a las 5. En canvas (Y hacia abajo)
  // ctx.rotate(+θ) es horario, así que se aplica deg tal cual y la luz gira -deg.
  const L = rotate ? rotateLight(light, -deg) : light;
  if (rotate) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  }
  if (tex && paintTex) {
    // El relleno y los efectos "de encima" (bisel, cromo, moleteado…) se
    // pintan en un lienzo aparte y se recortan por la transparencia REAL del
    // PNG (destination-in), no solo por la forma: así un logo redondo con
    // esquinas transparentes no se biselea por fuera de su propio contorno.
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    const octx = off.getContext('2d')!;
    paintTex(octx);
    applyEffectsAbove(octx, pathFn, box, layer.effects, L, hints);
    if (extraLights.length > 0) applyExtraLights(octx, pathFn, box, extraLights, deg);
    octx.globalCompositeOperation = 'destination-in';
    paintTex(octx);
    octx.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, 0, 0);
  } else {
    pathFn(ctx);
    ctx.fillStyle = layer.fill ?? '#333333';
    ctx.fill();
    applyEffectsAbove(ctx, pathFn, box, layer.effects, L, hints);
    if (extraLights.length > 0) applyExtraLights(ctx, pathFn, box, extraLights, deg);
  }
  ctx.restore();
}

/**
 * Tamaño real del frame: el rect del control más el margen (`props.pad`) que deja
 * sitio a sombras y halos. Sin él, el filmstrip corta la sombra por el borde.
 * El control se ancla en (x - pad, y - pad) para que la pieza no se mueva. Puro.
 */
export function frameSize(control: Control): { w: number; h: number; pad: number } {
  const pad = Math.max(0, Math.round(Number(control.props.pad ?? 0) || 0));
  return { w: control.rect.w + pad * 2, h: control.rect.h + pad * 2, pad };
}

/** Controles por pasos (switches): el valor se cuantiza a N estados. Puro. */
export function snapValue(control: Control, value: number): number {
  if (control.type !== 'IBSwitchControl') return value;
  const n = Math.max(2, Math.round(Number(control.props.frames ?? 2) || 2));
  return Math.round(value * (n - 1)) / (n - 1);
}

/**
 * Dibuja un frame del control en el sistema de coordenadas del control
 * (origen 0,0; tamaño rect.w x rect.h). `value` en 0..1.
 */
export function renderControlFrame(
  ctx: Ctx,
  control: Control,
  scene: SceneDocument,
  value: number,
  images?: ImageCache,
) {
  const { w, h } = control.rect;
  const { pad } = frameSize(control);
  const lights = scene.lights && scene.lights.length > 0 ? scene.lights : [DEFAULT_LIGHT];
  const light = resolveLight(lights[0]);
  const extraLights = lights.slice(1);
  value = snapValue(control, value);
  // Todo se dibuja en coordenadas del rect; el margen solo desplaza el origen.
  ctx.save();
  if (pad) ctx.translate(pad, pad);
  // Margen del cuerpo: encoge todas las capas (menos las marcas) hacia el centro
  // para dejar sitio a las marcas exteriores. Fracción 0..0.4.
  const bodyInset = Math.max(0, Math.min(0.4, Number(control.props.bodyInset ?? 0) || 0));
  const s = 1 - 2 * bodyInset;
  for (const layer of control.layers) {
    if (layer.shape === 'ticks' || s >= 1) { renderLayer(ctx, w, h, layer, value, light, images, extraLights); continue; }
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -h / 2);
    renderLayer(ctx, w, h, layer, value, light, images, extraLights);
    ctx.restore();
  }
  ctx.restore();
}
