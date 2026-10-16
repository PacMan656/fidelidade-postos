/**
 * Livro-razão de pontos e de carteira. Cada ganho é um "lote" com vencimento próprio (RN-21);
 * débitos consomem lotes FIFO (RN-22). As funções seguem a regra do Firestore: em uma transação,
 * todas as leituras vêm antes das escritas — por isso há funções de leitura e de escrita separadas.
 */
import type { DocumentReference, DocumentData, Transaction } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "./core.js";
import { levelFor, planConsumption, type OpenLot } from "../domain/points.js";
import { addMonths } from "../domain/time.js";
import type { TenantConfig } from "../domain/config.js";

export async function readOpenLots(tx: Transaction, custRef: DocumentReference): Promise<OpenLot[]> {
  const snap = await tx.get(custRef.collection("ledger").where("open", "==", true).orderBy("expiresAt").limit(500));
  return snap.docs.map((d) => ({ id: d.id, remaining: d.get("remaining"), expiresAtMs: (d.get("expiresAt") as Timestamp).toMillis() }));
}

export interface EarnInput { points: number; type: "earn" | "bonus" | "refund" | "adjust"; description: string; ref?: Record<string, unknown>; expirationMonths: number; now?: Date }

/** Credita pontos: novo lote + saldo + pontos de vida + nível (RN-25, RN-26). */
export function writeEarn(tx: Transaction, custRef: DocumentReference, cust: DocumentData, cfg: TenantConfig, e: EarnInput) {
  if (e.points <= 0) return { points: cust.points ?? 0, lifetime: cust.lifetimePoints ?? 0, level: cust.level };
  const now = e.now ?? new Date();
  const lotRef = custRef.collection("ledger").doc();
  tx.create(lotRef, {
    type: e.type, points: e.points, remaining: e.points, open: true,
    description: e.description, ref: e.ref ?? null,
    createdAt: Timestamp.fromDate(now), expiresAt: Timestamp.fromDate(addMonths(now, e.expirationMonths)),
  });
  // ajuste e estorno não contam como pontos "ganhos" para nível
  const lifetime = (cust.lifetimePoints ?? 0) + (e.type === "earn" || e.type === "bonus" ? e.points : 0);
  const points = (cust.points ?? 0) + e.points;
  const level = levelFor(lifetime, cfg.levels ?? []).name;
  tx.update(custRef, { points, lifetimePoints: lifetime, level, updatedAt: FieldValue.serverTimestamp() });
  cust.points = points; cust.lifetimePoints = lifetime; cust.level = level;
  return { points, lifetime, level };
}

/** Debita pontos dos lotes que vencem primeiro e registra a saída no extrato. */
export function writeSpend(
  tx: Transaction, custRef: DocumentReference, cust: DocumentData, lots: OpenLot[],
  s: { points: number; type: "redeem" | "expire" | "adjust"; description: string; ref?: Record<string, unknown> },
) {
  const plan = planConsumption(lots, s.points);
  for (const p of plan) tx.update(custRef.collection("ledger").doc(p.id), { remaining: p.remainingAfter, open: p.remainingAfter > 0 });
  tx.create(custRef.collection("ledger").doc(), {
    type: s.type, points: -s.points, open: false, description: s.description, ref: s.ref ?? null,
    consumed: plan.map((p) => ({ lot: p.id, points: p.take })), createdAt: FieldValue.serverTimestamp(),
  });
  const points = (cust.points ?? 0) - s.points;
  tx.update(custRef, { points, updatedAt: FieldValue.serverTimestamp() });
  cust.points = points;
  return points;
}

/** Movimento da carteira em centavos; nunca deixa o saldo negativo (RN-37). */
export function writeWallet(
  tx: Transaction, custRef: DocumentReference, cust: DocumentData,
  w: { amountCents: number; type: string; description: string; ref?: Record<string, unknown> },
) {
  const before = cust.prepaidCents ?? 0;
  const after = before + w.amountCents;
  if (after < 0) throw new Error("Saldo da carteira insuficiente");
  tx.create(custRef.collection("wallet").doc(), {
    type: w.type, amountCents: w.amountCents, balanceAfterCents: after, description: w.description, ref: w.ref ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  tx.update(custRef, { prepaidCents: after, updatedAt: FieldValue.serverTimestamp() });
  cust.prepaidCents = after;
  return after;
}
