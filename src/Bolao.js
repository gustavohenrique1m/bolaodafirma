import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";

// ============================================================
// 🔥 CREDENCIAIS DO FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBIYh3dmxZ4zumE4EIZVYAzpTzM-Fx4uX0",
  authDomain: "foco-fdd6b.firebaseapp.com",
  projectId: "foco-fdd6b",
  storageBucket: "foco-fdd6b.firebasestorage.app",
  messagingSenderId: "1041791131210",
  appId: "1:1041791131210:web:b4423f7bd783d2866dd0b3",
};

// ============================================================
// 🔒 PIN DA GESTORA — troque para o PIN que ela vai usar
// ============================================================
const PIN_GESTOR = "1234";

// ============================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CORES = {
  verde: "#009c3b",
  verdeEscuro: "#007a2e",
  verdeClaro: "#e8f7ee",
  amarelo: "#FFDF00",
  azul: "#002776",
  azulClaro: "#e8edf7",
  branco: "#ffffff",
  cinzaClaro: "#f5f6f8",
  cinzaMedio: "#e2e4e8",
  cinzaTexto: "#6b7280",
  textoEscuro: "#111827",
};

const avatarPalette = [
  { bg: "#002776", fg: "#FFDF00" },
  { bg: "#009c3b", fg: "#ffffff" },
  { bg: "#FFDF00", fg: "#002776" },
  { bg: "#7c3aed", fg: "#ffffff" },
  { bg: "#db2777", fg: "#ffffff" },
  { bg: "#0891b2", fg: "#ffffff" },
];

const CONFIG_PADRAO = {
  titulo: "Bolão da Firma",
  time1: "Brasil",
  time2: "Argentina",
  data: "28/06/2025",
  hora: "16:00",
  valor: "R$ 10,00",
  pix: "organizadora@email.com",
};

function iniciais(nome) {
  return nome.trim().split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function formatarDataHora(ts) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function Bolao() {
  const [config, setConfig] = useState(CONFIG_PADRAO);
  const [apostas, setApostas] = useState([]);
  const [form, setForm] = useState({ nome: "", g1: "0", g2: "0" });
  const [editando, setEditando] = useState(false);
  const [configTemp, setConfigTemp] = useState(CONFIG_PADRAO);
  const [toast, setToast] = useState(null);
  const [erros, setErros] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // 🔒 Estado do PIN
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErro, setPinErro] = useState(false);
  const [gestorAutenticado, setGestorAutenticado] = useState(false);

  // Referência mutável para saber se o modal de edição está aberto,
  // sem precisar incluir `editando` como dependência do useEffect.
  const editandoRef = React.useRef(false);
  useEffect(() => { editandoRef.current = editando; }, [editando]);

  useEffect(() => {
    console.log("[Firebase] Iniciando listener de config...");
    const unsub = onSnapshot(doc(db, "config", "jogo"), (snap) => {
      if (snap.exists()) {
        const dados = snap.data();
        console.log("[Firebase] config/jogo carregado:", dados);
        setConfig(dados);
        if (!editandoRef.current) {
          setConfigTemp(dados);
        }
      } else {
        console.warn("[Firebase] config/jogo NÃO existe — criando documento com valores padrão...");
        setDoc(doc(db, "config", "jogo"), CONFIG_PADRAO, { merge: true })
          .then(() => console.log("[Firebase] config/jogo criado com sucesso."))
          .catch((err) => console.error("[Firebase] Erro ao criar config inicial:", err));
      }
    }, (err) => {
      console.error("[Firebase] Erro no listener de config:", err);
    });
    return () => unsub();
  }, []);

  // Escuta apostas em tempo real
  useEffect(() => {
    const q = query(collection(db, "apostas"), orderBy("ts", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setApostas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, (err) => {
      console.error("Erro ao escutar apostas:", err);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  function copiarPix() {
    navigator.clipboard.writeText(config.pix).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  function showToast(msg, tipo = "sucesso") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2500);
  }

  // 🔒 Lógica do PIN
  function abrirPinOuEditar() {
    if (gestorAutenticado) {
      // Já autenticada nesta sessão — abre direto
      setConfigTemp(config);
      setEditando(true);
    } else {
      setPinInput("");
      setPinErro(false);
      setPinModal(true);
    }
  }

  function confirmarPin() {
    if (pinInput === PIN_GESTOR) {
      setGestorAutenticado(true);
      setPinModal(false);
      setConfigTemp(config);
      setEditando(true);
    } else {
      setPinErro(true);
      setPinInput("");
    }
  }

  async function registrar() {
    const novosErros = {};
    if (!form.nome.trim()) novosErros.nome = "Informe o nome";
    if (apostas.find((a) => a.nome.toLowerCase() === form.nome.trim().toLowerCase()))
      novosErros.nome = "Nome já registrado";
    if (Object.keys(novosErros).length) { setErros(novosErros); return; }
    setErros({});
    setSalvando(true);
    try {
      await addDoc(collection(db, "apostas"), {
        nome: form.nome.trim(),
        g1: parseInt(form.g1) || 0,
        g2: parseInt(form.g2) || 0,
        ts: Date.now(),
      });
      setForm({ nome: "", g1: "0", g2: "0" });
      showToast("✓ Aposta registrada!");
    } catch (e) {
      showToast("Erro ao salvar. Tente novamente.", "erro");
    }
    setSalvando(false);
  }

  async function remover(id, nome) {
    try {
      await deleteDoc(doc(db, "apostas", id));
      showToast(`Aposta de ${nome} removida`, "aviso");
    } catch (e) {
      showToast("Erro ao remover.", "erro");
    }
  }

  async function salvarConfig() {
    try {
      setEditando(false);
      console.log("[Firebase] Salvando config:", configTemp);
      await setDoc(doc(db, "config", "jogo"), configTemp, { merge: true });
      console.log("[Firebase] config/jogo salvo com sucesso.");
      showToast("✅ Jogo atualizado!");
    } catch (e) {
      console.error("[Firebase] Erro ao salvar config:", e);
      setEditando(true);
      showToast("Erro ao salvar. Tente novamente.", "erro");
    }
  }

  const s = {
    root: {
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${CORES.azul} 0%, #001a5c 40%, #002d80 100%)`,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "0 0 3rem",
    },
    header: {
      background: `linear-gradient(90deg, ${CORES.verde} 0%, #00b843 100%)`,
      borderBottom: `4px solid ${CORES.amarelo}`,
      padding: "1.5rem 1rem 1.25rem",
      textAlign: "center",
      position: "relative",
    },
    headerTag: {
      display: "inline-flex", alignItems: "center", gap: 6,
      background: CORES.amarelo, color: CORES.azul,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      padding: "4px 14px", borderRadius: 999, marginBottom: 10,
      textTransform: "uppercase",
    },
    headerTitle: {
      fontSize: 28, fontWeight: 800, color: CORES.branco,
      letterSpacing: "-0.5px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.3)",
    },
    headerSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 },
    btnEditJogo: {
      position: "absolute", top: "1.25rem", right: "1rem",
      background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)",
      color: CORES.branco, borderRadius: 8, padding: "6px 12px",
      fontSize: 12, cursor: "pointer", fontWeight: 500,
    },
    liveBadge: {
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(255,255,255,0.15)", color: CORES.branco,
      fontSize: 11, fontWeight: 700, padding: "3px 10px",
      borderRadius: 999, marginTop: 8, letterSpacing: "0.05em",
    },
    liveDot: {
      width: 7, height: 7, borderRadius: "50%",
      background: "#4ade80", display: "inline-block",
      animation: "pulse 1.5s infinite",
    },
    content: { maxWidth: 560, margin: "0 auto", padding: "1.5rem 1rem 0" },
    card: {
      background: CORES.branco, borderRadius: 16,
      overflow: "hidden", marginBottom: "1.25rem",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    },
    cardHeaderAzul: {
      background: CORES.azul, padding: "0.75rem 1.25rem",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    cardHeaderAmarelo: {
      background: CORES.amarelo, padding: "0.75rem 1.25rem",
      display: "flex", alignItems: "center", gap: 8,
    },
    labelAmarelo: { fontSize: 11, fontWeight: 800, color: CORES.amarelo, textTransform: "uppercase", letterSpacing: "0.08em" },
    labelAzul: { fontSize: 11, fontWeight: 800, color: CORES.azul, textTransform: "uppercase", letterSpacing: "0.08em" },
    cardBody: { padding: "1.25rem" },
    timesRow: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: "0.5rem", margin: "0.25rem 0 1.25rem", width: "100%",
    },
    timeNome: {
      fontSize: 20, fontWeight: 800, color: CORES.azul, letterSpacing: "-0.5px",
      flex: "1 1 0", textAlign: "center", wordBreak: "break-word", minWidth: 0,
    },
    vsChip: {
      background: CORES.amarelo, color: CORES.azul,
      fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 999,
    },
    infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
    infoItem: {
      background: CORES.cinzaClaro, borderRadius: 10, padding: "10px 14px",
      border: `1px solid ${CORES.cinzaMedio}`,
    },
    infoLabel: { fontSize: 11, color: CORES.cinzaTexto, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: 700, color: CORES.textoEscuro },
    pixRow: {
      display: "flex", alignItems: "center", gap: 12,
      background: CORES.verdeClaro, borderRadius: 10,
      padding: "12px 14px", border: `1px solid #b6e8c8`,
    },
    pixIcon: {
      width: 36, height: 36, borderRadius: 8, background: CORES.verde,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    pixLabel: { fontSize: 11, color: CORES.verdeEscuro, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" },
    pixValue: { fontSize: 14, fontWeight: 700, color: CORES.verdeEscuro },
    label: { display: "block", fontSize: 12, fontWeight: 700, color: CORES.cinzaTexto, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
    input: {
      width: "100%", padding: "10px 12px", fontSize: 15,
      border: `1.5px solid ${CORES.cinzaMedio}`, borderRadius: 10,
      outline: "none", fontFamily: "inherit", color: CORES.textoEscuro,
      background: CORES.branco, boxSizing: "border-box",
    },
    inputError: { borderColor: "#ef4444" },
    errorMsg: { fontSize: 12, color: "#ef4444", marginTop: 4, fontWeight: 500 },
    placarWrapper: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16 },
    placarColuna: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
    placarColunaVs: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
    placarLabelItem: { fontSize: 13, fontWeight: 700, color: CORES.azul, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 },
    placarLabels: {},
    placarRow: {},
    placarSep: {},
    placarInput: {
      width: 72, padding: "10px 0", fontSize: 22, fontWeight: 800,
      border: `2px solid ${CORES.cinzaMedio}`, borderRadius: 10,
      textAlign: "center", outline: "none", fontFamily: "inherit", color: CORES.azul,
    },
    btnRegistrar: {
      width: "100%", padding: "14px", fontSize: 16, fontWeight: 800,
      background: salvando
        ? CORES.cinzaMedio
        : `linear-gradient(90deg, ${CORES.verde}, #00b843)`,
      color: salvando ? CORES.cinzaTexto : CORES.branco,
      border: "none", borderRadius: 12, cursor: salvando ? "not-allowed" : "pointer",
      letterSpacing: "0.02em", marginTop: 4,
      boxShadow: salvando ? "none" : `0 4px 16px rgba(0, 156, 59, 0.4)`,
    },
    counterBadge: {
      background: CORES.amarelo, color: CORES.azul,
      fontSize: 12, fontWeight: 800, padding: "3px 12px", borderRadius: 999,
    },
    listaBody: { padding: "0.5rem 1.25rem" },
    emptyState: { textAlign: "center", padding: "2.5rem 1rem", color: CORES.cinzaTexto },
    apostaItem: {
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0", borderBottom: `1px solid ${CORES.cinzaMedio}`,
    },
    avatar: {
      width: 42, height: 42, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 800, flexShrink: 0,
    },
    apostaInfo: { flex: 1, minWidth: 0 },
    apostaNome: { fontSize: 15, fontWeight: 700, color: CORES.textoEscuro },
    apostaData: { fontSize: 11, color: CORES.cinzaTexto, marginTop: 1 },
    placarPill: {
      background: CORES.azulClaro, color: CORES.azul,
      fontSize: 15, fontWeight: 800, padding: "6px 16px", borderRadius: 999,
      border: `1.5px solid #c7d3f0`, whiteSpace: "nowrap",
    },
    btnRemover: {
      background: "none", border: "none", cursor: "pointer",
      color: CORES.cinzaTexto, fontSize: 18, padding: "4px 6px",
      borderRadius: 8, lineHeight: 1,
    },
    modalOverlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,80,0.55)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    },
    modal: {
      background: CORES.branco, borderRadius: 20, width: "100%", maxWidth: 420,
      overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
    },
    modalHeader: {
      background: CORES.azul, padding: "1rem 1.25rem",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    modalTitle: { fontSize: 15, fontWeight: 700, color: CORES.amarelo },
    modalClose: {
      background: "rgba(255,255,255,0.15)", border: "none", color: CORES.branco,
      width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
      fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
    },
    modalBody: { padding: "1.25rem", display: "grid", gap: 12 },
    modalRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    btnSalvar: {
      width: "100%", padding: "13px", fontSize: 15, fontWeight: 800,
      background: `linear-gradient(90deg, ${CORES.verde}, #00b843)`,
      color: CORES.branco, border: "none", borderRadius: 12,
      cursor: "pointer", marginTop: 4,
    },
    toastWrap: {
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, pointerEvents: "none",
    },
    toast: {
      background: CORES.azul, color: CORES.branco,
      fontSize: 14, fontWeight: 700, padding: "10px 22px",
      borderRadius: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      borderLeft: `4px solid ${CORES.amarelo}`, whiteSpace: "nowrap",
    },
    // Estilos do modal de PIN
    pinOverlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,80,0.65)",
      zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    },
    pinModal: {
      background: CORES.branco, borderRadius: 20, width: "100%", maxWidth: 340,
      overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    },
    pinHeader: {
      background: CORES.azul, padding: "1.25rem",
      textAlign: "center",
    },
    pinTitle: { fontSize: 16, fontWeight: 800, color: CORES.amarelo, margin: 0 },
    pinSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 },
    pinBody: { padding: "1.5rem", display: "grid", gap: 14 },
    pinInput: {
      width: "100%", padding: "14px", fontSize: 22, fontWeight: 800,
      border: `2px solid ${CORES.cinzaMedio}`, borderRadius: 12,
      textAlign: "center", outline: "none", fontFamily: "inherit",
      color: CORES.azul, letterSpacing: "0.4em", boxSizing: "border-box",
    },
    pinInputErro: { borderColor: "#ef4444", background: "#fff5f5" },
    pinErroMsg: { fontSize: 12, color: "#ef4444", fontWeight: 600, textAlign: "center", marginTop: -6 },
    btnPin: {
      width: "100%", padding: "13px", fontSize: 15, fontWeight: 800,
      background: `linear-gradient(90deg, ${CORES.azul}, #003a9e)`,
      color: CORES.amarelo, border: "none", borderRadius: 12, cursor: "pointer",
    },
    btnPinCancelar: {
      width: "100%", padding: "10px", fontSize: 13, fontWeight: 600,
      background: "none", color: CORES.cinzaTexto, border: "none",
      cursor: "pointer", marginTop: -4,
    },
  };

  return (
    <div style={s.root}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerTag}>⚽ bolão</div>
        <h1 style={s.headerTitle}>{config.titulo}</h1>
        <p style={s.headerSub}>{config.time1} × {config.time2} · {config.data} às {config.hora}</p>
        <div style={s.liveBadge}>
          <span style={s.liveDot}></span> ao vivo — {apostas.length} apostas
        </div>
        <button style={s.btnEditJogo} onClick={abrirPinOuEditar}>
          🔒 editar jogo
        </button>
      </div>

      <div style={s.content}>

        {/* CARD JOGO */}
        <div style={s.card}>
          <div style={s.cardHeaderAzul}>
            <span style={s.labelAmarelo}>⚽ informações do jogo</span>
          </div>
          <div style={s.cardBody}>
            <div style={s.timesRow}>
              <span style={s.timeNome}>🇧🇷 {config.time1}</span>
              <span style={s.vsChip}>VS</span>
              <span style={s.timeNome}>{config.time2}</span>
            </div>
            <div style={s.infoGrid}>
              <div style={s.infoItem}>
                <div style={s.infoLabel}>📅 data</div>
                <div style={s.infoValue}>{config.data}</div>
              </div>
              <div style={s.infoItem}>
                <div style={s.infoLabel}>🕐 horário</div>
                <div style={s.infoValue}>{config.hora}</div>
              </div>
            </div>
            <div style={s.pixRow}>
              <div style={s.pixIcon}><span style={{ fontSize: 18 }}>💸</span></div>
              <div>
                <div style={s.pixLabel}>valor da aposta · chave pix</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={s.pixValue}>{config.valor} · {config.pix}</span>
                  <button
                    onClick={copiarPix}
                    style={{
                      background: copiado ? CORES.verde : "rgba(0,0,0,0.08)",
                      border: "none", borderRadius: 6, cursor: "pointer",
                      fontSize: 11, fontWeight: 700, padding: "3px 10px",
                      color: copiado ? CORES.branco : CORES.verdeEscuro,
                      transition: "all 0.2s", whiteSpace: "nowrap",
                    }}
                  >
                    {copiado ? "✓ copiado!" : "📋 copiar chave pix"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD FORM */}
        <div style={s.card}>
          <div style={s.cardHeaderAmarelo}>
            <span style={{ fontSize: 16 }}>✏️</span>
            <span style={s.labelAzul}>registrar aposta</span>
          </div>
          <div style={s.cardBody}>
            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>nome do participante</label>
              <input
                style={{ ...s.input, ...(erros.nome ? s.inputError : {}) }}
                value={form.nome}
                onChange={(e) => { setForm({ ...form, nome: e.target.value }); setErros({}); }}
                onKeyDown={(e) => e.key === "Enter" && registrar()}
                placeholder="Ex: Gustavo"
              />
              {erros.nome && <div style={s.errorMsg}>{erros.nome}</div>}
            </div>
            <div>
              <div style={s.placarWrapper}>
                <div style={s.placarColuna}>
                  <span style={s.placarLabelItem}>🇧🇷 {config.time1}</span>
                  <input type="number" min="0" max="20" style={s.placarInput}
                    value={form.g1} onChange={(e) => setForm({ ...form, g1: e.target.value })} />
                </div>
                <div style={s.placarColunaVs}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: CORES.cinzaTexto }}>×</span>
                </div>
                <div style={s.placarColuna}>
                  <span style={s.placarLabelItem}>{config.time2}</span>
                  <input type="number" min="0" max="20" style={s.placarInput}
                    value={form.g2} onChange={(e) => setForm({ ...form, g2: e.target.value })} />
                </div>
              </div>
            </div>
            <button style={s.btnRegistrar} onClick={registrar} disabled={salvando}>
              {salvando ? "⏳ salvando..." : "✅ registrar aposta"}
            </button>
          </div>
        </div>

        {/* CARD LISTA */}
        <div style={s.card}>
          <div style={s.cardHeaderAzul}>
            <span style={s.labelAmarelo}>👥 participantes</span>
            <span style={s.counterBadge}>{apostas.length} {apostas.length === 1 ? "aposta" : "apostas"}</span>
          </div>
          <div style={s.listaBody}>
            {carregando ? (
              <div style={{ textAlign: "center", padding: "2rem", color: CORES.cinzaTexto }}>
                ⏳ carregando apostas...
              </div>
            ) : apostas.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>⚽</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: CORES.textoEscuro }}>Nenhuma aposta ainda</div>
                <div style={{ fontSize: 13 }}>Seja o primeiro a apostar!</div>
              </div>
            ) : (
              apostas.map((a, i) => {
                const cor = avatarPalette[i % avatarPalette.length];
                return (
                  <div key={a.id} style={{ ...s.apostaItem, ...(i === apostas.length - 1 ? { borderBottom: "none" } : {}) }}>
                    <div style={{ ...s.avatar, background: cor.bg, color: cor.fg }}>{iniciais(a.nome)}</div>
                    <div style={s.apostaInfo}>
                      <div style={s.apostaNome}>{a.nome}</div>
                      <div style={s.apostaData}>{formatarDataHora(a.ts)}</div>
                    </div>
                    <span style={s.placarPill}>{a.g1} × {a.g2}</span>
                    {gestorAutenticado && (
                      <button
                        style={s.btnRemover}
                        onClick={() => remover(a.id, a.nome)}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "#fef2f2"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = CORES.cinzaTexto; e.currentTarget.style.background = "none"; }}
                        title={`Remover aposta de ${a.nome}`}
                      >🗑</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL PIN — aparece antes do modal de edição */}
      {pinModal && (
        <div style={s.pinOverlay} onClick={(e) => e.target === e.currentTarget && setPinModal(false)}>
          <div style={s.pinModal}>
            <div style={s.pinHeader}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🔐</div>
              <div style={s.pinTitle}>Área da Gestora</div>
              <div style={s.pinSub}>Digite o PIN para editar o jogo</div>
            </div>
            <div style={s.pinBody}>
              <input
                style={{ ...s.pinInput, ...(pinErro ? s.pinInputErro : {}) }}
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                autoFocus
                onChange={(e) => { setPinInput(e.target.value); setPinErro(false); }}
                onKeyDown={(e) => e.key === "Enter" && confirmarPin()}
                placeholder="••••"
              />
              {pinErro && <div style={s.pinErroMsg}>PIN incorreto. Tente novamente.</div>}
              <button style={s.btnPin} onClick={confirmarPin}>
                Entrar →
              </button>
              <button style={s.btnPinCancelar} onClick={() => setPinModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR JOGO */}
      {editando && (
        <div style={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && setEditando(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>✏️ editar informações do jogo</span>
              <button style={s.modalClose} onClick={() => setEditando(false)}>×</button>
            </div>
            <div style={s.modalBody}>
              <div>
                <label style={s.label}>título do bolão</label>
                <input style={s.input} value={configTemp.titulo} onChange={(e) => setConfigTemp({ ...configTemp, titulo: e.target.value })} />
              </div>
              <div style={s.modalRow}>
                <div>
                  <label style={s.label}>time 1</label>
                  <input style={s.input} value={configTemp.time1} onChange={(e) => setConfigTemp({ ...configTemp, time1: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>time 2</label>
                  <input style={s.input} value={configTemp.time2} onChange={(e) => setConfigTemp({ ...configTemp, time2: e.target.value })} />
                </div>
              </div>
              <div style={s.modalRow}>
                <div>
                  <label style={s.label}>data</label>
                  <input style={s.input} value={configTemp.data} onChange={(e) => setConfigTemp({ ...configTemp, data: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>horário</label>
                  <input style={s.input} value={configTemp.hora} onChange={(e) => setConfigTemp({ ...configTemp, hora: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={s.label}>valor da aposta</label>
                <input style={s.input} value={configTemp.valor} onChange={(e) => setConfigTemp({ ...configTemp, valor: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>chave pix</label>
                <input style={s.input} value={configTemp.pix} onChange={(e) => setConfigTemp({ ...configTemp, pix: e.target.value })} />
              </div>
              <button style={s.btnSalvar} onClick={salvarConfig}>💾 salvar alterações</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={s.toastWrap}>
          <div style={s.toast}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}