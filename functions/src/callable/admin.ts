import {
  db, auth, FieldValue, HttpsError, callable, caller, requireRole, roleIn, isStaffRole, str, num, tenantIdOf,
  loadTenant, tenantRef, customerRef, audit, notify, type StaffRole,
} from "../lib/core.js";
import { readOpenLots, writeEarn, writeSpend, writeWallet } from "../lib/ledger.js";
import { validateConfig, rulesOf, TENANT_ID_RE, type TenantConfig } from "../domain/config.js";
import { shortCode } from "../domain/codes.js";

const SERVER_FIELDS = ["id", "version", "updatedAt", "updatedBy", "status", "createdAt"];
const clean = (cfg: TenantConfig) => Object.fromEntries(Object.entries(cfg).filter(([k]) => !SERVER_FIELDS.includes(k)));
const normDomain = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/** Publica nova configuração (RN-06 a RN-08, RN-10). */
async function publish(tenantId: string, incoming: TenantConfig, expectedVersion: number | null, c: ReturnType<typeof caller>, reason: string) {
  const errs = validateConfig(incoming);
  if (errs.length) throw new HttpsError("invalid-argument", "Configuração inválida", errs);
  const domains = [...new Set(((incoming.domains ?? []) as string[]).map(normDomain).filter(Boolean))];

  return db.runTransaction(async (tx) => {
    const ref = tenantRef(tenantId);
    const cur = await tx.get(ref);
    if (!cur.exists) throw new HttpsError("not-found", "Rede não encontrada.");
    const prev = cur.data()!;
    if (expectedVersion != null && expectedVersion !== prev.version) {
      throw new HttpsError("aborted", `Outra pessoa publicou a versão ${prev.version} enquanto você editava. Recarregue antes de publicar.`);
    }
    const prevDomains: string[] = prev.domains ?? [];
    const domainSnaps = await Promise.all(domains.map((d) => tx.get(db.collection("domains").doc(d))));
    domainSnaps.forEach((s) => { if (s.exists && s.get("tenantId") !== tenantId) throw new HttpsError("already-exists", `O domínio ${s.id} já pertence a outra rede.`); });

    const version = (prev.version ?? 0) + 1;
    tx.set(ref.collection("configHistory").doc(String(prev.version ?? 0)), { ...prev, archivedAt: FieldValue.serverTimestamp() });
    tx.set(ref, {
      ...clean(incoming), domains, id: tenantId, status: prev.status ?? "active", createdAt: prev.createdAt ?? FieldValue.serverTimestamp(),
      version, updatedAt: FieldValue.serverTimestamp(), updatedBy: c.name ?? c.uid,
    });
    for (const d of prevDomains.filter((d) => !domains.includes(d))) tx.delete(db.collection("domains").doc(d));
    for (const d of domains) tx.set(db.collection("domains").doc(d), { tenantId });
    audit(tx, tenantId, c, "config.publish", { version, reason });
    return { version };
  });
}

export const publishConfig = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "manager");
  const cfg = req.data.config as TenantConfig;
  const expected = typeof req.data.expectedVersion === "number" ? req.data.expectedVersion : null;
  return publish(tenantId, cfg, expected, c, str(req.data.reason, "o motivo", { max: 200, optional: true }));
});

export const rollbackConfig = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "manager");
  const v = num(req.data.version, "a versão", { min: 0, integer: true });
  const old = await tenantRef(tenantId).collection("configHistory").doc(String(v)).get();
  if (!old.exists) throw new HttpsError("not-found", "Versão não encontrada.");
  return publish(tenantId, old.data()!, null, c, `Restaurou a versão ${v}`);
});

export const listConfigHistory = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "manager");
  const snap = await tenantRef(tenantId).collection("configHistory").orderBy("version", "desc").limit(50).get();
  return snap.docs.map((d) => ({ version: d.get("version") ?? 0, updatedAt: d.get("updatedAt")?.toDate?.().toISOString() ?? null, updatedBy: d.get("updatedBy") ?? null }));
});

/** Redes que o usuário pode administrar. */
export const myTenants = callable(async (req) => {
  const c = caller(req);
  const ids = c.platformAdmin ? (await db.collection("tenants").select().get()).docs.map((d) => d.id) : Object.keys(c.roles);
  const snaps = await Promise.all(ids.map((id) => tenantRef(id).get()));
  return {
    platformAdmin: c.platformAdmin,
    tenants: snaps.filter((s) => s.exists).map((s) => ({ id: s.id, name: s.get("brand.name"), status: s.get("status"), version: s.get("version"), role: roleIn(c, s.id), colors: s.get("brand.colors") })),
  };
});

/** Só o administrador da plataforma cria redes, copiando a configuração de outra (RN-05). */
export const createTenant = callable(async (req) => {
  const c = caller(req);
  if (!c.platformAdmin) throw new HttpsError("permission-denied", "Só o administrador da plataforma cria redes.");
  const id = str(req.data.id, "o identificador", { max: 41 });
  if (!TENANT_ID_RE.test(id)) throw new HttpsError("invalid-argument", "Identificador: letras minúsculas, números e hífen.");
  const name = str(req.data.name, "o nome", { max: 60 });
  const from = tenantIdOf(req.data.from ?? "dona-rosa");
  const base = await loadTenant(from, undefined, { allowSuspended: true });
  const cfg = { ...clean(base), domains: [], brand: { ...base.brand, name, wordmark: name.toUpperCase() } };
  await db.runTransaction(async (tx) => {
    const ref = tenantRef(id);
    if ((await tx.get(ref)).exists) throw new HttpsError("already-exists", "Já existe uma rede com esse identificador.");
    tx.create(ref, { ...cfg, id, status: "active", version: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: c.name ?? c.uid });
    audit(tx, id, c, "tenant.create", { from });
  });
  return { id };
});

/** RN-09: suspende ou reativa uma rede. */
export const setTenantStatus = callable(async (req) => {
  const c = caller(req);
  if (!c.platformAdmin) throw new HttpsError("permission-denied", "Só o administrador da plataforma suspende redes.");
  const tenantId = tenantIdOf(req.data.tenantId);
  const status = req.data.status === "suspended" ? "suspended" : "active";
  const reason = str(req.data.reason, "o motivo", { max: 200 });
  await db.runTransaction(async (tx) => {
    await loadTenant(tenantId, tx, { allowSuspended: true });
    tx.update(tenantRef(tenantId), { status, updatedAt: FieldValue.serverTimestamp() });
    audit(tx, tenantId, c, "tenant.status", { status, reason });
  });
  return { status };
});

/** RN-02, RN-03: define o papel de alguém na rede, pelo e-mail. role = null remove. */
export const setStaffRole = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const myRole = requireRole(c, tenantId, "manager");
  const email = str(req.data.email, "o e-mail", { max: 120 }).toLowerCase();
  const role = req.data.role == null ? null : req.data.role;
  if (role !== null && !isStaffRole(role)) throw new HttpsError("invalid-argument", "Papel inválido.");
  if ((role === "manager" || role === "owner") && myRole !== "owner") throw new HttpsError("permission-denied", "Só o dono da rede promove gerentes.");
  const station = str(req.data.station, "o posto", { max: 80, optional: true }) || null;

  let user;
  try { user = await auth.getUserByEmail(email); }
  catch { throw new HttpsError("not-found", "Não há conta com esse e-mail. Peça para a pessoa criar a conta no app primeiro."); }
  if (user.uid === c.uid && !c.platformAdmin) throw new HttpsError("failed-precondition", "Você não pode alterar o próprio papel.");

  const roles: Record<string, StaffRole> = { ...((user.customClaims?.roles as Record<string, StaffRole>) ?? {}) };
  const current = roles[tenantId];
  if ((current === "manager" || current === "owner") && myRole !== "owner") throw new HttpsError("permission-denied", "Só o dono da rede altera gerentes.");
  if (role) roles[tenantId] = role; else delete roles[tenantId];
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), roles });

  const staffRef = tenantRef(tenantId).collection("staff").doc(user.uid);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(staffRef);
    let code = s.get("code") as string | undefined;
    if (!code && role) {
      code = shortCode(6);
      tx.create(tenantRef(tenantId).collection("staffCodes").doc(code), { uid: user.uid });
    }
    tx.set(staffRef, { name: user.displayName ?? email, email, role, station, active: !!role, code: code ?? null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    audit(tx, tenantId, c, "staff.role", { target: user.uid, email, role, previous: current ?? null });
  });
  return { uid: user.uid, role };
});

/** RN-27: ajuste manual com motivo; nunca deixa saldo negativo. */
export const adjustPoints = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "manager");
  const uid = str(req.data.customerUid, "o cliente", { max: 128 });
  const points = num(req.data.points, "os pontos", { min: -1_000_000, max: 1_000_000, integer: true });
  if (points === 0) throw new HttpsError("invalid-argument", "Informe uma quantidade diferente de zero.");
  const reason = str(req.data.reason, "o motivo", { max: 200 });
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx, { allowSuspended: true });
    const ref = customerRef(tenantId, uid);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Cliente não encontrado.");
    const data = snap.data()!;
    const lots = points < 0 ? await readOpenLots(tx, ref) : [];
    if (points > 0) writeEarn(tx, ref, data, cfg, { points, type: "adjust", description: `Ajuste · ${reason}`, expirationMonths: rulesOf(cfg).points.expirationMonths });
    else writeSpend(tx, ref, data, lots, { points: -points, type: "adjust", description: `Ajuste · ${reason}` });
    audit(tx, tenantId, c, "points.adjust", { customerUid: uid, points, reason });
    return { points: data.points };
  });
});

/** RN-32: cancelar voucher ativo devolve os pontos como lote novo. */
export const cancelVoucher = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "manager");
  const code = str(req.data.code, "o código", { max: 12 }).toUpperCase();
  const reason = str(req.data.reason, "o motivo", { max: 200 });
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx, { allowSuspended: true });
    const vRef = tenantRef(tenantId).collection("vouchers").doc(code);
    const v = await tx.get(vRef);
    if (!v.exists) throw new HttpsError("not-found", "Voucher não encontrado.");
    if (v.get("status") !== "active") throw new HttpsError("failed-precondition", "Só vouchers ativos podem ser cancelados.");
    const custRef = customerRef(tenantId, v.get("customerUid"));
    const cust = (await tx.get(custRef)).data()!;
    tx.update(vRef, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), cancelledBy: c.uid, cancelReason: reason });
    writeEarn(tx, custRef, cust, cfg, { points: v.get("cost"), type: "refund", description: `Estorno · ${v.get("rewardName")}`, ref: { voucher: code }, expirationMonths: rulesOf(cfg).points.expirationMonths });
    notify(tx, custRef, { title: "Voucher cancelado", body: `${v.get("rewardName")}: ${v.get("cost")} pontos devolvidos.`, kind: "voucher" });
    audit(tx, tenantId, c, "voucher.cancel", { code, reason });
    return { refunded: v.get("cost") };
  });
});

/** Confirmação manual de Pix recebido na chave estática (quando não há webhook do banco). */
export const confirmPixCharge = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "manager");
  const txid = str(req.data.txid, "o txid", { max: 35 });
  const endToEndId = str(req.data.endToEndId, "o identificador do Pix (E2E)", { max: 40 });
  return settlePix(tenantId, txid, null, endToEndId, { by: c.uid, manual: true }, c);
});

/** Liquida uma cobrança Pix: credita a carteira uma única vez (RN-35). Usado pelo webhook e pela confirmação manual. */
export async function settlePix(tenantId: string, txid: string, paidCents: number | null, endToEndId: string, meta: Record<string, unknown>, c?: ReturnType<typeof caller>) {
  return db.runTransaction(async (tx) => {
    const chargeRef = tenantRef(tenantId).collection("pixCharges").doc(txid);
    const eventRef = tenantRef(tenantId).collection("pixEvents").doc(endToEndId);
    const [charge, event] = await Promise.all([tx.get(chargeRef), tx.get(eventRef)]);
    if (event.exists) return { credited: false, reason: "duplicado" };
    if (!charge.exists) throw new HttpsError("not-found", "Cobrança Pix não encontrada.");
    if (charge.get("status") === "paid") return { credited: false, reason: "já paga" };
    const amount = charge.get("amountCents") as number;
    if (paidCents != null && paidCents !== amount) {
      tx.create(eventRef, { txid, paidCents, status: "amount_mismatch", ...meta, at: FieldValue.serverTimestamp() });
      return { credited: false, reason: "valor divergente" };
    }
    const custRef = customerRef(tenantId, charge.get("uid"));
    const cust = (await tx.get(custRef)).data()!;
    writeWallet(tx, custRef, cust, { amountCents: amount, type: "credit_pix", description: "Recarga via Pix", ref: { txid, endToEndId } });
    tx.update(chargeRef, { status: "paid", paidAt: FieldValue.serverTimestamp(), endToEndId });
    tx.create(eventRef, { txid, paidCents: amount, status: "credited", ...meta, at: FieldValue.serverTimestamp() });
    notify(tx, custRef, { title: "Recarga confirmada", body: `Recebemos seu Pix. O saldo já está na carteira.`, kind: "carteira" });
    if (c) audit(tx, tenantId, c, "pix.confirm", { txid, endToEndId });
    return { credited: true, amountCents: amount };
  });
}
