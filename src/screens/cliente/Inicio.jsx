import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Clock, Check, QrCode, Wallet, Lock, Wrench, Sparkles, ChevronRight } from "lucide-react";
import { c } from "../../theme";
import { HomeHeader, PointsMeter } from "../../components/ui";
import { useApp } from "../../store/AppStore";
import { useConfig } from "../../config/ConfigProvider";
import { iconOf } from "../../config/icons";

export default function Inicio() {
  const nav = useNavigate();
  const { s, activateOffer, flash } = useApp();
  const { config } = useConfig();
  const f = config.features || {};
  const offer = config.offer || {};
  const missions = f.missions === false ? [] : (config.missions || []).filter((m) => m.active !== false);

  const [busy, setBusy] = useState(false);
  const onOffer = async () => {
    if (s.offerActive) return nav("/qr");
    setBusy(true);
    const ok = await activateOffer();
    setBusy(false);
    if (ok) flash("Desconto ativado · mostre seu QR no caixa");
  };

  return (
    <>
      <HomeHeader />
      <div className="scroll with-nav screen-enter">
        <div className="px" style={{ paddingTop: 2, paddingBottom: 6 }}>
          <div className="title">Olá, {s.user.name} 👋</div>
          <div className="subtitle">{config.texts?.homeSubtitle}</div>
        </div>

        <div className="px mt8"><PointsMeter onClick={() => nav("/extrato")} /></div>

        {/* oferta */}
        {offer.active && <div className="px mt16">
          <div style={{ borderRadius: 20, border: `1px solid ${c.line}`, background: c.paper, overflow: "hidden" }}>
            <div className="row between" style={{ padding: "11px 16px", background: c.amberSoft }}>
              <div className="row" style={{ gap: 7 }}><Zap size={15} color={c.brand} fill={c.brand} /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>{offer.label}</span></div>
              {offer.until && <div className="row" style={{ gap: 4, color: c.muted, fontSize: 11 }}><Clock size={12} /> {offer.until}</div>}
            </div>
            <div style={{ padding: "16px 16px 18px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{offer.value} <span style={{ fontSize: 15, color: c.muted, fontWeight: 600 }}>{offer.unit}</span></div>
              <div className="subtitle" style={{ marginTop: 2 }}>{offer.description}</div>
              <button className={`btn mt12 ${s.offerActive ? "soft" : "grad"}`} onClick={onOffer} disabled={busy}>
                {s.offerActive ? <><Check size={18} /> Desconto ativado · ver QR</> : "Ativar desconto"}
              </button>
            </div>
          </div>
        </div>}

        {/* atalhos */}
        <div className="grid2 px mt16">
          <Shortcut onClick={() => nav("/qr")} bg={c.ink} Icon={QrCode} color="#fff" t="Meu QR" sub="identificar no caixa" />
          {f.wallet !== false
            ? <Shortcut onClick={() => nav("/carteira/pagar")} bg={c.yellow} Icon={Wallet} color={c.ink} t="Pagar" sub="pela carteira" />
            : <Shortcut onClick={() => nav("/resgatar")} bg={c.yellow} Icon={Sparkles} color={c.ink} t="Resgatar" sub="trocar pontos" />}
        </div>

        {/* serviços */}
        {(f.priceLock || f.maintenance) && <div className="px mt20">
          <div className="section-title">{config.texts?.servicesTitle}</div>
          <div className="grid2">
            {f.priceLock && <ServiceTile onClick={() => nav("/trava-de-preco")} bg={c.yellow} Icon={Lock} color={c.ink} t="Trava de preço" sub="compre litros ao preço de hoje" />}
            {f.maintenance && <ServiceTile onClick={() => nav("/manutencao")} bg={c.ink} Icon={Wrench} color={c.yellow} t="Manutenção" sub="previsão para o seu carro" />}
          </div>
        </div>}

        {/* missões */}
        {missions.length > 0 && <div className="px mt20">
          <div className="section-title"><Sparkles size={16} color={c.brand} /> Missões da semana</div>
          <div className="col" style={{ gap: 10 }}>
            {missions.map((m) => { const Icon = iconOf(m.icon); return (
              <div key={m.id} className="card row" style={{ gap: 12, padding: 13 }}>
                <div className="icon-box" style={{ width: 38, height: 38, borderRadius: 11, background: c.amberSoft }}><Icon size={18} color={c.brandDeep} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{m.title}</div>
                  <div className="thin-bar" style={{ marginTop: 6 }}><div style={{ width: `${m.progress}%`, background: c.brand }} /></div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: c.brandDeep, whiteSpace: "nowrap" }}>{m.reward}</span>
              </div>
            ); })}
          </div>
        </div>}

        <button className="card row" onClick={() => nav("/perfil")} style={{ margin: "16px 18px 0", width: "calc(100% - 36px)", gap: 12 }}>
          <div className="icon-box" style={{ background: c.pinkSoft }}><span style={{ fontWeight: 900, color: c.brandDeep }}>{s.user.name[0]}</span></div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Meu perfil</div>
            <div className="subtitle" style={{ fontSize: 11.5 }}>Dados, veículo e vouchers</div>
          </div>
          <ChevronRight size={18} color={c.muted} />
        </button>
      </div>
    </>
  );
}

function Shortcut({ onClick, bg, Icon, color, t, sub }) {
  return (
    <button onClick={onClick} className="card tile row" style={{ gap: 11 }}>
      <div className="icon-box" style={{ background: bg }}><Icon size={20} color={color} /></div>
      <div><div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div><div style={{ fontSize: 11, color: c.muted }}>{sub}</div></div>
    </button>
  );
}

function ServiceTile({ onClick, bg, Icon, color, t, sub }) {
  return (
    <button onClick={onClick} className="card tile">
      <span className="badge-new">NOVO</span>
      <div className="icon-box" style={{ background: bg, marginBottom: 9 }}><Icon size={19} color={color} /></div>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t}</div>
      <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>{sub}</div>
    </button>
  );
}
