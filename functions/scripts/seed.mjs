#!/usr/bin/env node
/**
 * Carga inicial do Firestore e do Auth.
 *
 *   Emuladores:  npm --prefix functions run seed -- --demo
 *   Produção:    GOOGLE_APPLICATION_CREDENTIALS=chave.json npm --prefix functions run seed -- \
 *                  --project meu-projeto --admin-email voce@empresa.com --admin-password 'senha-forte'
 *
 * Opções:
 *   --project <id>          projeto Firebase (padrão: demo-fidelidade)
 *   --force                 sobrescreve redes que já existem (cuidado em produção)
 *   --admin-email/password  cria ou promove o administrador da plataforma
 *   --demo                  só nos emuladores: cria cliente, frentista e gerente de exemplo
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(`--${name}`);
const projectId = opt("project") || process.env.GCLOUD_PROJECT || "demo-fidelidade";
const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;

if (!emulated && projectId.startsWith("demo-")) {
  console.error("Projeto demo-* só existe nos emuladores. Rode com `firebase emulators:exec` ou informe --project.");
  process.exit(1);
}
if (flag("demo") && !emulated) {
  console.error("--demo cria contas com senha conhecida e só é permitido nos emuladores.");
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();

const dir = fileURLToPath(new URL("../../seed/tenants/", import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const cfg = JSON.parse(readFileSync(dir + file, "utf8"));
  const ref = db.collection("tenants").doc(cfg.id);
  if ((await ref.get()).exists && !flag("force")) { console.log(`= ${cfg.id} já existe (use --force para sobrescrever)`); continue; }
  await ref.set({ ...cfg, version: 1, status: cfg.status || "active", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: "seed" });
  for (const d of cfg.domains || []) await db.collection("domains").doc(d).set({ tenantId: cfg.id });
  console.log(`+ rede ${cfg.id}`);
}

async function ensureUser(email, password, displayName, claims) {
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch { user = await auth.createUser({ email, password, displayName, emailVerified: true }); }
  if (claims) await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), ...claims });
  return user;
}

const adminEmail = opt("admin-email");
if (adminEmail) {
  const pwd = opt("admin-password");
  if (!pwd || pwd.length < 10) { console.error("--admin-password precisa de 10+ caracteres"); process.exit(1); }
  await ensureUser(adminEmail, pwd, "Administrador da plataforma", { platformAdmin: true });
  console.log(`+ administrador da plataforma: ${adminEmail}`);
}

if (flag("demo")) {
  const T = "dona-rosa";
  const PASS = "demo12345";
  await ensureUser("admin@demo.com", PASS, "Admin Plataforma", { platformAdmin: true });
  await ensureUser("dono@demo.com", PASS, "Rosa Dona", { roles: { [T]: "owner" } });
  const gerente = await ensureUser("gerente@demo.com", PASS, "Gil Gerente", { roles: { [T]: "manager" } });
  const carlos = await ensureUser("carlos@demo.com", PASS, "Carlos", { roles: { [T]: "attendant" } });
  await ensureUser("cliente@demo.com", PASS, "Elísio Andrade");
  for (const [u, role, code] of [[gerente, "manager", "GIL001"], [carlos, "attendant", "CARL01"]]) {
    await db.doc(`tenants/${T}/staff/${u.uid}`).set({ name: u.displayName, email: u.email, role, station: "Centro", active: true, code });
    await db.doc(`tenants/${T}/staffCodes/${code}`).set({ uid: u.uid });
  }
  // a campanha de exemplo vale o ano todo nos emuladores
  await db.doc(`tenants/${T}`).update({ "campaign.startsAt": "2000-01-01", "campaign.endsAt": "2999-12-31", "offer.endsAtHour": 24 });
  console.log(`+ contas de demonstração (senha ${PASS}): admin@, dono@, gerente@, carlos@ e cliente@demo.com`);
  console.log("  O cliente ainda precisa se cadastrar na rede pelo app (CPF e celular).");
}

process.exit(0);
