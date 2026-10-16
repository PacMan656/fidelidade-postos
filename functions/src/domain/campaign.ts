/** Campanha de incentivo da equipe (RN-53 a RN-56). */
import { toCents } from "./money.js";
import type { TenantConfig } from "./config.js";

export interface CampaignItem { key: string; reward: number; goal: number }

export function activeCampaign(cfg: TenantConfig, today: string): { id: string; items: CampaignItem[] } | null {
  const c = cfg.campaign;
  if (!c?.id || !Array.isArray(c.items)) return null;
  if (c.startsAt && today < c.startsAt) return null;
  if (c.endsAt && today > c.endsAt) return null;
  return { id: String(c.id), items: c.items };
}

/** RN-55: bônus = Σ quantidade × bônus por unidade */
export function bonusCents(counters: Record<string, number>, items: CampaignItem[]): number {
  return items.reduce((sum, it) => sum + (counters[it.key] ?? 0) * toCents(it.reward), 0);
}

/** Itens da venda que contam para a campanha (os que existem na campanha ativa) */
export function countableItems(saleItems: string[], items: CampaignItem[]): string[] {
  const keys = new Set(items.map((i) => i.key));
  return saleItems.filter((k) => keys.has(k));
}
