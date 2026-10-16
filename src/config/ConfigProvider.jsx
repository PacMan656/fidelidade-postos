import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, cache, BUNDLED, DEFAULT_TENANT, isDemo } from "./api";
import { applyBrand } from "../theme";

const Ctx = createContext(null);
const POLL_MS = 60_000;
const params = new URLSearchParams(window.location.search);
export const PREVIEW = params.get("preview") === "1";

function initialTenant() {
  const fromUrl = params.get("rede");
  if (fromUrl) { try { localStorage.setItem("tenant-selected", fromUrl); } catch {} return fromUrl; }
  try { return localStorage.getItem("tenant-selected") || null; } catch { return null; }
}

/**
 * Resolve a rede (URL ?rede= → escolha salva → domínio → padrão), carrega a configuração e mantém atualizada:
 * com Firebase, em tempo real pelo Firestore; no modo demonstração, pelo armazenamento local.
 */
export function ConfigProvider({ children }) {
  const [tenantId, setTenantId] = useState(initialTenant);
  const [config, setConfig] = useState(() => (tenantId && (cache.get(tenantId) || BUNDLED[tenantId])) || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tenantId) return;
    api.resolveHost(window.location.hostname).then((id) => setTenantId(id || DEFAULT_TENANT)).catch(() => setTenantId(DEFAULT_TENANT));
  }, [tenantId]);

  const accept = useCallback((fresh) => {
    setError(null);
    // mantém a referência quando nada mudou, para não redesenhar à toa
    setConfig((cur) => (cur && JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh));
    // Timestamps do Firestore não são serializáveis: guarda uma cópia simples
    cache.set(fresh.id, JSON.parse(JSON.stringify(fresh)));
  }, []);

  const onFail = useCallback((e) => { if (e.status === 404) setError(`A rede "${tenantId}" não foi encontrada.`); }, [tenantId]);

  const refresh = useCallback(async () => {
    if (!tenantId || PREVIEW) return;
    try { accept(await api.getConfig(tenantId)); } catch (e) { onFail(e); }
  }, [tenantId, accept, onFail]);

  useEffect(() => {
    if (!tenantId || PREVIEW) return undefined;
    setConfig((cur) => (cur?.id === tenantId ? cur : cache.get(tenantId) || BUNDLED[tenantId] || null));
    if (!isDemo()) return api.watchConfig(tenantId, accept, onFail); // tempo real

    refresh();
    const t = setInterval(refresh, POLL_MS);
    const onStorage = (e) => { if (e.key === api.demoKey(tenantId)) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(t); window.removeEventListener("storage", onStorage); };
  }, [tenantId, refresh, accept, onFail]);

  // pré-visualização do painel: recebe o rascunho ainda não publicado
  useEffect(() => {
    if (!PREVIEW) return undefined;
    const onMsg = (e) => { if (e.origin === window.location.origin && e.data?.type === "tenant-preview") setConfig(e.data.config); };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "tenant-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const switchTenant = useCallback((id) => {
    try { localStorage.setItem("tenant-selected", id); } catch {}
    setConfig(cache.get(id) || BUNDLED[id] || null);
    setTenantId(id);
  }, []);

  useMemo(() => { if (config?.brand?.colors) applyBrand(config.brand.colors); }, [config]);

  const value = useMemo(() => ({ config, tenantId, switchTenant, refresh }), [config, tenantId, switchTenant, refresh]);

  if (!config) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24, textAlign: "center", fontFamily: "system-ui" }}>
        {error ? <>
          <b>{error}</b>
          <button onClick={() => switchTenant(DEFAULT_TENANT)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #ccc", background: "#fff" }}>Abrir rede padrão</button>
        </> : <span>Carregando…</span>}
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);
