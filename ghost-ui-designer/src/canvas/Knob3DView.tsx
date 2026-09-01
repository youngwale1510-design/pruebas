import { useEffect, useRef } from 'react';
import { KnobConfig } from '../model/knobConfig';
import { Knob3DStage } from '../render3d/stage';

interface Props {
  config: KnobConfig;
  value?: number;
  size?: number;
}

/** Preview 3D en vivo del knob (WebGL). Usa el MISMO motor que el horneado. */
export function Knob3DView({ config, value = 0.5, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Knob3DStage | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let stage: Knob3DStage | null = null;
    try {
      stage = new Knob3DStage(canvasRef.current);
      stage.setSize(size);
      stageRef.current = stage;
    } catch {
      /* WebGL no disponible */
    }
    return () => { stage?.dispose(); stageRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setConfig(config);
    stage.setLight(config.light);
    stage.render(value, config.sweepDeg);
  }, [config, value]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8, background: '#0b0c0e' }} />;
}
