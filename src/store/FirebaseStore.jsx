/**
 * Estado do app ligado ao Firebase: leitura em tempo real pelo Firestore (somente o que as regras
 * permitem) e toda alteração pelas Cloud Functions (RN-64). Expõe a mesma interface do modo demonstração.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile,
} from "firebase/auth";
import { doc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, writeBatch, getDoc } from "firebase/firestore";
import { auth, db, call, newRequestId } from "../services/firebase";
import { tokenizeCard, luhnOk } from "../services/payments";
import { useConfig } from "../config/ConfigProvider";
import { Ctx, useToast, computeLevel } from "./context";
import { brl } from "../theme";

const ROLE_KEY = (t) => `fb-role-${t}`;
const fmt = (ts) => {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d) return "Agora";
  const today = new Date().toDateString() === d.toDateString();
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return today ? `Hoje, ${hm}` : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
};
const dayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const STAFF_ROLES = ["attendant", "manager", "owner"];

function useSnap(ref, map, deps) {
  const [v, setV] = useState(null);
  useEffect(() => {
    if (!ref) { setV(null); return undefined; }
    return onSnapshot(ref, (snap) => setV(map(snap)), (e) => { console.warn("Firestore:", e.code); setV(null); });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export function FirebaseStore({ children }) {
  const { config, tenantId } = useConfig();
  const { toast, flash } = useToast();
  const [user, setUser] = useState(undefined); // undefined = carregando
  const [claims, setClaims] = useState({});
  const [role, setRole] = useState(() => { try { return localStorage.getItem(ROLE_KEY(tenantId)) || "cliente"; } catch { return "cliente"; } });

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    setClaims(u ? (await u.getIdTokenResult()).claims : {});
  }), []);

  const uid = user?.uid;
  const staffRole = claims.platformAdmin ? "owner" : claims.roles?.[tenantId];
  const isStaff = STAFF_ROLES.includes(staffRole);
  const asStaff = role === "frentista" && isStaff;
  const custPath = uid ? `tenants/${tenantId}/customers/${uid}` : null;

  /* ---------- assinaturas do cliente ---------- */
  const cust = useSnap(custPath && !asStaff ? doc(db, custPath) : null, (s) => (s.exists() ? { id: s.id, ...s.data() } : false), [custPath, asStaff]);
  const live = cust && !asStaff;
  const sub = (name, ...q) => (live ? query(collection(db, custPath, name), ...q) : null);
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ledger = useSnap(sub("ledger", orderBy("createdAt", "desc"), limit(60)), list, [live, custPath]);
  const openLots = useSnap(sub("ledger", where("open", "==", true), orderBy("expiresAt"), limit(50)), list, [live, custPath]);
  const cards = useSnap(sub("cards"), list, [live, custPath]);
  const locks = useSnap(sub("fuelLocks", where("status", "==", "active")), list, [live, custPath]);
  const maint = useSnap(sub("maintenance"), list, [live, custPath]);
  const coupons = useSnap(sub("coupons"), list, [live, custPath]);
  const notes = useSnap(sub("notifications", orderBy("createdAt", "desc"), limit(40)), list, [live, custPath]);
  const offer = useSnap(live ? doc(db, custPath, "offers", dayKey()) : null, (s) => (s.exists() ? s.data() : null), [live, custPath]);
  const vouchers = useSnap(live ? query(collection(db, `tenants/${tenantId}/vouchers`), where("customerUid", "==", uid), orderBy("createdAt", "desc"), limit(50)) : null, list, [live, uid, tenantId]);

  /* ---------- assinaturas da equipe ---------- */
  const campId = config.campaign?.id;
  const staffDoc = useSnap(asStaff ? doc(db, `tenants/${tenantId}/staff/${uid}`) : null, (s) => (s.exists() ? s.data() : null), [asStaff, uid, tenantId]);
  const campDoc = useSnap(asStaff && campId ? doc(db, `tenants/${tenantId}/campaigns/${campId}/staff/${uid}`) : null, (s) => (s.exists() ? s.data() : null), [asStaff, uid, campId, tenantId]);
  const board = useSnap(asStaff && campId ? query(collection(db, `tenants/${tenantId}/campaigns/${campId}/staff`), orderBy("bonusCents", "desc"), limit(20)) : null, list, [asStaff, campId, tenantId]);

  /* ---------- estado no formato das telas ---------- */
  const s = useMemo(() => {
    const session = !user ? null : asStaff ? { role: "frentista" } : cust ? { role: "cliente" } : null;
    const soon = Date.now() + 30 * 86400000;
    const expiring = (openLots || []).filter((l) => l.expiresAt?.toMillis() < soon).reduce((a, l) => a + l.remaining, 0);
    const km = cust?.car?.km;
    return {
      ready: user !== undefined && (!user || asStaff || cust !== null),
      session,
      needsJoin: !!user && !asStaff && cust === false,
      authUser: user ? { uid: user.uid, email: user.email, name: user.displayName } : null,
      isStaff, staffRole,
      user: { name: (cust?.name || "").split(" ")[0] || "Cliente", fullName: cust?.name || "", cpf: cust?.cpfMasked || "", phone: cust?.phone || "", email: user?.email || "" },
      car: cust?.car ? { model: cust.car.model, plate: cust.car.plate, km: cust.car.km, kmMonth: cust.car.kmMonth || 0 } : { model: "Cadastre seu veículo", plate: "—", km: 0, kmMonth: 0 },
      points: cust?.points ?? 0,
      lifetimePoints: cust?.lifetimePoints ?? 0,
      prepaid: (cust?.prepaidCents ?? 0) / 100,
      offerActive: !!offer && offer.expiresAt?.toMillis() > Date.now(),
      expiringNotice: expiring > 0 ? `${expiring} pontos vencem nos próximos 30 dias` : null,
      cards: [...(cards || [])].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)),
      tx: (ledger || []).map((e) => ({ t: e.description, d: fmt(e.createdAt), v: e.points, kind: e.points >= 0 ? "in" : "out" })),
      vouchers: (vouchers || []).map((v) => ({ code: v.code, rewardId: v.rewardId, name: v.rewardName, date: fmt(v.createdAt), status: { active: "ativo", used: "usado", expired: "vencido", cancelled: "cancelado" }[v.status] || v.status })),
      coupons: (coupons || []).map((c) => ({ partnerId: c.partnerId, code: c.code })),
      banked: (locks || []).map((l) => ({ fuel: l.fuel, liters: l.litersRemaining, price: l.pricePerLiterCents / 100, date: fmt(l.createdAt) })),
      maint: (maint || []).map((m) => {
        const pct = km && m.lastKm != null ? Math.min(100, Math.round(((km - m.lastKm) / m.everyKm) * 100)) : 0;
        const status = !km || m.lastKm == null ? "dica" : pct >= 100 ? "atrasada" : pct >= 75 ? "proxima" : "emdia";
        const detail = !km ? "Informe a quilometragem do veículo" : m.lastKm == null ? `A cada ${m.everyKm.toLocaleString("pt-BR")} km` : `Faltam ~${Math.max(0, m.lastKm + m.everyKm - km).toLocaleString("pt-BR")} km`;
        const sch = m.scheduled ? `${m.scheduled.date.split("-").reverse().slice(0, 2).join("/")} às ${m.scheduled.hour} · ${m.scheduled.station}` : null;
        return { id: m.id, name: m.name, status: status === "dica" ? "proxima" : status, detail, pct, bonus: m.bonus, scheduled: sch };
      }),
      notifications: (notes || []).map((n) => ({ id: n.id, t: n.title, b: n.body, d: fmt(n.createdAt), read: n.read, kind: n.kind })),
      staffCode: staffDoc?.code || null,
      staff: { name: staffDoc?.name || user?.displayName || user?.email || "Frentista", station: staffDoc?.station || config.stations?.[0] || "" },
      fr: campDoc?.counters || {},
      campaign: {
        bonusCents: campDoc?.bonusCents || 0, sales: campDoc?.sales || 0, identifiedSales: campDoc?.identifiedSales || 0,
        identPct: campDoc?.sales ? Math.round((campDoc.identifiedSales / campDoc.sales) * 100) : 0,
      },
      ranking: (board || []).map((b) => ({ name: b.id === uid ? `Você (${b.name})` : b.name, val: (b.bonusCents || 0) / 100, me: b.id === uid })),
    };
  }, [user, asStaff, cust, openLots, cards, ledger, vouchers, coupons, locks, maint, notes, offer, staffDoc, campDoc, board, isStaff, staffRole, uid, config.stations]);

  /* ---------- ações ---------- */
  const T = tenantId;
  const run = async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) flash(typeof okMsg === "function" ? okMsg(r) : okMsg); return r ?? true; }
    catch (e) { flash(e.message || "Não foi possível concluir agora.", "err"); return null; }
  };

  const actions = useMemo(() => ({
    signIn: (email, password, wanted) => run(async () => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const tr = await cred.user.getIdTokenResult(true);
      const r = tr.claims.platformAdmin ? "owner" : tr.claims.roles?.[T];
      if (wanted === "frentista" && !STAFF_ROLES.includes(r)) { await signOut(auth); throw new Error("Esta conta não faz parte da equipe desta rede."); }
      setClaims(tr.claims);
      try { localStorage.setItem(ROLE_KEY(T), wanted); } catch {}
      setRole(wanted);
      if (wanted === "cliente") {
        const member = await getDoc(doc(db, `tenants/${T}/customers/${cred.user.uid}`));
        return { needsJoin: !member.exists() };
      }
      return { needsJoin: false };
    }),
    register: (f) => run(async () => {
      if (!auth.currentUser) {
        const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
        await updateProfile(cred.user, { displayName: f.name.trim() });
      }
      setRole("cliente");
      try { localStorage.setItem(ROLE_KEY(T), "cliente"); } catch {}
      return call("joinTenant", { tenantId: T, name: f.name.trim(), cpf: f.cpf, phone: f.phone, referralCode: f.referralCode || "" });
    }, `Bem-vindo à ${config.brand?.name}!`),
    resetPassword: (email) => run(() => sendPasswordResetEmail(auth, email), "Enviamos um link para redefinir a senha no seu e-mail"),
    logout: () => signOut(auth),
    login: () => {},
    reset: null,

    activateOffer: () => run(() => call("activateOffer", { tenantId: T })),
    redeem: (r) => run(() => call("redeemReward", { tenantId: T, rewardId: r.id })),
    startPix: (amount) => run(() => call("createPixCharge", { tenantId: T, amount: Number(amount) })),
    watchPix: (txid, cb) => onSnapshot(doc(db, `tenants/${T}/pixCharges/${txid}`), (snap) => cb(snap.get("status"))),
    confirmPixDemo: null,
    creditCard: (amount, cardId) => run(() => call("creditWithCard", { tenantId: T, amount: Number(amount), cardId, requestId: newRequestId() }), (r) => `${brl(Number(amount))} adicionados · saldo ${brl(r.balanceCents / 100)}`),
    addCard: (cf) => run(async () => {
      const digits = cf.num.replace(/\D/g, "");
      if (!luhnOk(digits)) throw new Error("Número de cartão inválido");
      if (!cf.name.trim()) throw new Error("Informe o nome impresso no cartão");
      if (!/^\d{2}\/\d{2}$/.test(cf.val)) throw new Error("Validade no formato MM/AA");
      if (!/^\d{3,4}$/.test(cf.cvv)) throw new Error("CVV inválido");
      const t = await tokenizeCard({ number: digits, name: cf.name, expiry: cf.val, cvv: cf.cvv });
      return call("addCard", { tenantId: T, token: t.token, last4: t.last4, brand: t.brand, kind: cf.kind });
    }, "Cartão adicionado"),
    setMainCard: (cardId) => run(() => call("setDefaultCard", { tenantId: T, cardId })),
    removeCard: (cardId) => run(() => call("removeCard", { tenantId: T, cardId }), "Cartão removido"),
    pay: (amount, method, cardId) => run(async () => {
      const r = await call("payWithApp", { tenantId: T, amount: Number(amount), method: method === "prepaid" ? "wallet" : "card", cardId, requestId: newRequestId() });
      return { amount: r.amountCents / 100, pts: r.points, auth: r.authorization || r.saleId.slice(-8).toUpperCase() };
    }),
    lockPrice: (fuel, liters) => run(() => call("lockFuelPrice", { tenantId: T, fuel, liters: Number(liters) }), (r) => `${liters} L de ${fuel} travados a ${brl(r.pricePerLiterCents / 100)}/L`),
    scheduleMaint: (itemId, slot) => run(() => call("scheduleMaintenance", { tenantId: T, itemId, date: slot.date, hour: slot.hour, station: slot.station }), "Serviço agendado"),
    saveCoupon: (p) => run(() => call("claimCoupon", { tenantId: T, partnerId: p.id }), (r) => (r.created ? "Cupom guardado na carteira" : "Cupom já está na sua carteira")),
    readAll: async () => {
      const batch = writeBatch(db);
      (notes || []).filter((n) => !n.read).forEach((n) => batch.update(doc(db, custPath, "notifications", n.id), { read: true }));
      await batch.commit().catch(() => {});
    },
    readOne: (id) => updateDoc(doc(db, custPath, "notifications", id), { read: true }).catch(() => {}),
    updateCar: (car) => run(() => call("updateProfile", { tenantId: T, car: { model: car.model, plate: car.plate, km: Math.round(Number(car.km) || 0) } }), "Veículo atualizado"),
    issueCheckin: () => call("issueCheckinToken", { tenantId: T }).catch((e) => { flash(e.message, "err"); return null; }),

    /* equipe */
    lookupCustomer: (who) => run(() => call("lookupCustomer", { tenantId: T, ...who })),
    registerSale: (sale) => run(() => call("registerSale", { tenantId: T, requestId: newRequestId(), ...sale })),
    validateVoucher: (code, confirm) => run(() => call("validateVoucher", { tenantId: T, code, station: s.staff.station, confirm })),
  }), [T, config.brand?.name, notes, custPath, s.staff.station]); // eslint-disable-line react-hooks/exhaustive-deps

  const level = useMemo(() => computeLevel(config, s), [config, s]);
  const value = useMemo(() => ({ s, level, toast, flash, mode: "firebase", ...actions }), [s, level, toast, flash, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
