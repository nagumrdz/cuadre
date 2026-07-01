import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Package, ClipboardList, Wallet, LayoutDashboard,
  Plus, Trash2, X, ChevronRight, ArrowUp, ArrowDown,
  RotateCcw, Download, Upload, FileJson, Calendar,
  Hash, TrendingUp, Settings, LogOut, User, Eye, EyeOff,
  ChevronLeft, Lock, Search, Zap, Sun, Glasses, ChevronDown,
  Phone, MoreVertical, MessageCircle, ShoppingCart
} from "lucide-react";

// ─── Versión ────────────────────────────────────────────────────────────────
const APP_VERSION = "v1.2.6 beta cerrada";
const CODIGO_BETA  = "cuadre2026";    // Código de invitación — solo se pide una vez al activar
const CLAVE_ADMIN  = "FuriaCorp1996"; // Contraseña de administrador — no modificar
const APP_NAME    = "Cuadre MX";

// ─── Claves de storage ───────────────────────────────────────────────────────
// AUTH_KEY en Redis (compartido entre dispositivos — solo usuarios registrados)
// SESION_LOCAL en localStorage (por dispositivo — evita sesiones cruzadas)
const AUTH_KEY    = "cuadre:auth:usuarios";
const SESION_LOCAL = "cuadre_session";     // localStorage, NO Redis
const dataKeys = (uid) => ({
  INV:  `cuadre:${uid}:inventario`,
  PED:  `cuadre:${uid}:pedidos`,
  RET:  `cuadre:${uid}:retiros`,
  CAP:  `cuadre:${uid}:capitalInicial`,
  ENTR: `cuadre:${uid}:entradas`,
  DIA:  `cuadre:${uid}:ultimoDia`,
  CAJAE:`cuadre:${uid}:estadoCaja`,
  TUT:  `cuadre:${uid}:tutorialDone`,
});

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg:            "#F5F0EB",
  surface:       "#FFFFFF",
  surface2:      "#EDE8E1",
  border:        "#D8D0C6",
  terra:         "#E05C35",
  terraLight:    "rgba(224,92,53,0.10)",
  positive:      "#2A7D4F",
  positiveLight: "rgba(42,125,79,0.10)",
  negative:      "#C0392B",
  negativeLight: "rgba(192,57,43,0.10)",
  amber:         "#C07A00",
  amberLight:    "rgba(192,122,0,0.10)",
  blue:          "#2563EB",
  blueLight:     "rgba(37,99,235,0.10)",
  text:          "#1A1410",
  textSub:       "#5A5248",
  dim:           "#9A908A",
};

// ─── Categorías (7 top e-commerce MX + Hogar + Otro) ────────────────────────
const CATEGORIAS = [
  "Moda",
  "Joyería",
  "Electro / Tech",
  "Beauty / Skincare",
  "Food & Drinks",
  "Pets",
  "Baby / Toys",
  "Gaming",
  "Servicio",
  "Otra",
];

const APP_SLOGAN = "Cuadra tu negocio.";

// Config visual de cada tab — nombre, ícono y color de acento
const TAB_CONFIG = {
  pedidos:    { label:"Pedidos",    Icon:ShoppingCart, color:"#E05C35" },
  inventario: { label:"Inventario", Icon:Package,      color:"#2A7D4F" },
  caja:       { label:"Caja",       Icon:Wallet,       color:"#2563EB" },
  resumen:    { label:"Resumen",    Icon:LayoutDashboard, color:"#7C3AED" },
};

// Saludo dinámico por hora del día
const getSaludo = (nombre) => {
  const h = new Date().getHours();
  const emojis = ["🌟","✨","💪","🔥","👊","🎯"];
  const emoji = emojis[Math.floor(Math.random()*emojis.length)];
  let linea1, linea2;
  if (h >= 5  && h < 12) { linea1 = "¡Buenos días!"; linea2 = `${nombre}! ${emoji}`; }
  else if (h >= 12 && h < 19) { linea1 = "¡Hola!"; linea2 = `${nombre}! ${emoji}`; }
  else { linea1 = "¡Qué alegría verte,"; linea2 = `${nombre}! ${emoji}`; }
  return { linea1, linea2 };
};

// ─── Estados de pedido ───────────────────────────────────────────────────────
const ESTADOS = [
  { id: "pendiente", label: "Pendiente", color: "#C07A00", tint: "rgba(192,122,0,0.07)"  },
  { id: "pagado",    label: "Pagado",    color: "#2563EB", tint: "rgba(37,99,235,0.07)"  },
  { id: "entregado", label: "Entregado", color: "#2A7D4F", tint: "rgba(42,125,79,0.07)"  },
];

const MOTIVOS_RETIRO = [
  "Gastos Personales", "Salario", "Servicios", "Renta",
  "Proveedores", "Mercancía", "Corte de Caja",
  "Pérdida (Dif. Caja)", "Robo/Extravío", "Otro",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const parseDecimal = (v) => { const n = parseFloat(String(v).replace(",",".")); return isNaN(n)?0:n; };
const fmtMoney = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
// Genera un link de WhatsApp a partir de un teléfono — agrega código de México (52) si no trae lada internacional
const waLink = (telefono) => {
  let limpio = (telefono||"").replace(/\D/g,"");
  if (!limpio) return "";
  if (limpio.length === 10) limpio = "52" + limpio; // número local MX sin lada
  return `https://wa.me/${limpio}`;
};
// Siempre usa la hora local del dispositivo, nunca UTC
const ahoraLocal = () => new Date().toISOString();

// Sonido de confirmación generado con Web Audio API (no requiere archivos externos)
// Campanita suave de dos notas — estilo "ding" de notificación, volumen bajo
const playConfirmSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tocarNota = (freq, inicio, duracion, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + inicio);
      gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + inicio + 0.015); // ataque suave
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracion); // decay
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracion);
    };
    // Campanita: nota alta breve, seguida de una nota ligeramente más aguda — "ding"
    tocarNota(1318.5, 0,    0.18, 0.18); // E6
    tocarNota(1760,   0.07, 0.22, 0.14); // A6
    setTimeout(()=>ctx.close(), 400);
  } catch { /* silencio si el navegador no soporta Web Audio */ }
};

// Feedback completo: vibración + sonido (respeta el modo silencio del dispositivo)
const feedbackGuardado = () => {
  if (navigator.vibrate) navigator.vibrate(50);
  playConfirmSound();
}; // ISO pero se interpreta con new Date() que respeta TZ local
const fmtFecha = (iso, conHora=false) => {
  if (!iso) return "";
  const d = new Date(iso);
  const f = d.toLocaleDateString("es-MX",{day:"2-digit",month:"short",timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
  if (!conHora) return f;
  const h = d.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
  return `${f} ${h}`;
};

function Indicator({ value, size=13 }) {
  const Icon = value>=0 ? ArrowUp : ArrowDown;
  return <Icon size={size} style={{color:value>=0?C.positive:C.negative,verticalAlign:"middle",marginRight:2}}/>;
}

const inputStyle = {
  width:"100%", background:C.surface2, border:`1px solid ${C.border}`,
  borderRadius:8, padding:"10px 12px", color:C.text, fontSize:14,
  outline:"none", boxSizing:"border-box", fontFamily:"inherit",
};
const labelStyle = { fontSize:11, color:C.dim, marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:0.5 };
function Field({ label, children }) {
  return <div style={{marginBottom:10}}><span style={labelStyle}>{label}</span>{children}</div>;
}
const cardStyle = {
  background:C.surface, border:`1px solid ${C.border}`, borderRadius:14,
  padding:14, marginBottom:10, boxShadow:"0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04)",
};

// ─── QuantityInput: botones −/+ con número editable para decimales ────────────
function QuantityInput({ value, onChange, min = 0, step = 1, placeholder = "0" }) {
  const { useState: useLocalState } = React;
  const [editing, setEditing] = useLocalState(false);
  const [draft, setDraft] = useLocalState("");
  const num = parseDecimal(String(value)) || 0;

  const decrement = () => {
    const next = Math.max(min, parseFloat((num - step).toFixed(10)));
    onChange(String(next));
  };
  const increment = () => {
    const next = parseFloat((num + step).toFixed(10));
    onChange(String(next));
  };
  const commitEdit = () => {
    const n = parseDecimal(draft);
    onChange(String(isNaN(n) ? num : Math.max(min, n)));
    setEditing(false);
  };

  const displayNum = num % 1 === 0 ? String(num) : String(num);

  return (
    <div style={{display:"flex",alignItems:"stretch",border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",background:C.surface2,height:54}}>
      <button
        onClick={decrement}
        style={{width:58,background:"transparent",border:"none",borderRight:`1px solid ${C.border}`,fontSize:26,fontWeight:700,color:C.textSub,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}
      >−</button>

      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={e=>setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); }}
          style={{flex:1,textAlign:"center",border:"none",background:"transparent",fontSize:18,fontWeight:700,outline:"none",color:C.text,padding:"0 6px",fontFamily:"inherit"}}
        />
      ) : (
        <button
          onClick={()=>{ setDraft(displayNum); setEditing(true); }}
          title="Toca para ingresar decimales"
          style={{flex:1,textAlign:"center",background:"transparent",border:"none",fontSize:18,fontWeight:700,color:num===0?C.dim:C.text,padding:"0 6px",fontFamily:"inherit"}}
        >{displayNum || placeholder}</button>
      )}

      <button
        onClick={increment}
        style={{width:58,background:"transparent",border:"none",borderLeft:`1px solid ${C.border}`,fontSize:26,fontWeight:700,color:C.terra,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}
      >+</button>
    </div>
  );
}

// ─── Pantalla de autenticación ───────────────────────────────────────────────
function PantallaAuth({ onLogin }) {
  const [modo, setModo]         = useState("login"); // "login" | "registro"
  const [usuarios, setUsuarios] = useState([]);
  const [sel, setSel]           = useState(null);
  const [error, setError]       = useState("");

  // Login state
  const [pin, setPin]           = useState("");
  const [codBeta, setCodBeta]   = useState("");
  const [verPin, setVerPin]     = useState(false);

  // Registro — primero pide clave admin, luego muestra el formulario
  const [claveAdmin, setClaveAdmin]   = useState("");
  const [adminOk, setAdminOk]         = useState(false);
  const [form, setForm]               = useState({ nombre:"", pin:"", pin2:"" });
  const [verPinReg, setVerPinReg]     = useState(false);

  const flashErr = (msg) => { setError(msg); setTimeout(()=>setError(""), 3500); };

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(AUTH_KEY, false);
        let lista = r ? JSON.parse(r.value) : [];
        // Cuentas existentes sin campo "activado" se consideran ya activas
        const necesitaActualizar = lista.some(u => u.activado === undefined);
        if (necesitaActualizar) {
          lista = lista.map(u => u.activado === undefined ? {...u, activado:true} : u);
          await window.storage.set(AUTH_KEY, JSON.stringify(lista), false).catch(()=>{});
        }
        setUsuarios(lista);
        if (lista.length === 0) setModo("registro");
      } catch { setUsuarios([]); setModo("registro"); }
    })();
  }, []);

  // ── Verificar clave admin para desbloquear formulario de registro ──
  const verificarAdmin = () => {
    if (claveAdmin.trim() === CLAVE_ADMIN) { setAdminOk(true); setError(""); }
    else flashErr("Contraseña de administrador incorrecta.");
  };

  // ── Crear cuenta (solo admin) ──
  const registrar = async () => {
    if (!form.nombre.trim()) return flashErr("El nombre es obligatorio.");
    if (form.pin.length < 4)  return flashErr("El PIN debe tener al menos 4 dígitos.");
    if (form.pin !== form.pin2) return flashErr("Los PINs no coinciden.");
    const nuevo = { id: uid(), nombre: form.nombre.trim(), pin: form.pin };
    const next  = [...usuarios, nuevo];
    try {
      await window.storage.set(AUTH_KEY, JSON.stringify(next), false);
      setUsuarios(next);
      // Admin no inicia sesión — regresa al login para que el tester entre después
      setModo("login");
      setAdminOk(false);
      setClaveAdmin("");
      setForm({ nombre:"", pin:"", pin2:"" });
      setError("");
    } catch { flashErr("Error al guardar. Intenta de nuevo."); }
  };

  // ── Entrar ──
  const entrar = async () => {
    if (!sel) return flashErr("Selecciona tu cuenta.");
    if (pin !== sel.pin) return flashErr("PIN incorrecto.");

    // Si la cuenta NO está activada aún, exige el código de invitación
    if (!sel.activado) {
      if (codBeta.trim().toLowerCase() !== CODIGO_BETA.toLowerCase())
        return flashErr("Código de acceso incorrecto. Pídelo a Furia.Corp.");
      // Marcar como activada en Redis para que nunca más lo pida
      const next = usuarios.map(u => u.id === sel.id ? {...u, activado:true} : u);
      try {
        await window.storage.set(AUTH_KEY, JSON.stringify(next), false);
        setUsuarios(next);
      } catch { /* si falla el guardado igual dejamos entrar */ }
    }

    try { localStorage.setItem(SESION_LOCAL, sel.id); } catch {}
    onLogin({...sel, activado:true});
  };

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { background-color:${C.bg}; min-height:100dvh; }
        button { cursor:pointer; font-family:inherit; }
      `}</style>

      {/* Logo */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", marginBottom:36 }}>
        <svg width="60" height="60" viewBox="0 0 32 32" fill="none" style={{marginBottom:12}}>
          <rect x="2" y="2" width="28" height="28" rx="7" stroke={C.terra} strokeWidth="2.5" fill={C.terraLight}/>
          <path d="M9.5 16.5L13.5 20.5L22.5 11.5" stroke={C.terra} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5 }}>
          <span style={{color:C.text}}>Cuadre </span><span style={{color:C.terra}}>MX</span>
        </div>
        <div style={{ fontSize:16, color:C.terra, fontWeight:700, marginTop:6 }}>{APP_SLOGAN}</div>
        <div style={{ fontSize:10, color:C.dim, fontFamily:"ui-monospace,monospace", marginTop:4 }}>{APP_VERSION}</div>
      </div>

      <div style={{ width:"100%", maxWidth:340 }}>

        {/* ── Tabs (solo si ya hay usuarios) ── */}
        {usuarios.length > 0 && (
          <div style={{ display:"flex", background:C.surface2, borderRadius:10, padding:3, marginBottom:20 }}>
            {[["login","Entrar"],["registro","Nuevo usuario"]].map(([m,l])=>(
              <button key={m} onClick={()=>{
                setModo(m); setError(""); setPin(""); setCodBeta("");
                setSel(null); setAdminOk(false); setClaveAdmin("");
              }}
                style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", fontWeight:600, fontSize:13,
                  background:modo===m?C.terra:"transparent", color:modo===m?"#fff":C.dim }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {/* ══════════════ LOGIN ══════════════ */}
        {modo === "login" && (
          <div>
            <div style={{ fontSize:13, color:C.dim, marginBottom:12 }}>Selecciona tu cuenta:</div>
            {usuarios.map(u => (
              <button key={u.id} onClick={()=>{ setSel(u); setPin(""); setCodBeta(""); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:8,
                  background:sel?.id===u.id?C.terraLight:C.surface,
                  border:`1px solid ${sel?.id===u.id?C.terra:C.border}`,
                  borderRadius:12, textAlign:"left" }}>
                <div style={{ width:36, height:36, borderRadius:999, background:C.terra, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:16, flexShrink:0 }}>
                  {u.nombre[0].toUpperCase()}
                </div>
                <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{u.nombre}</div>
              </button>
            ))}

            {sel && (
              <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:10 }}>
                <Field label="Tu PIN">
                  <div style={{ position:"relative" }}>
                    <input style={{...inputStyle, letterSpacing:6, fontSize:20, paddingRight:44}}
                      type={verPin?"text":"password"} inputMode="numeric" maxLength={8}
                      value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}
                      placeholder="● ● ● ●" autoFocus />
                    <button onClick={()=>setVerPin(v=>!v)}
                      style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.dim, padding:4 }}>
                      {verPin?<EyeOff size={16}/>:<Eye size={16}/>}
                    </button>
                  </div>
                </Field>

                {/* Código de acceso — solo si la cuenta no está activada aún */}
                {!sel.activado && (
                  <Field label="Código de acceso (solo primera vez)">
                    <input style={{...inputStyle, letterSpacing:2}}
                      type="text" value={codBeta}
                      onChange={e=>setCodBeta(e.target.value)}
                      placeholder="Código que te compartimos" />
                  </Field>
                )}

                <button onClick={entrar}
                  style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:C.terra, color:"#fff", fontWeight:700, fontSize:15 }}>
                  Entrar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ REGISTRO (solo admin) ══════════════ */}
        {modo === "registro" && (
          <div>
            {!adminOk ? (
              /* Paso A: verificar que eres el admin */
              <div>
                <div style={{ fontSize:13, color:C.dim, marginBottom:14, lineHeight:1.6 }}>
                  <Lock size={12} style={{verticalAlign:"middle", marginRight:4}}/> 
                  Esta sección es solo para el administrador.
                </div>
                <Field label="Contraseña de administrador">
                  <input style={{...inputStyle, letterSpacing:2}}
                    type="password" value={claveAdmin}
                    onChange={e=>setClaveAdmin(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter") verificarAdmin(); }}
                    placeholder="Contraseña admin" autoFocus />
                </Field>
                <button onClick={verificarAdmin}
                  style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.text, color:C.bg, fontWeight:700, fontSize:14, marginTop:4 }}>
                  Verificar
                </button>
              </div>
            ) : (
              /* Paso B: formulario para crear la cuenta del tester */
              <div>
                <div style={{ fontSize:12, color:C.positive, fontWeight:600, marginBottom:14, padding:"8px 12px", background:C.positiveLight, borderRadius:8 }}>
                  ✓ Admin verificado — crea la cuenta del tester
                </div>
                <Field label="Nombre del tester">
                  <input style={inputStyle} value={form.nombre}
                    onChange={e=>setForm({...form,nombre:e.target.value})}
                    placeholder="Ej. Nallely" autoFocus />
                </Field>
                <Field label="PIN para el tester (4–8 dígitos)">
                  <div style={{ position:"relative" }}>
                    <input style={{...inputStyle, letterSpacing:6, fontSize:20, paddingRight:44}}
                      type={verPinReg?"text":"password"} inputMode="numeric" maxLength={8}
                      value={form.pin} onChange={e=>setForm({...form,pin:e.target.value.replace(/\D/g,"")})}
                      placeholder="● ● ● ●" />
                    <button onClick={()=>setVerPinReg(v=>!v)}
                      style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.dim, padding:4 }}>
                      {verPinReg?<EyeOff size={16}/>:<Eye size={16}/>}
                    </button>
                  </div>
                </Field>
                <Field label="Confirmar PIN">
                  <input style={{...inputStyle, letterSpacing:6, fontSize:20}}
                    type="password" inputMode="numeric" maxLength={8}
                    value={form.pin2} onChange={e=>setForm({...form,pin2:e.target.value.replace(/\D/g,"")})}
                    placeholder="● ● ● ●" />
                </Field>
                <button onClick={registrar}
                  style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.terra, color:"#fff", fontWeight:700, fontSize:15, marginTop:4 }}>
                  Crear cuenta
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop:14, padding:"10px 12px", background:C.negativeLight, border:`1px solid ${C.negative}`, borderRadius:8, color:C.negative, fontSize:13, textAlign:"center" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop:24, textAlign:"center", fontSize:11, color:C.dim, lineHeight:1.6 }}>
          <Lock size={11} style={{verticalAlign:"middle", marginRight:4}}/>
          Tus datos son privados y solo accesibles con tu PIN.
          <br/>Beta cerrada — acceso por invitación.
        </div>
      </div>
    </div>
  );
}

// ─── Modal de configuración ───────────────────────────────────────────────────
function ModalConfig({ usuario, onCerrar, onLogout, onCambiarPin }) {
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinNuevo2, setPinNuevo2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const guardarPin = () => {
    if (pinActual !== usuario.pin) return setErr("PIN actual incorrecto.");
    if (pinNuevo.length < 4) return setErr("El nuevo PIN debe tener al menos 4 dígitos.");
    if (pinNuevo !== pinNuevo2) return setErr("Los PINs no coinciden.");
    onCambiarPin(pinNuevo);
    setErr(""); setOk("✓ PIN actualizado"); setCambiandoPin(false);
    setPinActual(""); setPinNuevo(""); setPinNuevo2("");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:C.surface, borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:480, paddingBottom:36 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontWeight:800, fontSize:17 }}>Configuración</div>
          <button onClick={onCerrar} style={{ background:"none", border:"none", color:C.dim }}><X size={20}/></button>
        </div>

        {/* Logo completo en configuración */}
        <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center", padding:"14px 0 18px", borderBottom:`1px solid ${C.border}`, marginBottom:16 }}>
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="2" width="28" height="28" rx="7" stroke={C.terra} strokeWidth="2.5" fill={C.terraLight}/>
            <path d="M9.5 16.5L13.5 20.5L22.5 11.5" stroke={C.terra} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>
              <span style={{color:C.text}}>Cuadre </span><span style={{color:C.terra}}>MX</span>
            </div>
            <div style={{ fontSize:11, color:C.terra, fontWeight:600 }}>{APP_SLOGAN}</div>
          </div>
        </div>

        {/* Perfil */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, padding:"14px 16px", background:C.surface2, borderRadius:14 }}>
          <div style={{ width:46, height:46, borderRadius:999, background:C.terra, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:20 }}>
            {usuario.nombre[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:C.text }}>{usuario.nombre}</div>
            <div style={{ fontSize:12, color:C.dim }}>{usuario.email || "Sin correo"}</div>
          </div>
        </div>

        {ok && <div style={{ padding:"8px 12px", background:C.positiveLight, border:`1px solid ${C.positive}`, borderRadius:8, color:C.positive, fontSize:13, marginBottom:12 }}>{ok}</div>}
        {err && <div style={{ padding:"8px 12px", background:C.negativeLight, border:`1px solid ${C.negative}`, borderRadius:8, color:C.negative, fontSize:13, marginBottom:12 }}>{err}</div>}

        {/* Cambiar PIN */}
        {!cambiandoPin ? (
          <button onClick={()=>{setCambiandoPin(true);setOk("");}}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"13px 16px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:10, fontWeight:600, fontSize:14, color:C.text }}>
            <Lock size={16} color={C.dim}/> Cambiar PIN
          </button>
        ) : (
          <div style={{...cardStyle, marginBottom:10}}>
            <Field label="PIN actual">
              <input style={{...inputStyle, letterSpacing:4}} type="password" inputMode="numeric" maxLength={8}
                value={pinActual} onChange={(e)=>setPinActual(e.target.value.replace(/\D/g,""))} placeholder="●●●●"/>
            </Field>
            <Field label="Nuevo PIN">
              <input style={{...inputStyle, letterSpacing:4}} type="password" inputMode="numeric" maxLength={8}
                value={pinNuevo} onChange={(e)=>setPinNuevo(e.target.value.replace(/\D/g,""))} placeholder="●●●●"/>
            </Field>
            <Field label="Confirmar nuevo PIN">
              <input style={{...inputStyle, letterSpacing:4}} type="password" inputMode="numeric" maxLength={8}
                value={pinNuevo2} onChange={(e)=>setPinNuevo2(e.target.value.replace(/\D/g,""))} placeholder="●●●●"/>
            </Field>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setCambiandoPin(false)}
                style={{ flex:1, padding:"10px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.dim, fontWeight:600, fontSize:13 }}>Cancelar</button>
              <button onClick={guardarPin}
                style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background:C.terra, color:"#fff", fontWeight:700, fontSize:13 }}>Guardar</button>
            </div>
          </div>
        )}

        {/* Cerrar sesión */}
        <button onClick={onLogout}
          style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px 16px", background:C.negativeLight, border:`1px solid ${C.negative}`, borderRadius:12, fontWeight:700, fontSize:14, color:C.negative }}>
          <LogOut size={16}/> Cerrar sesión
        </button>

        <div style={{ textAlign:"center", marginTop:18, fontSize:11, color:C.dim, fontFamily:"ui-monospace,monospace" }}>{APP_VERSION}</div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SalesTracker() {
  // ── Auth ──
  const [usuario, setUsuario]     = useState(null);
  const [authListo, setAuthListo] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Sesión en localStorage (por dispositivo) — nunca en Redis compartido
        const userId = localStorage.getItem(SESION_LOCAL);
        if (!userId) { setAuthListo(true); return; }
        const u = await window.storage.get(AUTH_KEY, false);
        const lista = u ? JSON.parse(u.value) : [];
        const found = lista.find(x => x.id === userId);
        if (found) setUsuario(found);
      } catch {}
      setAuthListo(true);
    })();
  }, []);

  const handleLogin  = (u) => { setUsuario(u); };
  const handleLogout = async () => {
    localStorage.removeItem(SESION_LOCAL);   // solo borra en este dispositivo
    setUsuario(null); setShowConfig(false);
  };
  const handleCambiarPin = async (nuevoPin) => {
    try {
      const r = await window.storage.get(AUTH_KEY, false);
      const lista = r ? JSON.parse(r.value) : [];
      const next = lista.map(u => u.id === usuario.id ? {...u, pin:nuevoPin} : u);
      await window.storage.set(AUTH_KEY, JSON.stringify(next), false);
      setUsuario(prev => ({...prev, pin:nuevoPin}));
    } catch {}
  };

  if (!authListo) return (
    <div style={{ background:C.bg, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:C.dim }}>cargando…</div>
  );
  if (!usuario) return <PantallaAuth onLogin={handleLogin}/>;

  // ── App data ──
  return (
    <AppData
      usuario={usuario}
      showConfig={showConfig}
      setShowConfig={setShowConfig}
      onLogout={handleLogout}
      onCambiarPin={handleCambiarPin}
    />
  );
}

// ─── AppData: datos y UI principal ────────────────────────────────────────────
function AppData({ usuario, showConfig, setShowConfig, onLogout, onCambiarPin }) {
  const K = dataKeys(usuario.id);

  const [tab, setTab]                     = useState("pedidos");
  const [inventario, setInventario]       = useState([]);
  const [pedidos, setPedidos]             = useState([]);
  const [retiros, setRetiros]             = useState([]);
  const [capitalInicial, setCapitalInicial] = useState(0);
  const [entradas, setEntradas]           = useState([]);
  const [ready, setReady]                 = useState(false);
  const [error, setError]                 = useState(null);
  const [modal, setModal]                 = useState(null);
  const [modalNuevoDia, setModalNuevoDia] = useState(false);
  const [pasoNuevoDia, setPasoNuevoDia] = useState("corte"); // "corte" | "apertura"
  const [corteInput, setCorteInput] = useState("");
  const [editandoCapital, setEditandoCapital] = useState(false);
  const [capitalInput, setCapitalInput]   = useState("");
  const [showAddItem, setShowAddItem]     = useState(false);
  const [showAddPedido, setShowAddPedido] = useState(false);
  const [showAddRetiro, setShowAddRetiro] = useState(false);
  const [filtroEstado, setFiltroEstado]   = useState("todos");
  const [filtroFecha, setFiltroFecha]     = useState("todo");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [busqueda, setBusqueda]           = useState("");
  const [limitePedidos, setLimitePedidos] = useState(15);
  const [exportModal, setExportModal]     = useState(null);
  const [copiado, setCopiado]             = useState(false);
  // Modal "producto rápido" desde pedidos
  const [modalProductoRapido, setModalProductoRapido] = useState(false);
  const [productoRapido, setProductoRapido] = useState({ nombre:"", costo:"", precio:"" });
  // Estado de turno de caja: "abierto" | "cerrado"
  const [estadoCaja, setEstadoCaja] = useState("cerrado");
  // Tutorial: null = completado, 1 = "agrega producto", 2 = "registra pedido", 3 = "¡listo!"
  const [tutorialPaso, setTutorialPaso] = useState(null);
  // Resumen: acordeón costos
  const [costoAbierto, setCostoAbierto] = useState(false);
  // Pedido expandido (preview de detalle al tap)
  const [pedidoExpandido, setPedidoExpandido] = useState(null);
  // Menú de acciones ⋮ del pedido
  const [menuAcciones, setMenuAcciones] = useState(null);
  // Saludo dinámico (se calcula una vez al montar)
  const saludo = useMemo(()=>getSaludo(usuario.nombre.split(" ")[0]),[usuario.nombre]);
  const importRef = useRef(null);

  // ── Carga inicial ──
  useEffect(() => {
    (async () => {
      const carga = async (key, fallback) => {
        try { const r = await window.storage.get(key, false); return r ? JSON.parse(r.value) : fallback; }
        catch { return fallback; }
      };
      const cargaStr = async (key, fallback) => {
        try { const r = await window.storage.get(key, false); return r ? r.value : fallback; }
        catch { return fallback; }
      };
      setInventario(await carga(K.INV, []));
      setPedidos(await carga(K.PED, []));
      setRetiros(await carga(K.RET, []));
      setEntradas(await carga(K.ENTR, []));
      setCapitalInicial(parseFloat(await cargaStr(K.CAP, "0")) || 0);
      setEstadoCaja((await cargaStr(K.CAJAE, "cerrado")) || "cerrado");
      // Tutorial: si nunca lo completó, arranca en paso 1
      const tutDone = await cargaStr(K.TUT, "no");
      if (tutDone !== "si") { setTutorialPaso(1); setTab("inventario"); }
      // Detección nuevo día
      const hoy = new Date().toISOString().slice(0,10);
      const ultimoDia = await cargaStr(K.DIA, null);
      if (ultimoDia && ultimoDia !== hoy) setModalNuevoDia(true);
      try { await window.storage.set(K.DIA, hoy, false); } catch {}
      setReady(true);
    })();
  }, [usuario.id]);

  // ── Persistencia ──
  const flashError = useCallback((msg, retry=null) => {
    setError({msg,retry}); setTimeout(()=>setError(cur=>(cur?.msg===msg?null:cur)), retry?8000:3500);
  }, []);

  const persist = useCallback(async (key, value, setter, label) => {
    setter(value);
    for (let i=0; i<3; i++) {
      try { const ok = await window.storage.set(key, JSON.stringify(value), false); if (ok) return; }
      catch {}
      if (i<2) await new Promise(r=>setTimeout(r,350*(i+1)));
    }
    flashError(`${label}: no se sincronizó.`, ()=>persist(key,value,setter,label));
  }, [flashError]);

  const pedir = useCallback((msg, detail, onConfirm) => setModal({msg,detail,onConfirm}), []);

  // ── Inventario ──
  const blankItem = { nombre:"", categoria:CATEGORIAS[0], marca:"", variante:"", costo:"", precio:"", stock:"" };
  const [newItem, setNewItem] = useState(blankItem);

  const addItem = () => {
    if (!newItem.nombre.trim()) return flashError("El nombre del producto es obligatorio.");
    const item = {
      id:uid(), nombre:newItem.nombre.trim(), categoria:newItem.categoria,
      marca:newItem.marca.trim(), variante:newItem.variante.trim(),
      costo:parseDecimal(newItem.costo), precio:parseDecimal(newItem.precio),
      stock: parseDecimal(newItem.stock||"0"),
    };
    persist(K.INV,[item,...inventario],setInventario,"Inventario");
    setNewItem(blankItem); setShowAddItem(false);

    feedbackGuardado();
    // Tutorial: avanza al paso 2 al guardar el primer producto
    if (tutorialPaso===1) { setTutorialPaso(2); setTab("pedidos"); }
  };
  const adjustStock = (id,delta) => persist(K.INV,inventario.map(it=>it.id===id?{...it,stock:Math.max(0,it.stock+delta)}:it),setInventario,"Inventario");
  const deleteItem  = (id) => {
    const it=inventario.find(x=>x.id===id);
    pedir(`¿Eliminar "${it?.nombre||"producto"}" del inventario?`,"Esta acción no se puede deshacer.",
      ()=>persist(K.INV,inventario.filter(x=>x.id!==id),setInventario,"Inventario"));
  };

  // ── Producto rápido desde pedidos ──
  const guardarProductoRapido = () => {
    if (!productoRapido.nombre.trim()) return flashError("El nombre del producto es obligatorio.");
    const costo  = parseDecimal(productoRapido.costo);
    const precio = parseDecimal(productoRapido.precio);
    if (precio<=0) return flashError("El precio de venta debe ser mayor a cero.");
    const item = {
      id:uid(), nombre:productoRapido.nombre.trim(), categoria:"Otra",
      marca:"", variante:"", costo, precio,
      stock: 1,
    };
    const invNext = [item,...inventario];
    persist(K.INV, invNext, setInventario, "Inventario");
    // Auto-seleccionar en el formulario de pedido con cantidad 1
    setNewPedido(prev=>({...prev, itemId:item.id, cantidad:"1"}));
    setProductoRapido({nombre:"",costo:"",precio:""});
    setModalProductoRapido(false);
    // Tutorial: si estaba en paso 1, avanza al 2 (ya tiene producto, ahora registra pedido)
    if (tutorialPaso===1) setTutorialPaso(2);
  };

  // ── Pedidos ──
  const blankPedido = { itemId:"", cantidad:"1", cliente:"", telefono:"", estado:"pendiente" };
  const [newPedido, setNewPedido] = useState(blankPedido);

  const addPedido = () => {
    const item = inventario.find(it=>it.id===newPedido.itemId);
    if (!item) return flashError("Selecciona un producto.");
    const cantidad = parseDecimal(newPedido.cantidad||"0");
    if (cantidad<=0) return flashError("La cantidad debe ser mayor a cero.");
    if (cantidad>item.stock) return flashError(`Solo hay ${item.stock} unidades en stock.`);
    let nombreCliente = newPedido.cliente.trim();
    if (!nombreCliente) {
      const nums = pedidos.map(p=>{const m=p.cliente?.match(/^CLIENTE\s+(\d+)$/i);return m?parseInt(m[1],10):0;}).filter(Boolean);
      nombreCliente = `CLIENTE ${String(nums.length?Math.max(...nums)+1:1).padStart(2,"0")}`;
    }
    const pedido = {
      id:uid(), itemId:item.id, nombre:item.nombre, categoria:item.categoria,
      marca:item.marca, variante:item.variante, cantidad,
      costoUnitario:item.costo, precioUnitario:item.precio,
      cliente:nombreCliente, telefono:newPedido.telefono.trim()||"",
      estado:newPedido.estado, fecha:ahoraLocal(),
    };
    const invNext = inventario.map(it=>it.id===item.id?{...it,stock:it.stock-cantidad}:it);
    persist(K.INV, invNext, setInventario, "Inventario");
    persist(K.PED, [pedido,...pedidos], setPedidos, "Pedidos");
    setNewPedido(blankPedido); setShowAddPedido(false);
    feedbackGuardado();
    // Tutorial: paso 3 = celebración, luego marcar como completado
    if (tutorialPaso===2) {
      setTutorialPaso(3);
      setTimeout(async () => {
        setTutorialPaso(null);
        await window.storage.set(K.TUT, "si", false).catch(()=>{});
      }, 10000);
    }
  };

  const cycleEstado = (id) => persist(K.PED,
    pedidos.map(p=>{ if(p.id!==id)return p; const idx=ESTADOS.findIndex(e=>e.id===p.estado); return {...p,estado:ESTADOS[(idx+1)%ESTADOS.length].id,fechaEstado:ahoraLocal()}; }),
    setPedidos,"Pedidos");

  const deletePedido = (id) => {
    const p=pedidos.find(x=>x.id===id);
    pedir(`¿Eliminar pedido de "${p?.cliente||"cliente"}"?`,"El stock se devolverá al inventario. Acción irreversible.",()=>{
      const inv=p?inventario.map(it=>it.id===p.itemId?{...it,stock:it.stock+p.cantidad}:it):inventario;
      persist(K.INV,inv,setInventario,"Inventario");
      persist(K.PED,pedidos.filter(x=>x.id!==id),setPedidos,"Pedidos");
    });
  };

  const marcarDevolucion = (id) => {
    const p=pedidos.find(x=>x.id===id);
    if(!p||p.devuelto)return;
    const huboCobro=p.estado==="pagado"||p.estado==="entregado";
    pedir(`¿Registrar devolución de ${p.cliente}?`,
      `Stock repuesto al inventario${huboCobro?" y salida registrada en Caja":""}.`,()=>{
      const invNext=inventario.map(it=>it.id===p.itemId?{...it,stock:it.stock+p.cantidad}:it);
      const pedNext=pedidos.map(x=>x.id===id?{...x,devuelto:true}:x);
      const retNext=huboCobro?[{id:uid(),monto:p.precioUnitario*p.cantidad,motivo:`Devolución — ${p.cliente}`,fecha:ahoraLocal()},...retiros]:retiros;
      persist(K.INV,invNext,setInventario,"Inventario");
      persist(K.PED,pedNext,setPedidos,"Pedidos");
      if(huboCobro)persist(K.RET,retNext,setRetiros,"Caja");
    });
  };

  // ── Caja ──
  const blankRetiro = { monto:"", motivo:MOTIVOS_RETIRO[0], motivoOtro:"" };
  const [newRetiro, setNewRetiro] = useState(blankRetiro);

  const addRetiro = () => {
    const monto=parseDecimal(newRetiro.monto);
    if(monto<=0)return flashError("El monto del retiro debe ser mayor a cero.");
    const motivoFinal=newRetiro.motivo==="Otro"&&newRetiro.motivoOtro.trim()?newRetiro.motivoOtro.trim():newRetiro.motivo;
    const retiro={id:uid(),monto,motivo:motivoFinal,fecha:ahoraLocal()};
    persist(K.RET,[retiro,...retiros],setRetiros,"Caja");
    setNewRetiro(blankRetiro); setShowAddRetiro(false);
  };
  const deleteRetiro = (id) => {
    const r=retiros.find(x=>x.id===id);
    pedir(`¿Eliminar movimiento "${r?.motivo||"retiro"}"?`,"Acción irreversible.",
      ()=>persist(K.RET,retiros.filter(x=>x.id!==id),setRetiros,"Caja"));
  };

  const guardarCapital = async () => {
    const monto=parseDecimal(capitalInput);
    if(monto<=0){flashError("El saldo debe ser mayor a cero.");return false;}
    // Limpiar entradas previas de "Caja al abrir" para evitar duplicados en historial
    const sinAperturasViejas = entradas.filter(e=>e.motivo!=="Caja al abrir");
    const entrada={id:uid(),monto,motivo:"Caja al abrir",fecha:ahoraLocal()};
    const nextEnt=[entrada,...sinAperturasViejas];
    setCapitalInicial(monto); setEntradas(nextEnt); setEditandoCapital(false);
    window.storage.set(K.CAP,String(monto),false).catch(()=>flashError("Capital: no se sincronizó."));
    persist(K.ENTR,nextEnt,setEntradas,"Caja");
    return true;
  };

  // ── Exportación ──
  const csvInventario = () => {
    const enc=["Categoría","Nombre","Marca","Variante","Costo","Precio","Stock","Margen %"];
    const filas=inventario.map(it=>[it.categoria,it.nombre,it.marca||"",it.variante||"",it.costo,it.precio,it.stock,
      it.precio>0?(((it.precio-it.costo)/it.precio)*100).toFixed(1)+"%":"0%"]);
    return [enc,...filas].map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
  };
  const csvPedidos = () => {
    const enc=["Fecha","Cliente","Producto","Categoría","Variante","Cantidad","Costo Unit.","Precio Unit.","Total","Utilidad","Estado","Devuelto"];
    const filas=pedidos.map(p=>[
      p.fecha?new Date(p.fecha).toLocaleDateString("es-MX"):"",p.cliente,
      `${p.marca?p.marca+" ":""}${p.nombre}`,p.categoria,p.variante||"",p.cantidad,
      p.costoUnitario,p.precioUnitario,p.precioUnitario*p.cantidad,
      (p.precioUnitario-p.costoUnitario)*p.cantidad,p.estado,p.devuelto?"Sí":"No",
    ]);
    return [enc,...filas].map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
  };
  const jsonRespaldo = () => JSON.stringify({version:APP_VERSION,fecha:ahoraLocal().slice(0,10),inventario,pedidos,retiros,entradas},null,2);

  // Descarga real (PWA/navegador). BOM para que Excel abra correctamente con acentos.
  const descargarArchivo = (contenido, nombre, tipo) => {
    try {
      const bom = tipo.includes("csv") ? "\uFEFF" : "";
      const blob = new Blob([bom + contenido], { type: tipo });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: abrir modal de copia si el blob falla (ej. artifact)
      setExportModal({ titulo: nombre, contenido });
    }
  };

  const exportarPedidosCSV = () => {
    const fecha = new Date().toISOString().slice(0,10);
    descargarArchivo(csvPedidos(), `cuadre-pedidos-${fecha}.csv`, "text/csv;charset=utf-8;");
  };
  const exportarInventarioCSV = () => {
    const fecha = new Date().toISOString().slice(0,10);
    descargarArchivo(csvInventario(), `cuadre-inventario-${fecha}.csv`, "text/csv;charset=utf-8;");
  };
  const exportarRespaldoJSON = () => {
    const fecha = new Date().toISOString().slice(0,10);
    descargarArchivo(jsonRespaldo(), `cuadre-respaldo-${fecha}.json`, "application/json");
  };

  const copiarAlPortapapeles = (texto) => {
    const fallback=()=>{const ta=document.createElement("textarea");ta.value=texto;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta);};
    (navigator.clipboard?.writeText(texto)||Promise.reject()).then(()=>{}).catch(fallback);
    setCopiado(true); setTimeout(()=>setCopiado(false),2000);
  };

  const importarRespaldo = (e) => {
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try {
        const d=JSON.parse(ev.target.result);
        if(!d.inventario||!d.pedidos||!d.retiros)throw new Error("Formato inválido");
        pedir("¿Restaurar respaldo?",`Se reemplazarán todos tus datos con el respaldo del ${d.fecha||"archivo seleccionado"}.`,()=>{
          persist(K.INV,d.inventario,setInventario,"Inventario");
          persist(K.PED,d.pedidos,setPedidos,"Pedidos");
          persist(K.RET,d.retiros,setRetiros,"Caja");
          if(d.entradas)persist(K.ENTR,d.entradas,setEntradas,"Caja");
        });
      } catch { flashError("El archivo no es un respaldo válido de Cuadre."); }
      e.target.value="";
    };
    reader.readAsText(file);
  };

  // ── Cálculos ──
  const resumen = useMemo(()=>{
    const activos=pedidos.filter(p=>!p.devuelto);
    const ingresos=activos.reduce((s,p)=>s+p.precioUnitario*p.cantidad,0);
    const costoVendido=activos.reduce((s,p)=>s+p.costoUnitario*p.cantidad,0);
    const utilidad=ingresos-costoVendido;
    const margen=ingresos>0?(utilidad/ingresos)*100:0;
    const valorInventario=inventario.reduce((s,it)=>s+it.costo*it.stock,0);
    const ingresosEfectivo=pedidos.filter(p=>!p.devuelto&&(p.estado==="pagado"||p.estado==="entregado")).reduce((s,p)=>s+p.precioUnitario*p.cantidad,0);
    const totalRetirado=retiros.reduce((s,r)=>s+r.monto,0);
    const caja=capitalInicial+ingresosEfectivo-totalRetirado;
    const unidades=inventario.reduce((s,i)=>s+i.stock,0);
    const porModelo={};
    activos.forEach(p=>{const k=`${p.nombre}${p.variante?` · ${p.variante}`:""}`;porModelo[k]=(porModelo[k]||0)+(p.precioUnitario-p.costoUnitario)*p.cantidad;});
    const top=Object.entries(porModelo).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const maxTop=top.length?Math.max(...top.map(([,v])=>Math.abs(v))):1;
    return {ingresos,costoVendido,utilidad,margen,valorInventario,ingresosEfectivo,totalRetirado,caja,unidades,top,maxTop};
  },[pedidos,inventario,retiros,capitalInicial]);

  if (!ready) return (
    <div style={{background:C.bg,height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.dim}}>cargando…</div>
  );

  // ── Render ──
  return (
    <div style={{background:C.bg,minHeight:"100dvh",color:C.text,fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif",paddingBottom:80}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root {
          background-color: ${C.bg};
          min-height: 100dvh;
          min-height: 100vh; /* fallback */
        }
        button { cursor:pointer; font-family:inherit; transition:opacity .15s,transform .1s; }
        button:active { opacity:.75; transform:scale(.98); }
        button:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid ${C.terra}; outline-offset:1px; }
        .mono { font-family:ui-monospace,'SF Mono',Menlo,monospace; font-variant-numeric:tabular-nums; }
        .lbl  { color:${C.dim}; font-size:10px; text-transform:uppercase; letter-spacing:0.6px; font-weight:600; }
        select { -webkit-appearance:none; appearance:none; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* ── Header fijo ── */}
      <div style={{
        position:"sticky", top:0, zIndex:50,
        background:C.bg,
        borderBottom:`1px solid ${C.border}`,
        boxShadow:"0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          {/* Izquierda: Avatar + saludo + indicador de sección */}
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            {/* Avatar circular — provisional con inicial */}
            <div style={{
              width:40,height:40,borderRadius:999,flexShrink:0,
              background:C.terra,color:"#fff",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontWeight:800,fontSize:17,
            }}>
              {usuario.nombre[0].toUpperCase()}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:C.textSub,lineHeight:1.2}}>
                {saludo.linea1}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"nowrap"}}>
                <div style={{fontSize:17,fontWeight:800,color:C.text,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {saludo.linea2}
                </div>
                {/* Pill indicador de sección activa */}
                {(()=>{
                  const cfg = TAB_CONFIG[tab];
                  return (
                    <div style={{
                      display:"inline-flex",alignItems:"center",gap:4,flexShrink:0,
                      padding:"3px 8px",borderRadius:999,
                      background:`${cfg.color}18`,
                      border:`1px solid ${cfg.color}40`,
                    }}>
                      <cfg.Icon size={11} color={cfg.color} strokeWidth={2.2}/>
                      <span style={{fontSize:11,fontWeight:700,color:cfg.color,letterSpacing:0.2}}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Derecha: Lentes + Engrane */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <button
              title="Modo Tianguis (próximamente)"
              onClick={()=>flashError("Modo Tianguis — próximamente 🕶️")}
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:8,color:C.dim,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Glasses size={17}/>
            </button>
            <button onClick={()=>setShowConfig(true)}
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:8,color:C.dim,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Settings size={17}/>
            </button>
          </div>
        </div>

      {/* ── Ticker (dentro del header fijo) ── */}
      <div className="mono" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderTop:`1px solid ${C.border}`}}>
        {[
          {lbl:"ganancia",Icon:TrendingUp,val:resumen.utilidad,color:resumen.utilidad>=0?C.positive:C.negative,fmt:fmtMoney(resumen.utilidad),arrow:true},
          {lbl:"unidades",Icon:Hash,val:resumen.unidades,color:C.text,fmt:String(resumen.unidades),arrow:false},
          {lbl:"caja",Icon:Wallet,val:resumen.caja,color:resumen.caja>=0?C.text:C.negative,fmt:fmtMoney(resumen.caja),arrow:true},
        ].map((t,i)=>(
          <div key={t.lbl} style={{textAlign:"center",padding:"10px 4px",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
              <t.Icon size={10} color={C.dim}/><span className="lbl">{t.lbl}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",color:t.color,fontWeight:700,marginTop:2,fontSize:15}}>
              {t.arrow&&<Indicator value={t.val}/>}{t.fmt}
            </div>
          </div>
        ))}
      </div>
      </div>{/* ── Fin header fijo ── */}

      {error && (
        <div style={{margin:"10px 16px",padding:"10px 12px",background:C.negativeLight,border:`1px solid ${C.negative}`,borderRadius:8,color:C.negative,fontSize:13,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <span>{error.msg}</span>
          {error.retry&&<button onClick={()=>{const r=error.retry;setError(null);r();}} style={{flexShrink:0,background:"transparent",border:`1px solid ${C.negative}`,color:C.negative,borderRadius:6,padding:"4px 9px",fontSize:12,fontWeight:700}}>Reintentar</button>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          INVENTARIO
      ══════════════════════════════════════════════════ */}
      {tab==="inventario"&&(
        <div style={{padding:"12px 16px"}}>
          {/* Fila: botón + filtro categoría */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,position:"relative",zIndex:tutorialPaso===1?210:1}}>
            <button onClick={()=>setShowAddItem(s=>!s)}
              style={{display:"flex",alignItems:"center",gap:6,background:showAddItem?C.surface2:C.terra,color:showAddItem?C.textSub:"#fff",border:showAddItem?`1px solid ${C.border}`:"none",borderRadius:8,padding:"10px 14px",fontWeight:700,fontSize:13,flexShrink:0,
                boxShadow:tutorialPaso===1?"0 0 0 4px rgba(224,92,53,0.4)":"none",
              }}>
              {showAddItem?<X size={16}/>:<Plus size={16}/>}{showAddItem?"Cancelar":"Nuevo producto"}
            </button>
            {!showAddItem&&(
              <div style={{flex:1,overflowX:"auto"}}>
                <div style={{display:"flex",gap:5,paddingBottom:2}}>
                  {["todas",...CATEGORIAS].map(cat=>{
                    const label = cat==="todas"?"Todas":cat.split(" ")[0];
                    const active = filtroCategoria===cat;
                    return (
                      <button key={cat} onClick={()=>setFiltroCategoria(cat)}
                        style={{flexShrink:0,padding:"5px 10px",borderRadius:999,fontSize:11,fontWeight:600,
                          border:`1.5px solid ${active?C.terra:C.border}`,
                          background:active?C.terra:C.surface,
                          color:active?"#fff":C.textSub,whiteSpace:"nowrap"}}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {showAddItem&&(
            <div style={{...cardStyle,position:"relative",zIndex:tutorialPaso===1?210:1}}>
              <Field label="Categoría">
                <select style={inputStyle} value={newItem.categoria} onChange={e=>setNewItem({...newItem,categoria:e.target.value})}>
                  {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Nombre / modelo">
                <input style={inputStyle} value={newItem.nombre} onChange={e=>setNewItem({...newItem,nombre:e.target.value})} placeholder="Air Force 1, iPhone 14, Suero facial…"/>
              </Field>
              <Field label="Marca (opcional)">
                <input style={inputStyle} value={newItem.marca} onChange={e=>setNewItem({...newItem,marca:e.target.value})} placeholder="Nike, Apple, L'Oréal…"/>
              </Field>
              <Field label="Variante (Opcional)">
                <input style={inputStyle} value={newItem.variante} onChange={e=>setNewItem({...newItem,variante:e.target.value})} placeholder="Talla, color, capacidad…"/>
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Field label="Costo (compra)">
                  <input style={inputStyle} type="text" inputMode="decimal" value={newItem.costo} onChange={e=>setNewItem({...newItem,costo:e.target.value})} placeholder="0.00"/>
                </Field>
                <Field label="Precio (venta)">
                  <input style={inputStyle} type="text" inputMode="decimal" value={newItem.precio} onChange={e=>setNewItem({...newItem,precio:e.target.value})} placeholder="0.00"/>
                </Field>
              </div>
              <Field label="Stock inicial">
                <QuantityInput
                  value={newItem.stock}
                  onChange={v=>setNewItem({...newItem,stock:v})}
                  min={0}
                  placeholder="0"
                />
              </Field>
              <button onClick={addItem}
                style={{width:"100%",background:C.terra,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,marginTop:4}}>
                Guardar producto
              </button>
            </div>
          )}

          {inventario.length===0&&!showAddItem&&(
            <div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"30px 0"}}>Aún no hay productos. Agrega el primero.</div>
          )}

          {inventario.filter(it=>filtroCategoria==="todas"||it.categoria===filtroCategoria).map(it=>{
            const margenPct = it.precio > 0 ? (((it.precio - it.costo) / it.precio) * 100).toFixed(0) : "—";
            return (
              <div key={it.id} style={{...cardStyle,position:"relative",padding:"12px 36px 12px 14px"}}>
                <button onClick={()=>deleteItem(it.id)} style={{position:"absolute",top:10,right:8,background:"none",border:"none",color:C.dim,padding:"6px 8px"}}><Trash2 size={14}/></button>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                  <span style={{fontWeight:700,fontSize:14,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.marca?`${it.marca} `:""}{it.nombre}</span>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,flexShrink:0}}>
                    <span className="mono" style={{fontSize:16,fontWeight:800}}>{fmtMoney(it.precio)}</span>
                    <span style={{fontSize:10,fontWeight:700,color:C.terra,background:C.terraLight,borderRadius:4,padding:"1px 5px",whiteSpace:"nowrap"}}>{margenPct}% margen</span>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4,fontSize:11.5,color:C.dim,gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,overflow:"hidden"}}>
                    <span style={{fontSize:9,color:C.blue,border:`1px solid ${C.blue}`,borderRadius:4,padding:"1px 5px",letterSpacing:0.5,flexShrink:0}}>{it.categoria.split(" ")[0].toUpperCase()}</span>
                    {it.variante&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.variante}</span>}
                  </div>
                  <span className="mono" style={{flexShrink:0}}>costo {fmtMoney(it.costo)}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10}}>
                  <span style={{fontSize:12,color:C.dim}}>Stock</span>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>adjustStock(it.id,-1)} style={{width:26,height:26,borderRadius:6,background:C.surface2,border:`1px solid ${C.border}`,color:C.text}}>−</button>
                    <span className="mono" style={{minWidth:20,textAlign:"center",fontWeight:700,color:it.stock===0?C.negative:C.text}}>{it.stock}</span>
                    <button onClick={()=>adjustStock(it.id,1)} style={{width:26,height:26,borderRadius:6,background:C.surface2,border:`1px solid ${C.border}`,color:C.text}}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PEDIDOS
      ══════════════════════════════════════════════════ */}
      {tab==="pedidos"&&(
        <div style={{padding:"12px 16px 24px"}}>
          {/* Fila: botón Nuevo pedido + buscador */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,position:"relative",zIndex:tutorialPaso===2?210:1}}>
            <button onClick={()=>{setShowAddPedido(s=>!s); if(!showAddPedido) setBusqueda("");}}
              style={{display:"flex",alignItems:"center",gap:6,background:showAddPedido?C.surface2:C.terra,color:showAddPedido?C.textSub:"#fff",border:showAddPedido?`1px solid ${C.border}`:"none",borderRadius:8,padding:"10px 14px",fontWeight:700,fontSize:13,flexShrink:0,
                boxShadow:tutorialPaso===2&&!showAddPedido?"0 0 0 4px rgba(42,125,79,0.4)":"none",
              }}>
              {showAddPedido?<X size={16}/>:<Plus size={16}/>}{showAddPedido?"Cancelar":"Nuevo pedido"}
            </button>
            {!showAddPedido&&(
              <div style={{position:"relative",flex:1}}>
                <Search size={14} color={C.dim} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
                <input
                  type="text"
                  value={busqueda}
                  onChange={e=>setBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  style={{...inputStyle,paddingLeft:30,paddingRight:busqueda?30:10,fontSize:13,height:42}}
                />
                {busqueda&&(
                  <button onClick={()=>setBusqueda("")}
                    style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.dim,padding:2,display:"flex"}}>
                    <X size={13}/>
                  </button>
                )}
              </div>
            )}
          </div>

          {showAddPedido&&(inventario.length===0?(
            <div style={{color:C.dim,fontSize:13,marginBottom:14}}>
              No tienes productos aún. 
              <button onClick={()=>{setModalProductoRapido(true);}} 
                style={{background:"none",border:"none",color:C.terra,fontWeight:700,fontSize:13,padding:"0 4px",textDecoration:"underline"}}>
                Agrega uno rápido aquí
              </button>
            </div>
          ):(
            <div style={{...cardStyle,position:"relative",zIndex:tutorialPaso===2?210:1}}>
              <Field label="Producto">
                <select style={inputStyle} value={newPedido.itemId} onChange={e=>setNewPedido({...newPedido,itemId:e.target.value})}>
                  <option value="">Selecciona…</option>
                  {inventario.map(it=>(
                    <option key={it.id} value={it.id} disabled={it.stock===0}>
                      {it.categoria.split(" ")[0]} · {it.marca?`${it.marca} `:""}{it.nombre}{it.variante?` · ${it.variante}`:""} (stock:{it.stock})
                    </option>
                  ))}
                </select>
              </Field>
              {/* Botón producto rápido */}
              <button onClick={()=>setModalProductoRapido(true)}
                style={{display:"flex",alignItems:"center",gap:6,width:"100%",padding:"8px 12px",marginBottom:10,
                  background:C.terraLight,border:`1px dashed ${C.terra}`,borderRadius:8,
                  color:C.terra,fontWeight:700,fontSize:12}}>
                <Zap size={13}/> ¿Producto nuevo? Registrar rápido
              </button>
              <Field label="Cantidad">
                <QuantityInput
                  value={newPedido.cantidad}
                  onChange={v=>setNewPedido({...newPedido,cantidad:v})}
                  min={0}
                  step={1}
                  placeholder="1"
                />
              </Field>
              <Field label="Cliente">
                <input style={inputStyle} value={newPedido.cliente} onChange={e=>setNewPedido({...newPedido,cliente:e.target.value})} placeholder="Nombre (opcional)"/>
              </Field>
              {/* Fila: Teléfono izquierda + Estado derecha */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <span style={labelStyle}>Teléfono</span>
                  <input
                    style={inputStyle}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={newPedido.telefono}
                    onChange={e=>setNewPedido({...newPedido,telefono:e.target.value.replace(/\D/g,"")})}
                    placeholder="(opcional)"
                  />
                </div>
                <div>
                  <span style={labelStyle}>Estado</span>
                  <select style={inputStyle} value={newPedido.estado} onChange={e=>setNewPedido({...newPedido,estado:e.target.value})}>
                    {ESTADOS.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={addPedido} style={{width:"100%",background:C.terra,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,marginTop:4}}>
                Registrar pedido
              </button>
            </div>
          ))}

          {/* ── Filtros: tabs de estado + toggle fecha ── */}
          {!showAddPedido&&(
            <div style={{marginBottom:12}}>
              {/* Tabs de estado + toggle fecha en una sola fila */}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {/* Estado tabs — scrollables */}
                <div style={{display:"flex",gap:5,overflowX:"auto",flex:1,paddingBottom:2}}>
                  {[{id:"todos",label:"Todos",color:C.terra},...ESTADOS,{id:"devuelto",label:"Devueltos",color:C.negative}].map(f=>(
                    <button key={f.id} onClick={()=>setFiltroEstado(f.id)}
                      style={{flexShrink:0,padding:"5px 11px",borderRadius:999,fontSize:12,fontWeight:600,transition:"all .15s",
                        border:`1.5px solid ${filtroEstado===f.id?(f.color||C.terra):C.border}`,
                        background:filtroEstado===f.id?(f.color||C.terra):C.surface,
                        color:filtroEstado===f.id?"#fff":C.textSub}}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* Separator */}
                <div style={{width:1,height:22,background:C.border,flexShrink:0}}/>
                {/* Fecha toggle discreto — se ignora cuando hay búsqueda activa */}
                <div style={{display:"flex",background:C.surface2,borderRadius:8,padding:2,flexShrink:0,gap:1,opacity:busqueda?0.4:1}}>
                  {[{id:"hoy",label:"Hoy"},{id:"semana",label:"Sem"},{id:"todo",label:"Todo"}].map(f=>(
                    <button key={f.id} onClick={()=>{ if(!busqueda) setFiltroFecha(f.id); }}
                      style={{padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,border:"none",
                        background:filtroFecha===f.id&&!busqueda?C.surface:"transparent",
                        color:filtroFecha===f.id&&!busqueda?C.text:C.dim,
                        boxShadow:filtroFecha===f.id&&!busqueda?"0 1px 3px rgba(0,0,0,0.10)":"none"}}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(()=>{
            const hoy=new Date();hoy.setHours(0,0,0,0);
            const sem=new Date(hoy);sem.setDate(hoy.getDate()-6);
            const q=busqueda.trim().toLowerCase();
            const filtrados=pedidos.filter(p=>{
              const estadoOk=filtroEstado==="todos"?true:filtroEstado==="devuelto"?p.devuelto:!p.devuelto&&p.estado===filtroEstado;
              if(!estadoOk)return false;
              if(!q){
                if(filtroFecha==="hoy"){const d=new Date(p.fecha);d.setHours(0,0,0,0);return d.getTime()===hoy.getTime();}
                if(filtroFecha==="semana")return new Date(p.fecha)>=sem;
              }
              if(q){
                const hay=(p.cliente||"").toLowerCase().includes(q)||(p.nombre||"").toLowerCase().includes(q)||(p.marca||"").toLowerCase().includes(q);
                return hay;
              }
              return true;
            });
            const visibles = filtrados.slice(0, limitePedidos);

            if(filtrados.length===0)return(
              <div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"24px 0"}}>
                {pedidos.length===0?"Sin pedidos todavía.":"Sin resultados para este filtro."}
              </div>
            );

            const grupos={};
            visibles.forEach(p=>{
              const dia=p.fecha?new Date(p.fecha).toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}):"Sin fecha";
              if(!grupos[dia])grupos[dia]=[];
              grupos[dia].push(p);
            });

            return (<>
              {Object.entries(grupos).map(([dia,lista])=>(
              <div key={dia} onClick={()=>setMenuAcciones(null)}>
                <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:"capitalize",letterSpacing:0.4,marginBottom:8,marginTop:4}}>{dia}</div>
                {lista.map(p=>{
                  const estado=ESTADOS.find(e=>e.id===p.estado);
                  const total=p.precioUnitario*p.cantidad;
                  const utilidad=(p.precioUnitario-p.costoUnitario)*p.cantidad;
                  const expandido = pedidoExpandido===p.id;
                  return(
                    <div key={p.id} style={{...cardStyle,position:"relative",padding:0,opacity:p.devuelto?.55:1,background:p.devuelto?C.surface:estado.tint,borderLeft:`3px solid ${p.devuelto?C.border:estado.color}`,overflow:"hidden"}}>

                      {/* ── Fila principal — siempre visible, tap para expandir ── */}
                      <div
                        onClick={()=>setPedidoExpandido(expandido?null:p.id)}
                        style={{padding:"12px 42px 12px 14px",cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}
                      >
                        {/* Avatar carrito */}
                        <div style={{
                          width:36,height:36,borderRadius:10,flexShrink:0,marginTop:1,
                          background:`${estado.color}18`,
                          border:`1px solid ${estado.color}30`,
                          display:"flex",alignItems:"center",justifyContent:"center",
                        }}>
                          <ShoppingCart size={16} color={estado.color} strokeWidth={2}/>
                        </div>

                        {/* Contenido */}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                              <span style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textDecoration:p.devuelto?"line-through":"none"}}>{p.cliente}</span>
                              {p.telefono&&<MessageCircle size={11} color="#25D366" style={{flexShrink:0}}/>}
                            </div>
                            <span className="mono" style={{fontSize:16,fontWeight:800,flexShrink:0}}>{fmtMoney(total)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:4,fontSize:11.5,color:C.dim,gap:8}}>
                            <span style={{flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.marca?`${p.marca} `:""}{p.nombre}{p.variante?` · ${p.variante}`:""} · x{p.cantidad}</span>
                            <span className="mono" style={{display:"flex",alignItems:"center",flexShrink:0,color:utilidad>=0?C.positive:C.negative}}>
                              <Indicator value={utilidad} size={11}/>{fmtMoney(utilidad)}
                            </span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,gap:8}}>
                            <div style={{fontSize:11,color:C.dim,lineHeight:1.7}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                                <Calendar size={11} color={C.dim} strokeWidth={1.8}/>{fmtFecha(p.fecha,true)}
                              </span>
                              {p.fechaEstado&&<span style={{marginLeft:8,opacity:.7}}>· act. {fmtFecha(p.fechaEstado)}</span>}
                            </div>
                            {p.devuelto?(
                              <span style={{display:"flex",alignItems:"center",gap:4,background:C.negativeLight,border:`1px solid ${C.negative}`,color:C.negative,borderRadius:999,padding:"4px 10px",fontSize:11,fontWeight:700,flexShrink:0}}>
                                <RotateCcw size={11}/> Devuelto
                              </span>
                            ):(
                              <button onClick={e=>{e.stopPropagation();cycleEstado(p.id);}}
                                style={{display:"flex",alignItems:"center",gap:4,background:"transparent",border:`1px solid ${estado.color}`,color:estado.color,borderRadius:999,padding:"4px 10px",fontSize:11,fontWeight:700,flexShrink:0}}>
                                {estado.label} <ChevronRight size={12}/>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── Panel expandido ── */}
                      {expandido&&(
                        <div style={{borderTop:`1px solid ${C.border}`,padding:"12px 14px",background:C.surface,display:"flex",flexDirection:"column",gap:8}}>
                          {p.telefono&&(
                            <a href={waLink(p.telefono)} target="_blank" rel="noopener noreferrer"
                              style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none",padding:"10px 12px",background:"rgba(37,211,102,0.10)",borderRadius:10,border:"1px solid #25D366"}}
                              onClick={e=>e.stopPropagation()}>
                              <MessageCircle size={18} color="#25D366" fill="#25D366" fillOpacity={0.15}/>
                              <div>
                                <div style={{fontSize:11,color:"#1DA851",fontWeight:600}}>Enviar WhatsApp</div>
                                <div style={{fontSize:15,fontWeight:700,color:C.text}}>{p.telefono}</div>
                              </div>
                            </a>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",marginBottom:2}}>Precio</div>
                              <div className="mono" style={{fontSize:13,fontWeight:700}}>{fmtMoney(p.precioUnitario)}</div>
                            </div>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",marginBottom:2}}>Cantidad</div>
                              <div className="mono" style={{fontSize:13,fontWeight:700}}>x{p.cantidad}</div>
                            </div>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.dim,textTransform:"uppercase",marginBottom:2}}>Ganancia</div>
                              <div className="mono" style={{fontSize:13,fontWeight:700,color:utilidad>=0?C.positive:C.negative}}>{fmtMoney(utilidad)}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ⋮ Botón de acciones — esquina superior derecha */}
                      {!p.devuelto&&(
                        <button
                          onClick={e=>{e.stopPropagation();setMenuAcciones(menuAcciones===p.id?null:p.id);setPedidoExpandido(null);}}
                          style={{position:"absolute",top:6,right:4,background:"none",border:"none",color:C.dim,padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"center",zIndex:6}}>
                          <MoreVertical size={20}/>
                        </button>
                      )}
                      {p.devuelto&&(
                        <button
                          onClick={e=>{e.stopPropagation();deletePedido(p.id);}}
                          style={{position:"absolute",top:6,right:4,background:"none",border:"none",color:C.dim,padding:"8px 10px",zIndex:6}}>
                          <Trash2 size={16}/>
                        </button>
                      )}

                      {/* Menú inline de acciones */}
                      {menuAcciones===p.id&&(
                        <div
                          onClick={e=>e.stopPropagation()}
                          style={{position:"absolute",top:36,right:8,zIndex:10,background:C.surface,borderRadius:12,boxShadow:"0 4px 20px rgba(0,0,0,0.18)",border:`1px solid ${C.border}`,overflow:"hidden",minWidth:160}}>
                          <button
                            onClick={()=>{setMenuAcciones(null);marcarDevolucion(p.id);}}
                            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:"none",border:"none",borderBottom:`1px solid ${C.border}`,color:C.textSub,fontSize:14,fontWeight:600,textAlign:"left"}}>
                            <RotateCcw size={16} color={C.terra}/> Devolver
                          </button>
                          <button
                            onClick={()=>{setMenuAcciones(null);deletePedido(p.id);}}
                            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"13px 16px",background:"none",border:"none",color:C.negative,fontSize:14,fontWeight:600,textAlign:"left"}}>
                            <Trash2 size={16} color={C.negative}/> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              ))}
              {filtrados.length > limitePedidos && (
                <button
                  onClick={()=>setLimitePedidos(l=>l+15)}
                  style={{width:"100%",padding:"11px",marginTop:4,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,color:C.terra,fontWeight:700,fontSize:13}}>
                  Ver {Math.min(15, filtrados.length - limitePedidos)} más ({filtrados.length - limitePedidos} restantes)
                </button>
              )}
              {limitePedidos > 15 && filtrados.length <= limitePedidos && (
                <button
                  onClick={()=>setLimitePedidos(15)}
                  style={{width:"100%",padding:"11px",marginTop:4,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,color:C.dim,fontWeight:600,fontSize:12}}>
                  Colapsar lista
                </button>
              )}
            </>);
          })()}

          {pedidos.length>15&&(
            <div style={{textAlign:"center",fontSize:12,color:C.dim,padding:"8px 0 4px"}}>
              Mostrando los 15 más recientes · usa los filtros para buscar más
            </div>
          )}

          {/* Espaciador final — evita que la última tarjeta y su menú ⋮ queden pegados al nav fijo */}
          <div style={{height:64}}/>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CAJA
      ══════════════════════════════════════════════════ */}
      {tab==="caja"&&(
        <div style={{padding:"12px 16px"}}>
          {/* Caja al abrir — con botones Sol (apertura) y Candado (cierre) */}
          <div style={cardStyle}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:0.5}}>Caja al abrir</div>
                <div className="mono" style={{fontSize:18,fontWeight:700,marginTop:4}}>{fmtMoney(capitalInicial)}</div>
                <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{
                    fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:999,
                    background:estadoCaja==="abierto"?C.positiveLight:C.negativeLight,
                    color:estadoCaja==="abierto"?C.positive:C.negative
                  }}>
                    {estadoCaja==="abierto"?"● Turno abierto":"● Turno cerrado"}
                  </span>
                </div>
              </div>
              {/* Botones de apertura / cierre */}
              <div style={{display:"flex",gap:8}}>
                {/* Botón SOL — Abrir caja. Solo disponible si está cerrada */}
                <button
                  onClick={()=>{
                    if(estadoCaja==="abierto") return flashError("Ya hay un turno abierto. Haz un cierre primero.");
                    setCapitalInput(String(capitalInicial||""));
                    setEditandoCapital(true);
                  }}
                  title="Abrir turno / apertura de caja"
                  style={{
                    width:48,height:48,borderRadius:12,border:"none",
                    background:estadoCaja==="cerrado"?C.positiveLight:"rgba(0,0,0,0.04)",
                    color:estadoCaja==="cerrado"?C.positive:C.dim,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:estadoCaja==="cerrado"?"pointer":"not-allowed",opacity:estadoCaja==="cerrado"?1:0.4
                  }}>
                  <Sun size={22}/>
                </button>
                {/* Botón CANDADO — Cerrar caja. Solo disponible si está abierta */}
                <button
                  onClick={()=>{
                    if(estadoCaja==="cerrado") return flashError("No hay turno abierto. Primero abre la caja con el sol ☀️");
                    pedir("¿Cerrar turno?","Se registrará el cierre de caja. No podrás abrir otro turno sin registrar una nueva apertura.",async()=>{
                      const corteId=uid();
                      const r={id:corteId,monto:resumen.caja,motivo:"Corte de Caja",fecha:ahoraLocal(),esCierre:true};
                      await persist(K.RET,[r,...retiros],setRetiros,"Caja");
                      await window.storage.set(K.CAJAE,"cerrado",false);
                      setEstadoCaja("cerrado");
                    });
                  }}
                  title="Cerrar turno / cierre de caja"
                  style={{
                    width:48,height:48,borderRadius:12,border:"none",
                    background:estadoCaja==="abierto"?C.negativeLight:"rgba(0,0,0,0.04)",
                    color:estadoCaja==="abierto"?C.negative:C.dim,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:estadoCaja==="abierto"?"pointer":"not-allowed",opacity:estadoCaja==="abierto"?1:0.4
                  }}>
                  <Lock size={20}/>
                </button>
              </div>
            </div>
            {editandoCapital&&(
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:12,color:C.dim}}>¿Con cuánto dinero abres hoy?</div>
                <div style={{display:"flex",gap:8}}>
                  <input style={{...inputStyle,flex:1}} type="text" inputMode="decimal" value={capitalInput} onChange={e=>setCapitalInput(e.target.value)} placeholder="0.00" autoFocus/>
                  <button onClick={async()=>{
                    const ok = await guardarCapital();
                    if(ok){
                      await window.storage.set(K.CAJAE,"abierto",false).catch(()=>{});
                      setEstadoCaja("abierto");
                    }
                  }} style={{background:C.positive,color:"#fff",border:"none",borderRadius:8,padding:"0 16px",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                    <Sun size={14}/> Abrir
                  </button>
                  <button onClick={()=>setEditandoCapital(false)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"0 12px",color:C.dim}}><X size={14}/></button>
                </div>
              </div>
            )}
          </div>

          {/* Caja disponible */}
          <div style={{...cardStyle,textAlign:"center",padding:18,border:`1.5px solid ${C.blue}`}}>
            <div style={{fontSize:11,color:C.blue,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>Dinero en Caja</div>
            <div className="mono" style={{fontSize:26,fontWeight:800,marginTop:6,display:"flex",alignItems:"center",justifyContent:"center",color:resumen.caja>=0?C.blue:C.negative}}>
              <Indicator value={resumen.caja} size={18}/>{fmtMoney(resumen.caja)}
            </div>
            <div className="mono" style={{fontSize:11,color:C.dim,marginTop:6}}>
              {capitalInicial>0&&<span>apertura {fmtMoney(capitalInicial)} + </span>}
              cobrado {fmtMoney(resumen.ingresosEfectivo)} − gastos {fmtMoney(resumen.totalRetirado)}
            </div>
          </div>

          {/* Registrar retiro */}
          <button onClick={()=>setShowAddRetiro(s=>!s)}
            style={{display:"flex",alignItems:"center",gap:6,background:C.terra,color:"#fff",border:"none",borderRadius:8,padding:"10px 14px",fontWeight:700,fontSize:13,margin:"12px 0"}}>
            {showAddRetiro?<X size={16}/>:<Plus size={16}/>}{showAddRetiro?"Cancelar":"Registrar retiro"}
          </button>

          {showAddRetiro&&(
            <div style={cardStyle}>
              <Field label="Monto">
                <input style={inputStyle} type="text" inputMode="decimal" value={newRetiro.monto} onChange={e=>setNewRetiro({...newRetiro,monto:e.target.value})} placeholder="0.00"/>
              </Field>
              <Field label="Motivo">
                <select style={inputStyle} value={newRetiro.motivo} onChange={e=>setNewRetiro({...newRetiro,motivo:e.target.value})}>
                  {MOTIVOS_RETIRO.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              {newRetiro.motivo==="Otro"&&(
                <Field label="Especifica (opcional)">
                  <input style={inputStyle} value={newRetiro.motivoOtro} onChange={e=>setNewRetiro({...newRetiro,motivoOtro:e.target.value})} placeholder="Detalle…"/>
                </Field>
              )}
              <button onClick={addRetiro} style={{width:"100%",background:C.terra,color:"#fff",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,marginTop:4}}>Guardar retiro</button>
            </div>
          )}

          {/* Movimientos */}
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,margin:"14px 0 8px"}}>Movimientos</div>
          {retiros.length===0&&entradas.length===0&&<div style={{color:C.dim,fontSize:13}}>Sin movimientos registrados.</div>}
          {[...entradas.map(e=>({...e,tipo:"entrada"})),...retiros.map(r=>({...r,tipo:"salida"}))]
            .sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
            .map(mov=>(
              <div key={mov.id} style={{...cardStyle,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="mono" style={{fontWeight:700,fontSize:14,color:mov.tipo==="entrada"?C.positive:C.negative}}>
                    {mov.tipo==="entrada"?"+ ":"− "}{fmtMoney(mov.monto)}
                  </div>
                  <div style={{fontSize:12,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mov.motivo} · {fmtFecha(mov.fecha,true)}</div>
                  {mov.esCierre&&<div style={{fontSize:10,color:C.negative,fontWeight:600,marginTop:2}}>🔒 Cierre de turno</div>}
                </div>
                {mov.tipo==="salida"&&(
                  <button onClick={()=>deleteRetiro(mov.id)} style={{background:"none",border:"none",color:C.dim,padding:"6px 8px",flexShrink:0}}><Trash2 size={15}/></button>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          RESUMEN
      ══════════════════════════════════════════════════ */}
      {tab==="resumen"&&(
        <div style={{padding:"12px 16px"}}>

          {/* ── Fila 1: Ventas vs Ganancia — apiladas, números completos ── */}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
            {/* Ventas totales */}
            <div style={{...cardStyle,marginBottom:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>Ventas totales</div>
              <div className="mono" style={{fontSize:18,fontWeight:800,color:C.text}}>{fmtMoney(resumen.ingresos)}</div>
            </div>
            {/* Tu Ganancia */}
            <div style={{...cardStyle,marginBottom:0,borderLeft:`4px solid ${resumen.utilidad>=0?C.positive:C.negative}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600}}>Tu Ganancia</div>
                <div style={{fontSize:11,color:C.dim,marginTop:1}}>{resumen.margen.toFixed(1)}% de margen</div>
              </div>
              <div className="mono" style={{fontSize:18,fontWeight:800,color:resumen.utilidad>=0?C.positive:C.negative,display:"flex",alignItems:"center"}}>
                <Indicator value={resumen.utilidad} size={14}/>{fmtMoney(resumen.utilidad)}
              </div>
            </div>
          </div>

          {/* ── Fila 2: Acordeón — Ver costos e inventario ── */}
          <div style={{...cardStyle,marginBottom:10,padding:0,overflow:"hidden"}}>
            <button
              onClick={()=>setCostoAbierto(v=>!v)}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",background:"none",border:"none",color:C.text}}>
              <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:13}}>
                <span>📊</span> Ver costos e inventario
              </div>
              <ChevronDown size={16} color={C.dim} style={{transform:costoAbierto?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}/>
            </button>
            {costoAbierto&&(
              <div style={{padding:"0 14px 14px",borderTop:`1px solid ${C.border}`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
                  <div>
                    <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>Lo que te costó</div>
                    <div className="mono" style={{fontSize:16,fontWeight:700,color:C.negative}}>{fmtMoney(resumen.costoVendido)}</div>
                    <div style={{fontSize:10,color:C.dim,marginTop:2}}>costo de mercancía vendida</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>Valor inventario</div>
                    <div className="mono" style={{fontSize:16,fontWeight:700}}>{fmtMoney(resumen.valorInventario)}</div>
                    <div style={{fontSize:10,color:C.dim,marginTop:2}}>en productos sin vender</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
                  <div style={{...cardStyle,marginBottom:0,border:`1px solid ${C.blue}`,padding:10}}>
                    <div style={{fontSize:11,color:C.blue,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Dinero en Caja</div>
                    <div className="mono" style={{fontSize:15,fontWeight:700,color:resumen.caja>=0?C.blue:C.negative,display:"flex",alignItems:"center"}}>
                      <Indicator value={resumen.caja} size={12}/>{fmtMoney(resumen.caja)}
                    </div>
                  </div>
                  <div style={{...cardStyle,marginBottom:0,padding:10}}>
                    <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>Gastos / Pagos</div>
                    <div className="mono" style={{fontSize:15,fontWeight:700,color:C.negative}}>{fmtMoney(resumen.totalRetirado)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Fila 3: Top 3 productos ── */}
          {resumen.top.length>0&&(
            <div style={cardStyle}>
              <div style={{fontSize:12,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12}}>Top 3 productos</div>
              {resumen.top.map(([name,val],i)=>(
                <div key={name} style={{marginBottom:i<resumen.top.length-1?14:0}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:5}}>
                    <span style={{fontSize:11,color:C.dim,fontWeight:700,minWidth:14}}>{i+1}.</span>
                    <span style={{fontSize:13,fontWeight:700,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                    <span style={{fontSize:11,color:val>=0?C.positive:C.negative,fontWeight:600,flexShrink:0}}>
                      {fmtMoney(val)}
                    </span>
                  </div>
                  {/* Barra de progreso horizontal verde */}
                  <div style={{height:7,background:C.surface2,borderRadius:4,overflow:"hidden"}}>
                    <div style={{
                      height:"100%",
                      width:`${Math.max(6,(Math.abs(val)/resumen.maxTop)*100)}%`,
                      background:val>=0
                        ? i===0?C.positive:i===1?"#3DA86A":"#6FC490"
                        : C.negative,
                      borderRadius:4,
                      transition:"width .4s ease",
                    }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
          {resumen.top.length===0&&(
            <div style={{...cardStyle,textAlign:"center",color:C.dim,fontSize:13,padding:24}}>
              Registra tu primera venta para ver tus productos estrella ✨
            </div>
          )}

          {/* ── Exportación ── */}
          <div style={{borderTop:`1px solid ${C.border}`,marginTop:20,paddingTop:16}}>
            <div style={{fontSize:12,color:C.dim,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Datos y respaldo</div>
            <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Los archivos CSV abren directo en Excel y Google Sheets.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <button onClick={exportarPedidosCSV}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"11px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:12,fontWeight:600}}>
                <Download size={14} color={C.terra}/> Pedidos .csv
              </button>
              <button onClick={exportarInventarioCSV}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"11px 8px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:12,fontWeight:600}}>
                <Download size={14} color={C.terra}/> Inventario .csv
              </button>
            </div>
            <button onClick={exportarRespaldoJSON}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"11px",background:C.surface,border:`1px solid ${C.blue}`,borderRadius:10,color:C.blue,fontSize:12,fontWeight:700,marginBottom:8}}>
              <FileJson size={14}/> Descargar respaldo completo (.json)
            </button>
            <button onClick={()=>importRef.current?.click()}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"11px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.dim,fontSize:12,fontWeight:600}}>
              <Upload size={14}/> Restaurar desde archivo .json
            </button>
            <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importarRespaldo}/>
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
        {[["pedidos",ClipboardList],["inventario",Package],["caja",Wallet],["resumen",LayoutDashboard]].map(([id,Icon])=>{
          const bloqueado = tutorialPaso===1&&id!=="inventario" || tutorialPaso===2&&id!=="pedidos";
          const pendientes = id==="pedidos" ? pedidos.filter(p=>!p.devuelto&&p.estado==="pendiente").length : 0;
          const badgeLabel = pendientes===0?null:pendientes>99?"99+":String(pendientes);
          return (
          <button key={id} onClick={()=>{ if(!bloqueado) setTab(id); }}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 0 16px",background:"transparent",border:"none",
              color:tab===id?C.terra:C.dim,
              opacity:bloqueado?0.25:1,
              position:"relative",zIndex:tutorialPaso?(id==="inventario"&&tutorialPaso===1||id==="pedidos"&&tutorialPaso===2?210:1):1
            }}>
            <div style={{position:"relative",display:"inline-flex"}}>
              <Icon size={26} strokeWidth={tab===id?2.2:1.6}/>
              {badgeLabel&&(
                <div style={{
                  position:"absolute",top:-6,right:-10,
                  minWidth:18,height:18,
                  background:"#E53935",
                  color:"#fff",
                  borderRadius:999,
                  fontSize:10,
                  fontWeight:800,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  padding:"0 4px",
                  border:`2px solid ${C.surface}`,
                  lineHeight:1,
                  fontFamily:"system-ui,sans-serif",
                }}>
                  {badgeLabel}
                </div>
              )}
            </div>
          </button>
          );
        })}
      </div>

      {/* ── Modal exportación ── */}
      {exportModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"16px 16px 0 0",padding:20,width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:15}}>{exportModal.titulo}</div>
              <button onClick={()=>{setExportModal(null);setCopiado(false);}} style={{background:"none",border:"none",color:C.dim,padding:4}}><X size={18}/></button>
            </div>
            <div style={{fontSize:11.5,color:C.dim,marginBottom:10}}>
              Toca <strong style={{color:C.text}}>Copiar</strong>, luego pega en Google Sheets o Notas. Columnas separadas por tabulaciones.
            </div>
            <textarea readOnly value={exportModal.contenido}
              style={{flex:1,minHeight:180,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:10,color:C.text,fontSize:11,fontFamily:"ui-monospace,monospace",resize:"none",outline:"none"}}
              onFocus={e=>e.target.select()}/>
            <button onClick={()=>copiarAlPortapapeles(exportModal.contenido)}
              style={{marginTop:12,width:"100%",padding:"12px",borderRadius:10,border:"none",background:copiado?C.positive:C.terra,color:"#fff",fontWeight:700,fontSize:14,transition:"background .2s"}}>
              {copiado?"✓ Copiado":"Copiar al portapapeles"}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal nuevo día ── */}
      {modalNuevoDia&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:"100%",maxWidth:320,boxShadow:"0 24px 48px rgba(0,0,0,0.15)"}}>

            {pasoNuevoDia==="corte"&&(<>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:10,background:"rgba(192,57,43,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Lock size={20} color={C.negative}/>
                </div>
                <div style={{fontWeight:800,fontSize:16}}>Cierre de Turno</div>
              </div>
              <div style={{fontSize:13,color:C.textSub,marginBottom:14,lineHeight:1.5}}>
                Antes de arrancar el nuevo día, ¿cuánto contaste físicamente en caja al cerrar ayer?
              </div>
              <input
                style={{...inputStyle,marginBottom:16}}
                type="text" inputMode="decimal"
                value={corteInput}
                onChange={e=>setCorteInput(e.target.value)}
                placeholder="$0.00 — escribe el monto contado"
                autoFocus
              />
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setModalNuevoDia(false)}
                  style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textSub,fontWeight:600,fontSize:13}}>
                  Omitir
                </button>
                <button onClick={()=>{
                  const monto=parseDecimal(corteInput);
                  if(monto>0){
                    const corteId=uid();
                    const r={id:corteId,monto,motivo:"Corte de Caja",fecha:ahoraLocal(),esCierre:true};
                    persist(K.RET,[r,...retiros],setRetiros,"Caja");
                  }
                  setCorteInput("");
                  setPasoNuevoDia("apertura");
                }}
                  style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:C.negative,color:"#fff",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <Lock size={14}/> Realizar Corte
                </button>
              </div>
            </>)}

            {pasoNuevoDia==="apertura"&&(<>
              <div style={{fontSize:22,marginBottom:6}}>☀️</div>
              <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>Apertura del día</div>
              <div style={{fontSize:13,color:C.textSub,marginBottom:14,lineHeight:1.5}}>
                ¿Con cuánto dinero arrancas hoy? Este será tu saldo de apertura.
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{setModalNuevoDia(false);setPasoNuevoDia("corte");}}
                  style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textSub,fontWeight:600,fontSize:13}}>
                  Ahora no
                </button>
                <button onClick={()=>{
                  setModalNuevoDia(false);
                  setPasoNuevoDia("corte");
                  setTab("caja");
                  setEditandoCapital(true);
                  setCapitalInput("");
                }}
                  style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:C.terra,color:"#fff",fontWeight:700,fontSize:13}}>
                  Configurar apertura
                </button>
              </div>
            </>)}

          </div>
        </div>
      )}

      {/* ── Modal confirmación ── */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:22,width:"100%",maxWidth:320,boxShadow:"0 24px 48px rgba(0,0,0,0.2)"}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{modal.msg}</div>
            <div style={{fontSize:12.5,color:C.dim,marginBottom:20}}>{modal.detail}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModal(null)}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontWeight:600,fontSize:13}}>Cancelar</button>
              <button onClick={()=>{modal.onConfirm();setModal(null);}}
                style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:C.negative,color:"#fff",fontWeight:700,fontSize:13}}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal configuración ── */}
      {showConfig&&(
        <ModalConfig
          usuario={usuario}
          onCerrar={()=>setShowConfig(false)}
          onLogout={onLogout}
          onCambiarPin={onCambiarPin}
        />
      )}

      {/* ── Modal producto rápido ── */}
      {modalProductoRapido&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:C.surface,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,paddingBottom:36,boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Zap size={18} color={C.terra}/>
                <span style={{fontWeight:800,fontSize:16}}>Producto nuevo — rápido</span>
              </div>
              <button onClick={()=>{setModalProductoRapido(false);setProductoRapido({nombre:"",costo:"",precio:""})}} style={{background:"none",border:"none",color:C.dim}}><X size={20}/></button>
            </div>
            <div style={{fontSize:12,color:C.dim,marginBottom:16}}>Se agrega al inventario y queda listo para este pedido.</div>
            <Field label="Nombre del producto">
              <input style={inputStyle} autoFocus value={productoRapido.nombre} onChange={e=>setProductoRapido(p=>({...p,nombre:e.target.value}))} placeholder="Ej. Tenis Nike Air Force…"/>
            </Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="¿Cuánto te costó?">
                <input style={inputStyle} type="text" inputMode="decimal" value={productoRapido.costo} onChange={e=>setProductoRapido(p=>({...p,costo:e.target.value}))} placeholder="0.00"/>
              </Field>
              <Field label="¿En cuánto lo vendes?">
                <input style={inputStyle} type="text" inputMode="decimal" value={productoRapido.precio} onChange={e=>setProductoRapido(p=>({...p,precio:e.target.value}))} placeholder="0.00"/>
              </Field>
            </div>
            {productoRapido.costo&&productoRapido.precio&&parseDecimal(productoRapido.precio)>0&&(
              <div style={{fontSize:12,color:C.positive,fontWeight:600,marginBottom:10,padding:"6px 10px",background:C.positiveLight,borderRadius:8}}>
                Margen: {(((parseDecimal(productoRapido.precio)-parseDecimal(productoRapido.costo))/parseDecimal(productoRapido.precio))*100).toFixed(1)}%
                {" · "}Ganancia: {fmtMoney(parseDecimal(productoRapido.precio)-parseDecimal(productoRapido.costo))} por unidad
              </div>
            )}
            <button onClick={guardarProductoRapido}
              style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:C.terra,color:"#fff",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <Zap size={15}/> Guardar y agregar al pedido
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TUTORIAL — overlay oscuro + tooltip con flecha
          Paso 1: Agrega producto  (tab inventario)
          Paso 2: Registra pedido  (tab pedidos)
          Paso 3: ¡Listo! celebración
      ══════════════════════════════════════════════════ */}
      {tutorialPaso&&(
        <div style={{position:"fixed",inset:0,zIndex:200,pointerEvents:"none"}}>
          {/* Overlay oscuro */}
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.72)",pointerEvents:tutorialPaso===3?"all":"all"}}
            onClick={tutorialPaso===3?async()=>{setTutorialPaso(null);await window.storage.set(K.TUT,"si",false).catch(()=>{});}:undefined}
          />

          {/* ── Paso 1: tooltip centrado, flecha abajo al nav ── */}
          {tutorialPaso===1&&(
            <div style={{position:"absolute",bottom:90,left:0,right:0,display:"flex",flexDirection:"column",alignItems:"center",pointerEvents:"none"}}>
              <div style={{
                background:"#fff",borderRadius:16,padding:"18px 22px",margin:"0 24px",maxWidth:320,
                boxShadow:"0 8px 32px rgba(0,0,0,0.32)",pointerEvents:"all",
                border:`2px solid ${C.terra}`,
              }}>
                <div style={{fontSize:13,fontWeight:800,color:C.terra,marginBottom:4}}>👋 Paso 1 de 2</div>
                <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6,lineHeight:1.4}}>
                  Primero agrega un producto a tu inventario
                </div>
                <div style={{fontSize:13,color:C.textSub,lineHeight:1.5}}>
                  Toca <strong style={{color:C.terra}}>+ Nuevo producto</strong> y llena nombre, costo y precio. ¡Solo tarda 30 segundos!
                </div>
                <div style={{textAlign:"center",marginTop:10,fontSize:22}}>↓</div>
              </div>
              <div style={{
                width:56,height:56,borderRadius:999,marginTop:8,
                border:`3px solid ${C.terra}`,background:"rgba(224,92,53,0.18)",
                animation:"pulse 1.4s ease-in-out infinite",pointerEvents:"none",
              }}/>
            </div>
          )}

          {/* ── Paso 2: tooltip arriba, flecha ARRIBA apuntando al header/boton Nuevo pedido ── */}
          {tutorialPaso===2&&(
            <div style={{position:"absolute",top:120,left:0,right:0,display:"flex",flexDirection:"column",alignItems:"flex-start",paddingLeft:16,pointerEvents:"none"}}>
              {/* Círculo resaltando el botón "Nuevo pedido" arriba */}
              <div style={{
                width:56,height:56,borderRadius:999,marginBottom:8,marginLeft:8,
                border:`3px solid ${C.positive}`,background:"rgba(42,125,79,0.18)",
                animation:"pulse-green 1.4s ease-in-out infinite",pointerEvents:"none",
              }}/>
              <div style={{
                background:"#fff",borderRadius:16,padding:"18px 22px",maxWidth:300,
                boxShadow:"0 8px 32px rgba(0,0,0,0.32)",pointerEvents:"all",
                border:`2px solid ${C.positive}`,marginLeft:0,
              }}>
                <div style={{fontSize:22,marginBottom:4}}>↑</div>
                <div style={{fontSize:13,fontWeight:800,color:C.positive,marginBottom:4}}>✅ Paso 2 de 2</div>
                <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6,lineHeight:1.4}}>
                  ¡Producto guardado! Ahora registra tu primera venta
                </div>
                <div style={{fontSize:13,color:C.textSub,lineHeight:1.5}}>
                  Toca <strong style={{color:C.positive}}>+ Nuevo pedido</strong>, selecciona el producto y confirma.
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: celebración — tap o 10s para cerrar ── */}
          {tutorialPaso===3&&(
            <div style={{
              position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
              padding:32,pointerEvents:"all",
            }}
              onClick={async()=>{setTutorialPaso(null);await window.storage.set(K.TUT,"si",false).catch(()=>{});}}
            >
              <div style={{
                background:"#fff",borderRadius:24,padding:"32px 28px",maxWidth:320,width:"100%",
                textAlign:"center",boxShadow:"0 16px 48px rgba(0,0,0,0.32)",
                border:`2px solid ${C.positive}`,
              }} onClick={e=>e.stopPropagation()}>
                <div style={{fontSize:52,marginBottom:12}}>🎉</div>
                <div style={{fontSize:20,fontWeight:800,color:C.positive,marginBottom:8}}>
                  ¡Ya tienes tu primer cuadre!
                </div>
                <div style={{fontSize:14,color:C.textSub,lineHeight:1.6,marginBottom:16}}>
                  Tu ganancia y tus números ya están corriendo. Sigue registrando tus ventas y Cuadre MX hace el resto.
                </div>
                <div style={{fontSize:12,color:C.dim,marginBottom:16}}>Cuadra tu negocio. 🧡</div>
                <button
                  onClick={async(e)=>{e.stopPropagation();setTutorialPaso(null);await window.storage.set(K.TUT,"si",false).catch(()=>{});}}
                  style={{padding:"11px 28px",background:C.terra,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14}}>
                  ¡Vamos! →
                </button>
                <div style={{fontSize:11,color:C.dim,marginTop:10}}>o toca en cualquier parte para continuar</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Animaciones del tutorial */}
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(224,92,53,0.5); }
          70%  { box-shadow: 0 0 0 14px rgba(224,92,53,0); }
          100% { box-shadow: 0 0 0 0 rgba(224,92,53,0); }
        }
        @keyframes pulse-green {
          0%   { box-shadow: 0 0 0 0 rgba(42,125,79,0.5); }
          70%  { box-shadow: 0 0 0 14px rgba(42,125,79,0); }
          100% { box-shadow: 0 0 0 0 rgba(42,125,79,0); }
        }
      `}</style>
    </div>
  );
}
