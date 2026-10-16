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
  const { mode } = useApp();
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
      {mode === "demo" && <div className="row center" style={{ gap: 16, marginTop: 14, fontSize: 12, fontWeight: 700, color: c.muted }}>
        <button className="row" style={{ gap: 5 }} onClick={() => { const ids = Object.keys(BUNDLED); switchTenant(ids[(ids.indexOf(tenantId) + 1) % ids.length]); setI(0); }}><Repeat size={13} /> Trocar rede (demo)</button>
        <button className="row" style={{ gap: 5 }} onClick={() => nav("/admin")}><Settings2 size={13} /> Painel da rede</button>
      </div>}
    </div>
  );
}

const maskCpf = (v) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export function Login() {
  const nav = useNavigate();
  const { login, signIn, resetPassword, flash, mode } = useApp();
  const { config } = useConfig();
  const fb = mode === "firebase";
  const allowStaff = config.features?.frentista !== false;
  const [role, setRole] = useState("cliente");
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (fb) {
      if (!/^\S+@\S+\.\S+$/.test(id)) return flash("Informe um e-mail válido", "err");
      if (pwd.length < 6) return flash("A senha tem pelo menos 6 caracteres", "err");
      setBusy(true);
      const r = await signIn(id.trim(), pwd, role);
      setBusy(false);
      if (!r) return;
      return nav(r.needsJoin ? "/cadastro" : role === "cliente" ? "/inicio" : "/frentista", { replace: true });
    }
    if (id.replace(/\D/g, "").length !== 11) return flash("Informe um CPF válido", "err");
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
          {[["cliente", "Sou cliente", User], ["frentista", "Sou da equipe", Fuel]].map(([k, label, Icon]) => (
            <button type="button" key={k} className={role === k ? "on" : ""} onClick={() => setRole(k)}><Icon size={15} /> {label}</button>
          ))}
        </div>}

        <div className="mt20">
          <label className="field-label" htmlFor="login-id">{fb ? "E-mail" : "CPF"}</label>
          {fb
            ? <input id="login-id" className="field" type="email" autoComplete="email" placeholder="voce@email.com" value={id} onChange={(e) => setId(e.target.value)} />
            : <input id="login-id" className="field mono" inputMode="numeric" placeholder="000.000.000-00" value={id} onChange={(e) => setId(maskCpf(e.target.value))} />}
        </div>
        <div className="mt12">
          <label className="field-label" htmlFor="pwd">Senha</label>
          <div style={{ position: "relative" }}>
            <input id="pwd" className="field" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: 14, color: c.muted }} aria-label="Mostrar senha">
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>
        <button type="button" onClick={() => (fb ? (id ? resetPassword(id.trim()) : flash("Digite seu e-mail acima", "err")) : flash("Enviamos um link de recuperação por SMS"))} style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: c.brand }}>Esqueci minha senha</button>

        <button className="btn grad mt20" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        {!fb && <button type="button" className="btn ghost mt12" onClick={() => { setId("123.456.443-08"); setPwd("1234"); }}>Preencher dados de demonstração</button>}

        {role === "cliente" && (
          <div className="subtitle mt20" style={{ textAlign: "center" }}>
            Ainda não tem conta? <button type="button" onClick={() => (fb ? nav("/cadastro") : flash("No modo demonstração, use os dados de exemplo"))} style={{ color: c.brand, fontWeight: 800 }}>Cadastre-se</button>
          </div>
        )}
      </form>
    </>
  );
}

/** Cadastro (RN-11): cria a conta (se ainda não existir) e entra na rede com CPF e celular. */
export function Cadastro() {
  const nav = useNavigate();
  const { s, register, logout, flash } = useApp();
  const { config } = useConfig();
  const hasAccount = !!s.authUser;
  const [f, setF] = useState({ name: s.authUser?.name || "", email: "", password: "", cpf: "", phone: "", referralCode: "", accept: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const maskPhone = (v) => v.replace(/\D/g, "").slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");

  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 3) return flash("Informe seu nome completo", "err");
    if (!hasAccount && !/^\S+@\S+\.\S+$/.test(f.email)) return flash("Informe um e-mail válido", "err");
    if (!hasAccount && f.password.length < 8) return flash("Crie uma senha com pelo menos 8 caracteres", "err");
    if (f.cpf.replace(/\D/g, "").length !== 11) return flash("Informe seu CPF", "err");
    if (f.phone.replace(/\D/g, "").length < 10) return flash("Informe seu celular com DDD", "err");
    if (!f.accept) return flash("Aceite os termos e a política de privacidade", "err");
    setBusy(true);
    const r = await register(f);
    setBusy(false);
    if (r) nav("/inicio", { replace: true });
  };

  return (
    <>
      <TopBar title="" onBack={async () => { if (hasAccount) await logout(); nav("/entrar"); }} />
      <form className="scroll screen-enter px" onSubmit={submit}>
        <div className="title" style={{ fontSize: 26 }}>{hasAccount ? `Participar da ${config.brand.name}` : "Criar conta"}</div>
        <div className="subtitle" style={{ marginTop: 2 }}>
          {hasAccount ? `Você já tem conta (${s.authUser.email}). Complete os dados para entrar nesta rede.` : `Ganhe ${config.points?.welcomeBonus ?? 0} pontos de boas-vindas.`}
        </div>
        <div className="col mt20" style={{ gap: 12 }}>
          <div><label className="field-label" htmlFor="cad-name">Nome completo</label><input id="cad-name" className="field" autoComplete="name" value={f.name} onChange={set("name")} /></div>
          {!hasAccount && <>
            <div><label className="field-label" htmlFor="cad-email">E-mail</label><input id="cad-email" className="field" type="email" autoComplete="email" value={f.email} onChange={set("email")} /></div>
            <div><label className="field-label" htmlFor="cad-pwd">Senha</label><input id="cad-pwd" className="field" type="password" autoComplete="new-password" placeholder="mínimo 8 caracteres" value={f.password} onChange={set("password")} /></div>
          </>}
          <div className="grid2" style={{ gap: 10 }}>
            <div><label className="field-label" htmlFor="cad-cpf">CPF</label><input id="cad-cpf" className="field mono" inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={(e) => setF({ ...f, cpf: maskCpf(e.target.value) })} /></div>
            <div><label className="field-label" htmlFor="cad-phone">Celular</label><input id="cad-phone" className="field mono" inputMode="tel" placeholder="(11) 90000-0000" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} /></div>
          </div>
          <div><label className="field-label" htmlFor="cad-ref">Código do frentista (opcional)</label><input id="cad-ref" className="field mono" maxLength={6} value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: e.target.value.toUpperCase() })} /></div>
          <label className="row" style={{ gap: 10, fontSize: 12.5, color: c.ink2, lineHeight: 1.4, alignItems: "flex-start" }}>
            <input id="cad-accept" type="checkbox" checked={f.accept} onChange={set("accept")} style={{ marginTop: 2, width: 18, height: 18, accentColor: c.brand }} />
            Li e aceito os termos de uso e a política de privacidade. Meu CPF é guardado de forma protegida e usado só para identificar minha conta.
          </label>
        </div>
        <button className="btn grad mt20" type="submit" disabled={busy}>{busy ? "Criando…" : hasAccount ? "Participar" : "Criar conta"}</button>
      </form>
    </>
  );
}
