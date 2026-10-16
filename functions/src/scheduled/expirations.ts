/** Rotinas diárias de vencimento (RN-23, RN-30, RN-36, RN-42). Horários em Brasília. */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, Timestamp, FieldValue, REGION, logger, notify } from "../lib/core.js";
import { readOpenLots, writeSpend, writeWallet } from "../lib/ledger.js";

const opts = (schedule: string) => ({ schedule, timeZone: "America/Sao_Paulo", region: REGION, timeoutSeconds: 540, memory: "512MiB" as const });

/** Baixa lotes de pontos vencidos, um cliente por transação. */
export async function expirePointsNow(now = new Date()) {
  const due = await db.collectionGroup("ledger").where("open", "==", true).where("expiresAt", "<=", Timestamp.fromDate(now)).limit(2000).get();
  const byCustomer = new Map<string, FirebaseFirestore.DocumentReference>();
  due.docs.forEach((d) => byCustomer.set(d.ref.parent.parent!.path, d.ref.parent.parent!));
  let customers = 0, points = 0;
  for (const custRef of byCustomer.values()) {
    const expired = await db.runTransaction(async (tx) => {
      const cust = (await tx.get(custRef)).data();
      if (!cust) return 0;
      const lots = await readOpenLots(tx, custRef);
      const total = lots.filter((l) => l.expiresAtMs <= now.getTime()).reduce((s, l) => s + l.remaining, 0);
      if (total <= 0) return 0;
      // só os vencidos: como o FIFO consome primeiro os que vencem antes, o plano bate exatamente com eles
      writeSpend(tx, custRef, cust, lots, { points: total, type: "expire", description: "Pontos expirados" });
      notify(tx, custRef, { title: "Pontos expirados", body: `${total} pontos venceram hoje.`, kind: "alerta" });
      return total;
    });
    if (expired) { customers++; points += expired; }
  }
  return { customers, points };
}

export async function expireVouchersNow(now = new Date()) {
  const snap = await db.collectionGroup("vouchers").where("status", "==", "active").where("expiresAt", "<=", Timestamp.fromDate(now)).limit(2000).get();
  const writer = db.bulkWriter();
  snap.docs.forEach((d) => writer.update(d.ref, { status: "expired", expiredAt: FieldValue.serverTimestamp() }));
  await writer.close();
  return { vouchers: snap.size };
}

export async function expirePixChargesNow(now = new Date()) {
  const snap = await db.collectionGroup("pixCharges").where("status", "==", "pending").where("expiresAt", "<=", Timestamp.fromDate(now)).limit(2000).get();
  const writer = db.bulkWriter();
  snap.docs.forEach((d) => writer.update(d.ref, { status: "expired" }));
  await writer.close();
  return { charges: snap.size };
}

/** RN-42: trava vencida devolve à carteira o valor proporcional aos litros restantes. */
export async function expireFuelLocksNow(now = new Date()) {
  const snap = await db.collectionGroup("fuelLocks").where("status", "==", "active").where("expiresAt", "<=", Timestamp.fromDate(now)).limit(1000).get();
  let refunded = 0;
  for (const lock of snap.docs) {
    const custRef = lock.ref.parent.parent!;
    refunded += await db.runTransaction(async (tx) => {
      const [l, c] = await Promise.all([tx.get(lock.ref), tx.get(custRef)]);
      if (!l.exists || l.get("status") !== "active" || !c.exists) return 0;
      const left = l.get("litersRemaining") as number;
      const cents = Math.round((left / l.get("litersTotal")) * l.get("paidCents"));
      const cust = c.data()!;
      tx.update(lock.ref, { status: "expired", refundedCents: cents });
      tx.update(custRef, { lockedLiters: Math.max(0, (cust.lockedLiters ?? 0) - left) });
      if (cents > 0) {
        writeWallet(tx, custRef, cust, { amountCents: cents, type: "refund_lock", description: `Trava vencida · ${left} L de ${l.get("fuel")}`, ref: { lock: lock.id } });
        notify(tx, custRef, { title: "Trava de preço vencida", body: `Devolvemos o valor de ${left} L não usados para a sua carteira.`, kind: "carteira" });
      }
      return cents;
    });
  }
  return { locks: snap.size, refundedCents: refunded };
}

export const dailyExpirations = onSchedule(opts("every day 03:10"), async () => {
  const r = {
    points: await expirePointsNow(),
    vouchers: await expireVouchersNow(),
    fuelLocks: await expireFuelLocksNow(),
  };
  logger.info("Vencimentos diários", r);
});

export const pixChargeExpiration = onSchedule(opts("every 15 minutes"), async () => {
  logger.info("Cobranças Pix vencidas", await expirePixChargesNow());
});
