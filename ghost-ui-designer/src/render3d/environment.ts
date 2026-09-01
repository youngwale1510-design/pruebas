// Entorno de estudio procedural (equirectangular) para reflejos metálicos.
// En una fase posterior puede sustituirse por un HDRI real empaquetado.

import * as THREE from 'three';

export function studioEnvTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#ffffff'); g.addColorStop(0.34, '#c4ccd6');
  g.addColorStop(0.48, '#5b616b'); g.addColorStop(0.52, '#23262b');
  g.addColorStop(0.72, '#101216'); g.addColorStop(1.0, '#040507');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  // softboxes (reflejos nítidos)
  x.fillStyle = 'rgba(255,255,255,1)';
  x.fillRect(90, 60, 240, 60); x.fillRect(560, 44, 300, 44); x.fillRect(380, 150, 150, 30);
  x.fillStyle = 'rgba(255,220,180,0.10)'; x.fillRect(0, 360, 1024, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Devuelve el envMap prefiltrado (PMREM) listo para scene.environment. */
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(studioEnvTexture()).texture;
  pmrem.dispose();
  return env;
}
