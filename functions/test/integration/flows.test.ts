import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, resetEmulators, seedTenant, makeUser, cleanupApps, errorOf, functionsUrl, CPFS, type TestUser } from "../helpers.js";

const T = "dona-rosa";
const cust = (uid: string) => adminDb.doc(`tenants/${T}/customers/${uid}`);

async function customer(cpf = CPFS[0], extra: Record<string, unknown> = {}): Promise<TestUser> {
  const u = await makeUser();
  await u.call("joinTenant", { tenantId: T, name: "Elísio Andrade", cpf, phone: "11987654321", ...extra });
  return u;
}
const attendant = () => makeUser(undefined, { roles: { [T]: "attendant" } });
const manager = () => makeUser(undefined, { roles: { [T]: "manager" } });
const owner = () => makeUser(undefined, { roles: { [T]: "owner" } });

async function fundWallet(uid: string, cents: number) {
  await cust(uid).update({ prepaidCents: cents });
}

beforeEach(async () => {
  await resetEmulators();
  await seedTenant(T);
  await seedTenant("rede-avenida");
});
afterAll(cleanupApps);

describe("Cadastro na rede", () => {
  it("RN-11 a RN-13: cria cliente com CPF mascarado e bônus de boas-vindas", async () => {
    const u = await customer();
    const c = (await cust(u.uid).get()).data()!;
    expect(c.cpfMasked).toBe("•••.•••.247-25");
    expect(c.cpfHash).toHaveLength(64);
    expect(JSON.stringify(c)).not.toContain("52998224725");
    expect(c.points).toBe(200);
    expect(c.lifetimePoints).toBe(200);
    expect(c.level).toBe("Bronze");
    const ledger = await cust(u.uid).collection("ledger").get();
    expect(ledger.docs[0].get("type")).toBe("bonus");
  });

  it("RN-12: CPF único por rede, mas pode repetir em outra rede", async () => {
    await customer(CPFS[1]);
    const other = await makeUser();
    const e = await errorOf(other.call("joinTenant", { tenantId: T, name: "X", cpf: CPFS[1], phone: "1" }));
    expect(e.code).toBe("functions/already-exists");
    await other.call("joinTenant", { tenantId: "rede-avenida", name: "X", cpf: CPFS[1], phone: "1" });
  });

  it("RN-11: recusa CPF inválido", async () => {
    const u = await makeUser();
    expect((await errorOf(u.call("joinTenant", { tenantId: T, name: "X", cpf: "123.456.789-00", phone: "1" }))).code).toBe("functions/invalid-argument");
  });

  it("RN-14: cadastro com código do frentista conta na campanha", async () => {
    const mgr = await owner();
    const att = await makeUser("frentista@posto.com");
    await mgr.call("setStaffRole", { tenantId: T, email: "frentista@posto.com", role: "attendant", station: "Centro" });
    const code = (await adminDb.doc(`tenants/${T}/staff/${att.uid}`).get()).get("code");
    await adminDb.doc(`tenants/${T}`).update({ "campaign.startsAt": "2000-01-01", "campaign.endsAt": "2999-12-31" });
    await customer(CPFS[2], { referralCode: code });
    const camp = await adminDb.doc(`tenants/${T}/campaigns/2026-10/staff/${att.uid}`).get();
    expect(camp.get("counters.cadastros")).toBe(1);
  });
});

describe("Venda no posto", () => {
  it("RN-49/50: identifica por QR, aplica oferta e trava, pontua e é idempotente", async () => {
    await adminDb.doc(`tenants/${T}`).update({ "offer.endsAtHour": 24, "campaign.startsAt": "2000-01-01", "campaign.endsAt": "2999-12-31" });
    const u = await customer();
    const att = await attendant();
    await fundWallet(u.uid, 10000);
    await u.call("lockFuelPrice", { tenantId: T, fuel: "Gasolina", liters: 10 }); // 10 × 6,29 = 62,90
    await u.call("activateOffer", { tenantId: T });
    const { token } = await u.call("issueCheckinToken", { tenantId: T });

    const info = await att.call("lookupCustomer", { tenantId: T, token });
    expect(info).toMatchObject({ name: "Elísio Andrade", cpfMasked: "•••.•••.247-25", offerActive: true, lockedByFuel: { Gasolina: 10 } });

    const sale = { tenantId: T, token, requestId: "venda-1", station: "Centro", fuel: "Gasolina", liters: 40, amount: 251.6, method: "pix", items: ["trocas", "lavagens"], useLocks: true };
    const r = await att.call("registerSale", sale);
    expect(r).toMatchObject({ offerDiscountCents: 800, lockValueCents: 6290, paidCents: 18070, points: 180 });
    expect(r.campaign).toEqual({ bonusCents: 1200, identification: 100 });

    const again = await att.call("registerSale", sale); // RN-20
    expect(again.saleId).toBe(r.saleId);
    const c = (await cust(u.uid).get()).data()!;
    // 200 boas-vindas + 125 da trava (62,90 × 2) + 180 da venda
    expect(c.points).toBe(505);
    expect(c.lockedLiters).toBe(0);
    expect((await adminDb.collection(`tenants/${T}/sales`).where("channel", "==", "pos").get()).size).toBe(1);
  });

  it("RN-52/RN-65: cliente não registra venda nem consulta outros clientes", async () => {
    const u = await customer();
    expect((await errorOf(u.call("lookupCustomer", { tenantId: T, cpf: CPFS[0] }))).code).toBe("functions/permission-denied");
    expect((await errorOf(u.call("registerSale", { tenantId: T, requestId: "x", station: "Centro", amount: 10 }))).code).toBe("functions/permission-denied");
  });

  it("RN-49: QR de outra rede ou adulterado é recusado", async () => {
    const att = await attendant();
    expect((await errorOf(att.call("lookupCustomer", { tenantId: T, token: "abc.def" }))).code).toBe("functions/invalid-argument");
  });
});

describe("Carteira e Pix", () => {
  const sign = (body: string) => createHmac("sha256", "segredo-webhook-teste").update(body).digest("hex");

  it("RN-35: credita só com webhook assinado e uma única vez", async () => {
    const u = await customer();
    const charge = await u.call("createPixCharge", { tenantId: T, amount: 100 });
    expect(charge.brCode).toContain("br.gov.bcb.pix");
    expect((await cust(u.uid).get()).get("prepaidCents")).toBe(0);

    const body = JSON.stringify({ pix: [{ txid: charge.txid, valor: "100.00", endToEndId: "E123456789", horario: new Date().toISOString() }] });
    const bad = await fetch(functionsUrl(`pixWebhook/${T}`), { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": "00" }, body });
    expect(bad.status).toBe(401);

    for (let i = 0; i < 2; i++) {
      const ok = await fetch(functionsUrl(`pixWebhook/${T}`), { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": sign(body) }, body });
      expect(ok.status).toBe(200);
    }
    expect((await cust(u.uid).get()).get("prepaidCents")).toBe(10000);
    expect((await adminDb.doc(`tenants/${T}/pixCharges/${charge.txid}`).get()).get("status")).toBe("paid");
  });

  it("RN-34: respeita mínimo e saldo máximo", async () => {
    const u = await customer();
    expect((await errorOf(u.call("createPixCharge", { tenantId: T, amount: 5 }))).code).toBe("functions/invalid-argument");
    await fundWallet(u.uid, 190000);
    expect((await errorOf(u.call("createPixCharge", { tenantId: T, amount: 200 }))).code).toBe("functions/failed-precondition");
  });

  it("RN-17/RN-37: paga com carteira e ganha pontos em dobro; sem saldo, nada muda", async () => {
    const u = await customer();
    await fundWallet(u.uid, 15000);
    const r = await u.call("payWithApp", { tenantId: T, amount: 150, method: "wallet", requestId: "p1", station: "Rodovia" });
    expect(r.points).toBe(300);
    const c = (await cust(u.uid).get()).data()!;
    expect(c.prepaidCents).toBe(0);
    expect(c.points).toBe(500);
    expect((await errorOf(u.call("payWithApp", { tenantId: T, amount: 10, method: "wallet", requestId: "p2" }))).code).toBe("functions/failed-precondition");
    expect((await cust(u.uid).get()).get("points")).toBe(500);
  });

  it("RN-38: cartão guarda só token fora do alcance do cliente; recusa do emissor não cobra", async () => {
    const u = await customer();
    const { cardId } = await u.call("addCard", { tenantId: T, token: "tok_test_4242", brand: "Visa", last4: "4242", kind: "Crédito" });
    const card = (await cust(u.uid).collection("cards").doc(cardId).get()).data()!;
    expect(card).toMatchObject({ brand: "Visa", last4: "4242", isDefault: true });
    expect(card.token).toBeUndefined();
    const r = await u.call("creditWithCard", { tenantId: T, amount: 50, cardId, requestId: "c1" });
    expect(r.balanceCents).toBe(5000);

    const { cardId: bad } = await u.call("addCard", { tenantId: T, token: "tok_test_decline_1", brand: "Visa", last4: "0002" });
    expect((await errorOf(u.call("creditWithCard", { tenantId: T, amount: 50, cardId: bad, requestId: "c2" }))).message).toMatch(/recusado/);
    expect((await cust(u.uid).get()).get("prepaidCents")).toBe(5000);
  });
});

describe("Resgates e vouchers", () => {
  it("RN-22/RN-30/RN-31: resgata em FIFO, gera voucher e só valida uma vez", async () => {
    const u = await customer();
    const att = await attendant();
    // lote antigo que vence antes do bônus de boas-vindas
    const old = cust(u.uid).collection("ledger").doc("antigo");
    await old.set({ type: "earn", points: 3000, remaining: 3000, open: true, createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000) });
    await cust(u.uid).update({ points: 3200, lifetimePoints: 3200 });

    const r = await u.call("redeemReward", { tenantId: T, rewardId: "oleo" });
    expect(r.code).toMatch(/^[A-Z2-9]{8}$/);
    expect((await old.get()).get("remaining")).toBe(0);
    expect((await cust(u.uid).get()).get("points")).toBe(200);
    expect((await cust(u.uid).get()).get("lifetimePoints")).toBe(3200); // RN-25: resgate não rebaixa

    const check = await att.call("validateVoucher", { tenantId: T, code: r.code, station: "Centro" });
    expect(check).toMatchObject({ valid: true, used: false, rewardName: "Troca de óleo" });
    await att.call("validateVoucher", { tenantId: T, code: r.code, station: "Centro", confirm: true });
    expect((await errorOf(att.call("validateVoucher", { tenantId: T, code: r.code, station: "Centro", confirm: true }))).message).toMatch(/já foi utilizado/);
  });

  it("RN-28/RN-29: saldo insuficiente, limite mensal e estoque", async () => {
    const u = await customer();
    expect((await errorOf(u.call("redeemReward", { tenantId: T, rewardId: "oleo" }))).message).toMatch(/Faltam/);
    await adminDb.doc(`tenants/${T}`).update({ rewards: (await adminDb.doc(`tenants/${T}`).get()).get("rewards").map((r: any) => (r.id === "cafe" ? { ...r, stock: 1 } : r)) });
    await cust(u.uid).collection("ledger").doc("extra").set({ type: "earn", points: 6000, remaining: 6000, open: true, createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 9e10) });
    await cust(u.uid).update({ points: 6200 });
    await u.call("redeemReward", { tenantId: T, rewardId: "oleo" });
    expect((await errorOf(u.call("redeemReward", { tenantId: T, rewardId: "oleo" }))).message).toMatch(/Limite de 1/);
    await u.call("redeemReward", { tenantId: T, rewardId: "cafe" });
    expect((await errorOf(u.call("redeemReward", { tenantId: T, rewardId: "cafe" }))).message).toMatch(/esgotado/);
  });

  it("RN-32: cancelar voucher devolve os pontos", async () => {
    const u = await customer();
    const mgr = await manager();
    await mgr.call("adjustPoints", { tenantId: T, customerUid: u.uid, points: 300, reason: "Cortesia" });
    const r = await u.call("redeemReward", { tenantId: T, rewardId: "cafe" }); // 500 − 400
    expect((await cust(u.uid).get()).get("points")).toBe(100);
    await mgr.call("cancelVoucher", { tenantId: T, code: r.code, reason: "Produto em falta" });
    expect((await cust(u.uid).get()).get("points")).toBe(500);
    expect((await adminDb.doc(`tenants/${T}/vouchers/${r.code}`).get()).get("status")).toBe("cancelled");
  });
});

describe("Gestão da configuração", () => {
  it("RN-06/RN-07/RN-08: publica com versão, recusa conflito e restaura", async () => {
    const mgr = await manager();
    const cfg = (await adminDb.doc(`tenants/${T}`).get()).data()!;
    const r = await mgr.call("publishConfig", { tenantId: T, expectedVersion: 1, config: { ...cfg, offer: { ...cfg.offer, value: "R$ 0,35" }, domains: ["app.donarosa.com.br"] } });
    expect(r.version).toBe(2);
    expect((await adminDb.doc("domains/app.donarosa.com.br").get()).get("tenantId")).toBe(T);
    expect((await errorOf(mgr.call("publishConfig", { tenantId: T, expectedVersion: 1, config: cfg }))).code).toBe("functions/aborted");
    const bad = await errorOf(mgr.call("publishConfig", { tenantId: T, config: { ...cfg, brand: { ...cfg.brand, colors: {} } } }));
    expect(bad.code).toBe("functions/invalid-argument");
    expect(bad.details).toContain("brand.colors.brand deve ser #RRGGBB");
    await mgr.call("rollbackConfig", { tenantId: T, version: 1 });
    const now = (await adminDb.doc(`tenants/${T}`).get()).data()!;
    expect(now.version).toBe(3);
    expect(now.offer.value).toBe("R$ 0,20");
    expect((await adminDb.collection(`tenants/${T}/audit`).get()).size).toBe(2);
  });

  it("RN-10/RN-02: domínio de outra rede e permissões por papel", async () => {
    const mgr = await manager();
    const att = await attendant();
    const otherMgr = await makeUser(undefined, { roles: { "rede-avenida": "manager" } });
    await adminDb.doc("domains/app.donarosa.com.br").set({ tenantId: T });
    const av = (await adminDb.doc("tenants/rede-avenida").get()).data()!;
    expect((await errorOf(otherMgr.call("publishConfig", { tenantId: "rede-avenida", config: { ...av, domains: ["app.donarosa.com.br"] } }))).code).toBe("functions/already-exists");
    expect((await errorOf(att.call("publishConfig", { tenantId: T, config: av }))).code).toBe("functions/permission-denied");
    expect((await errorOf(otherMgr.call("publishConfig", { tenantId: T, config: av }))).code).toBe("functions/permission-denied");
    expect((await errorOf(mgr.call("createTenant", { id: "nova", name: "Nova" }))).code).toBe("functions/permission-denied");
    expect((await errorOf(mgr.call("setStaffRole", { tenantId: T, email: "x@y.com", role: "manager" }))).code).toBe("functions/permission-denied");
  });

  it("RN-09: rede suspensa não aceita operações", async () => {
    const admin = await makeUser(undefined, { platformAdmin: true });
    const u = await customer();
    await admin.call("setTenantStatus", { tenantId: T, status: "suspended", reason: "Inadimplência" });
    expect((await errorOf(u.call("activateOffer", { tenantId: T }))).message).toMatch(/suspensa/);
  });

  it("RN-27: ajuste não deixa saldo negativo", async () => {
    const mgr = await manager();
    const u = await customer();
    expect((await errorOf(mgr.call("adjustPoints", { tenantId: T, customerUid: u.uid, points: -500, reason: "teste" }))).message).toMatch(/insuficiente/);
    await mgr.call("adjustPoints", { tenantId: T, customerUid: u.uid, points: -150, reason: "Correção" });
    expect((await cust(u.uid).get()).get("points")).toBe(50);
  });
});

describe("Trava de preço e agendamento", () => {
  it("RN-41: limites de litros e saldo", async () => {
    const u = await customer();
    expect((await errorOf(u.call("lockFuelPrice", { tenantId: T, fuel: "Gasolina", liters: 2 }))).code).toBe("functions/invalid-argument");
    expect((await errorOf(u.call("lockFuelPrice", { tenantId: T, fuel: "Gasolina", liters: 20 }))).message).toMatch(/Saldo insuficiente/);
  });

  it("RN-59: respeita a capacidade do horário", async () => {
    const d = new Date(Date.now() + 3 * 86400000);
    while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
    const date = d.toISOString().slice(0, 10);
    const args = { tenantId: T, itemId: "oleo", station: "Centro", date, hour: "09:30" };
    await (await customer(CPFS[0])).call("scheduleMaintenance", args);
    await (await customer(CPFS[1])).call("scheduleMaintenance", args);
    const third = await customer(CPFS[2]);
    expect((await errorOf(third.call("scheduleMaintenance", args))).code).toBe("functions/resource-exhausted");
  });
});
