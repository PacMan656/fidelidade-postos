/**
 * Webhook de confirmação Pix (RN-35). Formato do corpo igual ao da API Pix do Banco Central:
 *   POST /pixWebhook/<rede>   { "pix": [ { "txid", "valor": "100.00", "endToEndId", "horario" } ] }
 * Autenticação: cabeçalho `x-webhook-signature` = HMAC-SHA256(PIX_WEBHOOK_SECRET, corpo bruto) em hex.
 * Bancos que usam mTLS no lugar de assinatura exigem um proxy que valide o certificado e assine a chamada.
 */
import { onRequest } from "firebase-functions/v2/https";
import { REGION, PIX_WEBHOOK_SECRET, logger, HttpsError } from "../lib/core.js";
import { hmacHex, safeEqual } from "../lib/security.js";
import { settlePix } from "../callable/admin.js";
import { TENANT_ID_RE } from "../domain/config.js";

export const pixWebhook = onRequest({ region: REGION, secrets: [PIX_WEBHOOK_SECRET], memory: "256MiB" }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("Método não permitido"); return; }
  const tenantId = req.path.split("/").filter(Boolean).pop() ?? "";
  if (!TENANT_ID_RE.test(tenantId)) { res.status(400).json({ error: "Rede inválida" }); return; }

  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const sig = String(req.get("x-webhook-signature") ?? "");
  if (!sig || !safeEqual(sig, hmacHex(PIX_WEBHOOK_SECRET.value(), raw))) {
    logger.warn("Webhook Pix com assinatura inválida", { tenantId });
    res.status(401).json({ error: "Assinatura inválida" });
    return;
  }

  const events = Array.isArray(req.body?.pix) ? req.body.pix : [];
  const results = [];
  for (const e of events) {
    const txid = String(e?.txid ?? "");
    const e2e = String(e?.endToEndId ?? "");
    const valor = Math.round(Number(e?.valor) * 100);
    if (!txid || !e2e || !Number.isFinite(valor)) { results.push({ txid, ok: false, reason: "evento incompleto" }); continue; }
    try {
      results.push({ txid, ok: true, ...(await settlePix(tenantId, txid, valor, e2e, { source: "webhook", horario: e?.horario ?? null })) });
    } catch (err) {
      results.push({ txid, ok: false, reason: err instanceof HttpsError ? err.message : "erro interno" });
      if (!(err instanceof HttpsError)) logger.error("Falha ao liquidar Pix", { tenantId, txid, err });
    }
  }
  // 200 mesmo com eventos recusados, para o banco não reenviar o que já foi tratado
  res.status(200).json({ results });
});
