// Ajusta un tamaño de lienzo para que no supere lo que cabe en pantalla.
// Puro: sin DOM, sin Electron — así se puede testear sin levantar la app.

export interface SizeLimit {
  width: number;
  height: number;
}

/**
 * Si (w,h) no cabe dentro de `max`, lo escala hacia abajo conservando la
 * proporción hasta que quepa; si ya cabe, lo deja igual. Este es el tamaño
 * que se usa como "100%": nunca más grande que la pantalla disponible.
 */
export function fitWithinScreen(w: number, h: number, max: SizeLimit): { width: number; height: number } {
  if (w <= 0 || h <= 0 || max.width <= 0 || max.height <= 0) {
    return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  }
  const k = Math.min(1, max.width / w, max.height / h);
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}
