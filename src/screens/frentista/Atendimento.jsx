import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Check, User, Zap, Fuel, Ticket, Camera, X } from "lucide-react";
import { c, brl, num } from "../../theme";
import { Screen } from "../../components/ui";
import { useApp } from "../../store/AppStore";
import { useConfig } from "../../config/ConfigProvider";

const maskCpf = (v) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

/** Leitor de QR pela câmera (BarcodeDetector, disponível no Chrome do Android). */
function QrScanner({ onCode, onClose }) {
  const video = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let stream, raf, stopped = false;
    (async () => {
      if (!("BarcodeDetector" in window)) { setError("Este aparelho não lê QR pela câmera do app. Digite o CPF do cliente."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video.current);
            if (found[0]?.rawValue) { onCode(found[0].rawValue); return; }
          } catch {}
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setError("Não foi possível abrir a câmera. Verifique a permissão ou digite o CPF."); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="card mt12" style={{ padding: 10 }}>
      {error ? <div className="subtitle" style={{ padding: 10 }}>{error}</div>
        : <video ref={video} muted playsInline style={{ width: "100%", borderRadius: 12, background: "#000", aspectRatio: "1", objectFit: "cover" }} />}
      <button className="btn ghost sm mt8" onClick={onClose}><X size={16} /> Fechar câmera</button>
    </div>
  );
}

/** RN-48 a RN-52: identificar o cliente e registrar a venda. */
export function Atender() {
  const nav = useNavigate();
  const { s, lookupCustomer, registerSale, flash } = useApp();
  const { config } = useConfig();
  const fuels = Object.keys(config.fuelPrices || {});
  const extraItems = (config.campaign?.items || []).filter((i) => i.key !== "cadastros");

  const [step, setStep] = useState("identify"); // identify → sale → done
  const [cpf, setCpf] = useState("");
  const [who, setWho] = useState(null); // { token } | { cpf }
  const [customer, setCustomer] = useState(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sale, setSale] = useState({ station: s.staff.station || config.stations?.[0] || "", fuel: fuels[0] || "", liters: "", amount: "", method: "pix", items: [], useLocks: true });
  const [result, setResult] = useState(null);

  const identify = async (ref) => {
    setBusy(true);
    const info = await lookupCustomer(ref);
    setBusy(false);
    if (info) { setWho(ref); setCustomer(info); setStep("sale"); }
  };
  const onScan = (code) => { setScan(false); identify({ token: code }); };

  const price = config.fuelPrices?.[sale.fuel] || 0;
  const suggested = sale.fuel && Number(sale.liters) > 0 ? (Number(sale.liters) * price).toFixed(2) : "";
  const locked = customer?.lockedByFuel?.[sale.fuel] || 0;
  const toggleItem = (k) => setSale((x) => ({ ...x, items: x.items.includes(k) ? x.items.filter((i) => i !== k) : [...x.items, k] }));

  const submit = async () => {
    const amount = Number(sale.amount || suggested);
    if (!sale.station) return flash("Escolha o posto", "err");
    if (sale.fuel && !(Number(sale.liters) > 0)) return flash("Informe os litros abastecidos", "err");
    if (!(amount >= 0)) return flash("Informe o valor", "err");
    setBusy(true);
    const r = await registerSale({
      ...(who || {}), identified: !!who, station: sale.station, fuel: sale.fuel || "", liters: sale.fuel ? Number(sale.liters) : 0,
      amount, method: sale.method, items: sale.items, useLocks: sale.useLocks && locked > 0,
    });
    setBusy(false);
    if (r) { setResult(r); setStep("done"); }
  };

  const restart = () => { setStep("identify"); setWho(null); setCustomer(null); setCpf(""); setResult(null); setSale((x) => ({ ...x, liters: "", amount: "", items: [] })); };

  return (
    <Screen title="Atender cliente" onBack={() => nav("/frentista", { replace: true })}>
      <div className="px">
        {step === "identify" && <>
          <div className="subtitle">Leia o QR do app do cliente ou digite o CPF. O QR vale 5 minutos.</div>
          {scan ? <QrScanner onCode={onScan} onClose={() => setScan(false)} />
            : <button className="btn grad mt16" style={{ height: 60 }} onClick={() => setScan(true)}><Camera size={20} /> Ler QR do cliente</button>}
          <div className="mt16">
            <label className="field-label" htmlFor="at-cpf">CPF do cliente</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="at-cpf" className="field mono" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
              <button className="btn dark" style={{ width: 110 }} disabled={busy || cpf.replace(/\D/g, "").length !== 11} onClick={() => identify({ cpf })}>Buscar</button>
            </div>
          </div>
          <button className="btn ghost mt16" onClick={() => { setWho(null); setCustomer(null); setStep("sale"); }}>Venda sem identificar cliente</button>
        </>}

        {step === "sale" && <>
          {customer ? (
            <div className="dark-panel row" style={{ gap: 12, padding: 14 }}>
              <div className="icon-box" style={{ background: "rgba(255,255,255,.1)" }}><User size={20} color={c.yellow} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{customer.name}</div>
                <div className="mono" style={{ fontSize: 12, color: c.onInk1 }}>CPF {customer.cpfMasked} · {customer.level} · {num(customer.points)} pts</div>
              </div>
              {customer.offerActive && <span className="chip" style={{ background: c.yellow, color: c.ink }}><Zap size={10} /> OFERTA</span>}
            </div>
          ) : <div className="note">Venda sem cliente: não gera pontos e conta como não identificada na campanha.</div>}

          <div className="grid2 mt16" style={{ gap: 10 }}>
            <div><label className="field-label" htmlFor="at-station">Posto</label>
              <select id="at-station" className="field" value={sale.station} onChange={(e) => setSale({ ...sale, station: e.target.value })}>
                {(config.stations || []).map((st) => <option key={st}>{st}</option>)}
              </select></div>
            <div><label className="field-label" htmlFor="at-method">Pagamento</label>
              <select id="at-method" className="field" value={sale.method} onChange={(e) => setSale({ ...sale, method: e.target.value })}>
                <option value="pix">Pix</option><option value="debito">Débito</option><option value="credito">Crédito</option><option value="dinheiro">Dinheiro</option>
              </select></div>
          </div>
          <div className="field-label mt12">Combustível</div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {[...fuels, ""].map((f) => <button key={f || "none"} className={`choice ${sale.fuel === f ? "on" : ""}`} style={{ flex: "1 1 30%", fontSize: 12.5 }} onClick={() => setSale({ ...sale, fuel: f })}>{f || "Só serviços"}</button>)}
          </div>
          <div className="grid2 mt12" style={{ gap: 10 }}>
            {sale.fuel && <div><label className="field-label" htmlFor="at-liters">Litros</label><input id="at-liters" className="field mono" type="number" step="0.01" value={sale.liters} onChange={(e) => setSale({ ...sale, liters: e.target.value })} /></div>}
            <div><label className="field-label" htmlFor="at-amount">Valor total (R$)</label><input id="at-amount" className="field mono" type="number" step="0.01" placeholder={suggested} value={sale.amount} onChange={(e) => setSale({ ...sale, amount: e.target.value })} /></div>
          </div>
          {sale.fuel && <div className="subtitle" style={{ fontSize: 11.5, marginTop: 5 }}>Preço na configuração: {brl(price)}/L{suggested ? ` · sugerido ${brl(Number(suggested))}` : ""}</div>}

          {locked > 0 && (
            <label className="card row mt12" style={{ gap: 10 }}>
              <input id="at-locks" type="checkbox" checked={sale.useLocks} onChange={(e) => setSale({ ...sale, useLocks: e.target.checked })} style={{ width: 18, height: 18, accentColor: c.brand }} />
              <Fuel size={18} color={c.brandDeep} /><span style={{ fontSize: 13, fontWeight: 600 }}>Usar {num(locked)} L travados de {sale.fuel}</span>
            </label>
          )}

          {extraItems.length > 0 && <>
            <div className="field-label mt12">Serviços e produtos</div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {extraItems.map((it) => <button key={it.key} className={`choice ${sale.items.includes(it.key) ? "on" : ""}`} style={{ flex: "1 1 45%", fontSize: 12.5 }} onClick={() => toggleItem(it.key)}>{it.label}</button>)}
            </div>
          </>}

          <button className="btn grad mt16" disabled={busy} onClick={submit}>{busy ? "Registrando…" : "Registrar venda"}</button>
          <button className="btn ghost mt8" onClick={restart}>Trocar cliente</button>
        </>}

        {step === "done" && result && <>
          <div className="icon-box" style={{ width: 60, height: 60, borderRadius: 20, background: "#E7F4EC", margin: "8px auto 10px" }}><Check size={30} color={c.green} /></div>
          <div style={{ fontSize: 19, fontWeight: 800, textAlign: "center" }}>Venda registrada</div>
          <div className="card mt16">
            {[
              ["Desconto da oferta", result.offerDiscountCents ? `− ${brl(result.offerDiscountCents / 100)}` : "—"],
              ["Litros da trava", result.lockValueCents ? `− ${brl(result.lockValueCents / 100)}` : "—"],
              ["Valor a cobrar", brl(result.paidCents / 100)],
              ["Pontos do cliente", result.points ? `+${num(result.points)}` : "—"],
            ].map(([k, v]) => <div key={k} className="row between" style={{ padding: "7px 0", fontSize: 14 }}><span style={{ color: c.muted }}>{k}</span><b className="mono">{v}</b></div>)}
          </div>
          {result.campaign && <div className="row between mt12" style={{ padding: "12px 14px", borderRadius: 12, background: c.ink, color: "#fff" }}>
            <span style={{ fontSize: 13, color: c.onInk0 }}>Seu bônus na campanha</span><b className="mono" style={{ color: c.yellow, fontSize: 18 }}>{brl(result.campaign.bonusCents / 100)}</b>
          </div>}
          <button className="btn grad mt16" onClick={restart}><ScanLine size={18} /> Próximo cliente</button>
        </>}
      </div>
    </Screen>
  );
}

/** RN-31: consulta e consome o voucher. */
export function ValidarVoucher() {
  const nav = useNavigate();
  const { validateVoucher } = useApp();
  const [code, setCode] = useState("");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);

  const check = async (value = code) => {
    setBusy(true);
    const r = await validateVoucher(value.toUpperCase().replace(/[^A-Z0-9]/g, ""), false);
    setBusy(false);
    setInfo(r);
  };
  const use = async () => {
    setBusy(true);
    const r = await validateVoucher(info.code, true);
    setBusy(false);
    if (r) setInfo(r);
  };

  return (
    <Screen title="Validar voucher" onBack={() => nav("/frentista", { replace: true })}>
      <div className="px">
        {scan ? <QrScanner onCode={(v) => { setScan(false); setCode(v); check(v); }} onClose={() => setScan(false)} />
          : <button className="btn dark" style={{ height: 56 }} onClick={() => setScan(true)}><Camera size={20} /> Ler QR do voucher</button>}
        <div className="mt16">
          <label className="field-label" htmlFor="v-code">Código do voucher</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="v-code" className="field mono" maxLength={10} placeholder="ABCD2345" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setInfo(null); }} style={{ letterSpacing: 2 }} />
            <button className="btn" style={{ width: 110 }} disabled={busy || code.length < 8} onClick={() => check()}>Consultar</button>
          </div>
        </div>
        {info && (
          <div className="card mt16" style={{ borderColor: info.used ? c.green : c.brand }}>
            <div className="row" style={{ gap: 10 }}>
              <div className="icon-box" style={{ background: info.used ? "#E7F4EC" : c.pinkSoft }}>{info.used ? <Check size={20} color={c.green} /> : <Ticket size={20} color={c.brandDeep} />}</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{info.rewardName}</div><div className="subtitle" style={{ fontSize: 12 }}>{info.customerName} · <span className="mono">{info.code}</span></div></div>
            </div>
            {info.used ? <div className="row mt12" style={{ gap: 6, color: c.green, fontWeight: 800 }}><Check size={16} /> Voucher utilizado. Entregue o prêmio.</div>
              : <button className="btn grad mt12" disabled={busy} onClick={use}>{busy ? "Validando…" : "Confirmar uso e entregar"}</button>}
          </div>
        )}
      </div>
    </Screen>
  );
}
