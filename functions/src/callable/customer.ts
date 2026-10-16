import {
  db, FieldValue, Timestamp, HttpsError, callable, caller, str, num, tenantIdOf, loadTenant, requireFeature,
  tenantRef, customerRef, notify, QR_SIGNING_KEY, CPF_PEPPER,
} from "../lib/core.js";
import { cpfHash, signCheckin } from "../lib/security.js";
import { readOpenLots, writeEarn, writeSpend, writeWallet } from "../lib/ledger.js";
import { isValidCpf, maskCpf, normalizeCpf } from "../domain/cpf.js";
import { rulesOf, fuelPriceCents, stationIdOf } from "../domain/config.js";
import { pointsFor } from "../domain/points.js";
import { brl, toCents } from "../domain/money.js";
import { shortCode } from "../domain/codes.js";
import { addDays, atHourInTz, dayKey, hourInTz, monthKey, weekdayInTz } from "../domain/time.js";
import { activeCampaign } from "../domain/campaign.js";
import { cardGateway, pixProvider } from "../providers/payments.js";

const DEFAULT_MAINTENANCE = [
  { id: "oleo", name: "Troca de óleo", everyKm: 10000, bonus: true },
  { id: "alinhamento", name: "Alinhamento e balanceamento", everyKm: 10000, bonus: true },
  { id: "filtro", name: "Filtro de ar", everyKm: 15000, bonus: false },
];

async function requireMember(tenantId: string, uid: string) {
  const snap = await customerRef(tenantId, uid).get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Conclua seu cadastro nesta rede.");
  return snap;
}

const stationOf = (cfg: Record<string, unknown>, v: unknown) => {
  const name = str(v, "o posto", { max: 80 });
  if (!(cfg.stations as string[] | undefined)?.includes(name)) throw new HttpsError("invalid-argument", "Posto não encontrado nesta rede.");
  return name;
};

/** RN-11 a RN-14: entra na rede com CPF único, ganha o bônus e credita o frentista que indicou. */
export const joinTenant = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const name = str(req.data.name, "seu nome", { max: 80 });
  const phone = str(req.data.phone, "seu celular", { max: 20 });
  const cpf = normalizeCpf(str(req.data.cpf, "seu CPF", { max: 20 }));
  if (!isValidCpf(cpf)) throw new HttpsError("invalid-argument", "CPF inválido. Confira os números.");
  const referral = str(req.data.referralCode, "o código de indicação", { max: 12, optional: true }).toUpperCase();
  const hash = cpfHash(CPF_PEPPER.value(), tenantId, cpf);

  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    const custRef = customerRef(tenantId, c.uid);
    const indexRef = tenantRef(tenantId).collection("cpfIndex").doc(hash);
    const [cust, idx] = await Promise.all([tx.get(custRef), tx.get(indexRef)]);
    if (cust.exists) return { joined: false, message: "Você já participa desta rede." };
    if (idx.exists) throw new HttpsError("already-exists", "Este CPF já está cadastrado nesta rede. Entre com a conta original ou procure o atendimento.");

    let staff: FirebaseFirestore.DocumentSnapshot | null = null;
    let campStaff: FirebaseFirestore.DocumentSnapshot | null = null;
    const camp = activeCampaign(cfg, dayKey());
    if (referral) {
      const codeSnap = await tx.get(tenantRef(tenantId).collection("staffCodes").doc(referral));
      if (codeSnap.exists) {
        staff = await tx.get(tenantRef(tenantId).collection("staff").doc(codeSnap.get("uid")));
        if (camp && staff.exists && staff.get("active") !== false) {
          campStaff = await tx.get(tenantRef(tenantId).collection("campaigns").doc(camp.id).collection("staff").doc(staff.id));
        }
      }
    }

    const rules = rulesOf(cfg);
    const now = new Date();
    tx.create(indexRef, { uid: c.uid, createdAt: FieldValue.serverTimestamp() });
    const data = {
      name, phone, email: c.email ?? null, cpfMasked: maskCpf(cpf), cpfHash: hash,
      points: 0, lifetimePoints: 0, level: cfg.levels?.[0]?.name ?? "", prepaidCents: 0, lockedLiters: 0,
      car: null, status: "active", referredBy: staff?.exists ? staff.id : null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    tx.create(custRef, data);
    for (const m of DEFAULT_MAINTENANCE) tx.create(custRef.collection("maintenance").doc(m.id), { ...m, scheduled: null, lastKm: null });

    writeEarn(tx, custRef, data, cfg, { points: rules.points.welcomeBonus, type: "bonus", description: "Bônus de boas-vindas", expirationMonths: rules.points.expirationMonths, now });
    notify(tx, custRef, { title: `Bem-vindo à ${cfg.brand?.name ?? "rede"}`, body: `Você ganhou ${rules.points.welcomeBonus} pontos de boas-vindas.`, kind: "bonus" });

    // RN-14
    if (camp && staff?.exists && staff.get("active") !== false && camp.items.some((i) => i.key === "cadastros")) {
      const ref = tenantRef(tenantId).collection("campaigns").doc(camp.id).collection("staff").doc(staff.id);
      const counters = { ...(campStaff?.get("counters") ?? {}) };
      counters.cadastros = (counters.cadastros ?? 0) + 1;
      tx.set(ref, { name: staff.get("name"), station: staff.get("station") ?? null, counters, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { joined: true };
  });
}, { secrets: [CPF_PEPPER] });

/** RN-15: altera nome, celular e veículo. CPF não muda pelo app. */
export const updateProfile = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  await requireMember(tenantId, c.uid);
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (req.data.name != null) patch.name = str(req.data.name, "seu nome", { max: 80 });
  if (req.data.phone != null) patch.phone = str(req.data.phone, "seu celular", { max: 20 });
  if (req.data.car != null) {
    const car = req.data.car as Record<string, unknown>;
    patch.car = {
      model: str(car.model, "o modelo", { max: 60 }),
      plate: str(car.plate, "a placa", { max: 8 }).toUpperCase(),
      km: num(car.km, "a quilometragem", { min: 0, max: 2_000_000, integer: true }),
    };
  }
  await customerRef(tenantId, c.uid).update(patch);
  return { ok: true };
});

/** RN-49: QR de 5 minutos para identificação no caixa. */
export const issueCheckinToken = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  await requireMember(tenantId, c.uid);
  const { token, expiresAt } = signCheckin(QR_SIGNING_KEY.value(), tenantId, c.uid);
  return { token, expiresAt: expiresAt.toISOString() };
}, { secrets: [QR_SIGNING_KEY] });

/** RN-45, RN-46: uma ativação por dia, válida até o horário de término. */
export const activateOffer = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    const rules = rulesOf(cfg);
    if (!rules.offer.active) throw new HttpsError("failed-precondition", "Não há oferta ativa hoje.");
    const now = new Date();
    if (hourInTz(now) >= rules.offer.endsAtHour) throw new HttpsError("failed-precondition", "A oferta de hoje já encerrou.");
    const custRef = customerRef(tenantId, c.uid);
    const ref = custRef.collection("offers").doc(dayKey(now));
    const [cust, existing] = await Promise.all([tx.get(custRef), tx.get(ref)]);
    if (!cust.exists) throw new HttpsError("failed-precondition", "Conclua seu cadastro nesta rede.");
    const expiresAt = atHourInTz(now, rules.offer.endsAtHour);
    if (existing.exists) return { activated: false, expiresAt: expiresAt.toISOString() };
    tx.create(ref, {
      discountPerLiterCents: rules.offer.discountPerLiterCents, maxLiters: rules.offer.maxLitersPerDay, litersUsed: 0,
      activatedAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt),
    });
    return { activated: true, expiresAt: expiresAt.toISOString() };
  });
});

/** RN-28 a RN-30: resgate com estoque, limite mensal e voucher de uso único. */
export const redeemReward = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const rewardId = str(req.data.rewardId, "o prêmio", { max: 60 });

  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    const reward = (cfg.rewards ?? []).find((r: Record<string, unknown>) => r.id === rewardId);
    if (!reward || reward.active === false) throw new HttpsError("not-found", "Prêmio indisponível.");
    const custRef = customerRef(tenantId, c.uid);
    const stockRef = tenantRef(tenantId).collection("rewardStock").doc(rewardId);
    const usageRef = custRef.collection("rewardUsage").doc(`${rewardId}_${monthKey()}`);
    const [cust, stock, usage] = await Promise.all([tx.get(custRef), tx.get(stockRef), tx.get(usageRef)]);
    if (!cust.exists) throw new HttpsError("failed-precondition", "Conclua seu cadastro nesta rede.");
    const custData = cust.data()!;
    if ((custData.points ?? 0) < reward.cost) throw new HttpsError("failed-precondition", `Faltam ${reward.cost - (custData.points ?? 0)} pontos para este prêmio.`);
    const used = stock.get("used") ?? 0;
    if (reward.stock != null && used >= reward.stock) throw new HttpsError("resource-exhausted", "Prêmio esgotado.");
    const monthCount = usage.get("count") ?? 0;
    if (reward.limitPerMonth != null && monthCount >= reward.limitPerMonth) throw new HttpsError("resource-exhausted", `Limite de ${reward.limitPerMonth} resgate(s) por mês para este prêmio.`);
    const lots = await readOpenLots(tx, custRef);

    // código único: tenta alguns e confere existência na própria transação
    let code = "";
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = shortCode();
      if (!(await tx.get(tenantRef(tenantId).collection("vouchers").doc(candidate))).exists) code = candidate;
    }
    if (!code) throw new HttpsError("aborted", "Tente novamente.");

    const rules = rulesOf(cfg);
    const expiresAt = addDays(new Date(), rules.vouchers.validityDays);
    writeSpend(tx, custRef, custData, lots, { points: reward.cost, type: "redeem", description: `Resgate · ${reward.name}`, ref: { voucher: code } });
    tx.set(stockRef, { used: used + 1 }, { merge: true });
    tx.set(usageRef, { count: monthCount + 1 }, { merge: true });
    tx.create(tenantRef(tenantId).collection("vouchers").doc(code), {
      code, rewardId, rewardName: reward.name, cost: reward.cost, customerUid: c.uid, customerName: custData.name,
      status: "active", createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt),
    });
    notify(tx, custRef, { title: "Resgate confirmado", body: `${reward.name} · código ${code}. Válido até ${expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`, kind: "voucher" });
    return { code, expiresAt: expiresAt.toISOString(), points: custData.points };
  });
});

function amountCents(v: unknown, field: string) {
  return toCents(num(v, field, { min: 0.01, max: 100_000 }));
}

/** RN-34 a RN-36: cobrança Pix com prazo; o crédito só entra pela confirmação. */
export const createPixCharge = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const cents = amountCents(req.data.amount, "o valor");
  const cfg = await loadTenant(tenantId);
  requireFeature(cfg, "wallet"); requireFeature(cfg, "pix");
  const rules = rulesOf(cfg);
  if (cents < rules.wallet.minCreditCents || cents > rules.wallet.maxCreditCents) {
    throw new HttpsError("invalid-argument", `A recarga deve ficar entre ${brl(rules.wallet.minCreditCents)} e ${brl(rules.wallet.maxCreditCents)}.`);
  }
  const cust = await requireMember(tenantId, c.uid);
  if ((cust.get("prepaidCents") ?? 0) + cents > rules.wallet.maxBalanceCents) {
    throw new HttpsError("failed-precondition", `O saldo máximo da carteira é ${brl(rules.wallet.maxBalanceCents)}.`);
  }
  const txid = `${tenantId.replace(/-/g, "").slice(0, 6)}${shortCode(12)}${Date.now().toString(36)}`.slice(0, 25).replace(/[^A-Za-z0-9]/g, "");
  const charge = await pixProvider(cfg).createCharge({ cfg, txid, amountCents: cents, expiresInMin: rules.wallet.pixExpirationMinutes });
  await tenantRef(tenantId).collection("pixCharges").doc(charge.txid).create({
    txid: charge.txid, uid: c.uid, amountCents: cents, status: "pending", brCode: charge.brCode,
    createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(charge.expiresAt),
  });
  return { txid: charge.txid, brCode: charge.brCode, pixKey: cfg.pix?.key, expiresAt: charge.expiresAt.toISOString(), amountCents: cents };
});

/** RN-38: guarda só token, bandeira e últimos dígitos. */
export const addCard = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const token = str(req.data.token, "o token do cartão", { max: 200 });
  const last4 = str(req.data.last4, "os últimos dígitos", { max: 4 });
  if (!/^\d{4}$/.test(last4)) throw new HttpsError("invalid-argument", "Últimos dígitos inválidos.");
  const brand = str(req.data.brand, "a bandeira", { max: 20 });
  const kind = req.data.kind === "Débito" ? "Débito" : "Crédito";
  const cfg = await loadTenant(tenantId);
  requireFeature(cfg, "wallet");
  await requireMember(tenantId, c.uid);
  const custRef = customerRef(tenantId, c.uid);
  const existing = await custRef.collection("cards").limit(10).get();
  if (existing.size >= 5) throw new HttpsError("resource-exhausted", "Limite de 5 cartões cadastrados.");
  const cardRef = custRef.collection("cards").doc();
  const batch = db.batch();
  batch.create(cardRef, { brand, last4, kind, isDefault: existing.empty, createdAt: FieldValue.serverTimestamp() });
  batch.create(tenantRef(tenantId).collection("cardTokens").doc(cardRef.id), { uid: c.uid, token, gateway: cardGateway(cfg).name, createdAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { cardId: cardRef.id };
});

export const removeCard = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const cardId = str(req.data.cardId, "o cartão", { max: 40 });
  const custRef = customerRef(tenantId, c.uid);
  const card = await custRef.collection("cards").doc(cardId).get();
  if (!card.exists) throw new HttpsError("not-found", "Cartão não encontrado.");
  const batch = db.batch();
  batch.delete(card.ref);
  batch.delete(tenantRef(tenantId).collection("cardTokens").doc(cardId));
  if (card.get("isDefault")) {
    const other = (await custRef.collection("cards").limit(6).get()).docs.find((d) => d.id !== cardId);
    if (other) batch.update(other.ref, { isDefault: true });
  }
  await batch.commit();
  return { ok: true };
});

export const setDefaultCard = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const cardId = str(req.data.cardId, "o cartão", { max: 40 });
  const cards = await customerRef(tenantId, c.uid).collection("cards").get();
  if (!cards.docs.some((d) => d.id === cardId)) throw new HttpsError("not-found", "Cartão não encontrado.");
  const batch = db.batch();
  cards.docs.forEach((d) => batch.update(d.ref, { isDefault: d.id === cardId }));
  await batch.commit();
  return { ok: true };
});

async function chargeCard(tenantId: string, uid: string, cfg: Record<string, unknown>, cardId: string, cents: number, description: string, key: string) {
  const tokenSnap = await tenantRef(tenantId).collection("cardTokens").doc(cardId).get();
  if (!tokenSnap.exists || tokenSnap.get("uid") !== uid) throw new HttpsError("not-found", "Cartão não encontrado.");
  const r = await cardGateway(cfg).charge({ token: tokenSnap.get("token"), amountCents: cents, description, idempotencyKey: key });
  if (!r.approved) throw new HttpsError("failed-precondition", r.reason ?? "Pagamento recusado.");
  return r.authorization!;
}

/** Recarga com cartão cadastrado (RN-34). */
export const creditWithCard = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const cents = amountCents(req.data.amount, "o valor");
  const cardId = str(req.data.cardId, "o cartão", { max: 40 });
  const requestId = str(req.data.requestId, "o identificador da operação", { max: 64 });
  const cfg = await loadTenant(tenantId);
  requireFeature(cfg, "wallet");
  const rules = rulesOf(cfg);
  if (cents < rules.wallet.minCreditCents || cents > rules.wallet.maxCreditCents) {
    throw new HttpsError("invalid-argument", `A recarga deve ficar entre ${brl(rules.wallet.minCreditCents)} e ${brl(rules.wallet.maxCreditCents)}.`);
  }
  const opRef = tenantRef(tenantId).collection("operations").doc(`${c.uid}_${requestId}`);
  const done = await opRef.get();
  if (done.exists) return done.get("result");
  const cust = await requireMember(tenantId, c.uid);
  if ((cust.get("prepaidCents") ?? 0) + cents > rules.wallet.maxBalanceCents) throw new HttpsError("failed-precondition", `O saldo máximo da carteira é ${brl(rules.wallet.maxBalanceCents)}.`);

  const authorization = await chargeCard(tenantId, c.uid, cfg, cardId, cents, "Recarga da carteira", opRef.id);
  return db.runTransaction(async (tx) => {
    const again = await tx.get(opRef);
    if (again.exists) return again.get("result");
    const custRef = customerRef(tenantId, c.uid);
    const data = (await tx.get(custRef)).data()!;
    const balance = writeWallet(tx, custRef, data, { amountCents: cents, type: "credit_card", description: "Recarga com cartão", ref: { authorization } });
    const result = { balanceCents: balance, authorization };
    tx.create(opRef, { type: "credit_card", result, createdAt: FieldValue.serverTimestamp() });
    return result;
  });
});

/** Pagamento pelo app no posto: carteira ou cartão, com multiplicador (RN-17, RN-37). */
export const payWithApp = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const cents = amountCents(req.data.amount, "o valor");
  const method = req.data.method === "card" ? "card" : "wallet";
  const requestId = str(req.data.requestId, "o identificador da operação", { max: 64 });
  const cfg = await loadTenant(tenantId);
  requireFeature(cfg, "wallet");
  const station = req.data.station ? stationOf(cfg, req.data.station) : (cfg.stations?.[0] ?? null);
  const saleRef = tenantRef(tenantId).collection("sales").doc(`app_${c.uid}_${requestId}`.slice(0, 120));
  const existing = await saleRef.get();
  if (existing.exists) return existing.get("result"); // RN-20
  await requireMember(tenantId, c.uid);

  let authorization: string | null = null;
  if (method === "card") authorization = await chargeCard(tenantId, c.uid, cfg, str(req.data.cardId, "o cartão", { max: 40 }), cents, "Pagamento no posto", saleRef.id);

  return db.runTransaction(async (tx) => {
    const again = await tx.get(saleRef);
    if (again.exists) return again.get("result");
    const custRef = customerRef(tenantId, c.uid);
    const data = (await tx.get(custRef)).data()!;
    const rules = rulesOf(cfg);
    if (method === "wallet") {
      if ((data.prepaidCents ?? 0) < cents) throw new HttpsError("failed-precondition", "Saldo da carteira insuficiente.");
      writeWallet(tx, custRef, data, { amountCents: -cents, type: "debit_payment", description: `Pagamento · Posto ${station ?? ""}`.trim(), ref: { sale: saleRef.id } });
    }
    const points = pointsFor(cents, rules.points, true);
    writeEarn(tx, custRef, data, cfg, { points, type: "earn", description: `Pagamento pelo app · pontos ${rules.points.appMultiplier}×`, ref: { sale: saleRef.id }, expirationMonths: rules.points.expirationMonths });
    const result = { saleId: saleRef.id, amountCents: cents, points, authorization, method, station };
    tx.create(saleRef, {
      channel: "app", customerUid: c.uid, station, stationId: station ? stationIdOf(station) : null, method,
      grossCents: cents, paidCents: cents, points, authorization, result, createdAt: FieldValue.serverTimestamp(), day: dayKey(),
    });
    return result;
  });
});

/** RN-40 a RN-44: compra de litros ao preço vigente, paga com a carteira. */
export const lockFuelPrice = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const fuel = str(req.data.fuel, "o combustível", { max: 40 });
  const liters = num(req.data.liters, "a quantidade de litros", { min: 0.001, max: 10_000 });
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    requireFeature(cfg, "priceLock"); requireFeature(cfg, "wallet");
    const rules = rulesOf(cfg);
    const price = fuelPriceCents(cfg, fuel);
    if (price == null) throw new HttpsError("invalid-argument", "Combustível não disponível.");
    if (!Number.isInteger(liters) || liters < rules.priceLock.minLiters || liters > rules.priceLock.maxLiters) {
      throw new HttpsError("invalid-argument", `Escolha de ${rules.priceLock.minLiters} a ${rules.priceLock.maxLiters} litros inteiros.`);
    }
    const custRef = customerRef(tenantId, c.uid);
    const cust = await tx.get(custRef);
    if (!cust.exists) throw new HttpsError("failed-precondition", "Conclua seu cadastro nesta rede.");
    const data = cust.data()!;
    if ((data.lockedLiters ?? 0) + liters > rules.priceLock.maxActiveLiters) {
      throw new HttpsError("failed-precondition", `Você pode ter no máximo ${rules.priceLock.maxActiveLiters} litros travados.`);
    }
    const total = Math.round(liters * price);
    if ((data.prepaidCents ?? 0) < total) throw new HttpsError("failed-precondition", `Saldo insuficiente: a trava custa ${brl(total)}. Adicione crédito à carteira.`);
    const lockRef = custRef.collection("fuelLocks").doc();
    const expiresAt = addDays(new Date(), rules.priceLock.validityDays);
    writeWallet(tx, custRef, data, { amountCents: -total, type: "debit_lock", description: `Trava · ${liters} L de ${fuel}`, ref: { lock: lockRef.id } });
    tx.create(lockRef, {
      fuel, litersTotal: liters, litersRemaining: liters, pricePerLiterCents: price, paidCents: total,
      status: "active", createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt),
    });
    tx.update(custRef, { lockedLiters: (data.lockedLiters ?? 0) + liters });
    const points = pointsFor(total, rules.points, true); // RN-44
    writeEarn(tx, custRef, data, cfg, { points, type: "earn", description: `Trava de preço · ${liters} L`, ref: { lock: lockRef.id }, expirationMonths: rules.points.expirationMonths });
    return { lockId: lockRef.id, totalCents: total, pricePerLiterCents: price, points, expiresAt: expiresAt.toISOString() };
  });
});

/** RN-59: agenda em dia útil a partir de amanhã, respeitando a capacidade do horário. */
export const scheduleMaintenance = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const itemId = str(req.data.itemId, "o serviço", { max: 40 });
  const date = str(req.data.date, "o dia", { max: 10 });
  const hour = str(req.data.hour, "o horário", { max: 5 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpsError("invalid-argument", "Dia inválido.");
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    requireFeature(cfg, "maintenance");
    const rules = rulesOf(cfg);
    const station = stationOf(cfg, req.data.station);
    if (rules.maintenance.hours.length && !rules.maintenance.hours.includes(hour)) throw new HttpsError("invalid-argument", "Horário indisponível.");
    const when = new Date(`${date}T12:00:00-03:00`);
    if (date <= dayKey() || weekdayInTz(when) === 0 || when.getTime() > Date.now() + 60 * 86_400_000) {
      throw new HttpsError("invalid-argument", "Escolha um dia de segunda a sábado, a partir de amanhã, nos próximos 60 dias.");
    }
    const custRef = customerRef(tenantId, c.uid);
    const itemRef = custRef.collection("maintenance").doc(itemId);
    const slotRef = tenantRef(tenantId).collection("slots").doc(`${stationIdOf(station)}_${date}_${hour.replace(":", "")}`);
    const [cust, item, slot] = await Promise.all([tx.get(custRef), tx.get(itemRef), tx.get(slotRef)]);
    if (!cust.exists) throw new HttpsError("failed-precondition", "Conclua seu cadastro nesta rede.");
    if (!item.exists) throw new HttpsError("not-found", "Serviço não encontrado.");
    const count = slot.get("count") ?? 0;
    if (count >= rules.maintenance.slotCapacity) throw new HttpsError("resource-exhausted", "Esse horário lotou. Escolha outro.");
    const apptRef = tenantRef(tenantId).collection("appointments").doc();
    tx.set(slotRef, { count: count + 1, station, date, hour }, { merge: true });
    tx.create(apptRef, {
      customerUid: c.uid, customerName: cust.get("name"), itemId, service: item.get("name"), station, date, hour,
      bonus: item.get("bonus") === true, status: "scheduled", createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(itemRef, { scheduled: { appointmentId: apptRef.id, station, date, hour } });
    notify(tx, custRef, { title: "Agendamento confirmado", body: `${item.get("name")} · ${date.split("-").reverse().join("/")} às ${hour} · Posto ${station}`, kind: "manutencao" });
    return { appointmentId: apptRef.id };
  });
});

/** RN-61: um cupom por parceiro por cliente. */
export const claimCoupon = callable(async (req) => {
  const c = caller(req);
  const tenantId = tenantIdOf(req.data.tenantId);
  const partnerId = str(req.data.partnerId, "o parceiro", { max: 60 });
  return db.runTransaction(async (tx) => {
    const cfg = await loadTenant(tenantId, tx);
    requireFeature(cfg, "club");
    const partner = (cfg.partners ?? []).find((p: Record<string, unknown>) => p.id === partnerId && p.active !== false);
    if (!partner) throw new HttpsError("not-found", "Parceiro indisponível.");
    const custRef = customerRef(tenantId, c.uid);
    const ref = custRef.collection("coupons").doc(partnerId);
    const [cust, existing] = await Promise.all([tx.get(custRef), tx.get(ref)]);
    if (!cust.exists) throw new HttpsError("failed-precondition", "Conclua seu cadastro nesta rede.");
    if (existing.exists) return { code: existing.get("code"), created: false };
    const code = `CL-${shortCode(6)}`;
    tx.create(ref, { code, partnerId, partnerName: partner.name, offer: partner.offer, createdAt: FieldValue.serverTimestamp() });
    return { code, created: true };
  });
});
