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

// Mismo extracto, envuelto en marcadores de Ghost como estaría en un .cpp
// real ya exportado, con todo escrito ANTES de la zona de Ghost. Header,
// kick y scope comparten un mismo `b` que se va "comiendo": mover CUALQUIERA
// de los tres por separado arrastraría la declaración de `b` (o de `header`,
// que también hace falta para llegar a `b`) y dejaría a los otros dos sin
// ella — es justo el caso real que rompió la compilación del usuario ('b':
// identificador no declarado). Se usa para probar que Ghost se NIEGA a
// mover algo así, en vez de producir un .cpp roto.
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

    // [GHOST:LAYOUT BEGIN v=1]
    pGraphics->AttachControl(new IVKnobControl(IRECT(10.f, 10.f, 60.f, 60.f), kParamThreshold));
    // [GHOST:LAYOUT END]
  };
`;

// Igual, pero con una línea AL FINAL que sigue usando `b` después del Scope
// — variante minimal (sin header) del mismo problema, para probar el
// `blockedReason` de forma aislada (un solo nombre en conflicto: `b`).
const SRC_SHARED_VAR = `
  mLayoutFunc = [&](IGraphics* pGraphics) {
    const IRECT bounds = pGraphics->GetBounds().GetPadded(-10.f);
    IRECT b = bounds;

    IRECT scopeRect = b.ReduceFromTop(140.f);
    pGraphics->AttachControl(mScope = new IGDuckScopeControl(scopeRect), kCtrlTagScope);

    b.ReduceFromTop(10.f);

    // [GHOST:LAYOUT BEGIN v=1]
    pGraphics->AttachControl(new IVKnobControl(IRECT(10.f, 10.f, 60.f, 60.f), kParamThreshold));
    // [GHOST:LAYOUT END]
  };
`;

// Un elemento AUTOCONTENIDO: usa su propio rect (`scopeRect`, derivado
// directo de `pGraphics->GetBounds()`), sin tocar `bounds`/`b`/`header` para
// nada. Nadie más depende de lo que su cerradura declara, así que SÍ es
// seguro moverlo — este es el camino feliz.
const SRC_SELF_CONTAINED = `
  mLayoutFunc = [&](IGraphics* pGraphics) {
    const IRECT bounds = pGraphics->GetBounds().GetPadded(-10.f);
    IRECT b = bounds;

    IRECT header = b.ReduceFromTop(44.f);
    pGraphics->AttachControl(new ITextControl(header.GetFromTop(26.f).GetFromLeft(300.f), "GHOSTDUCK", IText(22.f, COLOR_WHITE, "Roboto-Regular", EAlign::Near, EVAlign::Bottom)));

    IRECT scopeRect = pGraphics->GetBounds().GetFromBottom(140.f);
    pGraphics->AttachControl(mScope = new IGDuckScopeControl(scopeRect), kCtrlTagScope);

    // [GHOST:LAYOUT BEGIN v=1]
    pGraphics->AttachControl(new IVKnobControl(IRECT(10.f, 10.f, 60.f, 60.f), kParamThreshold));
    // [GHOST:LAYOUT END]
  };
`;

describe('cppDeps: moveElementInLayout (mover un elemento respecto a la zona de Ghost)', () => {
  it('mueve un elemento AUTOCONTENIDO (que no comparte nada con lo que se queda) a DESPUÉS de LAYOUT END', async () => {
    const r = await moveElementInLayout(SRC_SELF_CONTAINED, 'kCtrlTagScope', 'after');
    expect(r.changed).toBe(true);
    expect(r.blockedReason).toBeUndefined();

    const beginIdx = r.source.indexOf('[GHOST:LAYOUT BEGIN');
    const endIdx = r.source.indexOf('[GHOST:LAYOUT END');
    expect(r.source.indexOf('kCtrlTagScope')).toBeGreaterThan(endIdx);

    // El header sigue ANTES de la zona de Ghost, intacto.
    expect(r.source.indexOf('GHOSTDUCK')).toBeLessThan(beginIdx);
    // El scope conserva su propia dependencia (scopeRect) en el bloque movido.
    expect(r.source.slice(endIdx)).toContain('scopeRect');
  });

  it('si ya está del lado pedido, no cambia nada (idempotente)', async () => {
    const first = await moveElementInLayout(SRC_SELF_CONTAINED, 'kCtrlTagScope', 'after');
    const second = await moveElementInLayout(first.source, 'kCtrlTagScope', 'after');
    expect(second.changed).toBe(false);
    expect(second.source).toBe(first.source);
  });

  it('mover a "before" cuando ya está antes: no-op', async () => {
    const r = await moveElementInLayout(SRC_SELF_CONTAINED, 'kCtrlTagScope', 'before');
    expect(r.changed).toBe(false);
  });

  it('ancla inexistente: no cambia nada', async () => {
    const r = await moveElementInLayout(SRC_SELF_CONTAINED, 'kNoExiste', 'after');
    expect(r.changed).toBe(false);
  });

  it('sin marcadores de Ghost en el archivo: no cambia nada', async () => {
    const r = await moveElementInLayout(SRC, 'kCtrlTagScope', 'after');
    expect(r.changed).toBe(false);
  });

  it('NO mueve nada si arrastraría una variable que otro código (que se queda) también necesita', async () => {
    // El bug real: `b` se sigue usando después del Scope
    // (`b.ReduceFromTop(10.f);`), así que mover el Scope (que arrastra la
    // declaración de `b`, porque la necesita) dejaría esa línea sin `b` —
    // 'b': identificador no declarado al compilar. Ghost debe negarse a
    // moverlo, no producir un .cpp roto.
    const r = await moveElementInLayout(SRC_SHARED_VAR, 'kCtrlTagScope', 'after');
    expect(r.changed).toBe(false);
    expect(r.blockedReason).toContain('"b"');
    // Y el archivo queda EXACTAMENTE igual que antes.
    expect(r.source).toBe(SRC_SHARED_VAR);
  });

  it('NO mueve nada si el conflicto es por una variable intermedia (header) en vez de b directamente', async () => {
    // Caso real de GhostDuck: mover el Scope arrastra la declaración de
    // `header` (porque su statement muta `b`, que el Scope sí necesita),
    // pero el texto/kick que se quedan siguen usando `header`.
    const r = await moveElementInLayout(SRC_WITH_MARKERS, 'kCtrlTagScope', 'after');
    expect(r.changed).toBe(false);
    expect(r.blockedReason).toBeDefined();
    expect(r.source).toBe(SRC_WITH_MARKERS);
  });

  it('también reconoce (y bloquea si hace falta) un elemento SIN tag, anclando por el texto literal del constructor', async () => {
    // El texto del header ("GHOSTDUCK") no tiene tag de control — el ancla es
    // el propio `new ITextControl(...)` tal cual aparece en el archivo, igual
    // que hace ahora legacyParse cuando no encuentra un tagArg. Moverlo
    // también es inseguro aquí: el kick y el scope siguen usando `header`/`b`.
    const anchor = 'new ITextControl(header.GetFromTop(26.f).GetFromLeft(300.f), "GHOSTDUCK", IText(22.f, COLOR_WHITE, "Roboto-Regular", EAlign::Near, EVAlign::Bottom))';
    const r = await moveElementInLayout(SRC_WITH_MARKERS, anchor, 'after');
    expect(r.changed).toBe(false);
    expect(r.blockedReason).toBeDefined();
  });
});
