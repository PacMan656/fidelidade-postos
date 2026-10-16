import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, UserPlus, Target, Wrench, Fuel, Droplets, Medal, Zap, User, LogOut, RotateCcw, ChevronRight, Info } from "lucide-react";
import { c, brl } from "../../theme";
import { Logo } from "../../components/ui";
import { useApp } from "../../store/AppStore";

const PRIZE = 250; // meta de bônus da campanha → prêmio extra
const IDENT_PCT = 64; // % de vendas identificadas (meta 70)

function useCampaign() {
  const { s } = useApp();
  const fr = s.fr;
  const bonus = fr.cadastros * 5 + fr.trocas * 8 + fr.aditivos * 3 + fr.lavagens * 4;
  const metas = [
    { Icon: UserPlus, t: "Clientes cadastrados", cur: fr.cadastros, goal: 20, rule: "+ R$ 5 por cadastro" },
    { Icon: Target, t: "Vendas com CPF", cur: IDENT_PCT, goal: 70, pct: true, rule: "bônus ao bater 70%" },
    { Icon: Wrench, t: "Trocas de óleo", cur: fr.trocas, goal: 10, rule: "+ R$ 8 cada" },
    { Icon: Fuel, t: "Aditivos vendidos", cur: fr.aditivos, goal: 15, rule: "+ R$ 3 cada" },
    { Icon: Droplets, t: "Lavagens", cur: fr.lavagens, goal: 8, rule: "+ R$ 4 cada" },
  ];
  const board = [
    { name: "Marina S.", val: 240 },
    { name: "João P.", val: 150 },
    { name: "Pedro L.", val: 120 },
    { name: `Você (${s.staff.name})`, val: bonus, me: true },
  ].sort((a, b) => b.val - a.val);
  return { bonus, metas, board, prizePct: Math.min(100, Math.round((bonus / PRIZE) * 100)) };
}

function FrHeader({ title, sub }) {
  const nav = useNavigate();
  return (
    <div className="row between" style={{ padding: "calc(14px + var(--safe-top)) 18px 8px" }}>
      {title ? (
        <div><div className="title">{title}</div>{sub && <div className="subtitle">{sub}</div>}</div>
      ) : <Logo />}
      <button className="icon-box" style={{ borderRadius: 20, background: c.ink }} onClick={() => nav("/frentista/perfil")} aria-label="Perfil"><User size={19} color={c.yellow} /></button>
    </div>
  );
}

function CampaignMeter() {
  const { bonus, prizePct } = useCampaign();
  return (
    <div className="dark-panel">
      <div className="row between">
        <div className="row" style={{ gap: 6 }}><Trophy size={14} color={c.yellow} /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: c.yellow }}>CAMPANHA DO MÊS</span></div>
        <span style={{ fontSize: 11, color: "#caa6ad" }}>01–31</span>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#b08c92", fontWeight: 700 }}>BÔNUS ACUMULADO</div>
        <div className="mono" style={{ fontSize: 42, fontWeight: 700, color: c.yellow, letterSpacing: 1, textShadow: `0 0 18px ${c.yellow}55` }}>{brl(bonus)}</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="bar"><div style={{ width: `${prizePct}%` }} /></div>
        <div className="row between" style={{ marginTop: 6, fontSize: 10.5, color: "#caa6ad" }}>
          <span>{bonus >= PRIZE ? "Meta batida! 🎉" : `Faltam ${brl(PRIZE - bonus)} p/ o prêmio`}</span>
          <span>Prêmio: {brl(PRIZE)} + folga</span>
        </div>
      </div>
    </div>
  );
}

const sims = [
  { label: "+1 cadastro", k: "cadastros", msg: "Cliente cadastrado · + R$ 5", Icon: UserPlus },
  { label: "+1 troca de óleo", k: "trocas", msg: "Troca de óleo · + R$ 8", Icon: Wrench },
  { label: "+1 aditivo", k: "aditivos", msg: "Aditivo vendido · + R$ 3", Icon: Fuel },
  { label: "+1 lavagem", k: "lavagens", msg: "Lavagem · + R$ 4", Icon: Droplets },
];

export function Painel() {
  const nav = useNavigate();
  const { s, bumpFr } = useApp();
  const { board } = useCampaign();
  const myPos = board.findIndex((b) => b.me) + 1;
  return (
    <>
      <FrHeader />
      <div className="scroll with-nav screen-enter">
        <div className="px">
          <div className="title" style={{ fontSize: 20 }}>Olá, {s.staff.name} 👋</div>
          <div className="subtitle">{s.staff.station} · Frentista</div>
        </div>
        <div className="px mt12"><CampaignMeter /></div>

        <div className="grid2 px mt12">
          <button className="card tile" onClick={() => nav("/frentista/ranking")}>
            <Medal size={18} color={c.brand} />
            <div className="mono" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{myPos}º</div>
            <div className="subtitle" style={{ fontSize: 11.5 }}>no ranking</div>
          </button>
          <button className="card tile" onClick={() => nav("/frentista/metas")}>
            <Target size={18} color={c.brand} />
            <div className="mono" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{s.fr.cadastros}/20</div>
            <div className="subtitle" style={{ fontSize: 11.5 }}>cadastros no mês</div>
          </button>
        </div>

        <div className="px mt20">
          <div className="section-title">Registrar atendimento</div>
          <div className="grid2" style={{ gap: 8 }}>
            {sims.map((x) => (
              <button key={x.k} className="btn sm" onClick={() => bumpFr(x.k, x.msg)} style={{ height: 46 }}><x.Icon size={16} /> {x.label}</button>
            ))}
          </div>
          <div className="note mt12"><Info size={16} style={{ flexShrink: 0 }} /> Demonstração: em produção esses números vêm automaticamente do PDV — o frentista só acompanha.</div>
        </div>

        <div className="px mt20">
          <div className="section-title"><Zap size={16} color={c.brand} fill={c.brand} /> Desafios da semana</div>
          <div className="col" style={{ gap: 10 }}>
            {[{ t: "Cadastre 5 clientes hoje", r: "+ R$ 15 extra", Icon: UserPlus }, { t: "Bata 70% de identificação", r: "Bônus em dobro", Icon: Target }].map((d, i) => (
              <div key={i} className="card row" style={{ gap: 12, padding: 13 }}>
                <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: c.ink }}><d.Icon size={17} color={c.yellow} /></div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{d.t}</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: c.brandDeep, whiteSpace: "nowrap" }}>{d.r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function Metas() {
  const { metas, bonus } = useCampaign();
  return (
    <>
      <FrHeader title="Minhas metas" sub={`Bônus do mês: ${brl(bonus)}`} />
      <div className="scroll with-nav screen-enter">
        <div className="col px mt8" style={{ gap: 10 }}>
          {metas.map((m, i) => {
            const pct = Math.min(100, Math.round((m.cur / m.goal) * 100));
            const done = m.cur >= m.goal;
            return (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ gap: 11 }}>
                  <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: c.amberSoft }}><m.Icon size={18} color={c.brandDeep} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="row between">
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.t}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: done ? c.brand : c.ink }}>{m.cur}{m.pct ? "%" : ""}<span style={{ color: c.muted, fontWeight: 600 }}> / {m.goal}{m.pct ? "%" : ""}</span></span>
                    </div>
                    <div className="thin-bar" style={{ marginTop: 7 }}><div style={{ width: `${pct}%`, background: done ? c.brand : c.yellow }} /></div>
                  </div>
                </div>
                <div className="row between" style={{ marginTop: 8, marginLeft: 49 }}>
                  <span style={{ fontSize: 11.5, color: c.brandDeep, fontWeight: 700 }}>{m.rule}</span>
                  {done && <span className="chip" style={{ background: "#E7F4EC", color: c.green }}>BATIDA</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Ranking() {
  const { board } = useCampaign();
  const top = board.slice(0, 3);
  const podium = [top[1], top[0], top[2]];
  const heights = [96, 128, 76];
  return (
    <>
      <FrHeader title="Ranking" sub="Campanha do mês · Posto Centro" />
      <div className="scroll with-nav screen-enter">
        <div className="px">
          <div className="dark-panel row" style={{ alignItems: "flex-end", justifyContent: "center", gap: 10, paddingTop: 24 }}>
            {podium.map((p, i) => p && (
              <div key={p.name} className="col" style={{ alignItems: "center", flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: p.me ? c.yellow : "#fff", textAlign: "center" }}>{p.name}</div>
                <div className="mono" style={{ fontSize: 12, color: "#caa6ad", marginBottom: 6 }}>{brl(p.val)}</div>
                <div className="row center" style={{ width: "100%", height: heights[i], borderRadius: "12px 12px 0 0", background: i === 1 ? `linear-gradient(${c.yellow}, #C99A00)` : "rgba(255,255,255,.12)" }}>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 900, color: i === 1 ? c.ink : "#fff" }}>{i === 1 ? 1 : i === 0 ? 2 : 3}º</span>
                </div>
              </div>
            ))}
          </div>
          <div className="list-card mt16">
            {board.map((p, i) => (
              <div key={p.name} className="row" style={{ gap: 12, padding: "13px 14px", background: p.me ? c.pinkSoft : "transparent" }}>
                <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? "#C99A00" : c.muted, width: 26 }}>{i + 1}º</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: p.me ? 800 : 600 }}>{p.name}{i === 0 ? " 🏆" : ""}</span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: p.me ? c.brand : c.ink }}>{brl(p.val)}</span>
              </div>
            ))}
          </div>
          <div className="subtitle mt12" style={{ fontSize: 12 }}>O ranking considera o bônus acumulado na campanha. Atualiza a cada atendimento registrado.</div>
        </div>
      </div>
    </>
  );
}

export function FrPerfil() {
  const nav = useNavigate();
  const { s, logout, reset } = useApp();
  const { bonus, board } = useCampaign();
  return (
    <>
      <FrHeader title="Perfil" />
      <div className="scroll with-nav screen-enter">
        <div className="px">
          <div className="card row" style={{ gap: 14, padding: 16 }}>
            <div className="icon-box" style={{ width: 56, height: 56, borderRadius: 28, background: c.ink }}><User size={26} color={c.yellow} /></div>
            <div><div style={{ fontSize: 17, fontWeight: 800 }}>{s.staff.name}</div><div className="subtitle">Frentista · {s.staff.station}</div></div>
          </div>
          <div className="grid2 mt12">
            <div className="card"><div style={{ fontSize: 11, color: c.muted, fontWeight: 700 }}>BÔNUS</div><div className="mono" style={{ fontSize: 18, fontWeight: 800, color: c.brand }}>{brl(bonus)}</div></div>
            <div className="card"><div style={{ fontSize: 11, color: c.muted, fontWeight: 700 }}>POSIÇÃO</div><div className="mono" style={{ fontSize: 18, fontWeight: 800 }}>{board.findIndex((b) => b.me) + 1}º de {board.length}</div></div>
          </div>
          <div className="list-card mt16">
            {[["Minhas metas", "/frentista/metas"], ["Ranking da campanha", "/frentista/ranking"]].map(([t, to]) => (
              <button key={t} className="row" style={{ gap: 12, padding: 14, width: "100%" }} onClick={() => nav(to)}>
                <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 700 }}>{t}</span><ChevronRight size={17} color={c.muted} />
              </button>
            ))}
          </div>
          <button className="btn ghost mt16" onClick={reset}><RotateCcw size={17} /> Restaurar dados de demonstração</button>
          <button className="btn soft mt12" onClick={() => { logout(); nav("/entrar", { replace: true }); }}><LogOut size={17} /> Sair</button>
        </div>
      </div>
    </>
  );
}
