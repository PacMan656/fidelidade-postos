/** Validação e leitura da configuração da rede (RN-05, RN-06). */
import { toCents } from "./money.js";
import type { PointsRules } from "./points.js";

export const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const isNum = (v: unknown, min = 0) => typeof v === "number" && Number.isFinite(v) && v >= min;
const isStr = (v: unknown) => typeof v === "string" && v.trim().length > 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TenantConfig = Record<string, any>;

export function validateConfig(cfg: TenantConfig): string[] {
  const e: string[] = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return ["Configuração inválida"];
  if (!isStr(cfg.brand?.name)) e.push("brand.name é obrigatório");
  for (const k of ["brand", "brandDeep", "ink", "accent", "cream"]) {
    if (!HEX.test(cfg.brand?.colors?.[k] ?? "")) e.push(`brand.colors.${k} deve ser #RRGGBB`);
  }

  if (!Array.isArray(cfg.levels) || cfg.levels.length === 0) e.push("levels precisa de ao menos 1 nível");
  else cfg.levels.forEach((l: TenantConfig, i: number) => { if (!isStr(l.name) || !isNum(l.min)) e.push(`levels[${i}] precisa de nome e mínimo ≥ 0`); });

  const fuels = Object.entries(cfg.fuelPrices ?? {});
  if (!fuels.length) e.push("fuelPrices precisa de ao menos 1 combustível");
  fuels.forEach(([k, v]) => { if (!isNum(v) || (v as number) <= 0) e.push(`fuelPrices.${k} deve ser maior que zero`); });

  for (const k of ["rewards", "partners", "missions", "stations"]) if (!Array.isArray(cfg[k])) e.push(`${k} deve ser uma lista`);

  const ids = (list: TenantConfig[] = [], what: string, key = "id") => {
    const seen = new Set<string>();
    list.forEach((x) => {
      if (!isStr(x?.[key])) e.push(`${what}: item sem identificador`);
      else if (seen.has(x[key])) e.push(`${what}: identificador repetido "${x[key]}"`);
      else seen.add(x[key]);
    });
  };
  if (Array.isArray(cfg.rewards)) {
    ids(cfg.rewards, "rewards");
    cfg.rewards.forEach((r: TenantConfig) => {
      if (!isStr(r.name)) e.push(`rewards.${r.id}: nome obrigatório`);
      if (!Number.isInteger(r.cost) || r.cost <= 0) e.push(`rewards.${r.id}: custo deve ser inteiro maior que zero`);
      if (r.stock != null && (!Number.isInteger(r.stock) || r.stock < 0)) e.push(`rewards.${r.id}: estoque deve ser inteiro ≥ 0 ou vazio`);
      if (r.limitPerMonth != null && (!Number.isInteger(r.limitPerMonth) || r.limitPerMonth < 1)) e.push(`rewards.${r.id}: limite mensal deve ser inteiro ≥ 1 ou vazio`);
    });
  }
  if (Array.isArray(cfg.partners)) ids(cfg.partners, "partners");
  if (Array.isArray(cfg.missions)) ids(cfg.missions, "missions");
  if (cfg.campaign?.items) ids(cfg.campaign.items, "campaign.items", "key");

  const p = cfg.points ?? {};
  if (!isNum(p.perReal)) e.push("points.perReal deve ser ≥ 0");
  if (!isNum(p.appMultiplier, 1)) e.push("points.appMultiplier deve ser ≥ 1");
  if (p.expirationMonths != null && (!Number.isInteger(p.expirationMonths) || p.expirationMonths < 1)) e.push("points.expirationMonths deve ser inteiro ≥ 1");

  const w = cfg.wallet ?? {};
  if (isNum(w.minCredit) && isNum(w.maxCredit) && w.minCredit > w.maxCredit) e.push("wallet: recarga mínima maior que a máxima");
  if (cfg.features?.pix && !isStr(cfg.pix?.key)) e.push("pix.key é obrigatória com o Pix ligado");
  if (cfg.offer?.active && !isNum(cfg.offer?.discountPerLiter)) e.push("offer.discountPerLiter é obrigatório com a oferta ativa");

  if (cfg.domains != null && (!Array.isArray(cfg.domains) || cfg.domains.some((d: unknown) => !isStr(d)))) e.push("domains deve ser uma lista de textos");
  return e;
}

/** Valores numéricos das regras, com os padrões do documento de regras de negócio. */
export function rulesOf(cfg: TenantConfig) {
  const points: PointsRules = {
    perReal: cfg.points?.perReal ?? 1,
    appMultiplier: cfg.points?.appMultiplier ?? 2,
    expirationMonths: cfg.points?.expirationMonths ?? 12,
    welcomeBonus: cfg.points?.welcomeBonus ?? 200,
  };
  return {
    points,
    wallet: {
      minCreditCents: toCents(cfg.wallet?.minCredit ?? 10),
      maxCreditCents: toCents(cfg.wallet?.maxCredit ?? 1000),
      maxBalanceCents: toCents(cfg.wallet?.maxBalance ?? 2000),
      pixExpirationMinutes: cfg.wallet?.pixExpirationMinutes ?? 30,
    },
    priceLock: {
      minLiters: cfg.priceLock?.minLiters ?? 5,
      maxLiters: cfg.priceLock?.maxLiters ?? 200,
      maxActiveLiters: cfg.priceLock?.maxActiveLiters ?? 300,
      validityDays: cfg.priceLock?.validityDays ?? 30,
    },
    offer: {
      active: !!cfg.offer?.active,
      discountPerLiterCents: toCents(cfg.offer?.discountPerLiter ?? 0),
      endsAtHour: cfg.offer?.endsAtHour ?? 23,
      maxLitersPerDay: cfg.offer?.maxLitersPerDay ?? 100,
    },
    vouchers: { validityDays: cfg.vouchers?.validityDays ?? 30 },
    maintenance: { slotCapacity: cfg.maintenance?.slotCapacity ?? 2, hours: (cfg.maintenance?.hours ?? []) as string[] },
  };
}

export const fuelPriceCents = (cfg: TenantConfig, fuel: string): number | null =>
  cfg.fuelPrices && fuel in cfg.fuelPrices ? toCents(cfg.fuelPrices[fuel]) : null;

export const stationIdOf = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
