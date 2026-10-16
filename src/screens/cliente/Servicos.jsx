import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Lock, TrendingUp, Fuel, Car, Check, CalendarClock, Wrench, Bell, Zap, AlertCircle, ChevronRight, LogOut, RotateCcw, Ticket, Receipt, Pencil } from "lucide-react";
import { c, brl, num } from "../../theme";
import { Screen, Empty } from "../../components/ui";
import { useApp } from "../../store/AppStore";
import { maintIcons } from "../../store/data";
import { useConfig } from "../../config/ConfigProvider";

/* ---------- Trava de preço ---------- */
export function TravaPreco() {
  const { s, lockPrice } = useApp();
  const [busy, setBusy] = useState(false);
  const { config } = useConfig();
  const fuelPrices = config.fuelPrices;
  const presets = config.priceLock?.presets || [20, 30, 50];
  const [fuel, setFuel] = useState(Object.keys(fuelPrices)[0]);
  const [liters, setLiters] = useState(30);
  const total = (Number(liters) || 0) * fuelPrices[fuel];
  const totalBanked = s.banked.reduce((a, b) => a + b.liters, 0);

  return (
    <Screen title="Trava de preço">
      <div className="px">
        <div className="dark-panel">
          <div className="row" style={{ gap: 6 }}><Lock size={14} color={c.yellow} /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: c.yellow }}>MEU BANCO DE LITROS</span></div>
          <div className="row" style={{ gap: 6, alignItems: "flex-end", marginTop: 8 }}>
            <span className="mono" style={{ fontSize: 40, fontWeight: 700, color: c.yellow }}>{num(totalBanked)}</span>
            <span style={{ fontSize: 14, color: c.onInk1, marginBottom: 8 }}>litros travados</span>
          </div>
          <div style={{ fontSize: 12, color: c.onInk0 }}>Compre litros ao preço de hoje e abasteça quando quiser.</div>
        </div>

        <div className="field-label mt20">Combustível</div>
        <div className="grid3">
          {Object.keys(fuelPrices).map((f) => (
            <button key={f} className={`choice col ${fuel === f ? "on" : ""}`} onClick={() => setFuel(f)} style={{ gap: 2 }}>
              <span style={{ fontSize: 12.5 }}>{f}</span>
              <span className="mono" style={{ fontSize: 12, color: c.brandDeep }}>{brl(fuelPrices[f])}/L</span>
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: 5, marginTop: 14, marginBottom: 6, fontSize: 11.5, color: c.muted }}>
          <TrendingUp size={13} /> Trava válida por {config.priceLock?.validityDays || 30} dias · protege da alta
        </div>
        <div className="grid3">
          {presets.map((v) => <button key={v} className={`choice ${Number(liters) === v ? "on" : ""}`} onClick={() => setLiters(v)}>{v} L</button>)}
        </div>
        <div className="mt12">
          <label className="field-label" htmlFor="lit">Outra quantidade (litros)</label>
          <input id="lit" className="field mono" type="number" min="1" value={liters} onChange={(e) => setLiters(e.target.value)} />
        </div>

        <div className="row between mt12" style={{ padding: "12px 14px", borderRadius: 12, background: c.ink }}>
          <div style={{ fontSize: 11, color: c.onInk2 }}>Total a travar<br />{Number(liters) || 0} L × {brl(fuelPrices[fuel])}</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: c.yellow }}>{brl(total)}</div>
        </div>
        <button className="btn grad mt12" disabled={busy} onClick={async () => { setBusy(true); await lockPrice(fuel, Number(liters)); setBusy(false); }}>Travar {Number(liters) || 0} L · {brl(total)}</button>

        {s.banked.length > 0 && (
          <div className="mt20">
            <div className="eyebrow">MEUS LITROS TRAVADOS</div>
            <div className="col" style={{ gap: 8 }}>
              {s.banked.map((b, i) => {
                const saving = ((fuelPrices[b.fuel] ?? b.price) - b.price) * b.liters;
                return (
                  <div key={i} className="card row" style={{ gap: 11, padding: 12 }}>
                    <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: c.amberSoft }}><Fuel size={18} color={c.brandDeep} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.liters} L de {b.fuel}</div>
                      <div style={{ fontSize: 11.5, color: c.muted }}>Travado a {brl(b.price)}/L · {b.date}</div>
                    </div>
                    {saving > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: c.green, whiteSpace: "nowrap" }}>economia {brl(saving)}</span>}
                  </div>
                );
              })}
            </div>
            <div className="subtitle" style={{ fontSize: 11.5, marginTop: 8 }}>Apresente seu QR no caixa para abastecer usando os litros travados.</div>
          </div>
        )}
      </div>
    </Screen>
  );
}

/* ---------- Manutenção ---------- */
const chipOf = {
  proxima: ["#FFF6E2", "#9A7714", "Próxima"],
  emdia: ["#E7F4EC", "#2E9E5B", "Em dia"],
  atrasada: ["#FBEAEA", "#C0182B", "Atrasada"],
  dica: ["#FBF5EC", "#8A7A70", "Sempre"],
};

export function Manutencao() {
  const nav = useNavigate();
  const { s } = useApp();
  return (
    <Screen title="Manutenção do meu carro">
      <div className="px">
        <button className="dark-panel row" style={{ width: "100%", gap: 11, padding: 16, textAlign: "left" }} onClick={() => nav("/perfil/veiculo")}>
          <div className="icon-box" style={{ width: 44, height: 44, background: "rgba(255,255,255,.1)" }}><Car size={22} color={c.yellow} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{s.car.model}</div>
            <div className="mono" style={{ fontSize: 12, color: c.onInk1 }}>{s.car.plate} · ~{num(s.car.km)} km</div>
            <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 11.5, color: c.onInk0 }}><TrendingUp size={13} color={c.yellow} /> ~{num(s.car.kmMonth)} km/mês pelos seus abastecimentos</div>
          </div>
          <Pencil size={16} color={c.onInk1} />
        </button>

        <div className="col mt16" style={{ gap: 10 }}>
          {s.maint.map((m) => {
            const chip = chipOf[m.status];
            const Icon = maintIcons[m.id] || Wrench;
            const canBook = m.status === "proxima" || m.status === "atrasada";
            return (
              <div key={m.id} className="card" style={{ padding: 13 }}>
                <div className="row" style={{ gap: 11 }}>
                  <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: c.cream }}><Icon size={18} color={c.brandDeep} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{m.name}</span>
                      <span className="chip" style={{ color: chip[1], background: chip[0] }}>{chip[2]}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: c.muted, marginTop: 2 }}>{m.detail}</div>
                  </div>
                </div>
                {m.pct > 0 && <div className="thin-bar" style={{ marginTop: 10 }}><div style={{ width: `${m.pct}%`, background: m.pct >= 85 ? c.brand : c.yellow }} /></div>}
                {canBook && (m.scheduled
                  ? <div className="row" style={{ gap: 6, marginTop: 10, color: c.green, fontSize: 13, fontWeight: 800 }}><Check size={16} /> Agendado · {m.scheduled}{m.bonus ? " · 2× pontos" : ""}</div>
                  : <button className="btn sm mt12" onClick={() => nav(`/manutencao/agendar/${m.id}`)}><CalendarClock size={16} /> Agendar{m.bonus ? " · 2× pontos" : ""}</button>)}
              </div>
            );
          })}
        </div>
        <div className="subtitle" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.4 }}>Previsão a partir do seu histórico de abastecimento, ajustada à quilometragem informada no posto.</div>
      </div>
    </Screen>
  );
}

const nextDays = () => {
  const out = [];
  const d = new Date();
  for (let i = 1; out.length < 6; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i);
    if (x.getDay() !== 0) out.push(x);
  }
  return out;
};
const hours = ["08:00", "09:30", "11:00", "13:30", "15:00", "16:30"];

export function Agendar() {
  const { id } = useParams();
  const nav = useNavigate();
  const { s, scheduleMaint } = useApp();
  const { config } = useConfig();
  const stations = config.stations?.length ? config.stations : ["Matriz"];
  const m = s.maint.find((x) => x.id === id);
  const days = nextDays();
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(null);
  const [station, setStation] = useState(stations[0]);
  const [busy, setBusy] = useState(false);
  const slots = config.maintenance?.hours?.length ? config.maintenance.hours : hours;
  if (!m) return <Screen title="Agendar"><Empty Icon={Wrench} title="Serviço não encontrado" text="Volte à manutenção." /></Screen>;

  const fmt = (d) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", "");
  const confirm = async () => {
    const d = days[day];
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    const label = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hour} · ${station}`;
    setBusy(true);
    const ok = await scheduleMaint(m.id, { date, hour, station, label });
    setBusy(false);
    if (ok) nav("/manutencao", { replace: true });
  };

  return (
    <Screen title="Agendar serviço">
      <div className="px">
        <div className="card row" style={{ gap: 11 }}>
          <div className="icon-box" style={{ background: c.cream }}><Wrench size={19} color={c.brandDeep} /></div>
          <div><div style={{ fontSize: 14.5, fontWeight: 800 }}>{m.name}</div><div className="subtitle" style={{ fontSize: 12 }}>{s.car.model} · {s.car.plate}</div></div>
        </div>

        <div className="field-label mt20">Posto</div>
        <div className="grid2" style={{ gap: 8 }}>
          {stations.map((p) => <button key={p} className={`choice ${station === p ? "on" : ""}`} onClick={() => setStation(p)}>Posto {p}</button>)}
        </div>

        <div className="field-label mt16">Dia</div>
        <div className="grid3">
          {days.map((d, i) => <button key={i} className={`choice ${day === i ? "on" : ""}`} onClick={() => setDay(i)} style={{ textTransform: "capitalize", fontSize: 13 }}>{fmt(d)}</button>)}
        </div>

        <div className="field-label mt16">Horário</div>
        <div className="grid3">
          {slots.map((h) => <button key={h} className={`choice mono ${hour === h ? "on" : ""}`} onClick={() => setHour(h)}>{h}</button>)}
        </div>

        {m.bonus && <div className="note mt16"><Zap size={16} style={{ flexShrink: 0 }} /> Serviços agendados pelo app rendem pontos em dobro.</div>}
        <button className="btn grad mt16" disabled={!hour || busy} onClick={confirm}>{hour ? "Confirmar agendamento" : "Escolha um horário"}</button>
      </div>
    </Screen>
  );
}

/* ---------- Notificações ---------- */
const notifIcon = { oferta: Zap, alerta: AlertCircle, manutencao: Wrench, voucher: Ticket, carteira: Lock, bonus: Receipt };
const notifTarget = { oferta: "/inicio", alerta: "/extrato", manutencao: "/manutencao", voucher: "/vouchers", carteira: "/carteira", bonus: "/extrato" };

export function Notificacoes() {
  const nav = useNavigate();
  const { s, readAll, readOne } = useApp();
  const hasUnread = s.notifications.some((n) => !n.read);
  return (
    <Screen title="Notificações" right={hasUnread && <button onClick={readAll} style={{ fontSize: 12.5, fontWeight: 800, color: c.brand }}>Marcar lidas</button>}>
      {s.notifications.length === 0 ? <Empty Icon={Bell} title="Tudo em dia" text="Você não tem notificações." /> : (
        <div className="px col" style={{ gap: 10 }}>
          {s.notifications.map((n) => {
            const Icon = notifIcon[n.kind] || Bell;
            return (
              <button key={n.id} className="card row" style={{ gap: 12, textAlign: "left", alignItems: "flex-start", background: n.read ? c.paper : c.amberSoft }}
                onClick={() => { readOne(n.id); nav(notifTarget[n.kind] || "/inicio"); }}>
                <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: n.read ? c.cream : c.amberSoft }}><Icon size={18} color={c.brandDeep} /></div>
                <div style={{ flex: 1 }}>
                  <div className="row between"><span style={{ fontSize: 13.5, fontWeight: n.read ? 600 : 800 }}>{n.t}</span>{!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: c.brand }} />}</div>
                  <div style={{ fontSize: 12.5, color: c.ink2, marginTop: 3, lineHeight: 1.4 }}>{n.b}</div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 5 }}>{n.d}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

/* ---------- Perfil ---------- */
export function Perfil() {
  const nav = useNavigate();
  const { s, level, logout, reset } = useApp();
  const { config } = useConfig();
  const f = config.features || {};
  const items = [
    f.maintenance !== false && { Icon: Car, t: "Meu veículo", sub: `${s.car.model} · ${s.car.plate}`, to: "/perfil/veiculo" },
    { Icon: Ticket, t: "Meus vouchers", sub: `${s.vouchers.length} ativo(s)`, to: "/vouchers" },
    { Icon: Receipt, t: "Extrato de pontos", sub: `${num(s.points)} pts`, to: "/extrato" },
    f.priceLock !== false && { Icon: Lock, t: "Litros travados", sub: `${s.banked.reduce((a, b) => a + b.liters, 0)} L`, to: "/trava-de-preco" },
    { Icon: Bell, t: "Notificações", sub: `${s.notifications.filter((n) => !n.read).length} não lida(s)`, to: "/notificacoes" },
  ].filter(Boolean);
  return (
    <Screen title="Meu perfil">
      <div className="px">
        <div className="card row" style={{ gap: 14, padding: 16 }}>
          <div className="icon-box" style={{ width: 56, height: 56, borderRadius: 28, background: c.brand }}><span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{s.user.name[0]}</span></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{s.user.fullName}</div>
            <div className="mono subtitle" style={{ fontSize: 12 }}>CPF {s.user.cpf}</div>
            <span className="chip" style={{ display: "inline-block", marginTop: 5, background: c.ink, color: c.yellow }}>NÍVEL {level.name.toUpperCase()}</span>
          </div>
        </div>

        <div className="card col mt12" style={{ gap: 8, fontSize: 13 }}>
          <div className="row between"><span style={{ color: c.muted }}>Celular</span><span style={{ fontWeight: 700 }}>{s.user.phone}</span></div>
          <div className="row between"><span style={{ color: c.muted }}>E-mail</span><span style={{ fontWeight: 700 }}>{s.user.email}</span></div>
        </div>

        <div className="list-card mt16">
          {items.map((it) => (
            <button key={it.t} className="row" style={{ gap: 12, padding: 14, width: "100%", textAlign: "left" }} onClick={() => nav(it.to)}>
              <it.Icon size={19} color={c.brandDeep} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{it.t}</div><div style={{ fontSize: 11.5, color: c.muted }}>{it.sub}</div></div>
              <ChevronRight size={17} color={c.muted} />
            </button>
          ))}
        </div>

        {config.support && <div className="card col mt16" style={{ gap: 6, fontSize: 13 }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>ATENDIMENTO {config.brand.name.toUpperCase()}</div>
          <span style={{ userSelect: "all" }}>{config.support.phone}</span>
          <span style={{ userSelect: "all" }}>{config.support.email}</span>
        </div>}
        {reset && <button className="btn ghost mt16" onClick={reset}><RotateCcw size={17} /> Restaurar dados de demonstração</button>}
        <button className="btn soft mt12" onClick={async () => { await logout(); nav("/entrar", { replace: true }); }}><LogOut size={17} /> Sair</button>
      </div>
    </Screen>
  );
}

export function Veiculo() {
  const nav = useNavigate();
  const { s, updateCar, flash } = useApp();
  const blank = s.car.plate === "—";
  const [f, setF] = useState({ model: blank ? "" : s.car.model, plate: blank ? "" : s.car.plate, km: s.car.km ? String(s.car.km) : "" });
  const save = async () => {
    if (!f.model.trim() || !f.plate.trim()) return flash("Preencha modelo e placa", "err");
    if (!(Number(f.km) >= 0) || f.km === "") return flash("Informe a quilometragem atual", "err");
    const ok = await updateCar({ model: f.model.trim(), plate: f.plate.toUpperCase().trim(), km: Number(f.km) });
    if (ok) nav(-1);
  };
  return (
    <Screen title="Meu veículo">
      <div className="px col" style={{ gap: 12 }}>
        <div><label className="field-label">Modelo</label><input className="field" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
        <div><label className="field-label">Placa</label><input className="field mono" maxLength={8} value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value.toUpperCase() })} /></div>
        <div><label className="field-label">Quilometragem atual</label><input className="field mono" type="number" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></div>
        <div className="subtitle" style={{ fontSize: 12 }}>A quilometragem ajusta as previsões de manutenção.</div>
        <button className="btn mt8" onClick={save}>Salvar</button>
      </div>
    </Screen>
  );
}
