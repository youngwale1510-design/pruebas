// Compositor de un control: dibuja su pila de capas con efectos y animación por
// valor. Es la ÚNICA función que produce píxeles, usada tanto por el editor como
// por el rasterizador de filmstrips -> el editor se ve idéntico al plugin.

import { Control, Layer, SceneDocument } from '../model/scene';
import { applyEffectsAbove, applyEffectsBelow } from './effects';
import { LightVectors, resolveLight, rotateLight, rotationForValue } from './light';

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

function renderLayer(ctx: Ctx, w: number, h: number, layer: Layer, value: number, light: LightVectors) {
  if (!layer.visible) return;
  const box = layerBox(w, h, layer);
  const pathFn = (c: Ctx) => tracePath(c, box, layer);
  const rotate = layer.anim && layer.anim.mode === 'rotate';
  const deg = rotate ? rotationForValue(value, layer.anim!.minDeg ?? -135, layer.anim!.maxDeg ?? 135) : 0;

  // Sombra proyectada / glow en espacio FIJO (no giran con la pieza).
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  applyEffectsBelow(ctx, pathFn, layer.effects, light);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = COMPOSITE[layer.blendMode] ?? 'source-over';
  // La forma gira; la luz se contrarrota para quedar FIJA en el mundo.
  const L = rotate ? rotateLight(light, -deg) : light;
  if (rotate) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  }
  pathFn(ctx);
  ctx.fillStyle = layer.fill ?? '#333333';
  ctx.fill();
  applyEffectsAbove(ctx, pathFn, box, layer.effects, L);
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
