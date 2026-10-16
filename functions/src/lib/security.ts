import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Hash do CPF com segredo do servidor, por rede (RN-12) */
export const cpfHash = (pepper: string, tenantId: string, cpf: string) => hmacHex(pepper, `${tenantId}:${cpf}`);

/** QR temporário de identificação no caixa (RN-49): não carrega CPF e expira em minutos. */
export function signCheckin(secret: string, tenantId: string, uid: string, ttlSec = 300, now = Date.now()) {
  const payload = b64url(JSON.stringify({ t: tenantId, u: uid, e: Math.floor(now / 1000) + ttlSec }));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, expiresAt: new Date((Math.floor(now / 1000) + ttlSec) * 1000) };
}

export function verifyCheckin(secret: string, token: string, now = Date.now()): { t: string; u: string } | null {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof p.t !== "string" || typeof p.u !== "string" || typeof p.e !== "number") return null;
    if (p.e * 1000 < now) return null;
    return { t: p.t, u: p.u };
  } catch {
    return null;
  }
}
