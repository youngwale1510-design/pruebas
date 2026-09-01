// Compositor de un control: dibuja su pila de capas con efectos y animación por
// valor. Es la ÚNICA función que produce píxeles, usada tanto por el editor como
// por el rasterizador de filmstrips -> el editor se ve idéntico al plugin.

import { Control, Layer, SceneDocument } from '../model/scene';
import { applyEffectsAbove, applyEffectsBelow } from './effects';
import { LightVectors, resolveLight, rotationForValue } from './light';

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
  } else {
    ctx.rect(box.x, box.y, box.w, box.h);
  }
}

function renderLayer(ctx: Ctx, w: number, h: number, layer: Layer, value: number, light: LightVectors) {
  if (!layer.visible) return;
  const box = layerBox(w, h, layer);
  const pathFn = (c: Ctx) => tracePath(c, box, layer);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = COMPOSITE[layer.blendMode] ?? 'source-over';

  // Rotación animada alrededor del centro del control.
  if (layer.anim && layer.anim.mode === 'rotate') {
    const deg = rotationForValue(value, layer.anim.minDeg ?? -135, layer.anim.maxDeg ?? 135);
    ctx.translate(w / 2, h / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  }

  applyEffectsBelow(ctx, pathFn, layer.effects, light);
  pathFn(ctx);
  ctx.fillStyle = layer.fill ?? '#333333';
  ctx.fill();
  applyEffectsAbove(ctx, pathFn, box, layer.effects, light);

  ctx.restore();
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
) {
  const { w, h } = control.rect;
  const light = resolveLight(scene.light);
  for (const layer of control.layers) renderLayer(ctx, w, h, layer, value, light);
}
