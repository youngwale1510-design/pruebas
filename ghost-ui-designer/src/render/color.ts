// Utilidades de color puras (sin DOM) para los efectos.

export type RGB = [number, number, number];

/** '#rgb' | '#rrggbb' | 'rgb(a)(r,g,b[,a])' -> [r,g,b]; gris si no se reconoce. */
export function parseColor(c: string | undefined, fallback: RGB = [80, 80, 88]): RGB {
  if (!c) return fallback;
  const s = c.trim();
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    if (h.length >= 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return fallback;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return fallback;
}

/** Oscurece (k<1) o aclara (k>1) un color; devuelve 'rgb(...)'. */
export function shade(rgb: RGB, k: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))));
  return `rgb(${f(rgb[0])},${f(rgb[1])},${f(rgb[2])})`;
}

export function rgba(rgb: RGB, a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a))})`;
}
