import {
  db, FieldValue, Timestamp, HttpsError, callable, caller, requireRole, str, num, tenantIdOf, loadTenant,
  tenantRef, customerRef, notify, QR_SIGNING_KEY, CPF_PEPPER,
} from "../lib/core.js";
import { cpfHash, verifyCheckin } from "../lib/security.js";
import { writeEarn } from "../lib/ledger.js";
import { isValidCpf, normalizeCpf } from "../domain/cpf.js";
import { rulesOf, fuelPriceCents, stationIdOf } from "../domain/config.js";
import { computeSale } from "../domain/sale.js";
import { activeCampaign, bonusCents, countableItems } from "../domain/campaign.js";
import { toCents } from "../domain/money.js";
import { dayKey } from "../domain/time.js";
import { isShortCode } from "../domain/codes.js";

/** Resolve o cliente por QR temporário ou CPF (RN-49). */
async function resolveCustomer(tenantId: string, data: Record<string, unknown>): Promise<string> {
  if (data.token) {
    const p = verifyCheckin(QR_SIGNING_KEY.value(), String(data.token));
    if (!p || p.t !== tenantId) throw new HttpsError("invalid-argument", "QR Code inválido ou expirado. Peça ao cliente para abrir o QR de novo.");
    return p.u;
  }
  if (data.cpf) {
    const cpf = normalizeCpf(String(data.cpf));
    if (!isValidCpf(cpf)) throw new HttpsError("invalid-argument", "CPF inválido.");
    const idx = await tenantRef(tenantId).collection("cpfIndex").doc(cpfHash(CPF_PEPPER.value(), tenantId, cpf)).get();
    if (!idx.exists) throw new HttpsError("not-found", "Cliente não cadastrado nesta rede.");
    return idx.get("uid");
  }
  throw new HttpsError("invalid-argument", "Leia o QR Code do cliente ou informe o CPF.");
}

/** RN-65: o frentista recebe só o necessário para atender. */
export const lookupCustomer = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "attendant");
  const uid = await resolveCustomer(tenantId, req.data);
  const custRef = customerRef(tenantId, uid);
  const [cust, offer, locks] = await Promise.all([
    custRef.get(),
    custRef.collection("offers").doc(dayKey()).get(),
    custRef.collection("fuelLocks").where("status", "==", "active").get(),
  ]);
  if (!cust.exists) throw new HttpsError("not-found", "Cliente não cadastrado nesta rede.");
  const lockedByFuel: Record<string, number> = {};
  locks.docs.forEach((d) => { lockedByFuel[d.get("fuel")] = (lockedByFuel[d.get("fuel")] ?? 0) + d.get("litersRemaining"); });
  const offerActive = offer.exists && (offer.get("expiresAt") as Timestamp).toMillis() > Date.now();
  return {
    customerRef: req.data.token ? String(req.data.token) : null,
    name: cust.get("name"), cpfMasked: cust.get("cpfMasked"), level: cust.get("level"), points: cust.get("points"),
    offerActive, offerLitersLeft: offerActive ? Math.max(0, offer.get("maxLiters") - offer.get("litersUsed")) : 0,
    lockedByFuel,
  };
}, { secrets: [QR_SIGNING_KEY, CPF_PEPPER] });

/**
 * RN-48 a RN-56: registra a venda, aplica oferta e trava, credita pontos e atualiza a campanha,
 * tudo numa transação idempotente (RN-20).
 */
export const registerSale = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "attendant");
  const requestId = str(req.data.requestId, "o identificador da venda", { max: 64 });
  const fuel = str(req.data.fuel, "o combustível", { max: 40, optional: true });
  const liters = fuel ? num(req.data.liters, "os litros", { min: 0.001, max: 2000 }) : 0;
  const grossCents = toCents(num(req.data.amount, "o valor", { min: 0, max: 100_000 }));
  const method = str(req.data.method, "a forma de pagamento", { max: 20, optional: true }) || "outro";
  const items = Array.isArray(req.data.items) ? (req.data.items as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  const useLocks = req.data.useLocks === true;
  const hasCustomer = !!(req.data.token || req.data.cpf);
  const customerUid = hasCustomer ? await resolveCustomer(tenantId, req.data) : null;
  const saleRef = tenantRef(tenantId).collection("sales").doc(`pos_${c.uid}_${requestId}`.slice(0, 120));

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(saleRef);
    if (existing.exists) return existing.get("result");
    const cfg = await loadTenant(tenantId, tx);
    const station = str(req.data.station, "o posto", { max: 80 });
    if (!(cfg.stations ?? []).includes(station)) throw new HttpsError("invalid-argument", "Posto não encontrado nesta rede.");
    const rules = rulesOf(cfg);
    const price = fuel ? fuelPriceCents(cfg, fuel) : 0;
    if (fuel && price == null) throw new HttpsError("invalid-argument", "Combustível não disponível.");
    const staffRef = tenantRef(tenantId).collection("staff").doc(c.uid);
    const camp = activeCampaign(cfg, dayKey());
    const campRef = camp ? tenantRef(tenantId).collection("campaigns").doc(camp.id).collection("staff").doc(c.uid) : null;

    // leituras
    const [staff, campSnap] = await Promise.all([tx.get(staffRef), campRef ? tx.get(campRef) : Promise.resolve(null)]);
    let custRef = null, cust = null, offerRef = null, offer = null, locks: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (customerUid) {
      custRef = customerRef(tenantId, customerUid);
      offerRef = custRef.collection("offers").doc(dayKey());
      const [cs, os, ls] = await Promise.all([tx.get(custRef), tx.get(offerRef), useLocks && fuel ? tx.get(custRef.collection("fuelLocks").where("status", "==", "active")) : Promise.resolve(null)]);
      if (!cs.exists) throw new HttpsError("not-found", "Cliente não cadastrado nesta rede.");
      cust = cs.data()!; offer = os; locks = ls?.docs ?? [];
    }

    const offerValid = !!(offer?.exists && (offer.get("expiresAt") as Timestamp).toMillis() > Date.now() && fuel);
    const b = computeSale({
      fuel, liters, grossCents, pricePerLiterCents: price ?? 0, paidInApp: false,
      offer: offerValid ? { discountPerLiterCents: offer!.get("discountPerLiterCents"), litersLeftToday: offer!.get("maxLiters") - offer!.get("litersUsed") } : null,
      locks: locks.map((d) => ({ id: d.id, fuel: d.get("fuel"), litersRemaining: d.get("litersRemaining"), expiresAtMs: (d.get("expiresAt") as Timestamp).toMillis() })),
      useLocks, rules: rules.points,
    });
    if (!customerUid) b.points = 0;

    // escritas
    if (custRef && cust) {
      if (b.offerLiters > 0) tx.update(offerRef!, { litersUsed: FieldValue.increment(b.offerLiters) });
      for (const l of b.lockConsumption) tx.update(custRef.collection("fuelLocks").doc(l.id), { litersRemaining: l.remainingAfter, status: l.remainingAfter > 0 ? "active" : "used" });
      if (b.lockLiters > 0) tx.update(custRef, { lockedLiters: Math.max(0, (cust.lockedLiters ?? 0) - b.lockLiters) });
      writeEarn(tx, custRef, cust, cfg, { points: b.points, type: "earn", description: fuel ? `Abastecimento · Posto ${station}` : `Compra · Posto ${station}`, ref: { sale: saleRef.id }, expirationMonths: rules.points.expirationMonths });
    }

    let campaign = null;
    if (camp && campRef) {
      const counters: Record<string, number> = { ...(campSnap?.get("counters") ?? {}) };
      for (const k of countableItems(items, camp.items)) counters[k] = (counters[k] ?? 0) + 1;
      const sales = (campSnap?.get("sales") ?? 0) + 1;
      const identified = (campSnap?.get("identifiedSales") ?? 0) + (customerUid ? 1 : 0);
      const bonus = bonusCents(counters, camp.items);
      tx.set(campRef, { name: staff.get("name") ?? c.name ?? "Frentista", station, counters, sales, identifiedSales: identified, bonusCents: bonus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      campaign = { bonusCents: bonus, identification: Math.round((identified / sales) * 100) };
    }

    const result = { saleId: saleRef.id, ...b, campaign, customer: cust ? { name: cust.name, points: cust.points, level: cust.level } : null };
    tx.create(saleRef, {
      channel: "pos", attendantUid: c.uid, station, stationId: stationIdOf(station), customerUid, fuel: fuel || null, liters,
      grossCents, method, items, ...b, result, day: dayKey(), createdAt: FieldValue.serverTimestamp(),
    });
    return result;
  });
}, { secrets: [QR_SIGNING_KEY, CPF_PEPPER] });

/** RN-31: valida e consome o voucher; registra quem, onde e quando. */
export const validateVoucher = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  requireRole(c, tenantId, "attendant");
  const code = str(req.data.code, "o código", { max: 12 }).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!isShortCode(code)) throw new HttpsError("invalid-argument", "Código de voucher inválido.");
  const station = str(req.data.station, "o posto", { max: 80 });
  const confirm = req.data.confirm === true;
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    if (!(cfg.stations ?? []).includes(station)) throw new HttpsError("invalid-argument", "Posto não encontrado nesta rede.");
    const ref = tenantRef(tenantId).collection("vouchers").doc(code);
    const v = await tx.get(ref);
    if (!v.exists) throw new HttpsError("not-found", "Voucher não encontrado.");
    const info = { code, rewardName: v.get("rewardName"), customerName: v.get("customerName"), status: v.get("status"), expiresAt: (v.get("expiresAt") as Timestamp).toDate().toISOString() };
    if (v.get("status") === "used") throw new HttpsError("failed-precondition", "Este voucher já foi utilizado.");
    if (v.get("status") === "cancelled") throw new HttpsError("failed-precondition", "Este voucher foi cancelado.");
    if ((v.get("expiresAt") as Timestamp).toMillis() < Date.now()) throw new HttpsError("failed-precondition", "Voucher vencido.");
    if (!confirm) return { ...info, valid: true, used: false };
    tx.update(ref, { status: "used", usedAt: FieldValue.serverTimestamp(), usedBy: c.uid, usedByName: c.name ?? null, usedStation: station });
    notify(tx, customerRef(tenantId, v.get("customerUid")), { title: "Voucher utilizado", body: `${v.get("rewardName")} usado no Posto ${station}.`, kind: "voucher" });
    return { ...info, status: "used", valid: true, used: true };
  });
});
