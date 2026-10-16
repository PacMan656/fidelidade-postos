// Acesso à configuração das redes e às operações do painel.
// Com Firebase: Firestore (leitura pública da configuração) + Cloud Functions (publicação, equipe, histórico).
// Sem Firebase: "modo demonstração" — configurações embutidas e edições salvas neste navegador.
import { doc, getDoc, onSnapshot, collection, getDocs, query, orderBy } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { firebaseEnabled, db, auth, call } from "../services/firebase";
import donaRosa from "../../seed/tenants/dona-rosa.json";
import redeAvenida from "../../seed/tenants/rede-avenida.json";

export const BUNDLED = { "dona-rosa": donaRosa, "rede-avenida": redeAvenida };
export const DEFAULT_TENANT = import.meta.env.VITE_DEFAULT_TENANT || "dona-rosa";
const DEMO_KEY = (id) => `tenant-demo-${id}`;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export const isDemo = () => !firebaseEnabled;

const demoConfig = (id) => store.get(DEMO_KEY(id)) || BUNDLED[id] || null;
const demoTenants = () => {
  const ids = new Set([...Object.keys(BUNDLED), ...(store.get("tenant-demo-ids") || [])]);
  return [...ids].map(demoConfig).filter(Boolean).map((c) => ({ id: c.id, name: c.brand.name, version: c.version, colors: c.brand.colors, role: "owner" }));
};
const notFound = () => Object.assign(new Error("Rede não encontrada"), { status: 404 });

/* ---------- leitura da configuração (app) ---------- */
export const api = {
  async getConfig(id) {
    if (!firebaseEnabled) { const c = demoConfig(id); if (!c) throw notFound(); return c; }
    const snap = await getDoc(doc(db, "tenants", id));
    if (!snap.exists()) throw notFound();
    return snap.data();
  },
  /** Assina a configuração; devolve a função para cancelar. */
  watchConfig(id, onData, onError) {
    if (!firebaseEnabled) return () => {};
    return onSnapshot(doc(db, "tenants", id), (snap) => (snap.exists() ? onData(snap.data()) : onError?.(notFound())), (e) => onError?.(e));
  },
  async resolveHost(host) {
    if (!firebaseEnabled || !host) return null;
    try { const s = await getDoc(doc(db, "domains", host)); return s.exists() ? s.get("tenantId") : null; } catch { return null; }
  },
  demoKey: DEMO_KEY,
};

export const cache = {
  get: (id) => store.get(`tenant-cache-${id}`),
  set: (id, cfg) => store.set(`tenant-cache-${id}`, cfg),
};

/* ---------- operações do painel ---------- */
export const adminApi = {
  /** Firebase: e-mail e senha de gerente. Demonstração: qualquer valor. */
  async login(email, password) {
    if (!firebaseEnabled) return { name: "Modo demonstração" };
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { name: cred.user.displayName || cred.user.email };
  },
  currentUser(cb) {
    if (!firebaseEnabled) { cb(null); return () => {}; }
    return onAuthStateChanged(auth, (u) => cb(u ? { name: u.displayName || u.email } : null));
  },
  async logout() { if (firebaseEnabled) await signOut(auth); },
  async listTenants() {
    if (!firebaseEnabled) return { admin: { name: "Modo demonstração", all: true }, tenants: demoTenants() };
    const r = await call("myTenants", {});
    return { admin: { name: auth.currentUser?.displayName || auth.currentUser?.email, all: r.platformAdmin }, tenants: r.tenants.filter((t) => ["manager", "owner"].includes(t.role)) };
  },
  getConfig: (id) => api.getConfig(id),
  async saveConfig(id, cfg, expectedVersion) {
    if (!firebaseEnabled) {
      const next = { ...cfg, id, version: (demoConfig(id)?.version || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: "Modo demonstração" };
      store.set(DEMO_KEY(id), next);
      return next;
    }
    try {
      await call("publishConfig", { tenantId: id, config: cfg, expectedVersion });
    } catch (e) {
      throw Object.assign(e, { status: e.code === "functions/aborted" ? 409 : 422, details: Array.isArray(e.details) ? e.details : undefined });
    }
    return api.getConfig(id);
  },
  async createTenant(data) {
    if (!firebaseEnabled) {
      if (demoConfig(data.id)) throw new Error("Já existe uma rede com esse identificador");
      const base = structuredClone(demoConfig(data.from || "dona-rosa"));
      const cfg = { ...base, id: data.id, version: 1, domains: [], brand: { ...base.brand, name: data.name, wordmark: data.name.toUpperCase() } };
      store.set(DEMO_KEY(data.id), cfg);
      store.set("tenant-demo-ids", [...(store.get("tenant-demo-ids") || []), data.id]);
      return cfg;
    }
    await call("createTenant", data);
    return api.getConfig(data.id);
  },
  async history(id) {
    if (!firebaseEnabled) return [];
    return call("listConfigHistory", { tenantId: id });
  },
  async rollback(id, version) {
    if (!firebaseEnabled) throw new Error("Histórico indisponível no modo demonstração");
    await call("rollbackConfig", { tenantId: id, version });
    return api.getConfig(id);
  },
  async listStaff(id) {
    if (!firebaseEnabled) return [{ id: "demo", name: "Carlos", email: "carlos@exemplo.com", role: "attendant", station: "Centro", code: "DEMO01", active: true }];
    const snap = await getDocs(query(collection(db, `tenants/${id}/staff`), orderBy("name")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async setStaffRole(id, email, role, station) {
    if (!firebaseEnabled) throw new Error("Gestão de equipe precisa do Firebase configurado");
    return call("setStaffRole", { tenantId: id, email, role, station });
  },
};
