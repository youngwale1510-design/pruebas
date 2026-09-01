// Construcción de la malla THREE del knob a partir de la config.
// Aislado de los tests (importa three, que necesita WebGL en runtime).

import * as THREE from 'three';
import { KnobConfig, KnobMaterial } from '../model/knobConfig';
import { shapeOutline, stackPieces, topZ } from './geometry';

export function material3D(id: KnobMaterial): THREE.MeshPhysicalMaterial {
  const P = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o);
  switch (id) {
    case 'turned':    return P({ color: 0xc4c8cd, metalness: 1, roughness: 0.24, envMapIntensity: 1.5 });
    case 'brushed':   return P({ color: 0xa0a2a7, metalness: 1, roughness: 0.42, envMapIntensity: 1.3 });
    case 'chrome':    return P({ color: 0xf3f5f8, metalness: 1, roughness: 0.03, envMapIntensity: 1.7 });
    case 'brass':     return P({ color: 0xd6ab52, metalness: 1, roughness: 0.26, envMapIntensity: 1.5 });
    case 'darkmetal': return P({ color: 0x1f1f25, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
    case 'blackgloss':return P({ color: 0x0d0d10, metalness: 0, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4 });
    case 'glossy':    return P({ color: 0x264a72, metalness: 0, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
    case 'matte':     return P({ color: 0x3a3a42, metalness: 0.1, roughness: 0.72, envMapIntensity: 0.6 });
  }
}

function shapeFrom(points: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, depth: number, R: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: R * 0.05,
    bevelSegments: 4, curveSegments: 4,
  });
}

/** Grupo THREE con todas las piezas + indicador. Todo gira como un sólido. */
export function buildKnobGroup(cfg: KnobConfig): THREE.Group {
  const group = new THREE.Group();
  for (const p of stackPieces(cfg)) {
    const outline = shapeOutline(p.shape, p.radius, { lobes: 12, sides: 6 });
    const geo = extrude(shapeFrom(outline), p.depth, p.radius);
    const mesh = new THREE.Mesh(geo, material3D(p.material as KnobMaterial));
    mesh.position.z = p.z;
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  // punta chicken-head (si aplica)
  if (cfg.top.type === 'chicken') {
    const R = cfg.top.size;
    const s = new THREE.Shape();
    s.moveTo(-R * 0.5, 0); s.quadraticCurveTo(-R, -R * 0.2, -R * 0.28, -R * 0.5);
    s.lineTo(0, -R * 1.05); s.lineTo(R * 0.28, -R * 0.5);
    s.quadraticCurveTo(R, -R * 0.2, R * 0.5, 0);
    s.quadraticCurveTo(R * 0.7, R * 0.75, 0, R * 0.8);
    s.quadraticCurveTo(-R * 0.7, R * 0.75, -R * 0.5, 0);
    const geo = extrude(s, 0.18, R);
    const mesh = new THREE.Mesh(geo, material3D(cfg.top.material));
    mesh.position.z = topZ(cfg); mesh.castShadow = true;
    group.add(mesh);
  }
  // indicador
  const iz = topZ(cfg) + 0.02;
  const mat = new THREE.MeshStandardMaterial({ color: 0xeef2f7, roughness: 0.35, metalness: 0 });
  if (cfg.indicator.type === 'line') {
    const g = new THREE.BoxGeometry(cfg.indicator.width * 1.1, cfg.indicator.len * 1.1, 0.07);
    const m = new THREE.Mesh(g, mat);
    m.position.set(0, cfg.base.size * 0.5, iz); m.castShadow = true; group.add(m);
  } else if (cfg.indicator.type === 'dot') {
    const d = Math.max(cfg.indicator.width, 0.08);
    const g = new THREE.CylinderGeometry(d * 0.6, d * 0.6, 0.08, 24);
    const m = new THREE.Mesh(g, mat); m.rotation.x = Math.PI / 2;
    m.position.set(0, cfg.base.size * 0.62, iz); m.castShadow = true; group.add(m);
  }
  return group;
}

export function disposeGroup(group: THREE.Group) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
  });
}
