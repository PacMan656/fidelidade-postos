import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Zap, Receipt, AlertCircle, ArrowUpRight, ArrowDownLeft, Check, Ticket, Gift, MapPin, Info, Sun } from "lucide-react";
import { c, num } from "../../theme";
import { HomeHeader, Screen, RealQR, PointsMeter, Empty } from "../../components/ui";
import { useApp } from "../../store/AppStore";
import { useConfig } from "../../config/ConfigProvider";
import { iconOf } from "../../config/icons";

const useCatalog = () => {
  const { config } = useConfig();
  return {
    config,
    rewards: (config.rewards || []).filter((r) => r.active !== false),
    partners: (config.partners || []).filter((p) => p.active !== false),
  };
};

/* ---------- QR de identificação ---------- */
export function MeuQR() {
  const { s, issueCheckin } = useApp();
  const { config } = useConfig();
  const [bright, setBright] = useState(false);
  const [qr, setQr] = useState(null);
  const [left, setLeft] = useState(0);

  // RN-49: QR assinado pelo servidor, válido por 5 minutos; renova sozinho antes de vencer
  useEffect(() => {
    let alive = true, timer;
    const load = async () => {
      const r = await issueCheckin();
      if (!alive || !r) return;
      setQr(r);
      timer = setTimeout(load, Math.max(30_000, new Date(r.expiresAt).getTime() - Date.now() - 30_000));
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!qr) return undefined;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((new Date(qr.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [qr]);

  return (
    <Screen title="Meu QR Code">
      <div className="px" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Identifique-se no caixa</div>
        <div className="subtitle" style={{ marginTop: 2 }}>O operador lê este código para creditar seus pontos</div>
        <div className="row center" style={{ margin: "22px 0 14px" }}>
          <div style={{ padding: 18, borderRadius: 24, background: "#fff", border: `1px solid ${c.line}`, boxShadow: bright ? `0 0 0 6px ${c.yellow}` : "none", transition: "box-shadow .2s" }}>
            <RealQR value={qr?.token} size={220} />
          </div>
        </div>
        {qr && <div className="subtitle" style={{ fontSize: 12, marginBottom: 6 }}>Código renova automaticamente{left ? ` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : ""}</div>}
        <div className="mono" style={{ fontSize: 14, color: c.muted }}>{s.user.fullName} · CPF {s.user.cpf}</div>
        {s.offerActive && config.offer?.active && (
          <div className="row center mt16" style={{ padding: "11px 14px", borderRadius: 13, background: c.pinkSoft, color: c.brandDeep, fontSize: 13, fontWeight: 700, gap: 7 }}>
            <Zap size={15} fill={c.brandDeep} /> {config.offer?.qrBadge}
          </div>
        )}
        {s.banked.length > 0 && (
          <div className="row center mt8" style={{ padding: "11px 14px", borderRadius: 13, background: c.amberSoft, color: "#7C6210", fontSize: 13, fontWeight: 700, gap: 7 }}>
            {s.banked.reduce((a, b) => a + b.liters, 0)} L travados disponíveis para usar
          </div>
        )}
        <button className="btn ghost mt16" onClick={() => setBright(!bright)}><Sun size={18} /> {bright ? "Destaque ligado" : "Destacar código"}</button>
        <div className="subtitle mt12" style={{ fontSize: 12 }}>Aumente o brilho da tela se o leitor não reconhecer.</div>
      </div>
    </Screen>
  );
}

/* ---------- Extrato ---------- */
export function Extrato() {
  const { s } = useApp();
  const { config } = useConfig();
  const [filter, setFilter] = useState("todos");
  const list = s.tx.filter((t) => filter === "todos" || t.kind === filter);
  const ganhos = s.tx.filter((t) => t.kind === "in").reduce((a, t) => a + t.v, 0);
  const usados = s.tx.filter((t) => t.kind === "out").reduce((a, t) => a - t.v, 0);
  return (
    <Screen title="Extrato de pontos">
      <div className="px">
        <PointsMeter />
        <div className="grid2 mt12">
          <div className="card"><div style={{ fontSize: 11, color: c.muted, fontWeight: 700 }}>GANHOS</div><div className="mono" style={{ fontSize: 18, fontWeight: 800, color: c.green }}>+{num(ganhos)}</div></div>
          <div className="card"><div style={{ fontSize: 11, color: c.muted, fontWeight: 700 }}>RESGATADOS</div><div className="mono" style={{ fontSize: 18, fontWeight: 800, color: c.danger }}>−{num(usados)}</div></div>
        </div>
        {(s.expiringNotice ?? config.points?.expiringNotice) && <div className="row mt12" style={{ gap: 6, fontSize: 12, color: "#7C6210", fontWeight: 600 }}>
          <AlertCircle size={14} color="#9A7714" /> {s.expiringNotice ?? config.points.expiringNotice}
        </div>}
        <div className="segmented mt12">
          {[["todos", "Todos"], ["in", "Entradas"], ["out", "Saídas"]].map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="list-card mt12">
          {list.length === 0 && <div className="subtitle" style={{ padding: 20, textAlign: "center" }}>Nada por aqui.</div>}
          {list.map((t, i) => (
            <div key={i} className="row" style={{ gap: 12, padding: "12px 14px" }}>
              <div className="icon-box" style={{ width: 34, height: 34, borderRadius: 10, background: t.kind === "in" ? "#E7F4EC" : "#FBEAEA" }}>
                {t.kind === "in" ? <ArrowUpRight size={16} color={c.green} /> : <ArrowDownLeft size={16} color={c.danger} />}
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{t.t}</div><div style={{ fontSize: 11, color: c.muted }}>{t.d}</div></div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: t.kind === "in" ? c.green : c.danger }}>{t.v > 0 ? "+" : ""}{num(t.v)}</div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

/* ---------- Resgatar (aba) ---------- */

export default function Resgatar() {
  const nav = useNavigate();
  const { s } = useApp();
  const { rewards } = useCatalog();
  const cats = ["Todos", ...new Set(rewards.map((r) => r.cat))];
  const [cat, setCat] = useState("Todos");
  const list = rewards.filter((r) => cat === "Todos" || r.cat === cat);
  return (
    <>
      <HomeHeader />
      <div className="scroll with-nav screen-enter">
        <div className="px row between" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="title">Resgatar</div>
            <div className="subtitle">Saldo: <b style={{ color: c.ink }}>{num(s.points)} pts</b></div>
          </div>
          <button onClick={() => nav("/vouchers")} className="row" style={{ gap: 5, fontSize: 12.5, fontWeight: 800, color: c.brand }}>
            <Ticket size={15} /> Meus vouchers{s.vouchers.length ? ` (${s.vouchers.length})` : ""}
          </button>
        </div>
        <div className="row px mt12" style={{ gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {cats.map((k) => (
            <button key={k} onClick={() => setCat(k)} style={{ whiteSpace: "nowrap", padding: "7px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 800, border: `1px solid ${cat === k ? c.brand : c.line}`, background: cat === k ? c.brand : c.paper, color: cat === k ? "#fff" : c.ink }}>{k}</button>
          ))}
        </div>
        <div className="grid2 px mt12">
          {list.map((r) => {
            const ok = s.points >= r.cost;
            const Icon = iconOf(r.icon);
            return (
              <button key={r.id} className="card tile" onClick={() => nav(`/resgatar/${r.id}`)} style={{ borderRadius: 18, opacity: ok ? 1 : 0.65 }}>
                <div className="icon-box" style={{ width: 44, height: 44, borderRadius: 13, background: c.cream, marginBottom: 10 }}><Icon size={22} color={r.hue} /></div>
                <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.2 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{r.cat}</div>
                <div className="row" style={{ gap: 4, marginTop: 8 }}><span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{num(r.cost)}</span><span style={{ fontSize: 11, color: c.muted }}>pts</span></div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: ok ? c.brand : c.muted }}>{ok ? "Ver detalhes →" : `Faltam ${num(r.cost - s.points)} pts`}</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function DetalhePremio() {
  const { id } = useParams();
  const nav = useNavigate();
  const { s, redeem } = useApp();
  const { rewards, config } = useCatalog();
  const r = rewards.find((x) => x.id === id);
  const [confirming, setConfirming] = useState(false);
  if (!r) return <Screen title="Prêmio"><Empty Icon={Gift} title="Prêmio não encontrado" text="Ele pode ter saído do catálogo." /></Screen>;
  const ok = s.points >= r.cost;
  const Icon = iconOf(r.icon);

  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const v = await redeem(r);
    setBusy(false);
    if (v) nav(`/vouchers/${v.code}`, { replace: true, state: { fresh: true } });
  };

  return (
    <Screen title="Detalhes do prêmio">
      <div className="px">
        <div className="row center" style={{ height: 170, borderRadius: 22, background: c.paper, border: `1px solid ${c.line}` }}>
          <div className="icon-box" style={{ width: 88, height: 88, borderRadius: 28, background: c.cream }}><Icon size={44} color={r.hue} /></div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: c.muted, marginTop: 16 }}>{r.cat.toUpperCase()}</div>
        <div className="title" style={{ marginTop: 2 }}>{r.name}</div>
        <div className="row" style={{ gap: 5, marginTop: 6 }}><span className="mono" style={{ fontSize: 26, fontWeight: 700, color: c.brand }}>{num(r.cost)}</span><span className="subtitle">pontos</span></div>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: c.ink2 }}>{r.desc}</p>
        <div className="card col" style={{ gap: 8, fontSize: 13 }}>
          <div className="row" style={{ gap: 8 }}><Info size={15} color={c.muted} /> Válido por 30 dias após o resgate</div>
          <div className="row" style={{ gap: 8 }}><MapPin size={15} color={c.muted} /> {config.brand.name} · {(config.stations || []).join(", ")}</div>
        </div>

        <div className="row between mt16" style={{ padding: "12px 14px", borderRadius: 12, background: c.ink }}>
          <span style={{ fontSize: 12.5, color: c.onInk0 }}>Saldo após o resgate</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: ok ? c.yellow : "#ff8a95" }}>{num(s.points - r.cost)} pts</span>
        </div>

        {!confirming ? (
          <button className="btn grad mt16" disabled={!ok} onClick={() => setConfirming(true)}>{ok ? "Resgatar" : `Faltam ${num(r.cost - s.points)} pts`}</button>
        ) : (
          <div className="card mt16" style={{ borderColor: c.brand }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Confirmar resgate?</div>
            <div className="subtitle" style={{ marginTop: 2 }}>Serão debitados {num(r.cost)} pontos. Esta ação não pode ser desfeita.</div>
            <div className="grid2 mt12" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={() => setConfirming(false)}>Cancelar</button>
              <button className="btn sm" onClick={go} disabled={busy}>{busy ? "Resgatando…" : "Confirmar"}</button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}

export function Vouchers() {
  const nav = useNavigate();
  const { s } = useApp();
  return (
    <Screen title="Meus vouchers">
      {s.vouchers.length === 0 ? (
        <Empty Icon={Ticket} title="Nenhum voucher ainda" text="Troque seus pontos por serviços e produtos e eles aparecem aqui."
          action={<button className="btn sm mt12" style={{ width: "auto", padding: "0 18px" }} onClick={() => nav("/resgatar")}>Ver prêmios</button>} />
      ) : (
        <div className="px col" style={{ gap: 10 }}>
          {s.vouchers.map((v) => (
            <button key={v.code} className="card row" style={{ gap: 12, textAlign: "left" }} onClick={() => nav(`/vouchers/${v.code}`)}>
              <div className="icon-box" style={{ background: c.pinkSoft }}><Ticket size={19} color={c.brandDeep} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{v.name}</div><div className="mono" style={{ fontSize: 11.5, color: c.muted }}>{v.code} · {v.date}</div></div>
              <span className="chip" style={v.status === "ativo" ? { background: "#E7F4EC", color: c.green } : { background: c.cream, color: c.muted }}>{String(v.status).toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function Voucher() {
  const { code } = useParams();
  const nav = useNavigate();
  const { s } = useApp();
  const { config } = useConfig();
  const fresh = useLocation().state?.fresh;
  const v = s.vouchers.find((x) => x.code === code);
  if (!v && fresh) return <Screen title="Voucher"><Empty Icon={Ticket} title="Gerando seu voucher…" text={`Código ${code}`} /></Screen>;
  if (!v) return <Screen title="Voucher"><Empty Icon={Ticket} title="Voucher não encontrado" text="Confira em Meus vouchers." /></Screen>;
  return (
    <Screen title="Voucher" onBack={() => nav("/vouchers", { replace: true })}>
      <div className="px" style={{ textAlign: "center" }}>
        <div className="icon-box" style={{ width: 56, height: 56, borderRadius: 18, background: c.pinkSoft, margin: "6px auto 10px" }}><Check size={28} color={c.brandDeep} /></div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>Resgate confirmado</div>
        <div className="subtitle" style={{ fontSize: 14, marginTop: 2 }}>{v.name}</div>
        <div className="row center" style={{ margin: "18px 0 12px" }}>
          <div style={{ padding: 14, borderRadius: 18, background: "#fff", border: `1px solid ${c.line}` }}><RealQR value={v.code} size={180} /></div>
        </div>
        <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>{v.code}</div>
        <div className="subtitle" style={{ fontSize: 12, marginTop: 4 }}>Status: {String(v.status).toUpperCase()}{v.status === "ativo" ? ` · válido por ${config.vouchers?.validityDays ?? 30} dias` : ""}</div>
        <div className="note mt16" style={{ textAlign: "left" }}><Info size={16} style={{ flexShrink: 0 }} /> Apresente este código ao frentista ou no caixa. O voucher é de uso único.</div>
        <button className="btn mt16" onClick={() => nav("/inicio", { replace: true })}>Concluir</button>
      </div>
    </Screen>
  );
}

/* ---------- Clube (aba) ---------- */
export function Clube() {
  const nav = useNavigate();
  const { s, level } = useApp();
  const { partners } = useCatalog();
  return (
    <>
      <HomeHeader />
      <div className="scroll with-nav screen-enter">
        <div className="px">
          <div className="title">Clube de vantagens</div>
          <div className="subtitle">Benefícios em parceiros da sua cidade</div>
        </div>
        <div className="px mt8">
          <div style={{ borderRadius: 18, padding: 16, background: `linear-gradient(135deg, ${c.brandDeep}, ${c.brand})` }}>
            <div className="row" style={{ gap: 7 }}><Gift size={15} color={c.yellow} /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: c.onBrand }}>EXCLUSIVO NÍVEL {level.name.toUpperCase()}</span></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginTop: 6 }}>Cupons que pagam seu dia a dia</div>
          </div>
        </div>
        <div className="col px mt16" style={{ gap: 11 }}>
          {partners.map((p) => {
            const Icon = iconOf(p.icon);
            const saved = s.coupons.some((x) => x.partnerId === p.id);
            return (
              <button key={p.id} className="card row tile" style={{ gap: 13 }} onClick={() => nav(`/clube/${p.id}`)}>
                <div className="icon-box" style={{ width: 44, height: 44, borderRadius: 13, background: c.cream }}><Icon size={21} color={p.hue} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 12.5, color: c.brandDeep, fontWeight: 700 }}>{p.offer}</div></div>
                {saved ? <span className="chip" style={{ background: "#E7F4EC", color: c.green }}>GUARDADO</span> : <span style={{ padding: "8px 14px", borderRadius: 11, border: `1px solid ${c.line}`, background: c.cream, fontSize: 12.5, fontWeight: 800 }}>Ver</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function DetalheParceiro() {
  const { id } = useParams();
  const { s, saveCoupon } = useApp();
  const { partners } = useCatalog();
  const p = partners.find((x) => x.id === id);
  if (!p) return <Screen title="Parceiro"><Empty Icon={Gift} title="Parceiro não encontrado" text="Ele pode ter saído do clube." /></Screen>;
  const Icon = iconOf(p.icon);
  const coupon = s.coupons.find((x) => x.partnerId === p.id);
  return (
    <Screen title="Parceiro">
      <div className="px">
        <div className="card row" style={{ gap: 14, padding: 16 }}>
          <div className="icon-box" style={{ width: 60, height: 60, borderRadius: 18, background: c.cream }}><Icon size={28} color={p.hue} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{p.name}</div><div className="row subtitle" style={{ gap: 4, marginTop: 3 }}><MapPin size={13} /> {p.address}</div></div>
        </div>
        <div className="red-panel mt16" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: c.onBrand }}>SEU BENEFÍCIO</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{p.offer}</div>
        </div>
        <div className="eyebrow mt20">REGRAS</div>
        <div className="card" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{p.rules}</div>

        {coupon ? (
          <div className="card mt16" style={{ textAlign: "center" }}>
            <div className="subtitle">Mostre este código no parceiro</div>
            <div className="row center mt12"><RealQR value={coupon.code} size={150} /></div>
            <div className="mono mt12" style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2 }}>{coupon.code}</div>
          </div>
        ) : (
          <button className="btn grad mt16" onClick={() => saveCoupon(p)}><Ticket size={18} /> Guardar cupom na carteira</button>
        )}
      </div>
    </Screen>
  );
}

export const ExtratoIcon = Receipt;
