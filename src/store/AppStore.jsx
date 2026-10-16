import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { initialState, fuelPrices, LEVELS } from "./data";
import { brl, num } from "../theme";

const KEY = "dona-rosa-state-v1";
const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch (e) {}
  return initialState;
}

const nowLabel = () => {
  const d = new Date();
  return `Hoje, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const code = (p) => `${p}-` + Math.random().toString(36).slice(2, 6).toUpperCase();

export function AppProvider({ children }) {
  const [s, setS] = useState(load);
  const [toast, setToast] = useState(null);
  const timer = useRef();

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }, [s]);

  const flash = useCallback((m, tone = "ok") => {
    clearTimeout(timer.current);
    setToast({ m, tone });
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const patch = (fn) => setS((p) => ({ ...p, ...fn(p) }));

  const actions = useMemo(() => ({
    login: (role) => patch(() => ({ session: { role } })),
    logout: () => patch(() => ({ session: null })),
    reset: () => { setS({ ...initialState, session: s.session }); flash("Dados de demonstração restaurados"); },

    activateOffer: () => patch((p) => (p.offerActive ? {} : { offerActive: true })),

    redeem: (r) => {
      if (s.points < r.cost) { flash("Pontos insuficientes para este resgate", "err"); return null; }
      const v = { code: code("DR"), rewardId: r.id, name: r.name, date: nowLabel(), status: "ativo" };
      patch((p) => ({
        points: p.points - r.cost,
        tx: [{ t: `Resgate · ${r.name}`, d: "Agora", v: -r.cost, kind: "out" }, ...p.tx],
        vouchers: [v, ...p.vouchers],
      }));
      return v;
    },

    addCredit: (amount, method) => {
      const a = Number(amount) || 0;
      if (a <= 0) { flash("Informe um valor válido", "err"); return false; }
      patch((p) => ({ prepaid: p.prepaid + a }));
      flash(method === "pix" ? `Pix confirmado · ${brl(a)} na carteira` : `${brl(a)} adicionados à carteira`);
      return true;
    },

    addCard: (cf) => {
      const digits = cf.num.replace(/\D/g, "");
      if (digits.length < 13) { flash("Número de cartão inválido", "err"); return false; }
      if (!cf.name.trim()) { flash("Informe o nome impresso no cartão", "err"); return false; }
      if (!/^\d{2}\/\d{2}$/.test(cf.val)) { flash("Validade no formato MM/AA", "err"); return false; }
      if (!/^\d{3,4}$/.test(cf.cvv)) { flash("CVV inválido", "err"); return false; }
      const brand = digits.startsWith("4") ? "Visa" : digits.startsWith("5") ? "Mastercard" : digits.startsWith("3") ? "Amex" : "Elo";
      patch((p) => ({ cards: [...p.cards, { id: code("c"), brand, last4: digits.slice(-4), kind: cf.kind }] }));
      flash("Cartão adicionado");
      return true;
    },
    setMainCard: (id) => patch((p) => ({ cards: [...p.cards.filter((x) => x.id === id), ...p.cards.filter((x) => x.id !== id)] })),
    removeCard: (id) => { patch((p) => ({ cards: p.cards.filter((x) => x.id !== id) })); flash("Cartão removido"); },

    pay: (amount, method) => {
      const a = Number(amount) || 0;
      if (a <= 0) { flash("Informe o valor do abastecimento", "err"); return null; }
      if (method === "prepaid" && s.prepaid < a) { flash("Saldo pré-pago insuficiente", "err"); return null; }
      const pts = Math.round(a) * 2; // pontos em dobro pagando pelo app
      patch((p) => ({
        prepaid: method === "prepaid" ? p.prepaid - a : p.prepaid,
        points: p.points + pts,
        tx: [{ t: "Pagamento pelo app · pontos 2×", d: "Agora", v: pts, kind: "in" }, ...p.tx],
      }));
      return { amount: a, pts, auth: code("AUT") };
    },

    lockPrice: (fuel, liters) => {
      const l = Number(liters) || 0;
      if (l <= 0) { flash("Escolha quantos litros travar", "err"); return false; }
      const price = fuelPrices[fuel];
      patch((p) => ({ banked: [{ fuel, liters: l, price, date: "Agora" }, ...p.banked] }));
      flash(`${l} L de ${fuel} travados a ${brl(price)}/L`);
      return true;
    },

    scheduleMaint: (id, slot) => {
      patch((p) => ({ maint: p.maint.map((x) => (x.id === id ? { ...x, scheduled: slot } : x)) }));
      flash("Serviço agendado · você ganha 2× pontos");
    },

    saveCoupon: (partner) => {
      if (s.coupons.some((x) => x.partnerId === partner.id)) { flash("Cupom já está na sua carteira"); return; }
      patch((p) => ({ coupons: [{ partnerId: partner.id, code: code("CL") }, ...p.coupons] }));
      flash("Cupom guardado na carteira");
    },

    readAll: () => patch((p) => ({ notifications: p.notifications.map((n) => ({ ...n, read: true })) })),
    readOne: (id) => patch((p) => ({ notifications: p.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

    updateCar: (car) => { patch((p) => ({ car: { ...p.car, ...car } })); flash("Veículo atualizado"); },

    bumpFr: (k, msg) => { patch((p) => ({ fr: { ...p.fr, [k]: p.fr[k] + 1 } })); flash(msg); },
  }), [s, flash]);

  const level = useMemo(() => {
    let i = 0;
    LEVELS.forEach((l, idx) => { if (s.points >= l.min) i = idx; });
    const cur = LEVELS[i], next = LEVELS[i + 1];
    const faltam = next ? next.min - s.points : 0;
    const fill = next ? Math.round(((s.points - cur.min) / (next.min - cur.min)) * 100) : 100;
    return { name: cur.name, next: next?.name, faltam, fill };
  }, [s.points]);

  const value = useMemo(() => ({ s, level, toast, flash, ...actions }), [s, level, toast, flash, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
export { num };
