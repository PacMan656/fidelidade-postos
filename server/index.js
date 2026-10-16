// Servidor de configuração white-label.
// - GET  /api/config/:rede        → configuração pública da rede (o app lê ao abrir e a cada minuto)
// - GET  /api/resolve?host=...    → descobre a rede pelo domínio
// - GET  /api/tenants             → redes que o token pode editar           (painel)
// - PUT  /api/config/:rede        → publica nova configuração (versão +1)   (painel)
// - POST /api/tenants             → cria rede a partir de outra             (painel)
// - GET  /api/config/:rede/history→ versões anteriores                     (painel)
// - POST /api/config/:rede/rollback/:versao                                 (painel)
// Também serve o app compilado (dist/) com fallback de SPA.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, "data");
const TENANTS = path.join(DATA, "tenants");
const HISTORY = path.join(DATA, "history");
const DIST = path.join(ROOT, "..", "dist");
const PORT = Number(process.env.PORT) || 8787;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

const readJson = async (f) => JSON.parse(await fs.readFile(f, "utf8"));
const tenantFile = (id) => path.join(TENANTS, `${id}.json`);

async function admins() {
  if (process.env.ADMIN_TOKEN) return [{ name: "env", token: process.env.ADMIN_TOKEN, tenants: ["*"] }];
  return (await readJson(path.join(DATA, "admins.json"))).admins;
}

async function auth(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return (await admins()).find((a) => a.token === token) || null;
}
const canEdit = (admin, id) => admin && (admin.tenants.includes("*") || admin.tenants.includes(id));

function send(res, status, body, headers = {}) {
  const isObj = typeof body === "object" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    "Content-Type": isObj ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const ch of req) { size += ch.length; if (size > 1_000_000) throw new Error("Corpo muito grande"); chunks.push(ch); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// validação mínima: o painel faz a validação completa, aqui garantimos o que quebraria o app
function validate(cfg) {
  const errs = [];
  if (!cfg || typeof cfg !== "object") return ["Configuração inválida"];
  if (!cfg.brand?.name) errs.push("brand.name é obrigatório");
  for (const k of ["brand", "brandDeep", "ink", "accent", "cream"]) {
    if (!/^#[0-9a-fA-F]{6}$/.test(cfg.brand?.colors?.[k] || "")) errs.push(`brand.colors.${k} deve ser #RRGGBB`);
  }
  if (!Array.isArray(cfg.levels) || !cfg.levels.length) errs.push("levels precisa de ao menos 1 nível");
  if (!cfg.fuelPrices || !Object.keys(cfg.fuelPrices).length) errs.push("fuelPrices precisa de ao menos 1 combustível");
  for (const k of ["rewards", "partners", "missions", "stations"]) if (!Array.isArray(cfg[k])) errs.push(`${k} deve ser uma lista`);
  return errs;
}

async function listTenants() {
  const files = (await fs.readdir(TENANTS)).filter((f) => f.endsWith(".json"));
  return Promise.all(files.map(async (f) => {
    const c = await readJson(path.join(TENANTS, f));
    return { id: c.id, name: c.brand?.name, version: c.version, updatedAt: c.updatedAt, domains: c.domains || [], colors: c.brand?.colors };
  }));
}

async function save(id, cfg, who) {
  let prev = null;
  try { prev = await readJson(tenantFile(id)); } catch {}
  if (prev) {
    await fs.mkdir(path.join(HISTORY, id), { recursive: true });
    await fs.writeFile(path.join(HISTORY, id, `v${prev.version}.json`), JSON.stringify(prev, null, 2));
  }
  const next = { ...cfg, id, version: (prev?.version || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: who };
  const tmp = tenantFile(id) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(next, null, 2));
  await fs.rename(tmp, tenantFile(id)); // escrita atômica
  return next;
}

async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // remove "api"
  const m = req.method;

  if (m === "GET" && parts[0] === "config" && parts.length === 2) {
    if (!ID_RE.test(parts[1])) return send(res, 400, { error: "Rede inválida" });
    try {
      const cfg = await readJson(tenantFile(parts[1]));
      return send(res, 200, cfg, { "Cache-Control": "no-cache", ETag: `"${cfg.version}"` });
    } catch { return send(res, 404, { error: "Rede não encontrada" }); }
  }

  if (m === "GET" && parts[0] === "resolve") {
    const host = (url.searchParams.get("host") || "").toLowerCase();
    const t = (await listTenants()).find((x) => x.domains.includes(host));
    return send(res, 200, { id: t ? t.id : null }); // null = app usa a rede padrão
  }

  const admin = await auth(req);
  if (!admin) return send(res, 401, { error: "Token inválido ou ausente" });

  if (m === "GET" && parts[0] === "tenants") {
    const all = await listTenants();
    return send(res, 200, { admin: { name: admin.name, all: admin.tenants.includes("*") }, tenants: all.filter((t) => canEdit(admin, t.id)) });
  }

  if (m === "POST" && parts[0] === "tenants") {
    if (!admin.tenants.includes("*")) return send(res, 403, { error: "Só o administrador da plataforma cria redes" });
    const { id, name, from = "dona-rosa" } = await body(req);
    if (!ID_RE.test(id || "")) return send(res, 400, { error: "Identificador: letras minúsculas, números e hífen" });
    try { await fs.access(tenantFile(id)); return send(res, 409, { error: "Já existe uma rede com esse identificador" }); } catch {}
    const base = await readJson(tenantFile(from));
    base.brand = { ...base.brand, name: name || id, wordmark: (name || id).toUpperCase() };
    base.domains = [];
    return send(res, 201, await save(id, base, admin.name));
  }

  if (parts[0] === "config" && parts[1]) {
    const id = parts[1];
    if (!ID_RE.test(id)) return send(res, 400, { error: "Rede inválida" });
    if (!canEdit(admin, id)) return send(res, 403, { error: "Sem permissão para esta rede" });

    if (m === "PUT" && parts.length === 2) {
      const cfg = await body(req);
      const errs = validate(cfg);
      if (errs.length) return send(res, 422, { error: "Configuração inválida", details: errs });
      try {
        const cur = await readJson(tenantFile(id));
        if (cfg.version && cfg.version !== cur.version) return send(res, 409, { error: `Outra pessoa publicou a versão ${cur.version} enquanto você editava. Recarregue antes de publicar.` });
      } catch {}
      return send(res, 200, await save(id, cfg, admin.name));
    }

    if (m === "GET" && parts[2] === "history") {
      let files = [];
      try { files = await fs.readdir(path.join(HISTORY, id)); } catch {}
      const items = await Promise.all(files.map(async (f) => {
        const c = await readJson(path.join(HISTORY, id, f));
        return { version: c.version, updatedAt: c.updatedAt, updatedBy: c.updatedBy };
      }));
      return send(res, 200, items.sort((a, b) => b.version - a.version));
    }

    if (m === "POST" && parts[2] === "rollback" && parts[3]) {
      try {
        const old = await readJson(path.join(HISTORY, id, `v${Number(parts[3])}.json`));
        return send(res, 200, await save(id, old, `${admin.name} (restaurou v${old.version})`));
      } catch { return send(res, 404, { error: "Versão não encontrada" }); }
    }
  }

  return send(res, 404, { error: "Rota não encontrada" });
}

async function serveStatic(res, url) {
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) return send(res, 403, "Proibido");
  try {
    const st = await fs.stat(file);
    if (st.isDirectory()) file = path.join(file, "index.html");
    const data = await fs.readFile(file);
    const ext = path.extname(file);
    return send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable" });
  } catch {
    try { return send(res, 200, await fs.readFile(path.join(DIST, "index.html")), { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" }); }
    catch { return send(res, 404, "Rode `npm run build` para gerar o app."); }
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "OPTIONS") return send(res, 204, "");
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return await serveStatic(res, url);
  } catch (e) {
    console.error(e);
    send(res, e instanceof SyntaxError ? 400 : 500, { error: e instanceof SyntaxError ? "JSON inválido" : "Erro interno" });
  }
}).listen(PORT, () => {
  console.log(`Servidor de configuração em http://localhost:${PORT}`);
  if (!process.env.ADMIN_TOKEN) console.log("Atenção: usando tokens de server/data/admins.json — troque-os antes de publicar.");
});
