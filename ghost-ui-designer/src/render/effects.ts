// Motor de efectos no destructivos sobre Canvas2D.
// Cada efecto opera sobre la región de una capa ya trazada como path en `ctx`.
// Todas las funciones asumen que el path de la capa está disponible vía `pathFn`
// (que traza el contorno para poder usarlo como clip o como sombra).

import { Effect, EffectType } from '../model/scene';
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

/**
 * Bisel/emboss direccional. Reilumina toda la cara de la capa a lo largo del eje
 * de la luz (highlight en el lado iluminado, sombra en el opuesto) y remata el
 * borde con un rim direccional. La fuerza escala con la intensidad de la luz, de
 * modo que ángulo e intensidad tienen un efecto claramente visible.
 */
export function drawBevel(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  e: Effect,
  light: LightVectors,
) {
  const size = num(e, 'size', 3);
  const inten = light.intensity;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const r = Math.max(bounds.w, bounds.h) / 2;
  // (dx,dy) apunta DESDE la luz; el lado iluminado es el opuesto.
  const lx = cx - light.dx * r;
  const ly = cy - light.dy * r;
  const sx = cx + light.dx * r;
  const sy = cy + light.dy * r;

  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'source-atop';

  // 1) Reiluminado de la cara.
  const g = ctx.createLinearGradient(lx, ly, sx, sy);
  g.addColorStop(0, str(e, 'highlight', `rgba(255,255,255,${0.15 + 0.55 * inten})`));
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, str(e, 'shadow', `rgba(0,0,0,${0.15 + 0.6 * inten})`));
  ctx.fillStyle = g;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

  // 2) Rim del borde biselado.
  const gr = ctx.createLinearGradient(lx, ly, sx, sy);
  gr.addColorStop(0, `rgba(255,255,255,${0.2 + 0.5 * inten})`);
  gr.addColorStop(1, `rgba(0,0,0,${0.2 + 0.5 * inten})`);
  ctx.lineWidth = size;
  ctx.strokeStyle = gr;
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
  // putImageData ignora clip, rotación y escala del ctx; por eso el ruido se pinta
  // en un canvas auxiliar y se compone con drawImage, que sí los respeta.
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  const img = tctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = (amount * 255) | 0;
  }
  tctx.putImageData(img, 0, 0);
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(tmp, bounds.x, bounds.y, bounds.w, bounds.h);
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

type Box = { x: number; y: number; w: number; h: number };

/** Reflejo de entorno: cielo claro arriba, suelo oscuro abajo + horizonte. */
export function drawEnv(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect) {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  g.addColorStop(0, str(e, 'sky', 'rgba(255,255,255,0.6)'));
  g.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.5, str(e, 'horizon', 'rgba(0,0,0,0.25)'));
  g.addColorStop(0.64, 'rgba(0,0,0,0.06)');
  g.addColorStop(1, str(e, 'ground', 'rgba(0,0,0,0.55)'));
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Surcos concéntricos (metal torneado). */
export function drawGrooves(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect) {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rMax = Math.max(b.w, b.h) / 2;
  const step = num(e, 'step', 2.4);
  let k = 0;
  ctx.globalCompositeOperation = 'overlay';
  ctx.lineWidth = 1;
  for (let r = rMax; r > 1.5; r -= step, k++) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = k % 2 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)';
    ctx.stroke();
  }
  ctx.restore();
}

/** Metal cepillado: micro-rayas horizontales. */
export function drawBrushed(ctx: Ctx, pathFn: PathFn, b: Box) {
  const w = Math.max(1, Math.round(b.w)), h = Math.max(1, Math.round(b.h));
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const t = tmp.getContext('2d');
  if (!t) return;
  for (let y = 0; y < h; y++) {
    t.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.1})`;
    t.beginPath(); t.moveTo(0, y + 0.5); t.lineTo(w, y + 0.5); t.stroke();
  }
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(tmp, b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Brillo anisótropo de metal torneado (dos lóbulos alineados a la luz). */
export function drawSpun(ctx: Ctx, pathFn: PathFn, b: Box, light: LightVectors) {
  if (!ctx.createConicGradient) return;
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, inten = light.intensity;
  const cg = ctx.createConicGradient(Math.atan2(light.dy, light.dx), cx, cy);
  const hi = `rgba(255,255,255,${0.1 + 0.3 * inten})`, lo = `rgba(0,0,0,${0.1 + 0.3 * inten})`, z = 'rgba(0,0,0,0)';
  cg.addColorStop(0, hi); cg.addColorStop(0.12, z); cg.addColorStop(0.25, lo); cg.addColorStop(0.38, z);
  cg.addColorStop(0.5, hi); cg.addColorStop(0.62, z); cg.addColorStop(0.75, lo); cg.addColorStop(0.88, z);
  cg.addColorStop(1, hi);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = cg;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Domo: iluminación direccional de la cara (brilla hacia la luz). */
export function drawDish(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, light: LightVectors) {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2, inten = light.intensity;
  const off = r * num(e, 'offset', 0.4);
  const hx = cx - light.dx * off, hy = cy - light.dy * off;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 1.2);
  g.addColorStop(0, `rgba(255,255,255,${0.16 + 0.34 * inten})`);
  g.addColorStop(0.45, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.22 + 0.3 * inten})`);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Brillo especular nítido hacia la luz. */
export function drawSpecular(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, light: LightVectors) {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2, inten = light.intensity;
  const hx = cx - light.dx * r * 0.55, hy = cy - light.dy * r * 0.55;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * num(e, 'size', 0.5));
  g.addColorStop(0, `rgba(255,255,255,${0.75 + 0.25 * inten})`);
  g.addColorStop(0.18, `rgba(255,255,255,${0.35 + 0.2 * inten})`);
  g.addColorStop(0.55, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Pieza hundida: oclusión de borde + sombra de contacto direccional + labio de luz. */
export function drawRecess(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, light: LightVectors) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2, inten = light.intensity;
  const fx = cx + light.dx * r, fy = cy + light.dy * r, nx = cx - light.dx * r, ny = cy - light.dy * r;
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const v = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${num(e, 'depth', 0.6)})`);
  ctx.fillStyle = v;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const d = ctx.createLinearGradient(nx, ny, fx, fy);
  d.addColorStop(0.35, 'rgba(0,0,0,0)');
  d.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, 0.35 * inten + 0.1)})`);
  ctx.fillStyle = d;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
  ctx.save();
  const lip = ctx.createLinearGradient(nx, ny, fx, fy);
  lip.addColorStop(0, `rgba(255,255,255,${0.4 + 0.4 * inten})`);
  lip.addColorStop(0.4, 'rgba(255,255,255,0)');
  lip.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.lineWidth = num(e, 'lip', 2.2);
  ctx.strokeStyle = lip;
  pathFn(ctx);
  ctx.stroke();
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
  // Orden importa: material -> reflejo/torneado -> luz direccional -> bisel -> hueco -> ruido.
  const run = (type: EffectType, fn: (e: Effect) => void) => {
    for (const e of effects) if (e.enabled && e.type === type) fn(e);
  };
  run('gradientOverlay', (e) => drawGradientOverlay(ctx, pathFn, bounds, e));
  run('env', (e) => drawEnv(ctx, pathFn, bounds, e));
  run('grooves', (e) => drawGrooves(ctx, pathFn, bounds, e));
  run('brushed', () => drawBrushed(ctx, pathFn, bounds));
  run('spun', () => drawSpun(ctx, pathFn, bounds, light));
  run('dish', (e) => drawDish(ctx, pathFn, bounds, e, light));
  run('specular', (e) => drawSpecular(ctx, pathFn, bounds, e, light));
  run('bevel', (e) => drawBevel(ctx, pathFn, bounds, e, light));
  run('recess', (e) => drawRecess(ctx, pathFn, bounds, e, light));
  run('innerShadow', (e) => drawInnerShadow(ctx, pathFn, bounds, e, light));
  run('noise', (e) => drawNoise(ctx, pathFn, bounds, e));
}
