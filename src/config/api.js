// Acesso ao servidor de configuração. Sem servidor (ex.: prévia estática), entra em "modo demonstração":
// as configurações embutidas servem de base e as edições do painel ficam neste navegador.
import donaRosa from "../../server/data/tenants/dona-rosa.json";
import redeAvenida from "../../server/data/tenants/rede-avenida.json";

export const BUNDLED = { "dona-rosa": donaRosa, "rede-avenida": redeAvenida };
export const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT || "dona-rosa";
const API = (import.meta.env.VITE_API_URL || "") + "/api";
const DEMO_KEY = (id) => `tenant-demo-${id}`;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

async function request(path, { token, ...opts } = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const isJson = (res.headers.get("content-type") || "").includes("json");
  const data = isJson ? await res.json() : null;
  if (!isJson) throw Object.assign(new Error("Servidor de configuração indisponível"), { offline: true });
  if (!res.ok) throw Object.assign(new Error(data?.error || `Erro ${res.status}`), { status: res.status, details: data?.details });
  return data;
}

let demoMode = null; // descoberto na primeira chamada
export const isDemo = () => demoMode === true;

async function withDemo(online, offline) {
  if (demoMode === true) return offline();
  try { const r = await online(); demoMode = false; return r; }
  catch (e) {
    if (e.offline || e instanceof TypeError) { demoMode = true; return offline(); }
    throw e;
  }
}

const demoConfig = (id) => store.get(DEMO_KEY(id)) || BUNDLED[id] || null;
const demoTenants = () => {
  const ids = new Set([...Object.keys(BUNDLED), ...(store.get("tenant-demo-ids") || [])]);
  return [...ids].map(demoConfig).filter(Boolean).map((c) => ({ id: c.id, name: c.brand.name, version: c.version, updatedAt: c.updatedAt, domains: c.domains || [], colors: c.brand.colors }));
};

export const api = {
  getConfig: (id) => withDemo(
    () => request(`/config/${id}`),
    () => { const c = demoConfig(id); if (!c) throw Object.assign(new Error("Rede não encontrada"), { status: 404 }); return c; },
  ),
  resolveHost: (host) => withDemo(() => request(`/resolve?host=${encodeURIComponent(host)}`).then((r) => r.id), () => null),
  listTenants: (token) => withDemo(
    () => request("/tenants", { token }),
    () => ({ admin: { name: "Modo demonstração", all: true }, tenants: demoTenants() }),
  ),
  saveConfig: (id, cfg, token) => withDemo(
    () => request(`/config/${id}`, { method: "PUT", body: JSON.stringify(cfg), token }),
    () => {
      const next = { ...cfg, id, version: (demoConfig(id)?.version || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: "Modo demonstração" };
      store.set(DEMO_KEY(id), next);
      return next;
    },
  ),
  createTenant: (data, token) => withDemo(
    () => request("/tenants", { method: "POST", body: JSON.stringify(data), token }),
    () => {
      if (demoConfig(data.id)) throw new Error("Já existe uma rede com esse identificador");
      const base = structuredClone(demoConfig(data.from || "dona-rosa"));
      const cfg = { ...base, id: data.id, version: 1, domains: [], brand: { ...base.brand, name: data.name, wordmark: data.name.toUpperCase() } };
      store.set(DEMO_KEY(data.id), cfg);
      store.set("tenant-demo-ids", [...(store.get("tenant-demo-ids") || []), data.id]);
      return cfg;
    },
  ),
  history: (id, token) => withDemo(() => request(`/config/${id}/history`, { token }), () => []),
  rollback: (id, version, token) => withDemo(() => request(`/config/${id}/rollback/${version}`, { method: "POST", token }), () => { throw new Error("Histórico indisponível no modo demonstração"); }),
  demoKey: DEMO_KEY,
};

export const cache = {
  get: (id) => store.get(`tenant-cache-${id}`),
  set: (id, cfg) => store.set(`tenant-cache-${id}`, cfg),
};
