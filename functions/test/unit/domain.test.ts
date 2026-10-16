import { describe, it, expect } from "vitest";
import { isValidCpf, maskCpf } from "../../src/domain/cpf.js";
import { pointsFor, levelFor, planConsumption } from "../../src/domain/points.js";
import { computeSale } from "../../src/domain/sale.js";
import { validateConfig, rulesOf } from "../../src/domain/config.js";
import { buildBrCode, crc16 } from "../../src/domain/pix.js";
import { bonusCents, activeCampaign } from "../../src/domain/campaign.js";
import { atHourInTz, dayKey } from "../../src/domain/time.js";
import { signCheckin, verifyCheckin } from "../../src/lib/security.js";
import cfg from "../../../seed/tenants/dona-rosa.json" with { type: "json" };

const rules = { perReal: 1, appMultiplier: 2, expirationMonths: 12, welcomeBonus: 200 };

describe("CPF (RN-11, RN-12)", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("mascara mantendo só os últimos dígitos", () => expect(maskCpf("52998224725")).toBe("•••.•••.247-25"));
});

describe("Pontos (RN-16, RN-17, RN-25)", () => {
  it("arredonda para baixo sobre o valor pago", () => {
    expect(pointsFor(18070, rules, false)).toBe(180);
    expect(pointsFor(18070, rules, true)).toBe(361);
    expect(pointsFor(99, rules, false)).toBe(0);
    expect(pointsFor(0, rules, true)).toBe(0);
  });
  it("nível por pontos de vida", () => {
    expect(levelFor(3480, cfg.levels)).toEqual({ name: "Ouro", next: "Diamante", missing: 520 });
    expect(levelFor(0, cfg.levels).name).toBe("Bronze");
    expect(levelFor(9999, cfg.levels)).toEqual({ name: "Diamante", next: null, missing: 0 });
  });
});

describe("Consumo FIFO (RN-22)", () => {
  const lots = [
    { id: "b", remaining: 100, expiresAtMs: 2000 },
    { id: "a", remaining: 50, expiresAtMs: 1000 },
    { id: "c", remaining: 500, expiresAtMs: 3000 },
  ];
  it("consome primeiro o que vence antes", () => {
    expect(planConsumption(lots, 120)).toEqual([
      { id: "a", take: 50, remainingAfter: 0 },
      { id: "b", take: 70, remainingAfter: 30 },
    ]);
  });
  it("recusa saldo insuficiente", () => expect(() => planConsumption(lots, 651)).toThrow(/insuficiente/));
  it("recusa quantidade inválida", () => expect(() => planConsumption(lots, 0)).toThrow());
});

describe("Venda (RN-50) — exemplo do documento", () => {
  it("aplica oferta, trava e multiplicador", () => {
    const b = computeSale({
      fuel: "Gasolina", liters: 40, grossCents: 25160, pricePerLiterCents: 629, paidInApp: true,
      offer: { discountPerLiterCents: 20, litersLeftToday: 100 },
      locks: [{ id: "l1", fuel: "Gasolina", litersRemaining: 10, expiresAtMs: 1 }],
      useLocks: true, rules,
    });
    expect(b.offerDiscountCents).toBe(800);
    expect(b.lockValueCents).toBe(6290);
    expect(b.paidCents).toBe(18070);
    expect(b.points).toBe(361);
    expect(b.lockConsumption).toEqual([{ id: "l1", liters: 10, remainingAfter: 0 }]);
  });
  it("limita a oferta aos litros restantes do dia e ignora trava de outro combustível", () => {
    const b = computeSale({
      fuel: "Etanol", liters: 30, grossCents: 13470, pricePerLiterCents: 449, paidInApp: false,
      offer: { discountPerLiterCents: 20, litersLeftToday: 10 },
      locks: [{ id: "l1", fuel: "Gasolina", litersRemaining: 10, expiresAtMs: 1 }], useLocks: true, rules,
    });
    expect(b.offerLiters).toBe(10);
    expect(b.lockLiters).toBe(0);
    expect(b.paidCents).toBe(13270);
    expect(b.points).toBe(132);
  });
  it("trava que cobre tudo zera o valor e os pontos (RN-19)", () => {
    const b = computeSale({ fuel: "Gasolina", liters: 5, grossCents: 3145, pricePerLiterCents: 629, paidInApp: false, offer: null, locks: [{ id: "x", fuel: "Gasolina", litersRemaining: 8, expiresAtMs: 1 }], useLocks: true, rules });
    expect(b.paidCents).toBe(0);
    expect(b.points).toBe(0);
    expect(b.lockConsumption[0].remainingAfter).toBe(3);
  });
});

describe("Configuração (RN-05, RN-06)", () => {
  it("aceita as redes de exemplo", () => expect(validateConfig(cfg)).toEqual([]));
  it("aponta erros legíveis", () => {
    const bad = structuredClone(cfg) as Record<string, any>;
    bad.brand.colors.brand = "vermelho";
    bad.rewards.push({ ...bad.rewards[0] });
    bad.fuelPrices.Gasolina = 0;
    const errs = validateConfig(bad);
    expect(errs).toContain("brand.colors.brand deve ser #RRGGBB");
    expect(errs.some((e) => e.includes("repetido"))).toBe(true);
    expect(errs).toContain("fuelPrices.Gasolina deve ser maior que zero");
  });
  it("converte regras para centavos", () => {
    const r = rulesOf(cfg);
    expect(r.offer.discountPerLiterCents).toBe(20);
    expect(r.wallet.maxBalanceCents).toBe(200000);
  });
});

describe("Pix BR Code", () => {
  it("monta payload EMV com CRC válido", () => {
    const code = buildBrCode({ key: "12.345.678/0001-90", merchantName: "Posto Dona Rosa", merchantCity: "Guadalupe", amountCents: 10050, txid: "DR123" });
    expect(code.startsWith("000201")).toBe(true);
    expect(code).toContain("br.gov.bcb.pix");
    expect(code).toContain("5406100.50");
    expect(code).toContain("5915POSTO DONA ROSA");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });
  it("CRC16 confere com valor de referência", () => expect(crc16("123456789")).toBe("29B1"));
});

describe("Campanha (RN-55)", () => {
  it("soma quantidade × bônus", () => {
    const camp = activeCampaign(cfg, "2026-10-16")!;
    expect(bonusCents({ cadastros: 14, trocas: 6, aditivos: 9, lavagens: 5 }, camp.items)).toBe(16500);
    expect(activeCampaign(cfg, "2026-11-01")).toBeNull();
  });
});

describe("Fuso de Brasília", () => {
  it("dia e horário de término", () => {
    const d = new Date("2026-10-17T02:30:00Z"); // 23:30 do dia 16 em Brasília
    expect(dayKey(d)).toBe("2026-10-16");
    expect(atHourInTz(d, 23).toISOString()).toBe("2026-10-17T02:00:00.000Z");
  });
});

describe("QR de identificação (RN-49)", () => {
  it("assina, verifica e expira", () => {
    const { token } = signCheckin("segredo", "dona-rosa", "u1", 300, 1_000_000);
    expect(verifyCheckin("segredo", token, 1_000_000)).toEqual({ t: "dona-rosa", u: "u1" });
    expect(verifyCheckin("outro", token, 1_000_000)).toBeNull();
    expect(verifyCheckin("segredo", token, 1_000_000 + 301_000)).toBeNull();
    expect(verifyCheckin("segredo", token.replace(/^./, "x"), 1_000_000)).toBeNull();
  });
});
