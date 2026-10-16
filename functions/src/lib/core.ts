import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { TENANT_ID_RE, type TenantConfig } from "../domain/config.js";

if (!getApps().length) initializeApp();
export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth();
export { FieldValue, Timestamp, HttpsError, logger };

export const REGION = "southamerica-east1";
export const QR_SIGNING_KEY = defineSecret("QR_SIGNING_KEY");
export const CPF_PEPPER = defineSecret("CPF_PEPPER");
export const PIX_WEBHOOK_SECRET = defineSecret("PIX_WEBHOOK_SECRET");
// RN-68: em produção, functions/.env.<projeto> com ENFORCE_APP_CHECK=true (lido no deploy)
export const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";

/* ---------- papéis (RN-01 a RN-03) ---------- */
export type StaffRole = "attendant" | "manager" | "owner";
const RANK: Record<StaffRole, number> = { attendant: 1, manager: 2, owner: 3 };
export const isStaffRole = (r: unknown): r is StaffRole => typeof r === "string" && r in RANK;

export interface Caller { uid: string; email?: string; name?: string; platformAdmin: boolean; roles: Record<string, StaffRole> }

export function caller(req: CallableRequest): Caller {
  if (!req.auth) throw new HttpsError("unauthenticated", "Entre na sua conta para continuar.");
  const t = req.auth.token as Record<string, unknown>;
  return {
    uid: req.auth.uid,
    email: t.email as string | undefined,
    name: (t.name as string | undefined) ?? (t.email as string | undefined),
    platformAdmin: t.platformAdmin === true,
    roles: (t.roles as Record<string, StaffRole>) ?? {},
  };
}

export function roleIn(c: Caller, tenantId: string): StaffRole | null {
  return c.platformAdmin ? "owner" : c.roles[tenantId] ?? null;
}

export function requireRole(c: Caller, tenantId: string, min: StaffRole): StaffRole {
  const r = roleIn(c, tenantId);
  if (!r || RANK[r] < RANK[min]) throw new HttpsError("permission-denied", "Você não tem permissão para esta ação nesta rede.");
  return r;
}

/* ---------- entrada ---------- */
export function str(v: unknown, field: string, { max = 200, optional = false } = {}): string {
  if (v == null || v === "") {
    if (optional) return "";
    throw new HttpsError("invalid-argument", `Informe ${field}.`);
  }
  if (typeof v !== "string" || v.length > max) throw new HttpsError("invalid-argument", `${field} inválido.`);
  return v.trim();
}

export function num(v: unknown, field: string, { min = -Infinity, max = Infinity, integer = false } = {}): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    throw new HttpsError("invalid-argument", `${field} inválido.`);
  }
  return v;
}

export function tenantIdOf(v: unknown): string {
  if (typeof v !== "string" || !TENANT_ID_RE.test(v)) throw new HttpsError("invalid-argument", "Rede inválida.");
  return v;
}

/* ---------- rede ---------- */
export const tenantRef = (t: string) => db.collection("tenants").doc(t);
export const customerRef = (t: string, uid: string) => tenantRef(t).collection("customers").doc(uid);

export async function loadTenant(t: string, tx?: Transaction, { allowSuspended = false } = {}): Promise<TenantConfig> {
  const ref = tenantRef(t);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Rede não encontrada.");
  const cfg = snap.data() as TenantConfig;
  // RN-09
  if (!allowSuspended && cfg.status === "suspended") throw new HttpsError("failed-precondition", "Esta rede está temporariamente suspensa.");
  return cfg;
}

export function requireFeature(cfg: TenantConfig, name: string) {
  if (cfg.features?.[name] === false) throw new HttpsError("failed-precondition", "Este recurso não está disponível nesta rede.");
}

/* ---------- auditoria (RN-04) ---------- */
export function audit(tx: Transaction | null, tenantId: string, c: Caller, action: string, data: Record<string, unknown>) {
  const ref = tenantRef(tenantId).collection("audit").doc();
  const entry = { action, by: c.uid, byName: c.name ?? null, at: FieldValue.serverTimestamp(), ...data };
  return tx ? tx.create(ref, entry) : ref.create(entry);
}

export function notify(tx: Transaction, custRef: DocumentReference, n: { title: string; body: string; kind: string }) {
  tx.create(custRef.collection("notifications").doc(), { ...n, read: false, createdAt: FieldValue.serverTimestamp() });
}

/* ---------- wrapper das callables ---------- */
type Handler<T> = (req: CallableRequest<Record<string, unknown>>) => Promise<T>;

export function callable<T>(handler: Handler<T>, opts: { secrets?: ReturnType<typeof defineSecret>[] } = {}) {
  return onCall(
    { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, secrets: opts.secrets ?? [], memory: "256MiB", timeoutSeconds: 30 },
    async (req) => {
      try {
        return await handler(req as CallableRequest<Record<string, unknown>>);
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        // erros de domínio viram mensagens legíveis; o resto fica no log
        if (e instanceof Error && /insuficiente|inválid/i.test(e.message)) throw new HttpsError("failed-precondition", e.message);
        logger.error("Erro inesperado", e);
        throw new HttpsError("internal", "Não foi possível concluir agora. Tente novamente.");
      }
    },
  );
}
