// Inicialização do Firebase. Sem as variáveis VITE_FIREBASE_*, o app roda em modo demonstração (dados locais).
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const env = import.meta.env;
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
const useEmulators = env.VITE_USE_EMULATORS === "true";

export const firebaseEnabled = !!(cfg.projectId && (cfg.apiKey || useEmulators));

export let app = null, auth = null, db = null, functions = null;

if (firebaseEnabled) {
  app = initializeApp({ ...cfg, apiKey: cfg.apiKey || "demo-key" });
  // RN-68: App Check em produção (chave do reCAPTCHA Enterprise)
  if (env.VITE_RECAPTCHA_SITE_KEY && !useEmulators) {
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  }
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app, "southamerica-east1");
  if (useEmulators) {
    const host = env.VITE_EMULATOR_HOST || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
  }
}

/** Chama uma Cloud Function e devolve só os dados; erros chegam com a mensagem em português do backend. */
export async function call(name, data) {
  try {
    const r = await httpsCallable(functions, name)(data);
    return r.data;
  } catch (e) {
    const err = new Error(e?.message || "Não foi possível concluir agora.");
    err.code = e?.code;
    err.details = e?.details;
    throw err;
  }
}

export const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
