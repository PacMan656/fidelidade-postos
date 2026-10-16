/** Utilitários dos testes nos emuladores (rodam via `firebase emulators:exec`). */
import { initializeApp as initClient, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth as clientAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, type User } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { initializeApp as initAdmin, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PROJECT = "demo-fidelidade";
export const REGION = "southamerica-east1";
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FN = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

if (!getApps().length) initAdmin({ projectId: PROJECT });
export const adminDb = getFirestore();
export const adminAuth = getAuth();

export const tenantSeed = (id: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../seed/tenants/${id}.json`, import.meta.url)), "utf8"));

export async function resetEmulators() {
  await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
}

export async function seedTenant(id: string, patch: (c: Record<string, any>) => void = () => {}) {
  const cfg = tenantSeed(id);
  patch(cfg);
  await adminDb.collection("tenants").doc(id).set({ ...cfg, version: 1, status: cfg.status ?? "active" });
  return cfg;
}

const apps: FirebaseApp[] = [];
let n = 0;

export interface TestUser { user: User; uid: string; call: <T = any>(name: string, data?: Record<string, unknown>) => Promise<T>; refresh: () => Promise<void> }

/** Cria usuário com SDK cliente (como o app faz) e devolve um chamador de functions autenticado. */
export async function makeUser(email = `u${++n}-${Date.now()}@teste.com`, claims?: Record<string, unknown>): Promise<TestUser> {
  const app = initClient({ apiKey: "demo-key", projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, `app-${email}`);
  apps.push(app);
  const a = clientAuth(app);
  connectAuthEmulator(a, `http://${AUTH}`, { disableWarnings: true });
  const fns = getFunctions(app, REGION);
  const [host, port] = FN.split(":");
  connectFunctionsEmulator(fns, host, Number(port));
  const cred = await createUserWithEmailAndPassword(a, email, "senha-forte-123");
  if (claims) {
    await adminAuth.setCustomUserClaims(cred.user.uid, claims);
    await signInWithEmailAndPassword(a, email, "senha-forte-123");
    await a.currentUser!.getIdToken(true);
  }
  return {
    user: a.currentUser!,
    uid: cred.user.uid,
    call: async (name, data = {}) => (await httpsCallable(fns, name)(data)).data as any,
    refresh: async () => { await a.currentUser!.getIdToken(true); },
  };
}

export async function cleanupApps() {
  await Promise.all(apps.splice(0).map((a) => deleteApp(a)));
}

/** Espera um erro de callable e devolve o código (ex.: "functions/permission-denied"). */
export async function errorOf(p: Promise<unknown>): Promise<{ code: string; message: string; details?: unknown }> {
  try { await p; } catch (e: any) { return { code: e.code, message: e.message, details: e.details }; }
  throw new Error("Era esperado um erro");
}

export const functionsUrl = (name: string) => `http://${FN}/${PROJECT}/${REGION}/${name}`;

// CPFs válidos para testes
export const CPFS = ["529.982.247-25", "111.444.777-35", "390.533.447-05", "123.456.789-09", "987.654.321-00"];
