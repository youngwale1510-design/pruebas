// Presets de material: combinaciones de efectos ya afinadas para una capa.
// Aplicar un material sustituye los efectos "de superficie" y conserva los de
// colocación (sombras, contacto, extrusión) que describen dónde está la pieza.

import { Effect, EffectType } from './scene';
import { makeId } from './defaults';

export type MaterialId =
  | 'chrome' | 'brushedSteel' | 'spunAluminium' | 'mattePlastic' | 'glossPlastic'
  | 'rubber' | 'paint' | 'led';

export const MATERIALS: { id: MaterialId; label: string; fill: string }[] = [
  { id: 'chrome', label: 'Cromo', fill: '#c9ccd2' },
  { id: 'brushedSteel', label: 'Acero cepillado', fill: '#8e9197' },
  { id: 'spunAluminium', label: 'Aluminio torneado', fill: '#b6b9be' },
  { id: 'mattePlastic', label: 'Plástico mate', fill: '#26272c' },
  { id: 'glossPlastic', label: 'Plástico brillante', fill: '#1c1c20' },
  { id: 'rubber', label: 'Goma', fill: '#1a1a1c' },
  { id: 'paint', label: 'Pintura brillante', fill: '#d3461e' },
  { id: 'led', label: 'LED (cristal)', fill: '#2a0808' },
];

/** Efectos que NO se tocan al cambiar de material (describen colocación, no superficie). */
export const PLACEMENT_EFFECTS: EffectType[] = ['dropShadow', 'contactShadow', 'extrude', 'glow'];

function fx(type: EffectType, params: Effect['params'] = {}): Effect {
  return { id: makeId('fx'), type, enabled: true, params };
}

export function materialEffects(id: MaterialId): Effect[] {
  switch (id) {
    case 'chrome':
      return [fx('chrome', { strength: 1 }), fx('dish', { offset: 0.5 }), fx('specular', { size: 0.3, aspect: 1.2, strength: 1.1 }), fx('bevel', { size: 2 }), fx('rim', { size: 2 })];
    case 'brushedSteel':
      return [fx('brushed', {}), fx('env', { sky: 'rgba(255,255,255,0.5)', ground: 'rgba(0,0,0,0.5)' }), fx('sheen', { width: 0.3, strength: 0.25 }), fx('bevel', { size: 2.5 }), fx('rim', { size: 1.5 })];
    case 'spunAluminium':
      return [fx('env', { sky: 'rgba(255,255,255,0.75)', ground: 'rgba(0,0,0,0.6)' }), fx('grooves', { step: 2.2 }), fx('spun', {}), fx('dish', { offset: 0.42 }), fx('specular', { size: 0.5, aspect: 2.2 }), fx('bevel', { size: 3 }), fx('rim', { size: 2 })];
    case 'mattePlastic':
      return [fx('dish', { offset: 0.5 }), fx('bevel', { size: 2 }), fx('noise', { amount: 0.05 }), fx('rim', { size: 2 })];
    case 'glossPlastic':
      return [fx('gradientOverlay', { type: 'radial', from: 'rgba(255,255,255,0.06)', to: 'rgba(0,0,0,0.45)' }), fx('dish', { offset: 0.5 }), fx('specular', { size: 0.4, aspect: 1.6, strength: 0.8 }), fx('bevel', { size: 2 }), fx('rim', { size: 3 })];
    case 'rubber':
      return [fx('dish', { offset: 0.5 }), fx('noise', { amount: 0.1 }), fx('bevel', { size: 2 }), fx('rim', { size: 1.5, color: '200,200,210' })];
    case 'paint':
      return [fx('sheen', { width: 0.3, strength: 0.4 }), fx('gradientOverlay', { type: 'linear', from: 'rgba(255,255,255,0.12)', to: 'rgba(0,0,0,0.3)' }), fx('specular', { size: 0.45, aspect: 2.5, strength: 0.7 }), fx('bevel', { size: 3 }), fx('rim', { size: 2 })];
    case 'led':
      return [fx('emissive', { color: '#ff3020', strength: 1, radius: 2.2, followValue: true }), fx('rim', { size: 1.5 })];
  }
}

/** Devuelve los efectos de la capa con el material aplicado (conserva colocación). */
export function applyMaterial(effects: Effect[], id: MaterialId): Effect[] {
  const keep = effects.filter((e) => PLACEMENT_EFFECTS.includes(e.type));
  return [...keep, ...materialEffects(id)];
}
