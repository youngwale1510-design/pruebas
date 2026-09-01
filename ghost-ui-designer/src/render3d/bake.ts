// Horneado 3D → filmstrip: renderiza N frames del knob girando y los apila en un
// sprite sheet vertical, con supersampling para alta calidad. Devuelve un PNG.

import { KnobConfig } from '../model/knobConfig';
import { frameValues } from './geometry';
import { Knob3DStage } from './stage';

export interface BakedFilmstrip {
  dataUri: string;             // "data:image/png;base64,..."
  frames: number;
  orientation: 'vertical';
  frameW: number;
  frameH: number;
}

/**
 * @param frameSize  tamaño en px de cada frame (cuadrado)
 * @param supersample factor de sobremuestreo (2 => render a 2x y reduce)
 */
export function bakeKnobFilmstrip(cfg: KnobConfig, frameSize = 128, supersample = 2): BakedFilmstrip {
  const values = frameValues(cfg.frames);
  const ss = Math.max(1, supersample);

  const stage = new Knob3DStage();
  stage.setConfig(cfg);
  stage.setLight(cfg.light);
  stage.setSize(frameSize * ss);

  const sheet = document.createElement('canvas');
  sheet.width = frameSize;
  sheet.height = frameSize * cfg.frames;
  const ctx = sheet.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  values.forEach((v, i) => {
    stage.render(v, cfg.sweepDeg);
    // reducir el render (a 2x) al tamaño final del frame
    ctx.drawImage(stage.renderer.domElement, 0, i * frameSize, frameSize, frameSize);
  });

  const dataUri = sheet.toDataURL('image/png');
  stage.dispose();
  return { dataUri, frames: cfg.frames, orientation: 'vertical', frameW: frameSize, frameH: frameSize };
}
