import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, UserPlus, Target, Wrench, Fuel, Droplets, Medal, Zap, User, LogOut, RotateCcw, ChevronRight, Info } from "lucide-react";
import { c, brl } from "../../theme";
import { Logo } from "../../components/ui";
import { useApp } from "../../store/AppStore";
import { useConfig } from "../../config/ConfigProvider";
import { iconOf } from "../../config/icons";

function useCampaign() {
  const { s } = useApp();
  const { config } = useConfig();
  const camp = config.campaign || { items: [], challenges: [] };
  const fr = s.fr;
  const items = camp.items || [];
  const bonus = items.reduce((a, it) => a + (fr[it.key] || 0) * it.reward, 0);
  const metas = [
    ...items.slice(0, 1).map((it) => ({ Icon: iconOf(it.icon), t: it.label, cur: fr[it.key] || 0, goal: it.goal, rule: `+ ${brl(it.reward)} por unidade` })),
    ...(camp.identGoal ? [{ Icon: Target, t: "Vendas com CPF", cur: camp.identPct || 0, goal: camp.identGoal, pct: true, rule: `bônus ao bater ${camp.identGoal}%` }] : []),
    ...items.slice(1).map((it) => ({ Icon: iconOf(it.icon), t: it.label, cur: fr[it.key] || 0, goal: it.goal, rule: `+ ${brl(it.reward)} cada` })),
  ];
  const board = [
    { name: "Marina S.", val: 240 },
    { name: "João P.", val: 150 },
    { name: "Pedro L.", val: 120 },
    { name: `Você (${s.staff.name})`, val: bonus, me: true },
  ].sort((a, b) => b.val - a.val);
  const prize = camp.prize || 0;
  return { camp, items, bonus, metas, board, prize, prizePct: prize ? Math.min(100, Math.round((bonus / prize) * 100)) : 0 };
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
  const { bonus, prizePct, camp, prize } = useCampaign();
  return (
    <div className="dark-panel">
      <div className="row between">
        <div className="row" style={{ gap: 6 }}><Trophy size={14} color={c.yellow} /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: c.yellow }}>{camp.name}</span></div>
        <span style={{ fontSize: 11, color: c.onInk1 }}>{camp.period}</span>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: c.onInk2, fontWeight: 700 }}>BÔNUS ACUMULADO</div>
        <div className="mono" style={{ fontSize: 42, fontWeight: 700, color: c.yellow, letterSpacing: 1, textShadow: `0 0 18px ${c.yellow}55` }}>{brl(bonus)}</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="bar"><div style={{ width: `${prizePct}%` }} /></div>
        <div className="row between" style={{ marginTop: 6, fontSize: 10.5, color: c.onInk1 }}>
          <span>{bonus >= prize ? "Meta batida! 🎉" : `Faltam ${brl(prize - bonus)} p/ o prêmio`}</span>
          <span>Prêmio: {camp.prizeLabel || brl(prize)}</span>
        </div>
      </div>
    </div>
  );
}


export function Painel() {
  const nav = useNavigate();
  const { s, bumpFr } = useApp();
  const { board, items, camp } = useCampaign();
  const first = items[0];
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
            <div className="mono" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{first ? `${s.fr[first.key] || 0}/${first.goal}` : "—"}</div>
            <div className="subtitle" style={{ fontSize: 11.5 }}>{first ? first.label.toLowerCase() : "metas"}</div>
          </button>
        </div>

        <div className="px mt20">
          <div className="section-title">Registrar atendimento</div>
          <div className="grid2" style={{ gap: 8 }}>
            {items.map((x) => { const Icon = iconOf(x.icon); return (
              <button key={x.key} className="btn sm" onClick={() => bumpFr(x.key, `${x.label} · + ${brl(x.reward)}`)} style={{ height: 46 }}><Icon size={16} /> {x.action}</button>
            ); })}
          </div>
          <div className="note mt12"><Info size={16} style={{ flexShrink: 0 }} /> Demonstração: em produção esses números vêm automaticamente do PDV — o frentista só acompanha.</div>
        </div>

        <div className="px mt20">
          <div className="section-title"><Zap size={16} color={c.brand} fill={c.brand} /> Desafios da semana</div>
          <div className="col" style={{ gap: 10 }}>
            {(camp.challenges || []).map((d, i) => { const Icon = iconOf(d.icon); return (
              <div key={i} className="card row" style={{ gap: 12, padding: 13 }}>
                <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: c.ink }}><Icon size={17} color={c.yellow} /></div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{d.title}</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: c.brandDeep, whiteSpace: "nowrap" }}>{d.reward}</span>
              </div>
            ); })}
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
  const { board, camp } = useCampaign();
  const staffStation = useApp().s.staff.station;
  const top = board.slice(0, 3);
  const podium = [top[1], top[0], top[2]];
  const heights = [96, 128, 76];
  return (
    <>
      <FrHeader title="Ranking" sub={`${camp.name || "Campanha"} · Posto ${staffStation}`} />
      <div className="scroll with-nav screen-enter">
        <div className="px">
          <div className="dark-panel row" style={{ alignItems: "flex-end", justifyContent: "center", gap: 10, paddingTop: 24 }}>
            {podium.map((p, i) => p && (
              <div key={p.name} className="col" style={{ alignItems: "center", flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: p.me ? c.yellow : "#fff", textAlign: "center" }}>{p.name}</div>
                <div className="mono" style={{ fontSize: 12, color: c.onInk1, marginBottom: 6 }}>{brl(p.val)}</div>
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
