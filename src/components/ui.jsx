import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Check, AlertCircle, Crown } from "lucide-react";
import { c, num } from "../theme";
import { useApp } from "../store/AppStore";

export function Logo({ size = "md" }) {
  const big = size === "lg";
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="row center" style={{ width: big ? 64 : 46, height: big ? 54 : 38, borderRadius: big ? 14 : 10, background: c.brand, boxShadow: `inset 0 -3px 0 ${c.brandDeep}` }}>
        <span style={{ fontSize: big ? 24 : 17, fontWeight: 900, color: "#fff", letterSpacing: 0.5, fontStyle: "italic" }}>PDR</span>
      </div>
      <div style={{ lineHeight: 1.0 }}>
        <div style={{ fontSize: big ? 10 : 7.5, letterSpacing: 1.5, color: c.muted, fontWeight: 800 }}>REDE DE POSTOS</div>
        <div style={{ fontSize: big ? 26 : 17, fontWeight: 900, color: c.wordmark, letterSpacing: -0.3 }}>DONA ROSA</div>
      </div>
    </div>
  );
}

export function HomeHeader() {
  const nav = useNavigate();
  const { s } = useApp();
  const unread = s.notifications.some((n) => !n.read);
  return (
    <div className="row between" style={{ padding: "calc(14px + var(--safe-top)) 18px 10px" }}>
      <Logo />
      <button className="round-btn" onClick={() => nav("/notificacoes")} aria-label="Notificações">
        <Bell size={18} color={c.ink2} />
        {unread && <span style={{ position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: 4, background: c.yellow }} />}
      </button>
    </div>
  );
}

export function TopBar({ title, right, onBack }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      <button className="round-btn" onClick={onBack || (() => nav(-1))} aria-label="Voltar"><ArrowLeft size={19} /></button>
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Screen({ title, right, children, onBack }) {
  return (
    <>
      <TopBar title={title} right={right} onBack={onBack} />
      <div className="scroll screen-enter">{children}</div>
    </>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  const err = toast.tone === "err";
  return (
    <div className="toast" role="status">
      {err ? <AlertCircle size={17} color="#ff8a95" /> : <Check size={17} color={c.yellow} />} {toast.m}
    </div>
  );
}

export function FakeQR({ size = 150, seed = 11 }) {
  const cells = 21;
  const grid = useMemo(() => {
    let st = seed;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return (st >> 16) & 1; };
    const g = Array.from({ length: cells }, () => Array.from({ length: cells }, rnd));
    const finder = (oy, ox) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const edge = y === 0 || y === 6 || x === 0 || x === 6, core = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        g[oy + y][ox + x] = edge || core ? 1 : 0;
      }
    };
    finder(0, 0); finder(0, cells - 7); finder(cells - 7, 0);
    return g;
  }, [seed]);
  const px = size / cells;
  return (
    <svg width={size} height={size} style={{ background: "#fff", borderRadius: 8, display: "block" }}>
      {grid.map((row, y) => row.map((v, x) => (v ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={c.ink} /> : null)))}
    </svg>
  );
}

export const seedOf = (str) => [...String(str)].reduce((a, ch) => a + ch.charCodeAt(0) * 7, 3);

export function PixGlyph({ size = 15, color = "#0B7A4C" }) {
  return <span style={{ display: "inline-block", width: size, height: size, background: color, borderRadius: 3, transform: "rotate(45deg) scale(.8)" }} />;
}

export function PointsMeter({ onClick }) {
  const { s, level } = useApp();
  return (
    <div className="dark-panel" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="row between">
        <div className="row" style={{ gap: 6 }}>
          <Crown size={14} color={c.yellow} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: c.yellow }}>NÍVEL {level.name.toUpperCase()}</span>
        </div>
        <span style={{ fontSize: 11, color: "#caa6ad" }}>{level.next ? `${num(level.faltam)} pts p/ ${level.next}` : "Nível máximo"}</span>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#b08c92", fontWeight: 700 }}>SALDO DE PONTOS</div>
        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <span className="mono" style={{ fontSize: 46, fontWeight: 700, color: c.yellow, letterSpacing: 2, textShadow: `0 0 18px ${c.yellow}55` }}>{num(s.points)}</span>
          <span style={{ fontSize: 13, color: "#caa6ad", marginBottom: 10 }}>pts</span>
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        <div className="bar"><div style={{ width: `${level.fill}%` }} /></div>
        <div className="row between" style={{ marginTop: 6, fontSize: 10, color: "#b08c92" }}>
          <span>{onClick ? "Toque para ver o extrato" : "Bronze · Prata · Ouro · Diamante"}</span>
          <span>{level.next || level.name}</span>
        </div>
      </div>
    </div>
  );
}

export function Empty({ Icon, title, text, action }) {
  return (
    <div className="col" style={{ alignItems: "center", textAlign: "center", padding: "40px 24px", gap: 8 }}>
      <div className="icon-box" style={{ width: 56, height: 56, borderRadius: 18, background: c.amberSoft }}><Icon size={26} color={c.brandDeep} /></div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
      <div className="subtitle" style={{ maxWidth: 260 }}>{text}</div>
      {action}
    </div>
  );
}
