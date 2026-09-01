// Motor de efectos no destructivos sobre Canvas2D.
// Cada efecto opera sobre la región de una capa ya trazada como path en `ctx`.
// Todas las funciones asumen que el path de la capa está disponible vía `pathFn`
// (que traza el contorno para poder usarlo como clip o como sombra).

import { Effect } from '../model/scene';
import { LightVectors } from './light';

type Ctx = CanvasRenderingContext2D;
type PathFn = (ctx: Ctx) => void;

function num(e: Effect, k: string, d: number): number {
  const v = e.params[k];
  return typeof v === 'number' ? v : d;
}
function str(e: Effect, k: string, d: string): string {
  const v = e.params[k];
  return typeof v === 'string' ? v : d;
}
function bool(e: Effect, k: string, d: boolean): boolean {
  const v = e.params[k];
  return typeof v === 'boolean' ? v : d;
}

/** Sombra proyectada por debajo del relleno de la capa. */
export function drawDropShadow(
  ctx: Ctx,
  pathFn: PathFn,
  e: Effect,
  light: LightVectors,
) {
  const dist = num(e, 'distance', 4);
  const useLight = bool(e, 'useLight', true);
  const dx = useLight ? light.dx * dist : num(e, 'offsetX', dist);
  const dy = useLight ? light.dy * dist : num(e, 'offsetY', dist);
  ctx.save();
  ctx.shadowColor = str(e, 'color', 'rgba(0,0,0,0.5)');
  ctx.shadowBlur = num(e, 'blur', 8);
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  pathFn(ctx);
  ctx.fill();
  ctx.restore();
}

/** Sombra interior: oscurece el borde interno del lado opuesto a la luz. */
export function drawInnerShadow(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  e: Effect,
  light: LightVectors,
) {
  const blur = num(e, 'blur', 6);
  const color = str(e, 'color', 'rgba(0,0,0,0.6)');
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  // Truco: sombra proyectada de un path invertido -> queda dentro del clip.
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = light.dx * num(e, 'distance', 3);
  ctx.shadowOffsetY = light.dy * num(e, 'distance', 3);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  ctx.rect(bounds.x - blur * 2, bounds.y - blur * 2, bounds.w + blur * 4, bounds.h + blur * 4);
  pathFn(ctx); // subpath interior
  ctx.fill('evenodd');
  ctx.restore();
}

/** Bisel/emboss: highlight en el lado de la luz, sombra en el opuesto. */
export function drawBevel(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  e: Effect,
  light: LightVectors,
) {
  const size = num(e, 'size', 3);
  const hi = str(e, 'highlight', 'rgba(255,255,255,0.45)');
  const lo = str(e, 'shadow', 'rgba(0,0,0,0.45)');
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const r = Math.max(bounds.w, bounds.h);
  const g = ctx.createLinearGradient(
    cx - light.dx * r,
    cy - light.dy * r,
    cx + light.dx * r,
    cy + light.dy * r,
  );
  g.addColorStop(0, hi);
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, lo);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineWidth = size * 2;
  ctx.strokeStyle = g;
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}

/** Overlay de gradiente dentro de la capa. */
export function drawGradientOverlay(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  e: Effect,
) {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const type = str(e, 'type', 'linear');
  const from = str(e, 'from', 'rgba(255,255,255,0.2)');
  const to = str(e, 'to', 'rgba(0,0,0,0.2)');
  let g: CanvasGradient;
  if (type === 'radial') {
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(bounds.w, bounds.h) / 2);
  } else {
    g = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
  }
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
}

/** Grano/ruido monocromo dentro de la capa. */
export function drawNoise(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  e: Effect,
) {
  const amount = num(e, 'amount', 0.08);
  const w = Math.max(1, Math.round(bounds.w));
  const h = Math.max(1, Math.round(bounds.h));
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = (amount * 255) | 0;
  }
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.putImageData(img, Math.round(bounds.x), Math.round(bounds.y));
  ctx.restore();
}

/** Resplandor exterior. */
export function drawGlow(ctx: Ctx, pathFn: PathFn, e: Effect) {
  ctx.save();
  ctx.shadowColor = str(e, 'color', 'rgba(120,180,255,0.7)');
  ctx.shadowBlur = num(e, 'blur', 12);
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  pathFn(ctx);
  ctx.fill();
  ctx.restore();
}

/** Aplica los efectos de una capa que van DEBAJO del relleno (sombras/glow). */
export function applyEffectsBelow(
  ctx: Ctx,
  pathFn: PathFn,
  effects: Effect[],
  light: LightVectors,
) {
  for (const e of effects) {
    if (!e.enabled) continue;
    if (e.type === 'dropShadow') drawDropShadow(ctx, pathFn, e, light);
    else if (e.type === 'glow') drawGlow(ctx, pathFn, e);
  }
}

/** Aplica los efectos que van ENCIMA del relleno (bisel, overlays, inner shadow, ruido). */
export function applyEffectsAbove(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  effects: Effect[],
  light: LightVectors,
) {
  for (const e of effects) {
    if (!e.enabled) continue;
    if (e.type === 'gradientOverlay') drawGradientOverlay(ctx, pathFn, bounds, e);
    else if (e.type === 'bevel') drawBevel(ctx, pathFn, bounds, e, light);
    else if (e.type === 'innerShadow') drawInnerShadow(ctx, pathFn, bounds, e, light);
    else if (e.type === 'noise') drawNoise(ctx, pathFn, bounds, e);
  }
}
