/** RN-63 a RN-65: o que cada perfil pode ler e escrever diretamente no Firestore. */
import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const T = "dona-rosa";
let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-fidelidade-rules",
    firestore: { host, port: Number(port), rules: readFileSync(fileURLToPath(new URL("../../../firestore.rules", import.meta.url)), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `tenants/${T}`), { brand: { name: "Dona Rosa" } });
    await setDoc(doc(db, `tenants/${T}/customers/ana`), { name: "Ana", points: 100 });
    await setDoc(doc(db, `tenants/${T}/customers/ana/notifications/n1`), { title: "Oi", read: false });
    await setDoc(doc(db, `tenants/${T}/customers/ana/ledger/l1`), { points: 100 });
    await setDoc(doc(db, `tenants/${T}/customers/bia`), { name: "Bia", points: 9 });
    await setDoc(doc(db, `tenants/${T}/vouchers/ABCDEFGH`), { customerUid: "ana", status: "active" });
    await setDoc(doc(db, `tenants/${T}/cardTokens/c1`), { uid: "ana", token: "tok" });
    await setDoc(doc(db, `tenants/${T}/cpfIndex/h1`), { uid: "ana" });
    await setDoc(doc(db, `tenants/${T}/configHistory/1`), { version: 1 });
    await setDoc(doc(db, `tenants/${T}/campaigns/c/staff/carlos`), { bonusCents: 100 });
  });
});

afterAll(async () => { await env?.cleanup(); });

const ana = () => env.authenticatedContext("ana").firestore();
const carlos = () => env.authenticatedContext("carlos", { roles: { [T]: "attendant" } }).firestore();
const gerente = () => env.authenticatedContext("gil", { roles: { [T]: "manager" } }).firestore();
const outraRede = () => env.authenticatedContext("zed", { roles: { "rede-avenida": "manager" } }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("Configuração pública", () => {
  it("qualquer pessoa lê a configuração; ninguém escreve", async () => {
    await assertSucceeds(getDoc(doc(anon(), `tenants/${T}`)));
    await assertFails(setDoc(doc(gerente(), `tenants/${T}`), { brand: { name: "Hack" } }));
  });
  it("histórico só para gerente da rede", async () => {
    await assertSucceeds(getDoc(doc(gerente(), `tenants/${T}/configHistory/1`)));
    await assertFails(getDoc(doc(carlos(), `tenants/${T}/configHistory/1`)));
    await assertFails(getDoc(doc(outraRede(), `tenants/${T}/configHistory/1`)));
  });
});

describe("Dados do cliente (RN-64, RN-65)", () => {
  it("cliente lê só os próprios dados", async () => {
    await assertSucceeds(getDoc(doc(ana(), `tenants/${T}/customers/ana`)));
    await assertSucceeds(getDoc(doc(ana(), `tenants/${T}/customers/ana/ledger/l1`)));
    await assertFails(getDoc(doc(ana(), `tenants/${T}/customers/bia`)));
    await assertFails(getDoc(doc(anon(), `tenants/${T}/customers/ana`)));
  });
  it("cliente não altera pontos nem cria lançamentos", async () => {
    await assertFails(updateDoc(doc(ana(), `tenants/${T}/customers/ana`), { points: 999999 }));
    await assertFails(setDoc(doc(ana(), `tenants/${T}/customers/ana/ledger/x`), { points: 10 }));
  });
  it("frentista não lê dados pessoais; gerente da rede lê; gerente de outra rede não", async () => {
    await assertFails(getDoc(doc(carlos(), `tenants/${T}/customers/ana`)));
    await assertSucceeds(getDoc(doc(gerente(), `tenants/${T}/customers/ana`)));
    await assertFails(getDoc(doc(outraRede(), `tenants/${T}/customers/ana`)));
  });
  it("RN-63: notificação só pode ser marcada como lida", async () => {
    await assertSucceeds(updateDoc(doc(ana(), `tenants/${T}/customers/ana/notifications/n1`), { read: true }));
    await assertFails(updateDoc(doc(ana(), `tenants/${T}/customers/ana/notifications/n1`), { title: "outro" }));
    await assertFails(setDoc(doc(ana(), `tenants/${T}/customers/ana/notifications/n2`), { title: "x", read: false }));
  });
});

describe("Vouchers e dados internos", () => {
  it("frentista consulta voucher pelo código mas não lista todos", async () => {
    await assertSucceeds(getDoc(doc(carlos(), `tenants/${T}/vouchers/ABCDEFGH`)));
    await assertFails(getDocs(collection(carlos(), `tenants/${T}/vouchers`)));
    await assertSucceeds(getDocs(query(collection(ana(), `tenants/${T}/vouchers`), where("customerUid", "==", "ana"))));
    await assertFails(getDocs(collection(ana(), `tenants/${T}/vouchers`)));
  });
  it("tokens de cartão e índice de CPF são inacessíveis pelo app", async () => {
    await assertFails(getDoc(doc(ana(), `tenants/${T}/cardTokens/c1`)));
    await assertFails(getDoc(doc(gerente(), `tenants/${T}/cardTokens/c1`)));
    await assertFails(getDoc(doc(gerente(), `tenants/${T}/cpfIndex/h1`)));
  });
  it("RN-57: equipe vê o ranking da própria rede", async () => {
    await assertSucceeds(getDocs(collection(carlos(), `tenants/${T}/campaigns/c/staff`)));
    await assertFails(getDocs(collection(ana(), `tenants/${T}/campaigns/c/staff`)));
  });
});
