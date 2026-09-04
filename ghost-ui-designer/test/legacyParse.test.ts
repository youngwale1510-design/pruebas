import { describe, expect, it } from 'vitest';
import { readSceneFromSource } from '../src/codegen/roundtrip';

// Layout marcado pero VACÍO: el header, el indicador de kick y el scope viven
// fuera de la región gestionada, escritos a mano con aritmética de IRECT.
const EMPTY_LAYOUT = `
  mLayoutFunc = [&](IGraphics* pGraphics) {
    const IRECT bounds = pGraphics->GetBounds().GetPadded(-10.f);
    IRECT b = bounds;

    IRECT header = b.ReduceFromTop(44.f);
    pGraphics->AttachControl(new ITextControl(header.GetFromTop(26.f).GetFromLeft(300.f), "GHOSTDUCK", IText(22.f, COLOR_WHITE, "Roboto-Regular", EAlign::Near, EVAlign::Bottom)));
    pGraphics->AttachControl(new ITextControl(header.GetFromBottom(16.f).GetFromLeft(300.f), "sidechain ducker", IText(11.f, COLOR_MID_GRAY, "Roboto-Regular", EAlign::Near, EVAlign::Top)));
    pGraphics->AttachControl(mKickIndicator = new IGKickIndicatorControl(header.GetFromTop(26.f).GetFromRight(110.f).GetMidVPadded(11.f)), kCtrlTagKickIndicator);

    b.ReduceFromTop(6.f);
    IRECT scopeRect = b.ReduceFromTop(140.f);
    pGraphics->AttachControl(mScope = new IGDuckScopeControl(scopeRect), kCtrlTagScope);

    b.ReduceFromTop(10.f);

// [GHOST:LAYOUT BEGIN v=1]
// [GHOST:LAYOUT END]
  };
`;

// Mismo plugin, pero con los 10 knobs + 3 toggles YA escritos (a mano) dentro
// de la región marcada, funcionando mientras el usuario los rediseña en Ghost.
const POPULATED_LAYOUT = `
  mLayoutFunc = [&](IGraphics* pGraphics) {
    const IRECT bounds = pGraphics->GetBounds().GetPadded(-10.f);
    IRECT b = bounds;

    IRECT header = b.ReduceFromTop(44.f);
    pGraphics->AttachControl(new ITextControl(header.GetFromTop(26.f).GetFromLeft(300.f), "GHOSTDUCK", IText(22.f, COLOR_WHITE, "Roboto-Regular", EAlign::Near, EVAlign::Bottom)));
    pGraphics->AttachControl(mKickIndicator = new IGKickIndicatorControl(header.GetFromTop(26.f).GetFromRight(110.f).GetMidVPadded(11.f)), kCtrlTagKickIndicator);

    b.ReduceFromTop(6.f);
    IRECT scopeRect = b.ReduceFromTop(140.f);
    pGraphics->AttachControl(mScope = new IGDuckScopeControl(scopeRect), kCtrlTagScope);

    b.ReduceFromTop(10.f);

// [GHOST:LAYOUT BEGIN v=1]
    const IVStyle knobStyle = DEFAULT_STYLE.WithColor(kFG, IColor(255, 60, 220, 240));

    IRECT knobRow1 = b.SubRectVertical(3, 0);
    IRECT knobRow2 = b.SubRectVertical(3, 1);
    IRECT toggleRow = b.SubRectVertical(3, 2).GetPadded(0.f, -4.f, 0.f, 0.f);

    pGraphics->AttachControl(new IVKnobControl(knobRow1.GetGridCell(0, 1, 5), kThreshold, "THRESHOLD", knobStyle));
    pGraphics->AttachControl(new IVKnobControl(knobRow1.GetGridCell(1, 1, 5), kAmount, "MAX", knobStyle));
    pGraphics->AttachControl(new IVKnobControl(knobRow2.GetGridCell(0, 1, 5), kKnee, "KNEE", knobStyle));

    const IVStyle toggleStyle = DEFAULT_STYLE.WithColor(kPR, IColor(255, 60, 220, 240));
    pGraphics->AttachControl(new IVToggleControl(toggleRow.GetGridCell(0, 1, 3), kAuto, "AUTO", toggleStyle));
    pGraphics->AttachControl(new IVToggleControl(toggleRow.GetGridCell(1, 1, 3), kFollow, "FOLLOW", toggleStyle));
// [GHOST:LAYOUT END]
  };
`;

describe('lectura automática de layouts iPlug2 escritos a mano', () => {
  it('layout vacío: reconstruye header/kick/scope como cajas de referencia y 0 controles', () => {
    const res = readSceneFromSource(EMPTY_LAYOUT, 400, 300);
    expect(res.found).toBe(true);
    expect(res.controls).toHaveLength(0);
    expect(res.refBoxes.length).toBeGreaterThanOrEqual(3);

    const labels = res.refBoxes.map((b) => b.label);
    expect(labels).toContain('GHOSTDUCK');
    expect(labels.some((l) => /kick/i.test(l))).toBe(true);
    expect(labels.some((l) => /scope/i.test(l) || l === 'IGDuckScopeControl')).toBe(true);

    // El scope: 140px de alto, empieza tras el header (44) + los 2 ReduceFromTop(6) exactos.
    const scope = res.refBoxes.find((b) => /scope/i.test(b.label) || b.label === 'IGDuckScopeControl')!;
    expect(scope.rect.h).toBe(140);
    // bounds = GetPadded(-10) sobre 400x300 -> x:10..390,y:10..290; header ocupa 44 -> scope arranca en y=10+44+6=60
    expect(scope.rect.y).toBe(60);
    expect(scope.rect.x).toBe(10);
    expect(scope.rect.w).toBe(380);
  });

  it('layout con knobs/toggles a mano: los reconoce como controles editables reales', () => {
    const res = readSceneFromSource(POPULATED_LAYOUT, 400, 300);
    expect(res.found).toBe(true);
    expect(res.controls).toHaveLength(5);

    const byParam = Object.fromEntries(res.controls.map((c) => [c.paramId, c]));
    expect(byParam['threshold'].type).toBe('IVKnobControl');
    expect(byParam['threshold'].name).toBe('THRESHOLD');
    expect(byParam['amount']).toBeDefined();
    expect(byParam['knee']).toBeDefined();
    expect(byParam['auto'].type).toBe('IVToggleControl');
    expect(byParam['follow']).toBeDefined();

    // También detecta el header/kick/scope de fuera de la región marcada.
    expect(res.refBoxes.length).toBeGreaterThanOrEqual(3);
  });

  it('si ya hay 0 controles y 0 marcadores GHOST, no revienta (best-effort)', () => {
    const res = readSceneFromSource('int main() { return 0; }', 400, 300);
    expect(res.found).toBe(false);
    expect(res.controls).toEqual([]);
    expect(res.refBoxes).toEqual([]);
  });
});
