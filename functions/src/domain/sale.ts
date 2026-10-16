/** Cálculo de uma venda no posto, na ordem da RN-50. Tudo em centavos e mililitros para não perder precisão. */
import { pointsFor, PointsRules } from "./points.js";

export interface FuelLock { id: string; fuel: string; litersRemaining: number; expiresAtMs: number }

export interface SaleInput {
  fuel: string;
  liters: number;
  grossCents: number;
  pricePerLiterCents: number;          // preço vigente na configuração
  paidInApp: boolean;
  offer: { discountPerLiterCents: number; litersLeftToday: number } | null;
  locks: FuelLock[];                   // travas ativas do cliente
  useLocks: boolean;
  rules: PointsRules;
}

export interface SaleBreakdown {
  offerLiters: number;
  offerDiscountCents: number;
  lockLiters: number;
  lockValueCents: number;
  lockConsumption: { id: string; liters: number; remainingAfter: number }[];
  paidCents: number;
  points: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function computeSale(i: SaleInput): SaleBreakdown {
  if (!(i.liters >= 0) || !(i.grossCents >= 0)) throw new Error("Litros e valor devem ser positivos");

  // 1. desconto da oferta, limitado aos litros restantes do dia (RN-46)
  const offerLiters = i.offer ? round3(Math.min(i.liters, Math.max(0, i.offer.litersLeftToday))) : 0;
  const offerDiscountCents = i.offer ? Math.round(offerLiters * i.offer.discountPerLiterCents) : 0;

  // 2. litros da trava do mesmo combustível, primeiro os que vencem antes (RN-43)
  const lockConsumption: SaleBreakdown["lockConsumption"] = [];
  let lockLiters = 0;
  if (i.useLocks) {
    let need = round3(i.liters);
    const usable = i.locks.filter((l) => l.fuel === i.fuel && l.litersRemaining > 0).sort((a, b) => a.expiresAtMs - b.expiresAtMs);
    for (const l of usable) {
      if (need <= 0) break;
      const take = round3(Math.min(l.litersRemaining, need));
      lockConsumption.push({ id: l.id, liters: take, remainingAfter: round3(l.litersRemaining - take) });
      lockLiters = round3(lockLiters + take);
      need = round3(need - take);
    }
  }
  const lockValueCents = Math.round(lockLiters * i.pricePerLiterCents);

  // 3. valor a pagar e pontos sobre o valor pago (RN-18, RN-19)
  const paidCents = Math.max(0, i.grossCents - offerDiscountCents - lockValueCents);
  const points = pointsFor(paidCents, i.rules, i.paidInApp);

  return { offerLiters, offerDiscountCents, lockLiters, lockValueCents, lockConsumption, paidCents, points };
}
