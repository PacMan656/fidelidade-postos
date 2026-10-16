/**
 * Provedores de pagamento. A plataforma não processa cartão nem gera Pix dinâmico sozinha:
 * isso é responsabilidade de um PSP/gateway homologado. Aqui ficam as interfaces e duas
 * implementações:
 *  - Pix "chave estática": gera o BR Code com txid na chave da rede; a confirmação chega pelo
 *    webhook do banco/PSP (http/pixWebhook.ts) ou pela confirmação manual do gerente.
 *  - Cartão "sandbox": aprova tokens `tok_test_*` e recusa `tok_test_decline*`. Para produção,
 *    implemente CardGateway com o gateway escolhido (Mercado Pago, Pagar.me, Stripe, Cielo…).
 * RN-38: o servidor só recebe token, nunca número de cartão ou CVV.
 */
import { buildBrCode } from "../domain/pix.js";
import type { TenantConfig } from "../domain/config.js";

export interface PixCharge { txid: string; brCode: string; expiresAt: Date }

export interface PixProvider {
  createCharge(i: { cfg: TenantConfig; txid: string; amountCents: number; expiresInMin: number }): Promise<PixCharge>;
}

export const staticKeyPix: PixProvider = {
  async createCharge({ cfg, txid, amountCents, expiresInMin }) {
    const pix = cfg.pix ?? {};
    if (!pix.key) throw new Error("Chave Pix da rede não configurada");
    return {
      txid,
      brCode: buildBrCode({ key: pix.key, merchantName: pix.merchantName ?? cfg.brand?.name ?? "", merchantCity: pix.merchantCity ?? "", amountCents, txid }),
      expiresAt: new Date(Date.now() + expiresInMin * 60_000),
    };
  },
};

export interface CardChargeResult { approved: boolean; authorization?: string; reason?: string }

export interface CardGateway {
  name: string;
  charge(i: { token: string; amountCents: number; description: string; idempotencyKey: string }): Promise<CardChargeResult>;
}

export const sandboxGateway: CardGateway = {
  name: "sandbox",
  async charge({ token, idempotencyKey }) {
    if (!token.startsWith("tok_test_")) return { approved: false, reason: "Token de cartão inválido para o ambiente de testes" };
    if (token.startsWith("tok_test_decline")) return { approved: false, reason: "Pagamento recusado pelo emissor" };
    return { approved: true, authorization: `SBX-${idempotencyKey.slice(0, 8).toUpperCase()}` };
  },
};

// troque aqui pelo provedor real; a escolha pode vir de cfg.payments.gateway por rede
export const pixProvider = (_cfg: TenantConfig): PixProvider => staticKeyPix;
export const cardGateway = (_cfg: TenantConfig): CardGateway => sandboxGateway;
