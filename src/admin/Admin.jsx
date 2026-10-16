import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Palette, Type, ToggleLeft, Zap, Fuel, Award, Gift, Store, Target, QrCode, Users, Phone, Globe, History, Code2,
  Plus, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, LogOut, Upload, RotateCcw, ExternalLink, AlertTriangle, Check, UserCog,
} from "lucide-react";
import { adminApi as api, isDemo } from "../config/api";
import { ICON_NAMES, iconOf } from "../config/icons";
import "./admin.css";

/* ---------- utilidades ---------- */
const clone = (o) => JSON.parse(JSON.stringify(o));
const getIn = (o, path) => path.reduce((a, k) => (a == null ? a : a[k]), o);
function setIn(o, path, v) {
  if (!path.length) return v;
  const [k, ...rest] = path;
  const copy = Array.isArray(o) ? [...o] : { ...(o || {}) };
  copy[k] = setIn(copy[k], rest, v);
  return copy;
}
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const HEX = /^#[0-9a-fA-F]{6}$/;

function validate(cfg) {
  const e = [];
  if (!cfg.brand?.name?.trim()) e.push("Marca: informe o nome da rede.");
  for (const [k, label] of [["brand", "principal"], ["brandDeep", "principal escura"], ["ink", "painel escuro"], ["accent", "destaque"], ["cream", "fundo"]]) {
    if (!HEX.test(cfg.brand?.colors?.[k] || "")) e.push(`Marca: a cor ${label} deve estar no formato #RRGGBB.`);
  }
  if (!cfg.levels?.length) e.push("Pontos: cadastre ao menos um nível.");
  if (!Object.keys(cfg.fuelPrices || {}).length) e.push("Preços: cadastre ao menos um combustível.");
  Object.entries(cfg.fuelPrices || {}).forEach(([k, v]) => { if (!(v > 0)) e.push(`Preços: o preço de ${k} deve ser maior que zero.`); });
  const dupe = (list, what) => { const ids = list.map((x) => x.id); if (new Set(ids).size !== ids.length) e.push(`${what}: há itens com o mesmo identificador.`); };
  dupe(cfg.rewards || [], "Prêmios"); dupe(cfg.partners || [], "Parceiros"); dupe(cfg.missions || [], "Missões");
  (cfg.rewards || []).forEach((r) => { if (!r.name?.trim()) e.push("Prêmios: há um prêmio sem nome."); if (!(r.cost > 0)) e.push(`Prêmios: "${r.name || "sem nome"}" precisa de custo em pontos.`); });
  if (cfg.features?.pix && !cfg.pix?.key?.trim()) e.push("Pix: o Pix está ligado mas falta a chave.");
  return e;
}

/* ---------- campos ---------- */
function Field({ label, hint, children }) {
  return <label className="adm-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Text({ value, onChange, area, ...p }) {
  const Tag = area ? "textarea" : "input";
  return <Tag className="adm-input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...p} />;
}
function Num({ value, onChange, step = "1", ...p }) {
  return <input className="adm-input adm-mono" type="number" step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} {...p} />;
}
function Color({ value, onChange }) {
  return (
    <div className="adm-color">
      <input type="color" value={HEX.test(value || "") ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Escolher cor" />
      <input className="adm-input adm-mono" value={value ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={7} />
    </div>
  );
}
function IconSelect({ value, onChange }) {
  const Icon = iconOf(value);
  return (
    <div className="adm-color">
      <span className="adm-btn" style={{ width: 38, padding: 0, justifyContent: "center" }}><Icon size={18} /></span>
      <select className="adm-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={`adm-switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} />;
}
function Toggle({ title, desc, on, onChange }) {
  return <div className="adm-toggle"><div><b>{title}</b><small>{desc}</small></div><Switch on={on} onChange={onChange} label={title} /></div>;
}

/** Editor de lista: cada item abre/fecha, com reordenar, ativar e remover. */
function ListEditor({ items, onChange, title, make, render, summary, addLabel }) {
  const [open, setOpen] = useState(null);
  const upd = (i, v) => onChange(items.map((x, k) => (k === i ? v : x)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); setOpen(open === i ? j : open); };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, i) => (
        <div className="adm-item" key={i}>
          <div className="adm-item-head">
            {it.icon && React.createElement(iconOf(it.icon), { size: 17, color: it.hue || "#6B7280" })}
            <span className="ttl">{title(it) || <i style={{ color: "#9CA3AF" }}>sem nome</i>}</span>
            {summary && <span className="adm-pill">{summary(it)}</span>}
            {"active" in it && <Switch on={it.active !== false} onChange={(v) => upd(i, { ...it, active: v })} label="Ativo" />}
            <button className="adm-btn sm" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
            <button className="adm-btn sm" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={14} /></button>
            <button className="adm-btn sm" onClick={() => setOpen(open === i ? null : i)} aria-label="Editar">{open === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          </div>
          {open === i && (
            <div className="adm-item-body">
              {render(it, (v) => upd(i, v))}
              <div><button className="adm-btn sm danger" onClick={() => { onChange(items.filter((_, k) => k !== i)); setOpen(null); }}><Trash2 size={14} /> Remover</button></div>
            </div>
          )}
        </div>
      ))}
      <div><button className="adm-btn" onClick={() => { onChange([...items, make()]); setOpen(items.length); }}><Plus size={15} /> {addLabel}</button></div>
    </div>
  );
}

/* ---------- seções ---------- */
const SECTIONS = [
  { grp: "Identidade" },
  { id: "marca", label: "Marca e cores", Icon: Palette },
  { id: "textos", label: "Textos", Icon: Type },
  { id: "recursos", label: "Recursos do app", Icon: ToggleLeft },
  { grp: "Comercial" },
  { id: "oferta", label: "Oferta do dia", Icon: Zap },
  { id: "precos", label: "Preços e trava", Icon: Fuel },
  { id: "pontos", label: "Pontos e níveis", Icon: Award },
  { id: "premios", label: "Prêmios", Icon: Gift },
  { id: "parceiros", label: "Parceiros do clube", Icon: Store },
  { id: "missoes", label: "Missões", Icon: Target },
  { grp: "Operação" },
  { id: "pix", label: "Pix", Icon: QrCode },
  { id: "campanha", label: "Campanha frentistas", Icon: Users },
  { id: "contato", label: "Postos e atendimento", Icon: Phone },
  { id: "dominios", label: "Domínios", Icon: Globe },
  { id: "equipe", label: "Equipe", Icon: UserCog },
  { grp: "Avançado" },
  { id: "historico", label: "Histórico de versões", Icon: History },
  { id: "json", label: "JSON completo", Icon: Code2 },
];

function Section({ id, d, set, ctx }) {
  const f = (path) => ({ value: getIn(d, path), onChange: (v) => set(path, v) });
  switch (id) {
    case "marca": return (<>
      <h2>Marca e cores</h2><p className="lead">Nome, logotipo em texto e paleta. As cores derivadas (fundos suaves, textos sobre o painel escuro) são calculadas a partir destas.</p>
      <div className="adm-card"><div className="adm-grid">
        <Field label="Nome da rede"><Text {...f(["brand", "name"])} /></Field>
        <Field label="Texto sobre o nome" hint="Ex.: REDE DE POSTOS"><Text {...f(["brand", "eyebrow"])} /></Field>
        <Field label="Nome no logotipo"><Text {...f(["brand", "wordmark"])} /></Field>
        <Field label="Sigla do selo" hint="Até 4 letras"><Text {...f(["brand", "logoText"])} maxLength={4} /></Field>
      </div></div>
      <div className="adm-card"><h3>Paleta</h3><div className="adm-grid">
        <Field label="Principal (botões)"><Color {...f(["brand", "colors", "brand"])} /></Field>
        <Field label="Principal escura"><Color {...f(["brand", "colors", "brandDeep"])} /></Field>
        <Field label="Cor do logotipo"><Color {...f(["brand", "colors", "wordmark"])} /></Field>
        <Field label="Painel escuro"><Color {...f(["brand", "colors", "ink"])} /></Field>
        <Field label="Painel escuro (degradê)"><Color {...f(["brand", "colors", "inkSoft"])} /></Field>
        <Field label="Destaque (pontos)"><Color {...f(["brand", "colors", "accent"])} /></Field>
        <Field label="Fundo do app"><Color {...f(["brand", "colors", "cream"])} /></Field>
      </div></div>
    </>);

    case "textos": return (<>
      <h2>Textos</h2><p className="lead">Frases que aparecem no app. As telas de boas-vindas aceitam quantos passos você quiser.</p>
      <div className="adm-card"><div className="adm-grid">
        <Field label="Subtítulo da tela inicial"><Text {...f(["texts", "homeSubtitle"])} /></Field>
        <Field label="Nome da carteira"><Text {...f(["texts", "walletName"])} /></Field>
        <Field label="Título da seção de serviços"><Text {...f(["texts", "servicesTitle"])} /></Field>
      </div></div>
      <div className="adm-card"><h3>Boas-vindas</h3>
        <ListEditor items={d.texts?.welcome || []} onChange={(v) => set(["texts", "welcome"], v)} addLabel="Adicionar passo"
          title={(x) => x.title} make={() => ({ icon: "Gift", title: "Novo passo", body: "" })}
          render={(x, u) => <div className="adm-grid">
            <Field label="Título"><Text value={x.title} onChange={(v) => u({ ...x, title: v })} /></Field>
            <Field label="Ícone"><IconSelect value={x.icon} onChange={(v) => u({ ...x, icon: v })} /></Field>
            <Field label="Texto"><Text area value={x.body} onChange={(v) => u({ ...x, body: v })} /></Field>
          </div>} />
      </div>
    </>);

    case "recursos": {
      const list = [
        ["wallet", "Carteira pré-paga", "Saldo, cartões e pagamento pelo app"],
        ["pix", "Recarga por Pix", "Exige a chave Pix configurada"],
        ["priceLock", "Trava de preço", "Compra antecipada de litros"],
        ["maintenance", "Manutenção", "Previsão de serviços e agendamento"],
        ["club", "Clube de vantagens", "Cupons em parceiros"],
        ["missions", "Missões da semana", "Desafios na tela inicial"],
        ["frentista", "Modo frentista", "Campanha de incentivo da equipe"],
      ];
      return (<>
        <h2>Recursos do app</h2><p className="lead">Ligue ou desligue módulos. Um recurso desligado some das telas e da navegação na próxima vez que o app buscar a configuração.</p>
        <div className="adm-card" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {list.map(([k, t, desc]) => <Toggle key={k} title={t} desc={desc} on={d.features?.[k] !== false} onChange={(v) => set(["features", k], v)} />)}
        </div>
      </>);
    }

    case "oferta": return (<>
      <h2>Oferta do dia</h2><p className="lead">Destaque na tela inicial, ativado pelo cliente e apresentado no QR Code do caixa.</p>
      <div className="adm-card">
        <Toggle title="Oferta ativa" desc="Desligada, o cartão some da tela inicial" on={d.offer?.active} onChange={(v) => set(["offer", "active"], v)} />
        <div className="adm-grid">
          <Field label="Selo"><Text {...f(["offer", "label"])} /></Field>
          <Field label="Valor em destaque"><Text {...f(["offer", "value"])} /></Field>
          <Field label="Unidade"><Text {...f(["offer", "unit"])} /></Field>
          <Field label="Validade"><Text {...f(["offer", "until"])} /></Field>
          <Field label="Descrição"><Text area {...f(["offer", "description"])} /></Field>
          <Field label="Aviso no QR Code"><Text area {...f(["offer", "qrBadge"])} /></Field>
        </div>
      </div>
    </>);

    case "precos": {
      const prices = d.fuelPrices || {};
      const entries = Object.entries(prices);
      const setPrices = (list) => set(["fuelPrices"], Object.fromEntries(list));
      return (<>
        <h2>Preços e trava</h2><p className="lead">Preço por litro usado na trava de preço. A ordem aqui é a ordem no app.</p>
        <div className="adm-card">
          {entries.map(([k, v], i) => (
            <div key={i} className="adm-color">
              <input className="adm-input" value={k} onChange={(e) => setPrices(entries.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} aria-label="Combustível" />
              <input className="adm-input adm-mono" type="number" step="0.01" value={v} onChange={(e) => setPrices(entries.map((x, j) => (j === i ? [x[0], Number(e.target.value)] : x)))} aria-label="Preço por litro" style={{ maxWidth: 130 }} />
              <button className="adm-btn sm danger" onClick={() => setPrices(entries.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 size={14} /></button>
            </div>
          ))}
          <div><button className="adm-btn" onClick={() => setPrices([...entries, [`Combustível ${entries.length + 1}`, 5]])}><Plus size={15} /> Adicionar combustível</button></div>
        </div>
        <div className="adm-card"><h3>Trava de preço</h3><div className="adm-grid">
          <Field label="Validade (dias)"><Num {...f(["priceLock", "validityDays"])} /></Field>
          <Field label="Atalhos de litros" hint="Separados por vírgula"><Text value={(d.priceLock?.presets || []).join(", ")} onChange={(v) => set(["priceLock", "presets"], v.split(",").map((x) => Number(x.trim())).filter((x) => x > 0))} /></Field>
        </div></div>
      </>);
    }

    case "pontos": return (<>
      <h2>Pontos e níveis</h2><p className="lead">Regra de acúmulo e níveis do programa.</p>
      <div className="adm-card"><div className="adm-grid">
        <Field label="Pontos por R$ 1"><Num step="0.1" {...f(["points", "perReal"])} /></Field>
        <Field label="Multiplicador pagando pelo app" hint="2 = pontos em dobro"><Num step="0.5" {...f(["points", "appMultiplier"])} /></Field>
        <Field label="Aviso de expiração no extrato" hint="Deixe vazio para esconder"><Text {...f(["points", "expiringNotice"])} /></Field>
      </div></div>
      <div className="adm-card"><h3>Níveis</h3>
        <ListEditor items={d.levels || []} onChange={(v) => set(["levels"], v)} addLabel="Adicionar nível"
          title={(x) => x.name} summary={(x) => `a partir de ${Number(x.min || 0).toLocaleString("pt-BR")} pts`} make={() => ({ name: "Novo nível", min: 0 })}
          render={(x, u) => <div className="adm-grid">
            <Field label="Nome"><Text value={x.name} onChange={(v) => u({ ...x, name: v })} /></Field>
            <Field label="Pontos mínimos"><Num value={x.min} onChange={(v) => u({ ...x, min: v })} /></Field>
          </div>} />
      </div>
    </>);

    case "premios": return (<>
      <h2>Prêmios</h2><p className="lead">Catálogo de resgate. Desative um prêmio para tirá-lo do app sem perder o cadastro.</p>
      <ListEditor items={d.rewards || []} onChange={(v) => set(["rewards"], v)} addLabel="Adicionar prêmio"
        title={(x) => x.name} summary={(x) => `${Number(x.cost || 0).toLocaleString("pt-BR")} pts`}
        make={() => ({ id: `premio-${Date.now().toString(36)}`, name: "Novo prêmio", cat: "Conveniência", cost: 500, icon: "Gift", hue: "#2C82C9", desc: "", active: true })}
        render={(x, u) => <div className="adm-grid">
          <Field label="Nome"><Text value={x.name} onChange={(v) => u({ ...x, name: v })} /></Field>
          <Field label="Categoria"><Text value={x.cat} onChange={(v) => u({ ...x, cat: v })} list="adm-cats" /></Field>
          <Field label="Custo (pontos)"><Num value={x.cost} onChange={(v) => u({ ...x, cost: v })} /></Field>
          <Field label="Ícone"><IconSelect value={x.icon} onChange={(v) => u({ ...x, icon: v })} /></Field>
          <Field label="Cor do ícone"><Color value={x.hue} onChange={(v) => u({ ...x, hue: v })} /></Field>
          <Field label="Identificador" hint="Usado nos vouchers; evite mudar"><Text value={x.id} onChange={(v) => u({ ...x, id: slug(v) })} /></Field>
          <Field label="Descrição"><Text area value={x.desc} onChange={(v) => u({ ...x, desc: v })} /></Field>
        </div>} />
      <datalist id="adm-cats">{[...new Set((d.rewards || []).map((r) => r.cat))].map((c) => <option key={c} value={c} />)}</datalist>
    </>);

    case "parceiros": return (<>
      <h2>Parceiros do clube</h2><p className="lead">Estabelecimentos com benefício para clientes da rede.</p>
      <ListEditor items={d.partners || []} onChange={(v) => set(["partners"], v)} addLabel="Adicionar parceiro"
        title={(x) => x.name} summary={(x) => x.offer}
        make={() => ({ id: `parceiro-${Date.now().toString(36)}`, name: "Novo parceiro", offer: "10% de desconto", icon: "Building2", hue: "#2C82C9", address: "", rules: "", active: true })}
        render={(x, u) => <div className="adm-grid">
          <Field label="Nome"><Text value={x.name} onChange={(v) => u({ ...x, name: v })} /></Field>
          <Field label="Benefício"><Text value={x.offer} onChange={(v) => u({ ...x, offer: v })} /></Field>
          <Field label="Endereço"><Text value={x.address} onChange={(v) => u({ ...x, address: v })} /></Field>
          <Field label="Ícone"><IconSelect value={x.icon} onChange={(v) => u({ ...x, icon: v })} /></Field>
          <Field label="Cor do ícone"><Color value={x.hue} onChange={(v) => u({ ...x, hue: v })} /></Field>
          <Field label="Regras"><Text area value={x.rules} onChange={(v) => u({ ...x, rules: v })} /></Field>
        </div>} />
    </>);

    case "missoes": return (<>
      <h2>Missões</h2><p className="lead">Desafios semanais exibidos na tela inicial.</p>
      <ListEditor items={d.missions || []} onChange={(v) => set(["missions"], v)} addLabel="Adicionar missão"
        title={(x) => x.title} summary={(x) => x.reward}
        make={() => ({ id: `missao-${Date.now().toString(36)}`, title: "Nova missão", reward: "+100 pts", progress: 0, icon: "Target", active: true })}
        render={(x, u) => <div className="adm-grid">
          <Field label="Título"><Text value={x.title} onChange={(v) => u({ ...x, title: v })} /></Field>
          <Field label="Recompensa"><Text value={x.reward} onChange={(v) => u({ ...x, reward: v })} /></Field>
          <Field label="Progresso de exemplo (%)"><Num value={x.progress} onChange={(v) => u({ ...x, progress: Math.max(0, Math.min(100, v || 0)) })} /></Field>
          <Field label="Ícone"><IconSelect value={x.icon} onChange={(v) => u({ ...x, icon: v })} /></Field>
        </div>} />
    </>);

    case "pix": return (<>
      <h2>Pix</h2><p className="lead">Dados exibidos na recarga da carteira. Em produção, o código copia e cola deve ser gerado por cobrança pelo provedor Pix.</p>
      <div className="adm-card"><div className="adm-grid">
        <Field label="Chave Pix"><Text {...f(["pix", "key"])} /></Field>
        <Field label="Legenda da chave"><Text {...f(["pix", "keyLabel"])} /></Field>
      </div>
        <Field label="Código copia e cola"><Text area className="adm-input adm-mono" {...f(["pix", "payload"])} /></Field>
      </div>
    </>);

    case "campanha": {
      const camp = d.campaign || {};
      return (<>
        <h2>Campanha dos frentistas</h2><p className="lead">Metas, valores de bônus e desafios do modo frentista.</p>
        <div className="adm-card"><div className="adm-grid">
          <Field label="Nome da campanha"><Text {...f(["campaign", "name"])} /></Field>
          <Field label="Período"><Text {...f(["campaign", "period"])} /></Field>
          <Field label="Meta de bônus (R$)"><Num step="0.01" {...f(["campaign", "prize"])} /></Field>
          <Field label="Descrição do prêmio"><Text {...f(["campaign", "prizeLabel"])} /></Field>
          <Field label="Meta de vendas com CPF (%)" hint="0 esconde esta meta"><Num {...f(["campaign", "identGoal"])} /></Field>
        </div></div>
        <div className="adm-card"><h3>Metas com bônus</h3>
          <ListEditor items={camp.items || []} onChange={(v) => set(["campaign", "items"], v)} addLabel="Adicionar meta"
            title={(x) => x.label} summary={(x) => `R$ ${Number(x.reward || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · meta ${x.goal}`}
            make={() => ({ key: `meta${Date.now().toString(36)}`, label: "Nova meta", action: "+1 venda", icon: "Target", goal: 10, reward: 2 })}
            render={(x, u) => <div className="adm-grid">
              <Field label="Nome"><Text value={x.label} onChange={(v) => u({ ...x, label: v })} /></Field>
              <Field label="Texto do botão"><Text value={x.action} onChange={(v) => u({ ...x, action: v })} /></Field>
              <Field label="Meta (quantidade)"><Num value={x.goal} onChange={(v) => u({ ...x, goal: v })} /></Field>
              <Field label="Bônus por unidade (R$)"><Num step="0.01" value={x.reward} onChange={(v) => u({ ...x, reward: v })} /></Field>
              <Field label="Ícone"><IconSelect value={x.icon} onChange={(v) => u({ ...x, icon: v })} /></Field>
            </div>} />
        </div>
        <div className="adm-card"><h3>Desafios da semana</h3>
          <ListEditor items={camp.challenges || []} onChange={(v) => set(["campaign", "challenges"], v)} addLabel="Adicionar desafio"
            title={(x) => x.title} summary={(x) => x.reward} make={() => ({ title: "Novo desafio", reward: "+ R$ 10", icon: "Zap" })}
            render={(x, u) => <div className="adm-grid">
              <Field label="Desafio"><Text value={x.title} onChange={(v) => u({ ...x, title: v })} /></Field>
              <Field label="Recompensa"><Text value={x.reward} onChange={(v) => u({ ...x, reward: v })} /></Field>
              <Field label="Ícone"><IconSelect value={x.icon} onChange={(v) => u({ ...x, icon: v })} /></Field>
            </div>} />
        </div>
      </>);
    }

    case "contato": return (<>
      <h2>Postos e atendimento</h2><p className="lead">Unidades usadas no agendamento e nos textos, e contatos mostrados no perfil.</p>
      <div className="adm-card"><h3>Postos</h3>
        <ListEditor items={(d.stations || []).map((name) => ({ name }))} onChange={(v) => set(["stations"], v.map((x) => x.name))} addLabel="Adicionar posto"
          title={(x) => `Posto ${x.name}`} make={() => ({ name: "Novo" })}
          render={(x, u) => <Field label="Nome da unidade"><Text value={x.name} onChange={(v) => u({ name: v })} /></Field>} />
      </div>
      <div className="adm-card"><h3>Atendimento</h3><div className="adm-grid">
        <Field label="Telefone"><Text {...f(["support", "phone"])} /></Field>
        <Field label="E-mail"><Text {...f(["support", "email"])} /></Field>
      </div></div>
    </>);

    case "dominios": return (<>
      <h2>Domínios</h2><p className="lead">Endereços que abrem o app já com esta rede. Aponte o domínio (DNS) para o servidor e cadastre aqui. Também é possível abrir qualquer rede com <span className="adm-mono">?rede={d.id}</span> no endereço.</p>
      <div className="adm-card">
        <Field label="Domínios" hint="Um por linha, sem https://"><Text area className="adm-input adm-mono" value={(d.domains || []).join("\n")} onChange={(v) => set(["domains"], v.split("\n").map((x) => x.trim().toLowerCase()).filter(Boolean))} /></Field>
        <div><a className="adm-btn" href={`${window.location.pathname}?rede=${d.id}#/`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir o app desta rede</a></div>
      </div>
    </>);

    case "historico": return <HistoryPanel ctx={ctx} />;

    case "equipe": return <StaffPanel ctx={ctx} stations={d.stations || []} />;

    case "json": return <JsonPanel d={d} ctx={ctx} />;
    default: return null;
  }
}

function HistoryPanel({ ctx }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.history(ctx.id).then(setRows).catch((e) => setErr(e.message)); }, [ctx.id, ctx.version]);
  return (<>
    <h2>Histórico de versões</h2><p className="lead">Cada publicação guarda a versão anterior. Restaurar publica uma nova versão com o conteúdo antigo.</p>
    {isDemo() && <div className="adm-alert warn"><AlertTriangle size={16} /> O histórico fica no servidor e não está disponível no modo demonstração.</div>}
    {err && <div className="adm-alert err">{err}</div>}
    {rows && rows.length === 0 && !isDemo() && <p className="lead">Ainda não há versões anteriores.</p>}
    {rows && rows.length > 0 && (
      <div className="adm-card" style={{ overflowX: "auto" }}>
        <table className="adm-table"><thead><tr><th>VERSÃO</th><th>PUBLICADA EM</th><th>POR</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.version}>
              <td className="adm-mono">v{r.version}</td>
              <td>{fmtDate(r.updatedAt)}</td>
              <td>{r.updatedBy || "—"}</td>
              <td style={{ textAlign: "right" }}><button className="adm-btn sm" onClick={() => ctx.rollback(r.version)}><RotateCcw size={14} /> Restaurar</button></td>
            </tr>))}</tbody>
        </table>
      </div>
    )}
  </>);
}

const fmtDate = (v) => {
  const d = v?.toDate ? v.toDate() : v?.seconds ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleString("pt-BR") : "—";
};

const ROLE_LABEL = { attendant: "Frentista", manager: "Gerente", owner: "Dono" };

/** RN-02/RN-03: papéis por rede, definidos pelo e-mail da conta. */
function StaffPanel({ ctx, stations }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ email: "", role: "attendant", station: stations[0] || "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.listStaff(ctx.id).then(setRows).catch((e) => ctx.toast(e.message)), [ctx.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const save = async (email, role, station) => {
    setBusy(true);
    try { await api.setStaffRole(ctx.id, email, role, station); ctx.toast(role ? "Papel atualizado · vale no próximo login da pessoa" : "Acesso removido"); setForm((f) => ({ ...f, email: "" })); load(); }
    catch (e) { ctx.toast(e.message); }
    finally { setBusy(false); }
  };
  return (<>
    <h2>Equipe</h2><p className="lead">Frentistas registram vendas e validam vouchers. Gerentes também editam a configuração. Só o dono promove gerentes. A pessoa precisa ter criado a conta no app antes.</p>
    {isDemo() && <div className="adm-alert warn" style={{ marginBottom: 12 }}><AlertTriangle size={16} /> A gestão de equipe precisa do Firebase configurado. Abaixo, um exemplo.</div>}
    <form className="adm-card" onSubmit={(e) => { e.preventDefault(); if (form.email) save(form.email.trim(), form.role, form.station); }}>
      <h3>Adicionar ou alterar</h3>
      <div className="adm-grid">
        <Field label="E-mail da conta"><input id="adm-staff-email" className="adm-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pessoa@email.com" /></Field>
        <Field label="Papel"><select id="adm-staff-role" className="adm-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Posto"><select id="adm-staff-station" className="adm-input" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>{stations.map((st) => <option key={st}>{st}</option>)}</select></Field>
      </div>
      <div><button className="adm-btn primary" type="submit" disabled={busy || !form.email}>Salvar papel</button></div>
    </form>
    {rows && (
      <div className="adm-card" style={{ overflowX: "auto" }}>
        <table className="adm-table"><thead><tr><th>NOME</th><th>E-MAIL</th><th>PAPEL</th><th>POSTO</th><th>CÓDIGO</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
              <td>{r.name}</td><td>{r.email}</td><td>{r.active ? ROLE_LABEL[r.role] || r.role : "Sem acesso"}</td><td>{r.station || "—"}</td>
              <td className="adm-mono">{r.code || "—"}</td>
              <td style={{ textAlign: "right" }}>{r.active && <button className="adm-btn sm danger" disabled={busy} onClick={() => save(r.email, null, null)}>Remover acesso</button>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    )}
  </>);
}

function JsonPanel({ d, ctx }) {
  const [txt, setTxt] = useState(() => JSON.stringify(d, null, 2));
  const [err, setErr] = useState(null);
  useEffect(() => { setTxt(JSON.stringify(d, null, 2)); }, [d]);
  const apply = () => {
    try { const v = JSON.parse(txt); setErr(null); ctx.replace({ ...v, id: d.id, version: d.version }); }
    catch (e) { setErr(`JSON inválido: ${e.message}`); }
  };
  return (<>
    <h2>JSON completo</h2><p className="lead">Edição direta de toda a configuração, útil para copiar entre redes. Aplicar só altera o rascunho; nada vai ao ar até publicar.</p>
    {err && <div className="adm-alert err" style={{ marginBottom: 10 }}>{err}</div>}
    <textarea className="adm-input adm-mono" style={{ minHeight: 480, fontSize: 12 }} value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false} aria-label="Configuração em JSON" />
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <button className="adm-btn primary" onClick={apply}><Check size={15} /> Aplicar ao rascunho</button>
      <button className="adm-btn" onClick={() => { navigator.clipboard?.writeText(txt).then(() => ctx.toast("JSON copiado"), () => ctx.toast("Selecione o texto e copie manualmente")); }}>Copiar</button>
    </div>
  </>);
}

/* ---------- pré-visualização ---------- */
const PREVIEW_ROUTES = [["/inicio", "Início"], ["/carteira", "Carteira"], ["/resgatar", "Resgatar"], ["/clube", "Clube"], ["/qr", "QR"]];

function Preview({ draft }) {
  const ref = useRef(null);
  const [route, setRoute] = useState("/inicio");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const post = useCallback(() => ref.current?.contentWindow?.postMessage({ type: "tenant-preview", config: draftRef.current }, window.location.origin), []);
  useEffect(() => {
    const onMsg = (e) => { if (e.origin === window.location.origin && e.data?.type === "tenant-preview-ready") post(); };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [post]);
  useEffect(() => { const t = setTimeout(post, 150); return () => clearTimeout(t); }, [draft, post]);
  const src = `${window.location.pathname}?rede=${draft.id}&preview=1#${route}`;
  return (
    <aside className="adm-preview">
      <div className="adm-meta">Pré-visualização do rascunho</div>
      <div className="tabs">{PREVIEW_ROUTES.map(([r, l]) => <button key={r} className={`adm-btn sm ${route === r ? "primary" : ""}`} onClick={() => setRoute(r)}>{l}</button>)}</div>
      <div className="adm-phone"><iframe ref={ref} key={src} src={src} title="Pré-visualização do app" /></div>
    </aside>
  );
}

/* ---------- painel ---------- */
export default function Admin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token] = useState(null);
  const [session, setSession] = useState(null); // { admin, tenants }
  const [loginErr, setLoginErr] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [published, setPublished] = useState(null);
  const [draft, setDraft] = useState(null);
  const [section, setSection] = useState("marca");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [creating, setCreating] = useState(false);
  const toastT = useRef();

  const toast = (m) => { clearTimeout(toastT.current); setToastMsg(m); toastT.current = setTimeout(() => setToastMsg(null), 2600); };

  const enter = async () => {
    const r = await api.listTenants();
    if (!r.tenants.length && !r.admin.all) throw new Error("Esta conta não é gerente de nenhuma rede.");
    setSession(r);
    setTenantId((cur) => cur || r.tenants[0]?.id || null);
  };
  const login = async () => {
    setLoginErr(null);
    try { await api.login(email.trim(), password); await enter(); }
    catch (e) {
      const msg = /invalid-credential|wrong-password|user-not-found/.test(e.code || e.message) ? "E-mail ou senha incorretos." : e.message;
      setLoginErr(msg);
      if (!isDemo()) api.logout();
    }
  };
  // sessão já aberta neste navegador
  useEffect(() => api.currentUser((u) => { if (u && !session) enter().catch(() => {}); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (id) => {
    const cfg = await api.getConfig(id);
    setPublished(cfg); setDraft(clone(cfg)); setErrors([]);
  }, []);
  useEffect(() => { if (tenantId) load(tenantId).catch((e) => toast(e.message)); }, [tenantId, load]);

  const dirty = useMemo(() => draft && published && JSON.stringify(draft) !== JSON.stringify(published), [draft, published]);
  const set = (path, v) => setDraft((d) => setIn(d, path, v));

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const publish = async () => {
    const errs = validate(draft);
    setErrors(errs);
    if (errs.length) return toast("Corrija os itens destacados antes de publicar");
    setBusy(true);
    try {
      const saved = await api.saveConfig(tenantId, draft, published.version);
      setPublished(saved); setDraft(clone(saved));
      setSession((s) => ({ ...s, tenants: s.tenants.map((t) => (t.id === saved.id ? { ...t, name: saved.brand.name, version: saved.version, colors: saved.brand.colors } : t)) }));
      toast(`Versão ${saved.version} publicada · ${isDemo() ? "os apps atualizam em até 1 minuto" : "os apps já receberam"}`);
    } catch (e) {
      setErrors(e.details || [e.message]);
      toast(e.status === 409 ? "Conflito de versão" : "Não foi possível publicar");
    } finally { setBusy(false); }
  };

  const rollback = async (v) => {
    try { const saved = await api.rollback(tenantId, v); setPublished(saved); setDraft(clone(saved)); toast(`Versão ${v} restaurada como v${saved.version}`); }
    catch (e) { toast(e.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const id = slug(String(fd.get("id") || name));
    if (!name || !id) return toast("Informe o nome da nova rede");
    try {
      const cfg = await api.createTenant({ id, name, from: String(fd.get("from")) });
      setSession((s) => ({ ...s, tenants: [...s.tenants, { id: cfg.id, name: cfg.brand.name, version: cfg.version, colors: cfg.brand.colors, domains: [] }] }));
      setCreating(false); setTenantId(cfg.id); setSection("marca");
      toast(`Rede "${name}" criada a partir de um modelo`);
    } catch (err) { toast(err.message); }
  };

  /* login */
  if (!session) {
    return (
      <div className="adm"><div className="adm-login">
        <form onSubmit={(e) => { e.preventDefault(); login(); }}>
          <div><h2 style={{ margin: 0 }}>Painel da rede</h2><p className="adm-meta" style={{ margin: "4px 0 0" }}>Altere marca, preços, prêmios e recursos do app sem publicar uma nova versão.</p></div>
          <Field label="E-mail"><input id="adm-email" className="adm-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isDemo() ? "qualquer valor no modo demonstração" : "gerente@rede.com.br"} autoFocus /></Field>
          <Field label="Senha"><input id="adm-password" className="adm-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {loginErr && <div className="adm-alert err">{loginErr}</div>}
          <button className="adm-btn primary" type="submit" style={{ justifyContent: "center" }}>Entrar</button>
          <button className="adm-btn" type="button" onClick={() => nav("/")} style={{ justifyContent: "center" }}>Voltar ao app</button>
          <small className="adm-meta">{isDemo() ? "Firebase não configurado: o painel abre em modo demonstração e as alterações ficam salvas só neste navegador." : "Acesso para gerentes e donos da rede. O papel é definido pelo dono da rede ou pelo administrador da plataforma."}</small>
        </form>
      </div></div>
    );
  }

  const current = session.tenants.find((t) => t.id === tenantId);
  const ctx = { id: tenantId, token, version: published?.version, rollback, replace: (v) => setDraft(v), toast };

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="brand"><span className="adm-dot" style={{ background: current?.colors?.brand || "#999", width: 14, height: 14 }} /> Painel da rede</div>
        <select className="adm-input" style={{ width: 220 }} value={tenantId || ""} aria-label="Rede"
          onChange={(e) => { if (dirty && !window.confirm?.("Descartar alterações não publicadas?")) return; setTenantId(e.target.value); }}>
          {session.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {session.admin.all && <button className="adm-btn" onClick={() => setCreating(true)}><Plus size={15} /> Nova rede</button>}
        {published && <span className="adm-meta">Publicado: <b className="adm-mono">v{published.version}</b>{published.updatedAt ? ` · ${fmtDate(published.updatedAt)}` : ""}{published.updatedBy ? ` · ${published.updatedBy}` : ""}</span>}
        {isDemo() && <span className="adm-pill warn">MODO DEMONSTRAÇÃO</span>}
        <span className="spacer" />
        {dirty ? <span className="adm-pill warn">Alterações não publicadas</span> : published && <span className="adm-pill ok">Tudo publicado</span>}
        <button className="adm-btn" disabled={!dirty} onClick={() => { setDraft(clone(published)); setErrors([]); }}><RotateCcw size={15} /> Descartar</button>
        <button className="adm-btn primary" disabled={!dirty || busy} onClick={publish}><Upload size={15} /> {busy ? "Publicando…" : "Publicar"}</button>
        <button className="adm-btn" onClick={async () => { await api.logout(); setSession(null); setPassword(""); }} aria-label="Sair"><LogOut size={15} /></button>
      </header>

      <div className="adm-body">
        <nav className="adm-nav">
          {SECTIONS.map((s, i) => s.grp
            ? <div key={i} className="grp">{s.grp.toUpperCase()}</div>
            : <button key={s.id} className={section === s.id ? "on" : ""} onClick={() => setSection(s.id)}><s.Icon size={16} /> {s.label}</button>)}
        </nav>

        <main className="adm-main">
          {creating && (
            <form className="adm-card" onSubmit={create} style={{ borderColor: "#1B1F27" }}>
              <h3>Nova rede</h3>
              <div className="adm-grid">
                <Field label="Nome da rede"><input id="adm-new-name" name="name" className="adm-input" placeholder="Ex.: Auto Posto Estrela" /></Field>
                <Field label="Identificador" hint="Vazio = gerado a partir do nome"><input id="adm-new-id" name="id" className="adm-input adm-mono" placeholder="auto-posto-estrela" /></Field>
                <Field label="Copiar configuração de"><select id="adm-new-from" name="from" className="adm-input">{session.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              </div>
              <div style={{ display: "flex", gap: 8 }}><button className="adm-btn primary" type="submit">Criar rede</button><button className="adm-btn" type="button" onClick={() => setCreating(false)}>Cancelar</button></div>
            </form>
          )}
          {errors.length > 0 && (
            <div className="adm-alert err" style={{ marginBottom: 14 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div><b>Não publicado.</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
            </div>
          )}
          {!draft ? <p className="lead">Carregando configuração…</p> : <Section id={section} d={draft} set={set} ctx={ctx} />}
        </main>

        {draft && <Preview draft={draft} />}
      </div>
      {toastMsg && <div className="adm-toast" role="status">{toastMsg}</div>}
    </div>
  );
}
