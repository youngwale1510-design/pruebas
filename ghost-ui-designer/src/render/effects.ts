// Motor de efectos no destructivos sobre Canvas2D.
// Cada efecto opera sobre la región de una capa ya trazada como path en `ctx`.
// Todas las funciones asumen que el path de la capa está disponible vía `pathFn`
// (que traza el contorno para poder usarlo como clip o como sombra).

import { Effect, EffectType } from '../model/scene';
import { LightVectors } from './light';
import { parseColor, rgba, shade } from './color';

/** Datos extra que el compositor pasa a los efectos (geometría/relleno de la capa). */
export interface EffectHints {
  lobes?: number;             // estrías (knurl)
  sides?: number;             // lados del polígono (facet)
  fill?: string;              // color de relleno de la capa (extrude, cylinder)
  axisRad?: number;           // eje del cilindro (rad); por defecto el lado largo
  tip?: { x: number; y: number }; // palanca: extremo donde va la tapa
  pivot?: { x: number; y: number }; // palanca: punto de giro
  r?: number;                 // palanca: radio de la cápsula
  value?: number;             // valor del control (emissive followValue)
}

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


/** Pared lateral: la pieza tiene altura. Copias del contorno desplazadas hacia
 *  abajo con sombreado lateral según la luz. Va DEBAJO del relleno. */
export function drawExtrude(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors, fill?: string) {
  const light = effLight(e, gl);
  const height = Math.max(1, Math.round(num(e, 'height', 4) * (0.6 + 0.8 * (1 - (light.elev ?? 0.5)))));
  const base = parseColor(fill);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  // Iluminación de la pared: lado hacia la luz más claro, opuesto más oscuro.
  const lx = cx - light.dx * r, ly = cy - light.dy * r, sx = cx + light.dx * r, sy = cy + light.dy * r;
  ctx.save();
  const g = ctx.createLinearGradient(lx, ly, sx, sy);
  g.addColorStop(0, shade(base, 0.55 + 0.25 * light.intensity));
  g.addColorStop(0.5, shade(base, 0.42));
  g.addColorStop(1, shade(base, 0.22 + 0.15 * (light.fill ?? 0)));
  ctx.fillStyle = g;
  for (let i = height; i >= 1; i--) {
    ctx.save();
    ctx.translate(0, i);
    pathFn(ctx);
    ctx.fill();
    ctx.restore();
  }
  // Oscurecimiento hacia la base de la pared (oclusión) + filo inferior.
  ctx.save();
  ctx.translate(0, height);
  pathFn(ctx);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Oclusión de contacto: sombra corta y densa alrededor + sesgo a favor de la luz. */
export function drawContactShadow(ctx: Ctx, pathFn: PathFn, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  const size = num(e, 'size', 3);
  const strength = num(e, 'strength', 0.8);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // 1) ambiente: todo alrededor
  ctx.shadowColor = `rgba(0,0,0,${0.6 * strength})`;
  ctx.shadowBlur = size * 1.6;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = size * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  pathFn(ctx); ctx.fill();
  // 2) contacto direccional (muy corto, muy oscuro)
  ctx.shadowColor = `rgba(0,0,0,${0.9 * strength})`;
  ctx.shadowBlur = size * 0.8;
  ctx.shadowOffsetX = light.dx * size * 0.8; ctx.shadowOffsetY = light.dy * size * 0.8 + size * 0.5;
  pathFn(ctx); ctx.fill();
  ctx.restore();
}

/** Cilindro: sombreado transversal al eje (oscuro-claro-oscuro con franja
 *  especular) y tapa plana en el extremo `tip` si se conoce (palanca). */
export function drawCylinder(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors, h: EffectHints) {
  const light = effLight(e, gl);
  const inten = light.intensity;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let axis = h.axisRad;
  if (axis == null) {
    if (h.tip && h.r != null) axis = Math.atan2(h.tip.y - cy, h.tip.x - cx);
    else axis = b.h >= b.w ? Math.PI / 2 : 0;
  }
  // perpendicular al eje
  const px = -Math.sin(axis), py = Math.cos(axis);
  const half = (h.r != null ? h.r : Math.min(b.w, b.h) / 2);
  // Escorzo: cuanto más corta la palanca (apunta a la cámara), menos sombreado
  // transversal y la tapa se abre hasta ser un círculo completo.
  const len = h.tip && h.pivot ? Math.hypot(h.tip.x - h.pivot.x, h.tip.y - h.pivot.y) : Infinity;
  const k = h.r != null && Number.isFinite(len) ? Math.min(1, len / (h.r * 2.5)) : 1;
  // ¿hacia qué lado transversal cae la luz? (dx,dy) apunta DESDE la luz.
  const side = -(light.dx * px + light.dy * py); // >0: la luz viene por +perp
  const hiT = 0.5 + 0.22 * side; // posición de la franja brillante (0..1 a lo ancho)
  const x0 = cx - px * half, y0 = cy - py * half, x1 = cx + px * half, y1 = cy + py * half;
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const dark = `rgba(0,0,0,${(0.35 + 0.3 * inten) * k})`;
  g.addColorStop(0, side > 0 ? `rgba(0,0,0,${(0.15 + 0.2 * inten) * k})` : dark);
  g.addColorStop(Math.max(0.02, hiT - 0.22), 'rgba(0,0,0,0)');
  g.addColorStop(hiT, `rgba(255,255,255,${(0.35 + 0.45 * inten) * k})`);
  g.addColorStop(Math.min(0.98, hiT + 0.16), 'rgba(0,0,0,0)');
  g.addColorStop(1, side > 0 ? dark : `rgba(0,0,0,${(0.15 + 0.2 * inten) * k})`);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  // franja especular nítida
  const gs = ctx.createLinearGradient(x0, y0, x1, y1);
  gs.addColorStop(Math.max(0, hiT - 0.06), 'rgba(255,255,255,0)');
  gs.addColorStop(hiT, `rgba(255,255,255,${(0.25 + 0.4 * inten) * num(e, 'gloss', 1) * k})`);
  gs.addColorStop(Math.min(1, hiT + 0.05), 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gs;
  ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  // Tapa plana del extremo (elipse en escorzo), más clara y con filo brillante.
  if (h.tip && h.r != null && num(e, 'cap', 1) > 0) {
    const r = h.r, squash = 1 - (1 - 0.45 * num(e, 'cap', 1)) * k;
    const base = parseColor(h.fill);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.ellipse(h.tip.x, h.tip.y, r * 0.96, r * squash, axis + Math.PI / 2, 0, Math.PI * 2);
    const cg = ctx.createLinearGradient(h.tip.x - light.dx * r, h.tip.y - light.dy * r, h.tip.x + light.dx * r, h.tip.y + light.dy * r);
    cg.addColorStop(0, shade(base, 1.45));
    cg.addColorStop(1, shade(base, 0.95));
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.4 * inten})`;
    ctx.stroke();
  }
  ctx.restore();
}

/** Facetas planas: cada lado del polígono con un tono uniforme según su
 *  orientación respecto a la luz, con borde duro entre caras. */
export function drawFacet(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors, sides = 6) {
  const light = effLight(e, gl);
  const inten = light.intensity;
  const n = Math.max(3, Math.round(sides));
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
  const inner = 1 - num(e, 'width', 0.32); // anillo de caras; el centro queda plano
  const lit = { x: -light.dx, y: -light.dy };
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
    const v0 = { x: cx + Math.cos(a0) * rx, y: cy + Math.sin(a0) * ry };
    const v1 = { x: cx + Math.cos(a1) * rx, y: cy + Math.sin(a1) * ry };
    const i0 = { x: cx + Math.cos(a0) * rx * inner, y: cy + Math.sin(a0) * ry * inner };
    const i1 = { x: cx + Math.cos(a1) * rx * inner, y: cy + Math.sin(a1) * ry * inner };
    const mid = (a0 + a1) / 2;
    const nx = Math.cos(mid), ny = Math.sin(mid);
    const facing = nx * lit.x + ny * lit.y; // 1 mira a la luz
    ctx.beginPath();
    ctx.moveTo(v0.x, v0.y); ctx.lineTo(v1.x, v1.y); ctx.lineTo(i1.x, i1.y); ctx.lineTo(i0.x, i0.y); ctx.closePath();
    if (facing > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${facing * (0.18 + 0.4 * inten)})`;
    } else {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(0,0,0,${-facing * (0.25 + 0.35 * inten) * (1 - 0.5 * (light.fill ?? 0))})`;
    }
    ctx.fill();
    // arista dura
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = facing > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(i0.x, i0.y); ctx.lineTo(i1.x, i1.y); ctx.stroke();
  }
  ctx.restore();
}

/** Chaflán escalonado: N anillos concéntricos, cada uno con su gradiente de
 *  luz y borde duro (alternando subida/bajada). */
export function drawChamfer(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  const inten = light.intensity;
  const steps = Math.max(1, Math.round(num(e, 'steps', 3)));
  const width = num(e, 'width', 3);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  const lx = cx - light.dx * r, ly = cy - light.dy * r, sx = cx + light.dx * r, sy = cy + light.dy * r;
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  for (let k = 0; k < steps; k++) {
    const s = 1 - (k * width) / r;
    if (s <= 0.05) break;
    const up = k % 2 === 0;
    const g = ctx.createLinearGradient(lx, ly, sx, sy);
    const hi = `rgba(255,255,255,${0.25 + 0.5 * inten})`, lo = `rgba(0,0,0,${0.3 + 0.45 * inten})`;
    g.addColorStop(0, up ? hi : lo);
    g.addColorStop(0.5, up ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)');
    g.addColorStop(1, up ? lo : hi);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    pathFn(ctx);
    ctx.restore();
    ctx.lineWidth = width / s;
    ctx.strokeStyle = g;
    ctx.stroke();
    // arista dura interior
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s - (width * 0.5) / r, s - (width * 0.5) / r); ctx.translate(-cx, -cy);
    pathFn(ctx);
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = up ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)';
    ctx.stroke();
  }
  ctx.restore();
}

/** Cromo: cielo/suelo con horizonte duro, ligero tinte frío arriba/cálido abajo
 *  y un reflejo deformado del lado de la luz. */
export function drawChrome(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  const inten = light.intensity;
  const strength = num(e, 'strength', 1);
  const horizon = num(e, 'horizon', 0.5);
  const curve = num(e, 'curve', 1); // 0 = horizonte recto (placas), 1 = curvado (esferas)
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const cxx = b.x + b.w / 2, cyy = b.y + b.h / 2, rr = Math.max(b.w, b.h) / 2;
  let g: CanvasGradient;
  let th: number; // posición (0..1) del horizonte en el gradiente
  if (curve > 0.01) {
    // Centro muy por debajo de la pieza: el horizonte queda como un arco que
    // sube en el centro y cae en los lados, como el reflejo en una bola.
    const dist = rr * (1.2 + 4 * (1 - curve));
    const R = dist + rr;
    g = ctx.createRadialGradient(cxx, cyy + dist, 0, cxx, cyy + dist, R);
    th = (dist - rr * (2 * horizon - 1)) / R;
    // Del centro hacia fuera: suelo -> horizonte -> cielo
    g.addColorStop(0, rgba([200, 190, 180], 0.35 * strength));
    g.addColorStop(Math.max(0.01, th - 0.14), rgba([60, 55, 55], 0.5 * strength));
    g.addColorStop(Math.max(0.02, th - 0.02), rgba([20, 18, 22], 0.8 * strength));
    g.addColorStop(Math.min(0.97, th + 0.02), rgba([150, 165, 190], 0.35 * strength));
    g.addColorStop(Math.min(0.98, th + 0.1), rgba([200, 212, 230], 0.5 * strength));
    g.addColorStop(1, rgba([235, 242, 255], 0.9 * strength));
  } else {
    g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    th = horizon;
    g.addColorStop(0, rgba([235, 242, 255], 0.9 * strength));
    g.addColorStop(Math.max(0.01, th - 0.18), rgba([200, 212, 230], 0.5 * strength));
    g.addColorStop(Math.max(0.02, th - 0.04), rgba([150, 165, 190], 0.35 * strength));
    g.addColorStop(Math.min(0.97, th + 0.04), rgba([20, 18, 22], 0.8 * strength));
    g.addColorStop(Math.min(0.98, th + 0.16), rgba([60, 55, 55], 0.5 * strength));
    g.addColorStop(Math.min(0.99, th + 0.3), rgba([120, 110, 100], 0.25 * strength));
    g.addColorStop(1, rgba([200, 190, 180], 0.35 * strength));
  }
  ctx.globalCompositeOperation = 'hard-light';
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // reflejo deformado (ventana) hacia la luz
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  const hx = cx - light.dx * r * 0.5, hy = cy - light.dy * r * 0.5;
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(hx, hy);
  ctx.rotate(Math.atan2(light.dy, light.dx) + Math.PI / 2);
  ctx.scale(1, 0.45);
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
  rg.addColorStop(0, `rgba(255,255,255,${(0.6 + 0.3 * inten) * strength})`);
  rg.addColorStop(0.5, `rgba(255,255,255,${0.25 * strength})`);
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** LED/emisivo — parte de DEBAJO: bloom en dos radios que tiñe lo que hay bajo. */
export function drawEmissiveBloom(ctx: Ctx, b: Box, e: Effect, value?: number) {
  const on = bool(e, 'followValue', false) ? (value ?? 1) : 1;
  const strength = num(e, 'strength', 1) * on;
  if (strength <= 0.01) return;
  const col = parseColor(str(e, 'color', '#ff3020'));
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  const radius = num(e, 'radius', 2.2);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g1 = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * radius);
  g1.addColorStop(0, rgba(col, 0.55 * strength));
  g1.addColorStop(0.35, rgba(col, 0.22 * strength));
  g1.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g1;
  ctx.fillRect(cx - r * radius, cy - r * radius, r * radius * 2, r * radius * 2);
  // reflejo del LED sobre el panel (mancha secundaria hacia abajo)
  const g2 = ctx.createRadialGradient(cx, cy + r * 0.9, 0, cx, cy + r * 0.9, r * 1.6);
  g2.addColorStop(0, rgba(col, 0.25 * strength));
  g2.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g2;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.restore();
}

/** LED/emisivo — parte de ENCIMA: núcleo caliente + color saturado + cúpula. */
export function drawEmissiveCore(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors, value?: number) {
  const light = effLight(e, gl);
  const on = bool(e, 'followValue', false) ? (value ?? 1) : 1;
  const strength = num(e, 'strength', 1) * on;
  const col = parseColor(str(e, 'color', '#ff3020'));
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) / 2;
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  if (strength > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba([255, 255, 255], 0.95 * strength));
    g.addColorStop(0.22, rgba(shadeRGB(col, 1.35), 0.95 * strength));
    g.addColorStop(0.6, rgba(col, 0.8 * strength));
    g.addColorStop(1, rgba(col, 0.35 * strength));
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  // cúpula de cristal: reflejo pequeño hacia la luz + borde oscuro
  const hx = cx - light.dx * r * 0.45, hy = cy - light.dy * r * 0.45;
  const gs = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.35);
  gs.addColorStop(0, `rgba(255,255,255,${0.7 + 0.2 * light.intensity})`);
  gs.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gs;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const ge = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
  ge.addColorStop(0, 'rgba(0,0,0,0)');
  ge.addColorStop(1, `rgba(0,0,0,${0.45 - 0.2 * strength})`);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ge;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

function shadeRGB(c: [number, number, number], k: number): [number, number, number] {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))));
  return [f(c[0]), f(c[1]), f(c[2])];
}

/** Banda ancha y suave de luz que cruza la capa (paneles, marcos). */
export function drawSheen(ctx: Ctx, pathFn: PathFn, b: Box, e: Effect, gl: LightVectors) {
  const light = effLight(e, gl);
  const strength = num(e, 'strength', 0.35) * (0.5 + 0.5 * light.intensity);
  const width = num(e, 'width', 0.35);
  const pos = num(e, 'pos', 0.3);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) * 0.75;
  const lx = cx - light.dx * r, ly = cy - light.dy * r, sx = cx + light.dx * r, sy = cy + light.dy * r;
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  const g = ctx.createLinearGradient(lx, ly, sx, sy);
  g.addColorStop(Math.max(0, pos - width), 'rgba(255,255,255,0)');
  g.addColorStop(pos, `rgba(255,255,255,${strength})`);
  g.addColorStop(Math.min(1, pos + width * 0.8), 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

/** Aplica los efectos de una capa que van DEBAJO del relleno (sombras/glow). */
export function applyEffectsBelow(
  ctx: Ctx,
  pathFn: PathFn,
  effects: Effect[],
  light: LightVectors,
  bounds?: Box,
  hints: EffectHints = {},
) {
  const b = bounds ?? { x: 0, y: 0, w: 0, h: 0 };
  const run = (type: EffectType, fn: (e: Effect) => void) => {
    for (const e of effects) if (e.enabled && e.type === type) fn(e);
  };
  // Orden: bloom/glow (más lejos) -> sombra larga -> contacto -> pared (encima de las sombras).
  run('emissive', (e) => drawEmissiveBloom(ctx, b, e, hints.value));
  run('glow', (e) => drawGlow(ctx, pathFn, e));
  run('dropShadow', (e) => drawDropShadow(ctx, pathFn, e, light));
  run('contactShadow', (e) => drawContactShadow(ctx, pathFn, e, light));
  run('extrude', (e) => drawExtrude(ctx, pathFn, b, e, light, hints.fill));
}

/** Aplica los efectos que van ENCIMA del relleno (bisel, overlays, inner shadow, ruido). */
export function applyEffectsAbove(
  ctx: Ctx,
  pathFn: PathFn,
  bounds: { x: number; y: number; w: number; h: number },
  effects: Effect[],
  light: LightVectors,
  hints: EffectHints = {},
) {
  // Orden importa: material -> reflejo/torneado -> luz direccional -> bisel -> hueco -> ruido.
  const run = (type: EffectType, fn: (e: Effect) => void) => {
    for (const e of effects) if (e.enabled && e.type === type) fn(e);
  };
  run('gradientOverlay', (e) => drawGradientOverlay(ctx, pathFn, bounds, e));
  run('env', (e) => drawEnv(ctx, pathFn, bounds, e));
  run('chrome', (e) => drawChrome(ctx, pathFn, bounds, e, light));
  run('grooves', (e) => drawGrooves(ctx, pathFn, bounds, e));
  run('brushed', () => drawBrushed(ctx, pathFn, bounds));
  run('knurl', (e) => drawKnurl(ctx, pathFn, bounds, e, light, hints.lobes ?? 24));
  run('facet', (e) => drawFacet(ctx, pathFn, bounds, e, light, hints.sides ?? 6));
  run('spun', (e) => drawSpun(ctx, pathFn, bounds, e, light));
  run('dish', (e) => drawDish(ctx, pathFn, bounds, e, light));
  run('cylinder', (e) => drawCylinder(ctx, pathFn, bounds, e, light, hints));
  run('sheen', (e) => drawSheen(ctx, pathFn, bounds, e, light));
  run('specular', (e) => drawSpecular(ctx, pathFn, bounds, e, light));
  run('emissive', (e) => drawEmissiveCore(ctx, pathFn, bounds, e, light, hints.value));
  run('bevel', (e) => drawBevel(ctx, pathFn, bounds, e, light));
  run('chamfer', (e) => drawChamfer(ctx, pathFn, bounds, e, light));
  run('recess', (e) => drawRecess(ctx, pathFn, bounds, e, light));
  run('rim', (e) => drawRim(ctx, pathFn, bounds, e, light));
  run('innerShadow', (e) => drawInnerShadow(ctx, pathFn, bounds, e, light));
  run('noise', (e) => drawNoise(ctx, pathFn, bounds, e));
}
