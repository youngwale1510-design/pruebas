import { describe, expect, it } from 'vitest';
import { readSceneFromSource, writeSceneToSource } from '../src/codegen/roundtrip';
import { emptyScene, defaultKnob } from '../src/model/defaults';

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
    // Tiene tag de verdad -> el ancla es el tag, no un fragmento literal.
    expect(scope.sourceTag).toBe('kCtrlTagScope');

    // El texto "GHOSTDUCK" no tiene tag (AttachControl sin segundo argumento):
    // igual debe recibir un ancla (el propio constructor) para poder
    // identificarlo/moverlo, aunque no sea tan robusta como un tag real.
    const header = res.refBoxes.find((b) => b.label === 'GHOSTDUCK')!;
    expect(header.sourceTag).toContain('new ITextControl(');
    expect(header.sourceTag).toContain('GHOSTDUCK');
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

// Extracto real de MBC4.cpp: otro "dialecto" de aritmética de IRECT que
// GhostDuck no usaba — reasignación funcional (`x = x.GetReducedFromLeft(...)`
// en vez de mutar con `x.ReduceFromLeft(...)`), constantes `constexpr float`,
// expresiones con multiplicación, y knobs "bitmap" posicionados con (x, y)
// sueltos en vez de un IRECT entero.
const MBC4_LAYOUT = `
  mLayoutFunc = [&] (IGraphics* pGraphics) {
    const IBitmap knobBmp = pGraphics->LoadBitmap (KNOBBIG_FN, 128);

    constexpr float headerHeight = 200.f;
    constexpr float sidePanel    = 190.f;

    const IRECT full = pGraphics->GetBounds();
    IRECT header = full.GetFromTop (headerHeight).GetPadded (-34.f, -12.f, -34.f, -12.f);

    IRECT left = header.GetFromLeft (sidePanel - 24.f);
    header = header.GetReducedFromLeft (sidePanel - 24.f);

    IRECT knobRow = left.GetFromTop (86.f);
    left = left.GetReducedFromTop (86.f);
    IRECT inCell = knobRow.GetFromLeft (knobRow.W() * 0.5f);
    IRECT outCell = knobRow.GetReducedFromLeft (knobRow.W() * 0.5f);

    pGraphics->AttachControl (new IBKnobControl (inCell.MW() - 39.f, inCell.MH() - 43.f, knobBmp, kInGain));
    pGraphics->AttachControl (new IBKnobControl (outCell.MW() - 39.f, outCell.MH() - 43.f, knobBmp, kOutGain));

// [GHOST:LAYOUT BEGIN v=1]
// [GHOST:LAYOUT END]
  };
`;

describe('lectura de layouts con reasignación funcional (estilo MBC4, no GhostDuck)', () => {
  it('sigue `x = x.GetReducedFromLeft(...)` (reasignación) igual que `x.ReduceFromLeft(...)` (mutación)', () => {
    const res = readSceneFromSource(MBC4_LAYOUT, 900, 650);
    expect(res.found).toBe(true);

    const byParam = Object.fromEntries(res.controls.map((c) => [c.paramId, c]));
    expect(byParam['inGain']).toBeDefined();
    expect(byParam['outGain']).toBeDefined();
  });

  it('resuelve constantes constexpr y aritmética con multiplicación (knobRow.W() * 0.5f)', () => {
    const res = readSceneFromSource(MBC4_LAYOUT, 900, 650);
    const byParam = Object.fromEntries(res.controls.map((c) => [c.paramId, c]));

    // full = GetBounds() (0,0,900,650); header = full.GetFromTop(200).GetPadded(-34,-12,-34,-12)
    //      -> L=34,T=12,R=866,B=188 (ancho=832); left = header.GetFromLeft(190-24=166) -> L=34,R=200
    // left = left.GetReducedFromLeft(166) NO afecta a knobRow (ya se leyó antes de reasignar).
    // knobRow = left.GetFromTop(86) -> el mismo x/w que `left` (34..200, ancho 166).
    // inCell = knobRow.GetFromLeft(166 * 0.5 = 83) -> L=34..117 (ancho 83).
    // inGain: x = inCell.MW()-39 = (34+117)/2-39 = 75.5-39 = 36.5 ~ 37; y = inCell.MH()-43 = (12+98)/2-43 ~ 12.
    expect(byParam['inGain'].rect.x).toBe(37);
    expect(byParam['inGain'].rect.y).toBe(12);
    // Tamaño recuperado EXACTO del propio patrón (39*2=78, 43*2=86), no un default a ciegas.
    expect(byParam['inGain'].rect.w).toBe(78);
    expect(byParam['inGain'].rect.h).toBe(86);

    // outCell = knobRow.GetReducedFromLeft(83) -> L=117..200 (empieza justo donde termina inCell).
    expect(byParam['outGain'].rect.x).toBeGreaterThan(byParam['inGain'].rect.x);
  });

  it('IBKnobControl con firma (x, y, bitmap, param): se detecta como control real, no como referencia', () => {
    const res = readSceneFromSource(MBC4_LAYOUT, 900, 650);
    expect(res.controls).toHaveLength(2);
    expect(res.controls.every((c) => c.type === 'IBKnobControl')).toBe(true);
    expect(res.refBoxes).toHaveLength(0);
  });
});

// Plugins con parámetros "por banda" (desenrollados a mano) direccionan el
// parámetro real con una llamada, no un tag suelto: `BandParam(0, kOffGain)`.
const COMPOSITE_PARAM_LAYOUT = `
  mLayoutFunc = [&] (IGraphics* pGraphics) {
    const IBitmap knobBmp = pGraphics->LoadBitmap (KNOBBIG_FN, 128);
    pGraphics->AttachControl (new IBKnobControl (40.f, 12.f, knobBmp, BandParam (0, kOffGain)));
    pGraphics->AttachControl (new IBKnobControl (140.f, 12.f, knobBmp, BandParam (1, kOffThresh)));

// [GHOST:LAYOUT BEGIN v=1]
// [GHOST:LAYOUT END]
  };
`;

describe('lectura de parámetros "compuestos" (BandParam(N, kOffX), no un tag suelto)', () => {
  it('se detecta como control editable real (no una caja de referencia)', () => {
    const res = readSceneFromSource(COMPOSITE_PARAM_LAYOUT, 900, 650);
    expect(res.controls).toHaveLength(2);
    expect(res.refBoxes).toHaveLength(0);
  });

  it('guarda la expresión ORIGINAL en paramExpr para reemitirla igual al exportar', () => {
    const res = readSceneFromSource(COMPOSITE_PARAM_LAYOUT, 900, 650);
    const gain = res.controls.find((c) => c.rect.x === 40)!;
    const thresh = res.controls.find((c) => c.rect.x === 140)!;
    expect(gain.paramExpr).toBe('BandParam (0, kOffGain)');
    expect(thresh.paramExpr).toBe('BandParam (1, kOffThresh)');
    // paramId es un id ESTABLE sintético (no el tag real) — distinto por control.
    expect(gain.paramId).not.toBe(thresh.paramId);
  });

  it('al reexportar, reemite la expresión compuesta tal cual — no un tag inventado', () => {
    const { source } = writeSceneToSource(sceneWithCompositeKnob(), null);
    expect(source).toContain('BandParam(2, kOffKnee)');
    expect(source).not.toMatch(/kBandparam/i);
  });
});

function sceneWithCompositeKnob() {
  const scene = emptyScene('CompositeTest');
  const knob = defaultKnob('knob_band2knee', 'Band 3 Knee', 'band2knee');
  knob.type = 'IBKnobControl';
  knob.paramExpr = 'BandParam(2, kOffKnee)';
  knob.rect = { x: 10, y: 10, w: 78, h: 78 };
  scene.controls.push(knob);
  return scene;
}

// Bug real encontrado en MBC4: `constexpr float stripHeight = (650.f -
// headerHeight) / 4.f;` — una constante calculada entre PARÉNTESIS. Sin
// soporte para paréntesis en el evaluador aritmético, esto evaluaba a 0 en
// silencio, y con `bandArea = bandArea.GetReducedFromTop(stripHeight)`
// reduciendo por 0, las 4 "bandas" quedaban todas apiladas en la misma
// posición en vez de una debajo de la otra.
const PARENS_LAYOUT = `
  mLayoutFunc = [&] (IGraphics* pGraphics) {
    constexpr float headerHeight = 200.f;
    constexpr float stripHeight = (650.f - headerHeight) / 4.f;

    const IRECT full = pGraphics->GetBounds();
    IRECT bandArea = full.GetReducedFromTop (headerHeight);

    {
      IRECT row = bandArea.GetFromTop (stripHeight);
      bandArea = bandArea.GetReducedFromTop (stripHeight);
      pGraphics->AttachControl (new IBKnobControl (row.MW() - 39.f, row.MH() - 39.f, knobBmp, BandParam (0, kOffGain)));
    }
    {
      IRECT row = bandArea.GetFromTop (stripHeight);
      bandArea = bandArea.GetReducedFromTop (stripHeight);
      pGraphics->AttachControl (new IBKnobControl (row.MW() - 39.f, row.MH() - 39.f, knobBmp, BandParam (1, kOffGain)));
    }

// [GHOST:LAYOUT BEGIN v=1]
// [GHOST:LAYOUT END]
  };
`;

describe('aritmética con paréntesis en constantes (constexpr float X = (A - B) / C;)', () => {
  it('resuelve la constante de verdad, no a 0 — cada banda queda en una posición distinta', () => {
    const res = readSceneFromSource(PARENS_LAYOUT, 900, 650);
    expect(res.controls).toHaveLength(2);
    const band0 = res.controls.find((c) => c.paramExpr === 'BandParam (0, kOffGain)')!;
    const band1 = res.controls.find((c) => c.paramExpr === 'BandParam (1, kOffGain)')!;
    expect(band0.rect.y).not.toBe(band1.rect.y);
    // headerHeight=200, stripHeight=(650-200)/4=112.5 -> banda 1 empieza ~112.5px
    // más abajo (± redondeo a entero de las coordenadas del rect).
    expect(Math.abs(band1.rect.y - band0.rect.y - 112.5)).toBeLessThanOrEqual(1);
  });
});
