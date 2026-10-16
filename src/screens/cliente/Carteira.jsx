import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Coins, Plus, Fuel, CreditCard, AlertCircle, Check, Trash2, Star, Ticket, ChevronRight } from "lucide-react";
import { c, brl, num } from "../../theme";
import { HomeHeader, Screen, PixGlyph, RealQR } from "../../components/ui";
import { useApp } from "../../store/AppStore";
import { useConfig } from "../../config/ConfigProvider";

const multLabel = (m) => (m === 2 ? "em dobro" : m === 3 ? "em triplo" : m > 1 ? `${m}×` : "");

export default function Carteira() {
  const nav = useNavigate();
  const { s } = useApp();
  const { config } = useConfig();
  const mult = config.points?.appMultiplier || 1;
  return (
    <>
      <HomeHeader />
      <div className="scroll with-nav screen-enter">
        <div className="px" style={{ paddingBottom: 6 }}>
          <div className="title">{config.texts?.walletName}</div>
          <div className="subtitle">{mult > 1 ? `Pague pelo app e ganhe pontos ${multLabel(mult)}` : "Pague pelo app e acumule pontos"}</div>
        </div>

        <div className="px mt8">
          <div className="red-panel">
            <div className="row" style={{ gap: 6 }}><Coins size={14} color={c.yellow} /><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, color: c.onBrand }}>SALDO PRÉ-PAGO</span></div>
            <div className="mono" style={{ fontSize: 38, fontWeight: 700, marginTop: 6 }}>{brl(s.prepaid)}</div>
            <div className="grid2" style={{ gap: 10, marginTop: 14 }}>
              <button onClick={() => nav("/carteira/adicionar-credito")} className="btn sm" style={{ height: 44, background: c.yellow, color: c.ink }}><Plus size={17} /> Adicionar</button>
              <button onClick={() => nav("/carteira/pagar")} className="btn sm" style={{ height: 44, border: "1px solid rgba(255,255,255,.5)", background: "rgba(255,255,255,.12)" }}><Fuel size={17} /> Pagar</button>
            </div>
          </div>
        </div>

        <div className="px mt20">
          <div className="row between">
            <div className="eyebrow">MEUS CARTÕES</div>
            <button onClick={() => nav("/carteira/cartoes")} style={{ fontSize: 12, fontWeight: 800, color: c.brand, marginBottom: 8 }}>Gerenciar</button>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {s.cards.map((card, i) => <CardRow key={card.id} card={card} main={i === 0} />)}
            <button onClick={() => nav("/carteira/adicionar-cartao")} className="row center" style={{ gap: 8, padding: 14, borderRadius: 15, border: `1.5px dashed ${c.brand}`, background: c.pinkSoft, color: c.brand, fontSize: 14, fontWeight: 800 }}>
              <Plus size={18} /> Adicionar cartão
            </button>
          </div>
        </div>

        {s.coupons.length > 0 && (
          <div className="px mt20">
            <div className="eyebrow">CUPONS GUARDADOS</div>
            <div className="list-card">
              {s.coupons.map((cp) => {
                const p = config.partners.find((x) => x.id === cp.partnerId);
                if (!p) return null;
                return (
                  <button key={cp.code} onClick={() => nav(`/clube/${p.id}`)} className="row" style={{ gap: 12, padding: 13, width: "100%", textAlign: "left" }}>
                    <Ticket size={18} color={c.brandDeep} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 12, color: c.brandDeep, fontWeight: 700 }}>{p.offer}</div></div>
                    <ChevronRight size={17} color={c.muted} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px mt16">
          <div className="note">
            <AlertCircle size={16} color="#9A7714" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Versão de demonstração. Dados de cartão são ilustrativos — nada é cobrado ou armazenado em servidor. Em produção, a cobrança passa por gateway certificado (PCI-DSS).</span>
          </div>
        </div>
      </div>
    </>
  );
}

function CardRow({ card, main, right }) {
  return (
    <div className="card row" style={{ gap: 12 }}>
      <div className="icon-box" style={{ width: 42, height: 42, borderRadius: 11, background: c.ink }}><CreditCard size={20} color={c.yellow} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{card.brand} •••• {card.last4}</div>
        <div style={{ fontSize: 11.5, color: c.muted }}>{card.kind}{main ? " · principal" : ""}</div>
      </div>
      {right || (main && <span style={{ fontSize: 10.5, fontWeight: 800, color: c.brandDeep, background: c.pinkSoft, padding: "4px 8px", borderRadius: 8 }}>PRINCIPAL</span>)}
    </div>
  );
}

export function Cartoes() {
  const nav = useNavigate();
  const { s, setMainCard, removeCard } = useApp();
  return (
    <Screen title="Meus cartões">
      <div className="px col" style={{ gap: 10 }}>
        {s.cards.length === 0 && <div className="subtitle" style={{ textAlign: "center", padding: 30 }}>Nenhum cartão cadastrado.</div>}
        {s.cards.map((card, i) => (
          <CardRow key={card.id} card={card} main={i === 0} right={
            <div className="row" style={{ gap: 6 }}>
              {i !== 0 && <button className="round-btn" style={{ width: 34, height: 34 }} onClick={() => setMainCard(card.id)} aria-label="Tornar principal"><Star size={16} color={c.brandDeep} /></button>}
              <button className="round-btn" style={{ width: 34, height: 34 }} onClick={() => removeCard(card.id)} aria-label="Remover"><Trash2 size={16} color={c.danger} /></button>
            </div>
          } />
        ))}
        <button className="btn mt8" onClick={() => nav("/carteira/adicionar-cartao")}><Plus size={18} /> Adicionar cartão</button>
        <div className="subtitle" style={{ fontSize: 12 }}>Toque na estrela para tornar um cartão o principal.</div>
      </div>
    </Screen>
  );
}

export function AdicionarCredito() {
  const nav = useNavigate();
  const { s, startPix, confirmPixDemo, watchPix, creditCard, flash, mode } = useApp();
  const { config } = useConfig();
  const pix = config.pix || {};
  const pixOn = config.features?.pix !== false && !!pix.key;
  const [amt, setAmt] = useState(100);
  const [method, setMethod] = useState(pixOn ? "pix" : "card");
  const [charge, setCharge] = useState(null); // cobrança Pix gerada
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const main = s.cards[0];

  // RN-35: o saldo só entra quando o banco confirma; a tela acompanha em tempo real
  useEffect(() => {
    if (!charge || charge.demo) return undefined;
    return watchPix(charge.txid, (st) => {
      setStatus(st);
      if (st === "paid") { flash(`Pix confirmado · ${brl(charge.amountCents / 100)} na carteira`); nav("/carteira", { replace: true }); }
    });
  }, [charge]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = (txt) => {
    navigator.clipboard?.writeText(txt).then(() => flash("Código Pix copiado"), () => flash("Toque e segure o código para copiar", "err"));
  };
  const generate = async () => { setBusy(true); const r = await startPix(amt); setBusy(false); if (r) { setCharge(r); setStatus("pending"); } };
  const payCard = async () => { setBusy(true); const ok = await creditCard(amt, main.id); setBusy(false); if (ok) nav("/carteira", { replace: true }); };
  const demoConfirm = async () => { if (await confirmPixDemo(amt)) nav("/carteira", { replace: true }); };
  const limits = config.wallet ? `Entre ${brl(config.wallet.minCredit)} e ${brl(config.wallet.maxCredit)} por recarga` : null;

  return (
    <Screen title="Adicionar crédito">
      <div className="px">
        <div className="subtitle">Saldo atual: <b style={{ color: c.ink }}>{brl(s.prepaid)}</b></div>

        {!charge && <>
          <div className="field-label mt16">Forma de pagamento</div>
          <div className="grid2" style={{ gap: 8 }}>
            {pixOn && <button className={`choice ${method === "pix" ? "on" : ""}`} onClick={() => setMethod("pix")}><PixGlyph /> Pix</button>}
            <button className={`choice ${method === "card" ? "on" : ""}`} onClick={() => setMethod("card")} disabled={!main}><CreditCard size={16} color={c.brandDeep} /> Cartão</button>
          </div>

          <div className="field-label mt16">Valor</div>
          <div className="grid3">
            {[50, 100, 200].map((v) => <button key={v} className={`choice ${Number(amt) === v ? "on" : ""}`} onClick={() => setAmt(v)}>{brl(v)}</button>)}
          </div>
          <div className="mt12">
            <label className="field-label" htmlFor="amt">Outro valor</label>
            <input id="amt" className="field mono" type="number" min="1" value={amt} onChange={(e) => setAmt(e.target.value)} />
            {limits && <div className="subtitle" style={{ fontSize: 11.5, marginTop: 5 }}>{limits}</div>}
          </div>
        </>}

        {method === "pix" ? (
          !charge ? (
            <button className="btn grad mt16" onClick={generate} disabled={busy}>{busy ? "Gerando…" : `Gerar Pix de ${brl(amt)}`}</button>
          ) : (
            <>
              <div className="card mt16" style={{ textAlign: "center" }}>
                <div className="row center" style={{ gap: 6, marginBottom: 10 }}><PixGlyph /><span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>PAGUE {brl(charge.amountCents / 100)} COM PIX</span></div>
                <div className="row center"><RealQR value={charge.brCode} size={190} /></div>
                <div style={{ fontSize: 12, color: c.muted, marginTop: 10 }}>{pix.keyLabel}</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{charge.pixKey || pix.key}</div>
                <div className="row" style={{ marginTop: 10, padding: "9px 10px", borderRadius: 10, background: c.cream, border: `1px solid ${c.line}`, gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: c.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", userSelect: "all" }}>{charge.brCode}</span>
                  <button onClick={() => copy(charge.brCode)} style={{ padding: "6px 11px", borderRadius: 9, background: c.ink, color: "#fff", fontSize: 12, fontWeight: 800 }}>Copiar</button>
                </div>
              </div>
              {charge.demo ? (
                <>
                  <button className="btn mt12" onClick={demoConfirm}>Já fiz o Pix · adicionar {brl(amt)}</button>
                  <div className="subtitle" style={{ fontSize: 11.5, marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>Modo demonstração: com o Firebase ligado, o crédito entra sozinho quando o banco confirma.</div>
                </>
              ) : (
                <div className="row center mt12" style={{ gap: 8, padding: 12, borderRadius: 12, background: status === "expired" ? "#FBEAEA" : c.amberSoft, fontSize: 13, fontWeight: 700, color: status === "expired" ? c.danger : "#7C6210" }}>
                  {status === "expired" ? "Este Pix venceu. Gere um novo." : "Aguardando a confirmação do banco…"}
                </div>
              )}
              <button className="btn ghost mt12" onClick={() => { setCharge(null); setStatus(null); }}>Alterar valor</button>
            </>
          )
        ) : !main ? (
          <div className="note mt16"><AlertCircle size={16} style={{ flexShrink: 0 }} /> Cadastre um cartão na carteira para adicionar crédito.</div>
        ) : (
          <>
            <div className="card row mt16" style={{ gap: 10 }}>
              <CreditCard size={18} color={c.brandDeep} /><span style={{ fontSize: 13, fontWeight: 600 }}>{main.brand} •••• {main.last4} · principal</span>
            </div>
            <button className="btn mt12" onClick={payCard} disabled={busy}>{busy ? "Processando…" : `Adicionar ${brl(amt)}`}</button>
          </>
        )}
        {mode === "firebase" && <div className="subtitle" style={{ fontSize: 11, marginTop: 12, textAlign: "center" }}>O saldo não expira e não pode ser sacado.</div>}
      </div>
    </Screen>
  );
}

const maskCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const maskVal = (v) => v.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2");

export function AdicionarCartao() {
  const nav = useNavigate();
  const { addCard, mode } = useApp();
  const { config } = useConfig();
  const [cf, setCf] = useState({ num: "", name: "", val: "", cvv: "", kind: "Crédito" });
  const [busy, setBusy] = useState(false);
  const digits = cf.num.replace(/\D/g, "");

  const save = async () => { setBusy(true); const ok = await addCard(cf); setBusy(false); if (ok) nav(-1); };

  return (
    <Screen title="Adicionar cartão">
      <div className="px">
        {/* pré-visualização */}
        <div className="dark-panel" style={{ height: 180, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="row between">
            <span style={{ fontSize: 13, fontWeight: 900, fontStyle: "italic", color: c.yellow }}>{config.brand.wordmark}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: c.onInk1 }}>{cf.kind.toUpperCase()}</span>
          </div>
          <div className="mono" style={{ fontSize: 20, letterSpacing: 2 }}>{(cf.num || "•••• •••• •••• ••••")}</div>
          <div className="row between" style={{ fontSize: 12, color: c.onInk0 }}>
            <span style={{ textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{cf.name || "NOME NO CARTÃO"}</span>
            <span className="mono">{cf.val || "MM/AA"}</span>
          </div>
        </div>

        <div className="col mt16" style={{ gap: 12 }}>
          <div><label className="field-label">Número do cartão</label>
            <input className="field mono" inputMode="numeric" placeholder="0000 0000 0000 0000" value={cf.num} onChange={(e) => setCf({ ...cf, num: maskCard(e.target.value) })} /></div>
          <div><label className="field-label">Nome impresso no cartão</label>
            <input className="field" placeholder="Como está no cartão" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} /></div>
          <div className="grid2" style={{ gap: 10 }}>
            <div><label className="field-label">Validade</label>
              <input className="field mono" inputMode="numeric" placeholder="MM/AA" value={cf.val} onChange={(e) => setCf({ ...cf, val: maskVal(e.target.value) })} /></div>
            <div><label className="field-label">CVV</label>
              <input className="field mono" inputMode="numeric" placeholder="123" value={cf.cvv} onChange={(e) => setCf({ ...cf, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
          </div>
          <div className="grid2" style={{ gap: 8 }}>
            {["Crédito", "Débito"].map((k) => <button key={k} className={`choice ${cf.kind === k ? "on" : ""}`} onClick={() => setCf({ ...cf, kind: k })}>{k}</button>)}
          </div>
        </div>
        <div className="subtitle" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.4 }}>
          {mode === "firebase" ? "Os dados do cartão vão direto para o provedor de pagamento. Guardamos só a bandeira e os 4 últimos dígitos." : "Demonstração: o número completo e o CVV não são salvos, apenas os 4 últimos dígitos."}
        </div>
        <button className="btn mt16" onClick={save} disabled={digits.length < 13 || busy}>{busy ? "Salvando…" : "Salvar cartão"}</button>
      </div>
    </Screen>
  );
}

export function Pagar() {
  const nav = useNavigate();
  const { s, pay } = useApp();
  const { config } = useConfig();
  const mult = config.points?.appMultiplier || 1;
  const [amt, setAmt] = useState(150);
  const [method, setMethod] = useState(s.prepaid >= 150 || !s.cards.length ? "prepaid" : "card");
  const main = s.cards[0];
  const pts = Math.floor((Number(amt) || 0) * (config.points?.perReal || 1) * mult);

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await pay(amt, method, main?.id);
    setBusy(false);
    if (r) nav("/carteira/comprovante", { replace: true, state: { ...r, method } });
  };

  return (
    <Screen title="Pagar no posto">
      <div className="px">
        <div className="subtitle">{mult > 1 ? `Pague pelo app e receba pontos ${multLabel(mult)}` : "Pague pelo app e acumule pontos"}</div>
        <div className="mt16">
          <label className="field-label" htmlFor="pay">Valor do abastecimento</label>
          <input id="pay" className="field mono" type="number" min="1" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ fontSize: 22, height: 56, fontWeight: 700 }} />
        </div>
        <div className="grid3 mt8">
          {[50, 100, 200].map((v) => <button key={v} className={`choice ${Number(amt) === v ? "on" : ""}`} onClick={() => setAmt(v)}>{brl(v)}</button>)}
        </div>

        <div className="field-label mt16">Forma de pagamento</div>
        <div className="col" style={{ gap: 8 }}>
          <MethodBtn on={method === "prepaid"} onClick={() => setMethod("prepaid")} Icon={Coins} t="Saldo pré-pago" sub={`Disponível: ${brl(s.prepaid)}`} />
          {main && <MethodBtn on={method === "card"} onClick={() => setMethod("card")} Icon={CreditCard} t={`${main.brand} •••• ${main.last4}`} sub={`${main.kind} · principal`} />}
        </div>

        <div className="row between mt16" style={{ padding: "11px 13px", borderRadius: 11, background: c.amberSoft }}>
          <span style={{ fontSize: 12.5, color: "#7C6210", fontWeight: 700 }}>Pontos que você ganha</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: "#9A7714" }}>+{num(pts)} pts</span>
        </div>
        <button className="btn grad mt16" onClick={submit} disabled={busy}>{busy ? "Processando…" : `Pagar ${brl(amt)}`}</button>
      </div>
    </Screen>
  );
}

function MethodBtn({ on, onClick, Icon, t, sub }) {
  return (
    <button onClick={onClick} className={`choice ${on ? "on" : ""}`} style={{ justifyContent: "flex-start", padding: 13, gap: 11 }}>
      <Icon size={20} color={c.brandDeep} />
      <div style={{ flex: 1, textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 11.5, color: c.muted, fontWeight: 500 }}>{sub}</div></div>
      {on && <Check size={18} color={c.brand} />}
    </button>
  );
}

export function Comprovante() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { s } = useApp();
  const { config } = useConfig();
  if (!state) return <Screen title="Comprovante"><div className="px subtitle">Nenhum pagamento recente.</div></Screen>;
  const card = s.cards[0];
  return (
    <Screen title="Comprovante" onBack={() => nav("/carteira", { replace: true })}>
      <div className="px" style={{ textAlign: "center" }}>
        <div className="icon-box" style={{ width: 64, height: 64, borderRadius: 22, background: "#E7F4EC", margin: "10px auto 12px" }}><Check size={32} color={c.green} /></div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Pagamento aprovado</div>
        <div className="mono" style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>{brl(state.amount)}</div>
        <div className="card mt16" style={{ textAlign: "left" }}>
          {[
            ["Forma", state.method === "prepaid" ? "Saldo pré-pago" : card ? `${card.brand} •••• ${card.last4}` : "Cartão"],
            ["Autorização", state.auth],
            ["Data", new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })],
            ["Posto", `${config.brand.name} · ${config.stations?.[0] || ""}`],
          ].map(([k, v]) => (
            <div key={k} className="row between" style={{ padding: "7px 0", fontSize: 13 }}>
              <span style={{ color: c.muted }}>{k}</span><span className="mono" style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="row between mt12" style={{ padding: "12px 14px", borderRadius: 12, background: c.ink }}>
          <span style={{ fontSize: 13, color: c.onInk0, fontWeight: 700 }}>Pontos creditados{(config.points?.appMultiplier || 1) > 1 ? ` (${config.points.appMultiplier}×)` : ""}</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: c.yellow }}>+{num(state.pts)}</span>
        </div>
        <button className="btn mt20" onClick={() => nav("/inicio", { replace: true })}>Voltar ao início</button>
        <button className="btn ghost mt12" onClick={() => nav("/extrato")}>Ver extrato</button>
      </div>
    </Screen>
  );
}
