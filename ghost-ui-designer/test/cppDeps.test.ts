import { describe, expect, it } from 'vitest';
import { dependencyClosure, moveElementInLayout } from '../src/codegen/iplug2/cppDeps';

// Extracto real del mLayoutFunc de GhostDuck: header + kick indicator + scope,
// todos derivando de un mismo `b` que se va "comiendo" con ReduceFromTop.
const SRC = `
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
  };
`;

describe('cppDeps: dependencyClosure (tree-sitter de verdad, no regex)', () => {
  it('mover el Scope arrastra bounds/b/header(por su efecto)/scopeRect, pero NO el texto del header ni el kick', async () => {
    const spans = await dependencyClosure(SRC, 'kCtrlTagScope');
    expect(spans).not.toBeNull();
    const texts = spans!.map((s) => s.text);

    expect(texts.some((t) => t.includes('const IRECT bounds ='))).toBe(true);
    expect(texts.some((t) => t.includes('IRECT b = bounds;'))).toBe(true);
    expect(texts.some((t) => t.includes('IRECT header = b.ReduceFromTop(44.f)'))).toBe(true);
    expect(texts.some((t) => t.includes('b.ReduceFromTop(6.f)'))).toBe(true);
    expect(texts.some((t) => t.includes('IRECT scopeRect ='))).toBe(true);
    expect(texts.some((t) => t.includes('kCtrlTagScope'))).toBe(true);

    // Esto es lo importante: NO debe arrastrar el texto del header ni el kick indicator.
    expect(texts.some((t) => t.includes('GHOSTDUCK'))).toBe(false);
    expect(texts.some((t) => t.includes('kCtrlTagKickIndicator'))).toBe(false);
    expect(texts.some((t) => t.includes('sidechain ducker'))).toBe(false);
  });

  it('mover el Kick Indicator arrastra bounds/b/header, pero NO el scope', async () => {
    const spans = await dependencyClosure(SRC, 'kCtrlTagKickIndicator');
    expect(spans).not.toBeNull();
    const texts = spans!.map((s) => s.text);

    expect(texts.some((t) => t.includes('const IRECT bounds ='))).toBe(true);
    expect(texts.some((t) => t.includes('IRECT b = bounds;'))).toBe(true);
    expect(texts.some((t) => t.includes('IRECT header ='))).toBe(true);
    expect(texts.some((t) => t.includes('kCtrlTagKickIndicator'))).toBe(true);

    expect(texts.some((t) => t.includes('scopeRect'))).toBe(false);
    expect(texts.some((t) => t.includes('kCtrlTagScope'))).toBe(false);
  });

  it('las líneas incluidas mantienen el orden original', async () => {
    const spans = await dependencyClosure(SRC, 'kCtrlTagScope');
    const starts = spans!.map((s) => s.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('ancla que no existe: devuelve null en vez de reventar', async () => {
    const spans = await dependencyClosure(SRC, 'kNoExiste');
    expect(spans).toBeNull();
  });
});

// Mismo extracto, pero envuelto en marcadores de Ghost como estaría en un
// .cpp real ya exportado, con el Scope escrito ANTES de la zona de Ghost.
const SRC_WITH_MARKERS = `
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
    pGraphics->AttachControl(new IVKnobControl(IRECT(10.f, 10.f, 60.f, 60.f), kParamThreshold));
    // [GHOST:LAYOUT END]
  };
`;

describe('cppDeps: moveElementInLayout (mover el Scope respecto a la zona de Ghost)', () => {
  it('mueve el Scope (y lo que necesita) a DESPUÉS de LAYOUT END, sin tocar el resto', async () => {
    const r = await moveElementInLayout(SRC_WITH_MARKERS, 'kCtrlTagScope', 'after');
    expect(r.changed).toBe(true);

    const beginIdx = r.source.indexOf('[GHOST:LAYOUT BEGIN');
    const endIdx = r.source.indexOf('[GHOST:LAYOUT END');
    const scopeIdx = r.source.indexOf('kCtrlTagScope');
    expect(scopeIdx).toBeGreaterThan(endIdx);

    // El header/kick indicator siguen ANTES de la zona de Ghost, intactos.
    const headerIdx = r.source.indexOf('GHOSTDUCK');
    const kickIdx = r.source.indexOf('kCtrlTagKickIndicator');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(beginIdx);
    expect(kickIdx).toBeLessThan(beginIdx);

    // El scope conserva su dependencia real (scopeRect) en el bloque movido.
    expect(r.source.slice(endIdx)).toContain('scopeRect');
  });

  it('si ya está del lado pedido, no cambia nada (idempotente)', async () => {
    const first = await moveElementInLayout(SRC_WITH_MARKERS, 'kCtrlTagScope', 'after');
    const second = await moveElementInLayout(first.source, 'kCtrlTagScope', 'after');
    expect(second.changed).toBe(false);
    expect(second.source).toBe(first.source);
  });

  it('mover a "before" cuando ya está antes: no-op', async () => {
    const r = await moveElementInLayout(SRC_WITH_MARKERS, 'kCtrlTagScope', 'before');
    expect(r.changed).toBe(false);
  });

  it('ancla inexistente: no cambia nada', async () => {
    const r = await moveElementInLayout(SRC_WITH_MARKERS, 'kNoExiste', 'after');
    expect(r.changed).toBe(false);
  });

  it('sin marcadores de Ghost en el archivo: no cambia nada', async () => {
    const r = await moveElementInLayout(SRC, 'kCtrlTagScope', 'after');
    expect(r.changed).toBe(false);
  });

  it('también mueve un elemento SIN tag, anclando por el texto literal del constructor', async () => {
    // El texto del header ("GHOSTDUCK") no tiene tag de control — el ancla es
    // el propio `new ITextControl(...)` tal cual aparece en el archivo, igual
    // que hace ahora legacyParse cuando no encuentra un tagArg.
    const anchor = 'new ITextControl(header.GetFromTop(26.f).GetFromLeft(300.f), "GHOSTDUCK", IText(22.f, COLOR_WHITE, "Roboto-Regular", EAlign::Near, EVAlign::Bottom))';
    const r = await moveElementInLayout(SRC_WITH_MARKERS, anchor, 'after');
    expect(r.changed).toBe(true);
    const endIdx = r.source.indexOf('[GHOST:LAYOUT END');
    expect(r.source.indexOf('GHOSTDUCK')).toBeGreaterThan(endIdx);
    // El scope, sin pedirlo, se queda donde estaba (antes de la zona de Ghost).
    const beginIdx = r.source.indexOf('[GHOST:LAYOUT BEGIN');
    expect(r.source.indexOf('kCtrlTagScope')).toBeLessThan(beginIdx);
  });
});
