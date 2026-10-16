import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fuel, User, ArrowRight, Eye, EyeOff, Settings2, Repeat } from "lucide-react";
import { useConfig } from "../../config/ConfigProvider";
import { iconOf } from "../../config/icons";
import { BUNDLED } from "../../config/api";
import { c } from "../../theme";
import { Logo, TopBar } from "../../components/ui";
import { useApp } from "../../store/AppStore";

export function Welcome() {
  const nav = useNavigate();
  const { config, tenantId, switchTenant } = useConfig();
  const slides = (config.texts?.welcome || []).map((x) => ({ Icon: iconOf(x.icon), t: x.title, b: x.body }));
  const [i, setI] = useState(0);
  const sl = slides[i];
  if (!sl) return <div className="col" style={{ flex: 1, justifyContent: "center", padding: 24 }}><Logo size="lg" /><button className="btn grad mt20" onClick={() => nav("/entrar")}>Entrar</button></div>;
  const last = i === slides.length - 1;
  return (
    <div className="col" style={{ flex: 1, padding: "calc(28px + var(--safe-top)) 24px calc(24px + var(--safe-bottom))" }}>
      <Logo size="lg" />
      <div className="col screen-enter" key={i} style={{ flex: 1, justifyContent: "center", gap: 14 }}>
        <div className="dark-panel row center" style={{ height: 220, borderRadius: 28 }}>
          <div className="icon-box" style={{ width: 96, height: 96, borderRadius: 30, background: c.yellow }}>
            <sl.Icon size={46} color={c.ink} />
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.6, marginTop: 10 }}>{sl.t}</div>
        <div style={{ fontSize: 15, color: c.muted, lineHeight: 1.45 }}>{sl.b}</div>
      </div>
      <div className="row center" style={{ gap: 6, marginBottom: 18 }}>
        {slides.map((_, k) => (
          <span key={k} style={{ width: k === i ? 22 : 7, height: 7, borderRadius: 4, background: k === i ? c.brand : c.line, transition: "width .2s" }} />
        ))}
      </div>
      <button className="btn grad" onClick={() => (last ? nav("/entrar") : setI(i + 1))}>
        {last ? "Começar" : "Próximo"} <ArrowRight size={18} />
      </button>
      {!last && <button onClick={() => nav("/entrar")} style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: c.muted }}>Pular</button>}
      {/* atalhos de demonstração: em produção cada rede tem seu domínio/app e o painel fica em endereço próprio */}
      <div className="row center" style={{ gap: 16, marginTop: 14, fontSize: 12, fontWeight: 700, color: c.muted }}>
        <button className="row" style={{ gap: 5 }} onClick={() => { const ids = Object.keys(BUNDLED); switchTenant(ids[(ids.indexOf(tenantId) + 1) % ids.length]); setI(0); }}><Repeat size={13} /> Trocar rede (demo)</button>
        <button className="row" style={{ gap: 5 }} onClick={() => nav("/admin")}><Settings2 size={13} /> Painel da rede</button>
      </div>
    </div>
  );
}

const maskCpf = (v) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export function Login() {
  const nav = useNavigate();
  const { login, flash } = useApp();
  const { config } = useConfig();
  const allowStaff = config.features?.frentista !== false;
  const [role, setRole] = useState("cliente");
  const [cpf, setCpf] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (cpf.replace(/\D/g, "").length !== 11) return flash(role === "cliente" ? "Informe um CPF válido" : "Informe sua matrícula (CPF)", "err");
    if (pwd.length < 4) return flash("Senha com pelo menos 4 caracteres", "err");
    login(role);
    nav(role === "cliente" ? "/inicio" : "/frentista", { replace: true });
  };

  return (
    <>
      <TopBar title="" onBack={() => nav("/")} />
      <form className="scroll screen-enter px" onSubmit={submit}>
        <div className="title" style={{ fontSize: 26 }}>Entrar</div>
        <div className="subtitle" style={{ marginTop: 2 }}>Acesse sua conta {config.brand.name}</div>

        {allowStaff && <div className="segmented mt20">
          {[["cliente", "Sou cliente", User], ["frentista", "Sou frentista", Fuel]].map(([k, label, Icon]) => (
            <button type="button" key={k} className={role === k ? "on" : ""} onClick={() => setRole(k)}><Icon size={15} /> {label}</button>
          ))}
        </div>}

        <div className="mt20">
          <label className="field-label" htmlFor="cpf">CPF</label>
          <input id="cpf" className="field mono" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} />
        </div>
        <div className="mt12">
          <label className="field-label" htmlFor="pwd">Senha</label>
          <div style={{ position: "relative" }}>
            <input id="pwd" className="field" type={show ? "text" : "password"} placeholder="••••••" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: 14, color: c.muted }} aria-label="Mostrar senha">
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>
        <button type="button" onClick={() => flash("Enviamos um link de recuperação por SMS")} style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: c.brand }}>Esqueci minha senha</button>

        <button className="btn grad mt20" type="submit">Entrar</button>
        <button type="button" className="btn ghost mt12" onClick={() => { setCpf("123.456.443-08"); setPwd("1234"); }}>Preencher dados de demonstração</button>

        {role === "cliente" && (
          <div className="subtitle mt20" style={{ textAlign: "center" }}>
            Ainda não tem conta? <button type="button" onClick={() => flash("Cadastro rápido disponível no caixa do posto")} style={{ color: c.brand, fontWeight: 800 }}>Cadastre-se</button>
          </div>
        )}
      </form>
    </>
  );
}
