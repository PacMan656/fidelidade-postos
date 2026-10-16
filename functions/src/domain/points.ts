/** Regras de pontos: acúmulo (RN-16 a RN-19), consumo FIFO (RN-22) e níveis (RN-25). */

export interface PointsRules {
  perReal: number;
  appMultiplier: number;
  expirationMonths: number;
  welcomeBonus: number;
}

export function pointsFor(paidCents: number, rules: PointsRules, paidInApp: boolean): number {
  if (paidCents <= 0) return 0;
  const mult = paidInApp ? Math.max(1, rules.appMultiplier || 1) : 1;
  // inteiro em centavos evita erro de ponto flutuante (ex.: 180,70 × 2 = 361,4 → 361)
  return Math.floor((paidCents * (rules.perReal || 0) * mult) / 100 + 1e-9);
}

export interface Level { name: string; min: number }

export function levelFor(lifetimePoints: number, levels: Level[]): { name: string; next: string | null; missing: number } {
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  let idx = 0;
  sorted.forEach((l, i) => { if (lifetimePoints >= l.min) idx = i; });
  const next = sorted[idx + 1];
  return { name: sorted[idx]?.name ?? "", next: next?.name ?? null, missing: next ? next.min - lifetimePoints : 0 };
}

export interface OpenLot { id: string; remaining: number; expiresAtMs: number }

/**
 * Plano de consumo: debita `amount` dos lotes que vencem primeiro.
 * Lança erro se os lotes não cobrem o valor (o saldo do cliente nunca fica negativo — RN-27).
 */
export function planConsumption(lots: OpenLot[], amount: number): { id: string; take: number; remainingAfter: number }[] {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Quantidade de pontos inválida");
  const sorted = [...lots].filter((l) => l.remaining > 0).sort((a, b) => a.expiresAtMs - b.expiresAtMs || a.id.localeCompare(b.id));
  const plan: { id: string; take: number; remainingAfter: number }[] = [];
  let left = amount;
  for (const lot of sorted) {
    if (left === 0) break;
    const take = Math.min(lot.remaining, left);
    plan.push({ id: lot.id, take, remainingAfter: lot.remaining - take });
    left -= take;
  }
  if (left > 0) throw new Error("Saldo de pontos insuficiente");
  return plan;
}
