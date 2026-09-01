// Escena THREE reutilizable para el knob: la usa tanto el preview en vivo del
// editor como el horneado a filmstrip. Requiere WebGL (runtime, no en tests).

import * as THREE from 'three';
import { KnobConfig } from '../model/knobConfig';
import { buildEnvironment } from './environment';
import { buildKnobGroup, disposeGroup } from './knobMesh';
import { knobAngle, lightPosition } from './geometry';

export class Knob3DStage {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  private dir = new THREE.DirectionalLight(0xffffff, 2.2);
  private rim = new THREE.DirectionalLight(0x9fb4d0, 0.5);
  private ambient = new THREE.HemisphereLight(0xd6deea, 0x0c0d10, 0.38);
  private group: THREE.Group | null = null;

  constructor(canvas?: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    // three 0.160: la salida es sRGB por defecto (outputColorSpace).
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.environment = buildEnvironment(this.renderer);
    this.camera.position.set(0, 1.05, 4.7);
    this.camera.lookAt(0, 0, 0.35);

    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.dir.shadow.camera.near = 0.5; this.dir.shadow.camera.far = 12;
    Object.assign(this.dir.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
    this.dir.shadow.bias = -0.0006;
    this.rim.position.set(-2, 3, 2);
    this.scene.add(this.ambient, this.rim, this.dir, this.dir.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.4 }));
    floor.position.z = -0.02; floor.receiveShadow = true;
    this.scene.add(floor);
  }

  setConfig(cfg: KnobConfig) {
    if (this.group) { this.scene.remove(this.group); disposeGroup(this.group); }
    this.group = buildKnobGroup(cfg);
    this.scene.add(this.group);
  }

  setLight(light: KnobConfig['light']) {
    const [x, y, z] = lightPosition(light.angleDeg, light.elev);
    this.dir.position.set(x, y, z);
    this.dir.intensity = 1.4 + light.intensity * 1.6;
    this.ambient.intensity = 0.35 + (1 - light.intensity) * 0.3;
  }

  setSize(px: number) {
    this.renderer.setSize(px, px, false);
    this.camera.aspect = 1; this.camera.updateProjectionMatrix();
  }

  /** Renderiza un frame con el knob girado a `value` (0..1). */
  render(value: number, sweepDeg: number) {
    if (this.group) this.group.rotation.z = -(knobAngle(value, sweepDeg)) * Math.PI / 180;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.group) disposeGroup(this.group);
    this.renderer.dispose();
  }
}
