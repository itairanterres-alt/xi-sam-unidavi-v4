/* ============================================================
   XI SAM 2026 — EDITOR DE LAYOUT DO PÔSTER (v5 · motor de ZONAS)
   Renderizador confiável (PosterCompletoLandscape, mede ao vivo) +
   controles manuais que alimentam a própria diagramação:
     · nº de colunas (2 ou 3)
     · ZONA de cada figura via MAPA DE SLOTS
        (painel esq./dir. de altura plena · faixa topo · faixa base)
     · LARGURA de cada figura (slider ou alça ↔ na própria figura)
   Tudo grava em `ajuste_layout` (JSON v5) que flui
   submissão → curadoria → telão. Quem mede é o navegador.

   Fonte do trabalho (ordem de prioridade):
     1) ?id=XXXX nos TRABALHOS de exemplo (dev / link direto)
     2) localStorage["sam_poster_edit"] (handoff da curadoria/aluno)

   Dependências (carregadas antes via <script>):
     data.js     → C, AREA_COR, TRABALHOS (globais)
     lib.jsx     → ícones, QRCode, hooks
     posters.jsx → PosterCompletoLandscape, EditAjCtx, _parseAjuste, figsOrdenadas
   ============================================================ */
const { useState, useMemo, useEffect, useRef } = React;

const EDIT_KEY = "sam_poster_edit";
const RESULT_KEY = "sam_poster_result";
const API_URL = "https://script.google.com/macros/s/AKfycbwDbJFn3dz7fH8fXIqLPsLiom43aMACkYz-ZPUie5W14c57elu4FRBqCvrPhzwcFSBX/exec";

/* normaliza o ajuste salvo para a forma EDITÁVEL { cols, panelSide, figs:{} } */
function ajusteEditavel(raw) {
  const p = (window._parseAjuste && window._parseAjuste(raw)) || null;
  return {
    cols: (p && p.cols === 3) ? 3 : 2,
    panelSide: (p && p.panelSide === "left") ? "left" : (p && p.panelSide === "right") ? "right" : undefined,
    figs: (p && p.figs) ? { ...p.figs } : {},
  };
}
/* compacta para gravar: só o que difere do automático */
function ajusteParaSalvar(aj) {
  const out = { v: 5 };
  if (aj.cols === 3) out.cols = 3;
  if (aj.panelSide === "left" || aj.panelSide === "right") out.panelSide = aj.panelSide;
  const figs = {};
  Object.keys(aj.figs || {}).forEach((k) => {
    const o = aj.figs[k] || {}; const r = {};
    if (o.zone === "panel" || o.zone === "bandTop" || o.zone === "bandBot" || o.zone === "block") r.zone = o.zone;
    if (typeof o.w === "number") r.w = Math.round(o.w * 100) / 100;
    if (Object.keys(r).length) figs[k] = r;
  });
  if (Object.keys(figs).length) out.figs = figs;
  const vazio = !out.cols && !out.panelSide && !out.figs;
  return vazio ? "" : JSON.stringify(out);
}

function lerFonte() {
  // 1) ?id= explícito (link direto / dev) vence o handoff guardado
  const id = new URLSearchParams(location.search).get("id");
  if (id && Array.isArray(window.TRABALHOS)) {
    const t = window.TRABALHOS.find((x) => x.id === id);
    if (t) return { t, origem: "demo", email: "", senha: "" };
  }
  // 2) handoff (curadoria/aluno gravam aqui antes de navegar)
  try {
    const raw = localStorage.getItem(EDIT_KEY);
    if (raw) { const o = JSON.parse(raw); if (o && o.t) return o; }
  } catch (e) {}
  return null;
}

/* —— estilos de controle —— */
const tbBtn = (on) => ({
  border: "none", borderRadius: 8, padding: "6px 13px", fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
  background: on ? "#00ADEF" : "rgba(255,255,255,0.10)", color: on ? "#fff" : "rgba(255,255,255,0.78)",
});
const ghost = {
  border: "1px solid rgba(255,255,255,0.26)", background: "transparent",
  color: "rgba(255,255,255,0.82)", borderRadius: 8, padding: "7px 14px",
  fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
};

/* MAPA DE SLOTS (zonas): clique numa figura e depois numa zona para colocá-la.
   Reflete onde cada figura está (inclusive na colocação automática). */
function SlotMap({ figs, layout, selKey, onPlace }) {
  const zoneOf = (layout && layout.zoneOf) || {};
  const side = (layout && layout.panelSide) || "right";
  const figsIn = (z, sd) => figs.filter((f) => { const zz = zoneOf[f.ordem]; return z === "panel" ? (zz === "panel" && side === sd) : zz === z; });
  const Chip = ({ f }) => (
    <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 6px", borderRadius: 5, margin: 1, background: String(f.ordem) === selKey ? "#00ADEF" : "rgba(255,255,255,0.22)", color: "#fff" }}>{f.ordem}</span>
  );
  const Slot = ({ z, sd, label, style }) => {
    const active = !!selKey;
    return (
      <div onClick={() => active && onPlace(z, sd)} title={active ? ("Colocar Fig " + selKey + " aqui") : "Selecione uma figura"}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: active ? "pointer" : "default", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.3)", borderRadius: 7, transition: "background .12s", ...style }}>
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 800, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{label}</span>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>{figsIn(z, sd).map((f) => <Chip key={f.ordem} f={f} />)}</div>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", gap: 5, width: 300, height: 96 }}>
      <Slot z="panel" sd="left" label="◧ Esq." style={{ width: 60 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <Slot z="bandTop" label="▔ Topo" style={{ flex: 1 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, fontSize: 9.5, color: "rgba(255,255,255,0.38)", fontWeight: 700 }}>texto</div>
        <Slot z="bandBot" label="▁ Base" style={{ flex: 1 }} />
      </div>
      <Slot z="panel" sd="right" label="Dir. ◨" style={{ width: 60 }} />
    </div>
  );
}

function Editor({ fonte }) {
  const t = fonte.t;
  const figs = useMemo(() => (window.figsOrdenadas ? window.figsOrdenadas(t) : (t.figuras || [])).filter((f) => f && f.ordem != null), [t]);
  const [aj, setAj] = useState(() => ajusteEditavel(t.ajuste_layout));
  const [selKey, setSelKey] = useState(() => (figs[0] ? String(figs[0].ordem) : null));
  const [layout, setLayout] = useState({ zoneOf: {}, panelSide: "right" });
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");

  const selFigAj = (aj.figs && aj.figs[selKey]) || {};
  const figSel = figs.find((f) => String(f.ordem) === String(selKey)) || null;

  /* merge profundo (mesma semântica do motor): aceita { cols, panelSide, figs:{ordem:{...}} } */
  const merge = (patch) => setAj((prev) => {
    const next = { ...prev, ...patch };
    if (patch.figs) {
      next.figs = { ...(prev.figs || {}) };
      Object.keys(patch.figs).forEach((k) => { next.figs[k] = { ...(prev.figs[k] || {}), ...patch.figs[k] }; });
    }
    return next;
  });
  const onPlace = (z, sd) => { if (!selKey) return; merge({ figs: { [selKey]: { zone: z } }, ...(z === "panel" && sd ? { panelSide: sd } : {}) }); };
  const setSize = (v) => { if (selKey) merge({ figs: { [selKey]: { w: v } } }); };
  const resetFig = (k) => setAj((p) => { const figs = { ...p.figs }; delete figs[k]; return { ...p, figs }; });
  const resetTudo = () => { setAj({ cols: 2, figs: {} }); };

  /* objeto vivo entregue ao motor: layout + handles de edição */
  const ajLive = { ...aj, __edit: true, __sel: selKey, __onPick: (f) => setSelKey(String(f.ordem)), __onChange: merge, __onLayout: setLayout };

  const voltar = () => {
    if (fonte.origem === "curadoria") { location.href = "curadoria.html"; return; }
    if (fonte.origem === "submissao") { location.href = "submissao.html"; return; }
    try { window.close(); } catch (e) {}
    location.href = "index.html";
  };

  const salvar = async () => {
    const str = ajusteParaSalvar(aj);
    setSalvando(true); setToast("");
    try { localStorage.setItem(RESULT_KEY, JSON.stringify({ id: t.id, ajuste_layout: str, ts: Date.now() })); } catch (e) {}
    if (fonte.origem === "curadoria") {
      try {
        const r = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ tipo: "ajuste_layout", email_curadora: fonte.email || "", senha_curadora: fonte.senha || "", id: t.id, ajuste_layout: str }),
        });
        const res = await r.json().catch(() => ({}));
        if (res && res.ok === false) setToast("Salvo localmente — o servidor recusou: " + (res.erro || ""));
        else setToast("Layout salvo e publicado.");
      } catch (e) { setToast("Salvo localmente — sem conexão com o servidor."); }
    } else {
      setToast("Ajuste guardado. Volte e conclua o envio.");
    }
    setSalvando(false);
    try { t.ajuste_layout = str; } catch (e) {}
    setTimeout(() => setToast(""), 4200);
  };

  const sizePct = selFigAj.w != null ? Math.round(selFigAj.w * 100) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A0E13", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* preview ao vivo — o renderizador mede sozinho */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditAjCtx.Provider value={ajLive}>
          <PosterCompletoLandscape t={t} />
        </EditAjCtx.Provider>
      </div>

      {/* barra de controle */}
      <div style={{
        position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)",
        width: "min(1020px, calc(100vw - 28px))", background: "rgba(8,16,26,0.95)",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: "12px 16px",
        boxShadow: "0 14px 44px rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", zIndex: 50,
        display: "flex", flexDirection: "column", gap: 11,
      }}>
        {/* linha 1: colunas · figura · mapa de slots */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6 }}>Colunas</span>
            <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.06)", borderRadius: 9, padding: 3 }}>
              {[2, 3].map((n) => <button key={n} onClick={() => merge({ cols: n })} style={tbBtn((aj.cols || 2) === n)}>{n}</button>)}
            </div>
          </div>
          {figs.length > 0 && <>
            <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.12)" }}></span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6 }}>Figura</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {figs.map((f) => <button key={f.ordem} onClick={() => setSelKey(String(f.ordem))} style={tbBtn(selKey === String(f.ordem))}>{f.ordem}</button>)}
              </div>
            </div>
            <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.12)" }}></span>
            <SlotMap figs={figs} layout={layout} selKey={selKey} onPlace={onPlace} />
          </>}
          {figs.length === 0 && <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>nenhuma figura neste trabalho — ajuste só as colunas</span>}
        </div>

        {/* linha 2: largura da figura selecionada */}
        {figSel && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 320px", minWidth: 240 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>Largura · Fig {selKey}</span>
              <input type="range" min={14} max={92} step={1}
                value={sizePct != null ? sizePct : 42}
                onChange={(e) => setSize(Number(e.target.value) / 100)}
                style={{ flex: 1, minWidth: 0, accentColor: "#00ADEF" }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: sizePct != null ? "#7FD7FF" : "rgba(255,255,255,0.4)", width: 52, textAlign: "right" }}>
                {sizePct != null ? sizePct + "%" : "auto"}
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>ou arraste a alça ↔ na figura</span>
            {(selFigAj.w != null || selFigAj.zone) && (
              <button onClick={() => resetFig(selKey)} style={{ ...ghost, padding: "6px 11px", fontSize: 12 }}>⟳ auto desta figura</button>
            )}
          </div>
        )}

        {/* linha 3: ações */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.id} · {t.titulo}
          </span>
          {toast && <span style={{ fontSize: 12, fontWeight: 700, color: "#7FE0A8" }}>{toast}</span>}
          <button onClick={resetTudo} style={ghost}>Resetar tudo</button>
          <button onClick={voltar} style={ghost}>Voltar</button>
          <button onClick={salvar} disabled={salvando} style={{
            border: "none", background: salvando ? "#0a6f99" : "#00ADEF", color: "#fff", borderRadius: 8,
            padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: salvando ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}>{salvando ? "Salvando…" : "✓ Salvar ajustes"}</button>
        </div>
      </div>
    </div>
  );
}

function SemFonte() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A0E13", color: "rgba(255,255,255,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Nada para editar</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          Abra o editor a partir da <strong>curadoria</strong> (botão “Ajustar pôster”) ou da
          <strong> submissão</strong> — assim o trabalho chega aqui com as figuras.
        </div>
        <a href="curadoria.html" style={{ color: "#00ADEF", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>→ Ir para a curadoria</a>
      </div>
    </div>
  );
}

function EditorApp() {
  const fonte = useMemo(() => lerFonte(), []);
  if (!fonte) return <SemFonte />;
  return <Editor fonte={fonte} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<EditorApp />);
