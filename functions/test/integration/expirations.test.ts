import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, resetEmulators, seedTenant, makeUser, cleanupApps, CPFS } from "../helpers.js";
import { expirePointsNow, expireVouchersNow, expireFuelLocksNow } from "../../src/scheduled/expirations.js";

const T = "dona-rosa";
const cust = (uid: string) => adminDb.doc(`tenants/${T}/customers/${uid}`);

beforeEach(async () => { await resetEmulators(); await seedTenant(T); });
afterAll(cleanupApps);

describe("Rotinas diárias", () => {
  it("RN-21/RN-23: baixa só os lotes vencidos e registra no extrato", async () => {
    const u = await makeUser();
    await u.call("joinTenant", { tenantId: T, name: "Ana", cpf: CPFS[0], phone: "1" });
    await cust(u.uid).collection("ledger").doc("velho").set({ type: "earn", points: 150, remaining: 150, open: true, createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await cust(u.uid).update({ points: 350 });
    const r = await expirePointsNow();
    expect(r).toEqual({ customers: 1, points: 150 });
    expect((await cust(u.uid).get()).get("points")).toBe(200);
    const exp = await cust(u.uid).collection("ledger").where("type", "==", "expire").get();
    expect(exp.docs[0].get("points")).toBe(-150);
    expect((await expirePointsNow()).points).toBe(0);
  });

  it("RN-30: vouchers vencidos mudam de status", async () => {
    await adminDb.doc(`tenants/${T}/vouchers/ABCDEFGH`).set({ status: "active", expiresAt: Timestamp.fromMillis(Date.now() - 1) });
    await adminDb.doc(`tenants/${T}/vouchers/HGFEDCBA`).set({ status: "active", expiresAt: Timestamp.fromMillis(Date.now() + 1e9) });
    expect((await expireVouchersNow()).vouchers).toBe(1);
    expect((await adminDb.doc(`tenants/${T}/vouchers/ABCDEFGH`).get()).get("status")).toBe("expired");
  });

  it("RN-42: trava vencida devolve o proporcional dos litros restantes", async () => {
    const u = await makeUser();
    await u.call("joinTenant", { tenantId: T, name: "Ana", cpf: CPFS[1], phone: "1" });
    await cust(u.uid).update({ prepaidCents: 0, lockedLiters: 5 });
    await cust(u.uid).collection("fuelLocks").doc("l1").set({ fuel: "Gasolina", litersTotal: 20, litersRemaining: 5, paidCents: 12340, status: "active", expiresAt: Timestamp.fromMillis(Date.now() - 1) });
    const r = await expireFuelLocksNow();
    expect(r.refundedCents).toBe(3085);
    const c = (await cust(u.uid).get()).data()!;
    expect(c.prepaidCents).toBe(3085);
    expect(c.lockedLiters).toBe(0);
  });
});
