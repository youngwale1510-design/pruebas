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

/** Luz efectiva del efecto: usa su propio `angleDeg`/`lightIntensity` si los tiene
 *  (para tener varias luces/reflejos por capa), o la luz global por defecto. */
function effLight(e: Effect, light: LightVectors): LightVectors {
  const a = e.params['angleDeg'];
  if (typeof a === 'number') {
    const rad = (a * Math.PI) / 180;
    const inten = typeof e.params['lightIntensity'] === 'number' ? (e.params['lightIntensity'] as number) : light.intensity;
    return { ...light, dx: Math.cos(rad), dy: Math.sin(rad), intensity: inten };
  }
  return light;
}

/** Sombra proyectada por debajo del relleno de la capa. */
export function drawDropShadow(
  ctx: Ctx,
  pathFn: PathFn,
  e: Effect,
  light: LightVectors,
) {
  const dist = num(e, 'distance', 4) * (light.lenK ?? 1);
  const useLight = bool(e, 'useLight', true);
  const dx = useLight ? light.dx * dist : num(e, 'offsetX', dist);
  const dy = useLight ? light.dy * dist : num(e, 'offsetY', dist);
  ctx.save();
  ctx.shadowColor = str(e, 'color', 'rgba(0,0,0,0.5)');
  ctx.shadowBlur = num(e, 'blur', 8) + (1 - (light.elev ?? 0.5)) * 6;
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
  gl: LightVectors,
) {
  const light = effLight(e, gl);
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

  // 1) Reiluminado de la cara (la luz de relleno levanta el lado en sombra).
  const fill = light.fill ?? 0;
  const g = ctx.createLinearGradient(lx, ly, sx, sy);
  g.addColorStop(0, str(e, 'highlight', `rgba(255,255,255,${0.15 + 0.55 * inten})`));
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, str(e, 'shadow', `rgba(0,0,0,${(0.15 + 0.6 * inten) * (1 - 0.6 * fill)})`));
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
export function drawSpun(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  if (!ctx.createConicGradient) return;
  const light = effLight(e, gl);
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
export function drawDish(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2, inten = light.intensity;
  const fill = light.fill ?? 0;
  const off = r * num(e, 'offset', 0.4);
  const hx = cx - light.dx * off, hy = cy - light.dy * off;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 1.2);
  g.addColorStop(0, `rgba(255,255,255,${0.16 + 0.34 * inten})`);
  g.addColorStop(0.45, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${(0.22 + 0.3 * inten) * (1 - 0.7 * fill)})`); // relleno levanta la sombra
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // Luz de relleno: brillo tenue desde el lado opuesto a la luz.
  if (fill > 0) {
    const fx = cx + light.dx * off, fy = cy + light.dy * off;
    const gf = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 1.1);
    gf.addColorStop(0, `rgba(255,255,255,${0.06 + 0.22 * fill})`);
    gf.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gf;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}

/**
 * Reflejo/brillo hacia la luz, con tamaño y forma configurables:
 *  - size:   fracción del radio (qué tan grande es el reflejo)
 *  - aspect: 1 = redondo; >1 = alargado (streak) a lo largo del eje de la luz
 *  - dist:   0..1, distancia del reflejo desde el centro hacia la luz
 *  - strength: 0..1, intensidad del brillo
 */
export function drawSpecular(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  const inten = light.intensity;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  const size = num(e, 'size', 0.5);
  const aspect = Math.max(1, num(e, 'aspect', 1));
  const dist = num(e, 'dist', 0.55);
  const strength = num(e, 'strength', 1);
  const hx = cx - light.dx * r * dist, hy = cy - light.dy * r * dist;
  const angle = Math.atan2(light.dy, light.dx);
  const a0 = strength * (0.75 + 0.25 * inten);
  const a1 = strength * (0.35 + 0.2 * inten);

  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  // Se dibuja en un espacio local escalado para lograr el reflejo alargado.
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.scale(aspect, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * size);
  g.addColorStop(0, `rgba(255,255,255,${a0})`);
  g.addColorStop(0.18, `rgba(255,255,255,${a1})`);
  g.addColorStop(0.55, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Pieza hundida: oclusión de borde + sombra de contacto direccional + labio de luz. */
export function drawRecess(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
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

/** Luz de borde / fresnel: el filo atrapa luz alrededor, más fuerte del lado de
 *  la luz. Es la clave del look "producto" en plásticos oscuros. */
export function drawRim(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  const inten = light.intensity;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  const width = num(e, 'size', 3);
  const color = str(e, 'color', '255,255,255');
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  // 1) Fresnel tenue en todo el perímetro.
  ctx.lineWidth = width * 2;
  ctx.strokeStyle = `rgba(${color},${0.05 + 0.06 * inten})`;
  pathFn(ctx);
  ctx.stroke();
  // 2) Arco brillante del lado de la luz.
  const nx = cx - light.dx * r, ny = cy - light.dy * r, fx = cx + light.dx * r, fy = cy + light.dy * r;
  const g = ctx.createLinearGradient(nx, ny, fx, fy);
  g.addColorStop(0, `rgba(${color},${0.35 + 0.4 * inten})`);
  g.addColorStop(0.45, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.lineWidth = width * 2.2;
  ctx.strokeStyle = g;
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}

/** Moleteado: sombrea cada estría según la luz (surco a surco), no el contorno. */
export function drawKnurl(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors, lobesHint = 24) {
  const light = effLight(e, gl);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  const lobes = Math.max(6, Math.round(num(e, 'lobes', lobesHint)));
  const bandInner = r * (1 - num(e, 'depth', 0.16));
  const litAngle = Math.atan2(-light.dy, -light.dx); // dirección hacia la luz
  const strength = num(e, 'strength', 0.5);
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    // 1 cuando la estría mira a la luz, -1 cuando está en sombra.
    const facing = Math.cos(a - litAngle);
    const x0 = cx + Math.cos(a) * bandInner, y0 = cy + Math.sin(a) * bandInner;
    const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = (Math.PI * 2 * r) / lobes * 0.35;
    if (facing > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(255,255,255,${facing * strength * (0.4 + 0.4 * light.intensity)})`;
    } else {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = `rgba(0,0,0,${-facing * strength * 0.7})`;
    }
    ctx.stroke();
  }
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
  lobesHint = 24,
) {
  // Orden importa: material -> reflejo/torneado -> luz direccional -> bisel -> hueco -> ruido.
  const run = (type: EffectType, fn: (e: Effect) => void) => {
    for (const e of effects) if (e.enabled && e.type === type) fn(e);
  };
  run('gradientOverlay', (e) => drawGradientOverlay(ctx, pathFn, bounds, e));
  run('env', (e) => drawEnv(ctx, pathFn, bounds, e));
  run('grooves', (e) => drawGrooves(ctx, pathFn, bounds, e));
  run('brushed', () => drawBrushed(ctx, pathFn, bounds));
  run('knurl', (e) => drawKnurl(ctx, pathFn, bounds, e, light, lobesHint));
  run('spun', (e) => drawSpun(ctx, pathFn, bounds, e, light));
  run('dish', (e) => drawDish(ctx, pathFn, bounds, e, light));
  run('specular', (e) => drawSpecular(ctx, pathFn, bounds, e, light));
  run('bevel', (e) => drawBevel(ctx, pathFn, bounds, e, light));
  run('recess', (e) => drawRecess(ctx, pathFn, bounds, e, light));
  run('rim', (e) => drawRim(ctx, pathFn, bounds, e, light));
  run('innerShadow', (e) => drawInnerShadow(ctx, pathFn, bounds, e, light));
  run('noise', (e) => drawNoise(ctx, pathFn, bounds, e));
}
